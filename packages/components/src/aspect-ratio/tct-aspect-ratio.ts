import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {styleMap} from 'lit/directives/style-map.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {
  ASPECT_RATIO_FITS,
  ASPECT_RATIO_SHAPES,
  toCssRatio,
  type AspectRatioFit,
  type AspectRatioShape,
} from './aspect-ratio.types.js';
import styles from './tct-aspect-ratio.styles.css';

/**
 * Keeps a fixed width-to-height ratio for its content as its container resizes. Use it for media such
 * as videos, images and thumbnails. It takes its width from the container and derives its height from
 * `ratio`, so it needs an ancestor with a definite width (in a shrink-to-fit parent it has no width
 * and collapses).
 *
 * `fit` lets the box size the content: `cover` fills and crops, `contain` fills and letterboxes,
 * `center` keeps the natural size in the middle. Pass one child: with `fit` set every direct child is
 * stretched to fill the box, so put an overlay or caption inside a single wrapper. The box adds no
 * role and no accessible name; the child carries the whole description (`alt` on an image).
 *
 * @summary A box with a fixed aspect ratio that clips or fits its content.
 * @tag tct-aspect-ratio
 * @upstream AspectRatio
 * @slot - The content that fills the box.
 * @csspart base - The ratio box that clips the content and takes the elliptical shape (theme target `aspect-ratio`).
 * @cloakDisplay block
 */
export class TctAspectRatio extends TctElement {
  static override readonly tagName = 'tct-aspect-ratio';
  static override styles: CSSResultGroup = [base, styles];

  /**
   * Width divided by height: a number (`1.7778`, `1`), or a fraction as text (`16/9`). Required; a
   * missing or invalid value falls back to a square and warns in dev mode. Written as a property it
   * also takes a number computed as `16 / 9`.
   */
  @property() ratio: number | string | undefined;

  /** The outline: `rectangle` (default) or `ellipse` (a circle at ratio 1, an oval otherwise). */
  @property({reflect: true}) shape: AspectRatioShape = 'rectangle';

  /**
   * How the content fills the box: `cover` (fill and crop), `contain` (fill and letterbox) or
   * `center` (natural size, centred). Unset, the content styles itself.
   */
  @property({reflect: true}) fit: AspectRatioFit | undefined;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if ((changed.has('ratio') || !this.hasUpdated) && toCssRatio(this.ratio) === undefined) {
      devWarn(
        'aspect-ratio:ratio',
        `<tct-aspect-ratio> needs a positive ratio (for example ratio="1.7778" or ratio="16/9"); using 1.`,
      );
    }
    if (changed.has('shape') && !ASPECT_RATIO_SHAPES.includes(this.shape)) {
      devWarn(
        `aspect-ratio:shape:${String(this.shape)}`,
        `shape="${String(this.shape)}" is not one of ${ASPECT_RATIO_SHAPES.join(', ')}.`,
      );
    }
    if (changed.has('fit') && this.fit && !ASPECT_RATIO_FITS.includes(this.fit)) {
      devWarn(
        `aspect-ratio:fit:${this.fit}`,
        `fit="${this.fit}" is not one of ${ASPECT_RATIO_FITS.join(', ')}.`,
      );
    }
  }

  override render(): TemplateResult {
    const shape = ASPECT_RATIO_SHAPES.includes(this.shape) ? this.shape : 'rectangle';
    // The ratio is a custom property read by a class-level declaration, never an inline
    // `aspect-ratio`, so a consumer rule on ::part(base) (also inside a media or container query) wins.
    return html`<div
      part="base"
      class="base"
      data-shape=${shape}
      style=${styleMap({'--_ratio': toCssRatio(this.ratio)})}
    >
      <div class="child" data-fit=${ifDefined(ASPECT_RATIO_FITS.find((fit) => fit === this.fit))}>
        <slot></slot>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-aspect-ratio': TctAspectRatio;
  }
}
