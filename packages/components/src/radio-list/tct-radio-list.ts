import {html, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {styleMap} from 'lit/directives/style-map.js';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import type {ElementSize} from '@tecton-astryx/core/context/keys.js';
import {RovingTabindexController} from '@tecton-astryx/core/controllers/roving-tabindex.js';
import {requiredValidator} from '@tecton-astryx/core/forms/validators.js';
import type {Validator} from '@tecton-astryx/core/mixins/form-control.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {oneOf} from '../field/field-utils.js';
import {TctFieldControl} from '../text-area/tct-field-control.js';
import base from '../styles/base.styles.css';
import field from '../styles/field.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import motion from '../styles/motion.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {radioListContext, type RadioListContextValue} from './radio-list.context.js';
import {
  RADIO_LIST_ORIENTATIONS,
  RADIO_LIST_SIZES,
  type RadioListOrientation,
  type RadioListSize,
} from './radio-list.types.js';
import type {TctRadioListItem} from './tct-radio-list-item.js';
import styles from './tct-radio-list.styles.css';

/**
 * A labelled group of radio options where exactly one can be chosen. It is a `radiogroup` named by its
 * label and described by its description and status, with one tab stop: Tab reaches the chosen option (or
 * the first enabled one), the arrow keys move focus and choose the next or previous option (wrapping;
 * Left and Right mirror in right-to-left text), and Space chooses the focused one.
 *
 * It is a form-associated element on the group: it submits `name=value` of the chosen option (nothing while
 * none is chosen), resets to the `value` attribute, restores, joins a `<fieldset disabled>`, and `required`
 * means an option must be chosen. A blocked submit focuses the first enabled option. `value` follows the
 * native model: the attribute is the default, the property is the current choice. A user choosing an option
 * fires the native `input` then `change` once each; setting `value` fires nothing.
 *
 * Put `tct-radio-list-item` children in it, each with a unique `value`. `disabled-message` explains a
 * disabled list on hover and keyboard focus and keeps the options focusable. Validation is displayed only
 * after the user acted. [mwg:form-associated-custom-elements] [mwg:accessible-web-components]
 * [mwg:required-field-feedback]
 *
 * @summary A labelled group of radio options, one tab stop, arrow keys choose.
 * @tag tct-radio-list
 * @upstream RadioList
 * @slot - The options: `tct-radio-list-item` elements.
 * @csspart field - The whole field: label, group and status.
 * @csspart label - The group label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart group - The `radiogroup` box around the options.
 * @csspart status - The status message box.
 * @cssstate user-invalid - Invalidity is displayed (after a user commit, a submit attempt or `reportValidity()`).
 * @cssstate invalid - The choice does not satisfy its constraints (not displayed).
 * @fires input - Native, when the user chooses another option; composed, from the host.
 * @fires change - Native, when the user chooses another option, once after `input`; from the host.
 * @cloakDisplay block
 * @cloakMinBlockSize 3rem
 */
export class TctRadioList extends TctFieldControl {
  static override readonly tagName = 'tct-radio-list';
  static override styles: CSSResultGroup = [base, visuallyHidden, focusRing, motion, field, styles];

  /** Layout of the options: `vertical` (default) stacks them, `horizontal` puts them in a wrapping row. */
  @property({reflect: true}) orientation: RadioListOrientation = 'vertical';

  /** Size of the radios: `sm` or `md` (default). */
  @property({reflect: true}) size: RadioListSize = 'md';

  #lastContext: RadioListContextValue | undefined;

  /**
   * An option asks to become the value. Blocked while disabled or read-only; an option that is already
   * the value is a no-op. Otherwise the value changes and `input` then `change` fire once.
   * (Declared before the provider: the provider's first value captures it.)
   */
  readonly #select = (item: HTMLElement): void => {
    const option = item as TctRadioListItem;
    if (this.isDisabled || this.readonly || option.disabled || option.value === '') return;
    if (option.value === this.value) return;
    this.value = option.value;
    this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    this.redispatchChange();
  };

  readonly #provider = new ContextProvider(this, {
    context: radioListContext,
    initialValue: this.#contextValue(),
  });

  readonly #roving = new RovingTabindexController<TctRadioListItem>(this, {
    items: () => this.#items(),
    orientation: 'both',
    wrap: true,
    // Native radios have no Home/End.
    homeEnd: false,
    isDisabled: (item) => this.#itemDisabled(item),
    focusTarget: (item) => item.focusTarget,
    // Keys inside an option's own content (a link in `end`) belong to that content.
    boundary: () => true,
    // APG radio group: selection follows focus. Tab into the group stays a pure focus move.
    activateOnFocus: () => !this.readonly && !this.isDisabled,
    onActivate: (item) => {
      this.#select(item);
    },
  });

  // ------------------------------------------------------------------------------ mixin hooks

  protected override get fieldSize(): ElementSize {
    return 'md';
  }

  protected override get groupLabel(): boolean {
    return true;
  }

  /** The `radiogroup` element: the form mixin delegates the host's `aria-*` to it and sets `aria-invalid` on it. */
  protected override get formControl(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.group');
  }

  /** Where a blocked submit puts focus: the tab stop of the group, else the first enabled option. */
  protected override get validationAnchor(): HTMLElement | null {
    const active = this.#roving.active;
    const target = (active ?? this.#items().find((item) => !this.#itemDisabled(item)))?.focusTarget;
    return target ?? this.formControl;
  }

  protected override get validators(): Validator<this>[] {
    // The browser's own localized "select one of these options" message, like a native radio group.
    return [requiredValidator<this>((list) => list.value === '', 'radio')];
  }

  protected override formValue(): string | null {
    return this.value === '' ? null : this.value;
  }

  /** Focuses the group's tab stop: the chosen option, else the first enabled one. */
  override focus(options?: FocusOptions): void {
    const target = this.#roving.active?.focusTarget;
    if (target) target.focus(options);
    else super.focus(options);
  }

  // ---------------------------------------------------------------------------------- lifecycle

  constructor() {
    super();
    this.addEventListener('click', this.#onLabelClick);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('orientation') && !RADIO_LIST_ORIENTATIONS.includes(this.orientation)) {
      devWarn(
        `radio-list:orientation:${this.orientation}`,
        `<tct-radio-list orientation="${this.orientation}"> is not one of ${RADIO_LIST_ORIENTATIONS.join(', ')}.`,
      );
    }
    if (changed.has('size') && !RADIO_LIST_SIZES.includes(this.size)) {
      devWarn(
        `radio-list:size:${this.size}`,
        `<tct-radio-list size="${this.size}"> is not one of ${RADIO_LIST_SIZES.join(', ')}.`,
      );
    }
    // The host disappears as a box so a parent grid places the label and the group in its columns.
    this.toggleAttribute(
      'data-horizontal-labels',
      this.layoutContext.value?.direction === 'horizontal-labels',
    );
    this.#provider.setValue(this.#contextValue());
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (!this.label && !this.hasAttribute('aria-label') && !this.hasAttribute('aria-labelledby')) {
      devWarn(
        'radio-list:label',
        '<tct-radio-list> needs a `label`: it is the accessible name of the group.',
      );
    }
    void this.#settleItems();
  }

  /** Options render (and can receive `tabindex`) after the list does: then the tab stop is placed. */
  async #settleItems(): Promise<void> {
    await Promise.all(this.#items().map((item) => item.updateComplete));
    const chosen = this.#items().find((item) => item.checked && !this.#itemDisabled(item));
    if (chosen) this.#roving.setActive(chosen);
    else this.#roving.update();
    this.syncFormState();
  }

  /** The options of this list (not of a nested one), in DOM order. */
  #items(): TctRadioListItem[] {
    return [...this.querySelectorAll<TctRadioListItem>('tct-radio-list-item')].filter(
      (item) => item.closest('tct-radio-list') === this,
    );
  }

  /**
   * Disabled for keyboard purposes. A whole-list disabled state with a reason keeps every option
   * focusable (`aria-disabled`), so the reason can be found; without one they are skipped.
   */
  #itemDisabled(item: TctRadioListItem): boolean {
    if (item.disabled) return true;
    return this.isDisabled && !this.showsDisabledMessage;
  }

  #contextValue(): RadioListContextValue {
    const next: RadioListContextValue = {
      value: this.value,
      size: oneOf(this.size, RADIO_LIST_SIZES, 'md'),
      disabled: this.isDisabled,
      hasDisabledMessage: this.showsDisabledMessage,
      readonly: this.readonly,
      select: this.#select,
    };
    const last = this.#lastContext;
    // Keep the identity while nothing changed: every change re-renders every option.
    if (
      last?.value === next.value &&
      last.size === next.size &&
      last.disabled === next.disabled &&
      last.hasDisabledMessage === next.hasDisabledMessage &&
      last.readonly === next.readonly
    ) {
      return last;
    }
    this.#lastContext = next;
    return next;
  }

  // -------------------------------------------------------------------------------- rendering

  override render() {
    const horizontal = this.layoutContext.value?.direction === 'horizontal-labels';
    const orientation = oneOf(this.orientation, RADIO_LIST_ORIENTATIONS, 'vertical');
    return html`<div
        class="field"
        part="field"
        data-layout=${ifDefined(horizontal ? 'horizontal-labels' : undefined)}
        ?data-label-hidden=${this.labelHidden}
        style=${styleMap({'--_field-width': this.cssWidth})}
      >
        <div class="label-cell">
          <div class="label-row">${this.renderLabelRow()}</div>
          ${this.renderDescriptionText()}
        </div>
        <div class="control-cell">
          <tct-tooltip
            content=${this.showsDisabledMessage ? this.disabledMessage : ''}
            placement="above"
            focus-trigger="always"
            ><div
              class="group"
              part="group"
              role="radiogroup"
              data-orientation=${orientation}
              aria-required=${ifDefined(this.announcesRequired ? 'true' : undefined)}
              aria-disabled=${ifDefined(this.isDisabled ? 'true' : undefined)}
              aria-readonly=${ifDefined(this.readonly ? 'true' : undefined)}
              ?data-disabled=${this.isDisabled}
            >
              <slot @slotchange=${this.#onSlotChange}></slot></div
          ></tct-tooltip>
          ${this.renderStatusMessage()}
        </div>
      </div>
      ${this.renderHelpers()}`;
  }

  // ---------------------------------------------------------------------------------- events

  readonly #onSlotChange = (): void => {
    void this.#settleItems();
    this.requestUpdate();
  };

  /** `<label for>` reaches the host: focus the option that holds the tab stop. */
  readonly #onLabelClick = (event: MouseEvent): void => {
    if (event.composedPath()[0] !== this || this.isDisabled) return;
    this.#roving.setActive(this.#roving.active, {focus: true});
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-radio-list': TctRadioList;
  }
}
