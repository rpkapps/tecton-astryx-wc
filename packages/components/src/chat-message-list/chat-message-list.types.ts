/**
 * Where a short list rests inside a taller container: `bottom` (default) pushes the messages down to
 * the composer, `top` starts them at the top.
 */
export const CHAT_LIST_ALIGNMENTS = ['top', 'bottom'] as const;
export type ChatListAlignment = (typeof CHAT_LIST_ALIGNMENTS)[number];

/** `spring` follows with an eased animation, `instant` jumps in one frame (upstream `behavior`). */
export type ChatScrollBehavior = 'instant' | 'spring';

/** What `ChatStreamScrollController.scrollToBottom()` accepts. */
export interface ChatScrollToBottomOptions {
  /**
   * `instant` jumps to the bottom in one frame; use it for programmatic positioning (opening a
   * conversation, restoring a session). `spring` (default) animates; use it for a user-initiated
   * scroll such as the scroll button. Under `prefers-reduced-motion` a spring also jumps.
   */
  behavior?: ChatScrollBehavior;
}
