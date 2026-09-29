/**
 * `runElementSuite` (A§15.3): the lifecycle contract every `tct-*` element inherits from
 * `TctElement` (A§7, A§9.1). Call it first from a component's test file.
 *
 * ```ts
 * runElementSuite({tag: 'tct-badge', properties: {variant: 'primary'}, events: ['tct-open-change']});
 * ```
 *
 * Checks: registration idempotence, properties set before the element upgraded, reconnecting and
 * `moveBefore()` keep state, no events on property or attribute writes, `[hidden]` works under the
 * preflight, the host carries no box styles, and the default render passes axe.
 */
import type {TemplateResult} from 'lit';
import type {RunOptions} from 'axe-core';
import {describe, expect, it, vi} from 'vitest';
import {features} from '@tecton-astryx/core/features.js';
import {deepActiveElement, getTabbables} from '@tecton-astryx/core/utils/focus.js';
import {expectAccessible} from '../a11y.js';
import {fixture} from '../fixture.js';

export interface ElementSuiteOptions {
  /** The registered tag name. */
  tag: string;
  /** Markup of the element under test (default: `<tag></tag>`). */
  render?: () => TemplateResult | string;
  /**
   * Public properties with a valid, non-default value each. They are set before upgrade, after
   * upgrade, and as attributes where `attributes` maps them, and must all survive reconnect/move.
   */
  properties?: Record<string, unknown>;
  /** Attribute spelling of properties that have one (`{variant: 'variant'}`), written as strings. */
  attributes?: Record<string, string>;
  /** Intent events that must not fire on writes (`input` and `change` are always checked). */
  events?: readonly string[];
  /** Axe options, or `false` to skip (the element has no accessible name without author input). */
  a11y?: boolean | RunOptions;
  /** Set to `false` for elements that legitimately draw a box on the host (rare; document why). */
  hostBox?: boolean;
  /**
   * Set to `false` for light-DOM providers (`tct-theme`, `tct-size-provider`, ...): the element has no
   * shadow root, and the suite asserts that instead of asserting one exists. Default `true`.
   */
  shadow?: boolean;
  /** Checks to skip; state the reason at the call site. */
  skip?: readonly ('upgrade' | 'moveBefore' | 'hidden' | 'hostBox' | 'a11y')[];
}

const markup = (options: ElementSuiteOptions): TemplateResult | string =>
  options.render ? options.render() : `<${options.tag}></${options.tag}>`;

/** Finds the element under test in a fixture (the fixture root may be a wrapper). */
async function mount<T extends HTMLElement>(options: ElementSuiteOptions): Promise<T> {
  const root = await fixture<HTMLElement>(markup(options));
  return (root.localName === options.tag ? root : root.querySelector(options.tag)) as T;
}

/** Collects errors thrown on the page while `run` executes. */
async function captureErrors(run: () => Promise<void>): Promise<string[]> {
  const errors: string[] = [];
  const onError = (event: ErrorEvent): void => {
    errors.push(event.message);
  };
  window.addEventListener('error', onError);
  try {
    await run();
  } finally {
    window.removeEventListener('error', onError);
  }
  return errors;
}

export function runElementSuite(options: ElementSuiteOptions): void {
  const {tag, properties = {}, attributes = {}, events = [], skip = []} = options;
  const watched = ['input', 'change', ...events];

  describe(`${tag}: element lifecycle`, () => {
    it('is registered under its tag, and registering again is a no-op without warnings', async () => {
      const ctor = customElements.get(tag);
      expect(ctor, `<${tag}> is not defined; call defineElement() in the test file`).toBeDefined();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        const {defineElement} = await import('@tecton-astryx/core/define.js');
        defineElement(ctor as Parameters<typeof defineElement>[0]);
        expect(warn).not.toHaveBeenCalled();
        expect(customElements.get(tag)).toBe(ctor);
      } finally {
        warn.mockRestore();
      }
    });

    it.skipIf(skip.includes('upgrade') || Object.keys(properties).length === 0)(
      'applies properties that were set before the element upgraded',
      async () => {
        // An element created in an inert document is not upgraded; adopting and connecting it is.
        const inert = document.implementation.createHTMLDocument('');
        const early = inert.createElement(tag);
        Object.assign(early, properties);
        const container = await fixture<HTMLElement>('<div></div>');
        const adopted = document.adoptNode(early);
        container.append(adopted);
        await (adopted as unknown as {updateComplete: Promise<unknown>}).updateComplete;
        for (const [name, value] of Object.entries(properties)) {
          expect((adopted as unknown as Record<string, unknown>)[name], name).toEqual(value);
        }
      },
    );

    it('keeps its state across disconnect and reconnect, without errors', async () => {
      const element = await mount(options);
      Object.assign(element, properties);
      await (element as unknown as {updateComplete: Promise<unknown>}).updateComplete;
      const parent = element.parentElement!;
      const errors = await captureErrors(async () => {
        element.remove();
        parent.append(element);
        element.remove();
        parent.append(element);
        await (element as unknown as {updateComplete: Promise<unknown>}).updateComplete;
      });
      expect(errors).toEqual([]);
      expect(element.isConnected).toBe(true);
      if (options.shadow === false) expect(element.shadowRoot).toBeNull();
      else expect(element.shadowRoot).not.toBeNull();
      for (const [name, value] of Object.entries(properties)) {
        expect((element as unknown as Record<string, unknown>)[name], name).toEqual(value);
      }
    });

    it.skipIf(skip.includes('moveBefore') || !features.moveBefore)(
      'moveBefore() keeps state and focus and does not disconnect the element',
      async () => {
        const element = await mount(options);
        Object.assign(element, properties);
        await (element as unknown as {updateComplete: Promise<unknown>}).updateComplete;
        const target = document.createElement('div');
        // Inside the fixture container, so cleanup removes the target (and the element moved into it).
        element.parentElement!.append(target);
        const focusable = getTabbables(element)[0];
        focusable?.focus();
        const focused = deepActiveElement();
        let disconnected = 0;
        const original = (element as unknown as {disconnectedCallback: () => void})
          .disconnectedCallback;
        (element as unknown as {disconnectedCallback: () => void}).disconnectedCallback = function (
          this: HTMLElement,
        ) {
          disconnected++;
          original.call(this);
        };
        (target as unknown as {moveBefore(node: Node, ref: Node | null): void}).moveBefore(
          element,
          null,
        );
        expect(element.parentElement).toBe(target);
        expect(disconnected, 'a move must not disconnect').toBe(0);
        if (focused) expect(deepActiveElement()).toBe(focused);
        for (const [name, value] of Object.entries(properties)) {
          expect((element as unknown as Record<string, unknown>)[name], name).toEqual(value);
        }
      },
    );

    it('emits no events when properties or attributes are written', async () => {
      const element = await mount(options);
      const seen: string[] = [];
      for (const name of watched) {
        const listener = (event: Event): void => {
          seen.push(event.type);
        };
        document.addEventListener(name, listener, true);
        element.addEventListener(name, listener);
      }
      Object.assign(element, properties);
      for (const [property, attribute] of Object.entries(attributes)) {
        const value = properties[property];
        element.setAttribute(
          attribute,
          typeof value === 'string' || typeof value === 'number' ? String(value) : '',
        );
      }
      await (element as unknown as {updateComplete: Promise<unknown>}).updateComplete;
      expect(seen).toEqual([]);
    });

    it.skipIf(skip.includes('hidden'))(
      '[hidden] hides the host (also under the preflight)',
      async () => {
        const element = await mount(options);
        element.hidden = true;
        expect(getComputedStyle(element).display).toBe('none');
        element.hidden = false;
        expect(getComputedStyle(element).display).not.toBe('none');
      },
    );

    it.skipIf(skip.includes('hostBox') || options.hostBox === false)(
      'the host draws no box: padding, border and background are initial',
      async () => {
        const element = await mount(options);
        const style = getComputedStyle(element);
        for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
          expect(style[`padding${side}`], `padding-${side.toLowerCase()}`).toBe('0px');
          expect(style[`border${side}Width`], `border-${side.toLowerCase()}-width`).toBe('0px');
        }
        expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
        expect(style.backgroundImage).toBe('none');
      },
    );

    it.skipIf(skip.includes('a11y') || options.a11y === false)(
      'the default render passes axe',
      async () => {
        const element = await mount(options);
        await expectAccessible(
          element,
          typeof options.a11y === 'object' ? options.a11y : undefined,
        );
      },
    );
  });
}
