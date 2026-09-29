import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import selectorMessages from '@tecton-wc/locales/en/selector.js';
import {FocusTrapController} from '@tecton-wc/core/controllers/focus-trap.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {LayerController, type EscapeBehavior} from '@tecton-wc/core/layer/layer-controller.js';
import {PositionController} from '@tecton-wc/core/layer/position.js';
import type {Alignment, Placement} from '@tecton-wc/core/layer/position.js';
import type {Validator} from '@tecton-wc/core/mixins/form-control.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {getTabbables} from '@tecton-wc/core/utils/focus.js';
import type {FieldStatusVariant} from '../field/field.types.js';
import {oneOf} from '../field/field-utils.js';
import layer from '../styles/layer.styles.css';
import selectStyles from '../selector/tct-select-base.styles.css';
import {
  SELECTOR_ALIGNMENTS,
  SELECTOR_PLACEMENTS,
  SELECTOR_VARIANTS,
  type SelectorVariant,
} from '../selector/selector.types.js';
import {TctBoxControl} from '../text-area/tct-box-control.js';
import styles from './tct-complex-selector.styles.css';

/** The browser's own localized "Please fill out this field." from a probe. */
function missingMessage(): string {
  const probe = document.createElement('input');
  probe.required = true;
  return probe.validationMessage || 'Please fill out this field.';
}

/**
 * A field whose selection needs richer content than a list of rows: a trigger that opens a dialog
 * popover with **your** content (a grid of swatches, a staged editor, a calendar, a tree), and the shell
 * around it: the label, description and status of the field, the trigger and its state, focus moved into
 * the popover and back to the trigger, Escape and outside presses, and the busy state of an async change.
 *
 * The content is the default slot. It commits a choice with `commit(value)` and dismisses the popover with
 * `hide()`; a staged editor keeps its draft and calls `commit()` only from its Apply button. What the
 * content shows in the closed trigger is `trigger-label` (or the `trigger-label` slot for markup); the
 * placeholder shows while it is empty. The content owns its own accessible structure (a radio group, a
 * grid, a tree); the popover is a `role="dialog"` named by the label, and Tab stays inside it.
 *
 * It is form-associated: it submits `value` (a string) under `name`, takes part in constraint validation
 * (`required`: a value is needed), resets to the `value` attribute and restores. `input` and then
 * `change` fire when the content commits a different value; property writes fire nothing. A structured
 * value is encoded by you into the string (for example JSON). [mwg:form-associated-custom-elements]
 * [mwg:accessible-web-components] [mwg:animate-to-from-top-layer]
 *
 * @summary Field with a trigger that opens a dialog popover for custom selection content.
 * @tag tct-complex-selector
 * @upstream ComplexSelector
 * @slot - The popover's content: your selection surface.
 * @slot trigger-label - Rich content for the closed trigger; overrides the `trigger-label` attribute.
 * @slot start - Custom content at the start of the trigger; overrides the `start-icon` attribute.
 * @csspart field - The whole field: label, control and status.
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart label-icon - The icon before the label text.
 * @csspart input - The painted box around the trigger (upstream theming target `complex-selector`).
 * @csspart trigger - The button that opens the popover.
 * @csspart placeholder - The placeholder text while there is no trigger label.
 * @csspart value - The trigger label.
 * @csspart start-icon - The start icon.
 * @csspart indicator - The chevron (upstream target `complex-selector-indicator-icon`).
 * @csspart busy - The spinner of a busy selector.
 * @csspart status-icon - The status icon inside the box.
 * @csspart status-button - The status button of the `tooltip` status variant.
 * @csspart status - The status message box.
 * @csspart popup - The popover surface (upstream target `complex-selector-popup`).
 * @csspart content - The padded box that holds the slotted content.
 * @cssstate open - The popover is open.
 * @cssstate busy - `loading` is set or a change action is pending.
 * @cssstate user-invalid - Invalidity is displayed (after a change, a submit attempt or `reportValidity()`).
 * @cssstate invalid - The value does not satisfy its constraints (not displayed).
 * @fires input - Native, when the content commits a different value; composed.
 * @fires change - Native, once after `input`; composed and dispatched from the host.
 * @fires {TctOpenChangeEvent} tct-open-change - Before the user (trigger, ArrowDown, Escape, an outside press) or `requestClose()` opens or closes the popover; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After an open or close settled, however it happened (including the content calling `hide()`).
 * @cloakDisplay block
 * @cloakMinBlockSize 4.5rem
 */
export class TctComplexSelector extends TctBoxControl {
  static override readonly tagName = 'tct-complex-selector';
  static override styles: CSSResultGroup = [TctBoxControl.styles, layer, selectStyles, styles];

  /** `input` is the bordered form field (default); `ghost` is the borderless toolbar trigger. */
  @property({reflect: true}) variant: SelectorVariant = 'input';

  /** Text shown in the closed trigger for the current value (for markup use the `trigger-label` slot). */
  @property({attribute: 'trigger-label'}) triggerLabel = '';

  /** Name of an icon shown at the start of the trigger. */
  @property({attribute: 'start-icon'}) startIcon = '';

  /** Which side of the trigger the popover opens on. Logical: `start` and `end` follow the direction. */
  @property() placement: Placement = 'below';

  /** Alignment of the popover along the placement axis. */
  @property() alignment: Alignment = 'start';

  /** Whether the popover is open. Property and attribute writes never emit events. */
  @property({type: Boolean, reflect: true}) open = false;

  /**
   * Runs after every committed change, with the new value. While its promise is pending the selector is busy
   * (`:state(busy)`, a spinner and `aria-busy`) and shows the new value; if it rejects the value returns to
   * what it was.
   */
  @property({attribute: false}) changeAction: ((value: string) => void | Promise<void>) | undefined;

  /** Opens the popover without an intent event; resolves once it settled. */
  async show(): Promise<void> {
    if (this.#blocked) return;
    this.open = true;
    await this.updateComplete;
    await this.#settled;
  }

  /** Closes the popover without an intent event (what content calls to dismiss itself); resolves once hidden. */
  async hide(): Promise<void> {
    this.open = false;
    await this.updateComplete;
    await this.#settled;
  }

  /** Opens or closes the popover (`force` picks the state) without an intent event. */
  toggle(force?: boolean): Promise<void> {
    return (force ?? !this.open) ? this.show() : this.hide();
  }

  /** Asks to close as the user would: fires the cancelable `tct-open-change` and honours a cancel. */
  requestClose(reason: ChangeReason = 'request'): void {
    if (this.open) this.#request(false, reason);
  }

  /**
   * Commits `value` from the content: sets it, fires `input` then `change` when it differs, and runs
   * `changeAction`. Returns `false` (and does nothing) while the selector is disabled or read-only.
   */
  commit(value: string): boolean {
    if (this.#blocked) return false;
    const previous = this.value;
    const next = String(value);
    if (next === previous) return true;
    this.value = next;
    this.syncFormState();
    this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    this.redispatchChange();
    this.#runChangeAction(next, previous);
    return true;
  }

  // ------------------------------------------------------------------------ internals

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'selector',
    defaults: selectorMessages,
  });
  readonly #slots: SlotController = new SlotController(this, 'trigger-label', 'start');
  #settled: Promise<void> = Promise.resolve();
  #mountedOpen = false;

  readonly #position: PositionController = new PositionController(this, {
    surface: () => this.#layerElement,
    anchor: () => this.#box,
    placement: () => ({
      placement: this.#placement,
      alignment: oneOf(this.alignment, SELECTOR_ALIGNMENTS, 'start'),
      offset: 'var(--spacing-1)',
    }),
    matchAnchorWidth: 'min',
    trackPlacement: true,
  });

  readonly #layer: LayerController = new LayerController(this, {
    kind: 'popover',
    surface: () => this.#layerElement,
    trigger: () => this.formControl,
    haspopup: 'dialog',
    inside: () => [this.#box],
    escape: (): EscapeBehavior => 'close',
    initialFocus: () => (this.#mountedOpen ? null : this.#initialFocusTarget()),
    exitAnimation: () => this.#exitAnimation(),
    position: this.#position,
    onDismissRequest: (reason) => {
      this.#request(false, reason);
    },
    onNativeClose: () => {
      this.open = false;
    },
  });

  constructor() {
    super();
    // Tab stays inside the open popover (it is a dialog that is not modal): the content owns its own controls.
    new FocusTrapController(this, {
      container: () => this.#surface,
      active: () => this.open,
    });
  }

  get #layerElement(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.layer');
  }

  get #surface(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.surface');
  }

  get #box(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.input-wrapper');
  }

  get #placement(): Placement {
    return SELECTOR_PLACEMENTS.includes(this.placement) ? this.placement : 'below';
  }

  get #blocked(): boolean {
    return this.isDisabled || this.readonly;
  }

  protected override get formControl(): HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLButtonElement>('button.trigger');
  }

  protected override get submitsOnEnter(): boolean {
    return false;
  }

  protected override get effectiveStatusVariant(): FieldStatusVariant {
    const variant = super.effectiveStatusVariant;
    return this.variant === 'ghost' && variant === 'attached' ? 'detached' : variant;
  }

  protected override get validators(): Validator<this>[] {
    return [
      (field) =>
        field.required && !field.optional && field.value === ''
          ? {flags: {valueMissing: true}, message: missingMessage()}
          : null,
    ];
  }

  override focus(options?: FocusOptions): void {
    const control = this.formControl;
    if (control) control.focus(options);
    else super.focus(options);
  }

  #request(open: boolean, reason: ChangeReason): boolean {
    if (open && this.#blocked) return false;
    if (open === this.open) return true;
    if (!this.dispatch(new TctOpenChangeEvent(open, reason))) return false;
    this.open = open;
    return true;
  }

  /** The first control of the content (a dialog's own first field), else the surface. */
  #initialFocusTarget(): HTMLElement | null {
    const surface = this.#surface;
    if (!surface) return null;
    return getTabbables(surface)[0] ?? surface;
  }

  #exitAnimation(): Animation[] {
    const layerElement = this.#layerElement;
    if (!layerElement || matchMedia('(prefers-reduced-motion: reduce)').matches) return [];
    return [layerElement.animate([{opacity: 1}, {opacity: 0}], {duration: 120, easing: 'ease-in'})];
  }

  #runChangeAction(next: string, previous: string): void {
    const action = this.changeAction;
    if (!action) return;
    const settled = this.trackAction(action(next));
    if (!settled) return;
    void settled.then((ok) => {
      this.settleAction();
      if (!ok && this.value === next) this.value = previous;
    });
  }

  // ------------------------------------------------------------------------ lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('variant') && !SELECTOR_VARIANTS.includes(this.variant)) {
      devWarn(
        `tct-complex-selector:variant:${this.variant}`,
        `variant "${this.variant}" is not one of ${SELECTOR_VARIANTS.join(', ')}.`,
      );
    }
    if (changed.has('placement') && !SELECTOR_PLACEMENTS.includes(this.placement)) {
      devWarn(
        `tct-complex-selector:placement:${this.placement}`,
        `placement "${this.placement}" is not one of ${SELECTOR_PLACEMENTS.join(', ')}.`,
      );
    }
    // Caller policy: an open popover closes when the control stops being editable.
    if (this.open && this.#blocked) this.open = false;
  }

  protected override firstUpdated(): void {
    this.#mountedOpen = this.open;
    if (!this.hasAttribute('autofocus')) return;
    void this.updateComplete.then(() => {
      this.focus({preventScroll: true});
    });
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.toggleState('open', this.open);
    if (changed.has('open')) this.#syncLayer(changed.get('open'));
    else if (this.open && (changed.has('placement') || changed.has('alignment'))) {
      this.#position.update();
    }
  }

  #syncLayer(previousOpen: boolean | undefined): void {
    // The first update of a closed selector is not a change.
    if (previousOpen === undefined && !this.open) return;
    const settled = this.open ? this.#layer.show() : this.#layer.hide();
    this.#settled = settled.then(() => {
      this.#mountedOpen = false;
      if (this.open === this.#layer.isOpen) this.dispatch(new TctAfterOpenChangeEvent(this.open));
    });
  }

  // ------------------------------------------------------------------------ rendering

  protected override render(): TemplateResult {
    const surface = html`<div
      class="layer layer-surface"
      popover="manual"
      data-placement=${this.#placement}
    >
      <div
        class="surface"
        part="popup"
        id=${this.ids.id('popup')}
        role="dialog"
        aria-modal="true"
        aria-label=${this.label}
        tabindex="-1"
        data-size=${this.fieldSize}
      >
        <div class="content" part="content"><slot></slot></div>
      </div>
    </div>`;
    return html`${this.renderFieldLayout(this.renderBoxWrapper(this.#renderContent()))}${surface}`;
  }

  #renderContent(): TemplateResult {
    const status = this.effectiveStatus;
    const rendered = status ? this.renderStatusIcon() : nothing;
    const statusIcon =
      rendered !== nothing && this.effectiveStatusVariant === 'tooltip'
        ? html`<span class="status-adornment" @click=${this.#stopClick}>${rendered}</span>`
        : rendered;
    const slots = this.#slots;
    return html`
      ${
        slots.has('start')
          ? html`<span class="start-slot"><slot name="start"></slot></span>`
          : this.startIcon
            ? html`<tct-icon
                class="start-icon"
                part="start-icon"
                name=${this.startIcon}
                size="sm"
                color="secondary"
              ></tct-icon>`
            : nothing
      }
      ${this.#renderTrigger()} ${this.renderBusy()}
      ${
        statusIcon !== nothing
          ? statusIcon
          : this.readonly && !this.isDisabled
            ? nothing
            : html`<tct-icon
                class="chevron"
                part="indicator"
                name="chevronDown"
                size="sm"
                color="secondary"
                ?data-open=${this.open}
              ></tct-icon>`
      }
    `;
  }

  #renderTrigger(): TemplateResult {
    const inert = this.showsDisabledMessage;
    const hasLabel = this.triggerLabel !== '' || this.#slots.has('trigger-label');
    return html`<button
      class="trigger"
      part="trigger"
      type="button"
      aria-haspopup=${ifDefined(this.readonly && !this.isDisabled ? undefined : 'dialog')}
      aria-expanded=${String(this.open)}
      aria-controls=${ifDefined(this.open ? this.ids.id('popup') : undefined)}
      aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
      aria-labelledby=${ifDefined(this.groupLabelId)}
      aria-disabled=${ifDefined(inert ? 'true' : undefined)}
      ?disabled=${this.isDisabled && !inert}
      @click=${this.#onTriggerClick}
      @keydown=${this.#onTriggerKeyDown}
    >
      ${
        hasLabel
          ? html`<span class="value" part="value"
              ><slot name="trigger-label">${this.triggerLabel}</slot></span
            >`
          : html`<span class="placeholder" part="placeholder"
              >${this.placeholder || this.#locale.t('@tct.selector.placeholder')}</span
            >`
      }
    </button>`;
  }

  // ------------------------------------------------------------------------ events

  /** A status button (the `tooltip` variant) reveals its message; it is not a press on the trigger. */
  readonly #stopClick = (event: Event): void => {
    event.stopPropagation();
  };

  readonly #onTriggerClick = (): void => {
    if (this.#blocked) return;
    // The press that just dismissed the popover must not reopen it.
    if (this.#layer.wasJustDismissed()) return;
    this.#request(!this.open, 'trigger');
  };

  readonly #onTriggerKeyDown = (event: KeyboardEvent): void => {
    if (event.isComposing || event.keyCode === 229 || this.#blocked) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowDown' && !this.open) {
      event.preventDefault();
      this.#request(true, 'keyboard');
    } else if (event.key === 'Escape' && this.open) {
      event.preventDefault();
      this.#request(false, 'escape');
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-complex-selector': TctComplexSelector;
  }
}
