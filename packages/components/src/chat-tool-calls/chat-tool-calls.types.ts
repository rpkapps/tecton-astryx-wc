import type {TemplateResult} from 'lit';

/** Lifecycle of one tool call (upstream `ChatToolCallStatus`). */
export const CHAT_TOOL_CALL_STATUSES = ['pending', 'running', 'complete', 'error'] as const;
export type ChatToolCallStatus = (typeof CHAT_TOOL_CALL_STATUSES)[number];

/** Content a caller supplies for a call: a Lit template, a DOM node, or text (a string is never HTML). */
export type ChatToolCallContent = TemplateResult | Node | string;

/** One tool call, in the shape LLM APIs already return (upstream `ChatToolCallItem`). */
export interface ChatToolCallItem {
  /** Tool or function name. */
  name: string;
  /** Current execution status. Default `complete`. */
  status?: ChatToolCallStatus;
  /** What the call acted on: a file, a command, a search query. */
  target?: string;
  /** Duration text such as `1.2s`; shown when the call is complete. */
  duration?: string;
  /** Sandbox or node name, shown as a neutral badge. */
  node?: string;
  /** Lines or characters added; shown as `+12` in the success ink. */
  additions?: number;
  /** Lines or characters removed; shown as `-3` in the error ink. */
  deletions?: number;
  /** Extra information after the label. */
  stats?: ChatToolCallContent;
  /**
   * Error message for `status: 'error'`: exposed as hidden text in the row for assistive technology,
   * echoed as a native tooltip on the status icon, and announced once when the call fails.
   */
  errorMessage?: string;
  /** Stable identity of the call while it streams; keeps an open detail open when the row updates. */
  key?: string;
  /** Arbitrary caller data kept with the call. */
  data?: unknown;
  /** Inline detail (a diff, command output) shown when the row is expanded. Makes the row a disclosure. */
  resultDetail?: ChatToolCallContent;
}
