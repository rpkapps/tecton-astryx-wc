import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import typeaheadMessages from '@tecton-wc/locales/en/typeahead.js';
import {AriaDelegateController} from '@tecton-wc/core/controllers/aria-delegate.js';
import {SizeController} from '@tecton-wc/core/controllers/size.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {TctSelectionChangeEvent} from '@tecton-wc/core/events/tct-selection-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {oneOf} from '../field/field-utils.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctSpinner} from '../spinner/tct-spinner.js';
import base from '../styles/base.styles.css';
import layer from '../styles/layer.styles.css';
import motion from '../styles/motion.styles.css';
import scrollbar from '../styles/scrollbar.styles.css';
import styles from './tct-base-typeahead.styles.css';
import popup from './typeahead-popup.styles.css';
import {TypeaheadEngine} from './typeahead-engine.js';
import {TctTypeaheadItem} from './tct-typeahead-item.js';
import {
  TYPEAHEAD_SIZES,
  type SearchableItem,
  type SearchSource,
  type TypeaheadRenderResult,
  type TypeaheadSize,
} from './typeahead.types.js';

/**
 * The combobox engine of the typeahead family as an element: a bare text input (an editable combobox with
 * list autocomplete and `aria-activedescendant`) and an anchored popup of results. It draws no field box,
 * no label and no selected-value token: `tct-typeahead` and `tct-tokenizer` are the styled fields built on
 * the same engine. Use this one only for a custom composition, and then supply the visible label (host
 * `aria-label` or `aria-labelledby`), the box and the focus treatment yourself.
 *
 * `search-source` supplies results: each query is debounced (`debounce-ms`), searched from
 * `min-query-length` characters, and a response that arrives after a newer query, a selection or a
 * replaced source is discarded, so an older result never wins. With `entries-on-focus` the source's
 * `bootstrap()` results show on focus. Choosing a result (Enter on the highlighted option, a click) fires
 * the cancelable `tct-selection-change`, then sets `item`, clears the query, closes the menu and returns
 * focus to the input; the native `input` and `change` follow. Result counts (or the empty message) are
 * announced once per menu, not per keystroke, and a composing (IME) Enter never selects.
 *
 * The popup is anchored to the input, or to `anchor-element` (or the element with the id `anchor`, in the same
 * tree) when your own box surrounds it, and its width is at least the anchor's.
 * [mwg:accessibility] [mwg:ime-safe-enter-submit] [mwg:resilient-context-menus-and-nested-dropdowns]
 *
 * @summary The combobox engine: a bare input and an anchored, debounced, cancelable result popup.
 * @tag tct-base-typeahead
 * @upstream BaseTypeahead
 * @csspart input - The combobox input.
 * @csspart popup - The painted popup box.
 * @csspart dropdown - The scrolling list of results.
 * @csspart typeahead-item - The default content of a result row (the `item` part of `tct-typeahead-item`).
 * @csspart option - One result row.
 * @csspart empty-state - The message shown when a completed search found nothing.
 * @csspart loading - The busy indicator, shown only when a search is pending.
 * @cssstate open - The result popup is open.
 * @cssstate busy - A search is pending.
 * @fires input - Native, when the query text changes; composed and retargeted from the inner input.
 * @fires change - After a result was chosen and `item` changed; bubbles and composes.
 * @fires {TctSelectionChangeEvent} tct-selection-change - Before a result is chosen; cancelable, and preventing it keeps the current item.
 * @fires {TctOpenChangeEvent} tct-open-change - Before the popup opens or closes because of the user or a search result; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After the popup finished opening or closing.
 * @cloakDisplay block
 */
export class TctBaseTypeahead extends TctElement {
  static override readonly tagName = 'tct-base-typeahead';
  static override readonly dependencies = [TctIcon, TctSpinner, TctTypeaheadItem];
  static override shadowRootOptions = {...TctElement.shadowRootOptions, delegatesFocus: true};
  static override styles: CSSResultGroup = [base, layer, motion, scrollbar, popup, styles];

  /** Supplies the results: `search(query)`, `bootstrap()` and an optional `cancel()`. */
  @property({attribute: false}) searchSource: SearchSource | undefined;

  /**
   * The chosen item. Uncontrolled: it changes when the user chooses a result. It only marks the matching
   * result as selected (a check and `aria-selected`); the input itself always holds the query.
   */
  @property({attribute: false}) item: SearchableItem | null = null;

  /** Renders the content of a result row (a template, a node or text; never HTML). Default: `tct-typeahead-item`. */
  @property({attribute: false}) renderItem: ((item: SearchableItem) => TypeaheadRenderResult) | undefined;

  /** Placeholder of the input. Unset shows the localised "Search…"; an empty string shows none. */
  @property() placeholder: string | undefined;

  /** Shows the source's `bootstrap()` results when the input takes focus, before anything is typed. */
  @property({type: Boolean, attribute: 'entries-on-focus'}) entriesOnFocus = false;

  /** The most results shown. */
  @property({type: Number, attribute: 'max-menu-items'}) maxMenuItems = 10;

  /** Fixed popup width in px; it never becomes narrower than the anchor. */
  @property({type: Number, attribute: 'menu-width'}) menuWidth: number | undefined;

  /**
   * Minimum query length, in characters as a person counts them (an emoji is one), before the source is
   * searched. Below it no search runs and the menu stays closed.
   */
  @property({type: Number, attribute: 'min-query-length'}) minQueryLength = 1;

  /** Message shown when a completed search found nothing. Default: the localised "No results found". */
  @property({attribute: 'empty-search-results-text'}) emptySearchResultsText: string | undefined;

  /** Disables the input. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /**
   * With `disabled`, keeps the input focusable (`aria-disabled` and read-only instead of the native
   * attribute) so a disabled reason next to it can be found by keyboard and assistive technology. Nothing can
   * be typed or chosen.
   */
  @property({type: Boolean, reflect: true, attribute: 'focusable-disabled'}) focusableDisabled = false;

  /** Delay in ms before a typed query is searched; `0` for synchronous sources. */
  @property({type: Number, attribute: 'debounce-ms'}) debounceMs = 150;

  /** Size of the result rows: `sm`, `md` or `lg`. Unset takes the nearest size provider, else `md`. */
  @property({reflect: true}) size: TypeaheadSize | undefined;

  /** Id of the input, for a `<label for>` in the same shadow root (upstream `inputId`). */
  @property({attribute: 'input-id'}) inputId: string | undefined;

  /**
   * Tab index of the input. `-1` takes it out of the Tab order while it stays focusable by script
   * (upstream `inputTabIndex`).
   */
  @property({type: Number, attribute: 'input-tab-index'}) inputTabIndex: number | undefined;

  /** Id of an element in the same tree that the popup is anchored to, instead of the input. */
  @property() anchor: string | undefined;

  /** The element the popup is anchored to, instead of the input. Wins over `anchor`. */
  @property({attribute: false}) anchorElement: HTMLElement | null = null;

  /** The text in the input. */
  get query(): string {
    return this.#engine.query;
  }

  /** Whether the result popup is open. */
  get open(): boolean {
    return this.#engine.open;
  }

  /** The inner combobox input. */
  get control(): HTMLInputElement | null {
    return this.renderRoot?.querySelector<HTMLInputElement>('input.input') ?? null;
  }

  /** Focuses the input. */
  override focus(options?: FocusOptions): void {
    const control = this.control;
    if (control) control.focus(options);
    else super.focus(options);
  }

  /** Removes focus from the input. */
  override blur(): void {
    this.control?.blur();
  }

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'typeahead',
    defaults: typeaheadMessages,
  });
  readonly #size: SizeController<TypeaheadSize> = new SizeController<TypeaheadSize>(this, {
    explicit: () => (this.size ? oneOf(this.size, TYPEAHEAD_SIZES, 'md') : undefined),
    fallback: 'md',
  });
  readonly #engine: TypeaheadEngine<SearchableItem> = new TypeaheadEngine<SearchableItem>(this, {
    config: () => ({
      source: this.searchSource,
      minQueryLength: this.minQueryLength,
      debounceMs: this.debounceMs,
      maxMenuItems: this.maxMenuItems,
      entriesOnFocus: this.entriesOnFocus,
      blocked: this.disabled,
      menuWidth: this.menuWidth,
      size: this.#size.value,
      renderItem: this.renderItem,
      emptyText: this.emptySearchResultsText ?? this.#locale.t('emptySearchResults'),
      selectedId: this.item?.id ?? null,
      queryEntries: undefined,
      filter: undefined,
      retainAfterSelect: false,
    }),
    input: () => this.control,
    anchor: () => this.#anchorTarget(),
    locale: () => this.#locale,
    onSelect: (item, reason) => this.#onSelect(item, reason),
    onOpenRequest: (open, reason) => this.dispatch(new TctOpenChangeEvent(open, reason)),
    onOpenSettled: (open) => {
      this.dispatch(new TctAfterOpenChangeEvent(open));
    },
    onBusyChange: () => {
      this.requestUpdate();
    },
  });

  constructor() {
    super();
    // The host's `aria-label`, `aria-labelledby` and `aria-describedby` reach the input; the engine owns the
    // combobox state attributes.
    new AriaDelegateController(this, {
      target: () => this.control,
      exclude: [
        'aria-expanded',
        'aria-controls',
        'aria-activedescendant',
        'aria-autocomplete',
        'aria-busy',
        'aria-disabled',
        'aria-haspopup',
      ],
    });
  }

  #anchorTarget(): HTMLElement | null {
    if (this.anchorElement) return this.anchorElement;
    if (this.anchor) {
      const root = this.getRootNode() as Document | ShadowRoot;
      const found = root.getElementById?.(this.anchor);
      if (found) return found;
    }
    return this.renderRoot?.querySelector<HTMLElement>('.base') ?? null;
  }

  /** The user chose a result: ask, then commit. */
  #onSelect(item: SearchableItem, reason: ChangeReason): boolean {
    if (!this.dispatch(new TctSelectionChangeEvent('select', item, [item], reason))) return false;
    this.item = item;
    this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    this.dispatchEvent(new Event('change', {bubbles: true, composed: true}));
    return true;
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.toggleState('open', this.#engine.open);
    this.toggleState('busy', this.#engine.loading);
  }

  protected override firstUpdated(): void {
    // The inner input exists only once the first render has settled (upstream `hasAutoFocus`).
    if (this.hasAttribute('autofocus')) this.focus({preventScroll: true});
  }

  override render(): TemplateResult {
    const inert = this.disabled && this.focusableDisabled;
    return html`<div class="base" part="base">
      ${this.#engine.renderInput({
        className: 'input',
        part: 'input',
        id: this.inputId,
        placeholder: this.placeholder ?? this.#locale.t('searchPlaceholder'),
        tabindex: this.inputTabIndex,
        disabled: this.disabled && !inert,
        focusableDisabled: inert,
      })}
      ${
        this.#engine.loading
          ? html`<span class="loading" part="loading"
              ><tct-spinner size="sm" aria-label=${this.#locale.t('loading')}></tct-spinner
            ></span>`
          : nothing
      }
    </div>${this.#engine.renderPopup()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-base-typeahead': TctBaseTypeahead;
  }
}
