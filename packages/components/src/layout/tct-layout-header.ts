import {html, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {BoxPropsMixin} from '@tecton-wc/core/mixins/box-props.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {layoutDividerContext} from './layout.context.js';
import styles from './tct-layout-header.styles.css';

/**
 * The top bar of a `tct-layout`: page titles, app bars, toolbars, or any fixed-height content at the
 * top. Put it in the layout's `header` slot (`<tct-layout-header slot="header">`).
 *
 * The header provides its own padding, so children need none; set `padding="0"` when the content
 * manages its own (a top navigation). `has-divider` draws a themed rule under it. Without one the
 * spacing collapses so the header flows into the content below. When `has-divider` is not stated the
 * layout's `default-has-dividers` decides, then `false`; set the property `hasDivider` to `false` to
 * override a layout that switches dividers on. The resolved value is reflected as `data-divider` so
 * the layout (and the content region) can react to it.
 *
 * `landmark` gives the header's box an ARIA landmark role (`banner` only for a site-wide header) and
 * `label` an accessible name; both are for the box itself, so use them where a landmark is wanted.
 *
 * @summary Top bar of a layout with optional divider, height and padding.
 * @tag tct-layout-header
 * @upstream LayoutHeader
 * @slot - The header content.
 * @csspart base - The header box: it carries the divider and the height.
 * @cssprop --layout-padding-outer-x - Read: the inline padding at the layout's outer edge.
 * @cssprop --layout-padding-outer-y - Read: the block-start padding at the layout's outer edge.
 * @cssprop --layout-padding-inner-y - Read: the block-end padding towards the content below.
 * @cssprop --layout-content-width - Read: the content width the header's content aligns to.
 * @cssprop --container-padding-inline-start - Published for descendants that bleed to the header edge: its inline-start padding.
 * @cssprop --container-padding-inline-end - Published: the inline-end padding.
 * @cssprop --container-padding-block-start - Published: the block-start padding.
 * @cssprop --container-padding-block-end - Published: the block-end padding.
 * @cloakDisplay block
 */
export class TctLayoutHeader extends BoxPropsMixin(TctElement) {
  static override readonly tagName = 'tct-layout-header';
  static override styles: CSSResultGroup = [base, styles];

  /**
   * Draws a themed rule at the bottom edge. Unset, the layout's `default-has-dividers` decides, then
   * `false`. The attribute means `true`; set the property to `false` to override an inherited default.
   */
  @property({type: Boolean, attribute: 'has-divider'}) hasDivider: boolean | undefined;

  /** Accessible name of the header box; needed when it is a landmark and several of that kind exist. */
  @property() label: string | undefined;

  /**
   * ARIA landmark role of the header box (upstream `role`; renamed because a `role` attribute would
   * shadow the global one): `banner` only for a site-wide header, not in a nested layout.
   */
  @property() landmark: string | undefined;

  readonly #dividers = new ContextConsumer(this, {context: layoutDividerContext, subscribe: true});

  /** Whether the header draws a divider: its own value, else the layout's default, else `false`. */
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
    if (parent?.localName === 'tct-layout' && this.getAttribute('slot') !== 'header') {
      devWarn(
        'layout-header:slot',
        '<tct-layout-header> is in the default slot of its layout; add slot="header".',
      );
    }
  }

  protected override willUpdate(): void {
    // The divider is state other elements read (the layout collapses the content's padding when the
    // header has none), so it is reflected as a passive data attribute.
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
    'tct-layout-header': TctLayoutHeader;
  }
}
