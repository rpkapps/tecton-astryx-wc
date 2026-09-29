import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {announce} from '@tecton-wc/core/a11y/announcer.js';
import type {FormValue} from '@tecton-wc/core/mixins/form-control.js';
import type {TctElementConstructor} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import type {IndicatorPosition} from '@tecton-wc/core/indicators/registry.js';
import {TctBadge} from '../badge/tct-badge.js';
import {
  SELECT_ALL_VALUE,
  getSelectableOptions,
  type SelectorRecord,
} from '../selector/selector-options.js';
import {TctSelectBase} from '../selector/tct-select-base.js';
import {
  TRIGGER_DISPLAYS,
  type MultiSelectorFormatter,
  type MultiSelectorSelectedItem,
  type TriggerDisplay,
} from './multi-selector.types.js';
import styles from './tct-multi-selector.styles.css';

/** Splits a `value` attribute into the values it lists: whitespace-separated tokens. */
const tokens = (text: string | null | undefined): string[] =>
  (text ?? '').split(/\s+/).filter((token) => token !== '');

const sameValues = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * A select-only combobox for choosing several values from a list: the same trigger, popover (or bottom
 * sheet), search, sections, async states and keyboard contract as `tct-selector`, with a checkbox on each
 * row. Choosing toggles a row and keeps the list open; `has-select-all` adds a "Select all" row that
 * acts on the options currently shown (a search narrows it) and shows a partial state.
 * Rows the user chose are listed first in their group while the list is open.
 *
 * The closed trigger shows the choice as a `count` ("3 selected"), the first labels (`labels`) or badges
 * (`badges`, up to `max-badges`); `formatValue` writes the text of the first two.
 *
 * It is form-associated like a native `<select multiple>`: it submits one entry per chosen value under
 * `name` (repeated names in `FormData`), takes part in constraint validation (`required`: at least one
 * value), resets to the `value` attribute and restores after navigation. `values` is the array; `value`
 * is the same list as whitespace-separated text, also the form of the `value` attribute (a value that
 * contains whitespace can only be set through `values`). `input` and then `change` fire once per user
 * toggle, select-all or clear; property writes fire nothing. Selection changes are announced once
 * ("3 of 12 selected", "All selected", "Selection cleared"). [mwg:form-associated-custom-elements]
 * [mwg:accessible-web-components] [mwg:accessibility]
 *
 * @summary Dropdown for choosing several values, with checkboxes, select all and search.
 * @tag tct-multi-selector
 * @upstream MultiSelector
 * @csspart field - The whole field: label, control and status.
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart label-icon - The icon before the label text.
 * @csspart input - The painted box around the trigger (upstream theming target `multi-selector`).
 * @csspart trigger - The combobox button.
 * @csspart placeholder - The placeholder text while nothing is chosen.
 * @csspart value - The text of the `count` and `labels` displays.
 * @csspart badges - The badges of the `badges` display.
 * @csspart badge - One badge.
 * @csspart overflow - The "+N" after the visible labels or badges.
 * @csspart start-icon - The start icon.
 * @csspart indicator - The chevron (upstream target `multi-selector-indicator-icon`).
 * @csspart busy - The spinner of a busy selector.
 * @csspart status-icon - The status icon inside the box.
 * @csspart status-button - The status button of the `tooltip` status variant.
 * @csspart status - The status message box.
 * @csspart popup - The popover surface (upstream target `multi-selector-popup`).
 * @csspart sheet - The bottom sheet of the touch presentation.
 * @csspart sheet-content - The content of the bottom sheet.
 * @csspart search - The search row (upstream target `multi-selector-search`).
 * @csspart listbox - The list of options.
 * @csspart option - An option row (upstream target `multi-selector-option`).
 * @csspart check - The checkbox column of a row.
 * @csspart section-heading - The heading of a titled section (upstream target `multi-selector-section-heading`).
 * @csspart empty-state - The message of an empty, loading or failed panel (upstream target `multi-selector-empty-state`).
 * @cssstate open - The popup is open.
 * @cssstate busy - `loading` is set or a change action is pending.
 * @cssstate user-invalid - Invalidity is displayed (after a change, a submit attempt or `reportValidity()`).
 * @cssstate invalid - The value does not satisfy its constraints (not displayed).
 * @fires input - Native, when the user toggles an option, selects all or clears; composed.
 * @fires change - Native, once after `input`; composed and dispatched from the host.
 * @fires tct-clear - The user pressed the clear button or Delete on the trigger; cancelable, and preventing it keeps the values.
 * @fires {TctOpenChangeEvent} tct-open-change - Before the user (trigger, keys, Escape, an outside press) or `requestClose()` opens or closes the popup; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After an open or close settled; every actual change.
 * @cloakDisplay block
 * @cloakMinBlockSize 4.5rem
 */
export class TctMultiSelector extends TctSelectBase {
  static override readonly tagName = 'tct-multi-selector';
  static override readonly dependencies: readonly TctElementConstructor[] = [
    ...TctSelectBase.dependencies,
    TctBadge,
  ];
  static override styles: CSSResultGroup = [TctSelectBase.styles, styles];

  /** How the choice shows on the closed trigger: `count` (default), `labels` or `badges`. */
  @property({attribute: 'trigger-display'}) triggerDisplay: TriggerDisplay = 'count';

  /** The most badges shown before "+N" (`badges` display). Default 3. */
  @property({type: Number, attribute: 'max-badges'}) maxBadges = 3;

  /** Shows a "Select all" row first in the list. It acts on the enabled options currently shown. */
  @property({type: Boolean, attribute: 'has-select-all'}) hasSelectAll = false;

  /** Label of the select-all row. Default: the localized "Select all". */
  @property({attribute: 'select-all-label'}) selectAllLabel = '';

  /**
   * Writes the trigger text of the `count` and `labels` displays: `(items) => string`, given the chosen
   * options (value and resolved label, in selection order). Not called while nothing is chosen.
   */
  @property({attribute: false}) formatValue: MultiSelectorFormatter | undefined;

  /**
   * Runs after every user change, with the new values. While its promise is pending the selector is busy
   * (`:state(busy)`, a spinner and `aria-busy`) and shows the new values; if it rejects they return to what
   * they were.
   */
  @property({attribute: false}) changeAction:
    ((values: string[]) => void | Promise<void>) | undefined;

  #values: string[] | undefined;
  #selectedAtOpen: ReadonlySet<string> | undefined;

  /**
   * The chosen values, in selection order. Until set (or the user chooses) it follows the `value`
   * attribute; form reset returns to it. Writing it fires no events.
   */
  @property({attribute: false})
  get values(): string[] {
    return this.#values ?? tokens(this.defaultValue);
  }
  set values(next: string[]) {
    this.#values = Array.isArray(next) ? next.map(String) : [];
  }

  /**
   * The chosen values as whitespace-separated text (the form of the `value` attribute). Use `values`
   * for a value that contains whitespace.
   */
  @property({attribute: false})
  override get value(): string {
    return this.values.join(' ');
  }
  override set value(next: string) {
    this.values = tokens(next);
  }

  protected override get multiple(): boolean {
    return true;
  }

  protected override get messageNamespace(): string {
    return 'multiSelector';
  }

  protected override get defaultIndicatorPosition(): IndicatorPosition {
    return 'start';
  }

  protected override get indicatorName(): 'check' | 'checkbox' {
    return 'checkbox';
  }

  protected override isChosen(value: string): boolean {
    return this.values.includes(value);
  }

  protected override get hasSelection(): boolean {
    return this.values.length > 0;
  }

  protected override get chosenFirst(): ReadonlySet<string> | undefined {
    return this.#selectedAtOpen;
  }

  protected override get selectAllRow(): {label: string} | undefined {
    return this.hasSelectAll
      ? {label: this.selectAllLabel || this.message('selectAll')}
      : undefined;
  }

  // ------------------------------------------------------------------------- form hooks

  /** One entry per chosen value under `name` (`FormData` with repeated names); nothing without a name. */
  protected override formValue(): FormValue {
    const values = this.values;
    if (!this.name || values.length === 0) return null;
    const data = new FormData();
    for (const value of values) data.append(this.name, value);
    return data;
  }

  /** What restore stores: the values under a fixed key, so it survives a change of `name`. */
  protected override formState(): FormValue {
    const values = this.values;
    if (values.length === 0) return null;
    const data = new FormData();
    for (const value of values) data.append('value', value);
    return data;
  }

  protected override formResetValue(): void {
    this.#values = undefined;
    this.requestUpdate('values');
  }

  /** Restores from the `FormData` `formValue()` stored, or from text (`autocomplete` restores a string). */
  protected override formRestoreState(state: FormValue): void {
    if (state instanceof FormData) this.values = [...state.values()].map(String);
    else if (typeof state === 'string') this.values = tokens(state);
  }

  // ------------------------------------------------------------------------- selection

  /** The enabled options currently shown, for "Select all". */
  get #enabledShown(): SelectorRecord[] {
    return this.visibleRecords.filter((record) => !record.disabled);
  }

  get #allShownChosen(): boolean {
    const shown = this.#enabledShown;
    return shown.length > 0 && shown.every((record) => this.isChosen(record.value));
  }

  get #someShownChosen(): boolean {
    return this.#enabledShown.some((record) => this.isChosen(record.value));
  }

  protected override markState(record: SelectorRecord): 'checked' | 'unchecked' | 'indeterminate' {
    if (!record.selectAll) return super.markState(record);
    if (this.#allShownChosen) return 'checked';
    return this.#someShownChosen ? 'indeterminate' : 'unchecked';
  }

  protected override rowSelected(record: SelectorRecord): boolean {
    return record.selectAll ? this.#allShownChosen : this.isChosen(record.value);
  }

  /** `aria-selected="mixed"` is not allowed on an option: the partial state is part of the name. */
  protected override optionName(record: SelectorRecord): string | undefined {
    if (!record.selectAll || this.#allShownChosen || !this.#someShownChosen) return undefined;
    return this.message('selectAllPartiallySelected', {label: record.label});
  }

  protected override commitRecord(record: SelectorRecord): void {
    if (record.value === SELECT_ALL_VALUE) this.#toggleAll();
    else this.#toggle(record.value);
  }

  protected override clearSelection(): void {
    this.#apply([]);
  }

  #toggle(value: string): void {
    const current = this.values;
    this.#apply(
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value],
    );
  }

  /** All shown enabled options are chosen: choose none of them; else choose them all (disabled ones keep their state). */
  #toggleAll(): void {
    const shown = new Set(this.#enabledShown.map((record) => record.value));
    const current = this.values;
    if (this.#allShownChosen) {
      this.#apply(current.filter((value) => !shown.has(value)));
      return;
    }
    const next = [...current];
    for (const value of shown) if (!next.includes(value)) next.push(value);
    this.#apply(next);
  }

  /** The user changed the values: `input` and `change`, one announcement, then the change action. */
  #apply(next: string[]): void {
    const previous = this.values;
    if (sameValues(next, previous)) return;
    this.values = next;
    this.notifyChange();
    this.#announceSelection(next);
    this.#runChangeAction(next, previous);
  }

  /** "Selection cleared", "All selected" or "3 of 12 selected", once per change. */
  #announceSelection(next: string[]): void {
    const selectable = new Set(getSelectableOptions(this.options).map((option) => option.value));
    const count = next.filter((value) => selectable.has(value)).length;
    const total = selectable.size;
    const text =
      count === 0
        ? this.message('selectionCleared')
        : total > 0 && count === total
          ? this.message('allSelected')
          : this.message('selectionCount', {count, total});
    announce(text, {element: this});
  }

  #runChangeAction(next: string[], previous: string[]): void {
    const action = this.changeAction;
    if (!action) return;
    const settled = this.trackAction(action([...next]));
    if (!settled) return;
    void settled.then((ok) => {
      this.settleAction();
      // Only when nothing else changed the values meanwhile.
      if (!ok && sameValues(this.values, next)) this.values = previous;
    });
  }

  // ------------------------------------------------------------------------- lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('triggerDisplay') && !TRIGGER_DISPLAYS.includes(this.triggerDisplay)) {
      devWarn(
        `tct-multi-selector:trigger-display:${this.triggerDisplay}`,
        `trigger-display "${this.triggerDisplay}" is not one of ${TRIGGER_DISPLAYS.join(', ')}.`,
      );
    }
    // The chosen options move to the top of their group when the list opens, and stay there until it closes.
    if (changed.has('open') && this.open) this.#selectedAtOpen = new Set(this.values);
  }

  // ------------------------------------------------------------------------- trigger value

  /** The chosen options with their labels, in selection order. */
  get #items(): MultiSelectorSelectedItem[] {
    const labels = new Map(
      getSelectableOptions(this.options).map((option) => [
        option.value,
        option.label ?? option.value,
      ]),
    );
    return this.values.map((value) => ({value, label: labels.get(value) ?? value}));
  }

  protected override renderValueContent(): TemplateResult | typeof nothing {
    const items = this.#items;
    if (items.length === 0) return nothing;
    const display = TRIGGER_DISPLAYS.includes(this.triggerDisplay) ? this.triggerDisplay : 'count';
    if (display === 'badges') {
      const shown = items.slice(0, Math.max(0, Math.floor(this.maxBadges)));
      const hidden = items.length - shown.length;
      return html`<span class="badges" part="badges"
        >${shown.map(
          (item) =>
            html`<tct-badge
              class="badge"
              part="badge"
              variant="neutral"
              label=${item.label}
            ></tct-badge>`,
        )}${
          hidden > 0
            ? html`<span class="overflow" part="overflow"
                >${this.messageById('@tct.multi-selector.moreCount', {count: hidden})}</span
              >`
            : nothing
        }</span
      >`;
    }
    return html`<span class="value" part="value">${this.#text(display, items)}</span>`;
  }

  #text(display: 'count' | 'labels', items: MultiSelectorSelectedItem[]): string {
    const custom = this.formatValue?.(items);
    if (custom !== undefined) return custom;
    if (display === 'count') {
      return this.messageById('@tct.multi-selector.selected', {count: items.length});
    }
    const shown = items.slice(0, 3).map((item) => item.label);
    const hidden = items.length - shown.length;
    const list = this.#list(shown);
    return hidden > 0
      ? `${list}, ${this.messageById('@tct.multi-selector.moreCount', {count: hidden})}`
      : list;
  }

  #list(labels: string[]): string {
    try {
      return new Intl.ListFormat(this.locale, {type: 'unit', style: 'short'}).format(labels);
    } catch {
      return labels.join(', ');
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-multi-selector': TctMultiSelector;
  }
}
