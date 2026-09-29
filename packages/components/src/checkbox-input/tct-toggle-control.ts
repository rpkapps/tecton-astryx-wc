import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {live} from 'lit/directives/live.js';
import {styleMap} from 'lit/directives/style-map.js';
import type {ElementSize} from '@tecton-astryx/core/context/keys.js';
import type {FormValue} from '@tecton-astryx/core/mixins/form-control.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {activateControl, isSelectingText, oneOf} from '../field/field-utils.js';
import {TctFieldControl} from '../text-area/tct-field-control.js';
import base from '../styles/base.styles.css';
import field from '../styles/field.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import motion from '../styles/motion.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {TOGGLE_SIZES, type ToggleSize} from './checkbox-input.types.js';
import styles from './tct-toggle-control.styles.css';

/**
 * The shared body of `tct-checkbox-input` and `tct-switch`: one on/off value that submits with its form,
 * a native `<input type="checkbox">` in the shadow root (the switch adds `role="switch"`), the label,
 * description and a detached status beside or under it, a spinner while a change action is pending,
 * and the disabled reason. Subclasses draw the visual (`renderIndicator`).
 *
 * `checked` follows the native model: the `checked` attribute is the default that form reset returns
 * to, the property is the current state. A user toggle fires the native `input` then `change` once;
 * writing `checked` fires nothing.
 *
 * @internal
 * @summary Base of the checkbox and the switch.
 * @fires input - Native, on every toggle by the user; composed and retargeted from the inner input.
 * @fires change - Native, once per toggle by the user; dispatched from the host.
 */
export abstract class TctToggleControl extends TctFieldControl {
  static override styles: CSSResultGroup = [base, visuallyHidden, focusRing, motion, field, styles];

  /** Control size: `sm` or `md` (default). */
  @property({reflect: true}) size: ToggleSize = 'md';

  /** The `checked` attribute: the state that form reset returns to (the native `defaultChecked`). */
  @property({type: Boolean, attribute: 'checked'}) defaultChecked = false;

  #checked: boolean | undefined;

  /**
   * Whether the control is on. Until it is set (or the user toggles it) it follows the `checked`
   * attribute. Writing it fires no events.
   */
  @property({attribute: false})
  get checked(): boolean {
    return this.#checked ?? this.defaultChecked;
  }
  set checked(value: boolean) {
    this.#checked = Boolean(value);
  }

  /** Name of an icon shown before the label text (a registered icon such as `star`). */
  @property({attribute: 'label-icon'}) labelIcon = '';

  /**
   * Async action run after every user toggle, with the new state and the event. While its promise is
   * pending the control is busy (`:state(busy)`, a spinner and `aria-busy`) and cannot be toggled; if
   * it rejects the state returns to what it was.
   */
  @property({attribute: false}) changeAction:
    ((checked: boolean, event: Event) => void | Promise<void>) | undefined;

  /**
   * The control is disabled and stays focusable (`aria-disabled`, not natively disabled) although it has
   * no reason of its own: a group that explains itself keeps its members focusable so the reason can be
   * found. Set by the group, not by authors.
   * @internal
   */
  @property({type: Boolean, attribute: 'data-focusable-disabled'}) focusableDisabled = false;

  /**
   * The text of the description of the row this control sits in (a list item). The row renders that text
   * in its own shadow root, out of reach of `aria-describedby`, and hands the control a copy: the checkbox
   * in a row is described by the text next to it. Set by the row, not by authors.
   * @internal
   */
  @property({attribute: 'data-row-description'}) rowDescription = '';

  // ------------------------------------------------------------------------------------ hooks

  protected override get focusableWhenDisabled(): boolean {
    return this.isDisabled && (this.disabledMessage !== '' || this.focusableDisabled);
  }

  protected override get helperIds(): string[] {
    return [...super.helperIds, this.ids.id('row-description')];
  }

  /** The row's visible description is this control's accessible description (a visually hidden copy). */
  protected override renderHelpers(): TemplateResult {
    const text = this.rowDescription.trim();
    return html`${super.renderHelpers()}${
      text
        ? html`<span class="visually-hidden" id=${this.ids.id('row-description')}>${text}</span>`
        : nothing
    }`;
  }

  /** The native input's ARIA role: `undefined` is a checkbox, `switch` for the switch. */
  protected get inputRole(): string | undefined {
    return undefined;
  }

  /** Whether the input shows the mixed state (checkbox only). */
  protected get mixed(): boolean {
    return false;
  }

  /** Which side of the control the label sits on. */
  protected get labelPosition(): 'start' | 'end' {
    return 'end';
  }

  /** Whether label and control are pushed to opposite ends of the row. */
  protected get spread(): boolean {
    return false;
  }

  /** The user toggled the control to `checked`. */
  protected userToggled(_checked: boolean): void {
    // Nothing by default.
  }

  /** The visual (a checkbox box, a switch track), drawn after the input inside `.control`. */
  protected abstract renderIndicator(): TemplateResult;

  /** The native `<input type="checkbox">` inside (upstream `ref`): focus it, or read its native state. */
  get control(): HTMLInputElement | null {
    return this.formControl;
  }

  protected override get fieldSize(): ElementSize {
    return TOGGLE_SIZES.includes(this.size) ? this.size : 'md';
  }

  protected override get formControl(): HTMLInputElement | null {
    return this.renderRoot.querySelector<HTMLInputElement>('input.input');
  }

  // ------------------------------------------------------------------------------- mixin hooks

  protected override formValue(): FormValue {
    return this.checked ? this.value || 'on' : null;
  }

  /** What restore stores: the checked state as text (the submitted value is `null` when off). */
  protected override formState(): FormValue {
    return this.checked ? 'checked' : 'unchecked';
  }

  protected override formResetValue(): void {
    this.#checked = undefined;
    super.formResetValue();
    this.requestUpdate('checked');
  }

  protected override formRestoreState(state: FormValue, _reason: 'restore' | 'autocomplete'): void {
    // `autocomplete` restores what was submitted (the value text); `restore` what `formState` stored.
    if (typeof state === 'string') this.checked = state !== 'unchecked';
  }

  /** Focuses the input itself (not the label's info button, which can come first in the tab order). */
  override focus(options?: FocusOptions): void {
    const control = this.formControl;
    if (control) control.focus(options);
    else super.focus(options);
  }

  // ---------------------------------------------------------------------------------- lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('size') && !TOGGLE_SIZES.includes(this.size)) {
      devWarn(
        `${this.localName}:size:${this.size}`,
        `size "${this.size}" is not one of ${TOGGLE_SIZES.join(', ')}.`,
      );
    }
  }

  protected override syncControlAttributes(): void {
    const control = this.formControl;
    if (control) control.indeterminate = this.mixed;
  }

  // -------------------------------------------------------------------------------- rendering

  override render() {
    const disabled = this.isDisabled;
    const size = oneOf(this.size, TOGGLE_SIZES, 'md');
    const position = this.labelPosition;
    const label = this.#renderLabelBlock();
    const control = html`<div class="control focus-within-ring" part="control" data-size=${size}>
      <input
        class="input"
        part="input"
        type="checkbox"
        role=${ifDefined(this.inputRole)}
        .checked=${live(this.checked)}
        ?required=${this.required && !this.optional}
        ?disabled=${disabled && !this.focusableWhenDisabled}
        aria-disabled=${ifDefined(this.focusableWhenDisabled ? 'true' : undefined)}
        aria-readonly=${ifDefined(this.readonly ? 'true' : undefined)}
        aria-required=${ifDefined(!this.required && this.announcesRequired ? 'true' : undefined)}
        aria-busy=${ifDefined(this.busy ? 'true' : undefined)}
        @click=${this.#onClick}
        @input=${this.#onInput}
        @change=${this.#onChange}
      />
      ${this.renderIndicator()}
    </div>`;
    return html`<div
      class="toggle"
      part="field"
      data-size=${size}
      style=${styleMap({'--_field-width': this.cssWidth})}
    >
      <tct-tooltip
        content=${this.showsDisabledMessage ? this.disabledMessage : ''}
        placement="above"
        focus-trigger="always"
        ><div
          class="row ${disabled ? '' : 'indicator-scope'}"
          part="row"
          data-size=${size}
          data-label-position=${position}
          ?data-spread=${this.spread}
          ?data-label-hidden=${this.labelHidden}
          ?data-disabled=${disabled}
          ?data-busy=${this.busy}
        >
          ${position === 'start' ? label : nothing} ${control}
          ${position === 'start' ? nothing : label}
        </div></tct-tooltip
      >
      ${this.renderStatusMessage()} ${this.renderHelpers()}
    </div>`;
  }

  #renderLabelBlock(): TemplateResult {
    return html`<div class="label-wrapper" part="label-wrapper">
      <div class="label-row">
        ${
          this.labelIcon && !this.labelHidden
            ? html`<tct-icon
                class="label-icon"
                name=${this.labelIcon}
                size="sm"
                color="inherit"
                @click=${this.#onDescriptionClick}
              ></tct-icon>`
            : nothing
        }
        ${this.renderLabelRow()}
      </div>
      <div class="description-click" @click=${this.#onDescriptionClick}>
        ${this.renderDescriptionText()}
      </div>
    </div>`;
  }

  // ---------------------------------------------------------------------------------- events

  /**
   * A control that cannot change (disabled with a reason, read-only, busy) stays focusable, so its native
   * toggle is cancelled here: cancelling the click restores the checked state, and Space and pointer
   * both arrive as a click.
   */
  readonly #onClick = (event: MouseEvent): void => {
    if (this.isDisabled || this.readonly || this.busy) event.preventDefault();
  };

  /** The native `input` event (composed, retargeted) is the user's toggle: state follows the input. */
  readonly #onInput = (event: Event): void => {
    const input = event.target as HTMLInputElement;
    this.checked = input.checked;
    this.userToggled(input.checked);
    this.#runChangeAction(input.checked, event);
  };

  /** Runs `changeAction`; busy while its promise is pending, and back to the old state if it rejects. */
  #runChangeAction(checked: boolean, event: Event): void {
    const action = this.changeAction;
    if (!action) return;
    const settled = this.trackAction(action(checked, event));
    if (!settled) return;
    void settled.then((ok) => {
      this.settleAction();
      if (!ok) this.checked = !checked;
    });
  }

  /** `change` is not composed: the host re-dispatches it exactly once. */
  readonly #onChange = (): void => {
    this.redispatchChange();
  };

  /** The description (and the label icon) read as part of the label's hit target. */
  readonly #onDescriptionClick = (event: MouseEvent): void => {
    if (this.isDisabled || isSelectingText()) return;
    const origin = event.composedPath()[0];
    if (origin instanceof Element && origin.closest('a[href], button')) return;
    const control = this.formControl;
    if (control) activateControl(control);
  };
}
