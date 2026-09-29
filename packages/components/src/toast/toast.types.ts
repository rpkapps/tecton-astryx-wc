import type {TemplateResult} from 'lit';
import type {ToastDismissReason} from '@tecton-astryx/core/events/tct-toast-dismiss.js';

export type {ToastDismissReason};

export const TOAST_TYPES = ['info', 'error'] as const;
export const TOAST_POSITIONS = ['top-end', 'top-start', 'bottom-end', 'bottom-start'] as const;
export const TOAST_COLLISION_BEHAVIORS = ['overwrite', 'ignore'] as const;
export const TOAST_SWIPE_EDGES = ['end', 'start'] as const;

/** Toast status. `error` uses the error fill, is announced assertively and does not auto-hide by default. */
export type ToastType = (typeof TOAST_TYPES)[number];
/** Where the toast stack sits; `start` and `end` are logical (they mirror in RTL). */
export type ToastPosition = (typeof TOAST_POSITIONS)[number];
/** What happens when a toast with the same `uniqueId` already exists. */
export type ToastCollisionBehavior = (typeof TOAST_COLLISION_BEHAVIORS)[number];
/** The block edge a toast is swiped towards to dismiss it. */
export type ToastSwipeEdge = (typeof TOAST_SWIPE_EDGES)[number];

/** Content of a toast: text (never HTML), a DOM node, or a Lit template. */
export type ToastContent = string | number | Node | TemplateResult;

/** Values handed to a custom content renderer (`renderContent`). */
export interface ToastContentRenderProps {
  /** Primary message content, as passed to `toast()`. */
  body: ToastContent | undefined;
  /** Trailing content, as passed to `toast()`. Place it in your layout. */
  endContent: ToastContent | undefined;
  /** Resolved toast type. `error` also makes the announcement assertive. */
  type: ToastType;
  /** Whether this toast will dismiss itself. */
  autoHide: boolean;
  /** Milliseconds until auto-dismiss, when `autoHide`. */
  autoHideDuration: number;
  /** Dismisses this toast with reason `manual`. Call it from the control that should close the toast. */
  dismiss: () => void;
}

/** Renders the content of one toast inside the card. The renderer owns every control in it. */
export type ToastContentRenderFn = (toast: ToastContentRenderProps) => ToastContent;

/** Options of `toast()` (upstream `ToastOptions`). */
export interface ToastOptions {
  /** Primary message content. */
  body: ToastContent;
  /** Toast type controlling colour. Default `info`. */
  type?: ToastType;
  /** Whether the toast dismisses itself. Default `true` for `info`, `false` for `error`. */
  autoHide?: boolean;
  /** Milliseconds before auto-dismiss. Default 5000. */
  autoHideDuration?: number;
  /** Content at the trailing end (an Undo button, a link). */
  endContent?: ToastContent;
  /** Replaces the layout of this toast's card; the card, live semantics and auto-hide stay. */
  renderContent?: ToastContentRenderFn;
  /** Identifier for deduplication. */
  uniqueId?: string;
  /** What to do when a toast with the same `uniqueId` exists. Default `overwrite`. */
  collisionBehavior?: ToastCollisionBehavior;
  /** Called once when the toast starts to hide. */
  onHide?: (reason: ToastDismissReason) => void;
}

/** Dismisses a toast (with reason `manual`); returned by `toast()`. */
export type ToastDismissFn = () => void;

/** Inset of the stack from the viewport edges, in px. */
export interface ToastInset {
  top?: number;
  bottom?: number;
  start?: number;
  end?: number;
}

/** Toast configuration of a `tct-layer-provider` (upstream `LayerToastConfig`). */
export interface LayerToastConfig {
  /** Position of the stack. Default `bottom-end`. */
  position?: ToastPosition;
  /** Maximum visible toasts. Default 5. */
  maxVisible?: number;
  /** Inset from the viewport edges. */
  inset?: ToastInset;
}
