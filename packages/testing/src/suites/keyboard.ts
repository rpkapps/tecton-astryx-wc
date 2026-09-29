/**
 * `runKeyboardSuite` (A§15.3): turns a component's `parity.json` keyboard table into tests. Every
 * row of the table must be backed by a named step (or explicitly waived), so the docs table and the
 * tests can never drift apart: adding a row without a test fails.
 *
 * ```ts
 * import parity from './parity.json' with {type: 'json'};
 * runKeyboardSuite({
 *   tag: 'tct-tabs',
 *   render: () => `<tct-tabs>…</tct-tabs>`,
 *   table: parity.keyboard,
 *   steps: {
 *     'Moves focus to the next tab': {
 *       focus: (el) => el.querySelector('[role=tab]'),
 *       keys: ['ArrowRight'],
 *       rtl: {keys: ['ArrowLeft']},
 *       expect: (el) => expect(activeText()).toBe('Second'),
 *     },
 *   },
 * });
 * ```
 *
 * A row is matched to a step by its `action` text, then by its `keys` text. The step's `keys` are
 * pressed with `pressKeys` (chords like `Shift+Tab` are fine); when `rtl` is given, the same step is
 * run again in a right-to-left container with those keys.
 */
import {describe, expect, it} from 'vitest';
import {fixture} from '../fixture.js';
import {pressKeys} from '../keyboard.js';
import {nextFrame} from '../timing.js';

/** One row of `parity.json` `keyboard`. */
export interface KeyboardRow {
  keys: string;
  action: string;
  when?: string;
}

export interface KeyboardStepContext {
  /** The element under test. */
  element: HTMLElement;
  /** Whether this run is the right-to-left one. */
  rtl: boolean;
}

export interface KeyboardStep {
  /** Prepares the element (open it, select an item, ...). Runs before focus. */
  setup?: (element: HTMLElement) => void | Promise<void>;
  /** The element to focus before pressing (default: the first tabbable inside the element). */
  focus?: (element: HTMLElement) => HTMLElement | null | undefined;
  /** Chords to press (`ArrowRight`, `Shift+Tab`, `a`, `Enter`). */
  keys: readonly string[];
  /** Runs the step again in RTL with these keys (mirrored arrows) and, optionally, another expectation. */
  rtl?: {keys?: readonly string[]; expect?: (context: KeyboardStepContext) => void | Promise<void>};
  /** Asserts the outcome. */
  expect: (context: KeyboardStepContext) => void | Promise<void>;
}

export interface KeyboardSuiteOptions {
  /** The registered tag name. */
  tag: string;
  /** Markup of the element under test, wrapped by the suite in a `dir` container. */
  render: () => string;
  /** The `keyboard` array of the component's `parity.json`. */
  table: readonly KeyboardRow[];
  /** Steps by row `action` (or `keys`). */
  steps: Readonly<Record<string, KeyboardStep>>;
  /** Rows deliberately not covered, by `action`, each with the reason (disclosed gap). */
  waive?: Readonly<Record<string, string>>;
}

export function runKeyboardSuite(options: KeyboardSuiteOptions): void {
  const {tag, render, table, steps, waive = {}} = options;

  async function mount(rtl: boolean): Promise<HTMLElement> {
    const root = await fixture<HTMLElement>(
      `<div dir="${rtl ? 'rtl' : 'ltr'}" style="padding:40px">${render()}</div>`,
    );
    const element = root.querySelector<HTMLElement>(tag)!;
    await (element as unknown as {updateComplete?: Promise<unknown>}).updateComplete;
    return element;
  }

  async function run(step: KeyboardStep, rtl: boolean): Promise<void> {
    const element = await mount(rtl);
    await step.setup?.(element);
    const target = step.focus
      ? step.focus(element)
      : (element.shadowRoot?.querySelector<HTMLElement>('button, input, [tabindex]') ??
        element.querySelector<HTMLElement>('button, input, [tabindex]'));
    if (!target) throw new Error(`${tag}: the step has no element to focus`);
    target.focus();
    const keys = rtl && step.rtl?.keys ? step.rtl.keys : step.keys;
    await pressKeys(...keys);
    await nextFrame();
    const context = {element, rtl};
    await (rtl && step.rtl?.expect ? step.rtl.expect(context) : step.expect(context));
  }

  describe(`${tag}: keyboard table`, () => {
    for (const row of table) {
      const label = `${row.keys}: ${row.action}${row.when ? ` (${row.when})` : ''}`;
      const step = steps[row.action] ?? steps[row.keys];
      const waived = waive[row.action] ?? waive[row.keys];

      if (waived !== undefined) {
        it.skip(`${label} [waived: ${waived}]`, () => undefined);
        continue;
      }
      if (!step) {
        it(label, () => {
          expect.fail(
            `keyboard row "${row.keys}" / "${row.action}" has no step: add one to \`steps\` or waive it with a reason`,
          );
        });
        continue;
      }
      it(label, async () => {
        await run(step, false);
      });
      if (step.rtl) {
        it(`${label} [rtl]`, async () => {
          await run(step, true);
        });
      }
    }

    it('every step and waiver refers to a row of the table', () => {
      const known = new Set(table.flatMap((row) => [row.action, row.keys]));
      const unknown = [...Object.keys(steps), ...Object.keys(waive)].filter(
        (name) => !known.has(name),
      );
      expect(unknown, 'steps or waivers that match no row (stale after a table edit)').toEqual([]);
    });
  });
}
