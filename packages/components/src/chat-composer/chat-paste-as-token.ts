/**
 * `ChatPasteAsTokenController`: turns a long paste into one token chip instead of a wall of text in the
 * draft (upstream `useChatPasteAsToken`). The composer input has one by default (threshold 200
 * characters, a neutral badge that says how many lines and characters it holds, with a hover card that
 * previews the text and offers Expand); pass your own to change either, or `false` to turn it off.
 *
 * ```ts
 * input.pasteAsToken = new ChatPasteAsTokenController({
 *   input: () => input,
 *   threshold: 500,
 *   toToken: (text) => ({value: text, label: `Pasted ${text.length} characters`, variant: 'info'}),
 * });
 * input.pasteAsToken = false; // paste always inserts the text
 * ```
 *
 * It is stateless (no host, no lifecycle): the input calls {@link ChatPasteAsTokenController.handlePaste}
 * with the plain text of each paste, and it answers whether it handled it.
 */
import type {ChatComposerInputHandle, ChatComposerToken} from './chat-composer.types.js';

/** The default threshold: pastes longer than this many characters become a token. */
export const DEFAULT_PASTE_TOKEN_THRESHOLD = 200;

export interface ChatPasteAsTokenOptions {
  /** The input to insert the token into (read on every paste). */
  input: () => ChatComposerInputHandle | null | undefined;
  /** Pastes longer than this many characters become tokens. Default 200. */
  threshold?: number;
  /** Builds the token for a pasted text. Default: a neutral badge labelled with the line and character counts. */
  toToken?: (text: string) => ChatComposerToken;
}

export class ChatPasteAsTokenController {
  /** The options; read on every paste, so `threshold` and `toToken` may be changed at any time. */
  readonly options: ChatPasteAsTokenOptions;

  constructor(options: ChatPasteAsTokenOptions) {
    this.options = options;
  }

  /** The current threshold in characters. */
  get threshold(): number {
    return this.options.threshold ?? DEFAULT_PASTE_TOKEN_THRESHOLD;
  }

  /**
   * Handles one paste: a text longer than the threshold is inserted as a token and the call returns `true`;
   * shorter text returns `false` and the input inserts it as text.
   */
  handlePaste(text: string): boolean {
    if (text.length <= this.threshold) return false;
    const input = this.options.input();
    if (!input) return false;
    const token = this.options.toToken ? this.options.toToken(text) : defaultToken(text);
    input.insertToken(token);
    return true;
  }
}

/**
 * The default token: the text itself as the value, a neutral badge as the chip. The label is plain
 * counts, replaced by the localised phrase when the token element renders (the element derives it from the
 * value), so this stays language neutral.
 */
function defaultToken(text: string): ChatComposerToken {
  return {value: text, variant: 'neutral'};
}
