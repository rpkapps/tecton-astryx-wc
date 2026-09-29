import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {
  LayerController,
  type EscapeBehavior,
  type LayerOptions,
} from '@tecton-wc/core/layer/layer-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import base from '../styles/base.styles.css';
import type {BottomSheetPurpose} from './bottom-sheet.types.js';
import {
  sheetSwitcherContext,
  type SheetMotion,
  type SheetPhase,
  type SheetSwitcherApi,
  type SwitcherSheet,
} from './sheet-switcher.context.js';
import dialogStyles from './sheet-dialog.styles.css';

/** Below this many px of difference the retained sheet does not move to align with the entering one. */
export const ALIGNMENT_THRESHOLD_PX = 1;

type RetainedPhase = 'covered' | 'aligning' | 'fading' | 'exiting';

/** The handoff between two sheets (upstream `SheetTransitionState`). */
export interface SheetTransition {
  enteringSheet: string | null;
  retainedSheet: string | null;
  retainedPhase: RetainedPhase | null;
  alignmentOffset: number;
  isAlignmentComplete: boolean;
}

export const IDLE_TRANSITION: SheetTransition = {
  enteringSheet: null,
  retainedSheet: null,
  retainedPhase: null,
  alignmentOffset: 0,
  isAlignmentComplete: false,
};

/** The transition an `active-sheet` change starts. */
export function transitionForActiveSheetChange(
  previous: string | null,
  next: string | null,
): SheetTransition {
  if (previous == null) return IDLE_TRANSITION;
  if (next == null) {
    return {
      enteringSheet: null,
      retainedSheet: previous,
      retainedPhase: 'exiting',
      alignmentOffset: 0,
      isAlignmentComplete: false,
    };
  }
  return {
    enteringSheet: next,
    retainedSheet: previous,
    retainedPhase: 'covered',
    alignmentOffset: 0,
    isAlignmentComplete: false,
  };
}

/** Where a sheet is for a given active sheet and transition. */
export function phaseForSheet(
  sheetId: string | undefined,
  active: string | null,
  transition: SheetTransition,
): SheetPhase {
  if (sheetId === undefined || sheetId === '') return 'hidden';
  if (sheetId === active) return sheetId === transition.enteringSheet ? 'entering' : 'active';
  if (sheetId === transition.retainedSheet) return transition.retainedPhase ?? 'hidden';
  return 'hidden';
}

/**
 * Coordinates a set of `tct-bottom-sheet` children so zero or one is active at a time inside one
 * shared native dialog. During a handoff the new sheet enters above the previous one; if it is
 * shorter, the previous sheet moves down at the same time until their top edges align, otherwise it
 * stays put. The previous sheet fades only after both motions are over.
 *
 * All the sheets render as panels inside one switcher-owned `<dialog>`: a scrim flow calls
 * `showModal()` once and keeps that top-layer dialog open across every handoff (one modal boundary,
 * one backdrop); a `no-scrim` flow calls `show()` on the same shell. Set `active-sheet` to a child's
 * `sheet-id` to show it, `null` (no attribute) to close the flow. A dismissal (Escape, a scrim press,
 * a swipe) raises the cancelable `tct-open-change` with `open: false`, then sets `active-sheet` to null.
 *
 * @summary Shows one of several bottom sheets at a time inside one shared dialog, with a handoff between them.
 * @tag tct-bottom-sheet-switcher
 * @upstream BottomSheetSwitcher
 * @slot - The `tct-bottom-sheet` panels, each with a unique `sheet-id`.
 * @csspart dialog - The shared native dialog shell.
 * @cssstate open - A sheet is showing (or leaving).
 * @fires {TctOpenChangeEvent} tct-open-change - Before Escape, a scrim press or a swipe closes the flow (`open` is false); cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After the shared dialog opened or closed (entry animation done, or hidden).
 * @cloakDisplay contents
 */
export class TctBottomSheetSwitcher extends TctElement {
  static override readonly tagName = 'tct-bottom-sheet-switcher';
  static override styles: CSSResultGroup = [base, dialogStyles];

  /** `sheet-id` of the interactive sheet, or none (no attribute, `null`) to close the flow. */
  @property({attribute: 'active-sheet', reflect: true}) activeSheet: string | null = null;
  /** Opens the shared dialog without a scrim: non-modal, and the page behind stays interactive. Set before opening. */
  @property({type: Boolean, attribute: 'no-scrim'}) noScrim = false;
  /** Accessible label of the shared dialog. Default: the label of the showing sheet. */
  @property() label: string | undefined;

  /** Whether a sheet is showing (or leaving): the shared dialog is open. */
  get open(): boolean {
    return this.#layer.isOpen;
  }

  /** Asks to close the flow as the user would: fires the cancelable `tct-open-change` and honours a cancel. */
  requestClose(reason: ChangeReason = 'request'): void {
    if (this.activeSheet == null) return;
    this.#request(reason);
  }

  // -------------------------------------------------------------------------------- internals

  readonly #sheets = new Set<SwitcherSheet>();
  #transition: SheetTransition = IDLE_TRANSITION;
  #committed: string | null = null;
  #previousFocus: Element | null = null;
  #settled: Promise<void> = Promise.resolve();

  readonly #api: SheetSwitcherApi;

  readonly #layerOptions: LayerOptions = {
    kind: 'modal',
    surface: () => this.#dialog,
    // While the last sheet leaves (`active-sheet` is already null) the flow takes no part in Escape or
    // outside presses: they belong to the layer below.
    escape: (): EscapeBehavior =>
      this.activeSheet == null ? 'none' : this.#activePurpose === 'required' ? 'block' : 'close',
    outsidePress: () => this.activeSheet != null && this.#activePurpose === 'info' && !this.noScrim,
    // The sheets focus their own panel once they render; a non-modal flow must not take focus.
    initialFocus: () => this.#initialFocusTarget(),
    onDismissRequest: (reason) => {
      this.#request(reason);
    },
    onNativeClose: () => {
      this.activeSheet = null;
    },
  };

  readonly #layer: LayerController = new LayerController(this, this.#layerOptions);

  constructor() {
    super();
    const hasScrim = (): boolean => !this.noScrim;
    this.#api = {
      get hasScrim(): boolean {
        return hasScrim();
      },
      register: (sheet) => this.#register(sheet),
      requestDismiss: (sheet, reason) => this.#requestFromSheet(sheet, reason),
      motionStart: (sheet, motion) => {
        this.#onMotionStart(sheet, motion);
      },
      motionComplete: (sheet, motion) => {
        this.#onMotionComplete(sheet, motion);
      },
      scrim: (sheet, opacity) => {
        // A pointer captured by the outgoing sheet can keep delivering events after a handoff: only the
        // committed sheet owns the shared backdrop.
        if (sheet.sheetId === this.#committed) this.#setScrim(opacity);
      },
    };
    new ContextProvider(this, {context: sheetSwitcherContext, initialValue: this.#api});
  }

  get #dialog(): HTMLDialogElement | null {
    return this.renderRoot.querySelector<HTMLDialogElement>('.dialog');
  }

  #sheetById(id: string | null): SwitcherSheet | undefined {
    if (id == null || id === '') return undefined;
    for (const sheet of this.#sheets) if (sheet.sheetId === id) return sheet;
    return undefined;
  }

  get #activePurpose(): BottomSheetPurpose {
    return this.#sheetById(this.activeSheet)?.purpose ?? 'info';
  }

  #isFlowVisible(): boolean {
    const {retainedSheet} = this.#transition;
    return (
      this.#sheetById(this.activeSheet) !== undefined ||
      (retainedSheet !== null && this.#sheetById(retainedSheet) !== undefined)
    );
  }

  // ----------------------------------------------------------------------- sheets and phases

  #register(sheet: SwitcherSheet): () => void {
    this.#sheets.add(sheet);
    this.#applyPhases();
    this.#syncFlow();
    this.requestUpdate();
    return () => {
      this.#sheets.delete(sheet);
      if (
        this.#transition.retainedSheet !== null &&
        this.#sheetById(this.#transition.retainedSheet) === undefined
      ) {
        this.#transition = IDLE_TRANSITION;
      }
      this.#applyPhases();
      this.#syncFlow();
      this.requestUpdate();
    };
  }

  #applyPhases(): void {
    for (const sheet of this.#sheets) {
      const phase = phaseForSheet(sheet.sheetId, this.activeSheet, this.#transition);
      const offset =
        this.#transition.retainedSheet === sheet.sheetId ? this.#transition.alignmentOffset : 0;
      if (sheet.phase !== phase) sheet.phase = phase;
      if (sheet.alignmentOffset !== offset) sheet.alignmentOffset = offset;
    }
  }

  #onMotionStart(sheet: SwitcherSheet, motion: SheetMotion): void {
    const t = this.#transition;
    if (motion !== 'entering' || t.enteringSheet !== sheet.sheetId) return;
    if (t.retainedSheet === null || t.retainedPhase !== 'covered') return;
    const retained = this.#sheetById(t.retainedSheet);
    if (!retained) return;
    // The sheet that leaves moves down only as far as the entering one is shorter.
    const offset = Math.max(0, sheet.restTop - retained.drawnTop);
    if (offset <= ALIGNMENT_THRESHOLD_PX) return;
    this.#transition = {
      ...t,
      retainedPhase: 'aligning',
      alignmentOffset: offset,
      isAlignmentComplete: false,
    };
    this.#applyPhases();
  }

  #onMotionComplete(sheet: SwitcherSheet, motion: SheetMotion): void {
    const t = this.#transition;
    const id = sheet.sheetId;
    let next = t;
    if (motion === 'entering') {
      if (t.enteringSheet !== id) return;
      if (t.retainedSheet === null) next = IDLE_TRANSITION;
      else if (t.retainedPhase === 'aligning' && !t.isAlignmentComplete)
        next = {...t, enteringSheet: null};
      else next = {...t, enteringSheet: null, retainedPhase: 'fading'};
    } else if (motion === 'aligning') {
      if (t.retainedSheet !== id || t.retainedPhase !== 'aligning') return;
      next =
        t.enteringSheet === null
          ? {...t, retainedPhase: 'fading'}
          : {...t, isAlignmentComplete: true};
    } else if (t.retainedSheet === id && t.retainedPhase === motion) {
      next = IDLE_TRANSITION;
    } else {
      return;
    }
    this.#transition = next;
    this.#applyPhases();
    this.#syncFlow();
  }

  // ------------------------------------------------------------------------------ dismissal

  #request(reason: ChangeReason): boolean {
    if (this.activeSheet == null) return false;
    const accepted = this.dispatch(new TctOpenChangeEvent(false, reason));
    if (accepted) this.activeSheet = null;
    return accepted;
  }

  #requestFromSheet(sheet: SwitcherSheet, reason: ChangeReason): boolean {
    // Only the interactive sheet may close the flow.
    if (sheet.sheetId !== this.activeSheet) return false;
    return this.#request(reason);
  }

  // ------------------------------------------------------------------------ shared dialog

  #setScrim(opacity: number): void {
    this.#dialog?.style.setProperty('--_sheet-scrim-opacity', String(opacity));
  }

  #initialFocusTarget(): HTMLElement | null {
    if (this.#layerOptions.kind === 'modal') return null;
    const previous = this.#previousFocus;
    const active = deepActiveElement();
    if (active && this.#dialog?.contains(active)) {
      if (previous instanceof HTMLElement && previous.isConnected) return previous;
      (active as HTMLElement).blur();
    }
    return null;
  }

  /** Opens the shared dialog for a visible flow, closes it when the last panel is gone. */
  #syncFlow(): void {
    if (!this.hasUpdated) return;
    const visible = this.#isFlowVisible();
    if (visible && !this.#layer.isOpen) {
      this.#layerOptions.kind = this.noScrim ? 'dialog' : 'modal';
      this.#previousFocus = deepActiveElement();
      this.#setScrim(1);
      this.toggleState('open', true);
      this.#settled = this.#layer.show().then(() => {
        if (this.#layer.isOpen) this.dispatch(new TctAfterOpenChangeEvent(true));
      });
      this.requestUpdate();
    } else if (!visible && this.#layer.isOpen) {
      this.toggleState('open', false);
      this.#settled = this.#layer.hide().then(() => {
        if (!this.#layer.isOpen) this.dispatch(new TctAfterOpenChangeEvent(false));
      });
      this.requestUpdate();
    }
  }

  /** Resolves once the shared dialog settled (test and script convenience). */
  get settled(): Promise<void> {
    return this.#settled;
  }

  // -------------------------------------------------------------------------------- lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('activeSheet') && this.hasUpdated) {
      const previous = this.#committed;
      const next = this.activeSheet === '' ? null : this.activeSheet;
      this.#committed = next;
      const started = transitionForActiveSheetChange(previous, next);
      // A retained sheet that is not mounted has nothing to hand off from.
      this.#transition =
        started.retainedSheet !== null && this.#sheetById(started.retainedSheet) === undefined
          ? IDLE_TRANSITION
          : started;
      if (next !== null && this.#sheetById(next) === undefined) {
        devWarn(
          `tct-bottom-sheet-switcher:unknown:${next}`,
          `active-sheet "${next}" matches no tct-bottom-sheet sheet-id in this switcher.`,
        );
      }
      // The flow's dim leaves with its last panel; a handoff between two sheets keeps it.
      this.#setScrim(next === null ? 0 : 1);
    }
  }

  protected override firstUpdated(): void {
    this.#committed = this.activeSheet === '' ? null : this.activeSheet;
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('activeSheet') || !this.hasUpdated) {
      this.#applyPhases();
    }
    this.#syncFlow();
  }

  #labelOf(): string | undefined {
    if (this.label) return this.label;
    const showing =
      this.#sheetById(this.activeSheet) ?? this.#sheetById(this.#transition.retainedSheet);
    return showing?.label || undefined;
  }

  override render(): TemplateResult {
    const isModal = !this.noScrim && this.#layer.isOpen;
    return html`<dialog
      class="dialog"
      part="dialog"
      aria-label=${this.#labelOf() ?? nothing}
      aria-modal=${isModal ? 'true' : nothing}
      role=${this.#activePurpose === 'required' ? 'alertdialog' : nothing}
    >
      <slot></slot>
      <div class="edge-tint" aria-hidden="true" data-sheet-edge-tint></div>
    </dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-bottom-sheet-switcher': TctBottomSheetSwitcher;
  }
}
