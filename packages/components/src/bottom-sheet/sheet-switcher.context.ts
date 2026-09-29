import {createContext} from '@tecton-wc/core/context/protocol.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import type {BottomSheetPurpose} from './bottom-sheet.types.js';

/**
 * Where a sheet is in a switcher flow (upstream `BottomSheetSwitcherPhase`).
 *
 * - `entering`: the new active sheet is sliding in above the previous one
 * - `active`: the interactive sheet
 * - `covered`: retained under the entering sheet, inert, until the handoff moves it
 * - `aligning`: retained and moving down until its top edge meets the entering sheet's
 * - `fading`: retained, fading out after both motions finished
 * - `exiting`: the last sheet leaving with the whole flow
 * - `hidden`: not presented
 */
export type SheetPhase =
  'entering' | 'active' | 'covered' | 'aligning' | 'fading' | 'exiting' | 'hidden';

/** Motions a sheet reports to its switcher when they start and finish. */
export type SheetMotion = 'entering' | 'aligning' | 'fading' | 'exiting';

/** What the switcher tells its sheets, and what they tell it (private to the bottom-sheet folder). */
export interface SheetSwitcherApi {
  /** Whether the shared dialog is modal with a scrim. */
  readonly hasScrim: boolean;
  /** A sheet joined or left the flow (connect / disconnect). */
  register(sheet: SwitcherSheet): () => void;
  /** The active sheet asks to close the flow (swipe). Returns whether the switcher accepted. */
  requestDismiss(sheet: SwitcherSheet, reason: ChangeReason): boolean;
  /** A sheet's motion started. */
  motionStart(sheet: SwitcherSheet, motion: SheetMotion): void;
  /** A sheet's motion finished. */
  motionComplete(sheet: SwitcherSheet, motion: SheetMotion): void;
  /** The active sheet's live scrim opacity while it is dragged or settled. */
  scrim(sheet: SwitcherSheet, opacity: number): void;
}

/** The part of a sheet the switcher reads. */
export interface SwitcherSheet extends HTMLElement {
  readonly sheetId: string | undefined;
  readonly label: string;
  readonly purpose: BottomSheetPurpose;
  /** Top edge (viewport px) of the sheet's positioner: where the sheet rests when fully open. */
  readonly restTop: number;
  /** Top edge (viewport px) of the sheet as drawn now, including its detent and any alignment. */
  readonly drawnTop: number;
  phase: SheetPhase;
  alignmentOffset: number;
}

/**
 * Provided by `tct-bottom-sheet-switcher` to its sheets. A sheet provides `null` to its own content, so
 * a sheet nested in a sheet is standalone unless it sits in a switcher of its own (upstream's fresh
 * ownership scope).
 */
export const sheetSwitcherContext = createContext<SheetSwitcherApi | null, symbol>(
  Symbol.for('tct.bottom-sheet-switcher'),
);
