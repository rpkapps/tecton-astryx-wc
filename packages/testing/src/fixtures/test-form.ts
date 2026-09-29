/**
 * Test-only form-associated elements: the smallest real consumers of `FormControlMixin` (A§9.7,
 * A§15.3). One per shape the contract has to hold for:
 *
 *  - `tct-test-input`    text field with an inner native `<input>` in the shadow root
 *  - `tct-test-checkbox` boolean control (value only while checked), inner native checkbox
 *  - `tct-test-group`    no native inner control: validators + a `validationAnchor` (the first enabled item)
 *  - `tct-test-submit`   a submitter that is not a native button (what `tct-button type=submit` is)
 */
import {html, css, nothing} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {live} from 'lit/directives/live.js';
import {isSubmitAttempt, submitWithSubmitter, SUBMITTER} from '@tecton-astryx/core/forms/submitter.js';
import {
  FormControlMixin,
  type FormValue,
  type Validator,
} from '@tecton-astryx/core/mixins/form-control.js';
import {requiredValidator} from '@tecton-astryx/core/forms/validators.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';

/** Single-line text field. `submitsOnEnter` makes Enter run implicit submission. */
export class TctTestInput extends FormControlMixin(TctElement) {
  static override readonly tagName = 'tct-test-input';
  static override shadowRootOptions = {...TctElement.shadowRootOptions, delegatesFocus: true};
  static override styles = css`
    :host {
      display: inline-block;
    }
    :host([hidden]) {
      display: none;
    }
  `;

  @property({type: Number}) minlength: number | undefined;
  @property() pattern: string | undefined;
  @property({attribute: 'enter-submits', type: Boolean}) enterSubmits = true;

  protected override get formControl(): HTMLInputElement | null {
    return this.renderRoot.querySelector('input');
  }
  protected override get submitsOnEnter(): boolean {
    return this.enterSubmits;
  }

  /** Counts the change events the inner input produced (the host re-dispatches each exactly once). */
  override render() {
    return html`<input
      .value=${live(this.value)}
      ?disabled=${this.isDisabled}
      ?required=${this.required}
      ?readonly=${this.readonly}
      minlength=${ifDefined(this.minlength)}
      pattern=${ifDefined(this.pattern)}
      @input=${(event: Event) => {
        this.value = (event.target as HTMLInputElement).value;
      }}
      @change=${() => {
        this.redispatchChange();
      }}
    />`;
  }
}

/** Checkbox: submits `value || 'on'` while checked, nothing otherwise. */
export class TctTestCheckbox extends FormControlMixin(TctElement) {
  static override readonly tagName = 'tct-test-checkbox';
  static override shadowRootOptions = {...TctElement.shadowRootOptions, delegatesFocus: true};

  @property({type: Boolean, reflect: true}) checked = false;
  /** The `checked` attribute is the default; reset returns to it. */
  @property({type: Boolean, attribute: 'default-checked'}) defaultChecked = false;

  protected override get formControl(): HTMLInputElement | null {
    return this.renderRoot.querySelector('input');
  }
  protected override formValue(): FormValue {
    return this.checked ? this.value || 'on' : null;
  }
  protected override formState(): FormValue {
    return this.checked ? 'checked' : 'unchecked';
  }
  protected override formResetValue(): void {
    this.checked = this.defaultChecked;
  }
  protected override formRestoreState(state: FormValue): void {
    this.checked = state === 'checked';
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.defaultChecked) this.checked = true;
  }

  override render() {
    return html`<input
      type="checkbox"
      .checked=${live(this.checked)}
      ?disabled=${this.isDisabled}
      ?required=${this.required}
      @change=${(event: Event) => {
        this.checked = (event.target as HTMLInputElement).checked;
        this.redispatchChange();
      }}
    />`;
  }
}

/**
 * A group with no native inner control (a radio group / toolbar-like widget): validity comes from
 * `validators`, and the validation anchor is the first enabled item so a blocked submit can focus it
 * (upstream review H6).
 */
export class TctTestGroup extends FormControlMixin(TctElement) {
  static override readonly tagName = 'tct-test-group';
  static override styles = css`
    :host {
      display: inline-flex;
      gap: 4px;
    }
    :host([hidden]) {
      display: none;
    }
  `;

  #items(): HTMLButtonElement[] {
    return [...this.renderRoot.querySelectorAll('button')];
  }

  protected override get validationAnchor(): HTMLElement | null {
    return this.#items().find((item) => !item.disabled) ?? null;
  }
  protected override get validators(): Validator<this>[] {
    return [requiredValidator<TctTestGroup>((element) => element.required && element.value === '')];
  }

  override render() {
    return html`<div role="radiogroup" aria-label="group" aria-invalid=${this.showInvalid ? 'true' : nothing}>
      ${['a', 'b', 'c'].map(
        (item) =>
          html`<button
            type="button"
            role="radio"
            aria-checked=${String(this.value === item)}
            ?disabled=${this.isDisabled}
            @click=${() => {
              this.value = item;
              this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
              this.markInteracted();
              this.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
            }}
          >
            ${item}
          </button>`,
      )}
    </div>`;
  }
}

/** A submitter that is not a native button; carries `name`/`value`, honours `formnovalidate`. */
export class TctTestSubmit extends TctElement {
  static override readonly tagName = 'tct-test-submit';
  static override shadowRootOptions = {...TctElement.shadowRootOptions, delegatesFocus: true};
  static formAssociated = true;

  readonly [SUBMITTER] = true as const;
  @property({reflect: true}) type: 'submit' | 'reset' | 'button' = 'submit';
  @property({type: Boolean, reflect: true}) disabled = false;
  @property() name = '';
  @property() value = '';
  @property({type: Boolean, attribute: 'formnovalidate'}) formNoValidate = false;

  get form(): HTMLFormElement | null {
    return this.internals.form;
  }

  constructor() {
    super();
    this.addEventListener('click', (event) => {
      if (this.disabled || event.defaultPrevented) return;
      const form = this.form;
      if (!form) return;
      if (this.type === 'submit') {
        submitWithSubmitter(form, {
          name: this.name,
          value: this.value,
          formNoValidate: this.formNoValidate,
        });
      } else if (this.type === 'reset') {
        form.reset();
      }
    });
  }

  override render() {
    return html`<button type="button" ?disabled=${this.disabled}><slot></slot></button>`;
  }
}

/** Whether a submission attempt is in flight (re-exported for suites that assert the marking). */
export {isSubmitAttempt};

declare global {
  interface HTMLElementTagNameMap {
    'tct-test-input': TctTestInput;
    'tct-test-checkbox': TctTestCheckbox;
    'tct-test-group': TctTestGroup;
    'tct-test-submit': TctTestSubmit;
  }
}
