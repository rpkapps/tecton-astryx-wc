import {html, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import type {ChangeReason} from '@tecton-astryx/core/events/tct-event.js';
import {TctValueChangeEvent} from '@tecton-astryx/core/events/tct-value-change.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {
  dropdownMenuRadioGroupContext,
  type DropdownMenuRadioGroupContextValue,
} from './dropdown-menu.context.js';
import styles from './tct-dropdown-menu-radio-group.styles.css';

/**
 * A named single-choice set of radio rows inside a menu: `role="group"` of `menuitemradio` rows. It owns
 * the selected `value`; choosing a row asks to change it through the cancelable `tct-value-change`, and
 * the value changes unless that is prevented (a controlled use sets `value` itself). Choosing a row is a
 * single-choice commit, so by default it also closes the menu; `no-close-on-select` keeps it open.
 *
 * `label` is required: an unnamed radio group is an accessibility defect, and it names the group for
 * screen readers ("Sort by").
 *
 * @summary A named group of radio rows in a menu.
 * @tag tct-dropdown-menu-radio-group
 * @upstream DropdownMenuRadioGroup
 * @slot - The `tct-dropdown-menu-radio-item` rows.
 * @fires {TctValueChangeEvent<string>} tct-value-change - Before a user choice changes `value`; cancelable. `value` is the requested value.
 * @cloakDisplay flex
 */
export class TctDropdownMenuRadioGroup extends TctElement {
  static override readonly tagName = 'tct-dropdown-menu-radio-group';
  static override styles: CSSResultGroup = [base, styles];

  /** Accessible name of the group, announced before its rows. Required. */
  @property() label = '';

  /**
   * The selected value (matched against each row's `value`); unset when nothing is selected. The
   * attribute is the initial value, the property the current one. Property writes never emit events.
   */
  @property() value: string | undefined;

  /** Keeps the menu open after a row is chosen (upstream `hasCloseOnSelect=false`). */
  @property({type: Boolean, attribute: 'no-close-on-select'}) noCloseOnSelect = false;

  readonly #provider = new ContextProvider(this, {
    context: dropdownMenuRadioGroupContext,
    initialValue: this.#contextValue(),
  });

  constructor() {
    super();
    this.internals.role = 'group';
  }

  #contextValue(): DropdownMenuRadioGroupContextValue {
    return {
      value: this.value,
      closeOnSelect: !this.noCloseOnSelect,
      select: (value, reason) => {
        this.#select(value, reason);
      },
    };
  }

  /** A row was activated: choosing another value asks first, choosing the current one changes nothing. */
  #select(value: string, reason: ChangeReason): void {
    if (value === this.value) return;
    if (this.dispatch(new TctValueChangeEvent<string>(value, this.value, reason))) {
      this.value = value;
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    this.internals.ariaLabel = this.label || null;
    if (changed.has('label') && this.label === '') {
      devWarn(
        'dropdown-menu-radio-group:label',
        '<tct-dropdown-menu-radio-group> needs a `label`: an unnamed radio group is an accessibility defect.',
      );
    }
    const current = this.#provider.value;
    if (!current || current.value !== this.value || current.closeOnSelect === this.noCloseOnSelect) {
      this.#provider.setValue(this.#contextValue());
    }
  }

  protected override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-dropdown-menu-radio-group': TctDropdownMenuRadioGroup;
  }
}
