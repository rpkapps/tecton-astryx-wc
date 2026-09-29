import {html, render} from 'lit';
import {defineElement} from '@tecton-astryx/core/define.js';
import type {ButtonVariant} from '../button/button.types.js';
import {TctAlertDialog} from './tct-alert-dialog.js';

/** The dialog `openAlertDialog()` opened. */
export interface AlertDialogHandle {
  /** The `tct-alert-dialog` element. */
  readonly element: TctAlertDialog;
  /** Whether it is still open. */
  readonly isOpen: boolean;
  /** Closes it (programmatically: no `tct-open-change`) and resolves once it settled and left the page. */
  readonly hide: () => Promise<void>;
  /** Resolves when the dialog has closed and been removed, however it was closed. */
  readonly closed: Promise<void>;
}

/** Options of `openAlertDialog()`: the element's own attributes, plus the action callback. */
export interface OpenAlertDialogOptions {
  /** The question; it names the dialog. (Upstream `title`.) */
  heading: string;
  /** What will happen if the user confirms. */
  description: string;
  /** Label of the action button. */
  actionLabel: string;
  cancelLabel?: string;
  /** Default `destructive`. */
  actionVariant?: ButtonVariant;
  /** Shows the spinner on the action button from the start. */
  actionLoading?: boolean;
  /** Preferred width (number = px, string = CSS length). Default 400. */
  width?: number | string;
  /**
   * Called when the action is activated, with the handle. The dialog does not close on its own: call
   * `handle.hide()` when the work is done. While a returned promise is pending the action button shows its
   * spinner and blocks; if it rejects the dialog stays open and the button is available again.
   */
  onAction?: (handle: AlertDialogHandle) => unknown;
  /** Called when the user cancels (Escape or the Cancel button) and the dialog is about to close. */
  onCancel?: (handle: AlertDialogHandle) => void;
  /** Where the element lives in the DOM (default `document.body`). The dialog itself is a modal in the top layer. */
  container?: HTMLElement;
}

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof (value as {then?: unknown} | null | undefined)?.then === 'function';

/**
 * Opens an alert dialog without markup (upstream `useImperativeAlertDialog().show()`): renders a
 * `tct-alert-dialog` into the page, opens it, and removes it again once it has closed.
 *
 * ```ts
 * openAlertDialog({
 *   heading: 'Delete item?',
 *   description: 'This action cannot be undone.',
 *   actionLabel: 'Delete',
 *   onAction: async ({hide}) => { await deleteItem(); await hide(); },
 * });
 * ```
 */
export function openAlertDialog(options: OpenAlertDialogOptions): AlertDialogHandle {
  defineElement(TctAlertDialog);
  const {container = document.body, onAction, onCancel, ...attributes} = options;
  const host = document.createElement('div');
  host.style.display = 'contents';
  host.dataset.tctImperativeAlertDialog = '';
  container.append(host);
  render(html`<tct-alert-dialog></tct-alert-dialog>`, host);
  const dialog = host.querySelector<TctAlertDialog>('tct-alert-dialog')!;
  Object.assign(dialog, {
    heading: attributes.heading,
    description: attributes.description,
    actionLabel: attributes.actionLabel,
    ...(attributes.cancelLabel !== undefined && {cancelLabel: attributes.cancelLabel}),
    ...(attributes.actionVariant !== undefined && {actionVariant: attributes.actionVariant}),
    ...(attributes.actionLoading !== undefined && {actionLoading: attributes.actionLoading}),
    ...(attributes.width !== undefined && {width: attributes.width}),
  });

  const closed = new Promise<void>((resolve) => {
    dialog.addEventListener('tct-after-open-change', function onSettled(event) {
      if (event.target !== dialog || event.open) return;
      dialog.removeEventListener('tct-after-open-change', onSettled);
      host.remove();
      resolve();
    });
  });
  const handle: AlertDialogHandle = {
    element: dialog,
    get isOpen() {
      return dialog.open;
    },
    hide: async () => {
      await dialog.hide();
      await closed;
    },
    closed,
  };
  dialog.addEventListener('tct-action', () => {
    const result = onAction?.(handle);
    if (!isThenable(result)) return;
    dialog.actionLoading = true;
    const settle = (): void => {
      dialog.actionLoading = false;
    };
    // A rejection is the caller's to handle; it is still reported, not swallowed.
    void Promise.resolve(result).then(settle, (error: unknown) => {
      settle();
      throw error;
    });
  });
  dialog.addEventListener('tct-open-change', (event) => {
    if (event.target === dialog && !event.open && !event.defaultPrevented) onCancel?.(handle);
  });
  void dialog.show();
  return handle;
}
