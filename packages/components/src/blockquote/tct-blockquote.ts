import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {AriaDelegateController} from '@tecton-wc/core/controllers/aria-delegate.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import base from '../styles/base.styles.css';
import styles from './tct-blockquote.styles.css';

/**
 * A quotation: a real `<blockquote>` with a rule on its inline-start edge and secondary text colour,
 * for testimonials, excerpts and highlighted quotes. The rule and the padding are logical, so they
 * move to the right edge in right-to-left languages.
 *
 * The attribution is a bare `<cite>` after the quotation, never wrapped in a `<footer>`: a footer inside
 * a blockquote maps to a `contentinfo` landmark, and a page with several quotes would report several
 * page footers. Give the source with the `cite` attribute (plain text) or the `cite` slot (markup); the
 * attribute is the attribution text, not a URL. `aria-*` attributes on the host are mirrored onto the
 * inner `<blockquote>`.
 *
 * @summary A quotation block with an inline-start rule and an optional attribution.
 * @tag tct-blockquote
 * @upstream Blockquote
 * @slot - The quoted content.
 * @slot cite - A custom attribution (markup) rendered as the `<cite>` after the quotation.
 * @csspart base - The `<blockquote>` with the rule, the padding and the text colour (theme target `blockquote`).
 * @csspart cite - The `<cite>` attribution.
 * @cloakDisplay block
 */
export class TctBlockquote extends TctElement {
  static override readonly tagName = 'tct-blockquote';
  static override styles: CSSResultGroup = [base, styles];

  /**
   * The attribution: the source of the quote, as plain text. It renders as a `<cite>` after the
   * quotation. This is the name of the source, not a URL (unlike the native `cite` attribute). For
   * markup use the `cite` slot.
   */
  @property() cite = '';

  readonly #slots = new SlotController(this, 'cite');

  // Host aria-* (a name for the quote) goes on the element assistive technology sees.
  readonly #aria = new AriaDelegateController(this, {
    target: () => this.renderRoot.querySelector('[part~="base"]'),
  });

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.#aria.sync();
  }

  override render(): TemplateResult {
    const hasCite = this.cite.trim() !== '' || this.#slots.has('cite');
    // One line, no whitespace between the slots and the cite: the quotation has no stray text nodes.
    return html`<blockquote part="base" class="base">
      <slot></slot>${
        hasCite
          ? html`<cite part="cite" class="cite"><slot name="cite">${this.cite}</slot></cite>`
          : nothing
      }
    </blockquote>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-blockquote': TctBlockquote;
  }
}
