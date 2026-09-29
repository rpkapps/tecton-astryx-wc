import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {TctIcon} from '../icon/tct-icon.js';
import base from '../styles/base.styles.css';
import {
  INDICATOR_SIZES,
  SINGLE_SELECTION_STATES,
  type IndicatorSize,
  type SingleSelectionState,
} from './indicator.types.js';
import styles from './tct-check-indicator.styles.css';

/**
 * The mark on a chosen option: a check mark by default, and nothing at all when unchosen, so a
 * listbox shows no empty box beside every row. This is the indicator to replace to change what
 * "chosen" looks like: mapping `check` to `tct-radio-indicator` (`defineIndicators`) gives every
 * single-selection mark radio visuals, including an empty circle on unchosen rows.
 *
 * Decorative: the mark is `aria-hidden` and owns no role, focus or keyboard behaviour. Content in the
 * default slot replaces the mark in every state (a pending spinner), in the mark's place and size.
 *
 * @summary The check mark on a chosen option; nothing when unchosen.
 * @tag tct-check-indicator
 * @upstream CheckIndicator
 * @slot - Content drawn instead of the mark, in either state (a spinner while pending).
 * @cssstate checked - The state is `checked`.
 * @cssstate disabled - The owner is disabled.
 * @cloakDisplay inline-flex
 */
export class TctCheckIndicator extends TctElement {
  static override readonly tagName = 'tct-check-indicator';
  static override readonly dependencies = [TctIcon];
  static override styles: CSSResultGroup = [base, styles];

  /** Which state to draw: `unchecked` (nothing) or `checked` (the mark). */
  @property({reflect: true}) state: SingleSelectionState = 'unchecked';

  /** Control size, matching the other indicators. The mark is 16px at both sizes. */
  @property({reflect: true}) size: IndicatorSize = 'md';

  /** Whether the owning row is disabled. Purely visual; the owner keeps the real disabled semantics. */
  @property({type: Boolean, reflect: true}) disabled = false;

  readonly #slots = new SlotController(this, 'default');

  protected override willUpdate(changed: PropertyValues<this>): void {
    // Decorative by contract: hidden from assistive technology whatever the author writes on the host.
    this.internals.ariaHidden = 'true';
    if (changed.has('state') && !SINGLE_SELECTION_STATES.includes(this.state)) {
      devWarn(
        `check-indicator:state:${this.state}`,
        `<tct-check-indicator state="${this.state}"> is not one of ${SINGLE_SELECTION_STATES.join(', ')}.`,
      );
    }
    if (changed.has('size') && !INDICATOR_SIZES.includes(this.size)) {
      devWarn(
        `check-indicator:size:${this.size}`,
        `<tct-check-indicator size="${this.size}"> is not one of ${INDICATOR_SIZES.join(', ')}.`,
      );
    }
  }

  protected override updated(): void {
    this.toggleState('checked', this.state === 'checked');
    this.toggleState('disabled', this.disabled);
  }

  protected override render(): TemplateResult | typeof nothing {
    // Slotted content is checked BEFORE the state: a host passes a busy visual through in whatever
    // state the row happens to be in, and an unchecked listbox row is the common one.
    if (this.#slots.has('default')) {
      return html`<span class="slot" aria-hidden="true" ?data-disabled=${this.disabled}
        ><slot></slot
      ></span>`;
    }
    // Nothing to draw, and no box to reserve: an unmarked row keeps the layout it would have without
    // this indicator.
    if (this.state !== 'checked') return nothing;
    return html`<tct-icon
      name="check"
      size="sm"
      color=${this.disabled ? 'disabled' : 'accent'}
    ></tct-icon>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-check-indicator': TctCheckIndicator;
  }
}
