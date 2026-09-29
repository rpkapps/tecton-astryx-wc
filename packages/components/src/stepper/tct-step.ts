import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import defaultStepMessages from '@tecton-wc/locales/en/step.js';
import {TctIcon} from '../icon/tct-icon.js';
import base from '../styles/base.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {renderIndicator, type StepProgress} from './step-parts.js';
import {stepperContext, type StepperContextValue} from './stepper.context.js';
import {
  STEP_INDICATORS,
  STEP_STATUSES,
  STEPPER_DENSITIES,
  type StepIndicatorPreset,
  type StepperDensity,
  type StepStatus,
} from './stepper.types.js';
import parts from './stepper-parts.styles.css';
import styles from './tct-step.styles.css';

/** Share of one node-to-node span owned by the segment arriving at the far node (upstream constants). */
const ARRIVAL_SHARE_HORIZONTAL = 0.5;
const ARRIVAL_SHARE_VERTICAL = 0.3;
/** Of the leaving half: the part drawn by the rail beside the indicator, when a content slot splits it. */
const RAIL_SHARE_OF_LEAVING = 0.25;

/** Scales a CSS `<time>` by a unitless factor, collapsing the trivial cases. */
function timeSlice(time: string, factor: number): string {
  if (factor <= 0) return '0s';
  if (factor === 1) return time;
  return `calc(${time} * ${Number(factor.toFixed(4))})`;
}

/**
 * One step of a `tct-stepper`: a list item with a progress segment, an indicator (a number, a check once
 * completed, a status glyph or your own), a `label`, an optional `description` and content below. Its
 * progress (completed, in progress, not started) comes from the stepper's `active-step` and this step's
 * index (`step`, or its position when unset). The active step is `aria-current="step"`.
 *
 * In a `navigable` stepper an enabled step is a button named "Go to step N: label" (plus its status word);
 * clicking it asks the stepper to activate it. The status also reaches assistive technology as text
 * ("completed", "warning", "error") next to the label, because the indicator glyphs are decorative.
 *
 * @summary One step of a stepper: indicator, label, description and content.
 * @tag tct-step
 * @upstream Step
 * @slot - Content below the label and description (form fields of the step). Stays mounted, hidden, when a horizontal stepper is compact.
 * @slot end - Trailing content in the label row (a timestamp or a chip).
 * @slot indicator - Your own indicator (an icon), replacing the built-in one.
 * @csspart step - The painted step.
 * @csspart bar - The progress segment of a separated step.
 * @csspart connector - A progress segment of an on-track step.
 * @csspart indicator - The indicator (upstream theming target `step-indicator`).
 * @csspart label - The label text (upstream theming target `step-label`).
 * @csspart description - The description text (upstream theming target `step-description`).
 * @cssprop --step-connector-gap - Set on the stepper: how far a connector stops short of the indicator. Default 0px.
 * @cssstate active - This is the active step.
 * @cssstate completed - This step is before the active one.
 * @cssstate disabled - The step cannot be clicked.
 * @cloakDisplay flex
 */
export class TctStep extends TctElement {
  static override readonly tagName = 'tct-step';
  static override readonly dependencies = [TctIcon];
  static override styles: CSSResultGroup = [base, visuallyHidden, parts, styles];

  /**
   * Zero-based index of this step, compared with the stepper's `active-step`. Unset: the step's position
   * among its siblings.
   */
  @property({type: Number}) step: number | undefined;

  /** Text of the step; it is also the button's name in a navigable stepper. Required. */
  @property() label = '';

  /** Supporting text under the label. */
  @property() description = '';

  /**
   * `accent` (colour only), `success`, `warning` or `error`: recolours the indicator and, in `auto` mode,
   * swaps in a matching glyph. The status word joins the accessible name. Never recolours the connector.
   */
  @property({reflect: true}) status: StepStatus | undefined;

  /** `auto` (default: a number until completed, then a check), `number`, or `none`. Slot your own into `indicator`. */
  @property({reflect: true}) indicator: StepIndicatorPreset = 'auto';

  /** Disables clicking this step in a navigable stepper (and skips it in the compact controls). */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** Marks the step optional: "Optional" follows the label. */
  @property({type: Boolean, reflect: true}) optional = false;

  /** Vertical padding of this step. Unset: the stepper's `density`. */
  @property({reflect: true}) density: StepperDensity | undefined;

  readonly #context: ContextConsumer<typeof stepperContext> = new ContextConsumer<
    typeof stepperContext
  >(this, {context: stepperContext, subscribe: true});
  readonly #slots: SlotController = new SlotController(this, 'default', 'end', 'indicator');
  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'step',
    defaults: defaultStepMessages,
  });

  constructor() {
    super();
    this.internals.role = 'listitem';
  }

  /** The step's index: `step`, else its position among the stepper's steps. */
  get index(): number {
    if (this.step !== undefined && Number.isFinite(this.step)) return this.step;
    const steps = [...(this.parentElement?.children ?? [])].filter(
      (child) => child.localName === 'tct-step',
    );
    return Math.max(0, steps.indexOf(this));
  }

  get #ctx(): StepperContextValue | null {
    return this.#context.value ?? null;
  }

  get #progress(): StepProgress {
    const active = this.#ctx?.activeStep ?? -1;
    const index = this.index;
    return index === active ? 'in-progress' : index < active ? 'completed' : 'not-started';
  }

  /** Whether this is the stepper's active step. */
  get active(): boolean {
    return this.#progress === 'in-progress';
  }

  get #resolvedStatus(): StepStatus | undefined {
    return this.status && STEP_STATUSES.includes(this.status) ? this.status : undefined;
  }

  get #preset(): StepIndicatorPreset {
    return STEP_INDICATORS.includes(this.indicator) ? this.indicator : 'auto';
  }

  get #density(): StepperDensity {
    const own = this.density;
    if (own && STEPPER_DENSITIES.includes(own)) return own;
    return this.#ctx?.density ?? 'balanced';
  }

  /** The visually hidden word that carries the status the glyph shows (never the glyph alone). */
  get #statusText(): string | null {
    const status = this.#resolvedStatus;
    if (status === 'error') return this.#locale.t('status.error');
    if (status === 'warning') return this.#locale.t('status.warning');
    if (status === 'success' || this.#progress === 'completed')
      return this.#locale.t('status.completed');
    return null;
  }

  get #clickable(): boolean {
    const ctx = this.#ctx;
    return !!ctx && ctx.isNonLinear && !this.disabled && !ctx.isCompact;
  }

  /**
   * Whether the step is currently a clickable button (a stepper reads it to decide about its controls).
   * @internal
   */
  get isClickable(): boolean {
    return this.#clickable;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    this.internals.ariaCurrent = this.active ? 'step' : null;
    this.internals.ariaDisabled = this.disabled ? 'true' : null;
    for (const [name, value, allowed] of [
      ['status', this.status, STEP_STATUSES],
      ['indicator', this.indicator, STEP_INDICATORS],
      ['density', this.density, STEPPER_DENSITIES],
    ] as const) {
      if (
        changed.has(name) &&
        value !== undefined &&
        !(allowed as readonly string[]).includes(value)
      ) {
        devWarn(
          `step:${name}:${value}`,
          `<tct-step ${name}="${value}"> is not one of ${allowed.join(', ')}.`,
        );
      }
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    this.toggleState('active', this.active);
    this.toggleState('completed', this.#progress === 'completed');
    this.toggleState('disabled', this.disabled);
    // The stepper derives its compact summary, controls and duplicate checks from its steps.
    if (
      changed.has('step') ||
      changed.has('label') ||
      changed.has('description') ||
      changed.has('status') ||
      changed.has('indicator') ||
      changed.has('disabled') ||
      changed.has('optional')
    ) {
      this.#ctx?.refresh();
    }
  }

  // ------------------------------------------------------------------------------ rendering

  #onClick = (event: MouseEvent): void => {
    const ctx = this.#ctx;
    if (!ctx || !this.#clickable || event.defaultPrevented) return;
    // A keyboard activation of a native button arrives as a click with `detail === 0`.
    ctx.select(this.index, event.detail === 0 ? 'keyboard' : 'pointer');
  };

  #indicator(customSlot: boolean): TemplateResult | typeof nothing {
    return renderIndicator({
      index: this.index,
      progress: this.#progress,
      status: this.#resolvedStatus,
      disabled: this.disabled,
      preset: this.#preset,
      custom: this.#slots.has('indicator'),
      customSlot: customSlot ? html`<slot name="indicator"></slot>` : nothing,
    });
  }

  #label(): TemplateResult {
    return html`<span
      class="label"
      part="label"
      data-progress=${this.#progress}
      ?data-disabled=${this.disabled}
      >${this.label}</span
    >`;
  }

  #statusWord(): TemplateResult | typeof nothing {
    const text = this.#statusText;
    return text ? html`<span class="visually-hidden">${text}</span>` : nothing;
  }

  #optional(): TemplateResult | typeof nothing {
    return this.optional
      ? html`<span class="optional-dot" aria-hidden="true">•</span
          ><span class="optional">${this.#locale.t('optional')}</span>`
      : nothing;
  }

  #description(): TemplateResult | typeof nothing {
    return this.description
      ? html`<span class="description" part="description" data-progress=${this.#progress}
          >${this.description}</span
        >`
      : nothing;
  }

  /** Whether the step draws an indicator (the description and content indent past it). */
  get #hasIndicator(): boolean {
    return this.#preset !== 'none' || this.#slots.has('indicator');
  }

  /** Content below the label; stays mounted (hidden) while a horizontal stepper is compact. */
  #hasContent(): boolean {
    return this.#slots.has('default');
  }

  /** The label row: indicator (separated layout), label, status word, optional, end content. */
  #labelRow(withIndicator: boolean): TemplateResult {
    return html`<span class="row"
      >${withIndicator ? this.#indicator(true) : nothing}${this.#label()}${this.#statusWord()}${this.#optional()}${
        this.#slots.has('end') ? html`<span class="end"><slot name="end"></slot></span>` : nothing
      }</span
    >`;
  }

  /** The accessible name of a clickable step: "Go to step 2: Payment, completed". */
  #buttonName(): string {
    const status = this.#statusText;
    const stepNumber = this.index + 1;
    return status
      ? this.#locale.t('goToStepWithStatus', {stepNumber, label: this.label, status})
      : this.#locale.t('goToStep', {stepNumber, label: this.label});
  }

  /** Wraps the interactive area: a button in a navigable stepper, a plain block otherwise. */
  #interactive(kind: string, inner: TemplateResult): TemplateResult {
    return this.#clickable
      ? html`<button
          type="button"
          class=${kind}
          aria-label=${this.#buttonName()}
          @click=${this.#onClick}
        >
          ${inner}
        </button>`
      : html`<div class=${kind}>${inner}</div>`;
  }

  /** Timing of one connector segment: only advancing a single step animates, on the span it crosses. */
  #timing(spanIndex: number, offset: number, share: number): Record<string, string> {
    const ctx = this.#ctx;
    const single = !!ctx && ctx.activeStep === ctx.previousActiveStep + 1;
    if (!single || spanIndex !== ctx.previousActiveStep)
      return {'--_fill-duration': '0s', '--_fill-delay': '0s'};
    const span = 'var(--duration-medium)';
    return {'--_fill-duration': timeSlice(span, share), '--_fill-delay': timeSlice(span, offset)};
  }

  #segment(kind: string, filled: boolean, timing: Record<string, string>): TemplateResult {
    return html`<span
      class="seg"
      part=${kind === 'bar' ? 'bar' : 'connector'}
      data-kind=${kind}
      ?data-filled=${filled}
      aria-hidden="true"
      style=${styleMap(timing)}
    ></span>`;
  }

  #renderSeparated(): TemplateResult {
    const ctx = this.#ctx;
    const vertical = ctx?.orientation === 'vertical';
    const compact = !!ctx?.isCompact && !vertical;
    const filled = this.#progress !== 'not-started';
    const bar = this.#segment('bar', filled, this.#timing(this.index - 1, 0, 1));
    const description = this.#description();
    const header = compact
      ? html`<span class="visually-hidden">${this.label}</span>${this.#statusWord()}`
      : this.#interactive(
          'header',
          html`${this.#labelRow(true)}${
            description === nothing
              ? nothing
              : html`<span class="description-row">${description}</span>`
          }`,
        );
    const content = this.#hasContent()
      ? html`<div class="content" ?hidden=${compact}><slot></slot></div>`
      : nothing;
    return vertical
      ? html`${bar}
          <div class="body">${header}${content}</div>`
      : html`${bar}${header}${content}`;
  }

  #renderOnTrack(): TemplateResult {
    const ctx = this.#ctx;
    const vertical = ctx?.orientation === 'vertical';
    const compact = !!ctx?.isCompact && !vertical;
    const index = this.index;
    const active = ctx?.activeStep ?? -1;
    const beforeFilled = index <= active;
    const afterFilled = index < active;
    const arrival = vertical ? ARRIVAL_SHARE_VERTICAL : ARRIVAL_SHARE_HORIZONTAL;
    const leaving = 1 - arrival;
    const hasContentSegment = vertical && this.#hasContent();
    const railShare = leaving * (hasContentSegment ? RAIL_SHARE_OF_LEAVING : 1);
    const contentShare = leaving - railShare;
    const lead = this.#segment('lead', beforeFilled, this.#timing(index - 1, leaving, arrival));
    const rail = this.#segment('rail', afterFilled, this.#timing(index, 0, railShare));
    const indicator = this.#indicator(true);
    const labelLine = html`<span class="row" data-align=${vertical ? 'start' : 'center'}
      >${this.#label()}${this.#statusWord()}${this.#optional()}${
        this.#slots.has('end') ? html`<span class="end"><slot name="end"></slot></span>` : nothing
      }</span
    >`;

    if (vertical) {
      const content = this.#hasContent()
        ? html`<div class="ot-content-wrap">
            ${this.#segment('content', afterFilled, this.#timing(index, railShare, contentShare))}
            <div class="content"><slot></slot></div>
          </div>`
        : nothing;
      return html`${this.#interactive(
        'ot-wrap',
        html`<span class="ot-column">${lead}${indicator}${rail}</span
          ><span class="ot-body">${labelLine}${this.#description()}</span>`,
      )}${content}`;
    }
    return html`${this.#interactive(
      'ot-wrap',
      html`<span class="track-row">${lead}${indicator}${rail}</span>${
          compact ? nothing : html`<span class="ot-label">${labelLine}${this.#description()}</span>`
        }`,
    )}${compact ? html`<span class="visually-hidden">${this.label}</span>${this.#statusWord()}` : nothing}${
      this.#hasContent()
        ? html`<div class="content" ?hidden=${compact}><slot></slot></div>`
        : nothing
    }`;
  }

  /**
   * The compact summary the stepper shows for the active step: indicator (separated layout), label,
   * "Optional" and the description. Rendered by the stepper in its own shadow root with the same classes.
   * A custom slotted indicator is replaced by the progress glyph there (a slot cannot be projected twice).
   * @internal
   */
  renderSummary(): TemplateResult {
    const withIndicator = this.#ctx?.indicatorPosition !== 'on-track';
    return html`<span class="summary-step" part="summary" data-progress=${this.#progress}>
      <span class="row"
        >${withIndicator ? this.#indicator(false) : nothing}${this.#label()}${this.#optional()}</span
      >${this.#description()}
    </span>`;
  }

  override render(): TemplateResult {
    const ctx = this.#ctx;
    const onTrack = ctx?.indicatorPosition === 'on-track';
    const vertical = ctx?.orientation === 'vertical';
    return html`<div
      class="step"
      part="step"
      data-orientation=${vertical ? 'vertical' : 'horizontal'}
      data-position=${onTrack ? 'on-track' : 'separated'}
      data-progress=${this.#progress}
      data-status=${this.#resolvedStatus ?? nothing}
      data-density=${this.#density}
      ?data-disabled=${this.disabled}
      ?data-has-indicator=${this.#hasIndicator}
      ?data-compact=${!!ctx?.isCompact && !vertical}
      ?data-clickable=${this.#clickable}
    >
      ${onTrack ? this.#renderOnTrack() : this.#renderSeparated()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-step': TctStep;
  }
}
