import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {IdController} from '@tecton-astryx/core/utils/id.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import motion from '../styles/motion.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {
  PROGRESS_BAR_VARIANTS,
  type ProgressBarMark,
  type ProgressBarValueFormatter,
  type ProgressBarVariant,
} from './progress-bar.types.js';
import styles from './tct-progress-bar.styles.css';

/**
 * A horizontal bar for the progress of a task: determinate when the amount of work is known,
 * indeterminate (an animated sliding segment) when it is not. Compose extra labels, icons and
 * descriptions beside it with layout elements; the exception is on-track content, the `marks`
 * (target ticks positioned by value).
 *
 * The track is the `progressbar` (`aria-valuenow`, `aria-valuetext`), named by the label, which is
 * shown above the bar or hidden visually (`label-hidden`) but always present. The value text defaults
 * to a localised percentage (`Intl.NumberFormat`); `formatValueLabel` replaces it. A non-finite value
 * or maximum counts as empty progress, never as "NaN". Under `prefers-reduced-motion` the
 * indeterminate slide slows down instead of stopping.
 *
 * Guides: [mwg:progress-ring] (the native `<progress>` alternative is not used: it cannot carry marks
 * or a custom value text consistently) [mwg:spinner] (reduced-motion slowdown) [mwg:css]
 * (`--_animation-reduced`, forced colours) [mwg:accessible-web-components] (all ids in one root).
 *
 * @summary A linear progress bar, determinate or indeterminate, with an optional value label and target marks.
 * @tag tct-progress-bar
 * @upstream ProgressBar
 * @csspart base - The column holding the label row and the track (Astryx target `astryx-progress-bar`).
 * @csspart label - The label text.
 * @csspart value-label - The formatted value text.
 * @csspart track - The rail carrying the progressbar semantics (Astryx target `astryx-progress-bar-track`).
 * @csspart fill - The filled segment (Astryx target `astryx-progress-bar-fill`).
 * @csspart mark - A target mark (Astryx target `astryx-progress-bar-mark`); carries `data-placement` (`fill` or `track`) and `data-variant`.
 * @cloakDisplay block
 */
export class TctProgressBar extends TctElement {
  static override readonly tagName = 'tct-progress-bar';
  static override styles: CSSResultGroup = [base, focusRing, motion, visuallyHidden, styles];

  /** Current value; ignored when `indeterminate`. Clamped to `0..max`; a non-finite value counts as 0. */
  @property({type: Number}) value = 0;

  /** Maximum value. A non-finite or zero maximum counts as an empty range. */
  @property({type: Number}) max = 100;

  /**
   * Accessible label of the bar (required for accessibility). Shown above the bar unless
   * `label-hidden`.
   */
  @property() label = '';

  /** Hides the label visually; it stays available to assistive technology. */
  @property({type: Boolean, attribute: 'label-hidden'}) labelHidden = false;

  /** Shows the formatted value beside the label. Ignored when `indeterminate`. */
  @property({type: Boolean, attribute: 'has-value-label'}) hasValueLabel = false;

  /**
   * Formats the value text (the visible value label and `aria-valuetext`). Default: the percentage,
   * localised. Property only.
   */
  @property({attribute: false}) formatValueLabel: ProgressBarValueFormatter | undefined;

  /** Fill colour role: `accent` (default), `success`, `warning`, `error` or `neutral`. */
  @property({reflect: true}) variant: ProgressBarVariant = 'accent';

  /**
   * Animated indeterminate indicator for unknown progress. `value` and `has-value-label` are ignored and
   * the semantics carry no value.
   */
  @property({type: Boolean, reflect: true}) indeterminate = false;

  /**
   * Target marks drawn on the track at fixed points of the `0..max` scale, for example a goal line.
   * They stay visible before and after the fill, take their colour from what they sit on, and each
   * label names the mark and appears in a tooltip on hover and focus. Ignored when `indeterminate`.
   * Property only.
   */
  @property({attribute: false}) marks: readonly ProgressBarMark[] | undefined;

  /** Visually disabled (grey fill and text), for cancelled or inactive operations. */
  @property({type: Boolean, reflect: true}) disabled = false;

  readonly #ids = new IdController(this, 'tct-progress-bar');
  readonly #locale = new LocaleController(this, {namespace: 'progress-bar'});

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (
      changed.has('variant') &&
      !(PROGRESS_BAR_VARIANTS as readonly string[]).includes(this.variant)
    ) {
      devWarn(
        `progress-bar:variant:${this.variant}`,
        `<tct-progress-bar variant="${this.variant}"> is not one of ${PROGRESS_BAR_VARIANTS.join(', ')}; using "accent".`,
      );
    }
  }

  #formatValue(value: number, max: number): string {
    if (this.formatValueLabel) return this.formatValueLabel(value, max);
    const ratio = max > 0 ? Math.round((value / max) * 100) / 100 : 0;
    return this.#locale.numberFormat({style: 'percent', maximumFractionDigits: 0}).format(ratio);
  }

  override render(): TemplateResult {
    const labelId = this.#ids.id('label');
    // A non-finite value or maximum (a NaN from `loaded / total` with total 0) is empty progress.
    const safeValue = Number.isFinite(this.value) ? this.value : 0;
    const safeMax = Number.isFinite(this.max) ? this.max : 0;
    const clamped = Math.min(Math.max(0, safeValue), safeMax);
    const percentage = safeMax > 0 ? (clamped / safeMax) * 100 : 0;
    const valueText = this.#formatValue(clamped, safeMax);
    const determinate = !this.indeterminate;
    const showValueLabel = this.hasValueLabel && determinate;
    const fillVariant = this.disabled ? 'disabled' : this.variant;
    const showHeader = !this.labelHidden || showValueLabel;

    return html`<div class="base" part="base">
      ${
        showHeader
          ? html`<div class="header">
              <span
                id=${labelId}
                class=${this.labelHidden ? 'label visually-hidden' : 'label'}
                part="label"
                >${this.label}</span
              >
              ${
                showValueLabel
                  ? html`<span class="value-label" part="value-label">${valueText}</span>`
                  : nothing
              }
            </div>`
          : html`<span id=${labelId} class="visually-hidden">${this.label}</span>`
      }
      <div class="track-container">
        <div
          class="track"
          part="track"
          role="progressbar"
          aria-labelledby=${labelId}
          aria-valuenow=${determinate ? String(clamped) : nothing}
          aria-valuemin=${determinate ? '0' : nothing}
          aria-valuemax=${determinate ? String(safeMax) : nothing}
          aria-valuetext=${determinate ? valueText : nothing}
          ?data-indeterminate=${!determinate}
        >
          <div
            class=${determinate ? 'fill' : 'fill indeterminate'}
            part="fill"
            data-variant=${fillVariant}
            style=${styleMap(determinate ? {'--_fill': `${percentage}%`} : {})}
          ></div>
        </div>
        ${determinate ? this.#renderMarks(safeMax, percentage, fillVariant) : nothing}
      </div>
    </div>`;
  }

  /** Marks live beside the progressbar, not inside it, so they stay independently focusable. */
  #renderMarks(safeMax: number, percentage: number, fillVariant: string) {
    const marks = (this.marks ?? []).filter((mark) => Number.isFinite(mark.value));
    return marks.map((mark) => {
      const clamped = Math.min(Math.max(0, mark.value), safeMax);
      const pct = safeMax > 0 ? (clamped / safeMax) * 100 : 0;
      // A mark exactly at the fill's leading edge is on the fill ("reached the target"), except at zero
      // progress, where there is no fill for it to sit on.
      const onFill = percentage > 0 && pct <= percentage;
      return html`<span
        class="mark"
        part="mark"
        role="img"
        tabindex="0"
        aria-label=${mark.label}
        data-placement=${onFill ? 'fill' : 'track'}
        data-variant=${fillVariant}
        style=${styleMap({'--_mark-position': `${pct}%`})}
      ></span>`;
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-progress-bar': TctProgressBar;
  }
}
