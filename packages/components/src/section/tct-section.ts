import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {styleMap} from 'lit/directives/style-map.js';
import {
  BoxPropsMixin,
  SPACING_STEPS,
  type SpacingStep,
} from '@tecton-astryx/core/mixins/box-props.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {
  parseSectionDividers,
  SECTION_DIVIDERS,
  SECTION_VARIANTS,
  type SectionDivider,
  type SectionVariant,
} from './section.types.js';
import styles from './tct-section.styles.css';

/**
 * A painted region of a page: settings groups, form sections, sidebar areas, anything that needs
 * visual separation from its neighbours. Use a section for page regions and a `tct-card` for discrete
 * items.
 *
 * The section paints on an inner `part="base"` box (background, padding, divider rules); the default
 * slot sits inside it. Padding defaults to spacing step 4, and an explicit `padding` step is passed on
 * to nested sections that set none (the private `--_section-padding-propagated`). A section nested in
 * a padded container (a card, another section) cancels that container's padding on its inline edges,
 * and on the block edge where it is the first or last child, so it runs edge to edge; it reads the
 * `--container-padding-*` properties the container publishes, and publishes its own for its content.
 *
 * @summary A painted page region with a background variant, dividers and padding.
 * @tag tct-section
 * @upstream Section
 * @slot - The section's content.
 * @csspart base - The painted box: background, padding and divider rules (Astryx target `astryx-section`).
 * @cssprop --section-padding - Padding on all sides when no `padding*` attribute is set and no enclosing section propagates one. Default `var(--spacing-4)` (a theme sets it).
 * @cssprop --section-padding-inline - Inline (left/right) padding; overrides `--section-padding` on that axis.
 * @cssprop --section-padding-inline-start - Inline-start padding; overrides `--section-padding-inline`.
 * @cssprop --section-padding-inline-end - Inline-end padding; overrides `--section-padding-inline`.
 * @cssprop --section-padding-block-start - Block-start padding; overrides `--section-padding`.
 * @cssprop --section-padding-block-end - Block-end padding; overrides `--section-padding`.
 * @cssprop --container-padding-inline-start - Read from the enclosing padded container to run edge to edge; published for descendants: this section's inline-start padding.
 * @cssprop --container-padding-inline-end - Read and published like the inline-start one, for the inline end.
 * @cssprop --container-padding-block-start - Read (first child only) and published: the block-start padding.
 * @cssprop --container-padding-block-end - Read (last child only) and published: the block-end padding.
 * @cssprop --layout-padding-outer-x - Published for layout components inside the section: the inline padding to align with.
 * @cssprop --layout-padding-outer-y - Published for layout components inside the section: the block padding to align with.
 * @cssprop --layout-padding-inner-x - Published for layout components inside the section: the inline padding of nested regions.
 * @cssprop --layout-padding-inner-y - Published for layout components inside the section: the block padding of nested regions.
 * @cloakDisplay flex
 */
export class TctSection extends BoxPropsMixin(TctElement) {
  static override readonly tagName = 'tct-section';
  static override styles: CSSResultGroup = [base, styles];

  /** Background variant: `section` (default, the surface colour), `transparent` or `muted`. */
  @property({reflect: true}) variant: SectionVariant = 'section';

  /**
   * Which sides carry a divider rule: any of `top`, `bottom`, `start`, `end`, as a space-separated
   * attribute (`dividers="top bottom"`) or an array property. `start` and `end` follow the direction.
   */
  @property({converter: {fromAttribute: parseSectionDividers}}) dividers:
    SectionDivider[] | undefined;

  // Sizes go on the host (not part="base"): a percentage resolves against the parent, and the
  // negative margins that escape a padded container sit on an inner wrapper.
  protected override get boxTarget(): HTMLElement {
    return this;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('variant') && !SECTION_VARIANTS.includes(this.variant)) {
      devWarn(
        `section:variant:${String(this.variant)}`,
        `variant="${String(this.variant)}" is not one of ${SECTION_VARIANTS.join(', ')}.`,
      );
    }
  }

  override render(): TemplateResult {
    const dividers = (this.dividers ?? []).filter((side) => SECTION_DIVIDERS.includes(side));
    const padding: SpacingStep | undefined =
      this.padding !== undefined && SPACING_STEPS.includes(this.padding) ? this.padding : undefined;
    // An explicit padding step is announced on a private property so nested sections without their own
    // padding pick it up (it inherits through the slot).
    const propagated =
      padding === undefined ? undefined : `var(--spacing-${String(padding).replace('.', '-')})`;
    return html`<div class="escape">
      <div
        part="base"
        class="base"
        data-variant=${SECTION_VARIANTS.includes(this.variant) ? this.variant : 'section'}
        data-dividers=${ifDefined(dividers.length > 0 ? dividers.join(' ') : undefined)}
        style=${styleMap({'--_section-padding-propagated': propagated})}
      >
        <slot></slot>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-section': TctSection;
  }
}
