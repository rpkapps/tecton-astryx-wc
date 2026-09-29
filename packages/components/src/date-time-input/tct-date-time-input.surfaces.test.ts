/**
 * tct-date-time-input: the surfaces beside the popover and the typed parts: the bottom sheet with its Date and
 * Time tabs, the browser's own date and time inputs, and the presentation policy including the deprecated
 * `native-picker`. Ported from upstream DateTimeInputTouch.test.tsx, NativePickerSegments.test.tsx and
 * Presentation.test.tsx.
 */
import {userEvent} from 'vitest/browser';
import {afterEach, describe, expect, it} from 'vitest';
import {getAnnouncerRegions} from '@tecton-wc/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../field/define.js';
import '../tooltip/define.js';
import './define.js';
import {stubDeviceQueries} from '../date-input/fixtures/picker-test-helpers.js';
import {
  calendar,
  clock,
  closeSheet,
  dateInner,
  day,
  make,
  nativeDate,
  nativeTime,
  openSheet,
  option,
  overlays,
  panel,
  settleSheet,
  sheet,
  tabs,
  timeInner,
  timeList,
  toggle,
  useFixedToday,
} from './fixtures/date-time-input-test-helpers.js';
import type {TctDateTimeInput} from './tct-date-time-input.js';

useFixedToday();

let stub: ReturnType<typeof stubDeviceQueries> | undefined;
afterEach(() => {
  stub?.restore();
  stub = undefined;
});

type Surface = 'popover' | 'sheet' | 'native';
type TimePart = 'typed' | 'native';

/** The surface the field renders now; the sheet element loads lazily, so wait for it where one is due. */
async function surfaceOf(field: TctDateTimeInput, expected: Surface): Promise<Surface> {
  await waitUntil(() => {
    if (expected === 'sheet') return sheet(field) !== null;
    if (expected === 'native') return nativeDate(field) !== null;
    return nativeDate(field) === null && sheet(field) === null && dateInner(field) !== null;
  }, `${expected} rendered`);
  if (nativeDate(field)) return 'native';
  if (sheet(field)) return 'sheet';
  return 'popover';
}

describe('tct-date-time-input: presentation and the deprecated native-picker', () => {
  const cases: {
    attributes: string;
    device: {compactTouch?: boolean; coarsePointer?: boolean};
    surface: Surface;
    time?: TimePart;
  }[] = [
    // The default is adaptive-native: the popover, or the browser's pickers with a coarse pointer.
    {attributes: '', device: {}, surface: 'popover'},
    {attributes: '', device: {coarsePointer: true}, surface: 'native', time: 'native'},
    // The browser's time input cannot show seconds, step by an increment or list preset times.
    {attributes: 'has-seconds', device: {coarsePointer: true}, surface: 'native', time: 'typed'},
    {
      attributes: 'time-increment="15"',
      device: {coarsePointer: true},
      surface: 'native',
      time: 'typed',
    },
    {
      attributes: 'time-option-interval="30"',
      device: {coarsePointer: true},
      surface: 'native',
      time: 'typed',
    },
    // Explicit native is forced, with no fallback.
    {attributes: 'presentation="native"', device: {}, surface: 'native', time: 'native'},
    {
      attributes: 'presentation="native" has-seconds',
      device: {},
      surface: 'native',
      time: 'native',
    },
    {
      attributes: 'presentation="native" time-increment="15"',
      device: {},
      surface: 'native',
      time: 'native',
    },
    {
      attributes: 'presentation="popover"',
      device: {coarsePointer: true, compactTouch: true},
      surface: 'popover',
    },
    {attributes: 'presentation="bottom-sheet"', device: {}, surface: 'sheet'},
    {attributes: 'presentation="adaptive-bottom-sheet"', device: {}, surface: 'popover'},
    {
      attributes: 'presentation="adaptive-bottom-sheet"',
      device: {compactTouch: true},
      surface: 'sheet',
    },
    // Deprecated native-picker, mapped as upstream does.
    {attributes: 'native-picker="always"', device: {}, surface: 'native', time: 'native'},
    {
      attributes: 'native-picker="always" has-seconds',
      device: {},
      surface: 'native',
      time: 'typed',
    },
    {attributes: 'native-picker="touch"', device: {}, surface: 'popover'},
    {
      attributes: 'native-picker="touch"',
      device: {coarsePointer: true},
      surface: 'native',
      time: 'native',
    },
    {attributes: 'native-picker="never"', device: {coarsePointer: true}, surface: 'popover'},
    {attributes: 'native-picker="never"', device: {compactTouch: true}, surface: 'sheet'},
    // presentation wins over the deprecated attribute; unknown values fall back to the default.
    {attributes: 'native-picker="always" presentation="popover"', device: {}, surface: 'popover'},
    {attributes: 'native-picker="sometimes"', device: {}, surface: 'popover'},
    {
      attributes: 'presentation="wheel"',
      device: {coarsePointer: true},
      surface: 'native',
      time: 'native',
    },
  ];
  for (const {attributes, device, surface, time} of cases) {
    const where = Object.entries(device)
      .filter(([, on]) => on)
      .map(([name]) => name)
      .join('+');
    it(`${attributes || 'no attribute'} on ${where || 'a mouse'} is the ${surface}${time ? ` with a ${time} time part` : ''}`, async () => {
      stub = stubDeviceQueries(device);
      const field = await make(`label="Meeting" ${attributes}`);
      expect(await surfaceOf(field, surface)).toBe(surface);
      if (time) expect(nativeTime(field) !== null).toBe(time === 'native');
    });
  }

  it('follows the pointer live, and the property forms read the same way', async () => {
    stub = stubDeviceQueries({});
    const field = await make('label="Meeting"');
    expect(await surfaceOf(field, 'popover')).toBe('popover');
    stub.set({coarsePointer: true});
    expect(await surfaceOf(field, 'native')).toBe('native');
    stub.set({coarsePointer: false});
    field.nativePicker = 'always';
    expect(await surfaceOf(field, 'native')).toBe('native');
    field.presentation = 'popover';
    expect(await surfaceOf(field, 'popover')).toBe('popover');
  });
});

describe('tct-date-time-input: the native surface', () => {
  const make$ = (attributes = 'label="Meeting"') => make(`${attributes} presentation="native"`);

  it('is a real date input and a real time input carrying the value and their bounds, with the text painted over them', async () => {
    const field = await make$(
      'label="Meeting" value="2026-03-21T14:30" min="2026-03-01T09:00" max="2026-03-31T17:00" required',
    );
    expect(nativeDate(field)!.value).toBe('2026-03-21');
    expect(nativeDate(field)!.min).toBe('2026-03-01');
    expect(nativeDate(field)!.max).toBe('2026-03-31');
    expect(nativeDate(field)!.required).toBe(true);
    expect(nativeTime(field)!.value).toBe('14:30');
    expect(nativeTime(field)!.getAttribute('aria-label')).toBe('Meeting time');
    expect(overlays(field).map((overlay) => overlay.textContent)).toEqual([
      'March 21, 2026',
      '2:30 PM',
    ]);
    const empty = await make$();
    expect(overlays(empty).map((overlay) => overlay.textContent)).toEqual([
      'Select a date',
      'Select a time',
    ]);
    // The bounds of the time part are those of the value's own day: min and max are on other days here.
    expect(nativeTime(field)!.hasAttribute('min')).toBe(false);
    const boundary = await make$(
      'label="Meeting" value="2026-03-01T10:00" min="2026-03-01T09:00" max="2026-03-31T17:00"',
    );
    expect(nativeTime(boundary)!.min).toBe('09:00');
  });

  it('a date and a time chosen there make the value: input while it changes, change when it settles', async () => {
    const field = await make$();
    const events = recordEvents(field, ['input', 'change']);
    const date = nativeDate(field)!;
    date.focus();
    date.value = '2026-04-02';
    date.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    date.dispatchEvent(new Event('change', {bubbles: true}));
    await field.updateComplete;
    // The clock is fixed at 12:00: the date takes the current time.
    expect(field.value).toBe('2026-04-02T12:00');
    const time = nativeTime(field)!;
    time.focus();
    time.value = '09:15';
    time.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    time.dispatchEvent(new Event('change', {bubbles: true}));
    await field.updateComplete;
    expect(field.value).toBe('2026-04-02T09:15');
    expect(events.counts()).toEqual({input: 2, change: 2});
    expect(overlays(field).map((overlay) => overlay.textContent)).toEqual([
      'April 2, 2026',
      '9:15 AM',
    ]);
    date.value = '';
    date.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    await field.updateComplete;
    expect(field.value).toBe('');
  });

  it('holds a time chosen before the date and combines it with the date chosen after', async () => {
    const field = await make$();
    const time = nativeTime(field)!;
    time.focus();
    time.value = '08:45';
    time.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    time.dispatchEvent(new Event('change', {bubbles: true}));
    await field.updateComplete;
    expect(field.value).toBe('');
    const date = nativeDate(field)!;
    date.focus();
    date.value = '2026-04-02';
    date.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    await field.updateComplete;
    expect(field.value).toBe('2026-04-02T08:45');
  });

  it('a date or time the constraints rule out is announced and the control snaps back on blur', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const field = await make$(
        'label="Meeting" value="2026-03-20T10:00" min="2026-03-20T09:00" max="2026-03-22T17:00"',
      );
      field.dateConstraints = [(date) => date.getDay() !== 6];
      await field.updateComplete;
      const date = nativeDate(field)!;
      date.focus();
      date.value = '2026-03-21';
      date.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
      await waitUntil(
        () => getAnnouncerRegions().assertive?.textContent === 'This date is not available',
        'refusal announced',
      );
      expect(field.value).toBe('2026-03-20T10:00');
      date.blur();
      await field.updateComplete;
      expect(date.value).toBe('2026-03-20');
      const time = nativeTime(field)!;
      time.focus();
      time.value = '08:00';
      time.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
      await waitUntil(
        () => getAnnouncerRegions().assertive?.textContent === 'Invalid time',
        'time refusal announced',
      );
      expect(field.value).toBe('2026-03-20T10:00');
      time.blur();
      await field.updateComplete;
      expect(time.value).toBe('10:00');
    } finally {
      restore();
    }
  });

  it('keeps both controls focusable when a disabled message explains why they are disabled', async () => {
    const field = await make$(
      'label="Meeting" value="2026-03-21T14:30" disabled disabled-message="Locked"',
    );
    for (const control of [nativeDate(field)!, nativeTime(field)!]) {
      expect(control.disabled).toBe(false);
      expect(control.getAttribute('aria-disabled')).toBe('true');
      expect(control.readOnly).toBe(true);
    }
    nativeDate(field)!.focus();
    expect(deepActiveElement()).toBe(nativeDate(field));
  });
});

describe('tct-date-time-input: the bottom sheet', () => {
  const make$ = (attributes = 'label="Meeting"') =>
    make(`${attributes} presentation="bottom-sheet"`);

  it('is two read-only fields with a calendar button and a clock button, each opening the sheet on its own tab', async () => {
    const field = await make$('label="Meeting" value="2026-03-21T14:30"');
    await waitUntil(() => sheet(field) !== null, 'sheet rendered');
    expect(dateInner(field).readOnly).toBe(true);
    expect(dateInner(field).getAttribute('role')).toBe('combobox');
    expect(timeInner(field).readOnly).toBe(true);
    expect(timeInner(field).getAttribute('role')).toBe('combobox');
    expect(timeInner(field).getAttribute('aria-haspopup')).toBe('dialog');
    expect(toggle(field).getAttribute('aria-label')).toBe('Open calendar');
    expect(clock(field)!.getAttribute('aria-label')).toBe('Open Meeting time');
    expect(sheet(field)!.getAttribute('label')).toBe('Choose date and time');
    const changes = recordEvents(field, ['tct-open-change', 'tct-after-open-change']);
    await openSheet(field);
    await waitUntil(() => changes.named('tct-after-open-change').length === 1, 'settled');
    expect(changes.named('tct-open-change')[0]).toMatchObject({open: true, reason: 'trigger'});
    expect(tabs(field).map((tab) => tab.getAttribute('label'))).toEqual(['Date', 'Time']);
    expect(calendar(field)).not.toBeNull();
    expect(panel(field)).toBeNull();
    await closeSheet(field);
    await userEvent.click(clock(field)!);
    await settleSheet(field);
    expect(panel(field)).not.toBeNull();
    expect(calendar(field)).toBeNull();
    await closeSheet(field);
    await userEvent.click(timeInner(field));
    await settleSheet(field);
    expect(panel(field)).not.toBeNull();
    await closeSheet(field);
    await userEvent.click(dateInner(field));
    await settleSheet(field);
    expect(calendar(field)).not.toBeNull();
  });

  it('a day picked commits the date with the time it has and stays open; Save date moves to the time, Save closes', async () => {
    const field = await make$('label="Meeting" value="2026-03-21T14:30"');
    await openSheet(field);
    const events = recordEvents(field, ['input', 'change', 'tct-open-change']);
    await userEvent.click(day(field, '2026-03-25'));
    expect(field.value).toBe('2026-03-25T14:30');
    expect(field.open).toBe(true);
    const save = field.shadowRoot!.querySelector('.save')!;
    expect(save.getAttribute('label')).toBe('Save date');
    await userEvent.click(save);
    await waitUntil(() => panel(field) !== null, 'time tab');
    expect(field.shadowRoot!.querySelector('.save')!.getAttribute('label')).toBe('Save');
    expect(
      field.shadowRoot!.querySelector('tct-segmented-control')!.getAttribute('value') ?? '',
    ).not.toBe('date');
    await waitUntil(
      () =>
        option(field, 'hour', 2) !== null &&
        option(field, 'hour', 2).getAttribute('aria-selected') === 'true',
      'the time of the value is selected',
    );
    await userEvent.click(option(field, 'minute', 5));
    expect(field.value).toBe('2026-03-25T14:05');
    await userEvent.click(field.shadowRoot!.querySelector('.save')!);
    await waitUntil(() => !field.open, 'closed by Save');
    expect(events.counts()).toEqual({input: 2, change: 2, 'tct-open-change': 1});
    expect(events.named('tct-open-change')[0]).toMatchObject({open: false, reason: 'selection'});
  });

  it('the tabs switch between the calendar and the time columns', async () => {
    const field = await make$('label="Meeting" value="2026-03-21T14:30"');
    await openSheet(field);
    await userEvent.click(tabs(field)[1]!);
    await waitUntil(() => panel(field) !== null && calendar(field) === null, 'time tab');
    await userEvent.click(tabs(field)[0]!);
    await waitUntil(() => calendar(field) !== null && panel(field) === null, 'date tab');
  });

  it('a time picked before any date is held and shown, and the date chosen after takes it', async () => {
    const field = await make$();
    await waitUntil(() => sheet(field) !== null, 'sheet rendered');
    await userEvent.click(clock(field)!);
    await settleSheet(field);
    await userEvent.click(option(field, 'minute', 45));
    expect(field.value).toBe('');
    // The clock is fixed at 12:00 PM: the held time is 12:45.
    expect(timeInner(field).value).toBe('12:45 PM');
    await userEvent.click(tabs(field)[0]!);
    await waitUntil(() => calendar(field) !== null, 'date tab');
    await waitUntil(() => day(field, '2026-01-20') !== null, 'calendar painted');
    await userEvent.click(day(field, '2026-01-20'));
    expect(field.value).toBe('2026-01-20T12:45');
  });

  it('Escape closes the sheet through tct-open-change, and a cancelled intent keeps it open', async () => {
    const field = await make$();
    await openSheet(field);
    field.addEventListener('tct-open-change', (event) => event.preventDefault(), {once: true});
    await pressKeys('Escape');
    await nextFrame();
    expect(field.open).toBe(true);
    const changes = recordEvents(field, 'tct-open-change');
    await pressKeys('Escape');
    await waitUntil(() => !field.open, 'closed by Escape');
    expect(changes.events[0]).toMatchObject({open: false, reason: 'escape'});
  });

  it('does not open a disabled, read-only or busy field, and offers no list of preset times', async () => {
    for (const attributes of ['disabled', 'readonly', 'loading']) {
      const field = await make$(`label="Meeting" ${attributes}`);
      await waitUntil(() => sheet(field) !== null, 'sheet rendered');
      await userEvent.click(toggle(field), {force: true});
      await userEvent.click(clock(field)!, {force: true});
      await nextFrame();
      expect(field.open, attributes).toBe(false);
    }
    const listed = await make$('label="Meeting" time-option-interval="30"');
    await waitUntil(() => sheet(listed) !== null, 'sheet rendered');
    expect(timeInner(listed).getAttribute('aria-autocomplete')).toBe('none');
    expect(timeList(listed)).toBeNull();
  });

  it('is a sheet on a compact touch device under adaptive-bottom-sheet, with one month', async () => {
    stub = stubDeviceQueries({compactTouch: true});
    const field = await make(
      'label="Meeting" presentation="adaptive-bottom-sheet" number-of-months="2"',
    );
    await openSheet(field);
    expect(calendar(field).shadowRoot!.querySelectorAll('[role="grid"]')).toHaveLength(1);
    expect(calendar(field).closest('tct-bottom-sheet')).toBe(sheet(field));
  });
});
