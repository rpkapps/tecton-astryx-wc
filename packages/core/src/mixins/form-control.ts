/**
 * `FormControlMixin` (A§9.7): turns a `TctElement` into a **form-associated custom element** that
 * behaves like a native control: it submits `name=value` with its `<form>`, takes part in constraint
 * validation, resets and restores, is disabled by a disabled `<fieldset>`, is labelled by
 * `<label for>`, and submits on Enter [mwg:form-associated-custom-elements].
 *
 * ```ts
 * export class TctTextInput extends FormControlMixin(TctElement) {
 *   static override readonly tagName = 'tct-text-input';
 *   static override shadowRootOptions = {...TctElement.shadowRootOptions, delegatesFocus: true};
 *   protected override get formControl() { return this.renderRoot.querySelector('input'); }
 *   protected override get submitsOnEnter() { return true; }
 *   override render() {
 *     return html`<input .value=${live(this.value)} ?disabled=${this.isDisabled} ?required=${this.required}
 *       @input=${(e) => (this.value = (e.target as HTMLInputElement).value)} @change=${() => this.redispatchChange()}>`;
 *   }
 * }
 * ```
 *
 * The contract, one row per concern (each is a test in `runFormControlSuite`):
 *  - **value**: the `value` *attribute* is the default (`defaultValue`), the `value` *property* is the
 *    current value and follows the attribute until set; reset returns to the attribute. Not reflected.
 *  - **validity**: a native inner control's `validity` is mirrored when there is one, else
 *    `validators` run; `setCustomValidity` is tracked separately; the `invalid` attribute is a custom
 *    error; `readonly`/disabled bar validation. The validation anchor is always supplied so a blocked
 *    submit can focus the control (upstream review H6).
 *  - **displayed invalidity**: `:state(user-invalid)` and `aria-invalid` on the inner control flip at
 *    the same moment: after a user commit (`change`, or blur after an edit), a real submission
 *    attempt, or `reportValidity()`; NOT on `checkValidity()` / `form.checkValidity()` (review M6)
 *    [mwg:validate-input-after-interaction] [mwg:accessible-error-announcement]. The displayed
 *    message is frozen while the control has focus (review H7: the browser's message changes on every
 *    keystroke); the field chrome announces it once, politely, when it appears or changes.
 *  - **reset / restore / disabled**: `formResetCallback`, `formStateRestoreCallback`,
 *    `formDisabledCallback` (a disabled `<fieldset>`); `isDisabled` folds both.
 *  - **labels**: `internals.labels` name the inner control; a label click focuses (or, for
 *    checkbox/radio inputs, clicks) it.
 *  - **implicit submission**: Enter (unmodified, not composing) in a control with `submitsOnEnter`
 *    runs `submitImplicitly(form)` exactly once (review H1); controls whose inner input is a *slotted
 *    native input* have a real form owner and must return `false` from `submitsOnEnter`.
 *  - **events**: `input`/`change` only on user action (never on property writes); `change` is not
 *    composed natively, so components call `redispatchChange()` once; `invalid` fires natively.
 *  - **observers**: `observeControl(control, observer)` so `tct-field`/`tct-input-group` follow a
 *    control's displayed state.
 */
import {property, state} from 'lit/decorators.js';
import type {PropertyValues} from 'lit';
import {AriaDelegateController} from '../controllers/aria-delegate.js';
import {isSubmitAttempt} from '../forms/submitter.js';
import {
  BLOCKS_IMPLICIT_SUBMISSION,
  installFormBridge,
  submitImplicitly,
} from '../forms/implicit-submit.js';
import {nativeMessage} from '../forms/validators.js';
import type {Constructor, TctElement} from '../tct-element.js';
import {isImeKeyEvent} from '../utils/ime.js';

/** A value `ElementInternals.setFormValue()` accepts (`FormData` for several entries, `null` for none). */
export type FormValue = File | string | FormData | null;

/** A failed validation: the `ValidityState` flags that are true and the message to show. */
export interface ValidationResult {
  flags: ValidityStateFlags;
  message: string;
}

/** A custom validator: returns a {@link ValidationResult} when the control is invalid, else `null`. */
export type Validator<E> = (element: E) => ValidationResult | null | undefined;

/**
 * An element that follows a control's displayed state (`tct-field`, `tct-input-group`). Registered
 * with {@link observeControl}.
 */
export interface ControlObserver {
  /**
   * While `true` the control displays invalidity (`aria-invalid`, `:state(user-invalid)`) without
   * failing constraint validation (a `tct-field` with `invalid`).
   */
  readonly invalid?: boolean;
  /** Called by the control after each value/validity sync. */
  controlChanged(control: HTMLElement): void;
}

const VALIDITY_FLAGS = [
  'valueMissing',
  'typeMismatch',
  'patternMismatch',
  'tooLong',
  'tooShort',
  'rangeUnderflow',
  'rangeOverflow',
  'stepMismatch',
  'badInput',
] as const satisfies readonly (keyof ValidityStateFlags)[];

// Shared through the global symbol registry so two copies of the library still see each other.
const OBSERVERS_KEY = Symbol.for('tct.control-observers');
const globalScope = globalThis as unknown as Record<
  symbol,
  WeakMap<Element, Set<ControlObserver>> | undefined
>;

function observersOf(control: Element): Set<ControlObserver> | undefined {
  return (globalScope[OBSERVERS_KEY] ??= new WeakMap()).get(control);
}

/** Registers `observer` on `control` and asks the control to re-sync so the observer gets the current state. */
export function observeControl(control: Element, observer: ControlObserver): void {
  const registry = (globalScope[OBSERVERS_KEY] ??= new WeakMap());
  let set = registry.get(control);
  if (!set) registry.set(control, (set = new Set()));
  if (set.has(observer)) return;
  set.add(observer);
  (control as Partial<{requestUpdate(): void}>).requestUpdate?.();
}

/** Removes an observer registered with {@link observeControl}. */
export function unobserveControl(control: Element, observer: ControlObserver): void {
  if (!observersOf(control)?.delete(observer)) return;
  (control as Partial<{requestUpdate(): void}>).requestUpdate?.();
}

/**
 * The public and protected members `FormControlMixin` adds, for typing subclasses. Declared as a
 * class (protected members need one) but exported as a type only: there is no runtime `FormControl`.
 */
declare class FormControlShape {
  static formAssociated: true;
  /** The name submitted with the form. */
  name: string;
  /** Disables the control (not submitted, not focusable). A disabled `<fieldset>` also disables it. */
  disabled: boolean;
  /** The control must have a value for the form to submit. */
  required: boolean;
  /** Read-only controls are barred from constraint validation. */
  readonly: boolean;
  /** Marks the control invalid: displayed immediately and the form refuses to submit. */
  invalid: boolean;
  /** Current value; until set it follows the `value` attribute. Overridable as a getter/setter pair. */
  get value(): string;
  set value(value: string);
  /** The `value` attribute: the default that form reset returns to. */
  defaultValue: string;
  /** `disabled`, or disabled by an ancestor `<fieldset disabled>`. */
  get isDisabled(): boolean;
  /** Whether invalidity is displayed now (user-invalid timing, see the module docs). */
  get showInvalid(): boolean;
  /** The validation message to display: frozen while the control has focus. Empty when not displayed. */
  get displayedValidationMessage(): string;
  get validity(): ValidityState;
  get validationMessage(): string;
  get willValidate(): boolean;
  get form(): HTMLFormElement | null;
  get labels(): NodeList;
  checkValidity(): boolean;
  reportValidity(): boolean;
  setCustomValidity(message: string): void;
  /** Re-syncs the submitted value and validity now (runs after every update). */
  syncFormState(): void;
  /** The inner native control, if any: its validity is mirrored and it receives delegated ARIA and labelling. */
  protected get formControl(): HTMLElement | null;
  /** The focusable element `setValidity` points at (the active/first enabled item for groups). */
  protected get validationAnchor(): HTMLElement | null;
  /** Custom validators, run when there is no failing native control. */
  protected get validators(): Validator<this>[];
  /** Host `aria-*` attributes NOT mirrored onto `formControl` (the component manages them). */
  protected get ariaDelegationExclude(): readonly string[];
  /** Single-line controls return `true`: Enter runs implicit submission. */
  protected get submitsOnEnter(): boolean;
  /** The submission value (`null` = nothing, `FormData` = several entries). */
  protected formValue(): FormValue;
  /** What the browser stores for restore (defaults to `formValue()`). */
  protected formState(): FormValue;
  /** Forgets the dirty value (back to the `value` attribute). */
  protected formResetValue(): void;
  protected formRestoreState(state: FormValue, reason: 'restore' | 'autocomplete'): void;
  /** Marks the control as interacted with so constraint failures are displayed. */
  protected markInteracted(): void;
  /** Re-dispatches the inner control's (non-composed) `change` from the host, once. */
  protected redispatchChange(): void;
  formResetCallback(): void;
  formDisabledCallback(disabled: boolean): void;
  formStateRestoreCallback(state: FormValue, reason: 'restore' | 'autocomplete'): void;
}

export type {FormControlShape as FormControl};

/** See the module documentation. */
export function FormControlMixin<T extends Constructor<TctElement>>(
  Base: T,
): Constructor<FormControlShape> & T {
  class FormControlElement extends Base {
    static formAssociated = true;

    @property({reflect: true}) name = '';
    @property({type: Boolean, reflect: true}) disabled = false;
    @property({type: Boolean, reflect: true}) required = false;
    @property({type: Boolean, reflect: true}) readonly = false;
    @property({type: Boolean, reflect: true}) invalid = false;
    /** The `value` attribute. */
    @property({attribute: 'value'}) defaultValue = '';

    #value: string | undefined;
    @property({attribute: false})
    get value(): string {
      return this.#value ?? this.defaultValue;
    }
    set value(value: string) {
      this.#value = value === null || value === undefined ? '' : String(value);
    }

    /** Disabled by an ancestor `<fieldset disabled>`. */
    @state() protected formDisabled = false;
    @state() private _interacted = false;

    #dirty = false;
    #focused = false;
    #customMessage = '';
    /** Displayed-state summary of the last sync; a change asks for one more render (message text). */
    #lastKey = 'false|';
    /** The message on screen while the control has focus. */
    #frozenMessage: string | undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mixin constructor signature
    constructor(...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      super(...args);
      new AriaDelegateController(this, {
        target: () => this.formControl,
        labels: () => [...this.internals.labels] as Element[],
        exclude: () => ['aria-invalid', ...this.ariaDelegationExclude],
      });
      // `invalid` fires for a submission attempt AND for checkValidity(); only the former shows errors.
      this.addEventListener('invalid', () => {
        if (isSubmitAttempt(this.form)) this.markInteracted();
      });
      this.addEventListener('input', () => {
        this.#dirty = true;
      });
      this.addEventListener('change', () => {
        this.#dirty = true;
        this.markInteracted();
      });
      this.addEventListener('focusin', () => {
        this.#focused = true;
      });
      this.addEventListener('focusout', (event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && (this.contains(next) || this.shadowRoot?.contains(next)))
          return;
        this.#focused = false;
        this.#frozenMessage = undefined;
        // Leaving after an edit is a commit: show what is wrong (the platform's :user-invalid timing).
        if (this.#dirty) this.markInteracted();
        this.requestUpdate();
      });
      this.addEventListener('keydown', this.#onKeyDown);
      this.addEventListener('click', this.#onLabelClick);
    }

    // ------------------------------------------------------------------------------- hooks

    protected get formControl(): HTMLElement | null {
      return null;
    }
    protected get validationAnchor(): HTMLElement | null {
      return this.formControl;
    }
    protected get validators(): Validator<this>[] {
      return [];
    }
    protected get ariaDelegationExclude(): readonly string[] {
      return [];
    }
    protected get submitsOnEnter(): boolean {
      return false;
    }
    protected formValue(): FormValue {
      return this.value;
    }
    protected formState(): FormValue {
      return this.formValue();
    }
    protected formResetValue(): void {
      this.#value = undefined;
      this.requestUpdate('value');
    }
    protected formRestoreState(state: FormValue, _reason: 'restore' | 'autocomplete'): void {
      if (typeof state === 'string') this.value = state;
    }
    protected markInteracted(): void {
      if (!this._interacted) this._interacted = true;
    }
    protected redispatchChange(): void {
      this.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
    }

    /** Lets the bridge and implicit-submission helper ask "does this field block implicit submission?". */
    get [BLOCKS_IMPLICIT_SUBMISSION](): boolean {
      return this.submitsOnEnter;
    }

    // -------------------------------------------------------------------------------- state

    get isDisabled(): boolean {
      return this.disabled || this.formDisabled;
    }

    get showInvalid(): boolean {
      if (this.invalid) return true;
      if (this.isDisabled || this.readonly) return false;
      if (this._interacted && !this.internals.validity.valid) return true;
      for (const observer of observersOf(this) ?? []) if (observer.invalid) return true;
      return false;
    }

    get displayedValidationMessage(): string {
      if (!this.showInvalid) {
        this.#frozenMessage = undefined;
        return '';
      }
      const current = this.internals.validationMessage;
      // The browser's message can change per keystroke ("too short (3 of 8)"); a re-announced,
      // re-rendered message while typing is noise, so the one on screen holds until blur.
      if (this.#focused && this.#frozenMessage !== undefined) return this.#frozenMessage;
      this.#frozenMessage = current;
      return current;
    }

    // ---------------------------------------------------------------------------- native API

    get validity(): ValidityState {
      return this.internals.validity;
    }
    get validationMessage(): string {
      return this.internals.validationMessage;
    }
    get willValidate(): boolean {
      return this.internals.willValidate;
    }
    get form(): HTMLFormElement | null {
      return this.internals.form;
    }
    get labels(): NodeList {
      return this.internals.labels;
    }

    checkValidity(): boolean {
      this.syncFormState();
      // Like :user-invalid, a programmatic check never displays the error.
      return this.internals.checkValidity();
    }

    reportValidity(): boolean {
      this.syncFormState();
      this.markInteracted();
      return this.internals.reportValidity();
    }

    setCustomValidity(message: string): void {
      this.#customMessage = message ?? '';
      this.syncFormState();
    }

    // ---------------------------------------------------------------------- form callbacks

    formResetCallback(): void {
      this.formResetValue();
      this._interacted = false;
      this.#dirty = false;
      this.#frozenMessage = undefined;
    }

    formDisabledCallback(disabled: boolean): void {
      this.formDisabled = disabled;
    }

    formStateRestoreCallback(state: FormValue, reason: 'restore' | 'autocomplete'): void {
      this.formRestoreState(state, reason);
    }

    // ------------------------------------------------------------------------------- lifecycle

    override connectedCallback(): void {
      super.connectedCallback();
      installFormBridge();
      // Before the first render the value must already be submittable (parser-created forms can
      // be submitted synchronously).
      this.internals.setFormValue(this.formValue(), this.formState());
    }

    protected override updated(changed: PropertyValues): void {
      super.updated(changed);
      this.syncFormState();
    }

    syncFormState(): void {
      this.internals.setFormValue(this.formValue(), this.formState());
      const control = this.formControl;
      const anchor = this.validationAnchor ?? control ?? undefined;
      let flags: ValidityStateFlags = {};
      let message = '';

      if (this.isDisabled || this.readonly) {
        // Barred from constraint validation.
      } else if (this.#customMessage) {
        flags = {customError: true};
        message = this.#customMessage;
      } else if (this.invalid) {
        flags = {customError: true};
        message = nativeMessage('invalid');
      } else {
        const native: Partial<HTMLInputElement> | null = control;
        if (native?.validity && native.willValidate && !native.validity.valid) {
          for (const flag of VALIDITY_FLAGS) if (native.validity[flag]) flags[flag] = true;
          message = native.validationMessage ?? '';
        }
        if (Object.keys(flags).length === 0) {
          for (const validator of this.validators) {
            const result = validator(this);
            if (result) {
              flags = result.flags;
              message = result.message;
              break;
            }
          }
        }
      }

      if (Object.keys(flags).length > 0) {
        this.internals.setValidity(flags, message || nativeMessage('invalid'), anchor);
      } else {
        this.internals.setValidity({});
      }

      const show = this.showInvalid;
      this.toggleState('invalid', !this.internals.validity.valid);
      this.toggleState('user-invalid', show);
      // The same moment as :state(user-invalid): assistive technology hears about the error only
      // when a sighted user would see it.
      if (control) {
        if (show) control.setAttribute('aria-invalid', 'true');
        else control.removeAttribute('aria-invalid');
      }
      // Validity is computed after each render, so a message that changed must be rendered once more.
      const key = `${String(show)}|${this.internals.validationMessage}`;
      if (key !== this.#lastKey) {
        this.#lastKey = key;
        queueMicrotask(() => {
          this.requestUpdate();
        });
      }
      for (const observer of observersOf(this) ?? []) observer.controlChanged(this);
    }

    // -------------------------------------------------------------------------------- events

    /** Enter in a single-line control submits the form once; native inputs with a form owner do it themselves. */
    readonly #onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' || event.defaultPrevented || isImeKeyEvent(event)) return;
      if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      if (!this.submitsOnEnter || this.isDisabled || this.readonly) return;
      const origin = event.composedPath()[0];
      // A real form owner (a slotted native input) means the platform submits: never twice.
      if (origin instanceof HTMLElement && (origin as Partial<HTMLInputElement>).form) return;
      // Buttons and links inside the control (a clear button) keep their own Enter.
      if (origin instanceof HTMLButtonElement || origin instanceof HTMLAnchorElement) return;
      const form = this.form;
      if (!form) return;
      event.preventDefault();
      submitImplicitly(form);
    };

    /** A `<label for>` click arrives at the host itself: focus (or, for checkbox/radio, click) the inner control. */
    readonly #onLabelClick = (event: MouseEvent): void => {
      if (event.composedPath()[0] !== this || this.isDisabled) return;
      const control = this.formControl;
      if (!control) return;
      if (
        control instanceof HTMLInputElement &&
        (control.type === 'checkbox' || control.type === 'radio')
      ) {
        control.click();
      } else {
        control.focus();
      }
    };
  }

  return FormControlElement as unknown as Constructor<FormControlShape> & T;
}
