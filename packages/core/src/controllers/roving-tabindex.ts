/**
 * Roving tabindex (A§9.11): a composite (toolbar, tab list, radio group, menu) is ONE tab stop.
 * Exactly one enabled item carries `tabindex="0"`; arrow keys move it and DOM focus with it. Option
 * names align with Open UI `focusgroup`.
 *
 * Arrows follow the host's computed direction (horizontal arrows mirror in RTL); Home/End,
 * PageUp/PageDown (`pageSize`), wrap, typeahead, disabled skipping and IME safety are built in.
 *
 * Trap: `tabindex="-1"` on a shadow host removes its whole flat subtree from sequential navigation.
 * Items that are wrappers (a custom element around a native button) must expose the inner control
 * through `focusTarget`; the controller then writes `tabindex` and calls `focus()` on that element.
 *
 * ```ts
 * #roving = new RovingTabindexController(this, {
 *   items: () => [...this.querySelectorAll<TctTab>('tct-tab')],
 *   orientation: 'horizontal',
 *   activateOnFocus: () => this.activation === 'automatic',
 * });
 * ```
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {containsFlat} from '../utils/focus.js';
import {isImeKeyEvent} from '../utils/ime.js';
import {TypeaheadController} from './typeahead.js';

export type Orientation = 'horizontal' | 'vertical' | 'both';

export interface RovingOptions<T extends HTMLElement> {
  /** Items in DOM order, disabled ones included. */
  items: () => T[];
  /** Default `'horizontal'`. */
  orientation?: Orientation | (() => Orientation);
  /** Wrap from last to first and back. Default `true`. */
  wrap?: boolean;
  /** Home/End move to the first/last enabled item. Default `true`. */
  homeEnd?: boolean;
  /** PageUp/PageDown step; off by default. */
  pageSize?: number;
  /** Default: `disabled`, `aria-disabled="true"` or `:disabled`. */
  isDisabled?: (item: T) => boolean;
  /** APG menus: disabled items stay focusable. */
  focusDisabled?: boolean;
  /** Wrapper items: the element that receives `tabindex` and focus (default: the item). */
  focusTarget?: (item: T) => HTMLElement | null;
  /** Leave arrows to text inputs while the caret can still move. */
  caretGuard?: boolean;
  /** Activate the item as it receives keyboard focus (automatic tab activation). */
  activateOnFocus?: boolean | (() => boolean);
  /**
   * Called when an item becomes active through activate-on-focus, and on Enter/Space for items whose
   * focus target does not activate natively (custom controls).
   */
  onActivate?: (item: T, event: Event) => void;
  /** Type-to-focus: `true` uses the item's text; a function supplies the label. */
  typeahead?: boolean | ((item: T) => string);
  /**
   * Nested widgets: for items where this returns `true`, only keys pressed on the item's own focus
   * target are handled; keys from inside the item (a submenu's items) belong to the nested group.
   */
  boundary?: (item: T) => boolean;
}

const NATIVELY_ACTIVATING = new Set(['button', 'a', 'input', 'select', 'textarea', 'summary']);

export class RovingTabindexController<T extends HTMLElement> implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #options: RovingOptions<T>;
  readonly #typeahead: TypeaheadController;
  #active: T | null = null;

  constructor(host: ReactiveControllerHost & HTMLElement, options: RovingOptions<T>) {
    this.#host = host;
    this.#options = options;
    this.#typeahead = new TypeaheadController({
      locale: () => this.#host.lang || document.documentElement.lang || undefined,
    });
    host.addController(this);
  }

  /** The item that currently carries `tabindex="0"`. */
  get active(): T | null {
    return this.#active;
  }

  hostConnected(): void {
    this.#host.addEventListener('keydown', this.#onKeyDown);
    this.#host.addEventListener('focusin', this.#onFocusIn);
  }

  hostDisconnected(): void {
    this.#host.removeEventListener('keydown', this.#onKeyDown);
    this.#host.removeEventListener('focusin', this.#onFocusIn);
    this.#typeahead.reset();
  }

  hostUpdated(): void {
    this.update();
  }

  /** Makes `item` the tab stop (and focuses it with `{focus: true}`). `null` re-picks the first enabled item. */
  setActive(item: T | null, options: {focus?: boolean} = {}): void {
    const items = this.#options.items();
    const next = item && items.includes(item) ? item : (this.#firstEnabled(items) ?? null);
    this.#active = next;
    this.#writeTabindex(items);
    if (options.focus && next) this.#focusItem(next);
  }

  /** Re-applies tabindex after slotchange or item changes; keeps the active item when it is still enabled. */
  update(): void {
    const items = this.#options.items();
    const current = this.#active && items.includes(this.#active) ? this.#active : null;
    const usable = current && !this.#disabled(current) ? current : this.#firstEnabled(items);
    this.#active = usable ?? null;
    this.#writeTabindex(items);
  }

  // ---------------------------------------------------------------------------------- internals

  #disabled(item: T): boolean {
    if (this.#options.focusDisabled) return false;
    if (this.#options.isDisabled) return this.#options.isDisabled(item);
    return (
      item.hasAttribute('disabled') ||
      item.getAttribute('aria-disabled') === 'true' ||
      item.matches(':disabled')
    );
  }

  #firstEnabled(items: readonly T[]): T | undefined {
    return items.find((item) => !this.#disabled(item));
  }

  #targetOf(item: T): HTMLElement {
    return this.#options.focusTarget?.(item) ?? item;
  }

  #writeTabindex(items: readonly T[]): void {
    for (const item of items) {
      this.#targetOf(item).setAttribute('tabindex', item === this.#active ? '0' : '-1');
    }
  }

  #focusItem(item: T): void {
    this.#targetOf(item).focus();
  }

  #orientation(): Orientation {
    const option = this.#options.orientation ?? 'horizontal';
    return typeof option === 'function' ? option() : option;
  }

  #itemFor(target: EventTarget | null, items: readonly T[]): T | undefined {
    if (!(target instanceof Node)) return undefined;
    return items.find((item) => item === target || containsFlat(item, target));
  }

  /** A focus that arrives by click or script makes that item the tab stop. */
  readonly #onFocusIn = (event: FocusEvent): void => {
    const items = this.#options.items();
    const item = this.#itemFor(event.composedPath()[0] ?? event.target, items);
    if (!item || item === this.#active || this.#disabled(item)) return;
    if (this.#options.boundary?.(item) && event.composedPath()[0] !== this.#targetOf(item)) return;
    this.#active = item;
    this.#writeTabindex(items);
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || isImeKeyEvent(event)) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const items = this.#options.items();
    const origin = event.composedPath()[0] ?? event.target;
    const current = this.#itemFor(origin, items);
    if (!current) return;
    if (this.#options.boundary?.(current) && origin !== this.#targetOf(current)) return;

    const dir = getComputedStyle(this.#host).direction === 'rtl' ? -1 : 1;
    const orientation = this.#orientation();
    const enabled = items.filter((item) => !this.#disabled(item));
    if (enabled.length === 0) return;
    const index = enabled.indexOf(current);
    const step = this.#step(event.key, orientation, dir);

    if (step !== 0 && this.#options.caretGuard && this.#caretCanMove(origin, step)) return;

    let next: T | undefined;
    if (step !== 0) {
      next = this.#move(enabled, index, step);
    } else if (this.#options.homeEnd !== false && event.key === 'Home') {
      next = enabled[0];
    } else if (this.#options.homeEnd !== false && event.key === 'End') {
      next = enabled[enabled.length - 1];
    } else if (this.#options.pageSize && (event.key === 'PageDown' || event.key === 'PageUp')) {
      const delta = (event.key === 'PageDown' ? 1 : -1) * this.#options.pageSize;
      next = enabled[Math.min(enabled.length - 1, Math.max(0, (index < 0 ? 0 : index) + delta))];
    } else if (this.#options.typeahead && this.#typeahead.isTypeaheadKey(event)) {
      const label =
        typeof this.#options.typeahead === 'function' ? this.#options.typeahead : undefined;
      const labels = enabled.map((item) => (label ? label(item) : (item.textContent ?? '')));
      const found = this.#typeahead.match(event, labels, index);
      event.preventDefault();
      if (found >= 0) next = enabled[found];
    } else if (event.key === 'Enter' || event.key === ' ') {
      this.#activateWithKey(current, origin, event);
      return;
    } else {
      return;
    }

    if (step !== 0 || event.key === 'Home' || event.key === 'End' || event.key.startsWith('Page')) {
      event.preventDefault();
    }
    if (!next || next === current) return;
    this.setActive(next, {focus: true});
    const activate = this.#options.activateOnFocus;
    if (typeof activate === 'function' ? activate() : activate)
      this.#options.onActivate?.(next, event);
  };

  /** -1 / +1 for a logical previous/next arrow in the current orientation and direction, else 0. */
  #step(key: string, orientation: Orientation, dir: 1 | -1): -1 | 0 | 1 {
    const horizontal = orientation !== 'vertical';
    const vertical = orientation !== 'horizontal';
    if (horizontal && key === 'ArrowRight') return dir === 1 ? 1 : -1;
    if (horizontal && key === 'ArrowLeft') return dir === 1 ? -1 : 1;
    if (vertical && key === 'ArrowDown') return 1;
    if (vertical && key === 'ArrowUp') return -1;
    return 0;
  }

  #move(enabled: readonly T[], index: number, step: -1 | 1): T | undefined {
    const count = enabled.length;
    const raw = (index < 0 ? (step === 1 ? -1 : count) : index) + step;
    if (raw < 0 || raw >= count)
      return this.#options.wrap === false ? enabled[index] : enabled[(raw + count) % count];
    return enabled[raw];
  }

  /** Text inputs keep arrows that still move the caret; only at the boundary do arrows leave the field. */
  #caretCanMove(origin: EventTarget | null, step: -1 | 1): boolean {
    if (!(origin instanceof HTMLInputElement || origin instanceof HTMLTextAreaElement))
      return false;
    const {selectionStart, selectionEnd} = origin;
    if (selectionStart === null || selectionEnd === null) return false;
    if (selectionStart !== selectionEnd) return true;
    return step === -1 ? selectionStart > 0 : selectionEnd < origin.value.length;
  }

  #activateWithKey(item: T, origin: EventTarget | null, event: KeyboardEvent): void {
    const name = origin instanceof Element ? origin.localName : '';
    // Native controls activate themselves; custom controls (a tab element, a role=menuitem) do not.
    if (!this.#options.onActivate || NATIVELY_ACTIVATING.has(name)) return;
    if (this.#disabled(item)) return;
    event.preventDefault();
    this.#options.onActivate(item, event);
  }
}
