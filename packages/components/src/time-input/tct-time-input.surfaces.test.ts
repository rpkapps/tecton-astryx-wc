/**
 * tct-time-input: the surfaces beside the typed field: the browser's own time input, the bottom sheet with
 * its columns (tct-time-panel), and the presentation policy including the deprecated `native-picker`.
 * Ported from upstream NativeTimeInput.test.tsx, Presentation.test.tsx and TouchTimeField.
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
import {stubDeviceQueries} from '../date-input/picker-test-helpers.js';
import {
  closeSheet,
  column,
  inner,
  make,
  nativeInput,
  openSheet,
  option,
  overlay,
  panel,
  selectedOf,
  sheet,
  toggle,
  useFixedToday,
} from './time-input-test-helpers.js';
import type {TctTimeInput} from './tct-time-input.js';

useFixedToday();

let stub: ReturnType<typeof stubDeviceQueries> | undefined;
afterEach(() => {
  stub?.restore();
  stub = undefined;
});

type Surface = 'typed' | 'sheet' | 'native';

/** The surface the field renders now; the sheet element loads lazily, so wait for it where one is due. */
async function surfaceOf(field: TctTimeInput, expected: Surface): Promise<Surface> {
  await waitUntil(() => {
    if (expected === 'sheet') return sheet(field) !== null;
    if (expected === 'native') return nativeInput(field) !== null;
    return nativeInput(field) === null && sheet(field) === null && inner(field) !== null;
  }, `${expected} rendered`);
  if (nativeInput(field)) return 'native';
  if (sheet(field)) return 'sheet';
  return 'typed';
}

describe('tct-time-input: presentation and the deprecated native-picker', () => {
  const cases: {
    attributes: string;
    device: {compactTouch?: boolean; coarsePointer?: boolean};
    surface: Surface;
  }[] = [
    // The default is adaptive-native: the typed field, or the browser's picker with a coarse pointer.
    {attributes: '', device: {}, surface: 'typed'},
    {attributes: '', device: {coarsePointer: true}, surface: 'native'},
    // The browser's picker cannot show seconds or step by an increment: the typed field stays.
    {attributes: 'has-seconds', device: {coarsePointer: true}, surface: 'typed'},
    {attributes: 'increment="15"', device: {coarsePointer: true}, surface: 'typed'},
    {attributes: 'presentation="text-input"', device: {coarsePointer: true}, surface: 'typed'},
    // Explicit native is forced, with no fallback.
    {attributes: 'presentation="native"', device: {}, surface: 'native'},
    {attributes: 'presentation="native" has-seconds', device: {}, surface: 'native'},
    {attributes: 'presentation="native" increment="15"', device: {}, surface: 'native'},
    // There is no popover for a time: it is the typed field.
    {attributes: 'presentation="popover"', device: {}, surface: 'typed'},
    {attributes: 'presentation="bottom-sheet"', device: {}, surface: 'sheet'},
    {attributes: 'presentation="adaptive-bottom-sheet"', device: {}, surface: 'typed'},
    {
      attributes: 'presentation="adaptive-bottom-sheet"',
      device: {compactTouch: true},
      surface: 'sheet',
    },
    // Deprecated native-picker, mapped as upstream does.
    {attributes: 'native-picker="always"', device: {}, surface: 'native'},
    {attributes: 'native-picker="always" has-seconds', device: {}, surface: 'typed'},
    {attributes: 'native-picker="touch"', device: {}, surface: 'typed'},
    {attributes: 'native-picker="touch"', device: {coarsePointer: true}, surface: 'native'},
    {attributes: 'native-picker="never"', device: {coarsePointer: true}, surface: 'typed'},
    // presentation wins over the deprecated attribute; unknown values fall back to the default.
    {attributes: 'native-picker="always" presentation="text-input"', device: {}, surface: 'typed'},
    {attributes: 'native-picker="sometimes"', device: {}, surface: 'typed'},
    {attributes: 'presentation="wheel"', device: {coarsePointer: true}, surface: 'native'},
  ];
  for (const {attributes, device, surface} of cases) {
    const where = Object.entries(device)
      .filter(([, on]) => on)
      .map(([name]) => name)
      .join('+');
    it(`${attributes || 'no attribute'} on ${where || 'a mouse'} is the ${surface} field`, async () => {
      stub = stubDeviceQueries(device);
      const field = await make(`label="Start time" ${attributes}`);
      expect(await surfaceOf(field, surface)).toBe(surface);
    });
  }

  it('follows the pointer live, and the property forms read the same way', async () => {
    stub = stubDeviceQueries({});
    const field = await make('label="Start time"');
    expect(await surfaceOf(field, 'typed')).toBe('typed');
    stub.set({coarsePointer: true});
    expect(await surfaceOf(field, 'native')).toBe('native');
    stub.set({coarsePointer: false});
    field.nativePicker = 'always';
    expect(await surfaceOf(field, 'native')).toBe('native');
    field.presentation = 'text-input';
    expect(await surfaceOf(field, 'typed')).toBe('typed');
  });
});

describe('tct-time-input: the native surface', () => {
  const make$ = (attributes = 'label="Start time"') => make(`${attributes} presentation="native"`);

  it('is a real time input carrying the value and its constraints, with the field text painted over it', async () => {
    const field = await make$('label="Start time" value="14:30" min="08:00" max="18:00" required');
    const control = nativeInput(field)!;
    expect(control.value).toBe('14:30');
    expect(control.min).toBe('08:00');
    expect(control.max).toBe('18:00');
    expect(control.required).toBe(true);
    expect(control.hasAttribute('step')).toBe(false);
    expect(overlay(field).textContent).toBe('2:30 PM');
    expect(overlay(field).getAttribute('aria-hidden')).toBe('true');
    const empty = await make$();
    expect(overlay(empty).textContent).toBe('Select a time');
    expect(overlay(empty).hasAttribute('data-placeholder')).toBe(true);
    const seconds = await make$(
      'label="Start time" value="14:30:15" has-seconds hour-format="24h"',
    );
    expect(nativeInput(seconds)!.step).toBe('1');
    expect(overlay(seconds).textContent).toBe('14:30:15');
  });

  it('a time chosen there is the value: input while it changes, change when it settles, ISO in the form', async () => {
    const field = await make$();
    const events = recordEvents(field, ['input', 'change']);
    const control = nativeInput(field)!;
    control.focus();
    control.value = '09:15';
    control.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    control.dispatchEvent(new Event('change', {bubbles: true}));
    await field.updateComplete;
    expect(field.value).toBe('09:15');
    expect(events.counts()).toEqual({input: 1, change: 1});
    expect(overlay(field).textContent).toBe('9:15 AM');
    control.value = '';
    control.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    await field.updateComplete;
    expect(field.value).toBe('');
  });

  it('a time outside min and max is announced and the control snaps back when it loses focus', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const field = await make$('label="Start time" value="10:00" min="09:00" max="17:00"');
      const control = nativeInput(field)!;
      control.focus();
      control.value = '20:00';
      control.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
      await waitUntil(
        () => getAnnouncerRegions().assertive?.textContent === 'Invalid time',
        'refusal announced',
      );
      expect(field.value).toBe('10:00');
      control.blur();
      await field.updateComplete;
      expect(control.value).toBe('10:00');
    } finally {
      restore();
    }
  });

  it('keeps the control focusable when a disabled message explains why it is disabled', async () => {
    const field = await make$(
      'label="Start time" value="14:30" disabled disabled-message="Locked"',
    );
    const control = nativeInput(field)!;
    expect(control.disabled).toBe(false);
    expect(control.getAttribute('aria-disabled')).toBe('true');
    expect(control.readOnly).toBe(true);
    control.focus();
    expect(deepActiveElement()).toBe(control);
  });
});

describe('tct-time-input: the bottom sheet', () => {
  const make$ = (attributes = 'label="Start time"') =>
    make(`${attributes} presentation="bottom-sheet"`);

  it('is a read-only combobox with a clock button, and the sheet opens from the button, the field and the keyboard', async () => {
    const field = await make$();
    await waitUntil(() => sheet(field) !== null, 'sheet rendered');
    const control = inner(field);
    expect(control.readOnly).toBe(true);
    expect(control.getAttribute('role')).toBe('combobox');
    expect(control.getAttribute('aria-haspopup')).toBe('dialog');
    expect(control.getAttribute('aria-expanded')).toBe('false');
    expect(toggle(field).getAttribute('aria-label')).toBe('Open Start time');
    expect(sheet(field)!.getAttribute('label')).toBe('Start time');
    const changes = recordEvents(field, ['tct-open-change', 'tct-after-open-change']);
    await userEvent.click(toggle(field));
    await waitUntil(() => field.open && sheet(field)!.open, 'opened by the button');
    await waitUntil(() => changes.named('tct-after-open-change').length === 1, 'settled');
    expect(changes.named('tct-open-change')[0]).toMatchObject({open: true, reason: 'trigger'});
    expect(control.getAttribute('aria-expanded')).toBe('true');
    await closeSheet(field);
    await userEvent.click(control);
    await waitUntil(() => field.open, 'opened by a click on the field');
    await closeSheet(field);
    control.focus();
    await pressKeys('ArrowDown');
    await waitUntil(() => field.open, 'opened by Arrow Down');
  });

  it('shows the hour, minute and AM/PM columns with the current time when there is no value', async () => {
    const field = await make$();
    await openSheet(field);
    expect(
      [...panel(field).shadowRoot!.querySelectorAll('[role="listbox"]')].map((c) =>
        c.getAttribute('aria-label'),
      ),
    ).toEqual(['Hour', 'Minute', 'AM/PM']);
    expect(column(field, 'hour').querySelectorAll('[role="option"]')).toHaveLength(12);
    expect(column(field, 'minute').querySelectorAll('[role="option"]')).toHaveLength(60);
    // The clock is fixed at 12:00 PM.
    expect(selectedOf(field, 'hour')).toBe('12');
    expect(selectedOf(field, 'minute')).toBe('0');
    expect(selectedOf(field, 'meridiem')).toBe('1');
  });

  it('shows the value, 24 hours without an AM/PM column, and seconds when asked', async () => {
    const field = await make$('label="Start time" value="14:35:20" hour-format="24h" has-seconds');
    await openSheet(field);
    expect(column(field, 'hour').querySelectorAll('[role="option"]')).toHaveLength(24);
    expect(selectedOf(field, 'hour')).toBe('14');
    expect(selectedOf(field, 'minute')).toBe('35');
    expect(selectedOf(field, 'second')).toBe('20');
    expect(panel(field).shadowRoot!.querySelector('[data-unit="meridiem"]')).toBeNull();
    await closeSheet(field);
    const twelve = await make$('label="Start time" value="14:35"');
    await openSheet(twelve);
    expect(selectedOf(twelve, 'hour')).toBe('2');
    expect(selectedOf(twelve, 'meridiem')).toBe('1');
  });

  it('a pick commits at once (input, change), composed with the other columns; Save closes the sheet', async () => {
    const field = await make$('label="Start time" value="14:35"');
    await openSheet(field);
    const events = recordEvents(field, ['input', 'change', 'tct-open-change']);
    await userEvent.click(option(field, 'hour', 9));
    await field.updateComplete;
    expect(field.value).toBe('21:35');
    await userEvent.click(option(field, 'minute', 5));
    expect(field.value).toBe('21:05');
    await userEvent.click(option(field, 'meridiem', 0));
    expect(field.value).toBe('09:05');
    expect(events.counts()).toEqual({input: 3, change: 3, 'tct-open-change': 0});
    expect(inner(field).value).toBe('9:05 AM');
    expect(field.open).toBe(true);
    await userEvent.click(field.shadowRoot!.querySelector('.save')!);
    await waitUntil(() => !field.open, 'closed by Save');
    expect(events.named('tct-open-change')[0]).toMatchObject({open: false, reason: 'selection'});
  });

  it('the first pick on an empty field composes the current time with it', async () => {
    const field = await make$();
    await openSheet(field);
    await userEvent.click(option(field, 'minute', 45));
    // 12:00 PM with the minute replaced.
    expect(field.value).toBe('12:45');
  });

  it('the panel does not leak its own change event out of the field', async () => {
    const field = await make$('label="Start time" value="14:35"');
    await openSheet(field);
    const events = recordEvents(field, ['change']);
    await userEvent.click(option(field, 'minute', 5));
    expect(events.events).toHaveLength(1);
  });

  it('keyboard: arrows move within a column and pick, Home and End go to its ends, Tab moves to the next column', async () => {
    const field = await make$('label="Start time" value="14:35"');
    await openSheet(field);
    await waitUntil(
      () => (deepActiveElement() as HTMLElement | null)?.dataset.value === '2',
      'focus on the selected hour',
    );
    await pressKeys('ArrowDown');
    expect(field.value).toBe('15:35');
    await pressKeys('ArrowUp', 'ArrowUp');
    expect(field.value).toBe('13:35');
    await pressKeys('End');
    expect(field.value).toBe('12:35');
    await pressKeys('Home');
    expect(field.value).toBe('13:35');
    await pressKeys('Tab');
    expect(
      (deepActiveElement() as HTMLElement).closest('[data-unit]')!.getAttribute('data-unit'),
    ).toBe('minute');
    await pressKeys('ArrowDown');
    expect(field.value).toBe('13:36');
  });

  it('disables the options no time in min..max can produce, and clamps a pick into the window', async () => {
    const field = await make$('label="Start time" value="10:30" min="09:00" max="11:15"');
    await openSheet(field);
    expect(option(field, 'hour', 8).getAttribute('aria-disabled')).toBe('true');
    expect(option(field, 'hour', 9).getAttribute('aria-disabled')).toBeNull();
    // 11 AM is inside, 12 PM is not (AM is selected, so 12 means 00:xx and is outside too).
    expect(option(field, 'hour', 12).getAttribute('aria-disabled')).toBe('true');
    expect(option(field, 'meridiem', 1).getAttribute('aria-disabled')).toBe('true');
    option(field, 'hour', 8).dispatchEvent(
      new MouseEvent('click', {bubbles: true, composed: true}),
    );
    expect(field.value).toBe('10:30');
    await userEvent.click(option(field, 'hour', 11));
    // 11:30 is past max: the pick lands on max.
    expect(field.value).toBe('11:15');
  });

  it('does not open a disabled, read-only or busy field', async () => {
    for (const attributes of ['disabled', 'readonly', 'loading']) {
      const field = await make$(`label="Start time" ${attributes}`);
      await waitUntil(() => sheet(field) !== null, 'sheet rendered');
      await userEvent.click(toggle(field), {force: true});
      await userEvent.click(inner(field), {force: true});
      await nextFrame();
      expect(field.open, attributes).toBe(false);
    }
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

  it('is a sheet on a compact touch device under adaptive-bottom-sheet', async () => {
    stub = stubDeviceQueries({compactTouch: true});
    const field = await make('label="Start time" presentation="adaptive-bottom-sheet"');
    await openSheet(field);
    expect(panel(field).closest('tct-bottom-sheet')).toBe(sheet(field));
  });
});
