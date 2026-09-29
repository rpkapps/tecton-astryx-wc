import {html, nothing, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {normalizeOption, type SelectorRecord} from './selector-options.js';
import type {SelectorRenderer} from './selector.types.js';
import {TctSelectBase} from './tct-select-base.js';

/**
 * A select-only combobox: pick one value from a moderate list of options. A trigger shows the chosen
 * option (or a placeholder) and opens a listbox in an anchored popover, or in a bottom sheet on a compact
 * touch device (`presentation="adaptive"`). Options come from the `options` property: strings, objects
 * with a label, description, icon and `disabled`, dividers and titled sections. `has-search` adds a
 * search field that filters the list and announces the match count; `has-clear` adds a clear button.
 *
 * It is a form-associated element like a native `<select>`: it submits the chosen value under `name`
 * (an empty string while nothing is chosen), takes part in constraint validation (`required`), resets
 * to the `value` attribute and restores after navigation. `input` and then `change` fire when the user
 * chooses another option (a click, Enter, or typeahead on the closed trigger); property writes fire
 * nothing. The value is a string; `renderOption` and `renderValue` draw custom content with
 * `tct-selector-option`.
 *
 * Keyboard (WAI-ARIA APG select-only combobox): Enter, Space, ArrowDown or ArrowUp open it and highlight
 * the chosen option; arrows move the highlight (`aria-activedescendant`, DOM focus stays on the trigger),
 * Home/End/PageUp/PageDown jump, Enter or Space choose, Escape closes, Tab closes and moves on,
 * printable characters select the matching option (typeahead), Delete and Backspace clear.
 * Async option sources use `options-state`: the panel says loading or the error, announced once.
 * [mwg:form-associated-custom-elements] [mwg:accessible-web-components] [mwg:accessibility]
 * [mwg:animate-to-from-top-layer]
 *
 * @summary Dropdown selector for choosing one value from a list of options.
 * @tag tct-selector
 * @upstream Selector
 * @csspart field - The whole field: label, control and status.
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart label-icon - The icon before the label text.
 * @csspart input - The painted box around the trigger (upstream theming target `selector`).
 * @csspart trigger - The combobox button.
 * @csspart placeholder - The placeholder text while nothing is chosen.
 * @csspart value - The chosen option's label in the trigger.
 * @csspart start-icon - The start icon.
 * @csspart indicator - The chevron (upstream target `selector-indicator-icon`).
 * @csspart busy - The spinner of a busy selector.
 * @csspart status-icon - The status icon inside the box.
 * @csspart status-button - The status button of the `tooltip` status variant.
 * @csspart status - The status message box.
 * @csspart popup - The popover surface (upstream target `selector-popup`).
 * @csspart sheet - The bottom sheet of the touch presentation.
 * @csspart sheet-content - The content of the bottom sheet.
 * @csspart search - The search row (upstream target `selector-search`).
 * @csspart listbox - The list of options.
 * @csspart option - An option row (upstream target `selector-option-row`).
 * @csspart check - The selection mark column of a row (upstream target `selector-check`).
 * @csspart section-heading - The heading of a titled section (upstream target `selector-section-heading`).
 * @csspart empty-state - The message of an empty, loading or failed panel (upstream target `selector-empty-state`).
 * @cssstate open - The popup is open.
 * @cssstate busy - `loading` is set or a change action is pending.
 * @cssstate user-invalid - Invalidity is displayed (after a change, a submit attempt or `reportValidity()`).
 * @cssstate invalid - The value does not satisfy its constraints (not displayed).
 * @fires input - Native, when the user chooses another option or clears; composed.
 * @fires change - Native, once after `input`; composed and dispatched from the host.
 * @fires tct-clear - The user pressed the clear button or Delete on the trigger; cancelable, and preventing it keeps the value.
 * @fires {TctOpenChangeEvent} tct-open-change - Before the user (trigger, keys, choosing, Escape, an outside press) or `requestClose()` opens or closes the popup; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After an open or close settled; every actual change.
 * @cloakDisplay block
 * @cloakMinBlockSize 4.5rem
 */
export class TctSelector extends TctSelectBase {
  static override readonly tagName = 'tct-selector';

  /**
   * Renders the chosen option inside the closed trigger: `(option) => html`…``. Called only while
   * something is chosen. What it draws sizes the trigger: one line measures the size token, each further
   * line adds one text line; inside an input group the trigger clamps it to the group's row.
   */
  @property({attribute: false}) renderValue: SelectorRenderer | undefined;

  /**
   * Runs after every user change, with the new value. While its promise is pending the selector is busy
   * (`:state(busy)`, a spinner and `aria-busy`) and shows the new value; if it rejects the value returns
   * to what it was.
   */
  @property({attribute: false}) changeAction: ((value: string) => void | Promise<void>) | undefined;

  protected override get multiple(): boolean {
    return false;
  }

  protected override get messageNamespace(): string {
    return 'selector';
  }

  protected override isChosen(value: string): boolean {
    return value === this.value;
  }

  protected override get hasSelection(): boolean {
    return this.value !== '';
  }

  protected override get selectedRecord(): SelectorRecord | undefined {
    const value = this.value;
    if (value === '') return undefined;
    const data = this.selectableOptions.find((option) => option.value === value);
    if (!data) return undefined;
    const option = normalizeOption(data);
    return {value: option.value, label: option.label ?? option.value, data: option};
  }

  protected override renderValueContent(): TemplateResult | typeof nothing {
    const record = this.selectedRecord;
    if (!record) return nothing;
    if (this.renderValue) {
      return html`<tct-selector-value
        class="value"
        part="value"
        layout=${this.inGroup ? 'inline' : 'stacked'}
        >${this.renderValue(record.data)}</tct-selector-value
      >`;
    }
    const icon = !this.startIcon && record.data.icon ? record.data.icon : '';
    return html`${
        icon
          ? html`<tct-icon class="value-icon" name=${icon} size="sm" color="secondary"></tct-icon>`
          : nothing
      }<span class="value" part="value">${record.label}</span>`;
  }

  protected override commitRecord(record: SelectorRecord): void {
    this.#change(record.value);
  }

  protected override clearSelection(): void {
    this.#change('');
  }

  /** The user changed the value: `input` and `change`, then the change action. */
  #change(next: string): void {
    const previous = this.value;
    if (next === previous) return;
    this.value = next;
    this.notifyChange();
    this.#runChangeAction(next, previous);
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
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-selector': TctSelector;
  }
}
