/**
 * `ChatTriggerMenuController`: the suggestion menu a trigger character (`@`, `/`) opens inside the
 * composer's editable surface (upstream `useTriggerMenu`).
 *
 * Typing a trigger character at the start of a word opens a popup at the caret with the items of the
 * trigger's search source, filtered by what is typed after the character. Focus never leaves the
 * editable: the menu is a combobox popup driven by `aria-activedescendant` (ArrowUp/ArrowDown move,
 * Enter or Tab choose, Escape closes, a press outside closes), so typing continues uninterrupted and
 * IME composition is never disturbed (nothing happens while composing; the menu re-evaluates when the
 * composition ends).
 *
 * The popup is a `popover="manual"` surface in the input's shadow root, so the option ids, the listbox and
 * the editable that references them share one tree; it is positioned at the caret with the shared
 * layer and position controllers (a virtual point anchor), on the CSS path where implicit anchors exist and
 * the Floating UI fallback otherwise.
 *
 * Searching: a synchronous source answers at once. A source that returns a promise is debounced
 * (`debounceMs`), superseded searches are cancelled (`cancel()`), and stale answers are dropped, so
 * the list always belongs to the text before the caret.
 *
 * Guides: [mwg:resilient-context-menus-and-nested-dropdowns] (layered popups, focus stays put)
 * [mwg:position-aware-tooltips] (anchored placement) [mwg:accessible-web-components] (all ids in one tree).
 */
import {html, nothing, type TemplateResult} from 'lit';
import {classMap} from 'lit/directives/class-map.js';
import {repeat} from 'lit/directives/repeat.js';
import {LayerController} from '@tecton-wc/core/layer/layer-controller.js';
import {PositionController} from '@tecton-wc/core/layer/position.js';
import type {ReactiveController} from 'lit';
import type {TctElement} from '@tecton-wc/core/tct-element.js';
import {isImeKeyEvent} from '@tecton-wc/core/utils/ime.js';
import {uniqueId} from '@tecton-wc/core/utils/id.js';
import {getSelectionRange, restoreSelectionRange} from './chat-composer.selection.js';
import type {
  ChatComposerSearchItem,
  ChatComposerToken,
  ChatComposerTrigger,
} from './chat-composer.types.js';

export interface ChatTriggerMenuOptions {
  /** The configured triggers (read on use). */
  triggers: () => readonly ChatComposerTrigger[] | undefined;
  /** The editable surface. */
  editable: () => HTMLElement | null;
  /** Debounce of asynchronous searches, in ms. */
  debounceMs: () => number;
  /** Inserts plain text at the caret and publishes the change. */
  insertText: (text: string) => void;
  /** Inserts a token at the caret and publishes the change. */
  insertToken: (token: ChatComposerToken) => void;
  /** Localised fallback texts. */
  text: (key: 'noResults' | 'searching' | 'suggestions') => string;
}

interface MenuState {
  active: boolean;
  trigger: ChatComposerTrigger | null;
  query: string;
  items: readonly ChatComposerSearchItem[];
  highlighted: number;
  loading: boolean;
}

const CLOSED: MenuState = {
  active: false,
  trigger: null,
  query: '',
  items: [],
  highlighted: 0,
  loading: false,
};

const isThenable = <T>(value: unknown): value is PromiseLike<T> =>
  typeof (value as {then?: unknown} | null | undefined)?.then === 'function';

const group = (item: ChatComposerSearchItem): string | undefined => {
  const value = (item.auxiliaryData as {group?: unknown} | undefined)?.group;
  return typeof value === 'string' ? value : undefined;
};

interface ItemGroup {
  heading: string | null;
  items: readonly {item: ChatComposerSearchItem; index: number}[];
}

/** Groups by `auxiliaryData.group`, named groups first in first-seen order, ungrouped items last. */
function groupItems(items: readonly ChatComposerSearchItem[]): ItemGroup[] {
  const indexed = items.map((item, index) => ({item, index}));
  if (!items.some((item) => group(item) !== undefined)) return [{heading: null, items: indexed}];
  const named = new Map<string, {item: ChatComposerSearchItem; index: number}[]>();
  const ungrouped: {item: ChatComposerSearchItem; index: number}[] = [];
  for (const entry of indexed) {
    const heading = group(entry.item);
    if (heading === undefined) ungrouped.push(entry);
    else named.set(heading, [...(named.get(heading) ?? []), entry]);
  }
  return [
    ...[...named].map(([heading, entries]) => ({heading, items: entries})),
    ...(ungrouped.length > 0 ? [{heading: null, items: ungrouped}] : []),
  ];
}

/** The items in the order the popup shows them (grouped), so an option's index is its visual position. */
const inVisualOrder = (items: readonly ChatComposerSearchItem[]): ChatComposerSearchItem[] =>
  groupItems(items).flatMap((section) => section.items.map(({item}) => item));

/** Finds the trigger word that ends at the caret: `{trigger, query, start}` or `null`. */
function findActiveTrigger(
  textBeforeCaret: string,
  triggers: readonly ChatComposerTrigger[],
): {trigger: ChatComposerTrigger; query: string; start: number} | null {
  for (let i = textBeforeCaret.length - 1; i >= 0; i--) {
    const character = textBeforeCaret[i]!;
    // Whitespace ends the word (a non-breaking space too: it follows every inserted token).
    if (/\s/.test(character)) return null;
    for (const trigger of triggers) {
      if (character !== trigger.character) continue;
      const previous = i > 0 ? textBeforeCaret[i - 1]! : null;
      if (previous === null || /\s/.test(previous)) {
        return {trigger, query: textBeforeCaret.slice(i + 1), start: i};
      }
    }
  }
  return null;
}

export class ChatTriggerMenuController implements ReactiveController {
  readonly #host: TctElement;
  readonly #options: ChatTriggerMenuOptions;
  readonly #listboxId = uniqueId('tct-chat-trigger-menu');
  readonly #asyncTriggers = new WeakSet<ChatComposerTrigger>();
  #state: MenuState = CLOSED;
  #start = -1;
  #anchor: {x: number; y: number} | HTMLElement | null = null;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #request = 0;
  #keyboardHighlight = false;

  readonly #position: PositionController;
  readonly #layer: LayerController;

  constructor(host: TctElement, options: ChatTriggerMenuOptions) {
    this.#host = host;
    this.#options = options;
    this.#position = new PositionController(host, {
      surface: () => this.#surface,
      anchor: () => this.#anchor,
      placement: () => ({placement: 'above', alignment: 'start', offset: 'var(--spacing-1)'}),
      trackPlacement: true,
    });
    this.#layer = new LayerController(host, {
      kind: 'popover',
      surface: () => this.#surface,
      inside: () => [options.editable()],
      // The editable owns Escape (it closes the menu and claims the key); this is the platform close request.
      escape: 'close',
      outsidePress: true,
      initialFocus: 'none',
      returnFocus: false,
      position: this.#position,
      onDismissRequest: () => {
        this.reset();
      },
      onNativeClose: () => {
        this.reset();
      },
    });
    host.addController(this);
  }

  hostDisconnected(): void {
    clearTimeout(this.#timer);
    this.#state.trigger?.searchSource.cancel?.();
    this.#state = CLOSED;
  }

  get #surface(): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>('.trigger-menu');
  }

  /** Whether the menu is open. */
  get isOpen(): boolean {
    return this.#state.active;
  }

  /** The id of the listbox (what `aria-controls` names while the menu is open). */
  get listboxId(): string {
    return this.#listboxId;
  }

  /**
   * ARIA for the editable: a plain multiline textbox without triggers; with triggers a combobox
   * (`aria-multiline` is not allowed on a combobox), expanded with an active descendant while the menu is open.
   */
  get ariaAttributes(): Readonly<Record<string, string | undefined>> {
    const triggers = this.#options.triggers();
    if (!triggers || triggers.length === 0) {
      return {role: 'textbox', 'aria-multiline': 'true'};
    }
    if (this.#state.active) {
      return {
        role: 'combobox',
        'aria-expanded': 'true',
        'aria-controls': this.#listboxId,
        'aria-activedescendant':
          this.#state.highlighted >= 0 && this.#state.highlighted < this.#state.items.length
            ? this.#optionId(this.#state.highlighted)
            : undefined,
        'aria-haspopup': 'listbox',
      };
    }
    return {role: 'combobox', 'aria-expanded': 'false', 'aria-haspopup': 'listbox'};
  }

  // ------------------------------------------------------------------------------- opening

  /** Re-evaluates the text before the caret: opens, updates or closes the menu. Call after every edit or caret move. */
  handleInput(): void {
    const triggers = this.#options.triggers();
    if (!triggers || triggers.length === 0) return;
    const editable = this.#options.editable();
    if (!editable) return;
    const range = getSelectionRange(editable);
    const node = range?.startContainer;
    if (!range?.collapsed || node?.nodeType !== Node.TEXT_NODE) {
      if (this.#state.active) this.reset();
      return;
    }
    const before = (node.nodeValue ?? '').slice(0, range.startOffset);
    const found = findActiveTrigger(before, triggers);
    if (!found) {
      if (this.#state.active) this.reset();
      return;
    }
    this.#start = found.start;
    if (!this.#state.active || this.#state.trigger !== found.trigger) {
      this.#state = {...CLOSED, active: true, trigger: found.trigger, query: found.query};
      this.#anchor = this.#caretAnchor(range, editable);
      this.#search(found.trigger, found.query);
      this.#host.requestUpdate();
      void this.#layer.show();
    } else if (this.#state.query !== found.query) {
      this.#state = {...this.#state, query: found.query};
      this.#search(found.trigger, found.query);
      this.#host.requestUpdate();
    }
  }

  /** Closes the menu and cancels a search in flight. */
  reset(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#request++;
    this.#state.trigger?.searchSource.cancel?.();
    const wasOpen = this.#state.active;
    this.#state = CLOSED;
    this.#start = -1;
    this.#anchor = null;
    if (wasOpen) {
      void this.#layer.hide();
      this.#host.requestUpdate();
    }
  }

  /**
   * Handles a keydown while the menu is open; returns whether it consumed the key. Not for
   * composition: the input checks that first.
   */
  handleKeyDown(event: KeyboardEvent): boolean {
    if (!this.#state.active || isImeKeyEvent(event)) return false;
    const {items, highlighted} = this.#state;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (items.length === 0) return true;
        const down = event.key === 'ArrowDown';
        const next = down
          ? highlighted < items.length - 1
            ? highlighted + 1
            : 0
          : highlighted > 0
            ? highlighted - 1
            : items.length - 1;
        this.#keyboardHighlight = true;
        this.#state = {...this.#state, highlighted: next};
        this.#host.requestUpdate();
        return true;
      }
      case 'Enter':
      case 'Tab': {
        const item = items[highlighted];
        if (!item) return false;
        event.preventDefault();
        this.#select(item);
        return true;
      }
      case 'Escape':
        event.preventDefault();
        this.reset();
        return true;
      default:
        return false;
    }
  }

  /** Called after each host update: keeps a keyboard-highlighted option in view (hover never scrolls). */
  afterUpdate(): void {
    if (!this.#keyboardHighlight) return;
    this.#keyboardHighlight = false;
    this.#host.renderRoot
      .querySelector('[role="option"][aria-selected="true"]')
      ?.scrollIntoView({block: 'nearest'});
  }

  // -------------------------------------------------------------------------------- search

  #search(trigger: ChatComposerTrigger, query: string): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
    const run = (): void => {
      trigger.searchSource.cancel?.();
      const request = ++this.#request;
      let result: ReturnType<ChatComposerTrigger['searchSource']['search']>;
      try {
        result = trigger.searchSource.search(query);
      } catch {
        result = [];
      }
      if (isThenable<ChatComposerSearchItem[]>(result)) {
        this.#asyncTriggers.add(trigger);
        this.#state = {...this.#state, loading: true};
        this.#host.requestUpdate();
        result.then(
          (items) => {
            this.#settle(request, items);
          },
          () => {
            this.#settle(request, []);
          },
        );
      } else {
        const items = inVisualOrder(result);
        this.#state = {
          ...this.#state,
          items,
          highlighted: items.length > 0 ? 0 : -1,
          loading: false,
        };
      }
    };
    // A source that answered asynchronously is debounced; the first search, and every synchronous
    // source, answers at once (no probe call: the first real query tells which kind it is).
    if (this.#asyncTriggers.has(trigger) && this.#options.debounceMs() > 0) {
      this.#state = {...this.#state, loading: true};
      this.#timer = setTimeout(run, this.#options.debounceMs());
    } else {
      run();
    }
  }

  #settle(request: number, items: readonly ChatComposerSearchItem[]): void {
    // A newer search, or a closed menu, owns the list now.
    if (request !== this.#request || !this.#state.active) return;
    const ordered = inVisualOrder(items);
    this.#state = {
      ...this.#state,
      items: ordered,
      highlighted: ordered.length > 0 ? 0 : -1,
      loading: false,
    };
    this.#host.requestUpdate();
  }

  // ------------------------------------------------------------------------------ selecting

  #select(item: ChatComposerSearchItem): void {
    const trigger = this.#state.trigger;
    const editable = this.#options.editable();
    if (!trigger || !editable) return;
    // Remove the trigger word ("@al") before inserting what was chosen.
    const range = getSelectionRange(editable);
    const node = range?.startContainer;
    if (range && node?.nodeType === Node.TEXT_NODE && this.#start >= 0) {
      const text = node as Text;
      const start = Math.min(this.#start, text.data.length);
      text.data = text.data.slice(0, start) + text.data.slice(range.startOffset);
      const caret = document.createRange();
      caret.setStart(text, start);
      caret.collapse(true);
      restoreSelectionRange(caret);
    }
    const result = trigger.onSelect(item);
    if (typeof result === 'string') this.#options.insertText(result);
    else this.#options.insertToken(result);
    this.reset();
  }

  // ------------------------------------------------------------------------------- anchoring

  /** The caret's position for the popup; falls back to the editable where the engine reports no rect. */
  #caretAnchor(range: Range, editable: HTMLElement): {x: number; y: number} | HTMLElement {
    const rect = range.getBoundingClientRect();
    const empty = rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0;
    return empty ? editable : {x: rect.left, y: rect.top};
  }

  // --------------------------------------------------------------------------------- render

  #optionId(index: number): string {
    return `${this.#listboxId}-option-${index}`;
  }

  /** The popup surface; always in the template (a closed popover paints nothing), its content only while open. */
  render(): TemplateResult {
    const {active, trigger, items, highlighted, loading} = this.#state;
    const text = this.#options.text;
    const message = !active
      ? nothing
      : loading
        ? html`<div class="status" role="status">${trigger?.loadingText ?? text('searching')}</div>`
        : items.length === 0
          ? html`<div class="status" role="status">
              ${trigger?.emptySearchResultsText ?? text('noResults')}
            </div>`
          : nothing;
    return html`<div class="trigger-menu layer-surface" popover="manual" data-placement="above">
      <div class="menu" part="trigger-menu">
        ${message}
        <div
          class="listbox"
          id=${this.#listboxId}
          role="listbox"
          aria-label=${trigger?.menuLabel ?? text('suggestions')}
          aria-busy=${loading ? 'true' : nothing}
          ?hidden=${!active || items.length === 0}
        >
          ${
            active
              ? groupItems(items).map((section) => {
                  const options = repeat(
                    section.items,
                    ({item}) => item.id,
                    ({item, index}) =>
                      html`<div
                        class=${classMap({option: true, highlighted: index === highlighted})}
                        id=${this.#optionId(index)}
                        role="option"
                        tabindex="-1"
                        aria-selected=${index === highlighted ? 'true' : 'false'}
                        @mousedown=${(event: MouseEvent) => {
                          // Focus stays in the editable: the choice is made without a blur.
                          event.preventDefault();
                          this.#select(item);
                        }}
                        @mouseenter=${() => {
                          if (index === this.#state.highlighted) return;
                          // Hovering highlights only; scrolling here would move the next option under a
                          // still pointer and start a runaway scroll.
                          this.#state = {...this.#state, highlighted: index};
                          this.#host.requestUpdate();
                        }}
                      >
                        ${trigger?.renderItem ? trigger.renderItem(item) : html`<span class="label">${item.label}</span>`}
                      </div>`,
                  );
                  return section.heading === null
                    ? options
                    : html`<div role="group" aria-label=${section.heading}>
                        <div class="group-heading" aria-hidden="true">${section.heading}</div>
                        ${options}
                      </div>`;
                })
              : nothing
          }
        </div>
      </div>
    </div>`;
  }
}
