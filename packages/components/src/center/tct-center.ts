import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {BoxPropsMixin} from '@tecton-astryx/core/mixins/box-props.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {CENTER_AXES, type CenterAxis} from './center.types.js';
import styles from './tct-center.styles.css';

/**
 * Centres its content in the middle of its container on one or both axes.
 *
 * The children are flex items of an inner `part="base"` box that centres them. Give the centre a
 * `height` (or a parent with one) for `axis="vertical"` and `both` to have room to centre in.
 * Layout only: it adds no role or label, so keep the semantics and the accessible names on the
 * content.
 *
 * @summary Centres its content on the horizontal axis, the vertical axis, or both.
 * @tag tct-center
 * @upstream Center
 * @slot - The content to centre.
 * @csspart base - The flex box that centres the content and carries the padding (Astryx target `astryx-center`).
 * @cloakDisplay flex
 */
export class TctCenter extends BoxPropsMixin(TctElement) {
  static override readonly tagName = 'tct-center';
  static override styles: CSSResultGroup = [base, styles];

  /**
   * Which axes to centre on: `both` (default), `horizontal` (the inline axis) or `vertical` (the
   * block axis). In vertical writing modes the values keep following the flex axes.
   */
  @property({reflect: true}) axis: CenterAxis = 'both';

  /**
   * Renders the centre as `inline-flex`, so small content (an icon, a badge) is centred inside a
   * line of text without breaking the text flow (upstream `isInline`).
   */
  @property({type: Boolean, reflect: true}) inline = false;

  // Sizes go on the host (not part="base") so a percentage resolves against the parent.
  protected override get boxTarget(): HTMLElement {
    return this;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('axis') && !CENTER_AXES.includes(this.axis)) {
      devWarn(
        `center:axis:${String(this.axis)}`,
        `axis="${String(this.axis)}" is not one of ${CENTER_AXES.join(', ')}.`,
      );
    }
  }

  override render(): TemplateResult {
    const axis = CENTER_AXES.includes(this.axis) ? this.axis : 'both';
    return html`<div part="base" class="base" data-axis=${axis}><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-center': TctCenter;
  }
}
