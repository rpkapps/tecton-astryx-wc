import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {live} from 'lit/directives/live.js';
import {styleMap} from 'lit/directives/style-map.js';
import fieldMessages from '@tecton-astryx/locales/en/field.js';
import inputMessages from '@tecton-astryx/locales/en/input.js';
import textInputMessages from '@tecton-astryx/locales/en/textInput.js';
import {resolveIdRefs, setAriaElements} from '@tecton-astryx/core/controllers/aria-delegate.js';
import {ContextConsumer} from '@tecton-astryx/core/context/protocol.js';
import {formLayoutContext, inputGroupContext} from '@tecton-astryx/core/context/keys.js';
import {FieldChromeController} from '@tecton-astryx/core/controllers/field-chrome.js';
import {SizeController} from '@tecton-astryx/core/controllers/size.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TctClearEvent} from '@tecton-astryx/core/events/tct-clear.js';
import {TctEnterEvent} from '@tecton-astryx/core/events/tct-enter.js';
import {features} from '@tecton-astryx/core/features.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import {FormControlMixin, type FormValue} from '@tecton-astryx/core/mixins/form-control.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {IdController} from '@tecton-astryx/core/utils/id.js';
import {isImeKeyEvent} from '@tecton-astryx/core/utils/ime.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {
  FIELD_STATUS_VARIANTS,
  INPUT_STATUS_TYPES,
  type FieldStatusVariant,
  type InputStatus,
  type InputStatusType,
} from '../field/field.types.js';
import {renderLabelTip} from '../field/field-label-tip.js';
import {
  activateControl,
  isSelectingText,
  lengthConverter,
  NESTED_INTERACTIVE,
  oneOf,
  STATUS_ICON,
  toCssLength,
} from '../field/field-utils.js';
import {TctFieldDescription} from '../field/tct-field-description.js';
import {TctFieldLabel} from '../field/tct-field-label.js';
import {TctInputClearButton} from '../field/tct-input-clear-button.js';
import {TctFieldStatus} from '../field-status/tct-field-status.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctSpinner} from '../spinner/tct-spinner.js';
import {TctTooltip} from '../tooltip/tct-tooltip.js';
import base from '../styles/base.styles.css';
import field from '../styles/field.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import motion from '../styles/motion.styles.css';
import slottedIcon from '../styles/slotted-icon.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {
  TEXT_INPUT_SIZES,
  TEXT_INPUT_TYPES,
  type TextInputSize,
  type TextInputType,
} from './text-input.types.js';
import styles from './tct-text-input.styles.css';

/** Attributes that are forwarded to the inner input but are not reactive properties. */
const FORWARDED_ATTRIBUTES = ['aria-describedby', 'inputmode', 'enterkeyhint'] as const;

/**
 * A single-line text field with its label, description and status: names, emails, search queries. It is
 * a form-associated element, so it submits, resets, restores, validates and joins a `<fieldset
 * disabled>` like a native `<input>`, and Enter submits the form once (never while an IME is composing).
 *
 * **Default (shadow) mode** renders a native `<input>` in its shadow root, with the label, description
 * and status in the same root, so every id relationship stays inside one tree. **Slotted-input mode**,
 * `<tct-text-input><input slot="input" name="email" autocomplete="email"></tct-text-input>`, makes your
 * own `<input>` the control: it submits itself, and password managers and autofill see a native field.
 * The label, description and status are then satellites in the light DOM next to it. Use it for
 * sign-in and address fields where autofill matters. In that mode the input owns `name`, `value`,
 * `type`, `required`, `disabled` and `autocomplete`.
 *
 * Validation is displayed only after the user acted: a `required` field left empty shows nothing until
 * a change, a blur after an edit, or a submit attempt; `aria-invalid` and `:state(user-invalid)` flip
 * together, and the browser's message is shown as the status (frozen while typing, announced once).
 * `status-type`/`status-message` is your own status. [mwg:validate-input-after-interaction]
 * [mwg:accessible-error-announcement] [mwg:form-associated-custom-elements] [mwg:ime-safe-enter-submit]
 *
 * @summary Single-line text field with label, description, status, clear button and adornments.
 * @tag tct-text-input
 * @upstream TextInput
 * @slot input - Your own `<input>`: switches to slotted-input mode.
 * @slot start - Adornment at the start of the field (an icon button, a prefix).
 * @slot end - Adornment at the end of the field (a suffix, a unit).
 * @slot label - The label satellite (slotted-input mode). Do not fill it.
 * @slot description - The description satellite (slotted-input mode). Do not fill it.
 * @slot status - The status satellite (slotted-input mode). Do not fill it.
 * @csspart field - The whole field: label, control and status (Astryx target `astryx-field`).
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart input - The painted box around the control (Astryx target `astryx-text-input`).
 * @csspart control - The native `<input>` (shadow mode).
 * @csspart start-icon - The start icon.
 * @csspart status-icon - The status icon inside the box.
 * @csspart status - The status message box.
 * @cssstate user-invalid - Invalidity is displayed (after a user commit, a submit attempt or `reportValidity()`).
 * @cssstate invalid - The value does not satisfy its constraints (not displayed).
 * @cssstate busy - A `changeAction` is pending or `loading` is set.
 * @fires input - Native, on every edit; composed and retargeted from the inner input.
 * @fires change - Native, when the user commits the edit (blur or Enter); dispatched once from the host.
 * @fires tct-enter - The user pressed an unmodified Enter (never one that commits an IME conversion); cancelable, and preventing it stops the form's implicit submission.
 * @fires tct-clear - The user pressed the clear button; cancelable, and preventing it keeps the value.
 * @cloakDisplay block
 * @cloakMinBlockSize 4.5rem
 */
export class TctTextInput extends FormControlMixin(TctElement) {
  static override readonly tagName = 'tct-text-input';
  static override readonly dependencies = [
    TctFieldLabel,
    TctFieldDescription,
    TctFieldStatus,
    TctInputClearButton,
    TctIcon,
    TctSpinner,
    TctTooltip,
  ];
  static override shadowRootOptions = {...TctElement.shadowRootOptions, delegatesFocus: true};
  static override styles: CSSResultGroup = [
    base,
    visuallyHidden,
    focusRing,
    motion,
    slottedIcon,
    field,
    styles,
  ];

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, ...FORWARDED_ATTRIBUTES];
  }

  /** The kind of text: `text`, `password`, `email`, `search`, `tel` or `url`. */
  @property({reflect: true}) type: TextInputType = 'text';

  /** The label (always rendered for accessibility; hide it visually with `label-hidden`). */
  @property() label = '';

  /** Hides the label and description visually while keeping them for assistive technology. */
  @property({type: Boolean, reflect: true, attribute: 'label-hidden'}) labelHidden = false;

  /** Helper text between the label and the field. */
  @property() description = '';

  /** Optional field: an "Optional" indicator. Wins over `required`. */
  @property({type: Boolean}) optional = false;

  /**
   * Explains why the field is disabled. With `disabled` it shows a tooltip on hover and keyboard
   * focus and keeps the field focusable (through `aria-disabled`; it becomes read-only), so the reason
   * is discoverable. Use this instead of wrapping a disabled field in a tooltip.
   */
  @property({attribute: 'disabled-message'}) disabledMessage = '';

  /** Puts the field in a loading state: a spinner and `aria-busy`. */
  @property({type: Boolean, reflect: true}) loading = false;

  /** Hint shown while the field is empty. Not a substitute for the label. */
  @property() placeholder = '';

  /** Text of an info tip shown as a small icon button after the label. */
  @property({attribute: 'label-tooltip'}) labelTooltip = '';

  /** Name of an icon shown at the start of the field (a registered icon such as `search`). */
  @property({attribute: 'start-icon'}) startIcon = '';

  /** The kind of status: draws the border, the status icon and (with a message) the message. */
  @property({attribute: 'status-type'}) statusType: InputStatusType | undefined;

  /** The status message. Without it the status is only the border and the icon. */
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
   * How the status message is placed: `attached` below the field, `detached` as a separate message with
   * an icon, `tooltip` with no message box (the status icon becomes a focusable button that reveals it).
   */
  @property({attribute: 'status-variant'}) statusVariant: FieldStatusVariant = 'attached';

  /** Field height: `sm`, `md` or `lg`. Explicit, then the enclosing size provider, then `md`. */
  @property({reflect: true}) size: TextInputSize | undefined;

  /** Shows a clear (x) button while the field has a value; it clears, fires `tct-clear` and returns focus. */
  @property({type: Boolean, attribute: 'has-clear'}) hasClear = false;

  /**
   * Width of the whole field, label, control and status alike. A number is px, a string is a CSS length.
   */
  @property({converter: lengthConverter}) width: number | string | undefined;

  /** The native `autocomplete` attribute, forwarded to the input unchanged (`off`, `email`, `current-password`...). */
  @property() autocomplete = '';

  /** Minimum number of characters (native `minlength` validation). */
  @property({type: Number}) minlength: number | undefined;

  /** Maximum number of characters (native `maxlength`). */
  @property({type: Number}) maxlength: number | undefined;

  /** A regular expression the value must match (native `pattern` validation). */
  @property() pattern = '';

  /**
   * Async action run after every user edit, with the new value and the event. While its promise is
   * pending the field is busy (`:state(busy)`, a spinner and `aria-busy`).
   */
  @property({attribute: false}) changeAction:
    ((value: string, event: Event) => void | Promise<void>) | undefined;

  /** The value of the field: the inner input's, or your slotted input's in slotted-input mode. */
  @property({attribute: false})
  override get value(): string {
    const slotted = this.#slottedInput;
    return slotted ? slotted.value : super.value;
  }
  override set value(value: string) {
    const slotted = this.#slottedInput;
    if (slotted) slotted.value = value ?? '';
    else super.value = value;
  }

  readonly #ids = new IdController(this, 'tct-text-input');
  readonly #size = new SizeController<TextInputSize>(this, {
    explicit: () => (this.size ? oneOf(this.size, TEXT_INPUT_SIZES, 'md') : undefined),
    fallback: 'md',
  });
  readonly #slots = new SlotController(this, 'input', 'start', 'end');
  readonly #layout = new ContextConsumer(this, {context: formLayoutContext, subscribe: true});
  readonly #group = new ContextConsumer(this, {context: inputGroupContext, subscribe: true});
  readonly #locale = new LocaleController(this, {
    namespace: 'textInput',
    defaults: {...textInputMessages, ...inputMessages, ...fieldMessages},
  });
  readonly #chrome: FieldChromeController = new FieldChromeController(this, {
    mode: () => (this.#slottedInput ? 'light' : 'shadow'),
    control: () => this.formControl,
    state: () => ({
      label: this.label,
      labelHidden: this.labelHidden,
      description: this.description || undefined,
      status: this.#status,
      statusVariant: oneOf(this.statusVariant, FIELD_STATUS_VARIANTS, 'attached'),
      required: this.required,
      optional: this.optional,
      disabled: this.isDisabled,
      size: this.#size.value,
    }),
  });

  /** Helper element ids currently written into `aria-describedby` by this control (not by the chrome). */
  #extras = new Set<string>();
  #wroteRefs = false;
  #pending = 0;

  // ------------------------------------------------------------------------------ mixin hooks

  /** The author's own input (slotted-input mode). */
  get #slottedInput(): HTMLInputElement | null {
    return this.querySelector<HTMLInputElement>(':scope > input[slot="input"]');
  }

  protected override get formControl(): HTMLInputElement | null {
    return (
      this.#slottedInput ?? this.renderRoot.querySelector<HTMLInputElement>('input.input') ?? null
    );
  }

  /** A slotted input has a real form owner: the platform submits it, so the host must not. */
  protected override get submitsOnEnter(): boolean {
    return this.#slottedInput === null;
  }

  /** The chrome owns `aria-describedby` (it merges the host's own references in `#syncDescribedBy`). */
  protected override get ariaDelegationExclude(): readonly string[] {
    return ['aria-describedby'];
  }

  protected override formValue(): FormValue {
    return this.#slottedInput ? null : this.value;
  }

  protected override formState(): FormValue {
    return this.#slottedInput ? null : this.value;
  }

  /** An error status of your own is displayed like a user-invalid control. */
  override get showInvalid(): boolean {
    return super.showInvalid || this.statusType === 'error';
  }

  /** Focuses the input itself (not the first focusable adornment). */
  override focus(options?: FocusOptions): void {
    const control = this.formControl;
    if (control) control.focus(options);
    else super.focus(options);
  }

  /** Selects the text of the input. */
  select(): void {
    this.formControl?.select();
  }

  // ---------------------------------------------------------------------------------- derived

  /**
   * The status in effect: your own, else the browser's validation message while invalidity is
   * displayed (frozen while the field has focus, so it is not rewritten on every keystroke).
   */
  get #status(): InputStatus | undefined {
    if (this.statusType) return {type: this.statusType, message: this.statusMessage || undefined};
    const message = this.displayedValidationMessage;
    return message ? {type: 'error', message} : undefined;
  }

  get #showsDisabledMessage(): boolean {
    return this.isDisabled && this.disabledMessage !== '';
  }

  /** Required by the field's own attribute, or by the form's default optionality (only announced, never blocking). */
  get #ariaRequired(): boolean {
    return this.required || (!this.optional && this.#layout.value?.optionality === 'required');
  }

  get #busy(): boolean {
    return this.loading || this.#pending > 0;
  }

  // ---------------------------------------------------------------------------------- lifecycle

  constructor() {
    super();
    // Slotted-input mode: the author's input fires the events; the host reacts (clear button, slots).
    this.addEventListener('input', this.#onHostInput);
    this.addEventListener('keydown', this.#onHostKeyDown);
  }

  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if ((FORWARDED_ATTRIBUTES as readonly string[]).includes(name)) this.requestUpdate();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('type') && !TEXT_INPUT_TYPES.includes(this.type)) {
      devWarn(
        `text-input:type:${this.type}`,
        `type "${this.type}" is not one of ${TEXT_INPUT_TYPES.join(', ')}.`,
      );
    }
    if (
      changed.has('statusType') &&
      this.statusType &&
      !INPUT_STATUS_TYPES.includes(this.statusType)
    ) {
      devWarn(
        `text-input:status:${this.statusType}`,
        `status-type "${this.statusType}" is not one of ${INPUT_STATUS_TYPES.join(', ')}.`,
      );
    }
    if (this.optional && this.required) {
      devWarn(
        'text-input:optional-required',
        'optional and required are mutually exclusive; optional takes precedence.',
      );
    }
    // The host disappears as a box so a parent grid places the label and the field in its columns.
    this.toggleAttribute(
      'data-horizontal-labels',
      this.#layout.value?.direction === 'horizontal-labels' && !this.#group.value,
    );
  }

  protected override firstUpdated(): void {
    if (!this.hasAttribute('autofocus')) return;
    // The inner input is only focusable once the first render has settled (upstream `hasAutoFocus`).
    void this.updateComplete.then(() => {
      this.focus({preventScroll: true});
    });
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.toggleState('busy', this.#busy);
    // Slotted-input mode: the satellites are the chrome's; the rest of their state is ours.
    const label = this.#chrome.satellite('label') as TctFieldLabel | undefined;
    if (label) label.disabled = this.isDisabled;
    const status = this.#chrome.satellite('status') as TctFieldStatus | undefined;
    if (status) {
      status.type = this.#status?.type ?? 'error';
      status.variant = this.statusVariant === 'detached' ? 'detached' : 'attached';
    }
    this.#syncControlAttributes();
    this.#syncDescribedBy();
  }

  // -------------------------------------------------------------------------------- rendering

  override render() {
    const slotted = this.#slottedInput !== null;
    const group = this.#group.value ?? null;
    const horizontal = this.#layout.value?.direction === 'horizontal-labels' && !group;
    const box = this.#renderBox(slotted, group !== null);
    // Inside an input group the group owns the label, description and status.
    if (group) return html`${box}${this.#renderHelpers()}`;

    const status = this.#status;
    const width = toCssLength(this.width);
    return html`<div
        class="field"
        part="field"
        data-layout=${ifDefined(horizontal ? 'horizontal-labels' : undefined)}
        ?data-label-hidden=${this.labelHidden}
        style=${styleMap({'--_field-width': width})}
      >
        <div class="label-cell">
          <div class="label-row">
            ${slotted ? html`<slot name="label"></slot>` : this.#chrome.renderLabel()}
            ${
              this.labelHidden
                ? nothing
                : renderLabelTip(this.labelTooltip, this.#locale.t('@tct.field.moreInfo'))
            }
          </div>
          ${horizontal ? nothing : this.#renderDescription(slotted)}
        </div>
        <div class="control-cell">
          ${horizontal ? this.#renderDescription(slotted) : nothing} ${box}
          ${this.#renderStatus(slotted, status)}
        </div>
      </div>
      ${this.#renderHelpers()}`;
  }

  #renderDescription(slotted: boolean): TemplateResult {
    return slotted
      ? html`<slot name="description"></slot>`
      : html`<div class="description-click" @click=${this.#onDescriptionClick}>
          ${this.#chrome.renderDescription()}
        </div>`;
  }

  #renderStatus(
    slotted: boolean,
    status: InputStatus | undefined,
  ): TemplateResult | typeof nothing {
    if (slotted) return html`<slot name="status"></slot>`;
    const variant = oneOf(this.statusVariant, FIELD_STATUS_VARIANTS, 'attached');
    if (!status?.message || variant === 'tooltip') return nothing;
    return html`<tct-field-status
      id=${this.#chrome.statusId}
      data-tct-owned
      type=${status.type}
      variant=${variant === 'detached' ? 'detached' : 'attached'}
      >${status.message}</tct-field-status
    >`;
  }

  /** Visually hidden text that `aria-describedby` points at when a tooltip carries the message. */
  #renderHelpers(): TemplateResult {
    const status = this.#status;
    const tooltipStatus = this.statusVariant === 'tooltip' && status?.message && !this.#group.value;
    return html`${
      tooltipStatus
        ? html`<span class="visually-hidden" id=${this.#ids.id('status-tip')}
            >${status.message}</span
          >`
        : nothing
    }${
      this.#showsDisabledMessage
        ? html`<span class="visually-hidden" id=${this.#ids.id('disabled-reason')}
            >${this.disabledMessage}</span
          >`
        : nothing
    }`;
  }

  #renderBox(slotted: boolean, inGroup: boolean): TemplateResult {
    const status = this.#status;
    const showsDisabledMessage = this.#showsDisabledMessage;
    const disabled = this.isDisabled;
    const showClear = this.hasClear && this.value !== '' && !disabled && !this.readonly;
    const box = html`<div
      class="input-wrapper focus-within-ring"
      part="input"
      data-size=${this.#size.value}
      data-status=${ifDefined(status?.type)}
      ?data-disabled=${disabled}
      ?data-readonly=${this.readonly}
      ?data-in-group=${inGroup}
      @click=${this.#onBoxClick}
    >
      ${
        this.startIcon
          ? html`<tct-icon
              class="start-icon"
              part="start-icon"
              name=${this.startIcon}
              size="sm"
              color="secondary"
            ></tct-icon>`
          : nothing
      }
      <span class="adornment" ?hidden=${!this.#slots.has('start')}><slot name="start"></slot></span>
      ${
        inGroup
          ? html`<span class="visually-hidden" id=${this.#ids.id('group-label')}
              >${this.label}</span
            >`
          : nothing
      }
      ${slotted ? html`<slot name="input"></slot>` : this.#renderInput(inGroup, showsDisabledMessage)}
      ${
        showClear
          ? html`<tct-input-clear-button
              label=${this.#locale.t('clearLabel', {label: this.label})}
              @click=${this.#onClear}
            ></tct-input-clear-button>`
          : nothing
      }
      ${this.#busy ? this.#renderBusy() : nothing} ${this.#renderStatusIcon(status, inGroup)}
      <span class="adornment" ?hidden=${!this.#slots.has('end')}><slot name="end"></slot></span>
    </div>`;
    return html`<tct-tooltip
      content=${this.#showsDisabledMessage ? this.disabledMessage : ''}
      placement="above"
      focus-trigger="always"
      >${box}</tct-tooltip
    >`;
  }

  #renderInput(inGroup: boolean, showsDisabledMessage: boolean): TemplateResult {
    return html`<input
      class="input"
      part="control"
      .value=${live(this.value)}
      type=${oneOf(this.type, TEXT_INPUT_TYPES, 'text')}
      name=${ifDefined(this.name || undefined)}
      placeholder=${ifDefined(this.placeholder || undefined)}
      autocomplete=${ifDefined(this.autocomplete || undefined)}
      inputmode=${ifDefined(this.getAttribute('inputmode') ?? undefined)}
      enterkeyhint=${ifDefined(this.getAttribute('enterkeyhint') ?? undefined)}
      minlength=${ifDefined(this.minlength)}
      maxlength=${ifDefined(this.maxlength)}
      pattern=${ifDefined(this.pattern || undefined)}
      ?required=${this.required && !this.optional}
      ?disabled=${this.isDisabled && !showsDisabledMessage}
      ?readonly=${this.readonly || showsDisabledMessage}
      aria-disabled=${ifDefined(showsDisabledMessage ? 'true' : undefined)}
      aria-required=${ifDefined(!this.required && this.#ariaRequired ? 'true' : undefined)}
      aria-busy=${ifDefined(this.#busy ? 'true' : undefined)}
      aria-labelledby=${ifDefined(inGroup ? this.#ids.id('group-label') : undefined)}
      @input=${this.#onInput}
      @change=${this.#onChange}
      @keydown=${this.#onKeyDown}
    />`;
  }

  /** The spinner of a busy field (`loading` or a pending `changeAction`). */
  #renderBusy(): TemplateResult {
    // Decorative: the field's own `aria-busy` says it, so the spinner's progressbar role is hidden.
    return html`<span class="busy" part="busy" aria-hidden="true"
      ><tct-spinner size="sm" shade="subtle"></tct-spinner
    ></span>`;
  }

  /**
   * The status glyph inside the box: plain for `attached`, none for `detached` (its message has its own
   * icon) and none inside a group, and for `tooltip` a real focusable button that reveals the message
   * (keyboard users reach it, touch taps it, assistive technology reads its status as the name).
   */
  #renderStatusIcon(
    status: InputStatus | undefined,
    inGroup: boolean,
  ): TemplateResult | typeof nothing {
    if (!status || inGroup) return nothing;
    const variant = oneOf(this.statusVariant, FIELD_STATUS_VARIANTS, 'attached');
    if (variant === 'detached') return nothing;
    const icon = html`<tct-icon
      class="status-icon"
      part="status-icon"
      name=${STATUS_ICON[oneOf(status.type, INPUT_STATUS_TYPES, 'error')]}
      color="inherit"
      data-status-type=${status.type}
    ></tct-icon>`;
    if (variant !== 'tooltip' || !status.message) return icon;
    return html`<tct-tooltip content=${status.message} placement="above" touch-trigger="tap"
      ><button
        type="button"
        class="status-button focus-ring"
        part="status-button"
        data-status-type=${status.type}
        aria-label=${this.#locale.t(status.type === 'info' ? '@tct.field.infoDetails' : `@astryx.input.statusButton.${status.type}`)}
      >
        ${icon}
      </button></tct-tooltip
    >`;
  }

  // ---------------------------------------------------------------------------------- events

  readonly #onInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.value = input.value;
    this.#runChangeAction(input.value, event);
  };

  readonly #onChange = (): void => {
    // `change` is not composed: the host re-dispatches it exactly once.
    this.redispatchChange();
  };

  /** Slotted-input mode: an edit in the author's input re-renders the clear button; the chrome follows. */
  readonly #onHostInput = (event: Event): void => {
    this.requestUpdate();
    if (this.#slottedInput && event.target === this.#slottedInput) {
      this.#runChangeAction(this.#slottedInput.value, event);
    }
  };

  /** Enter in the shadow input: `tct-enter` (IME-safe) before the mixin's implicit submission. */
  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' || isImeKeyEvent(event)) return;
    if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
    if (!this.dispatch(new TctEnterEvent())) event.preventDefault();
  };

  /** Enter in a slotted input reaches the host; the platform submits unless `tct-enter` is prevented. */
  readonly #onHostKeyDown = (event: KeyboardEvent): void => {
    const slotted = this.#slottedInput;
    if (slotted && event.composedPath()[0] === slotted) this.#onKeyDown(event);
  };

  readonly #onClear = (event: MouseEvent): void => {
    if (!this.dispatch(new TctClearEvent())) return;
    const control = this.formControl;
    if (!control) return;
    control.value = '';
    // Clearing is a discrete commit: an input event, then a change (like toggling a checkbox).
    control.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    if (control === this.#slottedInput) control.dispatchEvent(new Event('change', {bubbles: true}));
    else this.redispatchChange();
    // Keyboard: focus is restored synchronously, before the button leaves the DOM. Pointer: after the
    // button's own task, so touch browsers do not jump the page scroll (iOS Safari).
    if (event.detail === 0) control.focus();
    else requestAnimationFrame(() => control.focus({preventScroll: true}));
  };

  /** Pressing chrome (the icon, the padding) focuses the input, except over nested controls or a selection. */
  readonly #onBoxClick = (event: MouseEvent): void => {
    if (this.isDisabled && !this.#showsDisabledMessage) return;
    if (isSelectingText()) return;
    const origin = event.composedPath()[0];
    if (
      origin instanceof Element &&
      origin.closest(NESTED_INTERACTIVE) &&
      origin !== this.formControl
    )
      return;
    const control = this.formControl;
    if (control && origin !== control) activateControl(control);
  };

  /** The description reads as part of the label's hit target. */
  readonly #onDescriptionClick = (event: MouseEvent): void => {
    if (this.isDisabled || isSelectingText()) return;
    const origin = event.composedPath()[0];
    if (origin instanceof Element && origin.closest(NESTED_INTERACTIVE)) return;
    const control = this.formControl;
    if (control) activateControl(control);
  };

  /** Runs `changeAction` after a user edit; busy (`:state(busy)`, `aria-busy`) while its promise is pending. */
  #runChangeAction(value: string, event: Event): void {
    const action = this.changeAction;
    if (!action) return;
    const result = action(value, event);
    if (!result || typeof result.then !== 'function') return;
    this.#pending++;
    this.requestUpdate();
    void Promise.resolve(result)
      .catch(() => undefined)
      .finally(() => {
        this.#pending--;
        this.requestUpdate();
      });
  }

  // ------------------------------------------------------------------------------- ARIA glue

  /** Forwards `aria-required`-related state that the template cannot express in slotted-input mode. */
  #syncControlAttributes(): void {
    const slotted = this.#slottedInput;
    if (!slotted) return;
    // The author owns the input's own attributes; only the state that has no native equivalent is ours.
    if (this.#busy) slotted.setAttribute('aria-busy', 'true');
    else slotted.removeAttribute('aria-busy');
    if (this.#showsDisabledMessage) slotted.setAttribute('aria-disabled', 'true');
  }

  /**
   * `aria-describedby` of the control: the chrome's ids (description, status), the ids of the hidden
   * helper text (a tooltip status, a disabled reason), and the host's own `aria-describedby`, whose
   * ids live in the host's tree, so from a shadow input they can only be element references.
   */
  #syncDescribedBy(): void {
    const control = this.formControl;
    if (!control || !this.isConnected) return;
    const slotted = control === this.#slottedInput;
    const helpers = new Set(
      [this.#ids.id('status-tip'), this.#ids.id('disabled-reason')].filter((id) =>
        this.renderRoot.querySelector(`[id="${id}"]`),
      ),
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
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-text-input': TctTextInput;
  }
}
