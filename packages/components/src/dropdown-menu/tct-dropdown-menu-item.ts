import {html, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctItem} from '../item/tct-item.js';
import base from '../styles/base.styles.css';
import {MENU_ITEM_VARIANTS, type MenuItemVariant} from './dropdown-menu.types.js';
import {MenuItemController} from './menu-item.controller.js';
import styles from './tct-menu-item.styles.css';

/**
 * An action row of a menu: icon, label, description and trailing content. Activating it (click, Enter
 * or Space) fires one native `click` on the row and, unless `no-close-on-select` is set, closes the
 * menu. Serves every menu: the upstream `ContextMenuItem` and `BreadcrumbMenuItem` aliases are this tag
 * inside `tct-context-menu` and the breadcrumb menu.
 *
 * The row is the semantic node (`role="menuitem"` through `ElementInternals`) and the focus owner: the
 * menu's roving tabindex writes `tabindex` on it. A disabled row is announced as unavailable
 * (`aria-disabled`) and stays focusable so it is discoverable, but swallows activation: no `click`
 * reaches any listener.
 *
 * @summary An action row of a menu.
 * @tag tct-dropdown-menu-item
 * @upstream DropdownMenuItem
 * @slot label - Rich label; overrides the `label` attribute.
 * @slot description - Rich description; overrides the `description` attribute.
 * @slot icon - Custom leading icon; overrides the `icon` attribute.
 * @slot end - Trailing content: a keyboard-shortcut hint or a badge.
 * @csspart item - The painted row (upstream theming target `dropdown-menu-item`).
 * @csspart dropdown-menu-item - The painted row, under the upstream target name.
 * @cssstate disabled - The row cannot be activated.
 * @fires click - Native click, once per activation (pointer, Enter or Space). Not fired while `disabled`.
 * @cloakDisplay block
 */
export class TctDropdownMenuItem extends TctElement {
  static override readonly tagName = 'tct-dropdown-menu-item';
  static override readonly dependencies = [TctItem, TctIcon];
  static override styles: CSSResultGroup = [base, styles];

  /** Primary text. Rich content goes through `slot="label"`. */
  @property() label = '';

  /** Secondary text below the label. Rich content goes through `slot="description"`. */
  @property() description = '';

  /** Registered icon name shown before the label (or slot your own into `icon`). */
  @property() icon = '';

  /**
   * Disables the row. It stays focusable (announced as unavailable) so keyboard and screen-reader users
   * discover it; activation is blocked.
   */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** `destructive` renders the icon and text in the error colour, for dangerous actions (Delete). */
  @property({reflect: true}) variant: MenuItemVariant = 'default';

  /** Keeps the menu open after activation, for a row that reports its result on itself (a copy row that swaps to "Copied"). */
  @property({type: Boolean, attribute: 'no-close-on-select'}) noCloseOnSelect = false;

  readonly #item: MenuItemController = new MenuItemController(this, {
    closeOnSelect: () => !this.noCloseOnSelect,
    destructive: () => this.variant === 'destructive',
  });

  /** The row's text, as typeahead and assistive technology see it. */
  get menuLabel(): string {
    return this.#item.menuLabel;
  }

  constructor() {
    super();
    this.internals.role = 'menuitem';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    this.internals.ariaDisabled = this.disabled ? 'true' : null;
    if (changed.has('variant') && !MENU_ITEM_VARIANTS.includes(this.variant)) {
      devWarn(
        `dropdown-menu-item:variant:${this.variant}`,
        `<tct-dropdown-menu-item variant="${this.variant}"> is not one of ${MENU_ITEM_VARIANTS.join(', ')}.`,
      );
    }
  }

  protected override updated(): void {
    this.toggleState('disabled', this.disabled);
  }

  protected override render() {
    return html`${this.#item.renderRow()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-dropdown-menu-item': TctDropdownMenuItem;
  }
}
