/**
 * tct-date-input: the surfaces beside the popover (the bottom sheet of a compact touch device and the
 * browser's own date input), the presentation policy including the deprecated `native-picker`, and the
 * fixed dates of the tests come from a faked clock. Ported from upstream DateInput.test.tsx where the
 * behaviour applies.
 */
import {userEvent} from 'vitest/browser';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {getAnnouncerRegions} from '@tecton-wc/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../field/define.js';
import '../tooltip/define.js';
import './define.js';
import {calendar, day, inner, make, toggle, useFixedToday} from './date-input-test-helpers.js';
import {stubDeviceQueries} from './picker-test-helpers.js';
import type {TctDateInput} from './tct-date-input.js';

useFixedToday();

let stub: ReturnType<typeof stubDeviceQueries> | undefined;
afterEach(() => {
  stub?.restore();
  stub = undefined;
});

const sheet = (field: TctDateInput): HTMLElement | null =>
  field.shadowRoot!.querySelector<HTMLElement>('tct-bottom-sheet');
const popover = (field: TctDateInput): HTMLElement | null =>
  field.shadowRoot!.querySelector<HTMLElement>('.picker');
const nativeInput = (field: TctDateInput): HTMLInputElement | null =>
  field.shadowRoot!.querySelector<HTMLInputElement>('input[type="date"]');
const overlay = (field: TctDateInput): HTMLElement =>
  field.shadowRoot!.querySelector<HTMLElement>('.native-overlay')!;

type Surface = 'popover' | 'sheet' | 'native';

/** The surface the field renders now; the sheet element loads lazily, so wait for it where one is due. */
async function surfaceOf(field: TctDateInput, expected: Surface): Promise<Surface> {
  await waitUntil(() => {
    if (expected === 'sheet') return sheet(field) !== null;
    if (expected === 'native') return nativeInput(field) !== null;
    return popover(field) !== null && nativeInput(field) === null && sheet(field) === null;
  }, `${expected} rendered`);
  if (nativeInput(field)) return 'native';
  if (sheet(field)) return 'sheet';
  return 'popover';
}

describe('tct-date-input: the bottom sheet of a compact touch device', () => {
  it('renders a sheet, not the popover, and opens it from the toggle with the calendar inside', async () => {
    stub = stubDeviceQueries({compactTouch: true});
    const field = await make(
      'label="Event date" value="2026-03-21" presentation="adaptive-bottom-sheet"',
    );
    expect(await surfaceOf(field, 'sheet')).toBe('sheet');
    expect(popover(field)).toBeNull();
    const changes = recordEvents(field, ['tct-open-change', 'tct-after-open-change']);
    await userEvent.click(toggle(field));
    await waitUntil(
      () => field.open && (sheet(field) as HTMLElement & {open: boolean}).open,
      'sheet open',
    );
    await waitUntil(() => changes.named('tct-after-open-change').length === 1, 'sheet settled');
    expect(changes.named('tct-open-change')[0]).toMatchObject({open: true, reason: 'trigger'});
    expect(sheet(field)!.getAttribute('label')).toBe('Choose date');
    expect(calendar(field).closest('tct-bottom-sheet')).toBe(sheet(field));
    expect(calendar(field).shadowRoot!.querySelector('.month-year')!.textContent).toBe(
      'March 2026',
    );
  });

  it('a day picked in the sheet is the value: input, change, then it closes and focus returns to the field', async () => {
    stub = stubDeviceQueries({compactTouch: true});
    const field = await make(
      'label="Event date" value="2026-03-21" presentation="adaptive-bottom-sheet"',
    );
    await surfaceOf(field, 'sheet');
    await userEvent.click(toggle(field));
    await waitUntil(() => field.open, 'open');
    await waitUntil(
      () => day(field, '2026-03-25') !== null && day(field, '2026-03-25').offsetParent !== null,
      'day painted',
    );
    const events = recordEvents(field, ['input', 'change', 'tct-open-change']);
    await userEvent.click(day(field, '2026-03-25'));
    await waitUntil(() => !field.open, 'closed by the pick');
    expect(field.value).toBe('2026-03-25');
    expect(events.events.map((event) => event.type)).toEqual([
      'input',
      'change',
      'tct-open-change',
    ]);
    expect(events.events[2]).toMatchObject({open: false, reason: 'selection'});
    await waitUntil(
      () => !(sheet(field) as HTMLElement & {open: boolean}).open,
      'the sheet closed with it',
    );
  });

  it('Escape closes the sheet through tct-open-change, and a cancelled intent keeps it open', async () => {
    stub = stubDeviceQueries({compactTouch: true});
    const field = await make('label="Event date" presentation="adaptive-bottom-sheet"');
    await surfaceOf(field, 'sheet');
    await userEvent.click(toggle(field));
    await waitUntil(() => field.open, 'open');
    await waitUntil(() => day(field, '2026-01-15').offsetParent !== null, 'day painted');
    field.addEventListener('tct-open-change', (event) => event.preventDefault(), {once: true});
    day(field, '2026-01-15').focus();
    await pressKeys('Escape');
    await nextFrame();
    expect(field.open).toBe(true);
    const changes = recordEvents(field, 'tct-open-change');
    await pressKeys('Escape');
    await waitUntil(() => !field.open, 'closed by Escape');
    expect(changes.events[0]).toMatchObject({open: false, reason: 'escape'});
  });

  it('the typed input is read-only there (the sheet collects the value), and a click on it opens the sheet', async () => {
    stub = stubDeviceQueries({compactTouch: true});
    const field = await make('label="Event date" presentation="adaptive-bottom-sheet"');
    await surfaceOf(field, 'sheet');
    expect(inner(field).readOnly).toBe(true);
    await userEvent.click(inner(field));
    await waitUntil(() => field.open, 'opened by a click on the field');
  });

  it('follows the device live: a popover on a wide viewport becomes a sheet when the device turns compact', async () => {
    stub = stubDeviceQueries({compactTouch: false});
    const field = await make('label="Event date" presentation="adaptive-bottom-sheet"');
    expect(await surfaceOf(field, 'popover')).toBe('popover');
    stub.set({compactTouch: true});
    expect(await surfaceOf(field, 'sheet')).toBe('sheet');
    stub.set({compactTouch: false});
    expect(await surfaceOf(field, 'popover')).toBe('popover');
  });
});

describe('tct-date-input: presentation and the deprecated native-picker', () => {
  const cases: {
    attributes: string;
    device: {compactTouch?: boolean; coarsePointer?: boolean};
    surface: Surface;
  }[] = [
    // The default is adaptive-native: the popover, or the browser's picker with a coarse pointer.
    {attributes: '', device: {}, surface: 'popover'},
    {attributes: '', device: {coarsePointer: true}, surface: 'native'},
    {
      attributes: 'presentation="popover"',
      device: {coarsePointer: true, compactTouch: true},
      surface: 'popover',
    },
    {attributes: 'presentation="native"', device: {}, surface: 'native'},
    {attributes: 'presentation="bottom-sheet"', device: {}, surface: 'sheet'},
    {attributes: 'presentation="adaptive-bottom-sheet"', device: {}, surface: 'popover'},
    {
      attributes: 'presentation="adaptive-bottom-sheet"',
      device: {compactTouch: true},
      surface: 'sheet',
    },
    // A narrow window with a mouse is still a mouse: no compact-touch match, so the popover stays.
    {
      attributes: 'presentation="adaptive-bottom-sheet"',
      device: {coarsePointer: false},
      surface: 'popover',
    },
    // Deprecated native-picker, mapped as upstream does.
    {attributes: 'native-picker="always"', device: {}, surface: 'native'},
    {attributes: 'native-picker="touch"', device: {}, surface: 'popover'},
    {attributes: 'native-picker="touch"', device: {coarsePointer: true}, surface: 'native'},
    {attributes: 'native-picker="never"', device: {coarsePointer: true}, surface: 'popover'},
    {attributes: 'native-picker="never"', device: {compactTouch: true}, surface: 'sheet'},
    // presentation wins over the deprecated attribute; an unknown value falls back to the default.
    {attributes: 'native-picker="always" presentation="popover"', device: {}, surface: 'popover'},
    {attributes: 'native-picker="sometimes"', device: {}, surface: 'popover'},
    {attributes: 'presentation="wheel"', device: {coarsePointer: true}, surface: 'native'},
  ];
  for (const {attributes, device, surface} of cases) {
    const where = Object.entries(device)
      .filter(([, on]) => on)
      .map(([name]) => name)
      .join('+');
    it(`${attributes || 'no attribute'} on ${where || 'a mouse'} is the ${surface}`, async () => {
      stub = stubDeviceQueries(device);
      const field = await make(`label="Event date" ${attributes}`);
      expect(await surfaceOf(field, surface)).toBe(surface);
    });
  }

  it('reads the property forms too: nativePicker and presentation, and presentation wins', async () => {
    stub = stubDeviceQueries({});
    const field = await make('label="Event date"');
    field.nativePicker = 'always';
    expect(await surfaceOf(field, 'native')).toBe('native');
    field.presentation = 'popover';
    expect(await surfaceOf(field, 'popover')).toBe('popover');
  });
});

describe('tct-date-input: the native surface', () => {
  const make$ = (attributes = 'label="Event date"') => make(`${attributes} presentation="native"`);

  it('is a real date input carrying the value and its constraints, with the field text painted over it', async () => {
    const field = await make$(
      'label="Event date" value="2026-03-21" min="2026-01-01" max="2026-12-31" required',
    );
    const control = nativeInput(field)!;
    expect(control.value).toBe('2026-03-21');
    expect(control.min).toBe('2026-01-01');
    expect(control.max).toBe('2026-12-31');
    expect(control.required).toBe(true);
    expect(overlay(field).textContent).toBe('March 21, 2026');
    expect(overlay(field).getAttribute('aria-hidden')).toBe('true');
    const empty = await make$();
    expect(overlay(empty).textContent).toBe('Select a date');
    expect(overlay(empty).hasAttribute('data-placeholder')).toBe(true);
  });

  it('a date chosen there is the value: input while it changes, change when it settles, ISO in the form', async () => {
    const field = await make$();
    const events = recordEvents(field, ['input', 'change']);
    const control = nativeInput(field)!;
    control.focus();
    control.value = '2026-04-02';
    control.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    control.dispatchEvent(new Event('change', {bubbles: true}));
    await field.updateComplete;
    expect(field.value).toBe('2026-04-02');
    expect(events.counts()).toEqual({input: 1, change: 1});
    expect(overlay(field).textContent).toBe('April 2, 2026');
    // Clearing the native control clears the value.
    control.value = '';
    control.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    await field.updateComplete;
    expect(field.value).toBe('');
  });

  it('a date the constraints rule out is announced and the control snaps back when it loses focus', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const field = await make$('label="Event date" value="2026-03-20"');
      // No weekend dates: 2026-03-21 is a Saturday.
      field.dateConstraints = [(date) => date.getDay() !== 0 && date.getDay() !== 6];
      await field.updateComplete;
      const control = nativeInput(field)!;
      control.focus();
      control.value = '2026-03-21';
      control.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
      await waitUntil(
        () => getAnnouncerRegions().assertive?.textContent === 'This date is not available',
        'refusal announced',
      );
      expect(field.value).toBe('2026-03-20');
      control.blur();
      await field.updateComplete;
      expect(control.value).toBe('2026-03-20');
    } finally {
      restore();
    }
  });

  it('the toggle opens the browser picker (showPicker) and no popover is involved', async () => {
    const field = await make$();
    const showPicker = vi
      .spyOn(HTMLInputElement.prototype, 'showPicker')
      .mockImplementation(() => undefined);
    try {
      await userEvent.click(toggle(field));
      expect(showPicker).toHaveBeenCalledOnce();
      expect(field.open).toBe(false);
      expect(popover(field)).toBeNull();
    } finally {
      showPicker.mockRestore();
    }
  });

  it('keeps the control focusable when a disabled message explains why it is disabled', async () => {
    const field = await make$(
      'label="Event date" value="2026-03-21" disabled disabled-message="Locked"',
    );
    const control = nativeInput(field)!;
    expect(control.disabled).toBe(false);
    expect(control.getAttribute('aria-disabled')).toBe('true');
    expect(control.readOnly).toBe(true);
    control.focus();
    expect(deepActiveElement()).toBe(control);
  });
});
