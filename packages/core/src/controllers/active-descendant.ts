/**
 * `aria-activedescendant` focus model (A§9.12): DOM focus stays on a text input or listbox
 * (combobox, typeahead, command palette, tokenizer) while arrow keys move a *highlight* over options.
 *
 * The highlighted option is exposed as `focusElement.ariaActiveDescendantElement` (element reflection,
 * so options in a different tree, e.g. light-DOM options for a shadow input, still work). Tier 2
 * (no reflection): when both are in one tree the option's id goes into `aria-activedescendant`;
 * otherwise the option's label is announced. The option is marked with `:state(highlighted)` (through
 * its `toggleState`, when it is a library element) and `data-highlighted`. Keyboard highlight
 * scrolls the option into view; pointer highlight never scrolls (the option is already under the
 * pointer, and scrolling would chase it).
 *
 * ```ts
 * #descendants = new ActiveDescendantController(this, {
 *   focusElement: () => this.renderRoot.querySelector('input'),
 *   items: () => [...this.querySelectorAll<TctOption>('tct-option')],
 * });
 * // in the input's keydown handler:
 * if (this.#descendants.handleKeyDown(event)) return;
 * ```
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {announce} from '../a11y/announcer.js';
import {features} from '../features.js';
import {isImeKeyEvent} from '../utils/ime.js';
import {uniqueId} from '../utils/id.js';
import {accessibleText} from './aria-delegate.js';

export type HighlightSource = 'keyboard' | 'pointer' | 'programmatic';

export interface ActiveDescendantOptions<T extends HTMLElement> {
  /** The input/listbox that keeps DOM focus. */
  focusElement: () => HTMLElement | null;
  items: () => T[];
  /** Default: `disabled` or `aria-disabled="true"`. */
  isDisabled?: (item: T) => boolean;
  /** Wrap at the ends. Default `true`. */
  wrap?: boolean;
  /** Home/End move to the first/last enabled item. Default `true`. */
  homeEnd?: boolean;
  /** PageUp/PageDown step; off by default. */
  pageSize?: number;
  onHighlight?: (item: T | null, via: HighlightSource) => void;
}

const isMarkedDisabled = (item: HTMLElement): boolean =>
  item.hasAttribute('disabled') || item.getAttribute('aria-disabled') === 'true';

export class ActiveDescendantController<T extends HTMLElement> implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #options: ActiveDescendantOptions<T>;
  #highlighted: T | null = null;

  constructor(host: ReactiveControllerHost & HTMLElement, options: ActiveDescendantOptions<T>) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  /** The highlighted item, or `null`. */
  get highlighted(): T | null {
    return this.#highlighted;
  }

  hostDisconnected(): void {
    // Leave no stale highlight or reference behind on the input.
    this.highlight(null, 'programmatic');
  }

  hostUpdated(): void {
    // The highlighted item may have been removed by a data change.
    if (this.#highlighted && !this.#options.items().includes(this.#highlighted)) {
      this.highlight(null, 'programmatic');
    }
  }

  /** Highlights `item` (`null` clears). Disabled items cannot be highlighted. */
  highlight(item: T | null, via: HighlightSource = 'programmatic'): void {
    if (item && this.#disabled(item)) return;
    const previous = this.#highlighted;
    if (previous === item) return;
    if (previous) this.#mark(previous, false);
    this.#highlighted = item;
    if (item) {
      this.#mark(item, true);
      if (via === 'keyboard') item.scrollIntoView({block: 'nearest', inline: 'nearest'});
    }
    this.#expose(item);
    this.#options.onHighlight?.(item, via);
  }

  /**
   * Arrow/Home/End/Page keys over the items. Returns `true` when the key was consumed (the caller
   * stops handling it). Composing keys (IME) are never consumed.
   */
  handleKeyDown(event: KeyboardEvent): boolean {
    if (event.defaultPrevented || isImeKeyEvent(event)) return false;
    if (event.altKey || event.ctrlKey || event.metaKey) return false;
    const enabled = this.#options.items().filter((item) => !this.#disabled(item));
    if (enabled.length === 0) return false;
    const index = this.#highlighted ? enabled.indexOf(this.#highlighted) : -1;
    const wrap = this.#options.wrap !== false;
    let next: T | undefined;

    switch (event.key) {
      case 'ArrowDown':
        next = this.#step(enabled, index, 1, wrap);
        break;
      case 'ArrowUp':
        next = this.#step(enabled, index, -1, wrap);
        break;
      case 'Home':
        if (this.#options.homeEnd === false) return false;
        next = enabled[0];
        break;
      case 'End':
        if (this.#options.homeEnd === false) return false;
        next = enabled[enabled.length - 1];
        break;
      case 'PageDown':
      case 'PageUp': {
        const size = this.#options.pageSize;
        if (!size) return false;
        const delta = event.key === 'PageDown' ? size : -size;
        next = enabled[Math.min(enabled.length - 1, Math.max(0, (index < 0 ? 0 : index) + delta))];
        break;
      }
      default:
        return false;
    }
    event.preventDefault();
    if (next) this.highlight(next, 'keyboard');
    return true;
  }

  // ---------------------------------------------------------------------------------- internals

  #disabled(item: T): boolean {
    return this.#options.isDisabled ? this.#options.isDisabled(item) : isMarkedDisabled(item);
  }

  #step(enabled: readonly T[], index: number, step: 1 | -1, wrap: boolean): T | undefined {
    if (index < 0) return step === 1 ? enabled[0] : enabled[enabled.length - 1];
    const raw = index + step;
    if (raw < 0 || raw >= enabled.length)
      return wrap ? enabled[(raw + enabled.length) % enabled.length] : enabled[index];
    return enabled[raw];
  }

  #mark(item: T, on: boolean): void {
    item.toggleAttribute('data-highlighted', on);
    (item as unknown as {toggleState?: (name: string, on: boolean) => void}).toggleState?.(
      'highlighted',
      on,
    );
  }

  /** Points the focused input at the highlighted option, per the engine's capabilities. */
  #expose(item: T | null): void {
    const target = this.#options.focusElement();
    if (!target) return;
    if (features.elementReflection) {
      target.ariaActiveDescendantElement = item;
      return;
    }
    // Tier 2. The id reference only works inside one tree; otherwise speak the option's label.
    if (!item) {
      target.removeAttribute('aria-activedescendant');
      return;
    }
    if (target.getRootNode() === item.getRootNode()) {
      item.id ||= uniqueId('tct-option');
      target.setAttribute('aria-activedescendant', item.id);
    } else {
      target.removeAttribute('aria-activedescendant');
      announce(accessibleText(item), {element: this.#host});
    }
  }
}
