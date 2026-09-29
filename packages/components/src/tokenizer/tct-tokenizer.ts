import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {repeat} from 'lit/directives/repeat.js';
import tokenizerMessages from '@tecton-wc/locales/en/tokenizer.js';
import typeaheadMessages from '@tecton-wc/locales/en/typeahead.js';
import {announce} from '@tecton-wc/core/a11y/announcer.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {
  TctSelectionChangeEvent,
  type SelectionChangeAction,
} from '@tecton-wc/core/events/tct-selection-change.js';
import {requiredValidator} from '@tecton-wc/core/forms/validators.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import type {FormValue, Validator} from '@tecton-wc/core/mixins/form-control.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {oneOf} from '../field/field-utils.js';
import {TctInputClearButton} from '../field/tct-input-clear-button.js';
import {TctOverflowList} from '../overflow-list/tct-overflow-list.js';
import layer from '../styles/layer.styles.css';
import scrollbar from '../styles/scrollbar.styles.css';
import {TctBoxControl} from '../text-area/tct-box-control.js';
import {TctText} from '../text/tct-text.js';
import {TctToken} from '../token/tct-token.js';
import {TctTypeaheadItem} from '../typeahead/tct-typeahead-item.js';
import {TypeaheadEngine} from '../typeahead/typeahead-engine.js';
import popup from '../typeahead/typeahead-popup.styles.css';
import type {
  SearchableItem,
  SearchSource,
  TypeaheadRenderResult,
} from '../typeahead/typeahead.types.js';
import {
  PASTE_SEPARATORS,
  TOKEN_OVERFLOW_BEHAVIORS,
  type TokenOverflowBehavior,
} from './tokenizer.types.js';
import styles from './tct-tokenizer.styles.css';

/** Attributes forwarded to the inner input that are not reactive properties: a change re-renders. */
const FORWARDED_ATTRIBUTES = ['enterkeyhint', 'inputmode'] as const;

/** Prefix of the id of the synthetic "Create ..." entry, which is never a real item. */
const CREATE_PREFIX = '__tct_create__';

/** The source a full tokenizer searches: nothing more can be added. */
const EMPTY_SOURCE: SearchSource = {search: () => [], bootstrap: () => []};

/**
 * A multi-select field: the chosen items are removable tokens around one stable combobox input, with
 * label, description and status. It is a form-associated element that submits one entry per token
 * (repeated `name`, the item `id`s), resets, restores, validates (`required` means at least one token) and
 * joins a `<fieldset disabled>`.
 *
 * The input is an editable combobox (WAI-ARIA APG) fed by `search-source`, exactly as `tct-typeahead`:
 * debounced, cancelable searches where an older response never wins, `min-query-length`, result counts
 * announced once, IME-safe. Choosing a result adds a token and clears the query; results already chosen
 * are left out. Backspace in the empty input removes the last token, and every addition and removal is
 * announced. Pasting a list (line breaks, tabs, commas or semicolons) adds one token per entry that
 * matches a result exactly (or per entry with `has-create`), and keeps what it could not resolve in the
 * input. With `has-create` typing text offers a `Create "text"` result. `max-entries` stops the field
 * accepting more (the input stays for Backspace). `token-overflow` keeps one row with a "+N more"
 * indicator while the field is not focused.
 *
 * `items` are the chosen items (upstream `value`); `values` are their `id`s. Set `items`; writing it fires no
 * events. The user's changes fire the cancelable `tct-selection-change` (its `action` says whether an item was
 * added, created, removed or all cleared), then `input` and one `change`; typing fires `input` (read the text
 * from `query`). [mwg:form-associated-custom-elements] [mwg:accessibility] [mwg:ime-safe-enter-submit]
 *
 * @summary Multi-select field: removable tokens around a debounced, cancelable combobox input.
 * @tag tct-tokenizer
 * @upstream Tokenizer
 * @slot start - Custom content at the start of the field, before the tokens.
 * @slot end - Content at the end of the field row (a count, a button).
 * @csspart field - The whole field: label, control and status.
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart label-icon - The icon before the label text.
 * @csspart input - The painted box around the tokens and the input (upstream `tokenizer` target).
 * @csspart group - The `group` element that holds the tokens, the input and the end controls.
 * @csspart control - The combobox `<input>`.
 * @csspart token - One token (`tct-token`).
 * @csspart start-icon - The start icon.
 * @csspart busy - The busy indicator.
 * @csspart status-icon - The status icon inside the box.
 * @csspart status-button - The status button of the `tooltip` status variant.
 * @csspart status - The status message box.
 * @csspart popup - The painted result popup box.
 * @csspart dropdown - The scrolling list of results.
 * @csspart option - One result row.
 * @csspart empty-state - The message shown when a completed search found nothing.
 * @csspart typeahead-item - The default content of a result row.
 * @cssstate user-invalid - Invalidity is displayed (after a user commit, a submit attempt or `reportValidity()`).
 * @cssstate invalid - The selection does not satisfy its constraints (not displayed).
 * @cssstate busy - A search is pending or `loading` is set.
 * @cssstate open - The result popup is open.
 * @fires input - Native, when the query text changes or the tokens change; composed, from the inner input.
 * @fires change - When the user adds, creates, removes or clears tokens; once per change, bubbling and composed.
 * @fires {TctSelectionChangeEvent} tct-selection-change - Before the user changes the tokens; cancelable, and preventing it keeps the current tokens.
 * @fires {TctOpenChangeEvent} tct-open-change - Before the popup opens or closes because of the user or a search result; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After the popup finished opening or closing.
 * @hideInherited value, defaultValue - A tokenizer has several values: use `items` and `values`.
 * @cloakDisplay block
 * @cloakMinBlockSize 4rem
 */
export class TctTokenizer extends TctBoxControl {
  static override readonly tagName = 'tct-tokenizer';
  static override readonly dependencies = [
    ...TctBoxControl.dependencies,
    TctInputClearButton,
    TctOverflowList,
    TctText,
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
  @property({attribute: false}) renderItem: ((item: SearchableItem) => TypeaheadRenderResult) | undefined;

  /**
   * Renders a token (upstream `renderToken`): `(item, remove) => template | node | text`. Call `remove()` from
   * your own remove control. Default: a `tct-token` with the label and a remove button.
   */
  @property({attribute: false}) renderToken:
    ((item: SearchableItem, remove: () => void) => TypeaheadRenderResult) | undefined;

  /** The most tokens allowed. At the limit the field stops offering results and hides the input (Backspace still works). */
  @property({type: Number, attribute: 'max-entries'}) maxEntries: number | undefined;

  /** Shows the source's `bootstrap()` results when the field takes focus, before anything is typed. */
  @property({type: Boolean, attribute: 'entries-on-focus'}) entriesOnFocus = false;

  /** The most results shown. */
  @property({type: Number, attribute: 'max-menu-items'}) maxMenuItems = 10;

  /** Fixed popup width in px; it never becomes narrower than the field. */
  @property({type: Number, attribute: 'menu-width'}) menuWidth: number | undefined;

  /**
   * Minimum query length, in characters as a person counts them (an emoji is one), before the source is
   * searched. Below it no search runs and the menu stays closed, except the `has-create` entry, which
   * costs no search.
   */
  @property({type: Number, attribute: 'min-query-length'}) minQueryLength = 1;

  /** Message shown when a completed search found nothing. Default: the localised "No results found". */
  @property({attribute: 'empty-search-results-text'}) emptySearchResultsText: string | undefined;

  /** Delay in ms before a typed query is searched; `0` for synchronous sources. */
  @property({type: Number, attribute: 'debounce-ms'}) debounceMs = 150;

  /** Shows a clear-all button while there are tokens. */
  @property({type: Boolean, attribute: 'has-clear'}) hasClear = false;

  /** Lets the user create a token from free text: typing offers a `Create "text"` result. */
  @property({type: Boolean, attribute: 'has-create'}) hasCreate = false;

  /** Name of an icon shown at the start of the field (a registered icon such as `search`). */
  @property({attribute: 'start-icon'}) startIcon = '';

  /**
   * What tokens do when they do not fit: `none` (wrap), `unfocused-inline` (one row with "+N more" while
   * unfocused, expanding in place on focus) or `unfocused-layer` (the same, expanding over the content below).
   */
  @property({reflect: true, attribute: 'token-overflow'}) tokenOverflow: TokenOverflowBehavior =
    'none';

  /**
   * The chosen items (upstream `value`), in the order they were added. Until set it follows `defaultItems`.
   * Writing it fires no events.
   */
  @property({attribute: false})
  get items(): SearchableItem[] {
    return this.#items ?? this.defaultItems ?? [];
  }
  set items(value: SearchableItem[] | undefined) {
    this.#items = Array.isArray(value) ? [...value] : [];
  }

  /** The items that form reset returns to. */
  @property({attribute: false}) defaultItems: SearchableItem[] | undefined;

  /** The `id`s of the chosen items, in order: what the form submits. */
  get values(): string[] {
    return this.items.map((item) => item.id);
  }

  /** The text in the input (the query). */
  get query(): string {
    return this.#engine.query;
  }

  /** Whether the result popup is open. */
  get open(): boolean {
    return this.#engine.open;
  }

  /** The inner combobox input. */
  get control(): HTMLInputElement | null {
    return this.formControl;
  }

  #items: SearchableItem[] | undefined;
  /** Focus is somewhere in the field (the tokens, the input, the end controls). */
  #focusedWithin = false;
  #pasting = false;

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'tokenizer',
    defaults: tokenizerMessages,
  });
  readonly #typeaheadLocale: LocaleController = new LocaleController(this, {
    namespace: 'typeahead',
    defaults: typeaheadMessages,
  });
  readonly #slots: SlotController = new SlotController(this, 'start', 'end');
  readonly #engine: TypeaheadEngine<SearchableItem> = new TypeaheadEngine<SearchableItem>(this, {
    config: () => {
      const atMax = this.#atMax;
      return {
        source: atMax ? EMPTY_SOURCE : this.searchSource,
        minQueryLength: this.minQueryLength,
        debounceMs: this.debounceMs,
        maxMenuItems: this.maxMenuItems,
        entriesOnFocus: atMax ? false : this.entriesOnFocus,
        // At the limit there is nothing to offer: the popup stays shut and the input only collects focus.
        blocked: this.isDisabled || this.readonly || atMax,
        menuWidth: this.menuWidth,
        size: this.fieldSize,
        renderItem: this.renderItem,
        emptyText:
          this.emptySearchResultsText ?? this.#typeaheadLocale.t('@tct.typeahead.emptySearchResults'),
        selectedId: null,
        queryEntries: this.#createEntries,
        filter: this.#unselected,
        retainAfterSelect: this.entriesOnFocus && !atMax,
      };
    },
    input: () => this.control,
    anchor: () => this.renderRoot?.querySelector<HTMLElement>('.input-wrapper') ?? null,
    locale: () => this.#typeaheadLocale,
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
    // "Choose an item": required means at least one token, whatever is typed in the input.
    return [requiredValidator<this>((element) => element.items.length === 0, 'select')];
  }

  /** One `name=id` entry per token; nothing without a name or without tokens. */
  protected override formValue(): FormValue {
    const items = this.items;
    if (!this.name || items.length === 0) return null;
    const data = new FormData();
    for (const item of items) data.append(this.name, item.id);
    return data;
  }

  /** The restore state carries the labels too, so restored tokens read as before. */
  protected override formState(): FormValue {
    const items = this.items;
    if (!this.name || items.length === 0) return null;
    const data = new FormData();
    for (const item of items) data.append(this.name, JSON.stringify({id: item.id, label: item.label}));
    return data;
  }

  protected override formResetValue(): void {
    this.#items = undefined;
    this.#engine.reset();
    this.requestUpdate('items');
  }

  protected override formRestoreState(state: FormValue, _reason: 'restore' | 'autocomplete'): void {
    const entries =
      state instanceof FormData ? state.getAll(this.name) : typeof state === 'string' ? [state] : [];
    this.items = entries
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => {
        try {
          const parsed = JSON.parse(entry) as unknown;
          if (parsed && typeof parsed === 'object' && 'id' in parsed) {
            const {id, label} = parsed as {id: unknown; label?: unknown};
            return {id: String(id), label: typeof label === 'string' ? label : String(id)};
          }
        } catch {
          // Not our JSON: a plain id (browser autofill).
        }
        return {id: entry, label: entry};
      });
  }

  /** The busy indicator also follows a pending search. */
  protected override get busy(): boolean {
    return super.busy || this.#engine.loading;
  }

  /** The anchor a blocked submit focuses: the input, which stays focusable when it is collapsed. */
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

  // ---------------------------------------------------------------------------------- derived

  get #atMax(): boolean {
    return this.maxEntries !== undefined && this.items.length >= this.maxEntries;
  }

  get #overflow(): TokenOverflowBehavior {
    return oneOf(this.tokenOverflow, TOKEN_OVERFLOW_BEHAVIORS, 'none');
  }

  /** Results already chosen are left out, whichever way the source spelled them. */
  readonly #unselected = (found: SearchableItem[]): SearchableItem[] => {
    const chosen = new Set(this.items.map((item) => item.id));
    return found.filter((item) => !chosen.has(item.id));
  };

  /**
   * The "Create ..." entry. It is derived from the typed text, not fetched for it, so it is offered whatever
   * `min-query-length` says: creating `QA` costs no fetch, and a field that can create it should not stop
   * because a search for `QA` would match too much.
   */
  readonly #createEntries = (query: string, results: SearchableItem[]): SearchableItem[] => {
    const text = query.trim();
    if (!this.hasCreate || text === '') return [];
    const exists =
      this.items.some((item) => item.id === text) ||
      results.some((item) => item.label.toLowerCase() === text.toLowerCase());
    if (exists) return [];
    return [
      {
        id: `${CREATE_PREFIX}${text}`,
        label: this.#locale.t('createOption', {value: text}),
        auxiliaryData: {createdValue: text},
      },
    ];
  };

  // ---------------------------------------------------------------------------------- lifecycle

  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if ((FORWARDED_ATTRIBUTES as readonly string[]).includes(name)) this.requestUpdate();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('tokenOverflow') && !TOKEN_OVERFLOW_BEHAVIORS.includes(this.tokenOverflow)) {
      devWarn(
        `tokenizer:token-overflow:${this.tokenOverflow}`,
        `<tct-tokenizer token-overflow="${this.tokenOverflow}"> is not one of ${TOKEN_OVERFLOW_BEHAVIORS.join(', ')}; using "none".`,
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.toggleState('open', this.#engine.open);
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
    const items = this.items;
    const atMax = this.#atMax;
    const truncated = this.#overflow !== 'none' && !this.#focusedWithin && items.length > 0;
    const inert = this.showsDisabledMessage;
    const showClear = this.hasClear && items.length > 0 && !this.isDisabled && !this.readonly;
    const customPlaceholder = this.hasAttribute('placeholder') || this.placeholder !== '';
    const placeholder =
      items.length > 0
        ? ''
        : customPlaceholder
          ? this.placeholder
          : this.#typeaheadLocale.t('@tct.typeahead.searchPlaceholder');
    const tokens = repeat(
      items,
      (item) => item.id,
      (item) => this.#renderToken(item),
    );
    const endSlot = this.busy || showClear || this.#slots.has('end') || this.#hasStatusIcon;
    return html`<div
      class="tokenizer"
      part="group"
      role="group"
      aria-label=${this.label || nothing}
      data-size=${this.fieldSize}
      ?data-tokens=${items.length > 0}
      ?data-truncated=${truncated}
      ?data-collapsed=${truncated || atMax}
      @click=${this.#onWrapperClick}
      @focusin=${this.#onFocusIn}
      @focusout=${this.#onFocusOut}
    >
      <div class="lane">
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
        <span class="adornment" ?hidden=${!this.#slots.has('start')}
          ><slot name="start"></slot
        ></span>
        ${
          truncated
            ? html`<tct-overflow-list
                class="overflow"
                gap="1"
                behavior="observe-parent"
                .overflowRenderer=${this.#renderOverflow}
                >${tokens}</tct-overflow-list
              >`
            : tokens
        }
        ${this.#engine.renderInput({
          className: 'input combobox',
          part: 'control',
          placeholder,
          disabled: this.isDisabled && !inert,
          focusableDisabled: inert,
          readonly: this.readonly && !inert,
          ariaRequired: this.announcesRequired,
          enterkeyhint: this.getAttribute('enterkeyhint') ?? undefined,
          inputmode: this.getAttribute('inputmode') ?? undefined,
          ariaLabelledBy: this.groupLabelId,
          onPaste: this.#onPaste,
        })}
      </div>
      ${
        endSlot
          ? html`<span class="end-lane"
              >${this.renderBusy()}<span class="adornment" ?hidden=${!this.#slots.has('end')}
                ><slot name="end"></slot></span
              >${
                showClear
                  ? html`<tct-input-clear-button
                      label=${this.#locale.t('@tct.tokenizer.clearAll')}
                      @click=${this.#onClearAll}
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

  #renderToken(item: SearchableItem): TemplateResult {
    const remove = (): void => {
      this.#remove(item, 'trigger');
    };
    if (this.renderToken) {
      return html`<span class="token-slot">${this.renderToken(item, remove)}</span>`;
    }
    return html`<tct-token
      class="token"
      part="token"
      label=${item.label}
      value=${item.id}
      size=${this.fieldSize}
      ?removable=${!this.isDisabled && !this.readonly}
      ?disabled=${this.isDisabled}
      @tct-remove=${(event: Event) => {
        // The token's own event stays inside: the tokenizer reports the change of the selection.
        event.stopPropagation();
        remove();
      }}
    ></tct-token>`;
  }

  readonly #renderOverflow = (overflowed: readonly unknown[]): TemplateResult =>
    // Rendered inside the overflow list's own shadow root, so this sheet cannot style it: `tct-text` does.
    html`<tct-text type="supporting" color="secondary" class="overflow-text"
      >${this.#locale.t('overflowMore', {count: overflowed.length})}</tct-text
    >`;

  // ------------------------------------------------------------------------------ selection

  #commit(): void {
    this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    this.redispatchChange();
  }

  /**
   * Adds `chosen` (a result, or the synthetic create entry) after asking. Returns whether it was added.
   */
  #onSelect(chosen: SearchableItem, reason: ChangeReason): boolean {
    if (this.#atMax) return false;
    const created =
      this.hasCreate && typeof chosen.id === 'string' && chosen.id.startsWith(CREATE_PREFIX);
    const item: SearchableItem = created
      ? (() => {
          const text = chosen.id.slice(CREATE_PREFIX.length);
          return {id: text, label: text};
        })()
      : chosen;
    if (this.items.some((existing) => existing.id === item.id)) return false;
    return this.#apply(created ? 'create' : 'add', item, [...this.items, item], reason);
  }

  #remove(item: SearchableItem, reason: ChangeReason): void {
    if (this.isDisabled || this.readonly) return;
    const next = this.items.filter((existing) => existing.id !== item.id);
    if (next.length === this.items.length) return;
    this.#apply('remove', item, next, reason);
    this.control?.focus();
  }

  /** Asks (`tct-selection-change`), then commits: the tokens, an announcement, `input` and `change`. */
  #apply(
    action: SelectionChangeAction,
    item: SearchableItem | null,
    next: SearchableItem[],
    reason: ChangeReason,
  ): boolean {
    if (!this.dispatch(new TctSelectionChangeEvent(action, item, next, reason))) return false;
    this.#items = next;
    this.requestUpdate('items');
    if (item) {
      announce(
        this.#locale.t(action === 'remove' ? '@tct.tokenizer.tokenRemoved' : '@tct.tokenizer.tokenAdded', {
          label: item.label,
        }),
        {element: this},
      );
    }
    this.#commit();
    return true;
  }

  // ---------------------------------------------------------------------------------- events

  readonly #onClearAll = (event: Event): void => {
    event.stopPropagation();
    const items = this.items;
    if (items.length === 0) return;
    // Upstream reports the last item as the removed one.
    if (this.#apply('clear', items[items.length - 1] ?? null, [], 'pointer')) this.control?.focus();
  };

  /** A press on the field (outside the tokens' buttons and the clear button) focuses the input. */
  readonly #onWrapperClick = (event: MouseEvent): void => {
    if (this.isDisabled) return;
    const origin = event.composedPath()[0];
    if (origin instanceof Element && origin.closest('tct-input-clear-button')) return;
    this.control?.focus();
  };

  /**
   * Focus arriving from outside lands on the input rather than on the first token's remove button, so the
   * user does not have to tab through every token; the field expands while focus is inside.
   */
  readonly #onFocusIn = (event: FocusEvent): void => {
    const from = event.relatedTarget;
    const fromOutside = !(from instanceof Node && this.renderRoot.contains(from));
    if (!this.#focusedWithin) {
      this.#focusedWithin = true;
      this.requestUpdate();
    }
    const control = this.control;
    if (fromOutside && control && event.composedPath()[0] !== control && !this.isDisabled) {
      control.focus();
    }
  };

  readonly #onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && this.renderRoot.contains(next)) return;
    this.#focusedWithin = false;
    this.requestUpdate();
  };

  /** Backspace in an empty input removes the last token. */
  #onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Backspace' || this.#engine.query !== '') return;
    const items = this.items;
    const last = items[items.length - 1];
    if (!last || this.isDisabled || this.readonly) return;
    event.preventDefault();
    this.#remove(last, 'keyboard');
  }

  /**
   * Pasting a list adds one token per entry. An entry becomes a token when it names a result exactly (label or
   * id, ignoring case) or, with `has-create`, as a new token; what could not be resolved stays in the input. A
   * paste without a separator, or with nothing resolvable, is ordinary typing.
   */
  readonly #onPaste = (event: ClipboardEvent): void => {
    if (this.isDisabled || this.readonly || this.#pasting) return;
    const text = event.clipboardData?.getData('text') ?? '';
    const pieces = [
      ...new Set(
        text
          .split(PASTE_SEPARATORS)
          .map((piece) => piece.trim())
          .filter(Boolean),
      ),
    ];
    if (pieces.length < 2) return;
    event.preventDefault();
    void this.#addPasted(pieces);
  };

  async #addPasted(pieces: string[]): Promise<void> {
    this.#pasting = true;
    try {
      const source = this.searchSource;
      const added: {item: SearchableItem; created: boolean}[] = [];
      const leftover: string[] = [];
      const known = new Set(this.items.map((item) => item.id));
      const room = (): number =>
        this.maxEntries === undefined ? Infinity : this.maxEntries - this.items.length - added.length;
      for (const piece of pieces) {
        if (room() <= 0) {
          leftover.push(piece);
          continue;
        }
        let found: SearchableItem | undefined;
        if (source) {
          try {
            const results = await source.search(piece);
            const lower = piece.toLowerCase();
            found = results.find(
              (result) => result.label.toLowerCase() === lower || result.id.toLowerCase() === lower,
            );
          } catch {
            found = undefined;
          }
        }
        const created = found === undefined && this.hasCreate;
        const item = found ?? (created ? {id: piece, label: piece} : undefined);
        if (!item) {
          leftover.push(piece);
        } else if (!known.has(item.id)) {
          known.add(item.id);
          added.push({item, created});
        }
      }
      if (added.length > 0) {
        const next = [...this.items, ...added.map((entry) => entry.item)];
        const last = added[added.length - 1]!;
        const accepted = this.dispatch(
          new TctSelectionChangeEvent(added.every((entry) => entry.created) ? 'create' : 'add', last.item, next, 'request'),
        );
        if (accepted) {
          this.#items = next;
          this.requestUpdate('items');
          announce(this.#locale.t('tokensAdded', {count: added.length}), {element: this});
          this.#commit();
        }
      }
      if (leftover.length > 0) this.#engine.setQuery(leftover.join(', '));
      else this.#engine.reset();
    } finally {
      this.#pasting = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-tokenizer': TctTokenizer;
  }
}
