/**
 * `ChatComposerTokensController`: inline token chips inside the composer's editable surface (upstream
 * `useChatComposerTokens`).
 *
 * A token is a `tct-chat-composer-token-element` with `contenteditable="false"`, so the caret steps over
 * it and a selection can include it, followed by one non-breaking space that gives the caret a place
 * after it (a caret cannot rest after an atomic inline at the end of a line without following text). The
 * pair is one **unit**:
 *
 * - Backspace and Delete remove the whole unit at once, and the character after it never lingers. The
 *   engines disagree about deleting an atomic inline (Chromium's `plaintext-only` surface does not delete
 *   it at all), so the deletion is decided here, in `beforeinput`, for every deleting input type (Backspace,
 *   Delete, word and line deletions, the soft keyboard's delete). A range selection is left to the
 *   browser, which removes whole tokens inside it.
 * - Insertion, expansion (a token dissolves into its text) and removal publish through `onChange`, so the
 *   owner emits one `input` event per change.
 * - The token elements are created from a Lit template (never `createElement`), so they belong to the
 *   registry the input lives in.
 *
 * Screen readers: each token element names itself (`role="img"` with its label as name), so the
 * accessible draft reads "hello, Ada Lovelace, welcome".
 *
 * Guides: [mwg:accessible-web-components] (semantics on the token host through ElementInternals).
 */
import {html, render} from 'lit';
import type {ReactiveController} from 'lit';
import {uniqueId} from '@tecton-wc/core/utils/id.js';
import {
  ensureCaretInside,
  getSelectionRange,
  restoreSelectionRange,
} from './chat-composer.selection.js';
import type {ChatComposerToken} from './chat-composer.types.js';

/** Marker attributes of a token element inside the editable. */
export const TOKEN_ATTRIBUTE = 'data-tct-token';
export const TOKEN_VALUE_ATTRIBUTE = 'data-tct-token-value';
export const TOKEN_ID_ATTRIBUTE = 'data-tct-token-id';

const NBSP = ' ';

const isToken = (node: Node | null | undefined): node is HTMLElement =>
  node instanceof HTMLElement && node.hasAttribute(TOKEN_ATTRIBUTE);

/** The token element that `node` is or sits inside, else `null`. */
export function closestToken(node: Node | null): HTMLElement | null {
  for (let current = node; current; current = current.parentNode) {
    if (isToken(current)) return current;
  }
  return null;
}

/** Skips empty text nodes: the previous/next sibling that carries content. */
function contentSibling(node: Node, direction: 'previous' | 'next'): Node | null {
  let sibling = direction === 'previous' ? node.previousSibling : node.nextSibling;
  while (sibling?.nodeType === Node.TEXT_NODE && sibling.nodeValue === '') {
    sibling = direction === 'previous' ? sibling.previousSibling : sibling.nextSibling;
  }
  return sibling;
}

export interface ChatComposerTokensOptions {
  /** The editable surface; read on use (it may not exist before the first render). */
  editable: () => HTMLElement | null;
  /** Publishes a change made here (token inserted, removed or expanded); `inputType` is the `input` type. */
  onChange: (inputType: string) => void;
  /** Whether a token's value is long enough to be an expandable pasted-text chip. */
  isExpandable?: (token: ChatComposerToken) => boolean;
}

export class ChatComposerTokensController implements ReactiveController {
  readonly #options: ChatComposerTokensOptions;
  readonly #tokens = new Map<string, {element: HTMLElement; token: ChatComposerToken}>();

  constructor(options: ChatComposerTokensOptions) {
    this.#options = options;
  }

  hostDisconnected(): void {
    this.#tokens.clear();
  }

  /** The tokens currently in the draft, in no particular order. */
  get tokens(): readonly {id: string; token: ChatComposerToken; element: HTMLElement}[] {
    this.prune();
    return [...this.#tokens].map(([id, entry]) => ({id, ...entry}));
  }

  /**
   * Builds a token element for `token` without inserting it (used by insertion and by writing a
   * `value` with tokens in it). Returns the element and its id.
   */
  create(token: ChatComposerToken): {id: string; element: HTMLElement} {
    const id = uniqueId('tct-chat-token');
    const holder = document.createDocumentFragment();
    const expandable = this.#options.isExpandable?.(token) ?? false;
    render(
      html`<tct-chat-composer-token-element
        contenteditable="false"
        data-tct-token
        data-tct-token-value=${token.value}
        data-tct-token-id=${id}
        .token=${token}
        ?expandable=${expandable}
      ></tct-chat-composer-token-element>`,
      holder,
    );
    const element = holder.firstElementChild as HTMLElement;
    this.#tokens.set(id, {element, token});
    return {id, element};
  }

  /** Inserts a token at the caret (replacing a selection) with the caret after it; returns its id. */
  insertToken(token: ChatComposerToken): string | undefined {
    const editable = this.#options.editable();
    if (!editable) return undefined;
    const range = ensureCaretInside(editable);
    range.deleteContents();
    const {id, element} = this.create(token);
    range.insertNode(element);
    // The space that gives the caret a place after the token; serialised as an ordinary space.
    const space = document.createTextNode(NBSP);
    element.after(space);
    range.setStart(space, 1);
    range.collapse(true);
    restoreSelectionRange(range);
    this.#options.onChange('insertText');
    return id;
  }

  /** Replaces the token with its serialized text and puts the caret after that text. */
  expandToken(id: string): void {
    const entry = this.#tokens.get(id);
    const editable = this.#options.editable();
    if (!entry || !editable?.contains(entry.element)) return;
    const {element} = entry;
    const text = document.createTextNode(element.getAttribute(TOKEN_VALUE_ATTRIBUTE) ?? '');
    this.#dropSpaceAfter(element);
    element.replaceWith(text);
    const range = document.createRange();
    range.setStartAfter(text);
    range.collapse(true);
    restoreSelectionRange(range);
    this.#tokens.delete(id);
    this.#options.onChange('insertText');
  }

  /**
   * Handles a deleting `beforeinput` next to a token: removes the unit and prevents the native edit.
   * Returns whether it did. Composition, and any deletion of a range selection, are the browser's.
   */
  handleBeforeInput(event: InputEvent): boolean {
    const backward = /^delete(Content|Word|SoftLine|HardLine|Entire\w*)?Backward$/.test(
      event.inputType,
    );
    const forward = /^delete(Content|Word|SoftLine|HardLine|Entire\w*)?Forward$/.test(
      event.inputType,
    );
    if ((!backward && !forward) || event.isComposing) return false;
    const editable = this.#options.editable();
    if (!editable) return false;
    const range = getSelectionRange(editable);
    if (!range?.collapsed) return false;
    const token = backward ? this.#tokenBefore(range, editable) : this.#tokenAfter(range, editable);
    if (!token) return false;
    event.preventDefault();
    this.#remove(token);
    this.#options.onChange(event.inputType);
    return true;
  }

  /** Forgets tokens that are no longer in the draft. */
  prune(): void {
    const editable = this.#options.editable();
    for (const [id, {element}] of this.#tokens) {
      if (!editable?.contains(element)) this.#tokens.delete(id);
    }
  }

  // -------------------------------------------------------------------------------- internals

  /** The token directly before the caret, counting its trailing space as part of it. */
  #tokenBefore(range: Range, editable: HTMLElement): HTMLElement | null {
    let node: Node = range.startContainer;
    let offset = range.startOffset;
    if (node.nodeType !== Node.TEXT_NODE) {
      if (node !== editable && !editable.contains(node)) return null;
      let candidate: Node | null = node.childNodes[offset - 1] ?? null;
      if (candidate?.nodeType === Node.TEXT_NODE && candidate.nodeValue === '') {
        candidate = contentSibling(candidate, 'previous');
      }
      if (isToken(candidate)) return candidate;
      // A caret between two nodes rests at the end of the text before it.
      if (candidate?.nodeType !== Node.TEXT_NODE) return null;
      node = candidate;
      offset = node.nodeValue?.length ?? 0;
    }
    const data = node.nodeValue ?? '';
    const previous = contentSibling(node, 'previous');
    if (!isToken(previous)) return null;
    // Caret at the start of the text after the token, or just after that text's leading space.
    return offset === 0 || (offset === 1 && data.startsWith(NBSP)) ? previous : null;
  }

  /** The token directly after the caret. */
  #tokenAfter(range: Range, editable: HTMLElement): HTMLElement | null {
    const {startContainer: node, startOffset: offset} = range;
    if (node.nodeType === Node.TEXT_NODE) {
      if (offset !== (node.nodeValue?.length ?? 0)) return null;
      const next = contentSibling(node, 'next');
      return isToken(next) ? next : null;
    }
    if (node === editable || editable.contains(node)) {
      const candidate = node.childNodes[offset] ?? null;
      const after =
        candidate?.nodeType === Node.TEXT_NODE && candidate.nodeValue === ''
          ? contentSibling(candidate, 'next')
          : candidate;
      return isToken(after) ? after : null;
    }
    return null;
  }

  /** Removes a token and the space that follows it; the caret lands where the token was. */
  #remove(token: HTMLElement): void {
    const id = token.getAttribute(TOKEN_ID_ATTRIBUTE);
    const parent = token.parentNode;
    if (!parent) return;
    const remaining = this.#dropSpaceAfter(token);
    const range = document.createRange();
    if (remaining) {
      range.setStart(remaining, 0);
    } else {
      range.setStart(parent, [...parent.childNodes].indexOf(token));
    }
    range.collapse(true);
    // A live range: removing the token at the range's own offset leaves the boundary where it was.
    token.remove();
    restoreSelectionRange(range);
    if (id) this.#tokens.delete(id);
  }

  /**
   * Deletes the space that belongs to a token (the first character of the text node after it, when it is
   * a non-breaking space). Returns the remaining text node, or `null` when nothing is left of it.
   */
  #dropSpaceAfter(token: HTMLElement): Text | null {
    const next = token.nextSibling;
    if (next?.nodeType !== Node.TEXT_NODE) return null;
    const text = next as Text;
    if (!text.data.startsWith(NBSP)) return text;
    text.deleteData(0, 1);
    if (text.data === '') {
      text.remove();
      return null;
    }
    return text;
  }
}
