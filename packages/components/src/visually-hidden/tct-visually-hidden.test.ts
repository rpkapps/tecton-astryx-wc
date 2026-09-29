/**
 * tct-visually-hidden: clip block, accessibility tree, live regions, non-overridable styling, RTL and
 * forced colours (ported from upstream VisuallyHidden.test.tsx).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import './define.js';
import type {TctVisuallyHidden} from './tct-visually-hidden.js';

const box = (element: TctVisuallyHidden): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;

async function make(
  content = 'Hidden text',
  attributes = '',
  options: {dir?: 'ltr' | 'rtl'; wrapperStyle?: string} = {},
): Promise<TctVisuallyHidden> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="position: relative; inline-size: 300px; block-size: 80px; ${options.wrapperStyle ?? ''}"><tct-visually-hidden ${attributes}>${content}</tct-visually-hidden></div>`,
    options.dir ? {dir: options.dir} : {},
  );
  const element = wrapper.querySelector<TctVisuallyHidden>('tct-visually-hidden')!;
  await element.updateComplete;
  return element;
}

runElementSuite({
  tag: 'tct-visually-hidden',
  render: () => html`<button>Save<tct-visually-hidden> draft</tct-visually-hidden></button>`,
});

describe('tct-visually-hidden: clip block (VisuallyHidden.test.tsx)', () => {
  it('renders its content in the light DOM through a slot', async () => {
    const element = await make('Screen reader text');
    expect(element.textContent).toBe('Screen reader text');
    expect(element.shadowRoot!.querySelector('slot')).not.toBeNull();
  });

  it('is clipped to one pixel and paints nothing', async () => {
    const element = await make();
    const style = getComputedStyle(box(element));
    expect(style.position).toBe('absolute');
    expect(style.overflow).toBe('hidden');
    expect(style.whiteSpace).toBe('nowrap');
    const rect = box(element).getBoundingClientRect();
    expect(rect.width).toBe(1);
    expect(rect.height).toBe(1);
    expect(style.clipPath).toContain('inset');
  });

  it('is pinned to the inline-start, block-start corner of the positioned ancestor', async () => {
    const element = await make();
    const parent = element.parentElement!.getBoundingClientRect();
    const rect = box(element).getBoundingClientRect();
    // The -1px margin centres the 1px box on the corner, so it starts one pixel outside it.
    expect(rect.left + 1).toBeCloseTo(parent.left, 0);
    expect(rect.top + 1).toBeCloseTo(parent.top, 0);
  });

  it('takes no room in the flow of the text around it', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><p id="plain" style="display: inline-block; margin: 0">ab</p><br /><p id="hidden" style="display: inline-block; margin: 0">a<tct-visually-hidden>long hidden words that would be wide</tct-visually-hidden>b</p></div>`,
    );
    const plain = wrapper.querySelector<HTMLElement>('#plain')!.getBoundingClientRect();
    const hidden = wrapper.querySelector<HTMLElement>('#hidden')!.getBoundingClientRect();
    expect(hidden.width).toBeCloseTo(plain.width, 0);
    expect(hidden.height).toBeCloseTo(plain.height, 0);
  });

  it('cannot be clicked or selected', async () => {
    const element = await make();
    const style = getComputedStyle(box(element));
    expect(style.pointerEvents).toBe('none');
    expect(style.userSelect).toBe('none');
    const rect = box(element).getBoundingClientRect();
    expect(document.elementFromPoint(rect.left + 0.5, rect.top + 0.5)).not.toBe(element);
  });

  it('cannot be un-hidden from the host or through ::part', async () => {
    const element = await make(
      'Hidden text',
      'style="position: static; width: 200px; overflow: visible"',
    );
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(
      'tct-visually-hidden::part(base) { position: static; width: 200px; overflow: visible; clip-path: none; }',
    );
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    try {
      const rect = box(element).getBoundingClientRect();
      expect(getComputedStyle(box(element)).position).toBe('absolute');
      expect(rect.width).toBe(1);
      expect(getComputedStyle(box(element)).overflow).toBe('hidden');
    } finally {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
    }
  });
});

describe('tct-visually-hidden: accessibility tree', () => {
  it.skipIf(!isChromium)('gives an icon-only control its accessible name', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><button type="button"><svg width="16" height="16" aria-hidden="true"><rect width="16" height="16"></rect></svg><tct-visually-hidden>Delete incident</tct-visually-hidden></button></div>`,
    );
    const button = wrapper.querySelector('button')!;
    expect(await axNode(button)).toMatchObject({role: 'button', name: 'Delete incident'});
  });

  it.skipIf(!isChromium)(
    'is a generic wrapper: the content stays in the tree, no role of its own',
    async () => {
      const element = await make('Order shipped');
      expect(element.hasAttribute('role')).toBe(false);
      const node = await axNode(element);
      expect(['generic', 'none', '', 'StaticText', 'text']).toContain(node.role);
      const wrapper = element.parentElement!;
      wrapper.setAttribute('role', 'group');
      wrapper.setAttribute('aria-label', 'Status');
      expect((await axNode(wrapper)).role).toBe('group');
    },
  );

  it('passes aria-live, role, id and data attributes through on the host', async () => {
    const element = await make(
      'Moved task to Done',
      'aria-live="polite" role="status" id="live" data-testid="announcer"',
    );
    expect(element.getAttribute('aria-live')).toBe('polite');
    expect(element.getAttribute('role')).toBe('status');
    expect(element.id).toBe('live');
    expect(element.dataset.testid).toBe('announcer');
    element.textContent = 'Moved task to Review';
    expect(element.textContent).toBe('Moved task to Review');
  });

  it.skipIf(!isChromium)('a live region is exposed as a status with its text', async () => {
    const element = await make('3 results', 'role="status"');
    expect(await axNode(element)).toMatchObject({role: 'status'});
  });

  it('passes axe next to a control it names', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><button type="button">Save<tct-visually-hidden> (draft)</tct-visually-hidden></button><tct-visually-hidden role="status" aria-live="polite">Saved</tct-visually-hidden></div>`,
    );
    await expectAccessible(wrapper);
  });
});

describe('tct-visually-hidden: RTL and forced colours', () => {
  it('pins to the inline-start corner in RTL (the right edge)', async () => {
    const element = await make('Hidden text', '', {dir: 'rtl'});
    const parent = element.parentElement!.getBoundingClientRect();
    const rect = box(element).getBoundingClientRect();
    expect(rect.right - 1).toBeCloseTo(parent.right, 0);
    expect(rect.width).toBe(1);
  });

  it.skipIf(!isChromium)('stays clipped in forced colours', async () => {
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const element = await make();
      const rect = box(element).getBoundingClientRect();
      expect(rect.width).toBe(1);
      expect(rect.height).toBe(1);
      expect(getComputedStyle(box(element)).overflow).toBe('hidden');
    } finally {
      await restore();
    }
  });
});
