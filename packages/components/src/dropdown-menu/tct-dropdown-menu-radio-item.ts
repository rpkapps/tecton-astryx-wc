import {html, type CSSResultGroup} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {TctRadioIndicator} from '../indicator/tct-radio-indicator.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctItem} from '../item/tct-item.js';
import base from '../styles/base.styles.css';
import {dropdownMenuRadioGroupContext} from './dropdown-menu.context.js';
import {MenuItemController} from './menu-item.controller.js';
import styles from './tct-menu-item.styles.css';

/**
 * One option of a `tct-dropdown-menu-radio-group` (`role="menuitemradio"`, with `aria-checked`). It is
 * checked when the group's `value` equals its own `value`. Choosing it asks the group to change value
 * and, by the group's setting, closes the menu. It must be a child of a radio group: outside one it
 * cannot be chosen and a warning is logged in development.
 *
 * The radio circle drawn in the row is decorative (`aria-hidden`); the row is the one announced control.
 * On a coarse pointer the circle moves to the inline end of the row.
 *
 * @summary One option of a radio group in a menu.
 * @tag tct-dropdown-menu-radio-item
 * @upstream DropdownMenuRadioItem
 * @slot label - Rich label; overrides the `label` attribute.
 * @slot description - Rich description; overrides the `description` attribute.
 * @slot icon - Custom leading icon; overrides the `icon` attribute.
 * @slot end - Trailing content: a badge or metadata.
 * @csspart item - The painted row (upstream theming target `dropdown-menu-item`).
 * @csspart dropdown-menu-item - The painted row, under the upstream target name.
 * @cssstate checked - This option is the group's value.
 * @cssstate disabled - The row cannot be chosen.
 * @fires click - Native click, once per activation. Not fired while `disabled`.
 * @cloakDisplay block
 */
export class TctDropdownMenuRadioItem extends TctElement {
  static override readonly tagName = 'tct-dropdown-menu-radio-item';
  static override readonly dependencies = [TctItem, TctIcon, TctRadioIndicator];
  static override styles: CSSResultGroup = [base, styles];

  /** The value this option stands for; compared with the group's `value`. Required. */
  @property() value = '';

  /** Primary text. Rich content goes through `slot="label"`. */
  @property() label = '';

  /** Secondary text below the label. Rich content goes through `slot="description"`. */
  @property() description = '';

  /** Registered icon name shown before the label (or slot your own into `icon`). */
  @property() icon = '';

  /** Disables this option. It stays focusable (announced as unavailable); choosing it is blocked. */
  @property({type: Boolean, reflect: true}) disabled = false;

  readonly #group: ContextConsumer<typeof dropdownMenuRadioGroupContext> = new ContextConsumer<
    typeof dropdownMenuRadioGroupContext
  >(this, {
    context: dropdownMenuRadioGroupContext,
    subscribe: true,
  });

  readonly #item: MenuItemController = new MenuItemController(this, {
    closeOnSelect: () => this.#group.value?.closeOnSelect ?? false,
    activate: () => {
      this.#group.value?.select(this.value, 'selection');
    },
  });

  /** Whether this option is the group's value (false outside a group). */
  get checked(): boolean {
    const group = this.#group.value;
    return group ? group.value === this.value : false;
  }

  /** The row's text, as typeahead and assistive technology see it. */
  get menuLabel(): string {
    return this.#item.menuLabel;
  }

  constructor() {
    super();
    this.internals.role = 'menuitemradio';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // The group answers the context request synchronously when it is already defined; a group that
    // upgrades later re-announces itself, so the check waits a frame.
    void this.updateComplete.then(() => {
      if (this.isConnected && !this.#group.value) {
        devWarn(
          'dropdown-menu-radio-item:group',
          '<tct-dropdown-menu-radio-item> must be inside a <tct-dropdown-menu-radio-group>.',
        );
      }
    });
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
    const marker = html`<tct-radio-indicator
      slot="marker"
      state=${this.checked ? 'checked' : 'unchecked'}
      size=${this.#item.size === 'sm' ? 'sm' : 'md'}
      ?disabled=${this.disabled}
    ></tct-radio-indicator>`;
    return html`${this.#item.renderRow({marker})}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-dropdown-menu-radio-item': TctDropdownMenuRadioItem;
  }
}
