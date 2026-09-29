/**
 * Select-only combobox behaviour (A§9.12, upstream `useCombobox`, `useMultiCombobox` and
 * `useSelectedItemOffset`): the keyboard contract of a listbox popup that a trigger button (or, with
 * search, a text input inside the popup) drives while DOM focus never leaves it. The WAI-ARIA APG
 * "select-only combobox" table, as upstream ports it:
 *
 * | Key (closed)                     | Action                                                              |
 * | -------------------------------- | ------------------------------------------------------------------- |
 * | Click, Enter, Space, ArrowDown   | opens; the selected option (else the first) is highlighted           |
 * | ArrowUp                          | opens; the selected option (else the last) is highlighted            |
 * | a printable character            | single: selects the matching option; multi: opens on it (typeahead)  |
 * | Delete, Backspace                | clears the value (`onClear`), when there is one and no search        |
 *
 * | Key (open)                       | Action                                                              |
 * | -------------------------------- | ------------------------------------------------------------------- |
 * | ArrowDown, ArrowUp               | moves the highlight (no wrap; disabled options are skipped)          |
 * | Home, End                        | first, last enabled option (not with search: the caret moves)        |
 * | PageUp, PageDown                 | first, last enabled option (the search field's Home/End substitute)  |
 * | Enter, Space                     | chooses the highlighted option (Space types into a search field)     |
 * | a printable character            | moves the highlight to the next option that starts with it           |
 * | Escape                           | closes; focus stays on (or returns to) the trigger                   |
 * | Tab                              | closes, and focus moves on (never prevented)                         |
 *
 * The controller keeps the highlighted **index** into `records()` (the navigable options in DOM order)
 * as state, and hands the DOM half to {@link ActiveDescendantController}: `aria-activedescendant`
 * (element reflection, id fallback), the `data-highlighted` mark and keyboard-only scrolling. The
 * options are rendered by the host after the index changes, so the marking runs in `hostUpdated`.
 *
 * Typeahead is the shared {@link TypeaheadController} (locale-aware, same-letter cycling). Every
 * handler checks `isImeKeyEvent` first, so the Enter that commits an IME candidate never selects.
 * [mwg:accessible-web-components] [mwg:accessibility]
 *
 * ```ts
 * readonly #combo = new ComboboxController<Record>(this, {
 *   focusElement: () => this.trigger,
 *   optionElements: () => [...this.renderRoot.querySelectorAll<HTMLElement>('[role=option]')],
 *   records: () => this.visibleRecords,
 *   isOpen: () => this.open,
 *   open: () => this.requestOpen('keyboard'),
 *   close: (reason) => this.requestClose(reason),
 *   onSelect: (record) => this.commit(record),
 * });
 * ```
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import type {ChangeReason} from '../events/tct-event.js';
import {isImeKeyEvent} from '../utils/ime.js';
import {ActiveDescendantController, type HighlightSource} from './active-descendant.js';
import {TypeaheadController} from './typeahead.js';

/** What the controller needs to know about one option. */
export interface ComboboxRecord {
  readonly value: string;
  /** The text typeahead matches against. */
  readonly label: string;
  readonly disabled?: boolean;
}

/** Which element the key event came from: the trigger/listbox, or the search field inside the popup. */
export type ComboboxKeySource = 'trigger' | 'search';

export interface ComboboxOptions<T extends ComboboxRecord> {
  /** The element that holds DOM focus and gets `aria-activedescendant` (the trigger, the search input, the sheet's listbox). */
  focusElement: () => HTMLElement | null;
  /** The rendered option elements, in the order of {@link records}. Empty while closed. */
  optionElements: () => HTMLElement[];
  /** The navigable options in DOM order (filtered by a search, the select-all row first). */
  records: () => readonly T[];
  /** Index of the committed option in {@link records} (single mode): opening highlights it. `-1`: none. */
  selectedIndex?: () => number;
  /** Multi mode: choosing keeps the popup open and toggles. */
  multiple?: boolean;
  /** Disabled, read-only or otherwise unavailable: every key and click is ignored. */
  blocked: () => boolean;
  isOpen: () => boolean;
  /** Search input inside the popup: typing belongs to it; Home/End move its caret. */
  hasSearch: () => boolean;
  /** Opens the popup (`trigger` for a click, `keyboard` for a key). Returning `false` means it did not open (the owner refused). */
  open: (reason: ChangeReason) => boolean | void;
  /** Asks the owner to close (Escape, Tab, a click on the trigger, choosing an option). */
  close: (reason: ChangeReason) => void;
  /** An enabled option was chosen (click or Enter/Space). */
  onSelect: (record: T, index: number) => void;
  /** Delete/Backspace on the closed trigger: clears the value. Absent: the keys do nothing. */
  onClear?: () => void;
  /** Whether there is a value to clear. */
  hasValue?: () => boolean;
  /** With search, a printable key pressed on the closed trigger opens the popup and seeds the query. */
  onSearchSeed?: (character: string) => void;
  /** Single mode, closed: typeahead chose `record` without opening the popup (announce it). */
  onTypeaheadSelect?: (record: T, index: number) => void;
  /** Locale of the typeahead comparison. */
  locale?: () => string | undefined;
}

const isPrintable = (event: KeyboardEvent): boolean =>
  event.key.length === 1 && !event.ctrlKey && !event.metaKey;

export class ComboboxController<T extends ComboboxRecord> implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  readonly #options: ComboboxOptions<T>;
  readonly #typeahead: TypeaheadController;
  readonly #descendants: ActiveDescendantController<HTMLElement>;
  #index = -1;
  #via: HighlightSource = 'programmatic';

  constructor(host: ReactiveControllerHost & HTMLElement, options: ComboboxOptions<T>) {
    this.#host = host;
    this.#options = options;
    this.#typeahead = new TypeaheadController({locale: options.locale});
    this.#descendants = new ActiveDescendantController<HTMLElement>(host, {
      focusElement: () => options.focusElement(),
      items: () => options.optionElements(),
      // The highlight is index state owned here; arrow keys never go through the controller's own handler.
      wrap: false,
    });
    host.addController(this);
  }

  /** Index into `records()` of the highlighted option, or `-1`. */
  get highlightedIndex(): number {
    return this.#index;
  }

  /** The highlighted record, or `undefined`. */
  get highlighted(): T | undefined {
    return this.#options.records()[this.#index];
  }

  /** The characters typeahead has collected so far. */
  get typeaheadBuffer(): string {
    return this.#typeahead.buffer;
  }

  hostUpdated(): void {
    this.#apply();
  }

  hostDisconnected(): void {
    this.reset();
  }

  /** Moves the highlight to `index` (`-1` clears). Disabled options cannot be highlighted. */
  highlight(index: number, via: HighlightSource = 'programmatic'): void {
    const record = this.#options.records()[index];
    if (index >= 0 && (record === undefined || record.disabled)) return;
    if (index === this.#index && via === this.#via) return;
    this.#index = index;
    this.#via = via;
    this.#host.requestUpdate();
  }

  /** Forgets the highlight and the typeahead buffer (the popup closed, the value was cleared). */
  reset(): void {
    this.#typeahead.reset();
    if (this.#index === -1) return;
    this.#index = -1;
    this.#descendants.highlight(null, 'programmatic');
    this.#host.requestUpdate();
  }

  /** Clears only the typeahead buffer (after a selection or a clear). */
  resetTypeahead(): void {
    this.#typeahead.reset();
  }

  /**
   * Points the (new) focus element at the highlighted option again: call after DOM focus moved from
   * the trigger into the popup's search field, so `aria-activedescendant` follows the focus.
   */
  resync(): void {
    this.#descendants.highlight(null, 'programmatic');
    this.#apply();
  }

  /** A click on the trigger: opens (highlighting the selected option) or asks to close. */
  handleTriggerClick(): void {
    if (this.#options.blocked()) return;
    if (this.#options.isOpen()) {
      this.#options.close('trigger');
      return;
    }
    this.#openAt('selected-or-first', 'trigger');
  }

  /** Pointer over an option: highlights it (no scrolling: it is already under the pointer). */
  handlePointerEnter(index: number): void {
    const record = this.#options.records()[index];
    if (record && !record.disabled) this.highlight(index, 'pointer');
  }

  /** Chooses `record`, as a click or Enter does: single mode closes afterwards. */
  choose(index: number): void {
    const record = this.#options.records()[index];
    if (!record || record.disabled || this.#options.blocked()) return;
    this.#options.onSelect(record, index);
    if (!this.#options.multiple) {
      this.#index = -1;
      this.#options.close('selection');
    }
  }

  /**
   * Keys for the focused element. Returns `true` when the key was consumed (`preventDefault()` was
   * called, or it must not reach anything else). Composing keys and blocked controls are never consumed.
   */
  handleKeyDown(event: KeyboardEvent, source: ComboboxKeySource = 'trigger'): boolean {
    if (isImeKeyEvent(event) || event.defaultPrevented) return false;
    if (this.#options.blocked()) return false;
    if (event.altKey || event.ctrlKey || event.metaKey) return false;
    const open = this.#options.isOpen();
    const search = source === 'search' || this.#options.hasSearch();
    const consume = (): true => {
      event.preventDefault();
      return true;
    };

    // Typeahead first (never with a search field: typing belongs to it).
    if (!search && this.#typeahead.isTypeaheadKey(event)) {
      if (this.#typeaheadStep(event, open)) return consume();
      // A printable key that matched nothing is still swallowed on a closed trigger's Space (it is
      // not an activation while a query is being typed), but never prevented for other characters.
      if (event.key === ' ' && this.#typeahead.buffer.length > 0) return consume();
    }

    switch (event.key) {
      case 'ArrowDown':
        if (!open) this.#openAt('selected-or-first', 'keyboard');
        else this.#step(1);
        return consume();
      case 'ArrowUp':
        if (!open) this.#openAt('selected-or-last', 'keyboard');
        else this.#step(-1);
        return consume();
      case 'Enter':
        this.#activate(open);
        return consume();
      case ' ':
        // In a search field a space is text.
        if (search) return false;
        this.#activate(open);
        return consume();
      case 'Escape':
        if (!open) return false;
        this.#options.close('escape');
        return consume();
      case 'Tab':
        // Focus moves on natively; the popup follows it.
        if (open) this.#options.close('focus-out');
        return false;
      case 'Home':
        if (search) return false;
        this.#edge('first');
        return consume();
      case 'End':
        if (search) return false;
        this.#edge('last');
        return consume();
      case 'PageUp':
        this.#edge('first');
        return consume();
      case 'PageDown':
        this.#edge('last');
        return consume();
      case 'Delete':
      case 'Backspace':
        if (search || open || !this.#options.onClear || !this.#options.hasValue?.()) return false;
        this.#typeahead.reset();
        this.#options.onClear();
        return consume();
      default:
        // With a search field, printable keys on the closed trigger open the popup and seed the query.
        if (
          source === 'trigger' &&
          search &&
          this.#options.onSearchSeed &&
          isPrintable(event) &&
          (open || this.#options.open('keyboard') !== false)
        ) {
          this.#options.onSearchSeed(event.key);
          return consume();
        }
        return false;
    }
  }

  // ---------------------------------------------------------------------------------- internals

  /** Highlights per the record list, or opens first and highlights (the DOM renders afterwards). */
  #openAt(where: 'selected-or-first' | 'selected-or-last', reason: ChangeReason): boolean {
    if (this.#options.open(reason) === false) return false;
    if (this.#options.hasSearch()) {
      // The search field takes focus and the query drives the list; ArrowDown/Up still highlight.
      if (where === 'selected-or-first') this.#edge('first');
      else this.#edge('last');
      return true;
    }
    const selected = this.#options.multiple ? -1 : (this.#options.selectedIndex?.() ?? -1);
    const records = this.#options.records();
    if (selected >= 0 && records[selected] && !records[selected].disabled) {
      this.highlight(selected, 'keyboard');
    } else {
      this.#edge(where === 'selected-or-first' ? 'first' : 'last');
    }
    return true;
  }

  /** Enter or Space: chooses the highlighted option when open, else opens. */
  #activate(open: boolean): void {
    if (!open) this.#openAt('selected-or-first', 'keyboard');
    else if (this.#index >= 0) this.choose(this.#index);
  }

  #enabledIndices(): number[] {
    const out: number[] = [];
    this.#options.records().forEach((record, index) => {
      if (!record.disabled) out.push(index);
    });
    return out;
  }

  /** ArrowDown/ArrowUp while open: one enabled option along, without wrapping. */
  #step(direction: 1 | -1): void {
    const enabled = this.#enabledIndices();
    if (enabled.length === 0) return;
    const position = enabled.indexOf(this.#index);
    const next =
      direction === 1
        ? enabled[Math.min(position + 1, enabled.length - 1)]
        : enabled[position < 0 ? enabled.length - 1 : Math.max(position - 1, 0)];
    if (next !== undefined) this.highlight(next, 'keyboard');
  }

  #edge(edge: 'first' | 'last'): void {
    const enabled = this.#enabledIndices();
    const target = edge === 'first' ? enabled[0] : enabled[enabled.length - 1];
    if (target !== undefined) this.highlight(target, 'keyboard');
  }

  /**
   * One typeahead key. Single mode and closed: chooses the match without opening. Open (either mode):
   * moves the highlight. Multi mode and closed: opens on the match.
   */
  #typeaheadStep(event: KeyboardEvent, open: boolean): boolean {
    const records = this.#options.records();
    const current = open ? this.#index : (this.#options.selectedIndex?.() ?? -1);
    const match = this.#typeahead.match(
      event,
      records.map((record) => record.label),
      this.#options.multiple && !open ? -1 : current,
      (index) => records[index]?.disabled === true,
    );
    if (match < 0) return false;
    const record = records[match]!;
    if (open) {
      this.highlight(match, 'keyboard');
    } else if (this.#options.multiple) {
      if (this.#options.open('keyboard') !== false) this.highlight(match, 'keyboard');
    } else if (match !== this.#options.selectedIndex?.()) {
      this.#options.onTypeaheadSelect?.(record, match);
    }
    return true;
  }

  /** Marks the highlighted option element and points the focus element at it. */
  #apply(): void {
    // A closed popup renders no options: nothing to mark, and a stale reference must go.
    const element =
      this.#options.isOpen() && this.#index >= 0
        ? (this.#options.optionElements()[this.#index] ?? null)
        : null;
    this.#descendants.highlight(element, this.#via);
  }
}

/** Multi mode: the same contract, choosing toggles and keeps the popup open. */
export class MultiComboboxController<T extends ComboboxRecord> extends ComboboxController<T> {
  constructor(
    host: ReactiveControllerHost & HTMLElement,
    options: Omit<ComboboxOptions<T>, 'multiple'>,
  ) {
    super(host, {...options, multiple: true});
  }
}

// ------------------------------------------------------------------------ selected-item overlay

/** The selected row renders one optical pixel below the closed trigger's label at the same centre. */
const SELECTED_ITEM_OPTICAL_OFFSET = 1;

/** An element's document-relative layout top, ignoring transforms (`getBoundingClientRect` includes the entry scale). */
function layoutTop(element: HTMLElement): number {
  let top = 0;
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.offsetParent as HTMLElement | null
  ) {
    top += node.offsetTop;
  }
  return top;
}

export interface SelectedItemOffsetInput {
  /** The trigger's box (viewport coordinates). */
  anchor: {top: number; bottom: number; height: number};
  /** The popup's layout height (`offsetHeight`, untransformed). */
  listboxHeight: number;
  /** The target row's centre, from the top of the popup's content (scroll compensated). */
  itemCenter: number;
  /** The viewport height. */
  viewportHeight: number;
}

/**
 * Upstream `useSelectedItemOffset`, as a pure function: how many pixels the popup must be pulled up
 * over the trigger so the selected row sits centred on it (macOS style), clamped so the popup stays
 * inside the viewport. `0` when it should open below the trigger as usual.
 */
export function selectedItemOffset(input: SelectedItemOffsetInput): number {
  const {anchor, listboxHeight, itemCenter, viewportHeight} = input;
  if (listboxHeight <= 0) return 0;
  const anchorCenter = anchor.top + anchor.height / 2;
  const desiredTop = anchorCenter - itemCenter - SELECTED_ITEM_OPTICAL_OFFSET;
  const maxTop = Math.max(0, viewportHeight - listboxHeight);
  const top = Math.min(Math.max(desiredTop, 0), maxTop);
  return Math.max(0, anchor.bottom - top);
}

/**
 * Measures the offset for the open popup: `listbox` is the scrolling list, `item` the selected (or
 * first) option, `anchor` the trigger. Returns `0` when anything is missing or not laid out.
 */
export function measureSelectedItemOffset(
  listbox: HTMLElement | null,
  item: HTMLElement | null,
  anchor: HTMLElement | null,
  viewportHeight: number = window.innerHeight,
): number {
  if (!listbox || !item || !anchor) return 0;
  const itemCenter =
    layoutTop(item) - layoutTop(listbox) - listbox.scrollTop + item.offsetHeight / 2;
  return selectedItemOffset({
    anchor: anchor.getBoundingClientRect(),
    listboxHeight: listbox.offsetHeight,
    itemCenter,
    viewportHeight,
  });
}
