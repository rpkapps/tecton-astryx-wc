/**
 * Family-private context between `tct-dialog` and the `tct-dialog-header` inside it (upstream
 * `DialogContext`). The header registers so the dialog can name itself after its heading, and asks the
 * dialog to close from its close button; the dialog tells the header whether it is inline and what its
 * purpose is (a `required` dialog has no close button).
 */
import {createContext} from '@tecton-wc/core/context/protocol.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import type {DialogPurpose} from './dialog.types.js';

/** The part of a header the dialog needs. */
export interface DialogHeaderLike extends HTMLElement {
  /** The heading element that names the dialog (`null` until it exists). */
  readonly headingElement: HTMLElement | null;
}

export interface DialogContextValue {
  /** Rendered inline for documentation previews: no modal, no autofocus. */
  readonly inline: boolean;
  readonly purpose: DialogPurpose;
  register(header: DialogHeaderLike): void;
  unregister(header: DialogHeaderLike): void;
  /** Asks the dialog to close (a cancelable `tct-open-change` first). */
  requestClose(reason: ChangeReason): void;
}

export const dialogContext = createContext<DialogContextValue | null, symbol>(
  Symbol.for('tct.dialog'),
);
