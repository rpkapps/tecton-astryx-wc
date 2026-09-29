import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {
  INDICATOR_SIZES,
  SINGLE_SELECTION_STATES,
  type IndicatorSize,
  type SingleSelectionState,
} from './indicator.types.js';
import styles from './tct-radio-indicator.styles.css';

/**
 * The radio visual: a circle with a filled inner dot when selected. It draws in both states (an
 * unselected radio is an empty circle, which is what lets it stand in for a check mark in a selection
 * slot). Decorative: `aria-hidden`, with no role, focus or keyboard behaviour of its own; the control
 * that renders it keeps those. Content in the default slot replaces the dot and keeps the circle.
 *
 * @summary The radio circle with a dot when selected.
 * @tag tct-radio-indicator
 * @upstream RadioIndicator
 * @slot - Content drawn inside the circle instead of the dot (a spinner while pending).
 * @csspart radio-indicator - The circle (Astryx target `astryx-radio-indicator`; the deprecated `radio` name is also set).
 * @csspart radio-indicator-dot - The inner dot (Astryx target `astryx-radio-indicator-dot`; the deprecated `radio-dot` name is also set).
 * @cssstate checked - The state is `checked`.
 * @cssstate disabled - The owner is disabled.
 * @cloakDisplay inline-flex
 */
export class TctRadioIndicator extends TctElement {
  static override readonly tagName = 'tct-radio-indicator';
  static override styles: CSSResultGroup = [base, styles];

  /** Which state to draw: `unchecked` or `checked`. A radio has no partial state. */
  @property({reflect: true}) state: SingleSelectionState = 'unchecked';

  /** Control size: a 24px (`md`, default) or 20px (`sm`) circle. */
  @property({reflect: true}) size: IndicatorSize = 'md';

  /** Whether the owning control is disabled. Purely visual; the owner keeps the real disabled semantics. */
  @property({type: Boolean, reflect: true}) disabled = false;

  readonly #slots = new SlotController(this, 'default');

  protected override willUpdate(changed: PropertyValues<this>): void {
    // Decorative by contract: hidden from assistive technology whatever the author writes on the host.
    this.internals.ariaHidden = 'true';
    if (changed.has('state') && !SINGLE_SELECTION_STATES.includes(this.state)) {
      devWarn(
        `radio-indicator:state:${this.state}`,
        `<tct-radio-indicator state="${this.state}"> is not one of ${SINGLE_SELECTION_STATES.join(', ')}.`,
      );
    }
    if (changed.has('size') && !INDICATOR_SIZES.includes(this.size)) {
      devWarn(
        `radio-indicator:size:${this.size}`,
        `<tct-radio-indicator size="${this.size}"> is not one of ${INDICATOR_SIZES.join(', ')}.`,
      );
    }
  }

  protected override updated(): void {
    this.toggleState('checked', this.#isChecked);
    this.toggleState('disabled', this.disabled);
  }

  /** A radio has no partial state: anything other than `unchecked` reads as selected (upstream). */
  get #isChecked(): boolean {
    return this.state !== 'unchecked';
  }

  protected override render(): TemplateResult {
    const size = INDICATOR_SIZES.includes(this.size) ? this.size : 'md';
    return html`<span
      class="circle"
      part="radio-indicator radio"
      aria-hidden="true"
      data-state=${this.#isChecked ? 'checked' : 'unchecked'}
      data-size=${size}
      ?data-disabled=${this.disabled}
      ?data-slotted=${this.#slots.has('default')}
    >
      <slot></slot>
      <span class="dot" part="radio-indicator-dot radio-dot"></span>
    </span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-radio-indicator': TctRadioIndicator;
  }
}
