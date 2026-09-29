import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {
  INDICATOR_SIZES,
  MULTI_SELECTION_STATES,
  type IndicatorSize,
  type MultiSelectionState,
} from './indicator.types.js';
import styles from './tct-checkbox-indicator.styles.css';

/**
 * The checkbox visual: a square box with a check mark or an indeterminate bar. It draws in every
 * state (an unchecked box is an empty box, not nothing). Decorative: the box is `aria-hidden` and owns
 * no role, focus or keyboard behaviour; the control that renders it keeps the input, the accessible
 * name and the focus ring. Content in the default slot replaces the state mark and keeps the box (a
 * pending spinner while a change action runs).
 *
 * Hover and focus reach the indicator from its owner, not from props: an owner adds the
 * `indicator-scope` class from `indicatorScope` (`@tecton-astryx/core/indicators/registry.js`) to the
 * element whose hover should tint the box, and adds it only while enabled.
 *
 * @summary The checkbox box: checked, unchecked and indeterminate.
 * @tag tct-checkbox-indicator
 * @upstream CheckboxIndicator
 * @slot - Content drawn inside the box instead of the state mark (a spinner while pending).
 * @csspart checkbox-indicator - The box (Astryx target `astryx-checkbox-indicator`; the deprecated `checkbox` name is also set).
 * @csspart checkbox-indicator-check - The check mark (Astryx target `astryx-checkbox-indicator-check`).
 * @csspart checkbox-indicator-dash - The indeterminate bar (Astryx target `astryx-checkbox-indicator-dash`).
 * @cssstate checked - The state is `checked`.
 * @cssstate indeterminate - The state is `indeterminate`.
 * @cssstate disabled - The owner is disabled.
 * @cloakDisplay inline-flex
 */
export class TctCheckboxIndicator extends TctElement {
  static override readonly tagName = 'tct-checkbox-indicator';
  static override styles: CSSResultGroup = [base, styles];

  /** Which state to draw: `unchecked`, `checked` or `indeterminate`. */
  @property({reflect: true}) state: MultiSelectionState = 'unchecked';

  /** Control size: a 24px (`md`, default) or 20px (`sm`) box. */
  @property({reflect: true}) size: IndicatorSize = 'md';

  /** Whether the owning control is disabled. Purely visual; the owner keeps the real disabled semantics. */
  @property({type: Boolean, reflect: true}) disabled = false;

  readonly #slots = new SlotController(this, 'default');

  protected override willUpdate(changed: PropertyValues<this>): void {
    // Decorative by contract: hidden from assistive technology whatever the author writes on the host.
    this.internals.ariaHidden = 'true';
    if (changed.has('state') && !MULTI_SELECTION_STATES.includes(this.state)) {
      devWarn(
        `checkbox-indicator:state:${this.state}`,
        `<tct-checkbox-indicator state="${this.state}"> is not one of ${MULTI_SELECTION_STATES.join(', ')}.`,
      );
    }
    if (changed.has('size') && !INDICATOR_SIZES.includes(this.size)) {
      devWarn(
        `checkbox-indicator:size:${this.size}`,
        `<tct-checkbox-indicator size="${this.size}"> is not one of ${INDICATOR_SIZES.join(', ')}.`,
      );
    }
  }

  protected override updated(): void {
    this.toggleState('checked', this.state === 'checked');
    this.toggleState('indeterminate', this.state === 'indeterminate');
    this.toggleState('disabled', this.disabled);
  }

  protected override render(): TemplateResult {
    const state = MULTI_SELECTION_STATES.includes(this.state) ? this.state : 'unchecked';
    const size = INDICATOR_SIZES.includes(this.size) ? this.size : 'md';
    return html`<span
      class="box"
      part="checkbox-indicator checkbox"
      aria-hidden="true"
      data-state=${state}
      data-size=${size}
      ?data-disabled=${this.disabled}
      ?data-slotted=${this.#slots.has('default')}
    >
      <slot></slot>
      <svg class="check" part="checkbox-indicator-check" viewBox="0 0 10 10" focusable="false">
        <path
          d="M8.5 2.5L4 7.5L1.5 5"
          stroke="currentColor"
          stroke-width="1.5"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="dash" part="checkbox-indicator-dash"></span>
    </span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-checkbox-indicator': TctCheckboxIndicator;
  }
}
