import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import english from '@tecton-astryx/locales/en/spinner.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import base from '../styles/base.styles.css';
import motion from '../styles/motion.styles.css';
import {TctText} from '../text/tct-text.js';
import {warnInvalidValue} from '../text/text.types.js';
import {
  SPINNER_ARC_FRACTION,
  SPINNER_GEOMETRY,
  SPINNER_SHADES,
  SPINNER_SIZES,
  type SpinnerShade,
  type SpinnerSize,
} from './spinner.types.js';
import styles from './tct-spinner.styles.css';

// Spinners mounted seconds apart stay in phase when every ring is pinned to the document timeline's
// origin. Rings are collected and pinned in one frame: `getAnimations()` resolves style and setting
// `startTime` dirties it again, so pinning one by one would force a recalc per spinner.
const pending = new Set<SVGCircleElement>();
let flushScheduled = false;

function pinToTimelineOrigin(): void {
  flushScheduled = false;
  const animations: Animation[] = [];
  for (const circle of pending) animations.push(...circle.getAnimations());
  pending.clear();
  for (const animation of animations) animation.startTime = 0;
}

function schedulePin(circle: SVGCircleElement): void {
  if (typeof circle.getAnimations !== 'function') return;
  pending.add(circle);
  if (!flushScheduled) {
    flushScheduled = true;
    requestAnimationFrame(pinToTimelineOrigin);
  }
}

/**
 * An animated loading indicator for work of unknown duration. It is an indeterminate progress bar for
 * assistive technology, named by `aria-label`, else the visible `label`, else "Loading" (localised).
 * For content with known dimensions use a skeleton instead; use one spinner per loading region.
 *
 * Sizes `sm`, `md`, `lg`, `xl` are 10, 14, 18 and 28 px rings; the `inherit` shade follows the
 * surrounding `currentColor` (inside a button). Under reduced motion the ring turns slowly instead of
 * stopping, so it never reads as frozen.
 *
 * @summary An animated indeterminate loading indicator with four sizes and four shades.
 * @tag tct-spinner
 * @upstream Spinner
 * @slot - Rich visible content shown below the ring (replaces the `label` text).
 * @csspart spinner - The ring box (Astryx target `astryx-spinner`).
 * @csspart label - The visible `label` text.
 * @cssprop --spinner-diameter - Diameter of the ring (a length with a unit). Default by size: 10, 14, 18, 28px.
 * @cssprop --spinner-stroke-width - Stroke width of arc and track (a length with a unit). Default by size: 2, 3, 3, 4px.
 * @cssprop --spinner-color - Colour of the moving arc. Default by shade.
 * @cssprop --spinner-track-color - Colour of the track behind the arc; `transparent` for none. Default by shade.
 * @cssprop --spinner-arc-fraction - Fraction of the ring the arc covers, a plain number. Default 0.375.
 * @cloakDisplay inline-flex
 */
export class TctSpinner extends TctElement {
  static override readonly tagName = 'tct-spinner';
  static override readonly dependencies = [TctText];
  static override styles: CSSResultGroup = [base, motion, styles];

  /** Ring size: `sm` 10px, `md` 14px (default), `lg` 18px, `xl` 28px diameter. */
  @property({reflect: true}) size: SpinnerSize = 'md';

  /**
   * Colour shade: `default` (accent on the page), `subtle` (secondary text, for inline use in lists),
   * `on-media` (light, for dark or accent backgrounds), `inherit` (the surrounding `currentColor`).
   */
  @property({reflect: true}) shade: SpinnerShade = 'default';

  /**
   * Visible text below the ring. It also names the spinner (unless `aria-label` is set). Use the
   * default slot instead for rich content.
   */
  @property() label = '';

  readonly #locale = new LocaleController(this, {namespace: 'spinner', defaults: english});
  #circle: SVGCircleElement | null = null;

  protected override willUpdate(changed: PropertyValues): void {
    // Default semantics on ElementInternals: an indeterminate progress bar. A host `aria-label`
    // attribute wins over this name, exactly as upstream lets an explicit aria-label win.
    this.internals.role = 'progressbar';
    this.internals.ariaLabel = this.label || this.#locale.t('loading');
    if (changed.has('size')) warnInvalidValue('tct-spinner', 'size', this.size, SPINNER_SIZES);
    if (changed.has('shade')) warnInvalidValue('tct-spinner', 'shade', this.shade, SPINNER_SHADES);
  }

  protected override updated(): void {
    const circle = this.shadowRoot?.querySelector<SVGCircleElement>('.arc') ?? null;
    if (circle && circle !== this.#circle) schedulePin(circle);
    this.#circle = circle;
  }

  override render(): TemplateResult {
    const {diameter, stroke} = SPINNER_GEOMETRY[this.size in SPINNER_GEOMETRY ? this.size : 'md'];
    const frame = diameter + stroke * 2;
    const circumference = Math.PI * diameter;
    const arc = circumference * SPINNER_ARC_FRACTION;
    // The size's own geometry is also written as attributes: what a render with no stylesheet draws.
    // The CSS rules take over as soon as the cascade has the (possibly themed) values.
    return html`<span part="spinner" class="spinner"
        ><svg class="ring" width=${frame} height=${frame} aria-hidden="true" focusable="false">
          <circle class="track" cx="50%" cy="50%" r=${diameter / 2} stroke-width=${stroke}></circle>
          <circle
            class="arc"
            cx="50%"
            cy="50%"
            r=${diameter / 2}
            stroke-width=${stroke}
            stroke-dasharray="${arc} ${circumference - arc}"
          ></circle></svg></span
      ><slot
        >${
          this.label
            ? html`<tct-text part="label" type="body" weight="bold">${this.label}</tct-text>`
            : nothing
        }</slot
      >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-spinner': TctSpinner;
  }
}
