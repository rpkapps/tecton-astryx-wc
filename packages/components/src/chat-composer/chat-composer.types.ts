import type {TemplateResult} from 'lit';
import type {
  ChatDensity,
  ChatToken,
  ChatTokenBadge,
  ChatTokenCustom,
} from '../chat-message/chat-message.types.js';

/** Spacing and padding of the composer (upstream `ChatComposerDensity`); the message components share it. */
export type ChatComposerDensity = ChatDensity;

/** Resting elevation of the composer body: raised (`low`, default) or flat with a border (`none`). */
export const CHAT_COMPOSER_ELEVATIONS = ['none', 'low'] as const;
export type ChatComposerElevation = (typeof CHAT_COMPOSER_ELEVATIONS)[number];

/** Severity of the strip under (or over) the composer body. */
export const CHAT_COMPOSER_STATUS_TYPES = ['error', 'warning'] as const;
export type ChatComposerStatusType = (typeof CHAT_COMPOSER_STATUS_TYPES)[number];

/** Which side of the composer body the status strip sits on. */
export const CHAT_COMPOSER_STATUS_POSITIONS = ['top', 'bottom'] as const;
export type ChatComposerStatusPosition = (typeof CHAT_COMPOSER_STATUS_POSITIONS)[number];

/** Size of the send and dictation buttons (`md` matches the 32px footer row). */
export const CHAT_COMPOSER_BUTTON_SIZES = ['sm', 'md'] as const;
export type ChatComposerButtonSize = (typeof CHAT_COMPOSER_BUTTON_SIZES)[number];

/** A structured token: a badge. Structurally the upstream `ChatComposerTokenBadge`. */
export type ChatComposerTokenBadge = ChatTokenBadge;
/** A custom token: `render` returns what to show. Structurally the upstream `ChatComposerTokenCustom`. */
export type ChatComposerTokenCustom = ChatTokenCustom;
/**
 * An inline token in the draft. `value` is what it becomes in the submitted string; a badge token
 * (`{value, label?, variant?, icon?}`) shows a badge, a custom token (`{value, render}`) shows whatever
 * `render()` returns. The same shape `tct-chat-tokenized-text` uses to show a sent message.
 */
export type ChatComposerToken = ChatToken;

/** One suggestion of a trigger menu. Structurally the upstream `SearchableItem`. */
export interface ChatComposerSearchItem<TAuxiliary = unknown> {
  /** Unique id of the item. */
  id: string;
  /** Text shown for the item (and its option name). */
  label: string;
  /** Extra data. `auxiliaryData.group` (a string) groups the items under a heading. */
  auxiliaryData?: TAuxiliary;
}

/**
 * Where a trigger menu gets its items. Structurally the upstream `SearchSource`: `search` may be
 * synchronous or asynchronous, `cancel` aborts an in-flight search. `bootstrap` is accepted (it is part
 * of the shared shape) and unused by the composer.
 */
export interface ChatComposerSearchSource<T extends ChatComposerSearchItem = ChatComposerSearchItem> {
  search(query: string): Promise<T[]> | T[];
  bootstrap?(): Promise<T[]> | T[];
  cancel?(): void;
}

/** A trigger character that opens a suggestion menu (`@` mentions, `/` commands). */
export interface ChatComposerTrigger {
  /** The character that opens the menu; it must start a word (after a space, a new line or the start). */
  character: string;
  /** Provides the suggestions for the text typed after the character. */
  searchSource: ChatComposerSearchSource;
  /** Renders one item in the menu. Default: its `label`. A string is text, never HTML. */
  renderItem?: (item: ChatComposerSearchItem) => TemplateResult | Node | string;
  /** What choosing an item inserts: a string (plain text) or a token (an inline chip). */
  onSelect: (item: ChatComposerSearchItem) => string | ChatComposerToken;
  /**
   * Turns one whitespace-delimited word of a `value` written from outside back into a token (for
   * editing a stored message). Return `null` for words that are not tokens.
   */
  deserialize?: (value: string) => ChatComposerToken | null;
  /** Text when nothing matched. Default: the localised "No results". */
  emptySearchResultsText?: string;
  /** Text while an asynchronous search runs. Default: the localised "Searching…". */
  loadingText?: string;
  /** Accessible name of the menu. Default: the localised "Suggestions". */
  menuLabel?: string;
}

/**
 * The editing surface a composer helper drives (upstream `ChatComposerInputHandle`): the
 * `tct-chat-composer-input` element implements it.
 */
export interface ChatComposerInputHandle {
  /** Inserts a token at the caret; returns its id. */
  insertToken(token: ChatComposerToken): string | undefined;
  /** Replaces the token with the given id by its serialized text. */
  expandToken(id: string): void;
  /** Inserts plain text at the caret. */
  insertText(text: string): void;
  /** Focuses the input, keeping a caret it already had. */
  focus(options?: FocusOptions): void;
  /** The current serialized draft. */
  getValue(): string;
  /** Shows the phrase being dictated as ghost text at the end of the draft (not part of the value). */
  setInterimText?(text: string): void;
  /** Removes the ghost text. */
  clearInterimText?(): void;
}

/** What a custom input registers with the composer shell so a click on the shell's empty space can focus it. */
export interface ChatComposerInputControl {
  /** Moves keyboard focus into the input. */
  focus(): void;
}
