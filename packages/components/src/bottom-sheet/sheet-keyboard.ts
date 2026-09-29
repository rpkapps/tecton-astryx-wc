/**
 * On-screen keyboard accommodation of the bottom sheet: a port of upstream `useMobileKeyboard`,
 * reduced to what the platform does not do by itself.
 *
 * A fully expanded `tall` sheet stays where it is (the layout viewport does not shrink for the keyboard)
 * and gets a keyboard-aware scroll range instead: the scrolling body ends with a spacer as tall as the
 * keyboard (`--_sheet-keyboard-inset`), and the focused text field is scrolled into view inside the body,
 * above the keyboard, with a clearance. Shorter detents and every other height opt out entirely and
 * leave the browser's own focus reveal in place. Starting to drag the sheet dismisses the keyboard.
 *
 * The keyboard is measured with the visual viewport: the part of the layout viewport it covers is
 * `innerHeight - visualViewport.height - visualViewport.offsetTop`. (Where the engine resizes the
 * layout viewport itself, `interactive-widget=resizes-content`, that is 0 and nothing is added.)
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {MOBILE_KEYBOARD_BOTTOM_CLEARANCE} from './bottom-sheet.types.js';

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/** How much of the layout viewport the on-screen keyboard covers, in px (0 when none). */
export function keyboardInset(
  layoutHeight: number,
  viewport: {height: number; offsetTop: number} | null | undefined,
): number {
  if (!viewport) return 0;
  return Math.max(0, Math.round(layoutHeight - viewport.height - viewport.offsetTop));
}

/**
 * How far the body has to scroll (px, positive = down) so a control ends up above the keyboard
 * with `clearance` to spare, and inside the top of the body. 0 when it already is.
 */
export function revealDelta(
  control: {top: number; bottom: number},
  body: {top: number; bottom: number},
  obstructionTop: number,
  clearance: number,
): number {
  const visibleBottom = Math.min(body.bottom, obstructionTop) - clearance;
  if (control.bottom > visibleBottom) {
    // Never scroll a tall control's top out of view to show its bottom.
    return Math.min(control.bottom - visibleBottom, Math.max(0, control.top - body.top));
  }
  if (control.top < body.top) return control.top - body.top;
  return 0;
}

export function isTextEntryControl(element: Element | null): element is HTMLElement {
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly;
  if (element instanceof HTMLInputElement) {
    return (
      !element.disabled &&
      !element.readOnly &&
      !NON_TEXT_INPUT_TYPES.has((element.getAttribute('type') ?? 'text').toLowerCase())
    );
  }
  return (
    element instanceof HTMLElement &&
    element.matches('[contenteditable]:not([contenteditable="false"])')
  );
}

/** The text-entry control an event landed on (through a `<label>`), or `null`. Crosses open shadow roots. */
export function findTextEntryControl(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const direct = target.closest(
    'input, textarea, [contenteditable]:not([contenteditable="false"])',
  );
  if (isTextEntryControl(direct)) return direct;
  const label = target.closest('label');
  const control = label instanceof HTMLLabelElement ? label.control : null;
  return isTextEntryControl(control) ? control : null;
}

export interface SheetKeyboardOptions {
  /** The sheet panel (carries `--_sheet-keyboard-inset`, receives `focusin`). */
  sheet: () => HTMLElement | null;
  /** The scrolling body. */
  body: () => HTMLElement | null;
  /** Whether accommodation applies now: a `tall` sheet, open and fully expanded. */
  enabled: () => boolean;
}

export class SheetKeyboardController implements ReactiveController {
  readonly #o: SheetKeyboardOptions;
  #frame = 0;
  #control: HTMLElement | null = null;
  #listening = false;

  constructor(host: ReactiveControllerHost, options: SheetKeyboardOptions) {
    this.#o = options;
    host.addController(this);
  }

  hostConnected(): void {
    if (this.#listening) return;
    this.#listening = true;
    window.visualViewport?.addEventListener('resize', this.#onViewport);
    window.visualViewport?.addEventListener('scroll', this.#onViewport);
  }

  hostDisconnected(): void {
    this.#listening = false;
    window.visualViewport?.removeEventListener('resize', this.#onViewport);
    window.visualViewport?.removeEventListener('scroll', this.#onViewport);
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#control = null;
    this.#clear();
  }

  /** `focusin` on the sheet: a text field in an accommodated sheet gets revealed above the keyboard. */
  readonly handleFocusIn = (event: FocusEvent): void => {
    if (!this.#o.enabled()) return;
    const control = findTextEntryControl(event.composedPath()[0] ?? event.target);
    if (!control) return;
    this.#control = control;
    this.#schedule();
  };

  /** `focusout` from the sheet: the keyboard is going away with the field. */
  readonly handleFocusOut = (): void => {
    this.#control = null;
    // A moment later: focus moving between two fields must not collapse and re-open the spacer.
    requestAnimationFrame(() => {
      if (!this.#control && !findTextEntryControl(deepActiveElement())) this.#clear();
    });
  };

  /** The sheet started to travel: dismiss the keyboard instead of dragging it with the sheet. */
  blurForTravel(): void {
    const active = deepActiveElement();
    if (this.#control && active instanceof HTMLElement && findTextEntryControl(active)) {
      active.blur();
    }
    this.#control = null;
    this.#clear();
  }

  readonly #onViewport = (): void => {
    if (!this.#control) return;
    if (!this.#o.enabled()) {
      this.#clear();
      return;
    }
    this.#schedule();
  };

  #schedule(): void {
    if (this.#frame) return;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = 0;
      this.#apply();
    });
  }

  #apply(): void {
    const sheet = this.#o.sheet();
    const body = this.#o.body();
    const control = this.#control;
    if (!sheet || !body || !control || !control.isConnected || !this.#o.enabled()) return;
    const inset = keyboardInset(window.innerHeight, window.visualViewport);
    sheet.style.setProperty('--_sheet-keyboard-inset', `${inset}px`);
    if (inset <= 0) return;
    const obstructionTop = window.innerHeight - inset;
    const delta = revealDelta(
      control.getBoundingClientRect(),
      body.getBoundingClientRect(),
      obstructionTop,
      MOBILE_KEYBOARD_BOTTOM_CLEARANCE,
    );
    if (Math.abs(delta) >= 1) body.scrollTop += delta;
  }

  #clear(): void {
    this.#o.sheet()?.style.removeProperty('--_sheet-keyboard-inset');
  }
}
