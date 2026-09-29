/**
 * `BoxPropsMixin` (A§9.18): padding steps and sizes become private custom properties on the
 * `part="base"` element, most specific wins per edge, nothing is reflected.
 */
import {css, html} from 'lit';
import {beforeAll, describe, expect, it, vi} from 'vitest';
import {defineElement} from '@tecton-wc/core/define.js';
import {BOX_PROPERTIES, BoxPropsMixin, SPACING_STEPS} from '@tecton-wc/core/mixins/box-props.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {fixture} from '../fixture.js';

class TctTestBox extends BoxPropsMixin(TctElement) {
  static override readonly tagName = 'tct-test-box';
  static override styles = css`
    :host {
      display: block;
    }
    .base {
      padding-inline-start: var(--_box-padding-inline-start, 0);
      padding-inline-end: var(--_box-padding-inline-end, 0);
      padding-block-start: var(--_box-padding-block-start, 0);
      padding-block-end: var(--_box-padding-block-end, 0);
      inline-size: var(--_box-width, auto);
      block-size: var(--_box-height, auto);
      max-inline-size: var(--_box-max-width, none);
      min-block-size: var(--_box-min-height, 0);
      box-sizing: border-box;
    }
  `;
  override render() {
    return html`<div part="base" class="base"><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-test-box': TctTestBox;
  }
}

beforeAll(() => {
  defineElement(TctTestBox);
});

async function box(attributes = ''): Promise<TctTestBox> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div style="--spacing-0:0px;--spacing-0-5:2px;--spacing-1:4px;--spacing-2:8px;--spacing-4:16px;--spacing-8:32px;width:600px"><tct-test-box ${attributes}>x</tct-test-box></div>`,
  );
  const host = wrapper.querySelector('tct-test-box')!;
  await host.updateComplete;
  return host;
}

const base = (host: TctTestBox): HTMLElement =>
  host.renderRoot.querySelector<HTMLElement>('.base')!;
const prop = (host: TctTestBox, name: string): string => base(host).style.getPropertyValue(name);
const padding = (host: TctTestBox): number[] => {
  const style = getComputedStyle(base(host));
  return [
    style.paddingInlineStart,
    style.paddingInlineEnd,
    style.paddingBlockStart,
    style.paddingBlockEnd,
  ].map(parseFloat);
};

describe('padding', () => {
  it('maps spacing steps to custom properties, and dots to dashes', async () => {
    const host = await box('padding="0.5"');
    expect(prop(host, BOX_PROPERTIES.paddingInlineStart)).toBe('var(--spacing-0-5)');
    expect(padding(host)).toEqual([2, 2, 2, 2]);
  });

  it('the most specific attribute wins per edge: edge, then axis, then padding', async () => {
    const host = await box(
      'padding="1" padding-inline="2" padding-block-start="8" padding-inline-end="4"',
    );
    expect(padding(host)).toEqual([8, 16, 32, 8].map((_, i) => [8, 16, 32, 4][i]!));
    // [inline-start, inline-end, block-start, block-end] = [axis 2 -> 8, edge 4 -> 16, edge 8 -> 32, padding 1 -> 4]
    expect(padding(host)).toEqual([8, 16, 32, 4]);
  });

  it('removes a property when its attribute goes away', async () => {
    const host = await box('padding="4"');
    expect(prop(host, BOX_PROPERTIES.paddingBlockEnd)).not.toBe('');
    host.removeAttribute('padding');
    await host.updateComplete;
    expect(prop(host, BOX_PROPERTIES.paddingBlockEnd)).toBe('');
    expect(padding(host)).toEqual([0, 0, 0, 0]);
  });

  it('warns once for a value off the scale and ignores it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.tctDevMode = true;
    try {
      const host = await box('padding="7"');
      expect(prop(host, BOX_PROPERTIES.paddingInlineStart)).toBe('');
      expect(warn).toHaveBeenCalledTimes(1);
      host.requestUpdate();
      await host.updateComplete;
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.tctDevMode = undefined;
      warn.mockRestore();
    }
  });

  it('exposes the documented scale', () => {
    expect([...SPACING_STEPS]).toEqual([0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10]);
  });
});

describe('sizes', () => {
  it('numbers and numeric strings are pixels; any other value is a CSS length as written', async () => {
    const host = await box('width="300" height="120px" max-width="50%" min-height="5rem"');
    expect(prop(host, BOX_PROPERTIES.width)).toBe('300px');
    expect(prop(host, BOX_PROPERTIES.height)).toBe('120px');
    expect(prop(host, BOX_PROPERTIES.maxWidth)).toBe('50%');
    expect(prop(host, BOX_PROPERTIES.minHeight)).toBe('5rem');
    expect(base(host).getBoundingClientRect().width).toBe(300);
    expect(base(host).getBoundingClientRect().height).toBe(120);
  });

  it('accepts property writes (numbers) and follows them', async () => {
    const host = await box();
    host.width = 250;
    host.maxWidth = '40%';
    await host.updateComplete;
    expect(prop(host, BOX_PROPERTIES.width)).toBe('250px');
    expect(prop(host, BOX_PROPERTIES.maxWidth)).toBe('40%');
    host.width = undefined;
    await host.updateComplete;
    expect(prop(host, BOX_PROPERTIES.width)).toBe('');
  });

  it('nothing is reflected to attributes', async () => {
    const host = await box();
    host.padding = 4;
    host.width = 100;
    await host.updateComplete;
    expect(host.hasAttribute('padding')).toBe(false);
    expect(host.hasAttribute('width')).toBe(false);
  });
});
