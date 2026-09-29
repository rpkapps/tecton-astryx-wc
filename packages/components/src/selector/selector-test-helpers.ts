/**
 * Helpers shared by the selector test files: mounting, reading the parts of an open selector, and
 * counting announcements (`ariaNotify` is stubbed so every spoken message is one recorded call). Not part
 * of the shipped API.
 */
import {vi} from 'vitest';
import {userEvent} from 'vitest/browser';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import type {SelectorOptionType} from './selector.types.js';
import type {TctSelector} from './tct-selector.js';

export const FRUIT: SelectorOptionType[] = ['Apple', 'Banana', 'Orange', 'Pear'];

export const GROUPED: SelectorOptionType[] = [
  {value: 'apple', label: 'Apple', description: 'Crisp'},
  {value: 'banana', label: 'Banana', icon: 'search'},
  {type: 'divider'},
  {
    type: 'section',
    title: 'Citrus',
    options: ['Orange', {value: 'lemon', label: 'Lemon', disabled: true}, 'Lime'],
  },
];

/** The selector-like elements the helpers work on. */
export interface SelectLike extends HTMLElement {
  options: SelectorOptionType[];
  open: boolean;
  readonly updateComplete: Promise<boolean>;
}

/** Mounts `<tag attributes>` with `options` in a padded, wide container and waits for it to settle. */
export async function mountSelect<T extends SelectLike = TctSelector>(
  tag: string,
  attributes: string,
  options: SelectorOptionType[] = FRUIT,
  fixtureOptions: {dir?: 'rtl' | 'ltr'; lang?: string} = {},
  before = '',
  after = '',
): Promise<T> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:40px 40px 320px;inline-size:420px">${before}<${tag} ${attributes}></${tag}>${after}</div>`,
    fixtureOptions,
  );
  const el = root.querySelector<T>(tag)!;
  el.options = options;
  await el.updateComplete;
  await nextFrame();
  return el;
}

export const trigger = (el: HTMLElement): HTMLButtonElement =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('button.trigger')!;
export const layerOf = (el: HTMLElement): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.layer')!;
export const listboxOf = (el: HTMLElement): HTMLElement | null =>
  el.shadowRoot!.querySelector<HTMLElement>('.listbox');
export const searchOf = (el: HTMLElement): HTMLInputElement | null =>
  el.shadowRoot!.querySelector<HTMLInputElement>('.search-input');
export const optionsOf = (el: HTMLElement): HTMLElement[] => [
  ...el.shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]'),
];
/** Each row's label: the `label` of its `tct-selector-option`, else its own text. */
export const optionTexts = (el: HTMLElement): string[] =>
  optionsOf(el).map(
    (option) =>
      option.querySelector('tct-selector-option')?.getAttribute('label') ??
      option.textContent.replace(/\s+/g, ' ').trim(),
  );
export const isShown = (el: HTMLElement): boolean => layerOf(el).matches(':popover-open');

/** The element that owns `aria-activedescendant`: the search field when there is one open, else the trigger. */
export function focusOwner(el: SelectLike, hasSearch = false): HTMLElement {
  return (hasSearch ? searchOf(el) : null) ?? trigger(el);
}

/** The highlighted option through element reflection, or the id fallback of Tier 2. */
export function activeOption(owner: HTMLElement): HTMLElement | null {
  const reflected = (owner as unknown as {ariaActiveDescendantElement?: Element | null})
    .ariaActiveDescendantElement;
  if (reflected) return reflected as HTMLElement;
  const id = owner.getAttribute('aria-activedescendant');
  return id ? (owner.getRootNode() as ShadowRoot).getElementById(id) : null;
}

/** The label of the highlighted row (its `tct-selector-option` label, else its text). */
export const activeText = (owner: HTMLElement): string | undefined => {
  const option = activeOption(owner);
  if (!option) return undefined;
  return (
    option.querySelector('tct-selector-option')?.getAttribute('label') ??
    option.textContent.replace(/\s+/g, ' ').trim()
  );
};

/** Opens by a real click and waits for the popup and its entry animation. */
export async function openByClick(el: SelectLike): Promise<void> {
  await userEvent.click(trigger(el));
  await waitUntil(() => el.open && isShown(el), 'opened');
  await el.updateComplete;
  await animationsFinished(layerOf(el));
}

/** Waits for the popup to be closed and gone. */
export async function closed(el: SelectLike): Promise<void> {
  await waitUntil(() => !el.open && !isShown(el), 'closed');
}

/** Stubs `ariaNotify` so each announcement is one call; returns the recorded messages and a restore. */
export function recordAnnouncements(): {
  messages: () => string[];
  restore: () => void;
} {
  const calls: string[] = [];
  const original = (HTMLElement.prototype as unknown as {ariaNotify?: unknown}).ariaNotify;
  const stub = vi.fn((message: string) => {
    calls.push(message);
  });
  Object.defineProperty(HTMLElement.prototype, 'ariaNotify', {
    configurable: true,
    writable: true,
    value: stub,
  });
  const restoreFeature = overrideFeature('ariaNotify', true);
  return {
    messages: () => [...calls],
    restore: () => {
      restoreFeature();
      if (original === undefined) {
        delete (HTMLElement.prototype as unknown as {ariaNotify?: unknown}).ariaNotify;
      } else {
        Object.defineProperty(HTMLElement.prototype, 'ariaNotify', {
          configurable: true,
          writable: true,
          value: original,
        });
      }
    },
  };
}
