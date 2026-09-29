import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {styleMap} from 'lit/directives/style-map.js';
import chat from '@tecton-wc/locales/en/chat.js';
import chatComposer from '@tecton-wc/locales/en/chat-composer.js';
import chatTriggerMenu from '@tecton-wc/locales/en/chatTriggerMenu.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {TctChatFilesEvent} from '@tecton-wc/core/events/tct-chat-files.js';
import {TctChatPasteEvent} from '@tecton-wc/core/events/tct-chat-paste.js';
import {TctChatTokenExpandEvent} from '@tecton-wc/core/events/tct-chat-token-expand.js';
import {TctChatSubmitEvent} from '@tecton-wc/core/events/tct-chat-submit.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {isImeKeyEvent, ImeGuard} from '@tecton-wc/core/utils/ime.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import layer from '../styles/layer.styles.css';
import {isCustomToken} from '../chat-message/chat-message.tokens.js';
import {chatComposerContext, type ChatComposerContextValue} from './chat-composer.context.js';
import {supportsPlaintextOnly} from './chat-composer.platform.js';
import {
  ensureCaretInside,
  getSelectionRange,
  insertTextAtCursor,
  isSelectionAtEnd,
  isSelectionAtStart,
  placeCaretAtEnd,
  restoreSelectionRange,
  selectAll,
} from './chat-composer.selection.js';
import {
  ChatComposerTokensController,
  TOKEN_ATTRIBUTE,
  TOKEN_ID_ATTRIBUTE,
} from './chat-composer.tokens.js';
import type {
  ChatComposerInputControl,
  ChatComposerInputHandle,
  ChatComposerToken,
  ChatComposerTrigger,
} from './chat-composer.types.js';
import {ChatPasteAsTokenController, DEFAULT_PASTE_TOKEN_THRESHOLD} from './chat-paste-as-token.js';
import {ChatTriggerMenuController} from './chat-trigger-menu.js';
import {TctChatComposerTokenElement} from './tct-chat-composer-token-element.js';
import styles from './tct-chat-composer-input.styles.css';

const english = {...chat, ...chatComposer, ...chatTriggerMenu};

const INTERIM_ATTRIBUTE = 'data-tct-interim';
const NBSP = / /g;

/**
 * The rich editing surface of a chat composer: a multi-line plain-text field that also holds inline
 * tokens, opens suggestion menus at trigger characters (`@` mentions, `/` commands), recalls sent
 * drafts, turns long pastes into chips, and takes dropped or pasted files. Put it in the `input` slot of
 * `tct-chat-composer` (the composer renders one by default); it also works on its own.
 *
 * **Editing model.** The surface is a `contenteditable` element in the shadow root (`plaintext-only`
 * where the engine supports it, so it holds only text and tokens), because inline tokens that wrap with the
 * text, delete as a unit and can be selected and copied can only live inside an editable flow (see the
 * decision in `parity.json`). It is a `textbox` (multiline), or a `combobox` while triggers are
 * configured. `value` is the serialized draft: text as typed, each token as its `value`.
 *
 * **Keyboard.** Enter submits (`tct-chat-submit`) unless Shift is held; Shift+Enter inserts a newline. The
 * Enter that commits an IME candidate, and every other key while a composition is running, never
 * submits or recalls history. The key hint of a soft keyboard is `send` (`enterkeyhint`, overridable on
 * the host). ArrowUp at the very start of the draft recalls the previous sent draft, ArrowDown at the
 * very end steps forward and finally restores what you were typing. Backspace and Delete next to a token
 * remove it as a unit; with an expandable (pasted-text) chip selected, Enter expands it. With a menu open ArrowUp/ArrowDown move, Enter or Tab choose, Escape closes.
 *
 * **Taking a key over.** The input skips a key an ancestor already claimed: listen for `keydown` on the
 * composer (or an ancestor) in the capture phase and call `preventDefault()` (upstream `onKeyDown`).
 * Keys you only want to observe need no special handling: the events bubble. To make Enter a newline on
 * a touch keyboard, `preventDefault()` the `tct-chat-submit` event: the draft is kept and Enter inserts
 * a newline.
 *
 * **Disabled.** A disabled input stays a focus stop (`aria-disabled`) and is simply not editable, so
 * focus is never dropped when a send disables the composer while a reply streams.
 *
 * @summary Rich chat input: multi-line text with inline tokens, trigger menus, history and paste handling.
 * @tag tct-chat-composer-input
 * @upstream ChatComposerInput
 * @csspart base - The root that holds the editable, the placeholder and the menu.
 * @csspart editable - The editable surface (theme target `chat-composer-input`).
 * @csspart placeholder - The placeholder shown while the draft is empty.
 * @csspart trigger-menu - The suggestion popup.
 * @fires input - Native `input`, retargeted: after every edit of the draft, and after every change made through
 *   `insertText()`, `insertToken()`, `expandToken()`, paste, history recall, dictation and choosing a suggestion.
 *   Property writes (`value`) never fire it.
 * @fires {TctChatSubmitEvent} tct-chat-submit - Enter without Shift (not while composing) with a non-blank draft; cancelable. Inside a composer the composer fires it.
 * @fires {TctChatPasteEvent} tct-chat-paste - Before pasted text is inserted; cancelable (you handled it).
 * @fires {TctChatFilesEvent} tct-chat-files - Files were pasted or dropped; not while disabled.
 * @cloakDisplay block
 */
export class TctChatComposerInput extends TctElement implements ChatComposerInputHandle {
  static override readonly tagName = 'tct-chat-composer-input';
  static override readonly dependencies = [TctChatComposerTokenElement];
  static override shadowRootOptions: ShadowRootInit = {
    ...TctElement.shadowRootOptions,
    delegatesFocus: true,
  };
  static override styles: CSSResultGroup = [base, focusRing, layer, styles];

  static override get observedAttributes(): string[] {
    // `enterkeyhint` is a global attribute the input reads for its editable.
    return [...super.observedAttributes, 'enterkeyhint'];
  }

  /**
   * The draft: text as typed, each token as its `value`. The attribute is the initial draft; the
   * property is the current one, and writing it replaces the draft without firing events. Inside a
   * `tct-chat-composer` it stays in step with the composer's `value`.
   */
  @property() value = '';

  /** Placeholder while the draft is empty. Default: the composer's, else the localised "Type a message…". */
  @property() placeholder: string | undefined;

  /** Rows the field grows to before it scrolls. Default 8. */
  @property({type: Number, attribute: 'max-rows'}) maxRows = 8;

  /** Trigger definitions for `@` menus, `/` commands and the like; property only. */
  @property({attribute: false}) triggers: readonly ChatComposerTrigger[] | undefined;

  /** Debounce of asynchronous trigger searches, in ms. Default 150; 0 searches on every keystroke. */
  @property({type: Number, attribute: 'debounce-ms'}) debounceMs = 150;

  /** Turns off message history recall (ArrowUp at the start of the draft). Upstream `hasHistory` defaults to true. */
  @property({type: Boolean, attribute: 'no-history'}) noHistory = false;

  /** Accessible name of the field. Default: the localised "Message input". */
  @property() label: string | undefined;

  /** Makes the field non-editable (it stays focusable and is exposed as disabled). */
  @property({type: Boolean, reflect: true}) disabled = false;

  /**
   * Long-paste-to-token behaviour: a `ChatPasteAsTokenController` to customise it, `false` to turn it off
   * (a paste always inserts text). Default: pastes over 200 characters become a token chip.
   */
  @property({attribute: false}) pasteAsToken: ChatPasteAsTokenController | false | undefined;

  /** Turns paste-as-token off (the attribute form of `pasteAsToken = false`). */
  @property({type: Boolean, attribute: 'no-paste-as-token'}) noPasteAsToken = false;

  @state() private isEmptyDraft = true;

  readonly #locale: LocaleController = new LocaleController(this, {defaults: english});
  readonly #ime: ImeGuard = new ImeGuard(this, () => this.#editable);
  readonly #composer: ContextConsumer<typeof chatComposerContext> = new ContextConsumer<
    typeof chatComposerContext
  >(this, {
    context: chatComposerContext,
    subscribe: true,
    callback: (context) => {
      this.#onComposer(context);
    },
  });
  readonly #tokens: ChatComposerTokensController = new ChatComposerTokensController({
    editable: () => this.#editable,
    onChange: (inputType) => {
      this.#dispatchInput(inputType, null);
    },
    isExpandable: (token) => !isCustomToken(token) && token.value.length > this.#pasteThreshold,
  });
  readonly #menu: ChatTriggerMenuController = new ChatTriggerMenuController(this, {
    triggers: () => this.triggers,
    editable: () => this.#editable,
    debounceMs: () => this.debounceMs,
    insertText: (text) => {
      this.insertText(text);
    },
    insertToken: (token) => {
      this.insertToken(token);
    },
    text: (key) =>
      this.#locale.t(
        key === 'suggestions' ? '@tct.chatTriggerMenu.suggestions' : `@tct.chat-composer.${key}`,
      ),
  });
  readonly #defaultPaste: ChatPasteAsTokenController = new ChatPasteAsTokenController({
    input: () => this,
  });
  readonly #control: ChatComposerInputControl = {
    focus: () => {
      this.#focusAtEnd();
    },
  };
  #history: string[] = [];
  #historyIndex = -1;
  #pendingDraft = '';
  #interim: HTMLElement | null = null;
  #composerSynced = false;
  #publishCount = 0;

  // ------------------------------------------------------------------------------- public API

  /** Inserts a token at the caret (replacing a selection); returns its id. */
  insertToken(token: ChatComposerToken): string | undefined {
    if (this.#isDisabled) return undefined;
    return this.#tokens.insertToken(token);
  }

  /** Replaces the token with the given id by its serialized text. */
  expandToken(id: string): void {
    this.#tokens.expandToken(id);
  }

  /** Inserts plain text at the caret (replacing a selection) and fires `input`. */
  insertText(text: string): void {
    const editable = this.#editable;
    if (!editable || this.#isDisabled) return;
    insertTextAtCursor(editable, text);
    this.#dispatchInput('insertText', text);
  }

  /** The serialized draft as it stands (not trimmed). */
  getValue(): string {
    return this.#serialize();
  }

  /**
   * Submits the draft as Enter does: fires the cancelable `tct-chat-submit` with the trimmed draft and,
   * unless it was prevented, clears it. Returns whether the draft was submitted (a blank draft is not).
   */
  submit(): boolean {
    const text = this.#draft().trim();
    if (text === '' || this.#isDisabled) return false;
    const accepted = this.#submitText(text);
    if (accepted) this.#afterSubmit(text);
    return accepted;
  }

  /**
   * Focuses the field, keeping a caret or selection it already has. Without one the caret goes after the
   * draft, never to its start (where ArrowUp means "recall history").
   */
  override focus(options?: FocusOptions): void {
    const editable = this.#editable;
    if (!editable) {
      super.focus(options);
      return;
    }
    // Read before focusing: `focus()` itself creates the offset-0 caret in Chromium.
    const existing = getSelectionRange(editable);
    editable.focus(options);
    if (existing) restoreSelectionRange(existing);
    else placeCaretAtEnd(editable);
  }

  /**
   * Shows the phrase being dictated as faded ghost text at the end of the draft (upstream dictation
   * interim text). It is not part of the value and is hidden from assistive technology.
   */
  setInterimText(text: string): void {
    const editable = this.#editable;
    if (!editable) return;
    let span = this.#interim;
    if (!span?.isConnected) {
      span = document.createElement('span');
      span.className = 'interim';
      span.setAttribute(INTERIM_ATTRIBUTE, '');
      span.setAttribute('aria-hidden', 'true');
      span.contentEditable = 'false';
      editable.append(span);
      this.#interim = span;
    }
    span.textContent = text;
    this.isEmptyDraft = false;
  }

  /** Removes the ghost text. */
  clearInterimText(): void {
    this.#interim?.remove();
    this.#interim = null;
    this.isEmptyDraft =
      this.#draft() === '' && this.#editable?.querySelector(`[${TOKEN_ATTRIBUTE}]`) === null;
  }

  // ---------------------------------------------------------------------------------- internals

  get #editable(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.editable');
  }

  get #isDisabled(): boolean {
    return this.disabled || (this.#composer.value?.disabled ?? false);
  }

  /** Characters after which a paste becomes a token chip (`Infinity` when off). */
  get #pasteThreshold(): number {
    if (this.pasteAsToken === false || this.noPasteAsToken) return Number.POSITIVE_INFINITY;
    return (this.pasteAsToken ?? this.#defaultPaste).threshold ?? DEFAULT_PASTE_TOKEN_THRESHOLD;
  }

  /** The serialized draft: text (a non-breaking space as a space), tokens as their value, no ghost text. */
  #serialize(node: Node | null = this.#editable): string {
    let text = '';
    if (!node) return text;
    const children = [...node.childNodes];
    children.forEach((child, index) => {
      if (child.nodeType === Node.TEXT_NODE) {
        text += (child.nodeValue ?? '').replace(NBSP, ' ');
      } else if (child instanceof HTMLElement) {
        if (child.hasAttribute(TOKEN_ATTRIBUTE)) {
          text += child.getAttribute('data-tct-token-value') ?? '';
        } else if (child.hasAttribute(INTERIM_ATTRIBUTE)) {
          // Ghost text is not part of the draft.
        } else if (child.tagName === 'BR') {
          // A <br> that is only the placeholder an engine leaves under a trailing newline adds nothing.
          const placeholder = index === children.length - 1 && (text === '' || text.endsWith('\n'));
          if (!placeholder) text += '\n';
        } else {
          // A block (an engine's own paragraph when the surface is not plaintext-only) is a line of its own.
          if (index > 0 && /^(DIV|P)$/.test(child.tagName)) text += '\n';
          text += this.#serialize(child);
        }
      }
    });
    return text;
  }

  /** The draft as published: whitespace only, with no token, is empty. */
  #draft(): string {
    const editable = this.#editable;
    if (!editable) return this.value;
    const text = this.#serialize(editable);
    const hasIsland = editable.querySelector(`[${TOKEN_ATTRIBUTE}]`) !== null;
    return text.trim() === '' && !hasIsland ? '' : text;
  }

  /** Reads the editable and publishes the draft: `value`, the placeholder and the composer. */
  #publish(): void {
    const editable = this.#editable;
    if (!editable) return;
    const next = this.#draft();
    this.#publishCount++;
    this.isEmptyDraft = next === '' && editable.querySelector(`[${INTERIM_ATTRIBUTE}]`) === null;
    if (next !== this.value) this.value = next;
    this.#composer.value?.setValue(next);
    this.#tokens.prune();
  }

  /**
   * Fires a native-shaped `input` event from the editable (composed, so it reaches the host and beyond).
   * Every change made by code that stands in for typing (insertion, paste, recall, dictation) goes through
   * here, so the draft is published by one path and listeners see one `input` per change.
   */
  #dispatchInput(inputType: string, data: string | null): void {
    this.#editable?.dispatchEvent(
      new InputEvent('input', {bubbles: true, composed: true, inputType, data}),
    );
  }

  /** Builds the DOM for `text`: plain text, with tokens where a trigger's `deserialize` finds them. */
  #writeValue(text: string): void {
    const editable = this.#editable;
    if (!editable) return;
    this.#interim = null;
    const deserializers = (this.triggers ?? []).filter((trigger) => trigger.deserialize);
    const nodes: Node[] = [];
    let run = '';
    const flush = (): void => {
      if (run !== '') nodes.push(document.createTextNode(run));
      run = '';
    };
    if (deserializers.length === 0) {
      run = text;
    } else {
      for (const part of text.split(/(\s+)/)) {
        let token: ChatComposerToken | null = null;
        if (part !== '' && !/^\s+$/.test(part)) {
          for (const trigger of deserializers) {
            token = trigger.deserialize?.(part) ?? null;
            if (token) break;
          }
        }
        if (token) {
          flush();
          nodes.push(this.#tokens.create(token).element);
        } else {
          run += part;
        }
      }
    }
    flush();
    editable.replaceChildren(...nodes);
  }

  /** Brings the editable to `value` after it was written from outside; never mid-composition. */
  #syncValueToDom(): void {
    const editable = this.#editable;
    if (!editable || this.#ime.composing) return;
    if (this.#draft() === this.value) return;
    const focused = this.#hasFocus;
    this.#writeValue(this.value);
    if (focused) placeCaretAtEnd(editable);
    this.#tokens.prune();
  }

  get #hasFocus(): boolean {
    const editable = this.#editable;
    return editable !== null && (this.renderRoot as ShadowRoot).activeElement === editable;
  }

  #focusAtEnd(): void {
    const editable = this.#editable;
    if (!editable) return;
    editable.focus();
    placeCaretAtEnd(editable);
  }

  #onComposer(context: ChatComposerContextValue | null | undefined): void {
    if (!context) return;
    if (!this.#composerSynced) {
      this.#composerSynced = true;
      context.registerInput(this.#control);
      // An initial draft on the input (its `value` attribute) becomes the composer's.
      if (this.value !== '' && context.value === '') {
        context.setValue(this.value);
        return;
      }
    }
    if (context.value !== this.value) this.value = context.value;
    this.requestUpdate();
  }

  // -------------------------------------------------------------------------------- submit

  #submitText(text: string): boolean {
    const composer = this.#composer.value;
    return composer ? composer.submit(text) : this.dispatch(new TctChatSubmitEvent(text));
  }

  /** A submitted draft goes into history and the field starts empty. */
  #afterSubmit(text: string): void {
    if (!this.noHistory) {
      this.#history.push(text);
      this.#historyIndex = -1;
      this.#pendingDraft = '';
    }
    this.#editable?.replaceChildren();
    this.#interim = null;
    this.#dispatchInput('deleteContent', null);
  }

  // ---------------------------------------------------------------------------------- events

  readonly #onInput = (event: Event): void => {
    this.#publish();
    // Nothing opens or moves while an input method composes: the menu re-evaluates when it ends.
    if (!(event as InputEvent).isComposing && !this.#ime.composing) this.#menu.handleInput();
  };

  readonly #onCompositionEnd = (): void => {
    this.#publish();
    this.#menu.handleInput();
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    // A key an ancestor claimed in the capture phase is theirs (upstream `onKeyDown` seam).
    if (event.defaultPrevented) return;
    // Enter commits an IME candidate, Escape cancels it, arrows pick candidates: never a command.
    if (isImeKeyEvent(event)) return;
    if (this.#menu.handleKeyDown(event)) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      this.#onEnter(event);
      return;
    }
    if (
      !this.noHistory &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
      !event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      this.#recall(event);
    }
  };

  #onEnter(event: KeyboardEvent): void {
    // A selected expandable chip is "activated" by Enter (the keyboard route to Expand, which the hover card
    // offers the pointer): select it with Shift+Arrow, press Enter.
    const selected = this.#selectedExpandableToken();
    if (selected) {
      event.preventDefault();
      selected.dispatchEvent(
        new TctChatTokenExpandEvent(selected.getAttribute('data-tct-token-value') ?? ''),
      );
      return;
    }
    const text = this.#draft().trim();
    if (text === '') {
      // Enter in a blank field neither submits nor makes a blank line.
      event.preventDefault();
      return;
    }
    if (this.#submitText(text)) {
      event.preventDefault();
      this.#afterSubmit(text);
    }
    // Refused (a prevented `tct-chat-submit`): the key is left to the editor and inserts a newline.
  }

  /** The expandable token that is the whole of the current range selection (nothing else but spaces), else `null`. */
  #selectedExpandableToken(): HTMLElement | null {
    const editable = this.#editable;
    const range = editable ? getSelectionRange(editable) : null;
    if (!editable || !range || range.collapsed) return null;
    const covered = [...editable.querySelectorAll<HTMLElement>(`[${TOKEN_ATTRIBUTE}]`)].filter(
      (token) => range.intersectsNode(token),
    );
    if (covered.length !== 1 || !covered[0]!.hasAttribute('expandable')) return null;
    return range.toString().replace(/[\s\u00A0]/g, '') === '' ? covered[0]! : null;
  }

  /**
   * ArrowUp at the very start of the draft recalls the previous sent draft, ArrowDown at the very end
   * steps forward and past the newest restores the draft being typed. Elsewhere the caret moves as usual.
   * A recalled draft is fully selected (it spans both boundaries, so repeated presses keep stepping).
   */
  #recall(event: KeyboardEvent): void {
    const editable = this.#editable;
    if (!editable || (this.#history.length === 0 && this.#historyIndex === -1)) return;
    // A caret we never placed (an engine that leaves no range, or a consumer that focused the node
    // directly): put it where our own focus would have, so a pending draft is not mistaken for a caret at the start.
    const range = ensureCaretInside(editable);
    const collapsed = range.collapsed;
    const atStart = isSelectionAtStart(editable);
    const atEnd = isSelectionAtEnd(editable);
    const up = event.key === 'ArrowUp';
    if (up ? !(atStart && (collapsed || atEnd)) : !(atEnd && (collapsed || atStart))) return;
    const history = this.#history;
    if (up) {
      if (history.length === 0) return;
      if (this.#historyIndex === -1) this.#pendingDraft = this.#serialize();
      this.#historyIndex =
        this.#historyIndex === -1 ? history.length - 1 : Math.max(0, this.#historyIndex - 1);
      this.#show(history[this.#historyIndex]!, event);
    } else if (this.#historyIndex !== -1) {
      const next = this.#historyIndex + 1;
      if (next >= history.length) {
        this.#historyIndex = -1;
        this.#show(this.#pendingDraft, event);
      } else {
        this.#historyIndex = next;
        this.#show(history[next]!, event);
      }
    }
  }

  #show(text: string, event: KeyboardEvent): void {
    const editable = this.#editable;
    if (!editable) return;
    this.#writeValue(text);
    if (text !== '') selectAll(editable);
    this.#dispatchInput('insertReplacementText', text);
    event.preventDefault();
  }

  readonly #onBeforeInput = (event: InputEvent): void => {
    if (this.#tokens.handleBeforeInput(event)) return;
    if (supportsPlaintextOnly()) return;
    // Fallback surface (`contenteditable="true"`, Firefox before 136): keep it plain text, with `\n` for
    // line breaks, so the draft never contains an engine's paragraphs, bold or links.
    const editable = this.#editable;
    if (!editable) return;
    if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
      event.preventDefault();
      insertTextAtCursor(editable, '\n');
      this.#dispatchInput('insertLineBreak', null);
    } else if (event.inputType.startsWith('format')) {
      event.preventDefault();
    }
  };

  readonly #onPaste = (event: ClipboardEvent): void => {
    const editable = this.#editable;
    // Claimed by an ancestor in the capture phase, or the field is not editable.
    if (!editable || event.defaultPrevented || this.#isDisabled) return;
    const files = [...(event.clipboardData?.files ?? [])];
    if (files.length > 0) {
      event.preventDefault();
      this.dispatch(new TctChatFilesEvent(files, 'paste'));
      return;
    }
    // Always plain text: the browser never pastes markup into the draft.
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (text === '') return;
    ensureCaretInside(editable);
    const published = this.#publishCount;
    if (!this.dispatch(new TctChatPasteEvent(text))) {
      // Handled by the page; publish only when its handling did not already.
      if (this.#publishCount === published) this.#dispatchInput('insertFromPaste', text);
      return;
    }
    const paste =
      this.pasteAsToken === false || this.noPasteAsToken
        ? null
        : (this.pasteAsToken ?? this.#defaultPaste);
    // The token insertion publishes itself.
    if (paste?.handlePaste(text)) return;
    insertTextAtCursor(editable, text);
    this.#dispatchInput('insertFromPaste', text);
  };

  readonly #onDragOver = (event: DragEvent): void => {
    // Files are ours to receive (dropping them on the page would navigate away).
    if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  };

  readonly #onDrop = (event: DragEvent): void => {
    const files = [...(event.dataTransfer?.files ?? [])];
    if (files.length > 0) {
      event.preventDefault();
      if (!this.#isDisabled) this.dispatch(new TctChatFilesEvent(files, 'drop'));
    } else if (!supportsPlaintextOnly()) {
      // The fallback surface would take dropped markup.
      event.preventDefault();
    }
  };

  readonly #onBlur = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && this.renderRoot.contains(next)) return;
    this.#menu.reset();
  };

  /** A caret move (arrows, Home/End, a click) can leave or enter a trigger word. */
  readonly #onCaretMove = (): void => {
    if (!this.#ime.composing) this.#menu.handleInput();
  };

  readonly #onKeyUp = (event: KeyboardEvent): void => {
    if (/^(Arrow(Left|Right)|Home|End)$/.test(event.key)) this.#onCaretMove();
  };

  /** "Expand" on a pasted-text chip: the token becomes text unless the page prevented the event. */
  readonly #onTokenExpand = (event: Event): void => {
    const token = (event.target as Element | null)?.closest?.(`[${TOKEN_ID_ATTRIBUTE}]`);
    const id = token?.getAttribute(TOKEN_ID_ATTRIBUTE);
    if (!id) return;
    // After every listener ran (page listeners on the host or above run after this one).
    queueMicrotask(() => {
      if (!event.defaultPrevented) this.expandToken(id);
    });
  };

  // ------------------------------------------------------------------------------- lifecycle

  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'enterkeyhint') this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#composer.value?.registerInput(null);
    this.#composerSynced = false;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // The placeholder follows a `value` written from outside in the same render (nothing to re-render after).
    if (changed.has('value') && !this.#ime.composing) {
      const inDom = this.#editable ? this.#draft() : '';
      if (inDom !== this.value) this.isEmptyDraft = this.value === '';
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('value')) {
      this.#syncValueToDom();
      const composer = this.#composer.value;
      if (composer && composer.value !== this.value) composer.setValue(this.value);
    }
    this.#menu.afterUpdate();
  }

  override render(): TemplateResult {
    const aria = this.#menu.ariaAttributes;
    const disabled = this.#isDisabled;
    const composer = this.#composer.value;
    const placeholder =
      this.placeholder ?? composer?.placeholder ?? this.#locale.t('@tct.chat.composer.placeholder');
    const label = this.label ?? this.#locale.t('@tct.chat.composerInput.label');
    const maxRows = Number.isFinite(this.maxRows) && this.maxRows >= 1 ? this.maxRows : 8;
    return html`<div
      class="root"
      part="base"
      ?data-disabled=${disabled}
      ?data-composer=${composer !== null && composer !== undefined}
      style=${styleMap({'--_max-rows': String(maxRows)})}
    >
      ${
        this.isEmptyDraft
          ? html`<div
              class="placeholder"
              part="placeholder"
              aria-hidden="true"
              aria-disabled=${disabled ? 'true' : nothing}
            >
              ${placeholder}
            </div>`
          : nothing
      }
      <div
        class="editable focus-ring"
        part="editable"
        role=${aria.role ?? 'textbox'}
        aria-multiline=${ifDefined(aria['aria-multiline'])}
        aria-expanded=${ifDefined(aria['aria-expanded'])}
        aria-controls=${ifDefined(aria['aria-controls'])}
        aria-activedescendant=${ifDefined(aria['aria-activedescendant'])}
        aria-haspopup=${ifDefined(aria['aria-haspopup'])}
        aria-placeholder=${aria.role === 'textbox' ? placeholder : nothing}
        aria-label=${label}
        aria-disabled=${disabled ? 'true' : nothing}
        tabindex="0"
        contenteditable=${disabled ? 'false' : supportsPlaintextOnly() ? 'plaintext-only' : 'true'}
        enterkeyhint=${this.getAttribute('enterkeyhint') ?? 'send'}
        @input=${this.#onInput}
        @beforeinput=${this.#onBeforeInput}
        @keydown=${this.#onKeyDown}
        @keyup=${this.#onKeyUp}
        @click=${this.#onCaretMove}
        @paste=${this.#onPaste}
        @dragover=${this.#onDragOver}
        @drop=${this.#onDrop}
        @compositionend=${this.#onCompositionEnd}
        @blur=${this.#onBlur}
        @tct-chat-token-expand=${this.#onTokenExpand}
      ></div>
      ${this.#menu.render()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-chat-composer-input': TctChatComposerInput;
  }
}
