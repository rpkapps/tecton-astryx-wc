/**
 * tct-scrollable-area: one native viewport with a real content box, keyboard access only while an axis
 * really scrolls (with scroll-keyboard delegation), logical axes through direction and writing mode,
 * overscroll chaining, sticky containment, sizing, content padding and bleed, scrollbar presentation
 * (ported from upstream ScrollableArea.test.tsx and useScrollableArea.test.tsx, in a real browser).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import '../card/define.js';
import './define.js';
import type {TctScrollableArea} from './tct-scrollable-area.js';

const viewportOf = (area: Element): HTMLElement =>
  area.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
const contentOf = (area: Element): HTMLElement =>
  area.shadowRoot!.querySelector<HTMLElement>('.content')!;

/** An area of a fixed size around content of a given size. */
async function area(attributes = '', content = 200, wrapper = '') {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: 300px; ${wrapper}"><tct-scrollable-area label="Activity" height="100" ${attributes}><div id="c" style="block-size: ${content}px; inline-size: 100px">content</div></tct-scrollable-area></div>`,
  );
  const element = root.querySelector<TctScrollableArea>('tct-scrollable-area')!;
  await settled(element);
  return {root, element};
}

/** Waits a frame or two: the controller coalesces observer signals into one measurement per frame. */
async function settled(element: TctScrollableArea): Promise<void> {
  await element.updateComplete;
  await nextFrame();
  await nextFrame();
}

runElementSuite({
  tag: 'tct-scrollable-area',
  render: () =>
    html`<tct-scrollable-area label="Items" height="80"><p>content</p></tct-scrollable-area>`,
  properties: {axis: 'both', label: 'Items', overscroll: 'contain', fullBleed: true, padding: 2},
  attributes: {axis: 'axis', overscroll: 'overscroll'},
});

describe('tct-scrollable-area: structure', () => {
  it('renders one native viewport and one real content box', async () => {
    const {element} = await area();
    const viewport = viewportOf(element);
    expect(element.shadowRoot!.querySelectorAll('[part="viewport"]')).toHaveLength(1);
    expect(viewport.children).toHaveLength(1);
    expect(contentOf(element).parentElement).toBe(viewport);
    expect(contentOf(element).querySelector('slot')).not.toBeNull();
    expect(element.viewport).toBe(viewport);
  });

  it('defaults to the block axis, allow overscroll and a group role', async () => {
    const {element} = await area();
    expect(element.axis).toBe('block');
    expect(element.overscroll).toBe('allow');
    expect(element.viewportRole).toBe('group');
    expect(viewportOf(element).getAttribute('role')).toBe('group');
    expect(viewportOf(element).getAttribute('aria-label')).toBe('Activity');
  });

  it('uses the region role when asked', async () => {
    const {element} = await area('viewport-role="region"');
    expect(viewportOf(element).getAttribute('role')).toBe('region');
  });
});

describe('tct-scrollable-area: keyboard reachable only while it scrolls', () => {
  it('has no tab stop while the content fits', async () => {
    const {element} = await area('', 40);
    expect(viewportOf(element).hasAttribute('tabindex')).toBe(false);
    expect(element.scrollState.block.isScrollable).toBe(false);
    expect(element.matches(':state(scrollable)')).toBe(false);
  });

  it('becomes a tab stop while the requested axis overflows, and gives it back when it fits', async () => {
    const {element, root} = await area('', 300);
    const viewport = viewportOf(element);
    expect(viewport.getAttribute('tabindex')).toBe('0');
    expect(element.scrollState.block.isScrollable).toBe(true);
    expect(element.matches(':state(scrollable)')).toBe(true);

    root.querySelector<HTMLElement>('#c')!.style.blockSize = '40px';
    await waitUntil(() => !viewport.hasAttribute('tabindex'));
    expect(element.scrollState.block.isScrollable).toBe(false);
  });

  it('a requested axis that does not overflow gives no tab stop even if the other one does', async () => {
    const {element} = await area('axis="inline"', 300);
    expect(viewportOf(element).hasAttribute('tabindex')).toBe(false);
  });

  it('reaches the viewport with Tab, and the arrow keys scroll it natively', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 300px"><button id="before">before</button><tct-scrollable-area label="Log" height="80"><div style="block-size: 600px">content</div></tct-scrollable-area><button id="after">after</button></div>`,
    );
    const element = root.querySelector<TctScrollableArea>('tct-scrollable-area')!;
    await settled(element);
    root.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(viewportOf(element));
    await pressKeys('ArrowDown', 'ArrowDown', 'ArrowDown');
    await waitUntil(() => viewportOf(element).scrollTop > 0);
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(root.querySelector('#after'));
  });

  it('losing overflow while focused never moves or blurs focus (it stays focusable by script)', async () => {
    const {element, root} = await area('', 300);
    const viewport = viewportOf(element);
    viewport.focus();
    expect(element.shadowRoot!.activeElement).toBe(viewport);
    root.querySelector<HTMLElement>('#c')!.style.blockSize = '40px';
    await waitUntil(() => !element.scrollState.block.isScrollable);
    expect(element.shadowRoot!.activeElement).toBe(viewport);
    expect(viewport.getAttribute('tabindex')).toBe('-1');
    viewport.blur();
    await settled(element);
    // Once focus has left, the tab stop it lent is gone.
    root.querySelector<HTMLElement>('#c')!.style.blockSize = '41px';
    await waitUntil(() => !viewport.hasAttribute('tabindex'));
  });

  it('keyboard-owner "content" leaves semantics and tab stops to the content', async () => {
    const {element} = await area('keyboard-owner="content"', 300);
    const viewport = viewportOf(element);
    expect(viewport.hasAttribute('tabindex')).toBe(false);
    expect(viewport.hasAttribute('role')).toBe(false);
    expect(viewport.hasAttribute('aria-label')).toBe(false);
    // It still measures and owns the overflow presentation.
    expect(element.scrollState.block.isScrollable).toBe(true);
    expect(getComputedStyle(viewport).overflowY).toBe('auto');
  });

  it('is accessible fitting and overflowing', async () => {
    const fits = await area('', 40);
    await expectAccessible(fits.root);
    const overflows = await area('', 400);
    await expectAccessible(overflows.root);
  });
});

describe('tct-scrollable-area: scroll-keyboard delegation (keyboard-owner content-or-viewport)', () => {
  async function delegating(content: string) {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 300px"><button id="before">before</button>
        <tct-scrollable-area label="Docs" height="80" keyboard-owner="content-or-viewport">${content}<div style="block-size: 500px">tall</div></tct-scrollable-area>
        <button id="after">after</button></div>`,
    );
    const element = root.querySelector<TctScrollableArea>('tct-scrollable-area')!;
    await settled(element);
    return {root, element};
  }

  it('a forward Tab into the overflowing viewport lands on the first link', async () => {
    const {root} = await delegating('<a id="link" href="#x">docs</a>');
    root.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(root.querySelector('#link'));
  });

  it('a reverse Tab from the delegated link skips the viewport', async () => {
    const {root} = await delegating('<a id="link" href="#x">docs</a>');
    root.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(root.querySelector('#link'));
    await pressKeys('Shift+Tab');
    expect(deepActiveElement()).toBe(root.querySelector('#before'));
  });

  it('pointer and programmatic focus never delegate', async () => {
    const {element} = await delegating('<a id="link" href="#x">docs</a>');
    viewportOf(element).focus();
    expect(element.shadowRoot!.activeElement).toBe(viewportOf(element));
  });

  it('keeps the viewport when the first target is not a native link or button', async () => {
    const {root, element} = await delegating('<input id="field" aria-label="f" />');
    root.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(element.shadowRoot!.activeElement).toBe(viewportOf(element));
  });

  it('keeps the viewport when the link sits inside a composite widget', async () => {
    const {root, element} = await delegating(
      '<div role="listbox"><a id="link" href="#x">docs</a></div>',
    );
    root.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(element.shadowRoot!.activeElement).toBe(viewportOf(element));
  });

  it('keeps the viewport when a positive tabindex orders before it', async () => {
    const {root, element} = await delegating('<a id="link" href="#x" tabindex="3">docs</a>');
    root.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    // The positive tabindex orders before the zero-index viewport, so it is not skipped over: the
    // viewport keeps the stop instead of handing focus to a later zero-index child.
    expect(element.shadowRoot!.activeElement).toBe(viewportOf(element));
    expect(deepActiveElement()).not.toBe(root.querySelector('#link'));
  });

  it('does not delegate when the content fits (there is no viewport stop to hand over)', async () => {
    const root = await fixture<HTMLElement>(
      `<div><button id="before">b</button><tct-scrollable-area label="Docs" height="200" keyboard-owner="content-or-viewport"><a id="link" href="#x">docs</a></tct-scrollable-area></div>`,
    );
    const element = root.querySelector<TctScrollableArea>('tct-scrollable-area')!;
    await settled(element);
    root.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(root.querySelector('#link'));
    expect(userEvent).toBeDefined();
  });
});

describe('tct-scrollable-area: logical axes, edge state and chaining', () => {
  it('reflects logical axis and applies chaining only to effective axes', async () => {
    const {element} = await area('overscroll="contain"', 300);
    const viewport = viewportOf(element);
    expect(viewport.dataset.scrollAxis).toBe('block');
    expect(viewport.dataset.scrollableBlock).toBe('true');
    expect(getComputedStyle(viewport).overscrollBehaviorY).toBe('contain');
    const fitting = await area('overscroll="contain"', 40);
    // A fitting axis never contains: no dead scroll zone.
    expect(getComputedStyle(viewportOf(fitting.element)).overscrollBehaviorY).toBe('auto');
  });

  it('publishes stable edge state that follows scrolling', async () => {
    const {element} = await area('', 400);
    const viewport = viewportOf(element);
    expect(element.scrollState.block).toEqual({isScrollable: true, atStart: true, atEnd: false});
    const first = element.scrollState;
    viewport.scrollTop = viewport.scrollHeight;
    await waitUntil(() => element.scrollState.block.atEnd);
    expect(element.scrollState.block).toEqual({isScrollable: true, atStart: false, atEnd: true});
    expect(viewport.dataset.scrollBlockEnd).toBe('true');
    expect(viewport.hasAttribute('data-scroll-block-start')).toBe(false);
    // The same object while nothing changed.
    expect(element.scrollState).toBe(element.scrollState);
    expect(first).not.toBe(element.scrollState);
  });

  it('maps the inline axis through the text direction (RTL edges)', async () => {
    const root = await fixture<HTMLElement>(
      `<div dir="rtl" style="inline-size: 200px"><tct-scrollable-area label="Row" axis="inline"><div style="inline-size: 600px; block-size: 20px">wide</div></tct-scrollable-area></div>`,
    );
    const element = root.querySelector<TctScrollableArea>('tct-scrollable-area')!;
    await settled(element);
    const viewport = viewportOf(element);
    expect(element.scrollState.inline.isScrollable).toBe(true);
    // RTL starts at the right edge: that is the logical start.
    expect(element.scrollState.inline.atStart).toBe(true);
    viewport.scrollLeft = -(viewport.scrollWidth - viewport.clientWidth);
    await waitUntil(() => element.scrollState.inline.atEnd);
    expect(element.scrollState.inline.atStart).toBe(false);
    expect(getComputedStyle(viewport).overflowX).toBe('auto');
    // The other physical axis is contained (hidden) once the box is a scroll container.
    expect(getComputedStyle(viewport).overflowY).toBe('hidden');
  });

  it('maps the inline axis onto the vertical one in a vertical writing mode', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="writing-mode: vertical-rl; block-size: 300px; inline-size: 200px"><tct-scrollable-area label="Column" axis="inline" style="inline-size: 150px"><div style="inline-size: 600px; block-size: 20px">tall</div></tct-scrollable-area></div>`,
    );
    const element = root.querySelector<TctScrollableArea>('tct-scrollable-area')!;
    await settled(element);
    const viewport = viewportOf(element);
    expect(element.scrollState.inline.isScrollable).toBe(true);
    expect(getComputedStyle(viewport).overflowY).toBe('auto');
    expect(getComputedStyle(viewport).overflowX).toBe('hidden');
  });

  it('gives the content box max-content inline size when inline scrolling is requested', async () => {
    const wide = (axis: string) =>
      fixture<HTMLElement>(
        `<div style="inline-size: 300px"><tct-scrollable-area label="Wide" axis="${axis}" height="60"><div style="inline-size: 800px; block-size: 20px">wide</div></tct-scrollable-area></div>`,
      );
    const inline = (await wide('inline')).querySelector<TctScrollableArea>('tct-scrollable-area')!;
    await settled(inline);
    expect(contentOf(inline).getBoundingClientRect().width).toBe(800);
    const block = (await wide('block')).querySelector<TctScrollableArea>('tct-scrollable-area')!;
    await settled(block);
    expect(contentOf(block).getBoundingClientRect().width).toBe(viewportOf(block).clientWidth);
  });
});

describe('tct-scrollable-area: overflow and sticky containment', () => {
  it('clips while fitting so sticky passes outward, and scrolls once it overflows', async () => {
    const fits = await area('', 40);
    const style = getComputedStyle(viewportOf(fits.element));
    expect([style.overflowX, style.overflowY]).toEqual(['clip', 'clip']);
    const overflows = await area('', 400);
    const active = getComputedStyle(viewportOf(overflows.element));
    expect([active.overflowX, active.overflowY]).toEqual(['hidden', 'auto']);
  });

  it('sticky-containment="always" keeps the scroll pair while fitting', async () => {
    const {element} = await area('sticky-containment="always"', 40);
    const style = getComputedStyle(viewportOf(element));
    expect([style.overflowX, style.overflowY]).toEqual(['hidden', 'auto']);
  });
});

describe('tct-scrollable-area: sizing, padding and bleed', () => {
  it('accepts the standard container sizes', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 500px"><tct-scrollable-area label="Sized" width="200" height="120" max-width="150" min-height="60"><p>x</p></tct-scrollable-area></div>`,
    );
    const element = root.querySelector<TctScrollableArea>('tct-scrollable-area')!;
    await settled(element);
    const box = element.getBoundingClientRect();
    expect(box.width).toBe(150);
    expect(box.height).toBe(120);
  });

  it('a parent that bounds the height makes the viewport the thing that scrolls', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="block-size: 100px; inline-size: 300px"><tct-scrollable-area label="Fill"><div style="block-size: 500px">x</div></tct-scrollable-area></div>`,
    );
    const element = root.querySelector<TctScrollableArea>('tct-scrollable-area')!;
    await settled(element);
    expect(element.getBoundingClientRect().height).toBe(100);
    expect(element.scrollState.block.isScrollable).toBe(true);
  });

  it('publishes content padding, zero by default', async () => {
    const plain = await area('', 40);
    expect(
      getComputedStyle(contentOf(plain.element))
        .getPropertyValue('--container-padding-inline-start')
        .trim(),
    ).toBe('0px');
    const padded = await area('padding="2" padding-inline="4"', 40);
    const style = getComputedStyle(contentOf(padded.element));
    expect([style.paddingLeft, style.paddingTop]).toEqual(['16px', '8px']);
    expect(style.getPropertyValue('--container-padding-inline-start').trim()).toBe('16px');
    expect(style.getPropertyValue('--container-padding-block-end').trim()).toBe('8px');
  });

  it('keeps inherited container bleed opt-in on the viewport', async () => {
    const root = await fixture<HTMLElement>(
      `<tct-card padding="4" width="400"><tct-scrollable-area id="a" label="A" height="60"><p>x</p></tct-scrollable-area><tct-scrollable-area id="b" label="B" height="60" full-bleed><p>x</p></tct-scrollable-area></tct-card>`,
    );
    const a = root.querySelector<TctScrollableArea>('#a')!;
    const b = root.querySelector<TctScrollableArea>('#b')!;
    await settled(a);
    const card = root
      .shadowRoot!.querySelector<HTMLElement>('[part="base"]')!
      .getBoundingClientRect();
    expect(viewportOf(a).getBoundingClientRect().width).toBeLessThan(card.width - 20);
    expect(Math.round(viewportOf(b).getBoundingClientRect().width)).toBeGreaterThanOrEqual(
      Math.round(card.width) - 2,
    );
  });
});

describe('tct-scrollable-area: native scrollbar', () => {
  it('sets a scrollbar colour from the tokens (the platform one in forced colours)', async () => {
    const {element} = await area('', 300);
    expect(getComputedStyle(viewportOf(element)).scrollbarColor).not.toBe('auto');
  });

  it('guards scroll-state query containment as a progressive enhancement', async () => {
    const {element} = await area('', 300);
    const style = getComputedStyle(viewportOf(element));
    if (CSS.supports('container-type: scroll-state')) {
      expect(style.containerType).toBe('scroll-state');
    } else {
      expect(style.containerType).toBe('normal');
    }
  });
});
