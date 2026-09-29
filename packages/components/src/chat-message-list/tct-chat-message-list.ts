import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {announce} from '@tecton-astryx/core/a11y/announcer.js';
import {ContextConsumer, ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {SPACING_STEPS, type SpacingStep} from '@tecton-astryx/core/mixins/box-props.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {chatListContext} from '../chat-message/chat-message.context.js';
import {chatPlainText} from '../chat-message/chat-message.text.js';
import {CHAT_DENSITIES, type ChatDensity} from '../chat-message/chat-message.types.js';
import {TctSpinner} from '../spinner/tct-spinner.js';
import {warnInvalidValue} from '../text/text.types.js';
import {chatLayoutContext} from './chat-layout.context.js';
import {CHAT_LIST_ALIGNMENTS, type ChatListAlignment} from './chat-message-list.types.js';
import styles from './tct-chat-message-list.styles.css';

/**
 * A message that keeps arriving is spoken once it has been quiet this long (the fallback for a stream
 * the app did not mark with `streaming`).
 */
const SETTLE_MS = 500;

/**
 * More rows than this arriving inside one quiet window are a conversation being loaded, not live
 * messages: only the last one is spoken, so a screen reader is not read fifty messages in a row.
 */
const MAX_ROWS_SPOKEN = 3;

/** The children that are messages or rows of the transcript: everything not in a named slot. */
const isRow = (element: Element): boolean => !element.hasAttribute('slot');

/**
 * The transcript: a `log` of messages (`tct-chat-message`, `tct-chat-system-message`, dividers, any
 * row) with density-based spacing, an optional empty state, a spacer that rests a short conversation
 * on the composer, and an "older messages" sentinel at the top.
 *
 * **Announcements.** The list is a `log` whose native live region is off: it would read a streaming
 * message token by token. Instead it speaks each message once, when it is complete, through the
 * shared announcer: while `streaming` is set nothing is spoken and the message is announced when
 * `streaming` goes back to false; without the flag a message is announced after it has been quiet for
 * half a second. Your own (`user`) messages, rows added above the newest one (older history), rows
 * that were there at load and all but the last of a large batch are not spoken; `no-announce` turns
 * it all off. `aria-busy` marks the log
 * while a stream or an older-messages load is in progress.
 *
 * **Focus and scroll.** The list never moves focus and never scrolls; auto-follow and the
 * scroll-to-bottom button belong to the chat layout (or the scroll controllers used on their own).
 * The list itself is focusable (`tabindex="0"`), and `focusLatestMessage()` hands focus to the newest
 * message, which is where a scroll-to-bottom button should leave it.
 *
 * `density` reaches every message in the list through context; a message can override it.
 *
 * @summary The scrolling transcript of a chat: a log of messages that speaks each one once, when done.
 * @tag tct-chat-message-list
 * @upstream ChatMessageList
 * @slot - The rows: `tct-chat-message`, `tct-chat-system-message` or any content.
 * @slot empty-state - Shown when there are no rows (a `tct-empty-state`, say).
 * @csspart base - The padded column that holds the rows (theme target `chat-message-list`).
 * @csspart loading - The spinner row shown while older messages load.
 * @csspart empty - The empty-state box.
 * @cssstate busy - A stream or an older-messages load is in progress.
 * @cloakDisplay flex
 */
export class TctChatMessageList extends TctElement {
  static override readonly tagName = 'tct-chat-message-list';
  static override readonly dependencies = [TctSpinner];
  static override styles: CSSResultGroup = [base, styles];

  /** Row spacing: `compact`, `balanced` (default) or `spacious`. Flows to every message through context. */
  @property({reflect: true}) density: ChatDensity = 'balanced';

  /**
   * Gap between rows, as a spacing-scale step (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10). Unset: the
   * density's gap. Use it when each row is independent (an event stream) and should not follow density.
   */
  @property({type: Number}) gap: SpacingStep | undefined;

  /**
   * Where a short list rests: `bottom` (default) pushes the messages down to the composer, `top`
   * starts them at the top. Once the messages overflow the container both behave the same.
   */
  @property({reflect: true}) align: ChatListAlignment = 'bottom';

  /**
   * Set while an assistant message is streaming in. The list is marked `aria-busy` and stays silent,
   * and speaks the completed message once when this returns to false.
   */
  @property({type: Boolean, reflect: true}) streaming = false;

  /** Turns the list's own announcements off (an app that announces messages itself). */
  @property({type: Boolean, attribute: 'no-announce'}) noAnnounce = false;

  /**
   * Async action that loads older messages, run when the top of the list scrolls into view. While it
   * is pending the list shows a spinner at the top and is `aria-busy`; a second run does not start
   * before it settles. Property only.
   */
  @property({attribute: false}) scrollToTopAction: (() => Promise<void>) | undefined;

  @state() private _loadingOlder = false;

  readonly #slots = new SlotController(this, 'default', 'empty-state');
  #provided: ChatDensity = 'balanced';
  readonly #provider = new ContextProvider(this, {
    context: chatListContext,
    initialValue: {density: 'balanced'},
  });
  readonly #layout = new ContextConsumer(this, {context: chatLayoutContext, subscribe: true});

  // Content registered with the layout, and the older-messages observer.
  #registered: {contentRef: (element: HTMLElement | null) => void} | undefined;
  #sentinelObserver: IntersectionObserver | undefined;
  #observedSentinel: Element | undefined;
  #observedRoot: HTMLElement | null | undefined;

  // Announcements.
  #rows = new WeakSet<Element>();
  #dirty = new Set<Element>();
  #spoken = new WeakMap<Element, string>();
  #timer: ReturnType<typeof setTimeout> | undefined;
  #rowObserver: MutationObserver | undefined;

  /**
   * Moves focus to the newest message (else the list), without scrolling. The message is made
   * focusable only while it holds focus. This is where a scroll-to-bottom button hands focus over.
   */
  focusLatestMessage(): void {
    const rows = [...this.children].filter(isRow);
    const message = [...rows].reverse().find((row) => row.localName === 'tct-chat-message');
    const target = message ?? rows[rows.length - 1];
    if (!(target instanceof HTMLElement)) {
      this.focus({preventScroll: true});
      return;
    }
    if (!target.hasAttribute('tabindex')) {
      target.tabIndex = -1;
      target.addEventListener(
        'blur',
        () => {
          target.removeAttribute('tabindex');
        },
        {once: true},
      );
    }
    target.focus({preventScroll: true});
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A `log` that can hold focus, so keyboard users can land in the transcript (upstream `tabIndex=0`).
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.#watchRows();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#rowObserver?.disconnect();
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#sentinelObserver?.disconnect();
    this.#sentinelObserver = undefined;
    this.#observedSentinel = undefined;
    this.#registered?.contentRef(null);
    this.#registered = undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('density')) {
      warnInvalidValue('tct-chat-message-list', 'density', this.density, CHAT_DENSITIES);
    }
    if (changed.has('align')) {
      warnInvalidValue('tct-chat-message-list', 'align', this.align, CHAT_LIST_ALIGNMENTS);
    }
    if (changed.has('gap') && this.gap !== undefined && !SPACING_STEPS.includes(this.gap)) {
      devWarn(
        `chat-message-list:gap:${String(this.gap)}`,
        `gap="${String(this.gap)}" is not a spacing step.`,
      );
    }
    this.internals.role = 'log';
    // The native live region is off: this element announces settled messages itself, once.
    this.internals.ariaLive = 'off';
    const busy = this.streaming || this._loadingOlder;
    this.internals.ariaBusy = busy ? 'true' : null;
    this.toggleState('busy', busy);
    const density = this.#density;
    if (this.#provided !== density) {
      this.#provided = density;
      this.#provider.setValue({density});
    }
  }

  protected override firstUpdated(): void {
    // Rows present at load are history, not news.
    for (const row of this.children) if (isRow(row)) this.#rows.add(row);
  }

  protected override updated(changed: PropertyValues<this>): void {
    this.#register();
    this.#observeSentinel();
    if (changed.has('streaming')) {
      if (this.streaming) {
        // A stream began: hold everything until it ends.
        clearTimeout(this.#timer);
        this.#timer = undefined;
      } else if (changed.get('streaming') === true) {
        // The stream ended: speak what was streamed, once, now.
        this.#schedule(0);
      }
    }
  }

  override render(): TemplateResult {
    const empty = !this.#slots.has('default') && this.#slots.has('empty-state');
    const gap = this.gap !== undefined && SPACING_STEPS.includes(this.gap) ? this.gap : undefined;
    return html`<div
      class="base"
      part="base"
      data-density=${this.#density}
      style=${gap === undefined ? nothing : `--_gap: var(--spacing-${String(gap).replace('.', '-')})`}
    >
      ${this.scrollToTopAction ? html`<div class="sentinel" aria-hidden="true"></div>` : nothing}
      ${
        this._loadingOlder
          ? html`<div class="loading" part="loading"><tct-spinner size="md"></tct-spinner></div>`
          : nothing
      }
      ${this.align === 'top' ? nothing : html`<div class="spacer" aria-hidden="true"></div>`}
      <slot></slot>
      ${
        empty
          ? html`<div class="empty" part="empty"><slot name="empty-state"></slot></div>`
          : html`<slot name="empty-state" hidden></slot>`
      }
    </div>`;
  }

  get #density(): ChatDensity {
    return (CHAT_DENSITIES as readonly string[]).includes(this.density) ? this.density : 'balanced';
  }

  // ------------------------------------------------------------------------- layout wiring

  /** Hands the content element to the layout (which watches it grow), and takes it back on change. */
  #register(): void {
    const layout = this.#layout.value;
    const content = this.renderRoot.querySelector<HTMLElement>('.base');
    if (layout === this.#registered || !content) return;
    this.#registered?.contentRef(null);
    this.#registered = layout ?? undefined;
    layout?.contentRef(content);
  }

  // ----------------------------------------------------------- older messages (scroll to top)

  #observeSentinel(): void {
    const sentinel = this.renderRoot.querySelector('.sentinel') ?? undefined;
    const root = this.#layout.value?.scrollContainer() ?? null;
    if (sentinel === this.#observedSentinel && root === this.#observedRoot) return;
    this.#sentinelObserver?.disconnect();
    this.#sentinelObserver = undefined;
    this.#observedSentinel = sentinel;
    this.#observedRoot = root;
    if (!sentinel) return;
    this.#sentinelObserver = new IntersectionObserver(this.#onSentinel, {root, threshold: 0});
    this.#sentinelObserver.observe(sentinel);
  }

  readonly #onSentinel = (entries: IntersectionObserverEntry[]): void => {
    if (entries[0]?.isIntersecting) void this.#loadOlder();
  };

  async #loadOlder(): Promise<void> {
    const action = this.scrollToTopAction;
    if (!action || this._loadingOlder) return;
    this._loadingOlder = true;
    try {
      await action();
    } finally {
      this._loadingOlder = false;
    }
  }

  // ------------------------------------------------------------------------- announcements

  #watchRows(): void {
    this.#rowObserver ??= new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'childList' && record.target === this) {
          for (const node of record.addedNodes) if (node instanceof Element) this.#rowAdded(node);
        } else {
          const row = this.#rowOf(record.target);
          if (row && this.#rows.has(row)) this.#markDirty(row);
        }
      }
    });
    this.#rowObserver.observe(this, {childList: true, characterData: true, subtree: true});
  }

  /** The direct child of this list that contains `node`, if it is a row. */
  #rowOf(node: Node): Element | undefined {
    let current: Node | null = node;
    while (current && current.parentNode !== this) current = current.parentNode;
    return current instanceof Element && isRow(current) ? current : undefined;
  }

  #rowAdded(row: Element): void {
    if (!isRow(row) || this.#rows.has(row)) return;
    this.#rows.add(row);
    // Only the newest row is news: a row inserted above an existing one is older history being loaded.
    let next = row.nextElementSibling;
    while (next && !isRow(next)) next = next.nextElementSibling;
    if (next || this._loadingOlder) return;
    this.#markDirty(row);
  }

  #markDirty(row: Element): void {
    this.#dirty.add(row);
    // While streaming, wait for the end of the stream; otherwise wait for a quiet moment.
    if (!this.streaming) this.#schedule(SETTLE_MS);
  }

  #schedule(delay: number): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#flush();
    }, delay);
  }

  #flush(): void {
    if (this.streaming) return;
    let rows = [...this.#dirty];
    this.#dirty.clear();
    if (rows.length > MAX_ROWS_SPOKEN) rows = rows.slice(-1);
    if (this.noAnnounce) return;
    for (const row of rows) {
      if (!row.isConnected) continue;
      const text = this.#announcement(row);
      if (text === '' || this.#spoken.get(row) === text) continue;
      this.#spoken.set(row, text);
      announce(text);
    }
  }

  /** "Ana: Hello": the message introduced by its name; your own messages are not read back to you. */
  #announcement(row: Element): string {
    const words = chatPlainText(row);
    if (words === '') return '';
    if (row.localName !== 'tct-chat-message') return words;
    if (row.getAttribute('sender') === 'user') return '';
    const name = (row as Element & {accessibleName?: unknown}).accessibleName;
    return typeof name === 'string' && name !== '' ? `${name}: ${words}` : words;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-chat-message-list': TctChatMessageList;
  }
}
