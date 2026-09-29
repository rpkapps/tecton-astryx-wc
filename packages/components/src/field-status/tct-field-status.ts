import {html, type CSSResultGroup} from 'lit';
import {property} from 'lit/decorators.js';
import {announce} from '@tecton-astryx/core/a11y/announcer.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {TctIcon} from '../icon/tct-icon.js';
import base from '../styles/base.styles.css';
import motion from '../styles/motion.styles.css';
import {
  INPUT_STATUS_TYPES,
  type FieldStatusVariant,
  type InputStatusType,
} from '../field/field.types.js';
import {STATUS_ICON, oneOf} from '../field/field-utils.js';
import styles from './tct-field-status.styles.css';

/**
 * A validation message for a field or field-like control: one visible message box, announced once
 * through the shared announcer when it appears or changes.
 *
 * The `detached` variant leads with a status icon, so status is never conveyed by colour or position
 * alone (WCAG 1.4.1); the `attached` variant keeps its status glyph on the control (the control draws
 * it), so no icon is rendered here. The `tooltip` presentation of the field family renders no message
 * box at all, so `tct-field-status` does not implement it (Astryx spec FR7).
 *
 * The message is the `message` attribute, or the element's own content when it needs markup.
 * Screen-reader announcement goes through the announcer regions rather than `role="alert"` on this
 * element: a live region that is created together with its content is often not spoken
 * [mwg:accessible-error-announcement]. A status that a field or control owns (`data-tct-owned`)
 * is announced by its owner, once, so it is not spoken twice.
 *
 * @summary Validation message for a field.
 * @tag tct-field-status
 * @upstream FieldStatus
 * @slot - The message, when it needs more than the plain `message` text.
 * @csspart status - The message box (Astryx target `astryx-field-status`).
 * @csspart icon - The leading status icon of the `detached` variant (Astryx target `astryx-field-status-icon`).
 * @cloakDisplay block
 */
export class TctFieldStatus extends TctElement {
  static override readonly tagName = 'tct-field-status';
  static override readonly dependencies = [TctIcon];
  static override styles: CSSResultGroup = [base, motion, styles];

  /** The kind of status: selects the colour and the icon. Default `error`. */
  @property({reflect: true}) type: InputStatusType = 'error';

  /** The message. Alternative to the default slot. */
  @property() message = '';

  /**
   * `attached` (default) sits directly below the control; `detached` is a separate message with a
   * leading status icon and spacing above it.
   */
  @property({reflect: true}) variant: FieldStatusVariant = 'attached';

  #announced = '';

  /** The message currently shown: the attribute, else the element's own text. */
  get #text(): string {
    return (this.message || this.textContent || '').trim();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#announced = '';
  }

  protected override updated(): void {
    this.#announce();
  }

  override render() {
    // Invalid attribute values fall back (A§7.3); `tooltip` is handled by the field before this renders.
    const type = oneOf(this.type, INPUT_STATUS_TYPES, 'error');
    const variant = this.variant === 'detached' ? 'detached' : 'attached';
    const detached = variant === 'detached';
    return html`<div class="status" part="status" data-type=${type} data-variant=${variant}>
      ${
        detached
          ? html`<span class="content"
              ><span class="icon"
                ><tct-icon
                  part="icon"
                  name=${STATUS_ICON[type]}
                  size="sm"
                  color="inherit"
                ></tct-icon></span
              ><span class="text"
                ><slot @slotchange=${this.#onSlotChange}>${this.message}</slot></span
              ></span
            >`
          : html`<slot @slotchange=${this.#onSlotChange}>${this.message}</slot>`
      }
    </div>`;
  }

  readonly #onSlotChange = (): void => {
    this.#announce();
  };

  /**
   * Speaks the message when it appears or changes, including on first mount (a form can mount with a
   * server error already present). A status owned by a field is announced by that field.
   */
  #announce(): void {
    if (this.hasAttribute('data-tct-owned')) return;
    const text = this.#text;
    if (!text) {
      this.#announced = '';
      return;
    }
    if (text === this.#announced) return;
    this.#announced = text;
    // Upstream routes errors through the assertive channel and everything else through the polite one.
    announce(text, {
      politeness:
        oneOf(this.type, INPUT_STATUS_TYPES, 'error') === 'error' ? 'assertive' : 'polite',
      element: this,
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-field-status': TctFieldStatus;
  }
}
