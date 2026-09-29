/**
 * Focus utilities that understand shadow roots and slots (`core/src/utils/focus.ts`).
 */
import {describe, expect, it} from 'vitest';
import {
  containsFlat,
  deepActiveElement,
  flatParent,
  focusFirst,
  focusTargetOf,
  getTabbables,
  isFocusDetached,
  isTabbable,
} from '@tecton-wc/core/utils/focus.js';
import {fixture} from '../fixture.js';

/** `<x-host>` with a shadow root that renders `inner` around a default slot. */
function host(html: string, options: {delegatesFocus?: boolean} = {}): HTMLElement {
  const element = document.createElement('div');
  element.attachShadow({mode: 'open', delegatesFocus: options.delegatesFocus ?? false}).innerHTML =
    html;
  return element;
}

describe('deepActiveElement and detachment', () => {
  it('looks through nested open shadow roots', async () => {
    const root = await fixture<HTMLDivElement>('<div></div>');
    const outer = host('<div id="mid"></div>');
    root.append(outer);
    const mid = outer.shadowRoot!.querySelector('#mid')!;
    const inner = host('<button id="deep">x</button>');
    mid.append(inner);
    inner.shadowRoot!.querySelector<HTMLElement>('#deep')!.focus();
    expect(deepActiveElement()?.id).toBe('deep');
  });

  it('isFocusDetached is true on body/root and false on a control', async () => {
    const root = await fixture<HTMLDivElement>('<button>x</button>');
    (document.activeElement as HTMLElement | null)?.blur();
    expect(isFocusDetached()).toBe(true);
    root.focus();
    expect(isFocusDetached()).toBe(false);
  });
});

describe('flat tree', () => {
  it('flatParent follows slot assignment and shadow hosts; containsFlat uses it', async () => {
    const root = await fixture<HTMLDivElement>('<div></div>');
    const wrapper = host('<section><slot></slot></section>');
    const slotted = document.createElement('button');
    wrapper.append(slotted);
    root.append(wrapper);
    const slot = wrapper.shadowRoot!.querySelector('slot')!;
    const section = wrapper.shadowRoot!.querySelector('section')!;
    expect(flatParent(slotted)).toBe(slot);
    expect(flatParent(section)).toBe(wrapper);
    expect(containsFlat(section, slotted)).toBe(true);
    expect(containsFlat(wrapper, slotted)).toBe(true);
    expect(containsFlat(slotted, wrapper)).toBe(false);
    expect(containsFlat(null, slotted)).toBe(false);
    // Plain `contains()` misses the slotted case: that is why containsFlat exists.
    expect(section.contains(slotted)).toBe(false);
  });
});

describe('isTabbable and getTabbables', () => {
  it('excludes disabled, negative tabindex, hidden, inert, hidden inputs and bare anchors', async () => {
    const root = await fixture<HTMLDivElement>(
      `<div>
        <button id="ok">ok</button>
        <button id="disabled" disabled>d</button>
        <button id="negative" tabindex="-1">n</button>
        <button id="hidden" hidden>h</button>
        <button id="invisible" style="visibility:hidden">v</button>
        <div inert><button id="inert">i</button></div>
        <input id="hiddeninput" type="hidden">
        <a id="bare">a</a>
        <a id="link" href="#x">a</a>
        <span id="focusable" tabindex="0">s</span>
      </div>`,
    );
    expect(getTabbables(root).map((element) => element.id)).toEqual(['ok', 'link', 'focusable']);
    expect(isTabbable(root.querySelector('#ok')!)).toBe(true);
    expect(isTabbable(root.querySelector('#disabled')!)).toBe(false);
    expect(isTabbable(document.createTextNode('x') as unknown as Element)).toBe(false);
  });

  it('follows shadow roots and slots in flat-tree order, and skips delegating hosts themselves', async () => {
    const root = await fixture<HTMLDivElement>('<div></div>');
    const wrapper = host(
      '<button id="before">b</button><slot></slot><button id="after">a</button>',
      {
        delegatesFocus: true,
      },
    );
    wrapper.innerHTML = '<button id="slotted">s</button>';
    root.append(wrapper);
    expect(getTabbables(root).map((element) => element.id)).toEqual(['before', 'slotted', 'after']);
    expect(isTabbable(wrapper)).toBe(false);
  });

  it('a ShadowRoot can be the container, and fallback slot content counts when nothing is assigned', async () => {
    const root = await fixture<HTMLDivElement>('<div></div>');
    const wrapper = host('<slot><button id="fallback">f</button></slot>');
    root.append(wrapper);
    expect(getTabbables(wrapper.shadowRoot!).map((element) => element.id)).toEqual(['fallback']);
  });
});

describe('focusTargetOf and focusFirst', () => {
  it('resolves through delegating hosts (recursively), focusable elements and wrappers', async () => {
    const root = await fixture<HTMLDivElement>('<div></div>');
    const inner = host('<button id="inner">i</button>', {delegatesFocus: true});
    const outer = host('<div><slot></slot></div>', {delegatesFocus: true});
    outer.shadowRoot!.querySelector('div')!.append(inner);
    root.append(outer);
    expect(focusTargetOf(outer)?.id).toBe('inner');

    const button = document.createElement('button');
    expect(focusTargetOf(button)).toBe(button);

    const wrapper = document.createElement('span');
    wrapper.innerHTML = '<em><a href="#x" id="link">l</a></em>';
    expect(focusTargetOf(wrapper)?.id).toBe('link');
    expect(focusTargetOf(document.createElement('div'))).toBeNull();
  });

  it('focusFirst focuses the first tabbable, else the container', async () => {
    const root = await fixture<HTMLDivElement>(
      '<div tabindex="-1"><button id="a">a</button></div>',
    );
    expect(focusFirst(root).id).toBe('a');
    expect(document.activeElement?.id).toBe('a');
    const empty = await fixture<HTMLDivElement>('<div tabindex="-1"></div>');
    expect(focusFirst(empty)).toBe(empty);
    expect(document.activeElement).toBe(empty);
  });
});
