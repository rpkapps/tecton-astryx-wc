import {createContext} from '@tecton-wc/core/context/protocol.js';
import type {ChatComposerInputControl} from './chat-composer.types.js';

/**
 * What `tct-chat-composer` shares with the input, the send button and any custom input inside it
 * (upstream `ChatComposerContextValue`; `useChatComposerContext` is a `ContextConsumer` of
 * {@link chatComposerContext}). It is public composition API: a custom input reads and writes the draft
 * through it and registers how the shell can focus it.
 *
 * ```ts
 * #composer = new ContextConsumer(this, {context: chatComposerContext, subscribe: true});
 * // read:    this.#composer.value?.value, .placeholder, .disabled
 * // write:   this.#composer.value?.setValue(text)
 * // submit:  this.#composer.value?.submit(text)
 * ```
 */
export interface ChatComposerContextValue {
  /** The draft. */
  value: string;
  /** Publishes a new draft (upstream `onChange`). Sets the composer's `value`; emits nothing. */
  setValue(value: string): void;
  /**
   * Submits `value` (upstream `onSubmit`): trims it, ignores an empty draft or a disabled composer,
   * fires the cancelable `tct-chat-submit`, and clears the draft unless the event was prevented.
   * Returns whether the draft was accepted (and cleared).
   */
  submit(value: string): boolean;
  /** Placeholder text (the composer's `placeholder`, else the localised default). */
  placeholder: string;
  /** Whether the composer is disabled. */
  disabled: boolean;
  /** Whether the send button shows Stop. */
  stopShown: boolean;
  /** Whether there is something to send: a non-blank draft in an enabled composer. */
  canSend: boolean;
  /**
   * A custom input registers its focus control here on connect and withdraws it (`null`) on
   * disconnect, so a click on the shell's empty space can focus it (upstream `inputControlRef`).
   */
  registerInput(control: ChatComposerInputControl | null): void;
}

export const chatComposerContext = createContext<ChatComposerContextValue | null, symbol>(
  Symbol.for('tct.chat-composer'),
);
