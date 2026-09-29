/**
 * tct-button inside a button group (WP-3 contract): the group answers `buttonGroupContext` per requesting
 * button with `{size, orientation, position, disabled}`; the button squares its own interior corners from
 * that with per-corner logical radii, and nothing depends on DOM position (`:last-child`).
 * A stand-in provider (an element answering `context-request`) plays the group here.
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {defineElement} from '@tecton-astryx/core/define.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {
  buttonGroupContext,
  type ButtonGroupContextValue,
  type ButtonGroupPosition,
} from '@tecton-astryx/core/context/keys.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import './define.js';
import type {TctButton} from './tct-button.js';

type Notify = (value: ButtonGroupContextValue, unsubscribe?: () => void) => void;

/**
 * A stand-in for the real group: an element that answers `buttonGroupContext` requests per requesting
 * button. The listener is added in the constructor, so it exists before its children are parsed and
 * connect (the buttons find their provider on the first request).
 */
class TestButtonGroup extends TctElement {
  static override readonly tagName = 'tct-test-button-group';
  base: Omit<ButtonGroupContextValue, 'position'> = {size: 'md', orientation: 'horizontal'};
  readonly #subscribers = new Map<Element, Notify>();

  constructor() {
    super();
    this.addEventListener('context-request', (event) => {
      if ((event.context as unknown) !== buttonGroupContext) return;
      event.stopPropagation();
      const callback = event.callback as Notify;
      this.#subscribers.set(event.contextTarget, callback);
      callback(this.#valueFor(event.contextTarget), () =>
        this.#subscribers.delete(event.contextTarget),
      );
    });
  }

  #valueFor(button: Element): ButtonGroupContextValue {
    const buttons: Element[] = [...this.querySelectorAll('tct-button')];
    const index = buttons.indexOf(button);
    const position: ButtonGroupPosition =
      buttons.length === 1
        ? 'only'
        : index === 0
          ? 'first'
          : index === buttons.length - 1
            ? 'last'
            : 'middle';
    return {...this.base, position};
  }

  /** Re-notifies every subscribed button (what the real group does when its children change). */
  refresh(next: Partial<Omit<ButtonGroupContextValue, 'position'>> = {}): void {
    Object.assign(this.base, next);
    for (const [button, notify] of this.#subscribers) notify(this.#valueFor(button));
  }

  override render() {
    return html`<slot></slot>`;
  }
}
defineElement(TestButtonGroup);

const inner = (button: TctButton): HTMLElement =>
  button.shadowRoot!.querySelector<HTMLElement>('.button')!;

/** Renders `count` buttons in the stand-in group. */
async function makeGroup(
  count: number,
  base: Omit<ButtonGroupContextValue, 'position'>,
  options: {dir?: 'ltr' | 'rtl'; variant?: string; wrapInner?: boolean} = {},
) {
  const buttons = Array.from(
    {length: count},
    (_, index) =>
      `<tct-button label="B${index}" variant="${options.variant ?? 'secondary'}"></tct-button>`,
  ).join('');
  const root = await fixture<HTMLElement>(
    `<div dir="${options.dir ?? 'ltr'}"><tct-test-button-group style="display:inline-flex">${options.wrapInner ? `<span>${buttons}</span>` : buttons}</tct-test-button-group></div>`,
  );
  const group = root.querySelector<TestButtonGroup>('tct-test-button-group')!;
  Object.assign(group.base, base);
  group.refresh();
  const list = [...root.querySelectorAll<TctButton>('tct-button')];
  await Promise.all(list.map((button) => button.updateComplete));
  return {root: group, list, provider: group};
}

const radii = (button: TctButton): string[] => {
  const style = getComputedStyle(inner(button));
  return [
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomRightRadius,
    style.borderBottomLeftRadius,
  ];
};

describe('tct-button in a horizontal button group', () => {
  it('rounds only the outer corners: first, middle, last', async () => {
    const {list} = await makeGroup(3, {size: 'md', orientation: 'horizontal'});
    // order: top-left, top-right, bottom-right, bottom-left (physical, left-to-right layout)
    expect(radii(list[0]!)).toEqual(['4px', '0px', '0px', '4px']);
    expect(radii(list[1]!)).toEqual(['0px', '0px', '0px', '0px']);
    expect(radii(list[2]!)).toEqual(['0px', '4px', '4px', '0px']);
  });

  it('an only child keeps every corner round', async () => {
    const {list} = await makeGroup(1, {size: 'md', orientation: 'horizontal'});
    expect(radii(list[0]!)).toEqual(['4px', '4px', '4px', '4px']);
  });

  it('is mirrored in right-to-left: the first button is on the right, corners are logical', async () => {
    const {list} = await makeGroup(3, {size: 'md', orientation: 'horizontal'}, {dir: 'rtl'});
    expect(radii(list[0]!)).toEqual(['0px', '4px', '4px', '0px']);
    expect(radii(list[2]!)).toEqual(['4px', '0px', '0px', '4px']);
    expect(list[0]!.getBoundingClientRect().left).toBeGreaterThan(
      list[2]!.getBoundingClientRect().left,
    );
  });

  it('a hairline separates neighbours (the joining edge), none on the first button', async () => {
    const {list} = await makeGroup(3, {size: 'md', orientation: 'horizontal'});
    const probe = await fixture<HTMLElement>('<span>x</span>');
    probe.style.color = 'var(--color-border)';
    const border = getComputedStyle(probe).color;
    expect(getComputedStyle(inner(list[0]!)).borderInlineStartColor).toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(inner(list[1]!)).borderInlineStartColor).toBe(border);
    expect(getComputedStyle(inner(list[2]!)).borderInlineStartColor).toBe(border);
    expect(getComputedStyle(inner(list[1]!)).borderInlineStartWidth).toBe('1px');
  });

  it('solid variants use the on-accent ink for the separator', async () => {
    const {list} = await makeGroup(
      2,
      {size: 'md', orientation: 'horizontal'},
      {variant: 'primary'},
    );
    const probe = await fixture<HTMLElement>('<span>x</span>');
    probe.style.color = 'var(--color-on-accent)';
    expect(getComputedStyle(inner(list[1]!)).borderInlineStartColor).toBe(
      getComputedStyle(probe).color,
    );
  });

  it('corners come from the context, not the DOM: wrappers and trailing elements change nothing', async () => {
    const {list} = await makeGroup(3, {size: 'md', orientation: 'horizontal'}, {wrapInner: true});
    // every button is the last element child of its own `span` only if it were :last-child based
    expect(radii(list[0]!)).toEqual(['4px', '0px', '0px', '4px']);
    expect(radii(list[1]!)).toEqual(['0px', '0px', '0px', '0px']);
    expect(radii(list[2]!)).toEqual(['0px', '4px', '4px', '0px']);
    list[2]!.insertAdjacentHTML('afterend', '<template></template><div popover="manual"></div>');
    await list[2]!.updateComplete;
    expect(radii(list[2]!)).toEqual(['0px', '4px', '4px', '0px']);
  });
});

describe('tct-button in a vertical button group', () => {
  it('rounds the outer block corners and separates neighbours on the block axis', async () => {
    const {root, list} = await makeGroup(3, {size: 'md', orientation: 'vertical'});
    root.style.flexDirection = 'column';
    expect(radii(list[0]!)).toEqual(['4px', '4px', '0px', '0px']);
    expect(radii(list[1]!)).toEqual(['0px', '0px', '0px', '0px']);
    expect(radii(list[2]!)).toEqual(['0px', '0px', '4px', '4px']);
    const probe = await fixture<HTMLElement>('<span>x</span>');
    probe.style.color = 'var(--color-border)';
    expect(getComputedStyle(inner(list[1]!)).borderBlockStartColor).toBe(
      getComputedStyle(probe).color,
    );
    expect(getComputedStyle(inner(list[0]!)).borderBlockStartColor).toBe('rgba(0, 0, 0, 0)');
  });
});

describe('tct-button group context values', () => {
  it('takes its size from the group unless it has its own', async () => {
    const {list} = await makeGroup(2, {size: 'lg', orientation: 'horizontal'});
    expect(inner(list[0]!).getAttribute('data-size')).toBe('lg');
    expect(inner(list[0]!).getBoundingClientRect().height).toBe(36);
    list[1]!.size = 'sm';
    await list[1]!.updateComplete;
    expect(inner(list[1]!).getAttribute('data-size')).toBe('sm');
  });

  it('is disabled by the group (native disabled, disabled fill) and enabled again with it', async () => {
    const {list, provider} = await makeGroup(2, {
      size: 'md',
      orientation: 'horizontal',
      disabled: true,
    });
    expect(inner(list[0]!).hasAttribute('disabled')).toBe(true);
    expect(inner(list[0]!).hasAttribute('data-disabled')).toBe(true);
    provider.refresh({disabled: false});
    await list[0]!.updateComplete;
    expect(inner(list[0]!).hasAttribute('disabled')).toBe(false);
  });

  it('follows the group when its value changes (subscribe): a button added in the middle', async () => {
    const {root, list, provider} = await makeGroup(2, {size: 'md', orientation: 'horizontal'});
    expect(radii(list[1]!)).toEqual(['0px', '4px', '4px', '0px']);
    list[0]!.insertAdjacentHTML('afterend', '<tct-button label="Middle"></tct-button>');
    provider.refresh();
    await Promise.all(
      [...root.querySelectorAll<TctButton>('tct-button')].map((button) => button.updateComplete),
    );
    // the newly added button asked the provider on connect only when the provider listens above it
    expect(radii(list[1]!)).toEqual(['0px', '4px', '4px', '0px']);
    expect(radii(list[0]!)).toEqual(['4px', '0px', '0px', '4px']);
  });

  it('elevation is ignored inside a group (the group owns the surface)', async () => {
    const {list} = await makeGroup(2, {size: 'md', orientation: 'horizontal'});
    list[0]!.elevation = 'high';
    await list[0]!.updateComplete;
    expect(inner(list[0]!).getAttribute('data-elevation')).toBe('none');
    expect(getComputedStyle(inner(list[0]!)).boxShadow).toBe('none');
  });

  it('a button without a group keeps four round corners and no separator', async () => {
    const button = await fixture<TctButton>('<tct-button label="Alone"></tct-button>');
    expect(radii(button)).toEqual(['4px', '4px', '4px', '4px']);
    expect(getComputedStyle(inner(button)).borderInlineStartColor).toBe('rgba(0, 0, 0, 0)');
  });
});
