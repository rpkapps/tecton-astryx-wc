/**
 * Helpers of the date-range-input test files: shorthands for the parts of a `tct-date-range-input` and its
 * picker. The fixed "today" and the device stubs are shared with the date-input tests. Not part of the shipped
 * API.
 */
import {userEvent} from 'vitest/browser';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import type {TctCalendar} from '../calendar/tct-calendar.js';
import type {TctDateRangeInput} from './tct-date-range-input.js';

export {useFixedToday} from '../date-input/date-input-test-helpers.js';

export const trigger = (field: TctDateRangeInput): HTMLButtonElement =>
  field.shadowRoot!.querySelector<HTMLButtonElement>('button.trigger')!;
export const picker = (field: TctDateRangeInput): HTMLElement =>
  field.shadowRoot!.querySelector<HTMLElement>('.picker')!;
export const sheet = (field: TctDateRangeInput): HTMLElement | null =>
  field.shadowRoot!.querySelector<HTMLElement>('tct-bottom-sheet');
export const calendar = (field: TctDateRangeInput): TctCalendar =>
  field.shadowRoot!.querySelector<TctCalendar>('tct-calendar')!;
export const presets = (field: TctDateRangeInput): HTMLButtonElement[] => [
  ...field.shadowRoot!.querySelectorAll<HTMLButtonElement>('.preset'),
];
export const clearButton = (field: TctDateRangeInput): HTMLElement | null =>
  field.shadowRoot!.querySelector<HTMLElement>('tct-input-clear-button');
export const isShown = (field: TctDateRangeInput): boolean =>
  picker(field)?.matches(':popover-open') ?? false;

/** The button of a day in the calendar (not an outside day). */
export const day = (field: TctDateRangeInput, iso: string): HTMLButtonElement =>
  calendar(field).shadowRoot!.querySelector<HTMLButtonElement>(
    `.day[data-date="${iso}"]:not([data-outside])`,
  )!;

/** Renders a `tct-date-range-input` with `attributes` in a wrapper with room for its popover. */
export async function make(
  attributes = 'label="Reporting period"',
  options: {lang?: string; dir?: 'rtl'} = {},
): Promise<TctDateRangeInput> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:40px;inline-size:520px"><tct-date-range-input ${attributes}></tct-date-range-input></div>`,
    options,
  );
  const field = wrapper.querySelector<TctDateRangeInput>('tct-date-range-input')!;
  await field.updateComplete;
  await nextFrame();
  // Another language loads its catalog after the first render: wait for the translated label.
  if (options.lang && !/^en(-|$)/.test(options.lang)) {
    await waitUntil(
      () =>
        !/Select date range|Open calendar/.test(trigger(field).getAttribute('aria-label') ?? ''),
      'catalog loaded',
    );
  }
  return field;
}

/** Opens the picker with a click on the trigger and waits until it is shown and settled. */
export async function openByTrigger(field: TctDateRangeInput): Promise<void> {
  await userEvent.click(trigger(field));
  await waitUntil(() => field.open && isShown(field), 'picker open');
  await animationsFinished(picker(field));
}

/** Picks a range in the open calendar with two clicks. */
export async function pick(field: TctDateRangeInput, start: string, end: string): Promise<void> {
  await userEvent.click(day(field, start));
  await userEvent.click(day(field, end));
}
