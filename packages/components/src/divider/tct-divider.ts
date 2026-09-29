import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {
  DIVIDER_ORIENTATIONS,
  DIVIDER_VARIANTS,
  type DividerOrientation,
  type DividerVariant,
} from './divider.types.js';
import styles from './tct-divider.styles.css';

/**
 * A rule that separates content into sections, optionally with a centred label.
 *
 * The host is a `separator` (`role`, `aria-orientation` and, when there is a label, the accessible
 * name are default `ElementInternals` state, so `aria-label` or `aria-labelledby` on the host win).
 * A horizontal divider fills the width of its container; a vertical one fills its height and needs a
 * parent with a definite height. `full-bleed` extends the rule to the edges of a padded container
 * (`tct-section`, `tct-card`) with negative margins.
 *
 * @summary A hairline separator with an optional centred label.
 * @tag tct-divider
 * @upstream Divider
 * @slot label - A custom label (markup) shown between two rules; the `label` attribute is the plain-text form.
 * @csspart base - The box that holds the rule segments and the label (theme target `divider`).
 * @csspart line - A rule segment; there are two when a label is shown.
 * @csspart label - The label between the rule segments.
 * @cssprop --container-padding-inline-start - Inline-start padding of the enclosing padded container, read by `full-bleed` (set by `tct-section` and `tct-card`).
 * @cssprop --container-padding-inline-end - Inline-end padding of the enclosing padded container, read by `full-bleed`.
 * @cssprop --container-padding-block-start - Block-start padding of the enclosing padded container, read by a vertical `full-bleed`.
 * @cssprop --container-padding-block-end - Block-end padding of the enclosing padded container, read by a vertical `full-bleed`.
 * @cloakDisplay flex
 */
export class TctDivider extends TctElement {
  static override readonly tagName = 'tct-divider';
  static override styles: CSSResultGroup = [base, styles];

  /** `horizontal` (default) or `vertical`. Exposed to assistive technology as `aria-orientation`. */
  @property({reflect: true}) orientation: DividerOrientation = 'horizontal';

  /**
   * A plain-text label shown between two rule segments. It is also the separator's accessible name
   * (a separator does not name itself from content). For markup use the `label` slot.
   */
  @property() label = '';

  /** Visual weight: `subtle` (default) or `strong`. Colour only; both are one border-width thick. */
  @property({reflect: true}) variant: DividerVariant = 'subtle';

  /**
   * Extends the rule to the edges of a padded container, cancelling its padding with negative
   * margins (upstream `isFullBleed`). Reads the `--container-padding-*` properties `tct-section`
   * and `tct-card` publish; without a padded container it does nothing.
   */
  @property({attribute: 'full-bleed', type: Boolean, reflect: true}) fullBleed = false;

  readonly #slots = new SlotController(this, 'label');
  #observer: MutationObserver | undefined;

  /** The text a slotted label contributes to the accessible name. */
  #slottedText(): string {
    return [...this.children]
      .filter((child) => child.getAttribute('slot') === 'label')
      .map((child) => child.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A slotted label can change text in place; the name follows it.
    this.#observer ??= new MutationObserver(() => {
      this.requestUpdate();
    });
    this.#observer.observe(this, {childList: true, characterData: true, subtree: true});
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('orientation') && !DIVIDER_ORIENTATIONS.includes(this.orientation)) {
      devWarn(
        `divider:orientation:${String(this.orientation)}`,
        `orientation="${String(this.orientation)}" is not one of ${DIVIDER_ORIENTATIONS.join(', ')}.`,
      );
    }
    if (changed.has('variant') && !DIVIDER_VARIANTS.includes(this.variant)) {
      devWarn(
        `divider:variant:${String(this.variant)}`,
        `variant="${String(this.variant)}" is not one of ${DIVIDER_VARIANTS.join(', ')}.`,
      );
    }
    // Default semantics on ElementInternals so consumer attributes (aria-label, aria-labelledby)
    // still win, as upstream lets an explicit one beat the rendered label [mwg:accessible-web-components].
    this.internals.role = 'separator';
    this.internals.ariaOrientation = this.orientation === 'vertical' ? 'vertical' : 'horizontal';
    const name =
      this.label !== '' ? this.label : this.#slots.has('label') ? this.#slottedText() : '';
    this.internals.ariaLabel = name === '' ? null : name;
  }

  override render(): TemplateResult {
    const orientation = this.orientation === 'vertical' ? 'vertical' : 'horizontal';
    const variant = this.variant === 'strong' ? 'strong' : 'subtle';
    const hasLabel = this.label !== '' || this.#slots.has('label');
    return html`<div
      part="base"
      class="base"
      data-orientation=${orientation}
      data-variant=${variant}
    >
      <div part="line" class="line"></div>
      ${
        hasLabel
          ? html`<div part="label" class="label">
                <slot name="label">${this.label}</slot>
              </div>
              <div part="line" class="line"></div>`
          : nothing
      }
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-divider': TctDivider;
  }
}
