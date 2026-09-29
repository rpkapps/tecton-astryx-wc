import {html, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {ContextConsumer} from '@tecton-astryx/core/context/protocol.js';
import {BoxPropsMixin} from '@tecton-astryx/core/mixins/box-props.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {layoutDividerContext} from './layout.context.js';
import styles from './tct-layout-footer.styles.css';

/**
 * The bottom bar of a `tct-layout`: action bars, pagination, status bars, or any fixed-height content
 * at the bottom. Put it in the layout's `footer` slot (`<tct-layout-footer slot="footer">`).
 *
 * The footer provides its own padding, so children need none; set `padding="0"` when the content
 * manages its own. `has-divider` draws a themed rule above it. Without one the spacing collapses so
 * the content above flows into the footer. When `has-divider` is not stated the layout's
 * `default-has-dividers` decides, then `false`; set the property `hasDivider` to `false` to override a
 * layout that switches dividers on. The resolved value is reflected as `data-divider` so the layout
 * (and the content region) can react to it.
 *
 * `landmark` gives the footer's box an ARIA landmark role (`contentinfo` only for a site-wide footer)
 * and `label` an accessible name; both are for the box itself, so use them where a landmark is wanted.
 *
 * @summary Bottom bar of a layout with optional divider, height and padding.
 * @tag tct-layout-footer
 * @upstream LayoutFooter
 * @slot - The footer content.
 * @csspart base - The footer box: it carries the divider and the height (Astryx target `astryx-layout-footer`).
 * @cssprop --layout-padding-outer-x - Read: the inline padding at the layout's outer edge.
 * @cssprop --layout-padding-outer-y - Read: the block-end padding at the layout's outer edge.
 * @cssprop --layout-padding-inner-y - Read: the block-start padding towards the content above.
 * @cssprop --layout-content-width - Read: the content width the footer's content aligns to.
 * @cssprop --container-padding-inline-start - Published for descendants that bleed to the footer edge: its inline-start padding.
 * @cssprop --container-padding-inline-end - Published: the inline-end padding.
 * @cssprop --container-padding-block-start - Published: the block-start padding.
 * @cssprop --container-padding-block-end - Published: the block-end padding.
 * @cloakDisplay block
 */
export class TctLayoutFooter extends BoxPropsMixin(TctElement) {
  static override readonly tagName = 'tct-layout-footer';
  static override styles: CSSResultGroup = [base, styles];

  /**
   * Draws a themed rule at the top edge. Unset, the layout's `default-has-dividers` decides, then
   * `false`. The attribute means `true`; set the property to `false` to override an inherited default.
   */
  @property({type: Boolean, attribute: 'has-divider'}) hasDivider: boolean | undefined;

  /** Accessible name of the footer box; needed when it is a landmark and several of that kind exist. */
  @property() label: string | undefined;

  /**
   * ARIA landmark role of the footer box (upstream `role`; renamed because a `role` attribute would
   * shadow the global one): `contentinfo` only for a site-wide footer, not in a nested layout.
   */
  @property() landmark: string | undefined;

  readonly #dividers = new ContextConsumer(this, {context: layoutDividerContext, subscribe: true});

  /** Whether the footer draws a divider: its own value, else the layout's default, else `false`. */
  get resolvedHasDivider(): boolean {
    return this.hasDivider ?? this.#dividers.value?.defaultHasDividers ?? false;
  }

  // Sizes go on the host: the height belongs to the box that carries the divider.
  protected override get boxTarget(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const parent = this.parentElement;
    if (parent?.localName === 'tct-layout' && this.getAttribute('slot') !== 'footer') {
      devWarn(
        'layout-footer:slot',
        '<tct-layout-footer> is in the default slot of its layout; add slot="footer".',
      );
    }
  }

  protected override willUpdate(): void {
    // The divider is state other elements read (the layout collapses the content's padding when the
    // footer has none), so it is reflected as a passive data attribute.
    this.toggleAttribute('data-divider', this.resolvedHasDivider);
  }

  override render(): TemplateResult {
    return html`<div
      class="shell"
      part="base"
      role=${ifDefined(this.landmark)}
      aria-label=${ifDefined(this.label)}
      ?data-divider=${this.resolvedHasDivider}
    >
      <div class="inner"><slot></slot></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-layout-footer': TctLayoutFooter;
  }
}
