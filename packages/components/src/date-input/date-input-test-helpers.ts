/**
 * Helpers of the date-input test files: a fixed "today" (only `Date` is faked, so frames and timers stay
 * real), and shorthands for the parts of a `tct-date-input` and its picker.
 */
import {userEvent} from 'vitest/browser';
import {afterEach, beforeEach, vi} from 'vitest';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import type {TctCalendar} from '../calendar/tct-calendar.js';
import type {TctDateInput} from './tct-date-input.js';

/** 2026-01-15 at noon, local time. */
export const NOW = new Date(2026, 0, 15, 12, 0, 0);

/** Fixes the date the elements read as today for the tests of the calling file. */
export function useFixedToday(): void {
  beforeEach(() => {
    vi.useFakeTimers({toFake: ['Date']});
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}

export const inner = (field: TctDateInput): HTMLInputElement =>
  field.shadowRoot!.querySelector<HTMLInputElement>('input.input')!;
export const toggle = (field: TctDateInput): HTMLButtonElement =>
  field.shadowRoot!.querySelector<HTMLButtonElement>('.toggle')!;
export const picker = (field: TctDateInput): HTMLElement =>
  field.shadowRoot!.querySelector<HTMLElement>('.picker')!;
export const calendar = (field: TctDateInput): TctCalendar =>
  field.shadowRoot!.querySelector<TctCalendar>('tct-calendar')!;
export const day = (field: TctDateInput, iso: string): HTMLButtonElement =>
  calendar(field).shadowRoot!.querySelector<HTMLButtonElement>(
    `.day[data-date="${iso}"]:not([data-outside])`,
  )!;
export const isShown = (field: TctDateInput): boolean => picker(field).matches(':popover-open');

/** Renders a `tct-date-input` with `attributes` in a wrapper with room for its popover. */
export async function make(
  attributes = 'label="Event date"',
  options: {lang?: string; dir?: 'rtl'} = {},
): Promise<TctDateInput> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:40px;inline-size:420px"><tct-date-input ${attributes}></tct-date-input></div>`,
    options,
  );
  const field = wrapper.querySelector<TctDateInput>('tct-date-input')!;
  await field.updateComplete;
  await nextFrame();
  // Another language loads its catalog after the first render: wait for the translated placeholder.
  if (options.lang && !/^en(-|$)/.test(options.lang)) {
    await waitUntil(
      () =>
        !field
          .shadowRoot!.querySelector('input.input')
          ?.getAttribute('placeholder')
          ?.startsWith('Select'),
      'catalog loaded',
    );
  }
  return field;
}

/** Types `text` into the field (replacing what is there) without leaving it. */
export async function typeText(field: TctDateInput, text: string): Promise<void> {
  await userEvent.click(inner(field));
  await userEvent.clear(inner(field));
  if (text) await userEvent.type(inner(field), text);
  await field.updateComplete;
}

/** Opens the picker with a click on the toggle button and waits until it is shown and settled. */
export async function openByToggle(field: TctDateInput): Promise<void> {
  await userEvent.click(toggle(field));
  await waitUntil(() => field.open && isShown(field), 'picker open');
  await animationsFinished(picker(field));
}
