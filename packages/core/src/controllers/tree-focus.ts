/**
 * APG tree keyboard model (A§9.18, WP-5): port of upstream `useTreeFocus` (MIT, Meta Platforms).
 * A tree is ONE tab stop; arrows move over the *visible* treeitems (collapsed subtrees are not
 * rendered), disabled items are skipped, and Left/Right expand, collapse and move to a child or the
 * parent (mirrored in RTL).
 *
 *  - ArrowDown / ArrowUp: next / previous enabled visible item (no wrap; the roam clamps at the ends)
 *  - Home / End: first / last enabled visible item
 *  - ArrowRight: collapsed parent expands; expanded parent moves to its first child; leaf: nothing
 *  - ArrowLeft: expanded parent collapses; otherwise moves to the parent item
 *  - Enter / Space: activates the item (the host's `onActivate` clicks its inner link or button),
 *    falling back to toggling a parent that has no action of its own
 *  - printable keys: type-ahead over the items' own labels (locale-aware, `TypeaheadController`)
 *
 * With `rovingTabindex` the controller owns the tab stop: exactly one enabled item carries
 * `tabindex="0"`; it is repaired after every host update (items added, removed or disabled) and moves
 * with keyboard navigation and with focus that arrives by pointer or script. An existing
 * `tabindex="0"` item is preserved, so the host can seed the active one in its template (the selected
 * or first enabled item).
 *
 * The tree lives in the host's shadow root (data-driven widget, A§7.7): the host renders
 * `<ul role="tree" @keydown=${c.handleKeyDown} @focusin=${c.handleFocusIn}>`. Items are found with
 * `itemSelector`; level, expansion, id and disabled state are read from `aria-level`, `aria-expanded`,
 * `data-tree-id` and `data-tree-disabled` / `aria-disabled`, so the controller works on what is
 * rendered, with no parallel model to drift.
 *
 * Guides: [mwg:accessibility] (roving tabindex) [mwg:spatial-navigation] (single tab stop, native
 * scrolling preserved when nothing handles a key) [mwg:accessible-web-components]
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {isImeKeyEvent} from '../utils/ime.js';
import {TypeaheadController} from './typeahead.js';

/** Keys the tree handles itself (never typeahead). */
const NAVIGATION_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'ArrowRight',
  'ArrowLeft',
  'Home',
  'End',
  'Enter',
  ' ',
]);

export interface TreeFocusOptions {
  /** The `role="tree"` element (in the host's shadow root); `null` before the first render. */
  tree: () => HTMLElement | null;
  /** Selector for treeitems within the tree. Default `[role="treeitem"]`. */
  itemSelector?: string;
  /** Disabled items are skipped by navigation. Default: `data-tree-disabled` or `aria-disabled="true"`. */
  isItemDisabled?: (item: HTMLElement) => boolean;
  /** 1-based nesting level. Default: `aria-level` (falling back to 1). */
  getLevel?: (item: HTMLElement) => number;
  /** Default: `aria-expanded="true"`. */
  isExpanded?: (item: HTMLElement) => boolean;
  /** Collapsed parent. Default: `aria-expanded="false"`. */
  isCollapsed?: (item: HTMLElement) => boolean;
  /** Stable id passed to `onToggleExpand` and `onActivate`. Default: `data-tree-id`. */
  getItemId?: (item: HTMLElement) => string | undefined;
  /** The label typeahead compares. Default: the item's own text (see `getLabel` note in TreeList). */
  getLabel?: (item: HTMLElement) => string;
  /** Expand or collapse the item (arrows, and Enter/Space on a parent without an action). */
  onToggleExpand?: (id: string, item: HTMLElement, reason: 'keyboard') => void;
  /** Enter/Space. Return `true` when handled (an inner link or button was clicked). */
  onActivate?: (item: HTMLElement, id: string | undefined) => boolean | undefined;
  /** Type-ahead. Default `true`. */
  typeahead?: boolean;
  /** Typeahead buffer reset delay in ms. Default 500 (upstream's tree value). */
  typeaheadResetMs?: number;
  /** Called when the controller moves focus to an item. */
  onActiveChange?: (id: string | undefined, item: HTMLElement) => void;
  /** Own the roving tab stop (see the file comment). Default `false`: the caller manages `tabindex`. */
  rovingTabindex?: boolean;
  /** Locale for typeahead comparison. */
  locale?: () => string | undefined;
}

export class TreeFocusController implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #options: TreeFocusOptions;
  readonly #typeahead: TypeaheadController;

  constructor(host: ReactiveControllerHost & HTMLElement, options: TreeFocusOptions) {
    this.#host = host;
    this.#options = options;
    this.#typeahead = new TypeaheadController({
      resetMs: options.typeaheadResetMs ?? 500,
      locale:
        options.locale ?? (() => this.#host.lang || document.documentElement.lang || undefined),
    });
    host.addController(this);
  }

  hostConnected(): void {
    // The tree's own listeners are bound in the host template; nothing to attach here.
  }

  hostUpdated(): void {
    if (this.#options.rovingTabindex) this.syncTabStops();
  }

  hostDisconnected(): void {
    this.#typeahead.reset();
  }

  /** Visible treeitems in DOM order (collapsed subtrees are not rendered). */
  get items(): HTMLElement[] {
    const tree = this.#options.tree();
    if (!tree) return [];
    return [
      ...tree.querySelectorAll<HTMLElement>(this.#options.itemSelector ?? '[role="treeitem"]'),
    ];
  }

  /** The item that currently owns the tab stop (`tabindex="0"`), if any. */
  get tabStop(): HTMLElement | null {
    return this.items.find((item) => item.getAttribute('tabindex') === '0') ?? null;
  }

  isDisabled(item: HTMLElement): boolean {
    return this.#options.isItemDisabled
      ? this.#options.isItemDisabled(item)
      : item.dataset.treeDisabled !== undefined || item.getAttribute('aria-disabled') === 'true';
  }

  #level(item: HTMLElement): number {
    return this.#options.getLevel
      ? this.#options.getLevel(item)
      : Number(item.getAttribute('aria-level') ?? '1');
  }

  #expanded(item: HTMLElement): boolean {
    return this.#options.isExpanded
      ? this.#options.isExpanded(item)
      : item.getAttribute('aria-expanded') === 'true';
  }

  #collapsed(item: HTMLElement): boolean {
    return this.#options.isCollapsed
      ? this.#options.isCollapsed(item)
      : item.getAttribute('aria-expanded') === 'false';
  }

  #id(item: HTMLElement): string | undefined {
    return this.#options.getItemId ? this.#options.getItemId(item) : item.dataset.treeId;
  }

  #label(item: HTMLElement): string {
    return this.#options.getLabel ? this.#options.getLabel(item) : (item.textContent ?? '');
  }

  // ------------------------------------------------------------------------ roving tab stop

  #setTabindex(item: HTMLElement, value: 0 | -1): void {
    if (item.getAttribute('tabindex') !== String(value))
      item.setAttribute('tabindex', String(value));
  }

  /** Makes `target` the sole tabbable item: 0 on it, -1 on every other visible item. */
  moveTabStop(target: HTMLElement): void {
    for (const item of this.items) this.#setTabindex(item, item === target ? 0 : -1);
  }

  /**
   * Repairs the roving stop: exactly one enabled item is tabbable. An existing `tabindex="0"` enabled
   * item wins (the host seeds the active one); otherwise the first enabled item is promoted.
   */
  syncTabStops(): void {
    const items = this.items;
    const enabled = items.filter((item) => !this.isDisabled(item));
    if (enabled.length === 0) {
      for (const item of items) this.#setTabindex(item, -1);
      return;
    }
    const current = enabled.find((item) => item.getAttribute('tabindex') === '0');
    this.moveTabStop(current ?? enabled[0]!);
  }

  // ------------------------------------------------------------------------------- focusing

  /** Moves focus to an item, keeping the roving stop and the active-change listener in step. */
  focusItem(item: HTMLElement | undefined | null): void {
    if (!item) return;
    if (this.#options.rovingTabindex) this.moveTabStop(item);
    this.#options.onActiveChange?.(this.#id(item), item);
    item.focus();
  }

  #focusEnabledFrom(items: HTMLElement[], start: number, step: 1 | -1): void {
    for (let i = start; i >= 0 && i < items.length; i += step) {
      const candidate = items[i]!;
      if (!this.isDisabled(candidate)) {
        this.focusItem(candidate);
        return;
      }
    }
  }

  focusFirst(): void {
    this.#focusEnabledFrom(this.items, 0, 1);
  }

  focusLast(): void {
    const items = this.items;
    this.#focusEnabledFrom(items, items.length - 1, -1);
  }

  /** The treeitem that owns focus: the nearest treeitem ancestor of the active element. */
  #currentItem(items: readonly HTMLElement[]): HTMLElement | undefined {
    const tree = this.#options.tree();
    const root = tree?.getRootNode() as Document | ShadowRoot | undefined;
    const active = root?.activeElement;
    if (!active) return undefined;
    const selector = this.#options.itemSelector ?? '[role="treeitem"]';
    const owner = active.closest(selector);
    return items.find((item) => item === owner);
  }

  // ---------------------------------------------------------------------------- handlers

  /** Keeps the roving stop pointing at whatever ended up focused (a click or a script). */
  readonly handleFocusIn = (event: FocusEvent): void => {
    if (!this.#options.rovingTabindex) return;
    const items = this.items;
    const origin = (event.composedPath()[0] ?? event.target) as Element | null;
    const owner = origin?.closest?.(this.#options.itemSelector ?? '[role="treeitem"]');
    const item = items.find((candidate) => candidate === owner);
    if (item && !this.isDisabled(item) && item.getAttribute('tabindex') !== '0') {
      this.moveTabStop(item);
      this.#options.onActiveChange?.(this.#id(item), item);
    } else {
      this.syncTabStops();
    }
  };

  readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || isImeKeyEvent(event)) return;
    const items = this.items;
    if (items.length === 0) return;

    const current = this.#currentItem(items);
    const currentIndex = current ? items.indexOf(current) : -1;

    // Typeahead: a printable character jumps to the next item whose label starts with it.
    if (
      this.#options.typeahead !== false &&
      !NAVIGATION_KEYS.has(event.key) &&
      !event.altKey &&
      this.#typeahead.isTypeaheadKey(event)
    ) {
      const found = this.#typeahead.match(
        event,
        items.map((item) => this.#label(item)),
        currentIndex,
        (index) => this.isDisabled(items[index]!),
      );
      if (found >= 0) {
        event.preventDefault();
        this.focusItem(items[found]);
      }
      return;
    }

    if (!NAVIGATION_KEYS.has(event.key) || event.ctrlKey || event.metaKey || event.altKey) return;

    // Under RTL the horizontal arrows swap, so the expand/collapse logic below reads in LTR terms.
    let key = event.key;
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const tree = this.#options.tree();
      if (tree && getComputedStyle(tree).direction === 'rtl') {
        key = key === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
      }
    }

    switch (key) {
      case 'ArrowDown':
        event.preventDefault();
        this.#focusEnabledFrom(items, currentIndex < 0 ? 0 : currentIndex + 1, 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.#focusEnabledFrom(items, currentIndex < 0 ? items.length - 1 : currentIndex - 1, -1);
        break;
      case 'ArrowRight': {
        if (!current) break;
        event.preventDefault();
        if (this.#collapsed(current)) {
          this.#toggle(current);
        } else if (this.#expanded(current)) {
          // Expanded parent: the first enabled descendant, i.e. the next visible items that are deeper.
          const level = this.#level(current);
          for (let i = currentIndex + 1; i < items.length && this.#level(items[i]!) > level; i++) {
            if (!this.isDisabled(items[i]!)) {
              this.focusItem(items[i]);
              break;
            }
          }
        }
        break;
      }
      case 'ArrowLeft': {
        if (!current) break;
        event.preventDefault();
        if (this.#expanded(current)) {
          this.#toggle(current);
        } else {
          // Move to the parent: the nearest shallower item scanning upward.
          const level = this.#level(current);
          for (let i = currentIndex - 1; i >= 0; i--) {
            const candidate = items[i]!;
            if (this.#level(candidate) < level) {
              this.focusItem(candidate);
              break;
            }
          }
        }
        break;
      }
      case 'Home':
        event.preventDefault();
        this.#focusEnabledFrom(items, 0, 1);
        break;
      case 'End':
        event.preventDefault();
        this.#focusEnabledFrom(items, items.length - 1, -1);
        break;
      case 'Enter':
      case ' ': {
        if (!current || this.isDisabled(current)) break;
        event.preventDefault();
        const id = this.#id(current);
        const handled = this.#options.onActivate
          ? this.#options.onActivate(current, id) === true
          : false;
        if (!handled && current.getAttribute('aria-expanded') !== null) this.#toggle(current);
        break;
      }
      default:
        break;
    }
  };

  #toggle(item: HTMLElement): void {
    const id = this.#id(item);
    if (id !== undefined) this.#options.onToggleExpand?.(id, item, 'keyboard');
  }
}
