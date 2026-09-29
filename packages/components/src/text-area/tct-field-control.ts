import {html, nothing, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import fieldMessages from '@tecton-wc/locales/en/field.js';
import inputMessages from '@tecton-wc/locales/en/input.js';
import {resolveIdRefs, setAriaElements} from '@tecton-wc/core/controllers/aria-delegate.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {
  formLayoutContext,
  inputGroupContext,
  type ElementSize,
} from '@tecton-wc/core/context/keys.js';
import {FieldChromeController} from '@tecton-wc/core/controllers/field-chrome.js';
import {features} from '@tecton-wc/core/features.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {FormControlMixin} from '@tecton-wc/core/mixins/form-control.js';
import {TctElement, type TctElementConstructor} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {IdController} from '@tecton-wc/core/utils/id.js';
import {
  INPUT_STATUS_TYPES,
  type FieldStatusVariant,
  type InputStatus,
  type InputStatusType,
} from '../field/field.types.js';
import {renderLabelTip} from '../field/field-label-tip.js';
import {lengthConverter, oneOf, toCssLength} from '../field/field-utils.js';
import {TctFieldDescription} from '../field/tct-field-description.js';
import {TctFieldLabel} from '../field/tct-field-label.js';
import {TctFieldStatus} from '../field-status/tct-field-status.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctSpinner} from '../spinner/tct-spinner.js';
import {TctTooltip} from '../tooltip/tct-tooltip.js';

/** Attributes forwarded to the inner control that are not reactive properties: a change re-renders. */
export const FORWARDED_ATTRIBUTES = ['aria-describedby'] as const;

/**
 * The shared body of the form controls that draw field chrome around a native control in their own
 * shadow root (checkbox, switch, text area, number input, file input): the label, description, status
 * and the platform wiring between them and the control. It is the part of `tct-text-input` that these
 * controls have in common, kept in one place so they behave identically.
 *
 *  - **chrome**: label (with the "Required"/"Optional" indicator), description and status share the
 *    control's shadow root, so every id relationship stays inside one tree; `aria-describedby` is built
 *    from the chrome's ids, the hidden helper text (a disabled reason, a status tooltip) and the host's
 *    own `aria-describedby`, whose ids live in the host's tree and can only be element references from a
 *    shadow control;
 *  - **slotted-control mode** (`slottedControl`): the author's own native control is the participant and
 *    the chrome becomes owned light-DOM satellites next to it (A§9.8);
 *  - **disabled reason**: with `disabled-message` the control stays focusable through `aria-disabled` and
 *    a tooltip explains why (upstream `disabledMessage`);
 *  - **busy**: `loading` or a pending change action (`:state(busy)`, `aria-busy`).
 *
 * @internal
 * @summary Base of the form controls with field chrome.
 */
export abstract class TctFieldControl extends FormControlMixin(TctElement) {
  static override readonly dependencies: readonly TctElementConstructor[] = [
    TctFieldLabel,
    TctFieldDescription,
    TctFieldStatus,
    TctIcon,
    TctSpinner,
    TctTooltip,
  ];
  static override shadowRootOptions = {...TctElement.shadowRootOptions, delegatesFocus: true};

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, ...FORWARDED_ATTRIBUTES];
  }

  /** The label (always rendered for accessibility; hide it visually with `label-hidden`). */
  @property() label = '';

  /** Hides the label and description visually while keeping them for assistive technology. */
  @property({type: Boolean, reflect: true, attribute: 'label-hidden'}) labelHidden = false;

  /** Helper text next to the label. */
  @property() description = '';

  /** Optional field: an "Optional" indicator. Wins over `required`. */
  @property({type: Boolean}) optional = false;

  /**
   * Explains why the control is disabled. With `disabled` it shows a tooltip on hover and keyboard
   * focus and keeps the control focusable (through `aria-disabled`; nothing can be changed), so the
   * reason is discoverable. Use this instead of wrapping a disabled control in a tooltip.
   */
  @property({attribute: 'disabled-message'}) disabledMessage = '';

  /** Puts the control in a loading state: a spinner and `aria-busy`; it cannot be changed meanwhile. */
  @property({type: Boolean, reflect: true}) loading = false;

  /** Text of an info tip shown as a small icon button after the label. */
  @property({attribute: 'label-tooltip'}) labelTooltip = '';

  /** The kind of status: draws the status colour, icon and (with a message) the message. */
  @property({attribute: 'status-type'}) statusType: InputStatusType | undefined;

  /** The status message. Without it the status is only the colour and the icon. */
  @property({attribute: 'status-message'}) statusMessage = '';

  /**
   * The status as an object (upstream `status`): `{type, message}`. Reading gives the current
   * `status-type` and `status-message`; writing sets both.
   */
  @property({attribute: false})
  get status(): InputStatus | undefined {
    return this.statusType ? {type: this.statusType, message: this.statusMessage} : undefined;
  }
  set status(value: InputStatus | undefined) {
    this.statusType = value?.type;
    this.statusMessage = value?.message ?? '';
  }

  /**
   * Width of the whole field, label, control and status alike. A number is px, a string is a CSS length.
   */
  @property({converter: lengthConverter}) width: number | string | undefined;

  /** Document-unique ids for the helper text and the group label. @internal */
  protected readonly ids: IdController = new IdController(this, 'tct-field-control');
  /** Field and input message catalogs (indicator, info tip, status buttons). @internal */
  protected readonly fieldLocale: LocaleController = new LocaleController(this, {
    namespace: 'field',
    defaults: {...fieldMessages, ...inputMessages},
  });
  /** The enclosing form layout (default optionality, horizontal labels). @internal */
  protected readonly layoutContext: ContextConsumer<typeof formLayoutContext> = new ContextConsumer<
    typeof formLayoutContext
  >(this, {
    context: formLayoutContext,
    subscribe: true,
  });
  /** The enclosing input group, when there is one. @internal */
  protected readonly groupContext: ContextConsumer<typeof inputGroupContext> = new ContextConsumer<
    typeof inputGroupContext
  >(this, {
    context: inputGroupContext,
    subscribe: true,
  });
  /** Label, description and status: shadow templates, or satellites in slotted-control mode. @internal */
  protected readonly chrome: FieldChromeController = new FieldChromeController(this, {
    mode: () => (this.slottedControl ? 'light' : 'shadow'),
    control: () => this.chromeTarget,
    state: () => ({
      label: this.label,
      labelHidden: this.labelHidden,
      description: this.description || undefined,
      status: this.effectiveStatus,
      statusVariant: this.effectiveStatusVariant,
      required: this.required,
      optional: this.optional,
      disabled: this.isDisabled,
      size: this.fieldSize,
      groupLabel: this.groupLabel,
    }),
  });

  /** Helper element ids currently written into `aria-describedby` by this control (not by the chrome). */
  #extras = new Set<string>();
  #wroteRefs = false;
  #pending = 0;

  // ------------------------------------------------------------------------------- hooks

  /**
   * The element the chrome wires `aria-labelledby` and `aria-describedby` on (default: the form control).
   * A composite whose form control is one of several parts (the thumbs of a range slider) points it at the
   * element that carries the group's name and description.
   */
  protected get chromeTarget(): HTMLElement | null {
    return this.formControl;
  }

  /** The size the chrome (label type scale) follows. */
  protected abstract get fieldSize(): ElementSize;

  /** The author's own native control (slotted-control mode), or `null` in the default shadow mode. */
  protected get slottedControl(): HTMLElement | null {
    return null;
  }

  /** How the status message is placed. Toggles always place it `detached`. */
  protected get effectiveStatusVariant(): FieldStatusVariant {
    return 'detached';
  }

  /** The chrome's label is a group caption (a `<span>`) and the group takes `aria-labelledby`. */
  protected get groupLabel(): boolean {
    return false;
  }

  /** Called after every update, before `aria-describedby` is written: control-specific attribute sync. */
  protected syncControlAttributes(): void {
    // Nothing by default.
  }

  // ---------------------------------------------------------------------------------- derived

  /**
   * The status in effect: your own, else the browser's validation message while invalidity is
   * displayed (frozen while the control has focus, so it is not rewritten on every keystroke).
   */
  protected get effectiveStatus(): InputStatus | undefined {
    if (this.statusType) return {type: this.statusType, message: this.statusMessage || undefined};
    const message = this.displayedValidationMessage;
    return message ? {type: 'error', message} : undefined;
  }

  /** An error status of your own is displayed like a user-invalid control. */
  override get showInvalid(): boolean {
    return super.showInvalid || this.statusType === 'error';
  }

  protected get showsDisabledMessage(): boolean {
    return this.isDisabled && this.disabledMessage !== '';
  }

  /**
   * A disabled control that stays focusable (`aria-disabled`, no native `disabled`) so its reason can be
   * found by keyboard: with a `disabled-message`, and for a control inside a group that explains itself.
   */
  protected get focusableWhenDisabled(): boolean {
    return this.showsDisabledMessage;
  }

  /** Ids of hidden helper elements in this shadow root that describe the control (`aria-describedby`). */
  protected get helperIds(): string[] {
    return [this.ids.id('status-tip'), this.ids.id('disabled-reason')];
  }

  /** Required by the control's own attribute, or by the form's default optionality (only announced, never blocking). */
  protected get announcesRequired(): boolean {
    return (
      this.required || (!this.optional && this.layoutContext.value?.optionality === 'required')
    );
  }

  /** `loading` is set or a change action is pending. */
  protected get busy(): boolean {
    return this.loading || this.#pending > 0;
  }

  /** Whether a change action is pending (a submitted-but-unsettled edit). */
  protected get actionPending(): boolean {
    return this.#pending > 0;
  }

  /**
   * Runs `result` (what a change action returned) as pending work: busy while it settles. Returns a
   * promise that resolves to `true` when it settled normally and `false` when it rejected, so the caller
   * can revert its optimistic state. A synchronous result settles immediately.
   */
  protected trackAction(result: void | Promise<void>): Promise<boolean> | undefined {
    if (!result || typeof result.then !== 'function') return undefined;
    this.#pending++;
    this.requestUpdate();
    return Promise.resolve(result).then(
      () => true,
      () => false,
    );
  }

  /** Ends one pending action started with {@link trackAction}. */
  protected settleAction(): void {
    this.#pending = Math.max(0, this.#pending - 1);
    this.requestUpdate();
  }

  // ---------------------------------------------------------------------------------- lifecycle

  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if ((FORWARDED_ATTRIBUTES as readonly string[]).includes(name)) this.requestUpdate();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (
      changed.has('statusType') &&
      this.statusType &&
      !INPUT_STATUS_TYPES.includes(this.statusType)
    ) {
      devWarn(
        `${this.localName}:status:${this.statusType}`,
        `status-type "${this.statusType}" is not one of ${INPUT_STATUS_TYPES.join(', ')}.`,
      );
    }
    if (this.optional && this.required) {
      devWarn(
        `${this.localName}:optional-required`,
        'optional and required are mutually exclusive; optional takes precedence.',
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.toggleState('busy', this.busy);
    // Slotted-control mode: the satellites are the chrome's; the rest of their state is ours.
    const label = this.chrome.satellite('label') as TctFieldLabel | undefined;
    if (label) label.disabled = this.isDisabled;
    const status = this.chrome.satellite('status') as TctFieldStatus | undefined;
    if (status) {
      status.type = this.effectiveStatus?.type ?? 'error';
      status.variant = this.effectiveStatusVariant === 'detached' ? 'detached' : 'attached';
    }
    this.syncControlAttributes();
    this.#syncDescribedBy();
  }

  // -------------------------------------------------------------------------------- rendering

  /** The label (or the label satellite's slot) with the info tip. */
  protected renderLabelRow(): TemplateResult {
    const slotted = this.slottedControl !== null;
    return html`${slotted ? html`<slot name="label"></slot>` : this.chrome.renderLabel()}${
      this.labelHidden
        ? nothing
        : renderLabelTip(this.labelTooltip, this.fieldLocale.t('@tct.field.moreInfo'))
    }`;
  }

  /** The description (or the description satellite's slot). */
  protected renderDescriptionText(): TemplateResult {
    return this.slottedControl
      ? html`<slot name="description"></slot>`
      : this.chrome.renderDescription();
  }

  /** The status message (nothing for the `tooltip` variant, where the control reveals it). */
  protected renderStatusMessage(): TemplateResult | typeof nothing {
    if (this.slottedControl) return html`<slot name="status"></slot>`;
    const status = this.effectiveStatus;
    const variant = this.effectiveStatusVariant;
    if (!status?.message || variant === 'tooltip') return nothing;
    return html`<tct-field-status
      id=${this.chrome.statusId}
      data-tct-owned
      type=${status.type}
      variant=${variant === 'detached' ? 'detached' : 'attached'}
      >${status.message}</tct-field-status
    >`;
  }

  /** Visually hidden text that `aria-describedby` points at when a tooltip carries the message or the reason. */
  protected renderHelpers(): TemplateResult {
    const status = this.effectiveStatus;
    const tooltipStatus =
      this.effectiveStatusVariant === 'tooltip' && status?.message && !this.groupContext.value;
    return html`${
      tooltipStatus
        ? html`<span class="visually-hidden" id=${this.ids.id('status-tip')}
            >${status.message}</span
          >`
        : nothing
    }${
      this.showsDisabledMessage
        ? html`<span class="visually-hidden" id=${this.ids.id('disabled-reason')}
            >${this.disabledMessage}</span
          >`
        : nothing
    }`;
  }

  /** The field width as a style value for the field root (`--_field-width`). */
  protected get cssWidth(): string | undefined {
    return toCssLength(this.width);
  }

  /** A status type narrowed to a known value. */
  protected statusTypeOf(status: InputStatus): InputStatusType {
    return oneOf(status.type, INPUT_STATUS_TYPES, 'error');
  }

  // ------------------------------------------------------------------------------- ARIA glue

  /**
   * `aria-describedby` of the control: the chrome's ids (description, status), the ids of the hidden
   * helper text (a tooltip status, a disabled reason), and the host's own `aria-describedby`, whose
   * ids live in the host's tree, so from a shadow control they can only be element references.
   */
  #syncDescribedBy(): void {
    const control = this.chromeTarget;
    if (!control || !this.isConnected) return;
    const slotted = control === this.slottedControl;
    const helpers = new Set(
      this.helperIds.filter((id) => this.renderRoot.querySelector(`[id="${id}"]`)),
    );
    const tokens = (control.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((token) => token && !this.#extras.has(token));
    for (const id of helpers) if (!tokens.includes(id)) tokens.push(id);
    this.#extras = helpers;

    const host = this.getAttribute('aria-describedby');
    if (host && slotted) {
      for (const id of host.split(/\s+/).filter(Boolean)) if (!tokens.includes(id)) tokens.push(id);
    }
    if (host && !slotted && features.elementReflection) {
      setAriaElements(control, 'ariaDescribedByElements', [
        ...resolveIdRefs(control, tokens.join(' ')),
        ...resolveIdRefs(this, host),
      ]);
      this.#wroteRefs = true;
      return;
    }
    if (this.#wroteRefs) {
      setAriaElements(control, 'ariaDescribedByElements', null);
      this.#wroteRefs = false;
    }
    if (tokens.length > 0) control.setAttribute('aria-describedby', tokens.join(' '));
    else control.removeAttribute('aria-describedby');
  }

  /** The chrome owns `aria-describedby` (it merges the host's own references in `#syncDescribedBy`). */
  protected override get ariaDelegationExclude(): readonly string[] {
    return ['aria-describedby'];
  }
}
