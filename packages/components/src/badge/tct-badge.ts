import {html, nothing, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import slottedIcon from '../styles/slotted-icon.styles.css';
import {BADGE_VARIANTS, type BadgeVariant} from './badge.types.js';
import styles from './tct-badge.styles.css';

/**
 * A pill that marks a status or a category: a single line of text with an optional leading icon.
 * Badges are read-only indicators; use a button or a link for anything that can be activated.
 *
 * The label is the default slot (rich content is fine) or the `label` attribute (plain text). A
 * label wider than the space available is clipped with an ellipsis, and a plain-text label is also
 * set as a native `title` so the full text stays reachable on hover (upstream parity).
 *
 * Guides: [mwg:shadow-dom] (slots, whitespace) [mwg:styling-web-components] (`part`, private
 * custom properties) [mwg:accessible-web-components] (no role: a badge is text).
 *
 * @summary Highlights a status or a category tag.
 * @tag tct-badge
 * @upstream Badge
 * @slot - The badge label (used when the `label` attribute is not set).
 * @slot icon - Optional leading icon; always pair it with a text label.
 * @csspart base - The painted pill (Astryx target `astryx-badge`).
 * @csspart icon - The wrapper of the leading icon.
 * @csspart label - The clipped label text.
 * @cloakDisplay inline-flex
 */
export class TctBadge extends TctElement {
  static override readonly tagName = 'tct-badge';
  static override styles: CSSResultGroup = [base, slottedIcon, styles];

  /**
   * Visual style. Semantic variants (`neutral`, `info`, `success`, `warning`, `error`) use solid
   * fills; the hue variants (`blue` to `yellow`) use tinted backgrounds for
   * categories and tags.
   */
  @property({reflect: true}) variant: BadgeVariant = 'neutral';

  /** Plain-text label. When absent the default slot is the label. */
  @property() label: string | undefined;

  readonly #slots = new SlotController(this, 'icon');

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('variant') && !(BADGE_VARIANTS as readonly string[]).includes(this.variant)) {
      devWarn(
        `badge:variant:${this.variant}`,
        `<tct-badge variant="${this.variant}"> is not one of ${BADGE_VARIANTS.join(', ')}; using "neutral".`,
      );
    }
  }

  override render() {
    return html`<span class="base" part="base">
      ${
        this.#slots.has('icon')
          ? html`<span class="icon-slot" part="icon"><slot name="icon"></slot></span>`
          : nothing
      }
      <span class="label" part="label" title=${ifDefined(this.#fullText())}
        >${this.label ? this.label : html`<slot @slotchange=${this.#onSlotChange}></slot>`}</span
      >
    </span>`;
  }

  /**
   * The full text for the native `title`: the `label` attribute, or the default slot when it holds
   * only text (a rich label is a subtree, and flattening it would be a guess; upstream leaves it).
   */
  #fullText(): string | undefined {
    if (this.label) return this.label;
    const nodes = [...this.childNodes].filter((node) => {
      if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').trim() !== '';
      return node.nodeType === Node.ELEMENT_NODE && !(node as Element).hasAttribute('slot');
    });
    if (nodes.length === 0 || nodes.some((node) => node.nodeType !== Node.TEXT_NODE)) {
      return undefined;
    }
    const text = [...this.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    return text === '' ? undefined : text;
  }

  #onSlotChange = (): void => {
    this.requestUpdate();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-badge': TctBadge;
  }
}
