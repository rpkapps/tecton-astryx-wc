import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {BoxPropsMixin} from '@tecton-astryx/core/mixins/box-props.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {ScrollFocusController} from '../stack/scroll-focus.js';
import {CARD_ELEVATIONS, type CardElevation, type CardVariant} from './card.types.js';
import styles from './tct-card.styles.css';

/**
 * A bordered, optionally elevated container for a discrete, self-contained item: something you could
 * reorder, remove or interact with on its own (a profile, a notification, a metric, a product in a
 * grid). Cards are not the default layout tool: most groups of content need no container, and a page
 * region is a `tct-section`.
 *
 * The card paints on an inner `part="base"` box (background, border, corner radius, shadow, padding);
 * the default slot sits inside it. The default variant draws its border inside the padding, so border
 * plus padding equals the padding you asked for. A card with a fixed `height` scrolls its content.
 * `elevation` raises the resting shadow. Padding defaults to spacing step 4 (16px), or
 * `--card-padding` when a theme sets it.
 *
 * @summary A bordered container for one discrete item, with variants, elevation and padding.
 * @tag tct-card
 * @upstream Card
 * @slot - The card's content.
 * @csspart base - The painted box: background, border, radius, shadow and padding (theme target `card`).
 * @cssprop --card-padding - Padding on all sides when no `padding*` attribute is set. Default `var(--spacing-4)` (a theme sets it).
 * @cssprop --card-padding-inline - Inline (left/right) padding; overrides `--card-padding` on that axis.
 * @cssprop --card-padding-inline-start - Inline-start padding; overrides `--card-padding-inline`.
 * @cssprop --card-padding-inline-end - Inline-end padding; overrides `--card-padding-inline`.
 * @cssprop --card-padding-block-start - Block-start padding; overrides `--card-padding`.
 * @cssprop --card-padding-block-end - Block-end padding; overrides `--card-padding`.
 * @cssprop --container-padding-inline-start - Published for descendants that bleed to the card edge (`tct-divider full-bleed`, `tct-section`): the card's inline-start padding.
 * @cssprop --container-padding-inline-end - Published: the card's inline-end padding.
 * @cssprop --container-padding-block-start - Published: the card's block-start padding.
 * @cssprop --container-padding-block-end - Published: the card's block-end padding.
 * @cssprop --layout-padding-outer-x - Published for layout components inside the card: the inline padding to align with.
 * @cssprop --layout-padding-outer-y - Published for layout components inside the card: the block padding to align with.
 * @cssprop --layout-padding-inner-x - Published for layout components inside the card: the inline padding of nested regions.
 * @cssprop --layout-padding-inner-y - Published for layout components inside the card: the block padding of nested regions.
 * @cloakDisplay flex
 */
export class TctCard extends BoxPropsMixin(TctElement) {
  static override readonly tagName = 'tct-card';
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /**
   * Background variant: `default` (card surface plus a border), `transparent` (no background),
   * `muted`, or a colour (`blue`, `cyan`, `gray`, `green`, `orange`, `pink`, `purple`, `red`, `teal`,
   * `yellow`) for categorisation (use a banner or a badge for status). A value the stylesheet does
   * not know falls back to the base box (no background, no border), so a theme can style it through
   * `tct-card[variant="..."]::part(base)`.
   */
  @property({reflect: true}) variant: CardVariant | (string & {}) = 'default';

  /** Resting shadow: `none` (default, flat), `low`, `med` or `high`. Raise it only to float above content. */
  @property({reflect: true}) elevation: CardElevation = 'none';

  // Sizes go on the host (not part="base") so a percentage resolves against the parent.
  constructor() {
    super();
    ScrollFocusController.attach(this);
  }

  protected override get boxTarget(): HTMLElement {
    return this;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('elevation') && !CARD_ELEVATIONS.includes(this.elevation)) {
      devWarn(
        `card:elevation:${String(this.elevation)}`,
        `elevation="${String(this.elevation)}" is not one of ${CARD_ELEVATIONS.join(', ')}.`,
      );
    }
  }

  override render(): TemplateResult {
    const elevation = CARD_ELEVATIONS.includes(this.elevation) ? this.elevation : 'none';
    // A fixed height (anything but unset or `auto`) makes the card scroll its content; `overflow: auto`
    // also clips to the corner radius.
    const fixedHeight = this.height !== undefined && this.height !== '' && this.height !== 'auto';
    return html`<div
      part="base"
      class="base focus-ring"
      data-variant=${this.variant}
      data-elevation=${elevation}
      ?data-scrollable=${fixedHeight}
    >
      <slot></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-card': TctCard;
  }
}
