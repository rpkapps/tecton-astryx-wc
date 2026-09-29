/**
 * Helpers of the date-time-input test files: shorthands for the parts of a `tct-date-time-input`, its
 * calendar popover, its preset-time list and its touch sheet. The fixed "today" (2026-01-15 12:00 local) and the
 * device stubs are shared with the date-input tests. Not part of the shipped API.
 */
import {userEvent} from 'vitest/browser';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import type {TctCalendar} from '../calendar/tct-calendar.js';
import {settleAnimations} from '../date-input/picker-test-helpers.js';
import type {TctTimePanel} from '../date-input/tct-time-panel.js';
import type {TctDateTimeInput} from './tct-date-time-input.js';

export {useFixedToday} from '../date-input/date-input-test-helpers.js';

export const dateInner = (field: TctDateTimeInput): HTMLInputElement =>
  field.shadowRoot!.querySelector<HTMLInputElement>('input.input:not(.time)')!;
export const timeInner = (field: TctDateTimeInput): HTMLInputElement =>
  field.shadowRoot!.querySelector<HTMLInputElement>('input.input.time')!;
export const nativeDate = (field: TctDateTimeInput): HTMLInputElement | null =>
  field.shadowRoot!.querySelector<HTMLInputElement>('input[type="date"]');
export const nativeTime = (field: TctDateTimeInput): HTMLInputElement | null =>
  field.shadowRoot!.querySelector<HTMLInputElement>('input[type="time"]');
export const overlays = (field: TctDateTimeInput): HTMLElement[] => [
  ...field.shadowRoot!.querySelectorAll<HTMLElement>('.native-overlay'),
];
export const toggle = (field: TctDateTimeInput): HTMLButtonElement =>
  field.shadowRoot!.querySelector<HTMLButtonElement>('.toggle:not(.time-toggle)')!;
export const clock = (field: TctDateTimeInput): HTMLButtonElement | null =>
  field.shadowRoot!.querySelector<HTMLButtonElement>('.time-toggle');
export const boxes = (field: TctDateTimeInput): HTMLElement[] => [
  ...field.shadowRoot!.querySelectorAll<HTMLElement>('.input-wrapper'),
];
export const picker = (field: TctDateTimeInput): HTMLElement =>
  field.shadowRoot!.querySelector<HTMLElement>(
    '.picker:not(:has(> [data-variant="time-options"]))',
  )!;
export const isShown = (field: TctDateTimeInput): boolean =>
  picker(field)?.matches(':popover-open') ?? false;
export const calendar = (field: TctDateTimeInput): TctCalendar =>
  field.shadowRoot!.querySelector<TctCalendar>('tct-calendar')!;
export const day = (field: TctDateTimeInput, iso: string): HTMLButtonElement =>
  calendar(field).shadowRoot!.querySelector<HTMLButtonElement>(
    `.day[data-date="${iso}"]:not([data-outside])`,
  )!;
export const timeList = (field: TctDateTimeInput): HTMLElement | null =>
  field.shadowRoot!.querySelector<HTMLElement>('[role="listbox"].time-listbox');
export const timeOptions = (field: TctDateTimeInput): HTMLElement[] => [
  ...field.shadowRoot!.querySelectorAll<HTMLElement>('.time-option'),
];
export const timePopover = (field: TctDateTimeInput): HTMLElement | null =>
  field.shadowRoot!.querySelector<HTMLElement>('.picker:has(> [data-variant="time-options"])');
export const sheet = (field: TctDateTimeInput): (HTMLElement & {open: boolean}) | null =>
  field.shadowRoot!.querySelector<HTMLElement & {open: boolean}>('tct-bottom-sheet');
export const panel = (field: TctDateTimeInput): TctTimePanel | null =>
  field.shadowRoot!.querySelector<TctTimePanel>('tct-time-panel');
export const option = (field: TctDateTimeInput, unit: string, value: number): HTMLElement =>
  panel(field)!.shadowRoot!.querySelector<HTMLElement>(
    `[role="listbox"][data-unit="${unit}"] [role="option"][data-value="${value}"]`,
  )!;
export const tabs = (field: TctDateTimeInput): HTMLElement[] => [
  ...field.shadowRoot!.querySelectorAll<HTMLElement>('tct-segmented-control-item'),
];

/** Renders a `tct-date-time-input` with `attributes` in a wrapper with room for its parts. */
export async function make(
  attributes = 'label="Meeting"',
  options: {lang?: string; dir?: 'rtl'} = {},
): Promise<TctDateTimeInput> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:40px;inline-size:520px"><tct-date-time-input ${attributes}></tct-date-time-input></div>`,
    options,
  );
  const field = wrapper.querySelector<TctDateTimeInput>('tct-date-time-input')!;
  await field.updateComplete;
  await nextFrame();
  // Another language loads its catalog after the first render: wait for the translated placeholder.
  if (options.lang && !/^en(-|$)/.test(options.lang)) {
    await waitUntil(
      () =>
        !/^Select a date$/.test(dateInner(field)?.getAttribute('placeholder') ?? 'Select a date'),
      'catalog loaded',
    );
  }
  return field;
}

/** Types `text` into the date part (replacing what is there) without leaving it. */
export async function typeDate(field: TctDateTimeInput, text: string): Promise<void> {
  await userEvent.click(dateInner(field));
  await userEvent.clear(dateInner(field));
  if (text) await userEvent.type(dateInner(field), text);
  await field.updateComplete;
}

/** Types `text` into the time part (replacing what is there) without leaving it. */
export async function typeTime(field: TctDateTimeInput, text: string): Promise<void> {
  await userEvent.click(timeInner(field));
  await userEvent.clear(timeInner(field));
  if (text) await userEvent.type(timeInner(field), text);
  await field.updateComplete;
}

/** Opens the calendar popover with a click on the toggle and waits until it is shown and settled. */
export async function openByToggle(field: TctDateTimeInput): Promise<void> {
  await userEvent.click(toggle(field));
  await waitUntil(() => field.open && isShown(field), 'picker open');
  await animationsFinished(picker(field));
}

/** Closes the touch sheet without an intent event and waits until it has left. */
export async function closeSheet(field: TctDateTimeInput): Promise<void> {
  await field.hide();
  await waitUntil(() => !sheet(field)?.open, 'sheet closed');
  await waitUntil(
    () => sheet(field)?.shadowRoot?.querySelector('[data-phase="exiting"]') == null,
    'sheet left',
  );
  await settleAnimations();
}

/** Opens the touch sheet from the date toggle and waits until it has arrived and its content is painted. */
export async function openSheet(field: TctDateTimeInput): Promise<void> {
  await waitUntil(() => sheet(field) !== null, 'sheet rendered');
  await userEvent.click(toggle(field));
  await settleSheet(field);
}

/** Waits for the open sheet to arrive (slid in, colours settled) with the pointer out of its way. */
export async function settleSheet(field: TctDateTimeInput): Promise<void> {
  await waitUntil(() => field.open && sheet(field)!.open, 'sheet open');
  await waitUntil(
    () =>
      sheet(field)!.shadowRoot!.querySelector('[data-phase]')?.getAttribute('data-phase') ===
      'active',
    'sheet settled',
  );
  await userEvent.hover(document.documentElement, {position: {x: 1, y: 1}});
  await nextFrame();
  await settleAnimations();
}
