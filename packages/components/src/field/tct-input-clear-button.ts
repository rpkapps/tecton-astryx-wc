import {html, type CSSResultGroup} from 'lit';
import {property} from 'lit/decorators.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctTooltip} from '../tooltip/tct-tooltip.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import styles from './tct-input-clear-button.styles.css';

/**
 * The clear (x) button inside a text control: every input that offers a clear affordance renders this
 * one. It is a real button with a contextual accessible name ("Clear Search") and the same text as a
 * tooltip. It keeps focus in the input: pressing it does not take focus, so the input never blurs (and
 * never commits a `change`) just because the user cleared it.
 *
 * The button only reports the press (the native `click`, retargeted from the inner button); the control
 * that owns it clears the value, fires `tct-clear` and returns focus.
 *
 * @summary Clear button used inside input chrome.
 * @tag tct-input-clear-button
 * @upstream InputClearButton
 * @csspart button - The button (Astryx target `astryx-input-clear-button`).
 * @csspart icon - The close glyph (Astryx target `astryx-input-clear-icon`).
 * @fires click - Native, retargeted from the inner button.
 * @cloakDisplay inline-flex
 */
export class TctInputClearButton extends TctElement {
  static override readonly tagName = 'tct-input-clear-button';
  static override readonly dependencies = [TctIcon, TctTooltip];
  static override shadowRootOptions = {...TctElement.shadowRootOptions, delegatesFocus: true};
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /** Accessible name and tooltip of the button, contextual, such as "Clear Search". */
  @property() label = '';

  override render() {
    return html`<tct-tooltip content=${this.label} placement="above"
      ><button
        type="button"
        class="button focus-ring"
        part="button"
        aria-label=${this.label}
        @pointerdown=${this.#keepFocus}
        @mousedown=${this.#keepFocus}
      >
        <tct-icon part="icon" name="close" size="sm" color="secondary"></tct-icon></button
    ></tct-tooltip>`;
  }

  /** Pressing must not move focus off the input the button belongs to. */
  readonly #keepFocus = (event: Event): void => {
    event.preventDefault();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-input-clear-button': TctInputClearButton;
  }
}
