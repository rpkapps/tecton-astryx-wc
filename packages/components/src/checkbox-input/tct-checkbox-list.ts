import {html, nothing, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {styleMap} from 'lit/directives/style-map.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import type {ElementSize} from '@tecton-wc/core/context/keys.js';
import {requiredValidator} from '@tecton-wc/core/forms/validators.js';
import type {FormValue, Validator} from '@tecton-wc/core/mixins/form-control.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {oneOf} from '../field/field-utils.js';
import {listContext} from '../list/list.context.js';
import {LIST_DENSITIES, type ListContextValue, type ListDensity} from '../list/list.types.js';
import {TctFieldControl} from '../text-area/tct-field-control.js';
import base from '../styles/base.styles.css';
import field from '../styles/field.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import motion from '../styles/motion.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {checkboxListContext, type CheckboxListContextValue} from './checkbox-list.context.js';
import type {TctCheckboxListItem} from './tct-checkbox-list-item.js';
import styles from './tct-checkbox-list.styles.css';

/**
 * A labelled group of checkbox options: the user picks any number of them. It is a `group` named by its
 * label, described by its description and status, and a form-associated element: it submits one
 * `name=value` entry for each checked option (a multi-value control), resets to the options marked
 * `checked` in the markup, restores, and joins a `<fieldset disabled>`. `required` means at least one
 * option is checked.
 *
 * Put `tct-checkbox-list-item` children in it, each with a `value`. `values` (property) is the current
 * selection; until it is set or the user toggles an option, it is the options that carry the `checked`
 * attribute. A user toggle fires the native `input` then `change`, once each, from the item's checkbox
 * (composed, so they reach the list); setting `values` fires nothing. To control it, set `values` from your
 * `change` handler.
 *
 * `changeAction(values)` runs after a toggle: the toggled option shows a spinner in its checkbox and is
 * blocked while the promise is pending, the others stay interactive, and a rejection restores the previous
 * selection. `disabled-message` explains a disabled list on hover and keyboard focus and keeps the
 * checkboxes focusable. [mwg:form-associated-custom-elements] [mwg:accessible-web-components]
 *
 * @summary A labelled group of checkbox options that submits every checked value.
 * @tag tct-checkbox-list
 * @upstream CheckboxList
 * @slot - The options: `tct-checkbox-list-item` elements.
 * @csspart field - The whole field: label, group and status.
 * @csspart label - The group label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart group - The `group` box around the list of options.
 * @csspart status - The status message box.
 * @cssstate user-invalid - Invalidity is displayed (after a user commit, a submit attempt or `reportValidity()`).
 * @cssstate invalid - The selection does not satisfy its constraints (not displayed).
 * @cssstate busy - A `changeAction` is pending.
 * @fires input - Native, when the user toggles an option; composed, from the option's checkbox.
 * @fires change - Native, when the user toggles an option, once after `input`; composed, from the option's checkbox.
 * @hideInherited value, defaultValue - A checkbox list has several values: use `values`.
 * @cloakDisplay block
 * @cloakMinBlockSize 3rem
 */
export class TctCheckboxList extends TctFieldControl {
  static override readonly tagName = 'tct-checkbox-list';
  static override styles: CSSResultGroup = [base, visuallyHidden, focusRing, motion, field, styles];

  /** Row spacing of every option: `compact` (small checkboxes), `balanced` (default) or `spacious`. */
  @property({reflect: true}) density: ListDensity = 'balanced';

  /** Shows dividers between the options. */
  @property({type: Boolean, reflect: true, attribute: 'has-dividers'}) hasDividers = false;

  /**
   * Async action run after a toggle, with the new `values`. While its promise is pending the toggled
   * option shows a spinner and is blocked (`aria-busy`); if it rejects the previous selection returns.
   */
  @property({attribute: false}) changeAction:
    ((values: string[]) => void | Promise<void>) | undefined;

  #values: string[] | undefined;

  /**
   * The values of the checked options. Until set (or until the user toggles an option) it is the options
   * that carry the `checked` attribute. Writing it fires no events.
   */
  @property({attribute: false})
  get values(): string[] {
    return this.#values ? [...this.#values] : this.#defaultValues();
  }
  set values(value: string[]) {
    this.#values = Array.isArray(value) ? value.map(String) : [];
  }

  readonly #provider: ContextProvider<typeof checkboxListContext> = new ContextProvider<
    typeof checkboxListContext
  >(this, {
    context: checkboxListContext,
    initialValue: null,
  });
  /**
   * Density and dividers for the rows, the same context a `tct-list` publishes. The options are this
   * element's light-DOM children, so it answers their requests itself: a provider inside this shadow root
   * (a `tct-list`) would not be found by a slotted consumer that connected before it rendered.
   */
  readonly #rows: ContextProvider<typeof listContext> = new ContextProvider<typeof listContext>(
    this,
    {context: listContext, initialValue: null},
  );
  /** Options with a pending `changeAction`, by value. */
  #loadingValue: string | null = null;

  // ------------------------------------------------------------------------------ mixin hooks

  protected override get fieldSize(): ElementSize {
    return 'md';
  }

  protected override get groupLabel(): boolean {
    return true;
  }

  /** The `group` element: the form mixin delegates the host's `aria-*` to it and sets `aria-invalid` on it. */
  protected override get formControl(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.group');
  }

  /** The first enabled option's checkbox: where a blocked submit puts focus. */
  protected override get validationAnchor(): HTMLElement | null {
    const items = this.#items();
    const enabled = items.find((item) => !item.isDisabled) ?? items[0];
    return enabled?.control ?? this.formControl;
  }

  protected override get validators(): Validator<this>[] {
    // The browser's own localized "check at least one" message, like a required native checkbox.
    return [requiredValidator<this>((list) => list.values.length === 0, 'checkbox')];
  }

  /** One `name=value` entry for each checked option; nothing when none is checked or there is no name. */
  protected override formValue(): FormValue {
    return this.#entries();
  }

  protected override formState(): FormValue {
    return this.#entries();
  }

  protected override formResetValue(): void {
    this.#values = undefined;
    this.#loadingValue = null;
    super.formResetValue();
    this.requestUpdate('values');
  }

  protected override formRestoreState(state: FormValue, _reason: 'restore' | 'autocomplete'): void {
    if (state instanceof FormData) this.values = state.getAll(this.name).map(String);
  }

  /** Focuses the first enabled option's checkbox. */
  override focus(options?: FocusOptions): void {
    const items = this.#items();
    const target = (items.find((item) => !item.isDisabled) ?? items[0])?.control;
    if (target) target.focus(options);
    else super.focus(options);
  }

  // ---------------------------------------------------------------------------------- lifecycle

  constructor() {
    super();
    // The options' checkboxes fire the native events (composed); the list reacts to them.
    this.addEventListener('input', this.#onItemInput);
    this.addEventListener('click', this.#onLabelClick);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('density') && !LIST_DENSITIES.includes(this.density)) {
      devWarn(
        `checkbox-list:density:${this.density}`,
        `<tct-checkbox-list density="${this.density}"> is not one of ${LIST_DENSITIES.join(', ')}.`,
      );
    }
    // The host disappears as a box so a parent grid places the label and the group in its columns.
    this.toggleAttribute(
      'data-horizontal-labels',
      this.layoutContext.value?.direction === 'horizontal-labels',
    );
    this.#publishRows();
    this.#publish();
  }

  #publishRows(): void {
    const density = oneOf(this.density, LIST_DENSITIES, 'balanced');
    const current = this.#rows.value;
    if (current?.density === density && current.hasDividers === this.hasDividers) return;
    const next: ListContextValue = {
      density,
      hasDividers: this.hasDividers,
      listStyle: 'none',
      edgeCompensation: undefined,
    };
    this.#rows.setValue(next);
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    if (!this.label && !this.hasAttribute('aria-label') && !this.hasAttribute('aria-labelledby')) {
      devWarn(
        'checkbox-list:label',
        '<tct-checkbox-list> needs a `label`: it is the accessible name of the group.',
      );
    }
    // Options render (and expose their checkbox) after the list does: then the anchor is settled.
    void this.#settleItems();
  }

  async #settleItems(): Promise<void> {
    await Promise.all(this.#items().map((item) => item.updateComplete));
    this.syncFormState();
  }

  /** The options of this list (not of a nested one), in DOM order. */
  #items(): TctCheckboxListItem[] {
    return [...this.querySelectorAll<TctCheckboxListItem>('tct-checkbox-list-item')].filter(
      (item) => item.closest('tct-checkbox-list') === this,
    );
  }

  /** The options marked `checked` in the markup: the selection before the list is written or toggled. */
  #defaultValues(): string[] {
    return this.#items()
      .filter((item) => item.value !== '' && item.hasAttribute('checked'))
      .map((item) => item.value);
  }

  #entries(): FormData | null {
    const values = this.values;
    if (!this.name || values.length === 0) return null;
    const data = new FormData();
    for (const value of values) data.append(this.name, value);
    return data;
  }

  /** Tells the options what the list decided; an unchanged state keeps its identity. */
  #publish(force = false): void {
    const next: CheckboxListContextValue = {
      values: this.values,
      disabled: this.isDisabled,
      hasDisabledMessage: this.showsDisabledMessage,
      readonly: this.readonly,
      loadingValue: this.#loadingValue,
    };
    const current = this.#provider.value;
    const same =
      current?.disabled === next.disabled &&
      current.hasDisabledMessage === next.hasDisabledMessage &&
      current.readonly === next.readonly &&
      current.loadingValue === next.loadingValue &&
      current.values.length === next.values.length &&
      current.values.every((value, index) => value === next.values[index]);
    if (!force && same) return;
    this.#provider.setValue(next, true);
  }

  // -------------------------------------------------------------------------------- rendering

  override render() {
    const horizontal = this.layoutContext.value?.direction === 'horizontal-labels';
    const density = oneOf(this.density, LIST_DENSITIES, 'balanced');
    const status = this.effectiveStatus;
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
              role="group"
              aria-disabled=${ifDefined(this.isDisabled ? 'true' : undefined)}
              aria-busy=${ifDefined(this.#loadingValue !== null ? 'true' : undefined)}
              ?data-disabled=${this.isDisabled}
            >
              <div
                class="list"
                part="list"
                role="list"
                data-density=${density}
                ?data-dividers=${this.hasDividers}
              >
                <slot @slotchange=${this.#onSlotChange}></slot>
              </div></div
          ></tct-tooltip>
          ${status?.message ? this.renderStatusMessage() : nothing}
        </div>
      </div>
      ${this.renderHelpers()}`;
  }

  // ---------------------------------------------------------------------------------- events

  readonly #onSlotChange = (): void => {
    this.requestUpdate();
  };

  /**
   * An option's checkbox toggled (the native `input` event, composed and retargeted to the option): the
   * selection follows it, and `changeAction` runs. Toggles from anything else in the option (an author's
   * own control in `end`) are not the list's.
   */
  readonly #onItemInput = (event: Event): void => {
    const item = event.target;
    if (!(item instanceof Element) || item.localName !== 'tct-checkbox-list-item') return;
    const option = item as TctCheckboxListItem;
    if (option.value === '' || option.closest('tct-checkbox-list') !== this) return;
    if (this.isDisabled || this.readonly) return;
    const checked = option.control?.checked ?? false;
    const previous = this.values;
    const next = checked
      ? previous.includes(option.value)
        ? previous
        : [...previous, option.value]
      : previous.filter((value) => value !== option.value);
    this.#values = next;
    // Every toggle re-asserts the options' state, also when a controller changes nothing.
    this.#publish(true);
    this.requestUpdate('values', previous);
    this.#runChangeAction(next, previous, option.value);
  };

  /** Runs `changeAction`; the toggled option is busy meanwhile, and the old selection returns on rejection. */
  #runChangeAction(next: string[], previous: string[], toggled: string): void {
    const action = this.changeAction;
    if (!action) return;
    const settled = this.trackAction(action([...next]));
    if (!settled) return;
    this.#loadingValue = toggled;
    this.#publish();
    void settled.then((ok) => {
      this.settleAction();
      if (!this.actionPending) this.#loadingValue = null;
      if (!ok) this.#values = previous;
      this.#publish(true);
      this.requestUpdate();
    });
  }

  /** `<label for>` reaches the host: focus the first option's checkbox. */
  readonly #onLabelClick = (event: MouseEvent): void => {
    if (event.composedPath()[0] !== this || this.isDisabled) return;
    this.focus();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-checkbox-list': TctCheckboxList;
  }
}
