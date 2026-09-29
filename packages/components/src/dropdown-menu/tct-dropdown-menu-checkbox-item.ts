import {html, type CSSResultGroup} from 'lit';
import {property} from 'lit/decorators.js';
import {TctValueChangeEvent} from '@tecton-wc/core/events/tct-value-change.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {TctCheckboxIndicator} from '../indicator/tct-checkbox-indicator.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctItem} from '../item/tct-item.js';
import base from '../styles/base.styles.css';
import {MenuItemController} from './menu-item.controller.js';
import styles from './tct-menu-item.styles.css';

/**
 * A checkable row of a menu (`role="menuitemcheckbox"`): toggles an independent boolean. Activating it
 * (click, Enter or Space) asks to flip `checked`: the cancelable `tct-value-change` fires first, and the
 * state changes unless it is prevented, so a controlled use sets `checked` itself. Unlike an action row
 * it keeps the menu open by default, so several can be toggled in one session; `close-on-select`
 * closes it.
 *
 * The checkbox drawn in the row is decorative (`aria-hidden`): the row is the one announced control,
 * with `aria-checked`. On a coarse pointer the box moves to the inline end of the row.
 *
 * @summary A checkable row of a menu.
 * @tag tct-dropdown-menu-checkbox-item
 * @upstream DropdownMenuCheckboxItem
 * @slot label - Rich label; overrides the `label` attribute.
 * @slot description - Rich description; overrides the `description` attribute.
 * @slot icon - Custom leading icon; overrides the `icon` attribute.
 * @slot end - Trailing content: a keyboard-shortcut hint or a badge.
 * @csspart item - The painted row (upstream theming target `dropdown-menu-item`).
 * @csspart dropdown-menu-item - The painted row, under the upstream target name.
 * @cssstate checked - The row is checked.
 * @cssstate disabled - The row cannot be activated.
 * @fires {TctValueChangeEvent<boolean>} tct-value-change - Before activation flips `checked`; cancelable. `value` is the requested state.
 * @fires click - Native click, once per activation. Not fired while `disabled`.
 * @cloakDisplay block
 */
export class TctDropdownMenuCheckboxItem extends TctElement {
  static override readonly tagName = 'tct-dropdown-menu-checkbox-item';
  static override readonly dependencies = [TctItem, TctIcon, TctCheckboxIndicator];
  static override styles: CSSResultGroup = [base, styles];

  /** Primary text. Rich content goes through `slot="label"`. */
  @property() label = '';

  /** Secondary text below the label. Rich content goes through `slot="description"`. */
  @property() description = '';

  /** Registered icon name shown before the label (or slot your own into `icon`). */
  @property() icon = '';

  /**
   * Whether the row is checked (upstream `value`). The element owns the state: user activation flips it
   * after the cancelable `tct-value-change`. Property and attribute writes never emit events.
   */
  @property({type: Boolean, reflect: true}) checked = false;

  /** Disables the row. It stays focusable (announced as unavailable); activation is blocked. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** Closes the menu when the row is toggled (upstream `hasCloseOnSelect`, default `false` here: checkbox rows keep the menu open). */
  @property({type: Boolean, attribute: 'close-on-select'}) closeOnSelect = false;

  readonly #item: MenuItemController = new MenuItemController(this, {
    closeOnSelect: () => this.closeOnSelect,
    activate: () => {
      const next = !this.checked;
      if (this.dispatch(new TctValueChangeEvent<boolean>(next, this.checked, 'selection'))) {
        this.checked = next;
      }
    },
  });

  /** The row's text, as typeahead and assistive technology see it. */
  get menuLabel(): string {
    return this.#item.menuLabel;
  }

  constructor() {
    super();
    this.internals.role = 'menuitemcheckbox';
  }

  protected override willUpdate(): void {
    this.internals.ariaChecked = this.checked ? 'true' : 'false';
    this.internals.ariaDisabled = this.disabled ? 'true' : null;
  }

  protected override updated(): void {
    this.toggleState('checked', this.checked);
    this.toggleState('disabled', this.disabled);
  }

  protected override render() {
    const marker = html`<tct-checkbox-indicator
      slot="marker"
      state=${this.checked ? 'checked' : 'unchecked'}
      size=${this.#item.size === 'sm' ? 'sm' : 'md'}
      ?disabled=${this.disabled}
    ></tct-checkbox-indicator>`;
    return html`${this.#item.renderRow({marker})}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-dropdown-menu-checkbox-item': TctDropdownMenuCheckboxItem;
  }
}
