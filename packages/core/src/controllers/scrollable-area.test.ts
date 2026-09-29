/**
 * ScrollableAreaController (upstream useScrollableArea): logical axis mapping, effective state and
 * edges, the owner registry, the `implicit` tab-stop rule (the generalisation of the stack and card
 * scroll-focus), release on disconnect, and scroll-keyboard delegation on a bare viewport.
 */
import {css, html, LitElement} from 'lit';
import {describe, expect, it} from 'vitest';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import {deepActiveElement} from '../utils/focus.js';
import {
  attachScrollKeyboardDelegation,
  findNearestScrollOwner,
  getLogicalAxisMapping,
  getRegisteredScrollOwnerState,
  measureLogicalOverflow,
  measureLogicalScrollAxis,
  ScrollableAreaController,
  type ScrollKeyboardAccess,
} from './scrollable-area.js';

class ScrollHost extends LitElement {
  static override styles = css`
    :host {
      display: block;
    }
    .viewport {
      block-size: 100px;
      inline-size: 200px;
    }
    :host([auto]) .viewport {
      overflow: auto;
    }
  `;
  access: ScrollKeyboardAccess = {owner: 'implicit'};
  axis: 'inline' | 'block' | 'both' = 'block';
  readonly scroller: ScrollableAreaController = new ScrollableAreaController(this, {
    viewport: () => this.renderRoot.querySelector<HTMLElement>('.viewport'),
    content: () => this.renderRoot.querySelector<HTMLElement>('.content'),
    slot: () => this.renderRoot.querySelector('slot'),
    axis: () => this.axis,
    keyboardAccess: () => this.access,
  });

  override render() {
    return html`<div class="viewport">
      <div class="content"><slot></slot></div>
    </div>`;
  }
}
customElements.define('test-scroll-host', ScrollHost);

async function host(attributes: string, content: string, setup?: (element: ScrollHost) => void) {
  const root = await fixture<HTMLElement>(
    `<div><test-scroll-host ${attributes}>${content}</test-scroll-host></div>`,
  );
  const element = root.querySelector<ScrollHost>('test-scroll-host')!;
  if (setup) {
    setup(element);
    element.requestUpdate();
    await element.updateComplete;
  }
  await nextFrame();
  await nextFrame();
  return {root, element, viewport: element.shadowRoot!.querySelector<HTMLElement>('.viewport')!};
}

const tall = '<div style="block-size: 400px">tall</div>';

describe('getLogicalAxisMapping', () => {
  it('maps the logical axes onto the physical ones through writing mode and direction', () => {
    expect(getLogicalAxisMapping('horizontal-tb', 'ltr')).toEqual({
      inline: 'x',
      block: 'y',
      inlineReversed: false,
      blockReversed: false,
    });
    expect(getLogicalAxisMapping('horizontal-tb', 'rtl').inlineReversed).toBe(true);
    const verticalRl = getLogicalAxisMapping('vertical-rl', 'ltr');
    expect([verticalRl.inline, verticalRl.block, verticalRl.blockReversed]).toEqual([
      'y',
      'x',
      true,
    ]);
    expect(getLogicalAxisMapping('vertical-lr', 'ltr').blockReversed).toBe(false);
    // sideways-lr runs its natural inline direction bottom to top; `direction` reverses each.
    expect(getLogicalAxisMapping('sideways-lr', 'ltr').inlineReversed).toBe(true);
    expect(getLogicalAxisMapping('sideways-lr', 'rtl').inlineReversed).toBe(false);
    expect(getLogicalAxisMapping('vertical-rl', 'rtl').inlineReversed).toBe(true);
  });
});

describe('measuring', () => {
  it('measures overflow and edges of a scroll container, and reports unknown for a hidden one', async () => {
    const viewport = await fixture<HTMLElement>(
      `<div id="v" style="block-size: 100px; inline-size: 100px; overflow: auto"><div style="block-size: 300px">x</div></div>`,
    );
    const mapping = getLogicalAxisMapping('horizontal-tb', 'ltr');
    expect(measureLogicalOverflow(viewport, 'block', mapping)).toBe(true);
    expect(measureLogicalOverflow(viewport, 'inline', mapping)).toBe(false);
    expect(measureLogicalScrollAxis(viewport, 'block', mapping)).toEqual({
      isScrollable: true,
      atStart: true,
      atEnd: false,
    });
    viewport.scrollTop = 500;
    expect(measureLogicalScrollAxis(viewport, 'block', mapping)?.atEnd).toBe(true);
    viewport.style.display = 'none';
    expect(measureLogicalOverflow(viewport, 'block', mapping)).toBeNull();
    expect(measureLogicalScrollAxis(viewport, 'block', mapping)).toBeNull();
  });

  it('a non-scrolling overflow value is not effective even when the content is taller', async () => {
    const viewport = await fixture<HTMLElement>(
      `<div id="v" style="block-size: 100px; overflow: hidden"><div style="block-size: 300px">x</div></div>`,
    );
    const mapping = getLogicalAxisMapping('horizontal-tb', 'ltr');
    expect(measureLogicalScrollAxis(viewport, 'block', mapping)?.isScrollable).toBe(false);
  });
});

describe('ScrollableAreaController: named viewport', () => {
  it('registers the viewport as a scroll owner while it scrolls, and finds the nearest one through slots', async () => {
    const {element, viewport} = await host('', '<div id="inner">x</div>' + tall, (target) => {
      target.access = {owner: 'viewport', label: 'Log'};
    });
    expect(element.scroller.isScrollable).toBe(true);
    expect(getRegisteredScrollOwnerState(viewport)?.block.isScrollable).toBe(true);
    // The light DOM child is inside the viewport as rendered (through the slot).
    expect(findNearestScrollOwner(element.querySelector('#inner')!, 'block')).toBe(viewport);
    expect(findNearestScrollOwner(element.querySelector('#inner')!, 'inline')).toBeNull();
    expect(viewport.getAttribute('role')).toBe('group');
    expect(viewport.getAttribute('aria-label')).toBe('Log');
    expect(viewport.getAttribute('tabindex')).toBe('0');
  });

  it('gives the tab stop back, and forgets the owner, when the host disconnects', async () => {
    const {root, element, viewport} = await host('', tall, (target) => {
      target.access = {owner: 'viewport', label: 'Log'};
    });
    expect(viewport.getAttribute('tabindex')).toBe('0');
    element.remove();
    expect(viewport.hasAttribute('tabindex')).toBe(false);
    expect(getRegisteredScrollOwnerState(viewport)).toBeUndefined();
    root.append(element);
    await element.updateComplete;
    await waitUntil(
      () => element.shadowRoot!.querySelector('.viewport')!.getAttribute('tabindex') === '0',
    );
  });

  it('keeps the same state object while nothing changed and notifies on a change', async () => {
    const {element, viewport} = await host('', tall, (target) => {
      target.access = {owner: 'viewport', label: 'Log'};
    });
    const first = element.scroller.state;
    element.scroller.update();
    expect(element.scroller.state).toBe(first);
    viewport.scrollTop = 1000;
    await waitUntil(() => element.scroller.state !== first);
    expect(element.scroller.state.block.atEnd).toBe(true);
  });

  it('a requested axis that fits stays inactive even when another overflows', async () => {
    const {element} = await host('', tall, (target) => {
      target.access = {owner: 'viewport', label: 'Log'};
      target.axis = 'inline';
    });
    expect(element.scroller.isScrollable).toBe(false);
  });
});

describe('ScrollableAreaController: implicit tab stop', () => {
  it('takes a tab stop while the box scrolls and nothing inside is tabbable', async () => {
    const {viewport} = await host('auto', tall);
    expect(viewport.getAttribute('tabindex')).toBe('0');
  });

  it('gives it back when the content fits or a tab stop of its own appears inside', async () => {
    const {element, viewport} = await host('auto', tall);
    expect(viewport.getAttribute('tabindex')).toBe('0');
    const button = document.createElement('button');
    button.textContent = 'inside';
    element.append(button);
    await waitUntil(() => !viewport.hasAttribute('tabindex'));
    button.remove();
    await waitUntil(() => viewport.getAttribute('tabindex') === '0');
  });

  it('never adds a stop to a box that does not scroll (its CSS overflow is not scrollable)', async () => {
    const {viewport} = await host('', tall);
    expect(getComputedStyle(viewport).overflowY).toBe('visible');
    expect(viewport.hasAttribute('tabindex')).toBe(false);
  });

  it('an idle tabindex of -1 keeps a script-focusable target that is never a tab stop', async () => {
    const {viewport} = await host('auto', '<p>short</p>', (target) => {
      target.access = {owner: 'implicit', idleTabindex: '-1'};
    });
    expect(viewport.getAttribute('tabindex')).toBe('-1');
    // Once it scrolls it becomes a real tab stop.
    const {viewport: overflowing} = await host('auto', tall, (target) => {
      target.access = {owner: 'implicit', idleTabindex: '-1'};
    });
    expect(overflowing.getAttribute('tabindex')).toBe('0');
  });

  it('writes no overflow, role or label: the box owns those itself', async () => {
    const {viewport} = await host('auto', tall);
    expect(viewport.style.overflowY).toBe('');
    expect(viewport.hasAttribute('role')).toBe(false);
    expect(viewport.hasAttribute('aria-label')).toBe(false);
  });
});

describe('attachScrollKeyboardDelegation', () => {
  it('lands a forward Tab on the first link and detaches cleanly', async () => {
    const root = await fixture<HTMLElement>(
      `<div><button id="before">b</button><div id="v" tabindex="0" style="block-size: 60px; overflow: auto"><a id="link" href="#x">link</a><div style="block-size: 400px"></div></div></div>`,
    );
    const viewport = root.querySelector<HTMLElement>('#v')!;
    const detach = attachScrollKeyboardDelegation(viewport, () => [viewport]);
    root.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(root.querySelector('#link'));
    detach();
    root.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(viewport);
  });

  it('does not delegate to a link inside a nested scroll owner', async () => {
    const root = await fixture<HTMLElement>(
      `<div><button id="before">b</button><div id="v" tabindex="0" style="block-size: 60px; overflow: auto"><div style="block-size: 40px; overflow: auto"><a id="link" href="#x">link</a><div style="block-size: 200px"></div></div><div style="block-size: 400px"></div></div></div>`,
    );
    const viewport = root.querySelector<HTMLElement>('#v')!;
    attachScrollKeyboardDelegation(viewport, () => [viewport]);
    root.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(viewport);
  });
});
