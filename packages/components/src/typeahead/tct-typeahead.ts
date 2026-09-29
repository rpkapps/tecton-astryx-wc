import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import typeaheadMessages from '@tecton-wc/locales/en/typeahead.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {TctSelectionChangeEvent} from '@tecton-wc/core/events/tct-selection-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {requiredValidator} from '@tecton-wc/core/forms/validators.js';
import type {FormValue, Validator} from '@tecton-wc/core/mixins/form-control.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {isImeKeyEvent} from '@tecton-wc/core/utils/ime.js';
import {TctInputClearButton} from '../field/tct-input-clear-button.js';
import layer from '../styles/layer.styles.css';
import scrollbar from '../styles/scrollbar.styles.css';
import {TctBoxControl} from '../text-area/tct-box-control.js';
import {TctToken} from '../token/tct-token.js';
import popup from './typeahead-popup.styles.css';
import {TypeaheadEngine} from './typeahead-engine.js';
import {TctTypeaheadItem} from './tct-typeahead-item.js';
import styles from './tct-typeahead.styles.css';
import type {SearchableItem, SearchSource, TypeaheadRenderResult} from './typeahead.types.js';

/** Attributes forwarded to the inner input that are not reactive properties: a change re-renders. */
const FORWARDED_ATTRIBUTES = ['enterkeyhint', 'inputmode'] as const;

/**
 * A search-as-you-type field for choosing one item from a large or dynamic set: an editable combobox
 * (WAI-ARIA APG, list autocomplete, `aria-activedescendant`) with its label, description and status, a
 * result popup fed by a `search-source`, and the chosen item shown as a token. It is a form-associated
 * element: it submits the chosen item's `id` under `name`, resets, restores, validates (`required` means an
 * item is chosen) and joins a `<fieldset disabled>` like a native control.
 *
 * Type to search: each query is debounced, searched from `min-query-length` characters, and a response
 * that arrives after a newer query never overwrites it. Arrow keys move the highlight (DOM focus stays in
 * the input), Enter chooses, Escape closes the popup (one layer per press), Tab leaves. The result count
 * is announced once per menu, and an IME candidate-window Enter never chooses. Once an item is chosen it
 * shows as a token; pressing the token (or Enter on it) edits: the query becomes the item's label, and
 * leaving without choosing restores the token. `entries-on-focus` shows the source's `bootstrap()` results
 * as soon as the field takes focus.
 *
 * `item` is the chosen item (upstream `value`); `value` is its `id`, the form value. Set either; setting
 * them fires no events. A choice fires the cancelable `tct-selection-change`, then `input` and `change`;
 * typing fires `input` (read the text from `query`).
 * [mwg:form-associated-custom-elements] [mwg:accessibility] [mwg:ime-safe-enter-submit]
 *
 * @summary Single-selection search field: an editable combobox with a debounced, cancelable result popup.
 * @tag tct-typeahead
 * @upstream Typeahead
 * @slot start - Custom content at the start of the field (an avatar, a glyph).
 * @csspart field - The whole field: label, control and status.
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart label-icon - The icon before the label text.
 * @csspart input - The painted box around the input and the token (upstream `typeahead` target).
 * @csspart control - The combobox `<input>`.
 * @csspart token - The token showing the chosen item.
 * @csspart start-icon - The start icon.
 * @csspart busy - The busy indicator.
 * @csspart status-icon - The status icon inside the box.
 * @csspart status-button - The status button of the `tooltip` status variant.
 * @csspart status - The status message box.
 * @csspart popup - The painted result popup box.
 * @csspart dropdown - The scrolling list of results (upstream `typeahead-dropdown` target).
 * @csspart option - One result row.
 * @csspart empty-state - The message shown when a completed search found nothing (upstream `typeahead-empty-state` target).
 * @csspart typeahead-item - The default content of a result row (upstream `typeahead-item` target).
 * @cssstate user-invalid - Invalidity is displayed (after a user commit, a submit attempt or `reportValidity()`).
 * @cssstate invalid - The value does not satisfy its constraints (not displayed).
 * @cssstate busy - A search is pending or `loading` is set.
 * @cssstate open - The result popup is open.
 * @fires input - Native, when the query text changes or an item is chosen; composed, from the inner input.
 * @fires change - When the user commits a choice or clears it; once, bubbling and composed.
 * @fires {TctSelectionChangeEvent} tct-selection-change - Before the user chooses or clears an item; cancelable, and preventing it keeps the current item.
 * @fires {TctOpenChangeEvent} tct-open-change - Before the popup opens or closes because of the user or a search result; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After the popup finished opening or closing.
 * @cloakDisplay block
 * @cloakMinBlockSize 4rem
 */
export class TctTypeahead extends TctBoxControl {
  static override readonly tagName = 'tct-typeahead';
  static override readonly dependencies = [
    ...TctBoxControl.dependencies,
    TctInputClearButton,
    TctToken,
    TctTypeaheadItem,
  ];
  static override styles: CSSResultGroup = [TctBoxControl.styles, layer, scrollbar, popup, styles];

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, ...FORWARDED_ATTRIBUTES];
  }

  /** Supplies the results: `search(query)`, `bootstrap()` and an optional `cancel()`. */
  @property({attribute: false}) searchSource: SearchSource | undefined;

  /** Renders the content of a result row (a template, a node or text; never HTML). Default: `tct-typeahead-item`. */
  @property({attribute: false}) renderItem:
    ((item: SearchableItem) => TypeaheadRenderResult) | undefined;

  /** Shows the source's `bootstrap()` results when the field takes focus, before anything is typed. */
  @property({type: Boolean, attribute: 'entries-on-focus'}) entriesOnFocus = false;

  /** The most results shown. */
  @property({type: Number, attribute: 'max-menu-items'}) maxMenuItems = 10;

  /**
   * Minimum query length, in characters as a person counts them (an emoji is one), before the source is
   * searched. Below it no search runs and the menu stays closed.
   */
  @property({type: Number, attribute: 'min-query-length'}) minQueryLength = 1;

  /** Message shown when a completed search found nothing. Default: the localised "No results found". */
  @property({attribute: 'empty-search-results-text'}) emptySearchResultsText: string | undefined;

  /** Delay in ms before a typed query is searched; `0` for synchronous sources. */
  @property({type: Number, attribute: 'debounce-ms'}) debounceMs = 150;

  /** Removes the clear button (it shows while an item is chosen). */
  @property({type: Boolean, attribute: 'no-clear'}) noClear = false;

  /** Name of an icon shown at the start of the field (a registered icon such as `search`). */
  @property({attribute: 'start-icon'}) startIcon = '';

  /**
   * The chosen item, or `null` (upstream `value`). Until set it follows `defaultItem`, else the `value`
   * attribute. Writing it fires no events.
   */
  @property({attribute: false})
  get item(): SearchableItem | null {
    if (this.#item !== undefined) return this.#item;
    if (this.defaultItem !== undefined) return this.defaultItem;
    return this.defaultValue ? {id: this.defaultValue, label: this.defaultValue} : null;
  }
  set item(value: SearchableItem | null | undefined) {
    this.#item = value ?? null;
  }

  /** The item that form reset returns to (the `value` attribute names it when there is no label to show). */
  @property({attribute: false}) defaultItem: SearchableItem | null | undefined;

  /**
   * The `id` of the chosen item: the value the form submits. Setting it chooses that id (with the id as its
   * label unless the item is the current one); an empty string clears. The `value` attribute is the
   * default that form reset returns to. Writing it fires no events.
   */
  @property({attribute: false})
  override get value(): string {
    return this.item?.id ?? '';
  }
  override set value(value: string) {
    const id = value === null || value === undefined ? '' : String(value);
    if (id === '') this.#item = null;
    else if (this.item?.id !== id) this.#item = {id, label: id};
  }

  /** The text in the input (the query), not the chosen item. */
  get query(): string {
    return this.#engine.query;
  }

  /** Whether the result popup is open. */
  get open(): boolean {
    return this.#engine.open;
  }

  /** Whether the chosen item is being edited (its label is in the input and the token is hidden). */
  get editing(): boolean {
    return this.#editing;
  }

  /** The inner combobox input. */
  get control(): HTMLInputElement | null {
    return this.formControl;
  }

  #item: SearchableItem | null | undefined;
  #editing = false;
  /**
   * Set from pressing the token until the input has taken focus: the token that held focus is replaced by the
   * input in that render, which reports focus leaving with no destination. That is not a departure.
   */
  #focusMoving = false;

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'typeahead',
    defaults: typeaheadMessages,
  });
  readonly #slots: SlotController = new SlotController(this, 'start');
  readonly #engine: TypeaheadEngine<SearchableItem> = new TypeaheadEngine<SearchableItem>(this, {
    config: () => ({
      source: this.searchSource,
      minQueryLength: this.minQueryLength,
      debounceMs: this.debounceMs,
      maxMenuItems: this.maxMenuItems,
      entriesOnFocus: this.entriesOnFocus,
      blocked: this.isDisabled || this.readonly,
      menuWidth: undefined,
      size: this.fieldSize,
      renderItem: this.renderItem,
      emptyText: this.emptySearchResultsText ?? this.#locale.t('emptySearchResults'),
      selectedId: this.item?.id ?? null,
      queryEntries: undefined,
      filter: undefined,
      retainAfterSelect: false,
    }),
    input: () => this.control,
    anchor: () => this.renderRoot?.querySelector<HTMLElement>('.input-wrapper') ?? null,
    locale: () => this.#locale,
    onKeyDown: (event) => {
      this.#onKeyDown(event);
    },
    onSelect: (item, reason) => this.#onSelect(item, reason),
    onOpenRequest: (open, reason) => this.dispatch(new TctOpenChangeEvent(open, reason)),
    onOpenSettled: (open) => {
      this.dispatch(new TctAfterOpenChangeEvent(open));
    },
    onBusyChange: () => {
      this.requestUpdate();
    },
  });

  // ------------------------------------------------------------------------------ mixin hooks

  protected override get formControl(): HTMLInputElement | null {
    return this.renderRoot?.querySelector<HTMLInputElement>('input.combobox') ?? null;
  }

  protected override get submitsOnEnter(): boolean {
    return true;
  }

  protected override get validators(): Validator<this>[] {
    // "Choose an item": required means a chosen item, whatever is typed in the input.
    return [requiredValidator<this>((element) => element.item === null, 'select')];
  }

  protected override formValue(): FormValue {
    return this.item?.id ?? null;
  }

  /** The restore state carries the label too, so a restored field shows the item, not its id. */
  protected override formState(): FormValue {
    const item = this.item;
    return item ? JSON.stringify({id: item.id, label: item.label}) : null;
  }

  protected override formResetValue(): void {
    this.#item = undefined;
    this.#editing = false;
    this.#engine.reset();
    this.requestUpdate('item');
  }

  protected override formRestoreState(state: FormValue, _reason: 'restore' | 'autocomplete'): void {
    if (typeof state !== 'string') return;
    try {
      const parsed = JSON.parse(state) as unknown;
      if (parsed && typeof parsed === 'object' && 'id' in parsed) {
        const {id, label} = parsed as {id: unknown; label?: unknown};
        this.#item = {id: String(id), label: typeof label === 'string' ? label : String(id)};
        return;
      }
    } catch {
      // Not our JSON: a plain id (browser autofill).
    }
    this.value = state;
  }

  /** The busy indicator also follows a pending search. */
  protected override get busy(): boolean {
    return super.busy || this.#engine.loading;
  }

  // ---------------------------------------------------------------------------------- lifecycle

  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if ((FORWARDED_ATTRIBUTES as readonly string[]).includes(name)) this.requestUpdate();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.toggleState('open', this.#engine.open);
    // An item written from outside while editing ends the edit.
    if (changed.has('item') && this.#editing && this.item === null) this.#editing = false;
  }

  protected override firstUpdated(): void {
    if (this.hasAttribute('autofocus')) {
      void this.updateComplete.then(() => {
        this.focus({preventScroll: true});
      });
    }
  }

  // -------------------------------------------------------------------------------- rendering

  override render(): TemplateResult {
    return html`${this.renderFieldLayout(this.renderBoxWrapper(this.#renderBox()))}${this.#engine.renderPopup()}`;
  }

  #renderBox(): TemplateResult {
    const item = this.item;
    const showToken = item !== null && !this.#editing;
    const inert = this.showsDisabledMessage;
    const showClear = !this.noClear && item !== null && !this.isDisabled && !this.readonly;
    const customPlaceholder = this.hasAttribute('placeholder') || this.placeholder !== '';
    const placeholder = showToken
      ? undefined
      : customPlaceholder
        ? this.placeholder
        : this.#locale.t('searchPlaceholder');
    const endSlot = this.busy || showClear || this.#hasStatusIcon;
    return html`<div
      class="typeahead"
      data-size=${this.fieldSize}
      ?data-token=${showToken}
      @click=${this.#onWrapperClick}
      @focusout=${this.#onFocusOut}
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
      <div class="content-lane">
        ${
          showToken
            ? html`<tct-token
                class="token"
                part="token"
                label=${item.label}
                size=${this.fieldSize}
                clickable
                ?disabled=${this.isDisabled}
                @click=${this.#onTokenClick}
              ></tct-token>`
            : nothing
        }
        ${this.#engine.renderInput({
          className: 'input combobox',
          part: 'control',
          placeholder,
          // The input is invisible and inert behind the token: out of the Tab order so keyboard users do
          // not meet a stop they cannot see (WCAG 2.4.3 / 2.4.7). It stays focusable by script.
          tabindex: showToken ? -1 : undefined,
          disabled: this.isDisabled && !inert,
          focusableDisabled: inert,
          readonly: this.readonly && !inert,
          ariaRequired: this.announcesRequired,
          enterkeyhint: this.getAttribute('enterkeyhint') ?? undefined,
          inputmode: this.getAttribute('inputmode') ?? undefined,
          ariaLabelledBy: this.groupLabelId,
        })}
      </div>
      ${
        endSlot
          ? html`<span class="end-lane"
              >${this.renderBusy()}${
                showClear
                  ? html`<tct-input-clear-button
                      label=${this.#locale.t('clearSelection')}
                      @click=${this.#onClear}
                    ></tct-input-clear-button>`
                  : nothing
              }${this.renderStatusIcon()}</span
            >`
          : nothing
      }
    </div>`;
  }

  get #hasStatusIcon(): boolean {
    const status = this.effectiveStatus;
    return status !== undefined && !this.inGroup && this.effectiveStatusVariant !== 'detached';
  }

  // ---------------------------------------------------------------------------------- events

  /** The user chose a result: ask, then commit. */
  #onSelect(item: SearchableItem, reason: ChangeReason): boolean {
    if (!this.dispatch(new TctSelectionChangeEvent('select', item, [item], reason))) return false;
    this.#item = item;
    this.#editing = false;
    this.requestUpdate('item');
    this.#commit();
    // After a choice keyboard users stay in the component: the token takes focus once it has rendered.
    void this.updateComplete.then(() => {
      this.#focusToken();
    });
    return true;
  }

  /** `input` then one `change`, like every value control: a choice is a user edit that commits. */
  #commit(): void {
    this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    this.redispatchChange();
  }

  #focusToken(): void {
    const token = this.renderRoot.querySelector<HTMLElement>('tct-token.token');
    if (token) token.focus();
  }

  readonly #onClear = (event: Event): void => {
    event.stopPropagation();
    const previous = this.item;
    if (!previous) return;
    if (!this.dispatch(new TctSelectionChangeEvent('clear', previous, [], 'pointer'))) return;
    this.#item = null;
    this.#editing = false;
    this.#engine.reset();
    this.requestUpdate('item');
    this.#commit();
    void this.updateComplete.then(() => {
      this.control?.focus();
    });
  };

  /** Pressing the token (or Enter/Space on it) edits the chosen item. */
  readonly #onTokenClick = (event: Event): void => {
    event.stopPropagation();
    this.#enterEdit();
  };

  /** Clicking the field: focus the input, or edit the chosen item. */
  readonly #onWrapperClick = (event: MouseEvent): void => {
    if (this.isDisabled && !this.showsDisabledMessage) return;
    if (this.isDisabled || this.readonly) return;
    const origin = event.composedPath()[0];
    // Nested controls (the clear button, the token's own buttons) act by themselves.
    if (origin instanceof Element && origin.closest('tct-input-clear-button, tct-token')) return;
    if (this.item !== null && !this.#editing) this.#enterEdit();
    else this.control?.focus();
  };

  #enterEdit(): void {
    const item = this.item;
    if (!item || this.isDisabled || this.readonly) return;
    this.#editing = true;
    this.#focusMoving = true;
    this.#engine.setQuery(item.label);
    this.requestUpdate();
    void this.updateComplete.then(() => {
      const control = this.control;
      if (control) {
        control.focus();
        control.setSelectionRange(0, control.value.length);
      }
      this.#focusMoving = false;
    });
  }

  #exitEdit(): void {
    if (!this.#editing) return;
    this.#editing = false;
    // The token comes back untouched; nothing was chosen, so no event.
    this.#engine.reset();
    this.requestUpdate();
  }

  /** Focus leaving the field ends an edit that chose nothing. */
  readonly #onFocusOut = (event: FocusEvent): void => {
    if (!this.#editing || this.#focusMoving) return;
    const next = event.relatedTarget;
    const box = this.renderRoot.querySelector('.input-wrapper');
    if (next instanceof Node && box?.contains(next)) return;
    this.#exitEdit();
  };

  /** Escape in edit mode restores the token and puts focus back on it. */
  #onKeyDown(event: KeyboardEvent): void {
    if (isImeKeyEvent(event)) return;
    if (event.key === 'Escape' && this.#editing) {
      event.preventDefault();
      this.#exitEdit();
      void this.updateComplete.then(() => {
        this.#focusToken();
      });
    }
  }

  /** The anchor a blocked submit focuses: the input, which stays focusable behind the token. */
  protected override get validationAnchor(): HTMLElement | null {
    return this.control;
  }

  protected override get ariaDelegationExclude(): readonly string[] {
    return [
      ...super.ariaDelegationExclude,
      'aria-expanded',
      'aria-controls',
      'aria-activedescendant',
      'aria-autocomplete',
      'aria-busy',
      'aria-disabled',
      'aria-haspopup',
    ];
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-typeahead': TctTypeahead;
  }
}
