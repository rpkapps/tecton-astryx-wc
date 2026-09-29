import {html, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import base from '../styles/base.styles.css';
import motion from '../styles/motion.styles.css';
import {SKELETON_RADII, type SkeletonRadius} from './skeleton.types.js';
import styles from './tct-skeleton.styles.css';

/** `200` and `"200"` are pixels; any other string is a CSS length and is used as written. */
function toLength(value: number | string | null | undefined): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? `${value}px` : undefined;
  return /^-?\d+(\.\d+)?$/.test(value.trim()) ? `${value.trim()}px` : value;
}

/** `radius="2"` arrives as a string; the scale is numeric, `none` and `rounded` stay words. */
const radiusConverter = {
  fromAttribute(value: string | null): SkeletonRadius {
    if (value === null) return 3;
    return /^\d$/.test(value) ? (Number(value) as SkeletonRadius) : (value as SkeletonRadius);
  },
};

/**
 * A placeholder shape that stands in for content while it loads: a block of configurable size and
 * corner radius that pulses gently. Use several with `index` for a staggered wave.
 *
 * Purely decorative: the host is hidden from assistive technology (`aria-hidden`, a default the
 * element owns through `ElementInternals`, so a host `aria-hidden="false"` overrides it). The
 * surrounding region should carry the loading state, for example `aria-busy="true"`.
 *
 * The pulse waits one second before it starts (so fast loads never flash it) and slows into a static
 * placeholder under `prefers-reduced-motion`. Forced colours paint it in `GrayText`.
 *
 * Guides: [mwg:css] (animations, `--_animation-reduced`, forced colours) [mwg:accessible-web-components]
 * (default ARIA through `ElementInternals`) [mwg:styling-web-components].
 *
 * @summary A pulsing placeholder for content that is loading.
 * @tag tct-skeleton
 * @upstream Skeleton
 * @csspart base - The painted placeholder.
 * @cloakDisplay block
 */
export class TctSkeleton extends TctElement {
  static override readonly tagName = 'tct-skeleton';
  static override styles: CSSResultGroup = [base, motion, styles];

  /** Width: a number is pixels, a string is any CSS length. Default `100%`. */
  @property() width: number | string | undefined;

  /** Height: a number is pixels, a string is any CSS length. Default `100%`. */
  @property() height: number | string | undefined;

  /**
   * Corner radius on the design scale: `none`, `0` (0px), `1` (2px), `2` (4px), `3` (8px, default), `4`
   * (8px) or `rounded` (fully rounded, for avatars and pills).
   */
  @property({converter: radiusConverter}) radius: SkeletonRadius = 3;

  /**
   * Position in a group of skeletons: the pulse of item n starts 1000 ms + 100 ms x n after mount, so
   * sequential indexes (0, 1, 2 ...) make a wave.
   */
  @property({type: Number}) index = 0;

  constructor() {
    super();
    this.internals.ariaHidden = 'true';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('radius') && !SKELETON_RADII.includes(this.radius)) {
      devWarn(
        `skeleton:radius:${String(this.radius)}`,
        `<tct-skeleton radius="${String(this.radius)}"> is not one of ${SKELETON_RADII.join(', ')}; using 3.`,
      );
    }
  }

  override render() {
    const index = Number.isFinite(this.index) ? this.index : 0;
    return html`<div
      class="base"
      part="base"
      data-radius=${String(this.radius)}
      style=${styleMap({
        '--_width': toLength(this.width),
        '--_height': toLength(this.height),
        '--_index': String(index),
      })}
    ></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-skeleton': TctSkeleton;
  }
}
