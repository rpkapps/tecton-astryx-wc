/**
 * The combobox engine shared by `tct-base-typeahead`, `tct-typeahead` and `tct-tokenizer` (upstream
 * `BaseTypeahead`): the editable combobox of the WAI-ARIA APG (list autocomplete, `aria-activedescendant`),
 * search and bootstrap scheduling, stale-response rejection, keyboard navigation, result announcements
 * and the anchored result popup. The host owns everything visible around the input (the field box, the
 * tokens) and renders the pieces the engine hands out: `renderInput()` and `renderPopup()`, both in the
 * host's shadow root, so the input, the listbox and the label share one tree and every id relationship
 * stays inside it. [mwg:accessibility] [mwg:ime-safe-enter-submit] [mwg:resilient-context-menus-and-nested-dropdowns]
 *
 *  - **Search**: the query is debounced (`debounceMs`, `0` runs at once), searched only from
 *    `minQueryLength` graphemes, and every search claims a generation: a response that arrives after
 *    a newer query, a selection, a cleared field or a replaced source is discarded, so an older result
 *    can never win. The source's optional `cancel()` is called when work is superseded or the menu
 *    closes.
 *  - **Announcements**: the result count (or the empty message) is announced through the shared
 *    announcer when a search for a typed query settles, and only when the message differs from the
 *    last one spoken for this menu: not once per keystroke.
 *  - **IME**: a composing key event never runs a command (Enter never selects while a candidate window
 *    is open).
 *  - **Layer**: the popup is a `popover="manual"` surface on the shared layer stack: one Escape closes
 *    it before an enclosing dialog, outside presses dismiss it, and it is positioned by CSS anchor
 *    positioning (the lazy Floating UI fallback where that is missing).
 */
import {html, nothing, type ReactiveController, type TemplateResult} from 'lit';
import {ifDefined} from 'lit/directives/if-defined.js';
import {live} from 'lit/directives/live.js';
import {styleMap} from 'lit/directives/style-map.js';
import {announce} from '@tecton-wc/core/a11y/announcer.js';
import {ActiveDescendantController} from '@tecton-wc/core/controllers/active-descendant.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import type {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {LayerController} from '@tecton-wc/core/layer/layer-controller.js';
import {PositionController} from '@tecton-wc/core/layer/position.js';
import type {TctElement} from '@tecton-wc/core/tct-element.js';
import {uniqueId} from '@tecton-wc/core/utils/id.js';
import {isImeKeyEvent} from '@tecton-wc/core/utils/ime.js';
import {characterCount} from '../text-area/text-area.types.js';
import {
  groupItems,
  type SearchableItem,
  type SearchSource,
  type TypeaheadRenderResult,
  type TypeaheadSize,
} from './typeahead.types.js';

/** Why the menu opened or closed, for the host's `tct-open-change`. */
export type EngineOpenReason = ChangeReason;

/** What the host tells the engine, read again on every use (attributes and properties can change any time). */
export interface EngineConfig<T extends SearchableItem> {
  source: SearchSource<T> | undefined;
  /** Graphemes before a typed query is searched. */
  minQueryLength: number;
  /** Delay before a typed query is searched; `0` searches at once. */
  debounceMs: number;
  /** Most fetched results shown. */
  maxMenuItems: number;
  /** Search with an empty query (the source's `bootstrap()`) when the field takes focus. */
  entriesOnFocus: boolean;
  /** No query, no menu, no selection: disabled (and focusable-disabled) fields. */
  blocked: boolean;
  /** Fixed popup width in px (never narrower than the anchor). */
  menuWidth: number | undefined;
  size: TypeaheadSize;
  renderItem: ((item: T) => TypeaheadRenderResult) | undefined;
  emptyText: string;
  /** Id of the selected item (`aria-selected` and the check mark). */
  selectedId: string | null;
  /** Entries derived from the query rather than fetched for it (the tokenizer's "Create ..."). */
  queryEntries: ((query: string, results: T[]) => T[]) | undefined;
  /** Drops items that cannot be chosen (already selected tokens), before the result cap. */
  filter: ((items: T[]) => T[]) | undefined;
  /** After choosing from the empty-query cohort keep the menu open on the remaining results. */
  retainAfterSelect: boolean;
}

export interface EngineOptions<T extends SearchableItem> {
  config: () => EngineConfig<T>;
  /** The combobox input, once rendered. */
  input: () => HTMLInputElement | null;
  /** The element the popup is anchored to and aligned with (the field box); default: the input. */
  anchor: () => HTMLElement | null;
  /** Extra elements that count as inside the popup for outside presses and focus-out (clear button, tokens). */
  inside?: () => (EventTarget | null | undefined)[];
  locale: () => LocaleController;
  /** Called first for every non-composing keydown; `preventDefault()` skips the engine's own handling. */
  onKeyDown?: (event: KeyboardEvent) => void;
  /** An item was chosen. Return `false` when the host refused it (the menu and the query stay). */
  onSelect: (item: T, reason: ChangeReason) => boolean | void;
  /** The query text changed (typing, paste, or `setQuery`). */
  onQuery?: (query: string) => void;
  /** The menu wants to open or close; return `false` to keep the current state. */
  onOpenRequest?: (open: boolean, reason: EngineOpenReason) => boolean | void;
  /** The menu finished opening or closing (after its animation). */
  onOpenSettled?: (open: boolean) => void;
  /** A search started or settled. */
  onBusyChange?: (busy: boolean) => void;
}

export interface InputRenderOptions {
  className: string;
  part: string;
  id?: string;
  placeholder: string | undefined;
  tabindex?: number;
  /** Native `disabled`. */
  disabled: boolean;
  /** `readonly` plus `aria-disabled`: the field stays focusable so its reason can be found. */
  focusableDisabled: boolean;
  /** Read-only: nothing can be typed or chosen (`readonly`, `aria-readonly`). */
  readonly?: boolean;
  /** `aria-required` (a field's own `required` is a constraint of the form, not of this input). */
  ariaRequired?: boolean;
  enterkeyhint?: string;
  inputmode?: string;
  /** Names the input by an element in the same tree (an input group's hidden label). */
  ariaLabelledBy?: string;
  /** The user pasted into the input. */
  onPaste?: (event: ClipboardEvent) => void;
  ariaLabel?: string;
}

const KEY_OPEN_REASON: EngineOpenReason = 'keyboard';

export class TypeaheadEngine<T extends SearchableItem> implements ReactiveController {
  readonly #host: TctElement;
  readonly #options: EngineOptions<T>;
  readonly #listboxId = uniqueId('tct-typeahead-listbox');
  readonly #descendants: ActiveDescendantController<HTMLElement>;
  readonly #position: PositionController;
  readonly #layer: LayerController;

  #query = '';
  #results: T[] = [];
  #hasSearched = false;
  #loading = false;
  #open = false;
  /** Bumped by every superseding event: a search claims one and applies its result only if it is still current. */
  #gen = 0;
  /** The generation the shown results belong to (a refocus must not re-show results a selection invalidated). */
  #resultsGen = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #source: SearchSource<T> | undefined;
  #lastAnnounced: string | null = null;
  /** Index to highlight after the next render, or `'first'`. */
  #pendingHighlight: number | 'first' | null = null;
  /** Whether the current cohort came from an empty-query bootstrap. */
  #bootstrapCohort = false;

  constructor(host: TctElement, options: EngineOptions<T>) {
    this.#host = host;
    this.#options = options;
    this.#descendants = new ActiveDescendantController<HTMLElement>(host, {
      focusElement: () => options.input(),
      items: () => this.#optionElements(),
    });
    this.#position = new PositionController(host, {
      surface: () => this.#layerElement,
      anchor: () => options.anchor() ?? options.input(),
      placement: () => ({placement: 'below', alignment: 'start', offset: 'var(--spacing-1)'}),
      matchAnchorWidth: 'min',
      trackPlacement: true,
    });
    this.#layer = new LayerController(host, {
      kind: 'popover',
      surface: () => this.#layerElement,
      trigger: () => options.input(),
      inside: () => [options.anchor(), options.input(), ...(options.inside?.() ?? [])],
      // The input keeps DOM focus: the popup never takes it, and nothing needs it back.
      initialFocus: 'none',
      returnFocus: false,
      position: this.#position,
      exitAnimation: () => this.#exitAnimation(),
      onDismissRequest: (reason) => {
        this.close(reason);
      },
      onNativeClose: () => {
        this.#open = false;
        this.#host.requestUpdate();
      },
      onShown: () => {
        this.#host.requestUpdate();
      },
    });
    host.addController(this);
  }

  // ---------------------------------------------------------------------------------- state

  /** The text in the input. */
  get query(): string {
    return this.#query;
  }

  /** The results the menu shows. */
  get results(): readonly T[] {
    return this.#results;
  }

  /** Whether the menu is open (the listbox is expanded). */
  get open(): boolean {
    return this.#open;
  }

  /** Whether a search or bootstrap is pending. */
  get loading(): boolean {
    return this.#loading;
  }

  /** The id of the listbox, for `aria-controls`. */
  get listboxId(): string {
    return this.#listboxId;
  }

  /** The highlighted option element (the active descendant), or `null`. */
  get highlighted(): HTMLElement | null {
    return this.#descendants.highlighted;
  }

  /** The item behind the highlighted option, or `null`. */
  get highlightedItem(): T | null {
    const element = this.#descendants.highlighted;
    if (!element) return null;
    const index = Number(element.dataset.index);
    return this.#results[index] ?? null;
  }

  /** Sets the text of the input, as if typed: notifies the host and (re)searches. */
  setQuery(value: string, options: {search?: boolean} = {}): void {
    this.#query = value;
    this.#host.requestUpdate();
    this.#options.onQuery?.(value);
    if (options.search !== false) this.#queryChanged(value);
  }

  /** Forgets the query, the results and any pending work, and closes the menu; emits nothing but the closing request. */
  reset(): void {
    this.#supersede();
    this.#query = '';
    this.#results = [];
    this.#hasSearched = false;
    this.#lastAnnounced = null;
    this.#bootstrapCohort = false;
    this.#setLoading(false);
    this.#descendants.highlight(null);
    this.#hide();
    this.#host.requestUpdate();
  }

  // -------------------------------------------------------------------------------- open/close

  /** Opens the menu when the host allows it. */
  show(reason: EngineOpenReason = 'trigger'): void {
    if (this.#open || this.#options.config().blocked) return;
    if (this.#options.onOpenRequest?.(true, reason) === false) return;
    this.#open = true;
    this.#host.requestUpdate();
  }

  /** Closes the menu when the host allows it; returns whether it is closed afterwards. */
  close(reason: EngineOpenReason = 'request'): boolean {
    if (!this.#open) return true;
    if (this.#options.onOpenRequest?.(false, reason) === false) return false;
    this.#hide();
    return true;
  }

  #hide(): void {
    if (this.#open) {
      this.#open = false;
      this.#source?.cancel?.();
    }
    this.#pendingHighlight = null;
    this.#descendants.highlight(null);
    this.#host.requestUpdate();
  }

  // ---------------------------------------------------------------------------- lifecycle

  hostDisconnected(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#gen++;
    this.#options.config().source?.cancel?.();
  }

  hostUpdated(): void {
    const config = this.#options.config();
    // A replaced source: work still arriving from the old one must not land in the new one's menu.
    if (this.#source !== config.source) {
      this.#source?.cancel?.();
      if (this.#source !== undefined) this.#gen++;
      this.#source = config.source;
    }
    // A field that became unavailable takes its menu down with it (and the active descendant).
    if (config.blocked && (this.#open || this.#loading)) {
      this.#supersede();
      this.#setLoading(false);
      this.#hide();
    }
    // The layer follows `#open`; options exist by now.
    if (this.#open && !this.#layer.isOpen) {
      void this.#layer.show().then(() => {
        this.#options.onOpenSettled?.(true);
      });
    } else if (!this.#open && this.#layer.isOpen) {
      void this.#layer.hide().then(() => {
        this.#options.onOpenSettled?.(false);
      });
    } else if (this.#open) {
      this.#position.update();
    }
    if (this.#pendingHighlight !== null && this.#open) {
      const pending = this.#pendingHighlight;
      this.#pendingHighlight = null;
      const options = this.#optionElements();
      const target =
        pending === 'first' ? options[0] : options[Math.min(pending, options.length - 1)];
      this.#descendants.highlight(target ?? null, 'programmatic');
    }
  }

  // ---------------------------------------------------------------------------------- search

  /** Invalidates in-flight work: pending debounce, pending responses, the source's request. */
  #supersede(): void {
    this.#gen++;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#source?.cancel?.();
  }

  #setLoading(next: boolean): void {
    if (this.#loading === next) return;
    this.#loading = next;
    this.#host.requestUpdate();
    this.#options.onBusyChange?.(next);
  }

  #belowMinimum(query: string): boolean {
    const length = characterCount(query);
    return length > 0 && length < this.#options.config().minQueryLength;
  }

  #setResults(results: T[], highlight: number | 'first' | null = 'first'): void {
    this.#descendants.highlight(null);
    this.#results = results;
    this.#pendingHighlight = results.length > 0 ? highlight : null;
    this.#host.requestUpdate();
  }

  /** The query text changed: cancel what is pending and schedule the search it asks for. */
  #queryChanged(query: string): void {
    const config = this.#options.config();
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#bootstrapCohort = false;

    if ((query.length === 0 && !config.entriesOnFocus) || this.#belowMinimum(query)) {
      // Nothing to search: an emptied field, or a query still shorter than the threshold. Stale results
      // go and the menu closes: "no results" for a query nobody searched would be a lie.
      this.#supersede();
      const derived = config.queryEntries?.(query, []) ?? [];
      this.#hasSearched = false;
      this.#setResults(derived);
      // The abandoned search will not clear this itself.
      this.#setLoading(false);
      this.#lastAnnounced = null;
      if (derived.length > 0) this.show(KEY_OPEN_REASON);
      else this.close('request');
      return;
    }

    const run = (): void => {
      if (query.length > 0) void this.#search(query);
      else void this.#bootstrap();
    };
    if (config.debounceMs <= 0) run();
    else this.#timer = setTimeout(run, config.debounceMs);
  }

  async #search(query: string): Promise<void> {
    const config = this.#options.config();
    const source = config.source;
    if (!source) return;
    source.cancel?.();
    // Claim a new generation so overlapping searches cannot race: an in-flight response for an older
    // query fails the check below instead of overwriting newer results.
    const gen = ++this.#gen;
    this.#setLoading(true);
    this.#hasSearched = true;
    try {
      const found = await source.search(query);
      if (this.#gen !== gen) return;
      this.#resultsGen = gen;
      const fetched = this.#limit(found, config);
      const shown = [...fetched, ...(config.queryEntries?.(query, fetched) ?? [])];
      this.#setResults(shown);
      if (found.length > 0 || query.length > 0) this.show('trigger');
      // Only an active query is announced (not the initial focus-open), and only when the message
      // changed since the last one for this menu.
      if (query.length > 0) {
        this.#announceOutcome(shown.length, config);
      }
    } catch {
      if (this.#gen !== gen) return;
      this.#setResults([]);
    } finally {
      if (this.#gen === gen) this.#setLoading(false);
    }
  }

  async #bootstrap(): Promise<void> {
    const config = this.#options.config();
    const source = config.source;
    if (!source) return;
    const gen = ++this.#gen;
    let pending: T[] | Promise<T[]>;
    try {
      pending = source.bootstrap();
    } catch {
      if (this.#gen === gen) {
        this.#setResults([]);
        this.#setLoading(false);
      }
      return;
    }
    const apply = (found: T[]): void => {
      if (this.#gen !== gen) return;
      this.#resultsGen = gen;
      this.#bootstrapCohort = true;
      const shown = this.#limit(found, config);
      if (this.#results.length === 0 && shown.length === 0) return;
      this.#hasSearched = false;
      this.#setResults(shown);
      if (found.length > 0) this.show('trigger');
    };
    if (Array.isArray(pending)) {
      this.#setLoading(false);
      apply(pending);
      return;
    }
    this.#setLoading(true);
    try {
      apply(await pending);
    } catch {
      if (this.#gen === gen) this.#setResults([]);
    } finally {
      if (this.#gen === gen) this.#setLoading(false);
    }
  }

  #limit(found: T[], config: EngineConfig<T>): T[] {
    const kept = config.filter ? config.filter(found) : found;
    return kept.slice(0, Math.max(0, config.maxMenuItems));
  }

  #announceOutcome(count: number, config: EngineConfig<T>): void {
    const locale = this.#options.locale();
    const message =
      count === 0 ? config.emptyText : locale.t('@tct.typeahead.resultCount', {count});
    if (message === this.#lastAnnounced) return;
    this.#lastAnnounced = message;
    announce(message, {element: this.#host});
  }

  // -------------------------------------------------------------------------------- selection

  /** Chooses `item`: the host decides whether it takes it; on success the query and results reset. */
  select(item: T, reason: ChangeReason = 'selection'): void {
    const config = this.#options.config();
    if (config.blocked) return;
    // Invalidate in-flight searches: a stale result must not land after the choice.
    const cohort = this.#bootstrapCohort;
    const previousIndex = this.#results.indexOf(item);
    this.#supersede();
    if (this.#options.onSelect(item, reason) === false) {
      // Refused: everything stays as it was (the search was superseded, so let the menu be as is).
      this.#setLoading(false);
      return;
    }
    // A choice from the empty-query cohort keeps the menu open on what is left (upstream spec FR13-15).
    // Read again: the host's answer depends on the selection that was just made (a full tokenizer stops).
    const after = this.#options.config();
    if (after.retainAfterSelect && cohort && this.#query === '') {
      const remaining = (after.filter ? after.filter(this.#results) : this.#results).filter(
        (entry) => entry !== item,
      );
      if (remaining.length > 0) {
        this.#resultsGen = this.#gen;
        this.#bootstrapCohort = true;
        this.#setLoading(false);
        this.#setResults(remaining, Math.max(0, previousIndex));
        this.#options.input()?.focus();
        return;
      }
    }
    this.#query = '';
    this.#hasSearched = false;
    this.#lastAnnounced = null;
    this.#bootstrapCohort = false;
    this.#setResults([]);
    this.#setLoading(false);
    // Closing after a choice is not negotiable (an open menu with no results would be empty): the
    // host hears of it, but cannot keep it open.
    if (this.#open) this.#options.onOpenRequest?.(false, 'selection');
    this.#hide();
    this.#options.input()?.focus();
  }

  // ---------------------------------------------------------------------------------- events

  readonly #onInput = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    this.#query = input.value;
    this.#options.onQuery?.(input.value);
    this.#queryChanged(input.value);
  };

  readonly #onFocus = (): void => {
    const config = this.#options.config();
    if (config.blocked) return;
    if (config.entriesOnFocus && this.#results.length === 0 && this.#query.length === 0) {
      void this.#bootstrap();
    } else if (
      this.#results.length > 0 &&
      (this.#query.length > 0 || config.entriesOnFocus) &&
      // Not results a selection invalidated.
      this.#resultsGen === this.#gen
    ) {
      this.show('trigger');
    }
  };

  /**
   * Focus leaving the field for somewhere that is neither the field (its box, its clear button) nor the
   * popup closes the menu: light dismissal covers pointer presses and Escape, not Tab or a script.
   */
  readonly #onBlur = (event: FocusEvent): void => {
    if (!this.#open) return;
    const next = event.relatedTarget;
    if (next instanceof Node) {
      const anchor = this.#options.anchor();
      if (anchor?.contains(next) || this.#layerElement?.contains(next)) return;
    }
    this.close('focus-out');
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    // An IME candidate window uses Enter to commit the composition and Escape/arrows/Home/End to move
    // through its candidates. A composing Enter must never select (it would also clear the input, and the
    // syllable still pending would be written into the cleared field: a second, spurious selection).
    if (isImeKeyEvent(event)) return;
    this.#options.onKeyDown?.(event);
    if (event.defaultPrevented) return;
    const config = this.#options.config();

    if (!this.#open) {
      if (
        event.key === 'ArrowDown' &&
        !event.altKey &&
        !config.blocked &&
        (config.entriesOnFocus || this.#query.length > 0)
      ) {
        event.preventDefault();
        if (this.#results.length > 0) {
          this.show(KEY_OPEN_REASON);
          this.#pendingHighlight = 0;
          this.#host.requestUpdate();
        } else if (config.entriesOnFocus && !this.#belowMinimum(this.#query)) {
          void this.#bootstrap();
        }
      }
      return;
    }

    switch (event.key) {
      case 'Enter': {
        // The open list owns Enter: it selects and never submits the form.
        event.preventDefault();
        const item = this.highlightedItem;
        if (item && !isDisabledOption(this.#descendants.highlighted)) this.select(item, 'keyboard');
        return;
      }
      case 'Tab':
        // Dismiss here rather than from the blur this press produces: hiding a top-layer popover
        // during the focusout makes Chrome abandon the focus move.
        this.close('focus-out');
        return;
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Home':
      case 'End':
        // The list moves the highlight; the caret keeps its keys when nothing can be highlighted.
        if (this.#optionElements().length > 0) this.#descendants.handleKeyDown(event);
        return;
      default:
    }
  };

  readonly #onPointerDown = (event: Event): void => {
    // Pressing the popup must not take focus from the input (it would blur, and close, the menu).
    event.preventDefault();
  };

  // ----------------------------------------------------------------------------- rendering

  get #layerElement(): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>('.typeahead-layer');
  }

  #optionElements(): HTMLElement[] {
    return [
      ...(this.#host.renderRoot?.querySelectorAll<HTMLElement>(
        `#${CSS.escape(this.#listboxId)} [role="option"]`,
      ) ?? []),
    ];
  }

  #exitAnimation(): Animation[] {
    const layer = this.#layerElement;
    if (!layer || matchMedia('(prefers-reduced-motion: reduce)').matches) return [];
    return [
      layer.animate([{opacity: 1}, {opacity: 0}], {duration: 100, easing: 'ease-in'}),
    ];
  }

  /** The combobox `<input>`: every attribute and handler of the pattern; the host adds its own classes and wiring. */
  renderInput(options: InputRenderOptions): TemplateResult {
    return html`<input
      class=${options.className}
      part=${options.part}
      id=${ifDefined(options.id)}
      type="text"
      role="combobox"
      autocomplete="off"
      .value=${live(this.#query)}
      placeholder=${ifDefined(options.placeholder)}
      tabindex=${ifDefined(options.tabindex)}
      enterkeyhint=${ifDefined(options.enterkeyhint)}
      inputmode=${ifDefined(options.inputmode)}
      aria-label=${ifDefined(options.ariaLabel)}
      aria-labelledby=${ifDefined(options.ariaLabelledBy)}
      aria-expanded=${this.#open ? 'true' : 'false'}
      aria-controls=${this.#listboxId}
      aria-autocomplete="list"
      aria-busy=${ifDefined(this.#loading ? 'true' : undefined)}
      aria-disabled=${ifDefined(options.focusableDisabled ? 'true' : undefined)}
      aria-required=${ifDefined(options.ariaRequired ? 'true' : undefined)}
      aria-readonly=${ifDefined(options.readonly ? 'true' : undefined)}
      ?disabled=${options.disabled}
      ?readonly=${options.focusableDisabled || options.readonly === true}
      @input=${this.#onInput}
      @keydown=${this.#onKeyDown}
      @paste=${ifDefined(options.onPaste)}
      @focus=${this.#onFocus}
      @blur=${this.#onBlur}
    />`;
  }

  /** The popup: the positioned top-layer surface holding the listbox of results (or the empty message). */
  renderPopup(): TemplateResult {
    const config = this.#options.config();
    const locale = this.#options.locale();
    const empty = this.#results.length === 0 && this.#hasSearched;
    let index = 0;
    const option = (item: T): TemplateResult => {
      const current = index++;
      const selected = config.selectedId !== null && item.id === config.selectedId;
      return html`<div
        class="option"
        part="option"
        role="option"
        id=${`${this.#listboxId}-option-${current}`}
        data-index=${current}
        aria-selected=${selected ? 'true' : 'false'}
        ?data-selected=${selected}
        @click=${() => {
          this.select(item, 'pointer');
        }}
        @pointermove=${(event: PointerEvent) => {
          const element = event.currentTarget as HTMLElement;
          if (this.#descendants.highlighted !== element)
            this.#descendants.highlight(element, 'pointer');
        }}
      >
        <span class="option-content">${this.#renderContent(item, config)}</span>
        ${
          selected
            ? html`<tct-icon class="option-check" name="check" size="sm" color="primary"></tct-icon>`
            : nothing
        }
      </div>`;
    };
    const body = empty
      ? html`<div
          class="empty"
          part="empty-state"
          role="option"
          aria-disabled="true"
          aria-selected="false"
        >
          ${config.emptyText}
        </div>`
      : groupItems(this.#results as SearchableItem[], {ungroupedFirst: true}).map((group) => {
          const options = (group.items as T[]).map(option);
          if (group.heading === null) return options;
          return html`<div role="group" aria-label=${group.heading}>
            <div class="group-heading" aria-hidden="true">${group.heading}</div>
            ${options}
          </div>`;
        });
    return html`<div
      class="typeahead-layer layer-surface"
      popover="manual"
      data-placement="below"
      style=${styleMap({
        '--_menu-width': config.menuWidth === undefined ? undefined : `${config.menuWidth}px`,
      })}
      @mousedown=${this.#onPointerDown}
      @pointerdown=${this.#onPointerDown}
    >
      <div class="popup" part="popup" data-size=${config.size}>
        <div
          class="listbox scrollbar"
          part="dropdown"
          role="listbox"
          id=${this.#listboxId}
          aria-label=${locale.t('@tct.typeahead.searchResults')}
        >
          ${body}
        </div>
      </div>
    </div>`;
  }

  #renderContent(item: T, config: EngineConfig<T>): TemplateResult {
    if (item.element !== undefined) return html`${item.element}`;
    const custom = config.renderItem?.(item);
    if (custom !== undefined) return html`${custom}`;
    return html`<tct-typeahead-item
      .item=${item}
      exportparts="item: typeahead-item"
    ></tct-typeahead-item>`;
  }
}

function isDisabledOption(option: HTMLElement | null): boolean {
  return option?.getAttribute('aria-disabled') === 'true';
}
