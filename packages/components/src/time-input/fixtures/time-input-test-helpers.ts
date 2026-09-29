/**
 * Helpers of the time-input test files: shorthands for the parts of a `tct-time-input` and its touch sheet.
 * The fixed "today" and the device stubs are shared with the date-input tests. Not part of the shipped API.
 */
import {userEvent} from 'vitest/browser';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import {settleAnimations} from '../../date-input/fixtures/picker-test-helpers.js';
import type {TctTimePanel} from '../../date-input/tct-time-panel.js';
import type {TctTimeInput} from '../tct-time-input.js';

export {useFixedToday} from '../../date-input/fixtures/date-input-test-helpers.js';

export const inner = (field: TctTimeInput): HTMLInputElement =>
  field.shadowRoot!.querySelector<HTMLInputElement>('input.input')!;
export const nativeInput = (field: TctTimeInput): HTMLInputElement | null =>
  field.shadowRoot!.querySelector<HTMLInputElement>('input[type="time"]');
export const overlay = (field: TctTimeInput): HTMLElement =>
  field.shadowRoot!.querySelector<HTMLElement>('.native-overlay')!;
export const toggle = (field: TctTimeInput): HTMLButtonElement =>
  field.shadowRoot!.querySelector<HTMLButtonElement>('.toggle')!;
export const sheet = (field: TctTimeInput): (HTMLElement & {open: boolean}) | null =>
  field.shadowRoot!.querySelector<HTMLElement & {open: boolean}>('tct-bottom-sheet');
export const panel = (field: TctTimeInput): TctTimePanel =>
  field.shadowRoot!.querySelector<TctTimePanel>('tct-time-panel')!;
export const column = (field: TctTimeInput, unit: string): HTMLElement =>
  panel(field).shadowRoot!.querySelector<HTMLElement>(`[role="listbox"][data-unit="${unit}"]`)!;
export const option = (field: TctTimeInput, unit: string, value: number): HTMLElement =>
  column(field, unit).querySelector<HTMLElement>(`[role="option"][data-value="${value}"]`)!;
export const selectedOf = (field: TctTimeInput, unit: string): string | undefined =>
  column(field, unit).querySelector<HTMLElement>('[aria-selected="true"]')?.dataset.value;

/** Renders a `tct-time-input` with `attributes` in a wrapper with room for its parts. */
export async function make(
  attributes = 'label="Start time"',
  options: {lang?: string; dir?: 'rtl'} = {},
): Promise<TctTimeInput> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:40px;inline-size:420px"><tct-time-input ${attributes}></tct-time-input></div>`,
    options,
  );
  const field = wrapper.querySelector<TctTimeInput>('tct-time-input')!;
  await field.updateComplete;
  await nextFrame();
  // Another language loads its catalog after the first render: wait for the translated placeholder.
  if (options.lang && !/^en(-|$)/.test(options.lang)) {
    await waitUntil(
      () => !/^Select a time$/.test(inner(field).getAttribute('placeholder') ?? ''),
      'catalog loaded',
    );
  }
  return field;
}

/** Types `text` into the field (replacing what is there) without leaving it. */
export async function typeText(field: TctTimeInput, text: string): Promise<void> {
  await userEvent.click(inner(field));
  await userEvent.clear(inner(field));
  if (text) await userEvent.type(inner(field), text);
  await field.updateComplete;
}

/** Closes the touch sheet without an intent event and waits until it has left and focus has come back. */
export async function closeSheet(field: TctTimeInput): Promise<void> {
  await field.hide();
  await waitUntil(() => !sheet(field)?.open, 'sheet closed');
  await waitUntil(
    () => sheet(field)?.shadowRoot?.querySelector('[data-phase="exiting"]') == null,
    'sheet left',
  );
  await settleAnimations();
}

/** Opens the touch sheet with a click on the toggle and waits until it is open and the panel is painted. */
export async function openSheet(field: TctTimeInput): Promise<void> {
  await waitUntil(() => sheet(field) !== null, 'sheet rendered');
  await userEvent.click(toggle(field));
  await waitUntil(() => field.open && sheet(field)!.open, 'sheet open');
  // The sheet slides in: measure it (and run axe on it) once it has arrived.
  await waitUntil(
    () =>
      sheet(field)!.shadowRoot!.querySelector('[data-phase]')?.getAttribute('data-phase') ===
      'active',
    'sheet settled',
  );
  await waitUntil(
    () => panel(field)?.shadowRoot?.querySelector('[role="option"]') != null,
    'panel painted',
  );
  // The click left the pointer where the sheet has slid in: it would hover an option (and start a colour
  // transition) after the measurements. Park it in a corner first.
  await userEvent.hover(document.documentElement, {position: {x: 1, y: 1}});
  await nextFrame();
  await settleAnimations();
}
