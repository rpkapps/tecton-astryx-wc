import {html, nothing, type CSSResultGroup} from 'lit';
import {property} from 'lit/decorators.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {TctRemoveEvent} from '@tecton-wc/core/events/tct-remove.js';
import styles from './tct-sample-badge.styles.css';
import type {SampleBadgeSize, SampleBadgeVariant} from './sample-badge.types.js';

/**
 * Highlights a status or category at a glance. Throwaway sample used to exercise the metadata,
 * docs and build pipeline until real components land.
 *
 * @summary A small status label.
 * @tag tct-sample-badge
 * @upstream Badge
 * @slot - Optional extra content after the label.
 * @slot icon - Leading icon.
 * @csspart badge - The visible pill (Astryx target `astryx-badge`).
 * @cssprop --sample-badge-radius - Corner radius. Default `var(--radius-full)`.
 * @cssstate removable - The badge shows a remove button.
 * @fires tct-remove - The user asked to remove the badge; cancelable.
 * @fires click - Native, retargeted from the pill.
 * @cloakDisplay inline-flex
 * @cloakMinBlockSize 1.5rem
 */
export class TctSampleBadge extends TctElement {
  static override readonly tagName = 'tct-sample-badge';
  static override styles: CSSResultGroup = [styles];

  /** Visual emphasis and status colour. */
  @property({reflect: true}) variant: SampleBadgeVariant = 'neutral';

  /** Size of the pill. */
  @property({reflect: true}) size: SampleBadgeSize = 'md';

  /** The visible text (required upstream). */
  @property() label = '';

  /** Shows a remove button that raises `tct-remove`. */
  @property({type: Boolean, reflect: true}) removable = false;

  /** Number of times the user asked to remove the badge. */
  @property({type: Number, attribute: false}) removeRequests = 0;

  constructor() {
    super();
    // Default semantics on the internals: not a `role` field of the element (tct-constructor-fields).
    this.internals.role = 'status';
  }

  /** Asks to remove the badge, as the remove button does. Returns true when nobody prevented it. */
  requestRemove(): boolean {
    this.removeRequests += 1;
    return this.dispatch(new TctRemoveEvent(this.label));
  }

  /** @internal */
  _measure(): number {
    return this.label.length;
  }

  #onRemove = () => {
    this.requestRemove();
  };

  protected override updated(): void {
    this.toggleState('removable', this.removable);
  }

  override render() {
    return html`<span part="badge" class="badge">
      <slot name="icon"></slot>
      <span class="label">${this.label}</span>
      <slot></slot>
      ${this.removable
        ? html`<button type="button" class="remove" aria-label="Remove ${this.label}" @click=${this.#onRemove}>&times;</button>`
        : nothing}
    </span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-sample-badge': TctSampleBadge;
  }
}
