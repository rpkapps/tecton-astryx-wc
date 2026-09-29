import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {ContextConsumer, ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {RovingTabindexController} from '@tecton-wc/core/controllers/roving-tabindex.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {isImeKeyEvent} from '@tecton-wc/core/utils/ime.js';
import base from '../styles/base.styles.css';
import {
  navHeadingCloseContext,
  navHeadingMenuContext,
  type NavHeadingMenuContextValue,
} from './nav-heading-menu.context.js';
import {NAV_HEADING_MENU_SIZES, type NavHeadingMenuSize} from './nav-heading-menu.types.js';
import styles from './tct-nav-heading-menu.styles.css';
import type {TctNavHeadingMenuItem} from './tct-nav-heading-menu-item.js';

/**
 * The menu inside a navigation heading's popover (`tct-side-nav-heading`, `tct-top-nav-heading`): a
 * `role="menu"` of `tct-nav-heading-menu-item` rows. The heading provides a close callback through
 * `navHeadingCloseContext`, so choosing a row or pressing Escape dismisses the popover; used on its own
 * the menu closes nothing.
 *
 * It is one roving group: ArrowDown and ArrowUp move focus between the enabled rows (wrapping), Home and
 * End jump to the ends, typing a character jumps to the next row whose label starts with it, Enter and
 * Space activate the focused row, and Escape asks the heading to close. `size` sets the minimum width (160,
 * 200, 240 px) and the padding of the rows; `min-width` overrides the width.
 *
 * @summary The accessible menu of a navigation heading popover.
 * @tag tct-nav-heading-menu
 * @upstream NavHeadingMenu
 * @slot - `tct-nav-heading-menu-item` rows (and dividers or custom content).
 * @csspart menu - The painted menu box (upstream theming target `nav-heading-menu`).
 * @cloakDisplay block
 */
export class TctNavHeadingMenu extends TctElement {
  static override readonly tagName = 'tct-nav-heading-menu';
  static override styles: CSSResultGroup = [base, styles];

  /** Sets the minimum width (`sm` 160px, `md` 200px, `lg` 240px) and the padding of the rows. */
  @property({reflect: true}) size: NavHeadingMenuSize = 'md';

  /** Minimum width, overriding the size's: a number is px, a string any CSS length (`16rem`). */
  @property({attribute: 'min-width'}) minWidth: string | undefined;

  readonly #close: ContextConsumer<typeof navHeadingCloseContext> = new ContextConsumer<
    typeof navHeadingCloseContext
  >(this, {context: navHeadingCloseContext, subscribe: true});

  /** What the rows read: size and a close that is safe outside a heading popover. */
  readonly #closeMenu = (): void => {
    this.#close.value?.closeMenu();
  };

  readonly #provider: ContextProvider<typeof navHeadingMenuContext> = new ContextProvider<
    typeof navHeadingMenuContext
  >(this, {
    context: navHeadingMenuContext,
    initialValue: {size: 'md', closeMenu: this.#closeMenu},
  });
  #lastContext: NavHeadingMenuContextValue | undefined;

  readonly #roving: RovingTabindexController<TctNavHeadingMenuItem> =
    new RovingTabindexController<TctNavHeadingMenuItem>(this, {
      items: () => this.#items(),
      orientation: 'vertical',
      wrap: true,
      homeEnd: true,
      isDisabled: (item) => item.disabled,
      // The row's focus target is its inner menuitem, never the host (tabindex on a shadow host hides its subtree).
      focusTarget: (item) => item.control,
      typeahead: (item) => item.menuLabel,
      // Space (and Enter on a non-native row): activate through the row's own click.
      onActivate: (item) => {
        item.control?.click();
      },
    });

  constructor() {
    super();
    this.internals.role = 'menu';
    this.addEventListener('keydown', this.#onKeyDown);
  }

  #items(): TctNavHeadingMenuItem[] {
    return [...this.children].filter(
      (child): child is TctNavHeadingMenuItem => child.localName === 'tct-nav-heading-menu-item',
    );
  }

  /** Focuses the first enabled row (a heading popover calls it when it opens by keyboard). */
  focusFirst(): boolean {
    const first = this.#items().find((item) => !item.disabled);
    if (!first) return false;
    this.#roving.setActive(first, {focus: true});
    return true;
  }

  /** Focuses the last enabled row. */
  focusLast(): boolean {
    const last = this.#items().findLast((item) => !item.disabled);
    if (!last) return false;
    this.#roving.setActive(last, {focus: true});
    return true;
  }

  #contextValue(): NavHeadingMenuContextValue {
    const size = NAV_HEADING_MENU_SIZES.includes(this.size) ? this.size : 'md';
    const last = this.#lastContext;
    if (last?.size === size) return last;
    this.#lastContext = {size, closeMenu: this.#closeMenu};
    return this.#lastContext;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('size') && !NAV_HEADING_MENU_SIZES.includes(this.size)) {
      devWarn(
        `nav-heading-menu:size:${this.size}`,
        `<tct-nav-heading-menu size="${this.size}"> is not one of ${NAV_HEADING_MENU_SIZES.join(', ')}; using "md".`,
      );
    }
    this.#provider.setValue(this.#contextValue());
  }

  protected override updated(): void {
    void this.#settle();
  }

  /** Rows render after the menu does; once they have, they can take `tabindex`. */
  async #settle(): Promise<void> {
    await Promise.all(this.#items().map((item) => item.updateComplete));
    this.#roving.update();
  }

  /** Escape asks the heading's popover to close (its own layer also handles it: closing twice is harmless). */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.defaultPrevented || isImeKeyEvent(event)) return;
    this.#close.value?.closeMenu();
  };

  #minWidth(): Record<string, string | undefined> {
    const raw = this.minWidth?.trim();
    if (!raw) return {};
    return {'--_min-inline-size': /^\d+(\.\d+)?$/.test(raw) ? `${raw}px` : raw};
  }

  override render(): TemplateResult {
    return html`<div
      class="menu"
      part="menu"
      data-size=${NAV_HEADING_MENU_SIZES.includes(this.size) ? this.size : 'md'}
      style=${styleMap(this.#minWidth())}
    >
      <slot @slotchange=${() => void this.#settle()}></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-nav-heading-menu': TctNavHeadingMenu;
  }
}
