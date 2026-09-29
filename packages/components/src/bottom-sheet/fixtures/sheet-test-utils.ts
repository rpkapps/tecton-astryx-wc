/**
 * Helpers shared by the bottom-sheet tests: opening and settling a sheet, and synthetic pointer and
 * touch input (real mouse gestures would be timing-dependent; a synthetic pointer id has no active
 * pointer to capture, which the sheet tolerates).
 */
import {animationsFinished, aTimeout, nextFrame, waitUntil} from '@tecton-wc/testing/index.js';
import type {TctBottomSheet} from '../tct-bottom-sheet.js';

export const dialogOf = (el: TctBottomSheet): HTMLDialogElement =>
  el.shadowRoot!.querySelector<HTMLDialogElement>('.dialog')!;
export const sheetOf = (el: TctBottomSheet): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.sheet')!;
export const handleOf = (el: TctBottomSheet): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.handle')!;
export const bodyOf = (el: TctBottomSheet): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.body')!;

/** Opens a standalone sheet and waits until it is showing and its entry motion is over. */
export async function openSheet(el: TctBottomSheet): Promise<void> {
  await el.show();
  await waitUntil(() => dialogOf(el).open, 'the dialog is open');
  await animationsFinished(dialogOf(el));
  await nextFrame();
}

/** Waits for a resting detent transition to be over. */
export async function settled(el: TctBottomSheet): Promise<void> {
  await nextFrame();
  await animationsFinished(sheetOf(el));
  await aTimeout(20);
}

/** The vertical offset of the sheet from fully open, as drawn. */
export const offsetOf = (el: TctBottomSheet): number =>
  Number.parseFloat(sheetOf(el).style.getPropertyValue('--_sheet-offset')) || 0;

interface PointerOptions {
  id?: number;
  type?: string;
  x?: number;
}

export function pointer(
  target: EventTarget,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  y: number,
  {id = 7, type: pointerType = 'mouse', x = 100}: PointerOptions = {},
): PointerEvent {
  const event = new PointerEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: true,
    pointerId: id,
    pointerType,
    isPrimary: true,
    button: 0,
    buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    clientX: x,
    clientY: y,
  });
  target.dispatchEvent(event);
  return event;
}

/**
 * Drags `target` from `fromY` to `toY` in `steps` moves, `stepMs` apart, and releases. The velocity of
 * the last segment decides a flick (over 1.2 px/ms and 48px): a slow drag uses a long `stepMs`.
 */
export async function drag(
  target: EventTarget,
  fromY: number,
  toY: number,
  {
    steps = 6,
    stepMs = 40,
    release = true,
    ...options
  }: PointerOptions & {
    steps?: number;
    stepMs?: number;
    release?: boolean;
  } = {},
): Promise<void> {
  pointer(target, 'pointerdown', fromY, options);
  for (let i = 1; i <= steps; i++) {
    await aTimeout(stepMs);
    pointer(target, 'pointermove', fromY + ((toY - fromY) * i) / steps, options);
  }
  await aTimeout(stepMs);
  if (release) pointer(target, 'pointerup', toY, options);
}

/** A synthetic touch (a `Touch` list, cancelable events) on `target`. */
export function touch(
  target: EventTarget,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  y: number,
  id = 3,
): TouchEvent {
  const point = new Touch({identifier: id, target, clientX: 100, clientY: y});
  const ended = type === 'touchend' || type === 'touchcancel';
  const event = new TouchEvent(type, {
    bubbles: true,
    composed: true,
    cancelable: type !== 'touchcancel',
    touches: ended ? [] : [point],
    targetTouches: ended ? [] : [point],
    changedTouches: [point],
  });
  target.dispatchEvent(event);
  return event;
}
