/**
 * The controllers and utilities catalog of the agent registry: derived from the generated core barrel and the
 * JSDoc of each module, so it cannot drift from what `@tecton-wc/core` exports.
 */
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {
  cleanProse,
  extractControllers,
  firstSentence,
  parseBarrel,
  parseDoc,
} from './controllers.ts';

let root: string;

const write = (path: string, content: string) => {
  const file = join(root, path);
  mkdirSync(join(file, '..'), {recursive: true});
  writeFileSync(file, content);
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'tct-controllers-'));
  write(
    'core/src/generated/index.ts',
    [
      "export {RovingController, helper, secret} from '../controllers/roving.js';",
      "export type {RovingOptions} from '../controllers/roving.js';",
      "export {WidgetMixin} from '../mixins/widget.js';",
      "export {widgetContext} from '../context/keys.js';",
      "export {TctThing} from '../events/tct-thing.js';",
      "export {BaseThing} from '../tct-element.js';",
    ].join('\n'),
  );
  write(
    'core/src/controllers/roving.ts',
    `/**
 * Module comment: not used when the class has its own JSDoc.
 */
import type {ReactiveController} from 'lit';

/**
 * Roving focus (A§9.11, upstream \`useListFocus\`): one tab stop for a composite [mwg:roving-focus].
 * Arrow keys move focus.
 *
 * \`\`\`ts
 * #roving = new RovingController(this, {items: () => []});
 * \`\`\`
 *
 * @internal-note ignored
 */
export class RovingController implements ReactiveController {
  readonly #host: object;
  constructor(host: object, options: {items: () => unknown[]; wrap?: boolean}) {
    this.#host = host;
  }

  /** The item that carries \`tabindex="0"\`. */
  get active(): number {
    return 0;
  }

  /** Makes \`item\` the tab stop. */
  setActive(item: number, options: {focus?: boolean} = {}): void {}

  hostConnected(): void {}

  /** @internal */
  syncNow(): void {}

  private hidden(): void {}
}

/** Adds two numbers. */
export function helper(a: number, b: number): number {
  return a + b;
}

export function secret(): void {}
`,
  );
  write(
    'core/src/mixins/widget.ts',
    `/** Module doc for the widget mixin. */
export function WidgetMixin<T>(Base: T): T {
  return Base;
}
`,
  );
  write(
    'core/src/context/keys.ts',
    `/**
 * Context keys defined by the foundation (A§9.4). Every key is a \`Symbol.for(...)\`.
 */
export const widgetContext = Symbol.for('tct.widget');
`,
  );
  write('core/src/events/tct-thing.ts', '/** An event. */\nexport class TctThing {}\n');
  write('core/src/tct-element.ts', '/** The base. */\nexport class BaseThing {}\n');
  write(
    'components/src/button/tct-button.ts',
    "import {helper, RovingController} from '@tecton-wc/core';\n",
  );
  write('components/src/dialog/tct-dialog.ts', "import {helper} from '@tecton-wc/core';\n");
  write('components/src/dialog/tct-dialog.test.ts', 'RovingController in a test only\n');
});

afterAll(() => {
  rmSync(root, {recursive: true, force: true});
});

const extract = () =>
  extractControllers({
    coreSrc: join(root, 'core/src'),
    componentsSrc: join(root, 'components/src'),
    folders: ['button', 'dialog'],
  });

describe('parseBarrel', () => {
  it('reads value exports with their module and skips type exports', () => {
    const exports = parseBarrel(
      "export {a, b as c} from '../x/y.js';\nexport type {T} from '../x/y.js';\n",
    );
    expect(exports).toEqual([
      {name: 'a', module: 'x/y'},
      {name: 'c', module: 'x/y'},
    ]);
  });
});

describe('parseDoc', () => {
  it('keeps prose, drops tags, returns the first code fence, and unwraps paragraphs', () => {
    const doc = parseDoc(
      '/**\n * First line\n * wraps.\n *\n * Second paragraph.\n * - item one\n * - item two\n *\n * ```ts\n * code();\n * ```\n * @internal\n */',
    );
    expect(doc.prose).toBe('First line wraps.\n\nSecond paragraph.\n\n- item one\n- item two');
    expect(doc.example).toBe('code();');
  });

  it('firstSentence stops at the first full stop followed by a space', () => {
    expect(firstSentence('One thing. Another thing.')).toBe('One thing.');
    expect(firstSentence('No stop')).toBe('No stop');
  });
});

describe('cleanProse', () => {
  it('drops architecture sections, review ids, guide ids and upstream hook names', () => {
    expect(
      cleanProse(
        'Roving focus (A§9.11, upstream `useListFocus`): one stop [mwg:roving] (review H6) done, upstream `x`.',
      ),
    ).toBe('Roving focus: one stop done.');
    expect(cleanProse('APG tree: port of upstream `useTreeFocus` (MIT, Meta Platforms).')).toBe(
      'APG tree.',
    );
  });
});

describe('extractControllers', () => {
  it('lists documented exports with kind, area, import and cleaned prose', () => {
    const catalog = extract();
    const roving = catalog.find((entry) => entry.name === 'RovingController')!;
    expect(roving).toMatchObject({
      kind: 'controller',
      area: 'controllers',
      import: '@tecton-wc/core/controllers/roving.js',
      summary: 'Roving focus: one tab stop for a composite.',
    });
    expect(roving.example).toBe('#roving = new RovingController(this, {items: () => []});');
    expect(roving.signature).toBe(
      'new RovingController(host: object, options: {items: () => unknown[]; wrap?: boolean})',
    );
    expect(JSON.stringify(catalog)).not.toMatch(/A§|mwg:|upstream/);
  });

  it('classifies functions, mixins and context keys', () => {
    const byName = Object.fromEntries(extract().map((entry) => [entry.name, entry]));
    expect(byName.helper).toMatchObject({
      kind: 'function',
      signature: 'function helper(a: number, b: number): number',
    });
    expect(byName.WidgetMixin?.kind).toBe('mixin');
    expect(byName.widgetContext?.kind).toBe('context');
    expect(byName.widgetContext?.summary).toBe('Context keys defined by the foundation.');
  });

  it('lists public members only, without lifecycle hooks, internals or private ones', () => {
    const roving = extract().find((entry) => entry.name === 'RovingController')!;
    expect(roving.members.map((member) => member.name)).toEqual(['active', 'setActive']);
    expect(roving.members[1]).toMatchObject({
      signature: 'setActive(item: number, options: {focus?: boolean} = {})',
      summary: 'Makes `item` the tab stop.',
    });
  });

  it('skips undocumented exports, events and the base class', () => {
    const names = extract().map((entry) => entry.name);
    expect(names).not.toContain('secret');
    expect(names).not.toContain('TctThing');
    expect(names).not.toContain('BaseThing');
  });

  it('records the component folders that use each export (not tests)', () => {
    const byName = Object.fromEntries(extract().map((entry) => [entry.name, entry]));
    expect(byName.RovingController?.usedBy).toEqual(['button']);
    expect(byName.helper?.usedBy).toEqual(['button', 'dialog']);
  });

  it('is sorted by name and empty without a barrel', () => {
    const names = extract().map((entry) => entry.name);
    expect(names).toEqual([...names].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1)));
    expect(
      extractControllers({coreSrc: join(root, 'nowhere'), componentsSrc: root, folders: []}),
    ).toEqual([]);
  });
});
