import {html, render, type TemplateResult} from 'lit';
import {defineElement} from '@tecton-wc/core/define.js';
import type {DialogPadding, DialogPosition, DialogPurpose, DialogVariant} from './dialog.types.js';
import {TctDialog} from './tct-dialog.js';

/** What `openDialog()` shows: text, an existing node (moved into the dialog), or a Lit template. */
export type DialogContent = string | Node | TemplateResult;

/** Options of `openDialog()`: the dialog's own attributes. */
export interface OpenDialogOptions {
  heading?: string;
  subtitle?: string;
  noCloseButton?: boolean;
  width?: number | string;
  maxHeight?: number | string;
  position?: DialogPosition;
  variant?: DialogVariant;
  purpose?: DialogPurpose;
  padding?: DialogPadding;
  /** Accessible name when there is no `heading`. */
  label?: string;
}

/** The dialog `openDialog()` opened. */
export interface DialogHandle {
  /** The `tct-dialog` element. */
  readonly element: TctDialog;
  /** Whether it is still open. */
  readonly isOpen: boolean;
  /** Closes it (programmatically: no `tct-open-change`) and resolves once it settled and left the page. */
  hide(): Promise<void>;
  /** Resolves when the dialog has closed and been removed, however it was closed. */
  readonly closed: Promise<void>;
}

/**
 * Opens a dialog without markup (upstream `useImperativeDialog().show()`): renders a `tct-dialog` with the
 * given content into the page, opens it, and removes it again once it has closed. A dialog closed by the
 * user (Escape, backdrop, close button) is removed the same way. The `<dialog>` is a modal, so it needs
 * no container of its own; `options.container` only decides where its element lives in the DOM.
 *
 * ```ts
 * const dialog = openDialog(html`<p>Deleted 3 items.</p>`, {heading: 'Done', purpose: 'info'});
 * await dialog.closed;
 * ```
 */
export function openDialog(
  content: DialogContent,
  options: OpenDialogOptions & {container?: HTMLElement} = {},
): DialogHandle {
  defineElement(TctDialog);
  const {container = document.body, ...dialogOptions} = options;
  const host = document.createElement('div');
  host.style.display = 'contents';
  host.dataset.tctImperativeDialog = '';
  container.append(host);
  render(html`<tct-dialog></tct-dialog>`, host);
  const dialog = host.querySelector<TctDialog>('tct-dialog')!;
  Object.assign(dialog, {
    heading: dialogOptions.heading ?? '',
    subtitle: dialogOptions.subtitle ?? '',
    noCloseButton: dialogOptions.noCloseButton ?? false,
    ...(dialogOptions.width !== undefined && {width: dialogOptions.width}),
    ...(dialogOptions.maxHeight !== undefined && {maxHeight: dialogOptions.maxHeight}),
    ...(dialogOptions.position !== undefined && {position: dialogOptions.position}),
    ...(dialogOptions.variant !== undefined && {variant: dialogOptions.variant}),
    ...(dialogOptions.purpose !== undefined && {purpose: dialogOptions.purpose}),
    ...(dialogOptions.padding !== undefined && {padding: dialogOptions.padding}),
  });
  if (dialogOptions.label) dialog.setAttribute('aria-label', dialogOptions.label);
  if (typeof content === 'string') dialog.textContent = content;
  else if (content instanceof Node) dialog.append(content);
  else render(content, dialog);

  const closed = new Promise<void>((resolve) => {
    dialog.addEventListener('tct-after-open-change', function onSettled(event) {
      if (event.open) return;
      dialog.removeEventListener('tct-after-open-change', onSettled);
      host.remove();
      resolve();
    });
  });
  void dialog.show();
  return {
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
}
