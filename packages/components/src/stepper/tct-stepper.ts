import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {AriaDelegateController} from '@tecton-wc/core/controllers/aria-delegate.js';
import {observeResize} from '@tecton-wc/core/controllers/resize.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {TctValueChangeEvent} from '@tecton-wc/core/events/tct-value-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import defaultMessages from '@tecton-wc/locales/en/stepper.js';
import {TctIconButton} from '../icon-button/tct-icon-button.js';
import base from '../styles/base.styles.css';
import {stepperContext, type StepperContextValue} from './stepper.context.js';
import {
  DEFAULT_MINIMUM_STEP_WIDTH,
  STEPPER_COLLAPSED_VARIANTS,
  STEPPER_DENSITIES,
  STEPPER_INDICATOR_POSITIONS,
  STEPPER_ORIENTATIONS,
  type StepperCollapsedVariant,
  type StepperDensity,
  type StepperIndicatorPosition,
  type StepperOrientation,
} from './stepper.types.js';
import parts from './stepper-parts.styles.css';
import styles from './tct-stepper.styles.css';
import type {TctStep} from './tct-step.js';

/**
 * A multi-step workflow: an ordered list of `tct-step` children, each showing its progress against the
 * stepper's `active-step` (completed, in progress, not started). It is a labelled list, not a `nav`
 * landmark: a stepper communicates progress through a sequence, not a set of site links. The active step is
 * `aria-current="step"`.
 *
 * With `navigable` (non-linear flows) an enabled step is a button; clicking it asks to activate that step
 * through the cancelable `tct-value-change` (`value` is the requested index), and the stepper applies it
 * unless prevented (a controlled use sets `active-step` itself).
 *
 * A horizontal stepper collapses when its steps no longer fit (each needs `minimum-step-width`): every
 * step shrinks to its track segment, and a summary of the active step shows below it, with previous and
 * next buttons in a navigable stepper (`collapsed-variant`). Step content stays mounted, hidden.
 *
 * @summary An ordered list of steps that shows progress through a sequence; steps can be clickable.
 * @tag tct-stepper
 * @upstream Stepper
 * @slot - `tct-step` children.
 * @csspart frame - The box around the list and the compact summary.
 * @csspart list - The ordered list of steps (upstream theming target `stepper`).
 * @csspart summary - The compact summary row (upstream theming target `stepper-summary`).
 * @cssprop --step-connector-gap - How far a connector stops short of its indicator, clamped to `--spacing-2`. Default 0px.
 * @fires {TctValueChangeEvent<number>} tct-value-change - Before a user click or a compact control activates a step; cancelable. `value` is the requested step index.
 * @cloakDisplay block
 */
export class TctStepper extends TctElement {
  static override readonly tagName = 'tct-stepper';
  static override readonly dependencies = [TctIconButton];
  static override styles: CSSResultGroup = [base, parts, styles];

  /** Zero-based index of the active step. */
  @property({type: Number, attribute: 'active-step'}) activeStep = 0;

  /** Direction the steps run in: `horizontal` (default) or `vertical`. */
  @property({reflect: true}) orientation: StepperOrientation = 'horizontal';

  /**
   * Makes enabled steps clickable (non-linear navigation): a click asks to activate that step. Without it
   * steps are plain text and the flow is driven by `active-step` alone.
   */
  @property({type: Boolean, reflect: true}) navigable = false;

  /** Accessible name of the list of steps. Default: the localized "Progress". A host `aria-label` wins. */
  @property() label = '';

  /** Vertical padding of every step: `compact`, `balanced` (default) or `spacious`. */
  @property({reflect: true}) density: StepperDensity = 'balanced';

  /**
   * Where each indicator sits: `separated` (default) in the label row, apart from the bar; `on-track`, a
   * node on the connector line with the label beside (vertical) or below (horizontal).
   */
  @property({reflect: true, attribute: 'indicator-position'})
  indicatorPosition: StepperIndicatorPosition = 'separated';

  /** Horizontal only: the width in px each step needs for its own label before the stepper collapses. */
  @property({type: Number, attribute: 'minimum-step-width'})
  minimumStepWidth = DEFAULT_MINIMUM_STEP_WIDTH;

  /**
   * Horizontal only, what a collapsed stepper shows: `with-label-and-controls` (default; the buttons appear
   * only when `navigable`), `with-label`, or `hidden-label` (the bare track).
   */
  @property({reflect: true, attribute: 'collapsed-variant'})
  collapsedVariant: StepperCollapsedVariant = 'with-label-and-controls';

  @state() private _width = 0;

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'stepper',
    defaults: defaultMessages,
  });
  #previous: number | undefined;
  #lastContext: StepperContextValue | undefined;
  #stopObserving: (() => void) | undefined;
  #observed: Element | null = null;
  #refreshPending = false;

  /**
   * A step asks to become active (a click or a compact control): the cancelable `tct-value-change` first,
   * then the index unless that was prevented. (Declared before the provider: its first value captures it.)
   */
  readonly #select = (index: number, reason: ChangeReason): void => {
    if (index === this.activeStep) return;
    if (this.dispatch(new TctValueChangeEvent<number>(index, this.activeStep, reason))) {
      this.activeStep = index;
    }
  };

  readonly #refresh = (): void => {
    if (this.#refreshPending) return;
    this.#refreshPending = true;
    queueMicrotask(() => {
      this.#refreshPending = false;
      this.#provider.setValue(this.#contextValue());
      this.requestUpdate();
    });
  };

  readonly #provider: ContextProvider<typeof stepperContext> = new ContextProvider<
    typeof stepperContext
  >(this, {
    context: stepperContext,
    initialValue: this.#contextValue(),
  });

  constructor() {
    super();
    new AriaDelegateController(this, {target: () => this.renderRoot.querySelector('.list')});
  }

  #steps(): TctStep[] {
    return [...this.children].filter((child): child is TctStep => child.localName === 'tct-step');
  }

  get #horizontal(): boolean {
    return this.orientation !== 'vertical';
  }

  /** A horizontal stepper collapses when the width each step gets falls below `minimum-step-width`. */
  get #compact(): boolean {
    const count = this.#steps().length;
    const minimum = Number.isFinite(this.minimumStepWidth) ? this.minimumStepWidth : DEFAULT_MINIMUM_STEP_WIDTH;
    return this.#horizontal && this._width > 0 && count > 0 && this._width / count < minimum;
  }

  #contextValue(): StepperContextValue {
    const active = Number.isFinite(this.activeStep) ? this.activeStep : 0;
    const next: StepperContextValue = {
      activeStep: active,
      previousActiveStep: this.#previous ?? active,
      orientation: this.#horizontal ? 'horizontal' : 'vertical',
      isNonLinear: this.navigable,
      density: STEPPER_DENSITIES.includes(this.density) ? this.density : 'balanced',
      indicatorPosition: STEPPER_INDICATOR_POSITIONS.includes(this.indicatorPosition)
        ? this.indicatorPosition
        : 'separated',
      isCompact: this.#compact,
      stepCount: this.#steps().length,
      select: this.#select,
      refresh: this.#refresh,
    };
    const last = this.#lastContext;
    // Keep the identity while nothing changed: every change re-renders every step.
    if (
      last?.activeStep === next.activeStep &&
      last.previousActiveStep === next.previousActiveStep &&
      last.orientation === next.orientation &&
      last.isNonLinear === next.isNonLinear &&
      last.density === next.density &&
      last.indicatorPosition === next.indicatorPosition &&
      last.isCompact === next.isCompact &&
      last.stepCount === next.stepCount
    ) {
      return last;
    }
    this.#lastContext = next;
    return next;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopObserving?.();
    this.#stopObserving = undefined;
    this.#observed = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.#observe();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('activeStep')) {
      // The step the flow came from: steps stagger their connector fill from it. An initial value has
      // nothing to travel from, so a stepper that mounts mid-flow does not animate.
      const before = changed.get('activeStep');
      this.#previous = typeof before === 'number' ? before : this.activeStep;
    }
    this.#warn(changed);
    this.#provider.setValue(this.#contextValue());
  }

  #warn(changed: PropertyValues<this>): void {
    for (const [name, value, allowed] of [
      ['orientation', this.orientation, STEPPER_ORIENTATIONS],
      ['density', this.density, STEPPER_DENSITIES],
      ['indicator-position', this.indicatorPosition, STEPPER_INDICATOR_POSITIONS],
      ['collapsed-variant', this.collapsedVariant, STEPPER_COLLAPSED_VARIANTS],
    ] as const) {
      const property = name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());
      if (changed.has(property as keyof TctStepper) && !(allowed as readonly string[]).includes(value)) {
        devWarn(`stepper:${name}:${value}`, `<tct-stepper ${name}="${value}"> is not one of ${allowed.join(', ')}.`);
      }
    }
  }

  protected override firstUpdated(): void {
    this.#observe();
  }

  protected override updated(): void {
    this.#observe();
    this.#checkDuplicates();
  }

  /** Two steps with the same index break `aria-current="step"` (both would read as active). */
  #checkDuplicates(): void {
    const seen = new Set<number>();
    for (const step of this.#steps()) {
      const index = step.index;
      if (seen.has(index)) {
        devWarn(
          `stepper:duplicate:${index}`,
          `Duplicate step index ${index}: two <tct-step> elements share the same \`step\` value. This breaks aria-current="step" and shows both as active.`,
        );
      }
      seen.add(index);
    }
  }

  /** Watches the list's width: what a step gets decides whether the labels can stay. */
  #observe(): void {
    const list = this.renderRoot.querySelector('.list');
    if (list === this.#observed) return;
    this.#stopObserving?.();
    this.#stopObserving = undefined;
    this.#observed = list;
    if (!list) return;
    // Deferred a frame: the width decides what the steps render, and changing layout inside the observer
    // callback ends the frame with "ResizeObserver loop completed with undelivered notifications".
    this.#stopObserving = observeResize(list, (entry) => {
      const target = entry.target as HTMLElement;
      requestAnimationFrame(() => {
        const width = target.clientWidth;
        if (!this.isConnected || width === this._width) return;
        this._width = width;
        this.#provider.setValue(this.#contextValue());
      });
    });
  }

  readonly #onSlotChange = (): void => {
    this.#provider.setValue(this.#contextValue());
    this.requestUpdate();
  };

  /** The nearest enabled step before or after the active one, or `null`. */
  #adjacent(delta: -1 | 1): number | null {
    let target: number | null = null;
    for (const step of this.#steps()) {
      if (step.disabled) continue;
      const index = step.index;
      if (delta === -1 ? index < this.activeStep && (target === null || index > target) : index > this.activeStep && (target === null || index < target)) {
        target = index;
      }
    }
    return target;
  }

  #renderControl(delta: -1 | 1): TemplateResult {
    const name = this.#locale.t(delta === -1 ? 'previousStep' : 'nextStep');
    return html`<tct-icon-button
      class="control"
      variant="ghost"
      label=${name}
      tooltip=${name}
      icon=${delta === -1 ? 'chevronLeft' : 'chevronRight'}
      ?disabled=${this.#adjacent(delta) === null}
      @click=${() => {
        // Resolved again at activation: a target that became disabled cannot be picked from a stale render.
        const target = this.#adjacent(delta);
        if (target !== null) this.#select(target, 'pointer');
      }}
    ></tct-icon-button>`;
  }

  #renderSummary(): TemplateResult | typeof nothing {
    const variant = STEPPER_COLLAPSED_VARIANTS.includes(this.collapsedVariant) ? this.collapsedVariant : 'with-label-and-controls';
    if (!this.#compact || variant === 'hidden-label') return nothing;
    const showsControls = variant === 'with-label-and-controls' && this.navigable;
    const active = this.#steps().find((step) => step.index === this.activeStep);
    // The list still carries every step's name and status: this visual row is hidden from assistive
    // technology so the current step is not announced twice.
    return html`<div class="summary" part="summary">
      ${showsControls ? this.#renderControl(-1) : nothing}
      <div class="summary-body" aria-hidden="true">${active ? active.renderSummary() : nothing}</div>
      ${showsControls ? this.#renderControl(1) : nothing}
    </div>`;
  }

  override render(): TemplateResult {
    return html`<div class="frame" part="frame" data-orientation=${this.#horizontal ? 'horizontal' : 'vertical'}>
      <ol
        class="list"
        part="list"
        role="list"
        aria-label=${this.label || this.#locale.t('label', undefined, 'label')}
        data-orientation=${this.#horizontal ? 'horizontal' : 'vertical'}
        data-position=${this.indicatorPosition === 'on-track' ? 'on-track' : 'separated'}
      >
        <slot @slotchange=${this.#onSlotChange}></slot>
      </ol>
      ${this.#renderSummary()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-stepper': TctStepper;
  }
}
