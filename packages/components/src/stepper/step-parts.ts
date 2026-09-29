/**
 * Painted parts a step shares with its stepper's compact summary: the indicator (number badge, current
 * ring, completed check, status glyph or the author's own) and the label row. Both render them from the
 * same classes, which `stepper-parts.styles.css` styles in either shadow root.
 */
import {html, nothing, svg, type TemplateResult} from 'lit';
import type {StepIndicatorPreset, StepStatus} from './stepper.types.js';

export type StepProgress = 'completed' | 'in-progress' | 'not-started';

/** A filled circle with a check: a completed step in `auto` mode. The check takes the surface colour. */
const checkCircle = svg`<svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
  <circle cx="8" cy="8" r="8" fill="currentColor" />
  <path class="check" d="M4.75 8.25 7 10.5l4.25-4.5" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

/** A dot in a ring: the active step in `auto` mode. */
const currentRing = svg`<svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
  <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="2" />
  <circle cx="8" cy="8" r="4" fill="currentColor" />
</svg>`;

export interface IndicatorInput {
  index: number;
  progress: StepProgress;
  status: StepStatus | undefined;
  disabled: boolean;
  preset: StepIndicatorPreset;
  /** The author slotted their own indicator. */
  custom: boolean;
  /** Where the author's indicator is projected (`<slot name="indicator">`); the summary has none. */
  customSlot: TemplateResult | typeof nothing;
}

/** The indicator element, or `nothing` for `indicator="none"`. */
export function renderIndicator(input: IndicatorInput): TemplateResult | typeof nothing {
  const {index, progress, status, disabled, preset, custom, customSlot} = input;
  if (preset === 'none' && !custom) return nothing;
  const active = progress === 'in-progress';
  const useCustom = custom && customSlot !== nothing;
  const statusGlyph =
    preset === 'auto' &&
    !useCustom &&
    !active &&
    (status === 'success' || status === 'warning' || status === 'error')
      ? status
      : null;
  const showNumber =
    !useCustom &&
    statusGlyph === null &&
    (preset === 'number' || (preset === 'auto' && progress === 'not-started'));
  const attributes = {progress, status: status ?? '', disabled};

  if (showNumber) {
    return html`<span
      class="indicator"
      part="indicator"
      aria-hidden="true"
      data-kind="number"
      data-progress=${attributes.progress}
      data-status=${attributes.status || nothing}
      ?data-disabled=${attributes.disabled}
      >${index + 1}</span
    >`;
  }
  const kind = useCustom ? 'custom' : statusGlyph ? 'status' : 'progress';
  let glyph: TemplateResult | typeof nothing;
  if (useCustom) glyph = customSlot;
  else if (statusGlyph) {
    glyph = html`<tct-icon name=${statusGlyph} size="sm" color="inherit"></tct-icon>`;
  } else glyph = progress === 'completed' ? checkCircle : currentRing;
  return html`<span
    class="indicator"
    part="indicator"
    aria-hidden="true"
    data-kind=${kind}
    data-progress=${attributes.progress}
    data-status=${(statusGlyph ?? attributes.status) || nothing}
    ?data-disabled=${attributes.disabled}
    >${glyph}</span
  >`;
}
