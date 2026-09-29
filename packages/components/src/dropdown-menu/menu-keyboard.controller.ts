import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {RovingTabindexController} from '@tecton-astryx/core/controllers/roving-tabindex.js';
import {TypeaheadController} from '@tecton-astryx/core/controllers/typeahead.js';
import {isImeKeyEvent} from '@tecton-astryx/core/utils/ime.js';
import {isSubMenu, itemContaining, type MenuItemElement} from './menu-items.js';

export interface MenuKeyboardOptions {
  /** The `role="menu"` element of this level: it holds focus after a pointer open. */
  surface: () => HTMLElement | null;
  /** The rows of this level (DOM order, disabled ones included). */
  items: () => MenuItemElement[];
  /** Tab was pressed inside this level: end the whole menu (APG menu button). */
  onTab: (event: KeyboardEvent) => void;
}

/**
 * The keyboard contract of ONE menu level, shared by `tct-dropdown-menu`, `tct-context-menu` and the
 * flyout of `tct-dropdown-menu-sub-menu` (upstream `useListFocus` + `useTypeahead`):
 *
 *  - roving tabindex over the rows, vertical, no wrap, Home/End. **Disabled rows stay focusable**
 *    (`focusDisabled`): the APG menu pattern, so keyboard and screen-reader users discover them
 *    (upstream skips them; recorded as an accessibility improvement);
 *  - Enter and Space activate the focused row through its own `click()`, so activation is one code path
 *    and fires once whatever started it;
 *  - first-character typeahead over the enabled rows, locale-aware;
 *  - Tab closes the menu without being cancelled, so focus continues from the trigger;
 *  - after a pointer open the surface itself holds focus (no row reads as pre-selected): the first
 *    arrow key moves into the rows.
 *
 * A key belongs to a level only when it was pressed on that level's surface or rows, never inside a
 * submenu row's flyout: nested levels are inline in the tree, so their key events bubble through the
 * parents, and each level ignores what is not its own (`ownsEvent`, upstream `useListFocus`).
 * Escape is not handled here: the layer stack sends it to the top-most layer, one press per level.
 * Guides: [mwg:accessibility] [mwg:spatial-navigation]
 */
export class MenuKeyboardController implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #options: MenuKeyboardOptions;
  readonly #typeahead: TypeaheadController;
  readonly roving: RovingTabindexController<MenuItemElement>;

  constructor(host: ReactiveControllerHost & HTMLElement, options: MenuKeyboardOptions) {
    this.#host = host;
    this.#options = options;
    this.#typeahead = new TypeaheadController({
      locale: () => this.#host.lang || document.documentElement.lang || undefined,
    });
    this.roving = new RovingTabindexController<MenuItemElement>(host, {
      items: () => options.items(),
      orientation: 'vertical',
      wrap: false,
      homeEnd: true,
      focusDisabled: true,
      // Keys pressed inside a submenu's flyout belong to the flyout's own level.
      boundary: (item) => isSubMenu(item),
      // Space/Enter on a custom (non-native) row: activate through the row's own click.
      onActivate: (item) => {
        item.click();
      },
    });
    host.addController(this);
  }

  /** The row that is the tab stop. */
  get active(): MenuItemElement | null {
    return this.roving.active;
  }

  hostConnected(): void {
    this.#host.addEventListener('keydown', this.#onKeyDown);
  }

  hostDisconnected(): void {
    this.#host.removeEventListener('keydown', this.#onKeyDown);
    this.#typeahead.reset();
  }

  /** Forgets a half-typed search (on close). */
  reset(): void {
    this.#typeahead.reset();
  }

  /** The first row that is not disabled, else `null`. */
  firstEnabled(): MenuItemElement | null {
    return this.#options.items().find((item) => !item.disabled) ?? null;
  }

  /** The last row that is not disabled, else `null`. */
  lastEnabled(): MenuItemElement | null {
    return this.#options.items().findLast((item) => !item.disabled) ?? null;
  }

  /** Focuses the first enabled row (keyboard opens). `false` when there is none. */
  focusFirst(): boolean {
    const item = this.firstEnabled();
    if (!item) return false;
    this.roving.setActive(item, {focus: true});
    return true;
  }

  /** Focuses the last enabled row. `false` when there is none. */
  focusLast(): boolean {
    const item = this.lastEnabled();
    if (!item) return false;
    this.roving.setActive(item, {focus: true});
    return true;
  }

  /** Focuses `item` and makes it the tab stop. */
  focusItem(item: MenuItemElement, options: FocusOptions = {}): void {
    this.roving.setActive(item);
    item.focus(options);
  }

  /** Focuses the surface itself: a pointer open, or a flyout with nothing to focus yet. */
  focusSurface(options: FocusOptions = {}): void {
    this.#options.surface()?.focus(options);
  }

  /** First row, else the surface (an empty or still loading menu must still own the keyboard). */
  focusFirstOrSurface(): void {
    if (!this.focusFirst()) this.focusSurface();
  }

  /** Whether an event started on this level's surface or rows, not inside a nested flyout. */
  owns(origin: EventTarget | null): boolean {
    const surface = this.#options.surface();
    if (origin === surface) return true;
    const item = itemContaining(this.#options.items(), origin);
    if (!item) return false;
    return !isSubMenu(item) || origin === item;
  }

  // ---------------------------------------------------------------------------------- internals

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || isImeKeyEvent(event)) return;
    const origin = event.composedPath()[0] ?? event.target;
    if (!this.owns(origin)) return;

    if (event.key === 'Tab') {
      // Not cancelled: closing puts focus back on the trigger, and the browser's Tab continues from there.
      this.#options.onTab(event);
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey) return;

    // The surface holds focus after a pointer open: the first arrow key enters the rows.
    if (origin === this.#options.surface()) {
      const entered =
        event.key === 'ArrowDown' || event.key === 'Home'
          ? this.focusFirst()
          : event.key === 'ArrowUp' || event.key === 'End'
            ? this.focusLast()
            : false;
      if (entered) event.preventDefault();
      else if (this.#typeahead.isTypeaheadKey(event)) this.#typeaheadFrom(event, -1);
      return;
    }

    if (this.#typeahead.isTypeaheadKey(event)) {
      const items = this.#options.items();
      this.#typeaheadFrom(event, items.indexOf(itemContaining(items, origin) as MenuItemElement));
    }
  };

  /** Type-to-focus over the enabled rows (upstream skips disabled rows for typeahead). */
  #typeaheadFrom(event: KeyboardEvent, currentIndex: number): void {
    const items = this.#options.items();
    // A lone Space is activation, not typing: `isTypeaheadKey` already refuses it without a buffer.
    event.preventDefault();
    const found = this.#typeahead.match(
      event,
      items.map((item) => item.menuLabel),
      currentIndex,
      (index) => items[index]?.disabled ?? true,
    );
    const item = found >= 0 ? items[found] : undefined;
    if (item) this.focusItem(item);
  }
}
