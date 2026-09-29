import {html, nothing, type CSSResultGroup} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import base from '../styles/base.styles.css';
import slottedIcon from '../styles/slotted-icon.styles.css';
import styles from './tct-segmented-control-item.styles.css';
import {segmentedControlContext} from './segmented-control.context.js';

/**
 * One choice of a `tct-segmented-control`: a radio whose semantics live on the host (`role="radio"`,
 * `aria-checked`, `aria-disabled`, named by `label`). The host is the focus target: the control's
 * roving tabindex writes `tabindex` on it, so `label` and the icon are only ever painted, never
 * focusable parts of their own.
 *
 * @summary A single segment: a radio with a label and an optional icon.
 * @tag tct-segmented-control-item
 * @upstream SegmentedControlItem
 * @slot icon - Icon shown before the label (sized from the control's size).
 * @csspart item - The painted segment.
 * @csspart label - The visible label text.
 * @cssstate selected - This segment is the control's value.
 * @cssstate disabled - This segment, or the whole control, is disabled.
 * @cloakDisplay inline-flex
 */
export class TctSegmentedControlItem extends TctElement {
  static override readonly tagName = 'tct-segmented-control-item';
  static override styles: CSSResultGroup = [base, slottedIcon, styles];

  /** The value this segment stands for; compared with the control's `value`. Required. */
  @property() value = '';

  /**
   * Accessible name of the segment and, unless `label-hidden`, its visible text. Required: it is the
   * radio's name.
   */
  @property() label = '';

  /** Show only the icon; `label` is then the accessible name alone. */
  @property({type: Boolean, attribute: 'label-hidden', reflect: true}) labelHidden = false;

  /** Disables this segment only. It is skipped by arrow keys and cannot be selected. */
  @property({type: Boolean, reflect: true}) disabled = false;

  readonly #context = new ContextConsumer(this, {
    context: segmentedControlContext,
    subscribe: true,
  });
  readonly #slots = new SlotController(this, 'icon');

  constructor() {
    super();
    this.internals.role = 'radio';
    this.addEventListener('click', this.#onClick);
  }

  /** Whether this segment is the control's value (false outside a control). */
  get selected(): boolean {
    const context = this.#context.value;
    return (
      context !== undefined &&
      context !== null &&
      context.value !== '' &&
      context.value === this.value
    );
  }

  /** Whether this segment cannot be activated: its own `disabled`, or the whole control's. */
  get isDisabled(): boolean {
    return this.disabled || (this.#context.value?.disabled ?? false);
  }

  protected override willUpdate(): void {
    // Semantics on the host through ElementInternals, so consumer aria-* attributes still win.
    this.internals.ariaChecked = this.selected ? 'true' : 'false';
    this.internals.ariaDisabled = this.isDisabled ? 'true' : null;
    this.internals.ariaLabel = this.label || null;
  }

  protected override updated(): void {
    this.toggleState('selected', this.selected);
    this.toggleState('disabled', this.isDisabled);
  }

  /** A consumer's own click handler may `preventDefault()` to opt out of selection. */
  readonly #onClick = (event: MouseEvent): void => {
    const context = this.#context.value;
    if (!context || event.defaultPrevented || this.isDisabled) return;
    context.select(this, this.value, event);
  };

  override render() {
    const context = this.#context.value;
    return html`<div
      class="item"
      part="item"
      data-size=${context?.size ?? 'md'}
      data-layout=${context?.layout ?? 'hug'}
      data-selected=${this.selected ? '' : nothing}
      data-disabled=${this.isDisabled ? '' : nothing}
    >
      <span class="icon-slot" ?hidden=${!this.#slots.has('icon')}><slot name="icon"></slot></span>
      ${this.labelHidden ? nothing : html`<span class="label" part="label">${this.label}</span>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-segmented-control-item': TctSegmentedControlItem;
  }
}
