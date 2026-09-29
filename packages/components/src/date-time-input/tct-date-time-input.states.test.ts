/**
 * tct-date-time-input: validity and when it shows (required, min, max, unavailable days), the change action
 * and busy state, status and sizes, languages and direction (de-DE, en-GB, he-IL, ar-SA), and accessibility and
 * contrast in the interactive states of the field, of the preset-time list and of the touch sheet, light and
 * dark, waiting for the transitions before measuring.
 */
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {formHarness, hasCustomState} from '@tecton-wc/testing/forms.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../field/define.js';
import '../form-layout/define.js';
import '../tooltip/define.js';
import './define.js';
import {
  backgroundOf,
  contrast,
  over,
  parseColor,
  textContrast,
  type Rgba,
  settleAnimations,
} from '../date-input/picker-test-helpers.js';
import {
  boxes,
  calendar,
  closeSheet,
  dateInner,
  day,
  make,
  openByToggle,
  openSheet,
  option,
  picker,
  sheet,
  tabs,
  timeInner,
  timeList,
  timeOptions,
  toggle,
  typeDate,
  typeTime,
  useFixedToday,
} from './date-time-input-test-helpers.js';
import type {TctDateTimeInput} from './tct-date-time-input.js';

useFixedToday();

const displayed = (field: TctDateTimeInput): boolean => hasCustomState(field, 'user-invalid');

describe('tct-date-time-input: validity and when it shows', () => {
  it('a required, empty field is invalid but shows nothing until a submit attempt', async () => {
    const harness = await formHarness(
      '<tct-date-time-input label="Meeting" name="m" required></tct-date-time-input><button>Go</button>',
    );
    const field = harness.form.querySelector<TctDateTimeInput>('tct-date-time-input')!;
    await field.updateComplete;
    expect(field.validity.valueMissing).toBe(true);
    expect(field.checkValidity()).toBe(false);
    expect(displayed(field)).toBe(false);
    expect(dateInner(field).hasAttribute('aria-invalid')).toBe(false);
    expect(dateInner(field).getAttribute('aria-required')).toBe('true');
    expect(timeInner(field).getAttribute('aria-required')).toBe('true');
    await userEvent.click(dateInner(field));
    await pressKeys('Tab');
    await field.hide();
    expect(displayed(field)).toBe(false);
    await userEvent.click(harness.form.querySelector('button')!);
    await field.updateComplete;
    expect(harness.submitEvents).toHaveLength(0);
    expect(displayed(field)).toBe(true);
    expect(dateInner(field).getAttribute('aria-invalid')).toBe('true');
  });

  it('a date without a time (or a time without a date) is not a value: required stays unmet', async () => {
    const field = await make('label="Meeting" required');
    await typeTime(field, '3pm');
    await pressKeys('Tab');
    expect(field.value).toBe('');
    expect(field.validity.valueMissing).toBe(true);
  });

  it('min and max are native constraints on the whole value: rangeUnderflow / rangeOverflow with a message', async () => {
    const under = await make('label="Meeting" value="2026-03-21T08:00" min="2026-03-21T09:00"');
    expect(under.validity.rangeUnderflow).toBe(true);
    expect(under.validationMessage).not.toBe('');
    expect(displayed(under)).toBe(false);
    const over = await make('label="Meeting" value="2026-03-22T10:00" max="2026-03-21T17:00"');
    expect(over.validity.rangeOverflow).toBe(true);
    const inside = await make(
      'label="Meeting" value="2026-03-21T10:00" min="2026-03-21T09:00" max="2026-03-21T17:00"',
    );
    expect(inside.validity.valid).toBe(true);
    const dateOnly = await make('label="Meeting" value="2026-03-21T03:00" min="2026-03-21"');
    expect(dateOnly.validity.valid).toBe(true);
    const junk = await make('label="Meeting" value="2026-03-21T10:00" min="soon" max="never"');
    expect(junk.validity.valid).toBe(true);
  });

  it('a value on an unavailable day is a custom error, and reset undoes a shown error', async () => {
    const harness = await formHarness(
      '<tct-date-time-input label="Meeting" name="m" value="2026-03-21T08:00" min="2026-03-21T09:00"></tct-date-time-input><button>Go</button>',
    );
    const field = harness.form.querySelector<TctDateTimeInput>('tct-date-time-input')!;
    await field.updateComplete;
    expect(displayed(field)).toBe(false);
    await userEvent.click(harness.form.querySelector('button')!);
    await field.updateComplete;
    expect(displayed(field)).toBe(true);
    harness.reset();
    await field.updateComplete;
    expect(displayed(field)).toBe(false);
    expect(field.value).toBe('2026-03-21T08:00');
    // 2026-03-21 is a Saturday.
    const constrained = await make('label="Meeting" value="2026-03-21T14:30"');
    constrained.dateConstraints = [(date) => date.getDay() !== 6];
    await constrained.updateComplete;
    expect(constrained.validity.customError).toBe(true);
    expect(constrained.validationMessage).toBe('This date is not available');
  });

  it('submits the ISO date-time, resets to the value attribute and restores from form state', async () => {
    const harness = await formHarness(
      '<tct-date-time-input label="Meeting" name="m" value="2026-03-21T14:30"></tct-date-time-input>',
    );
    const field = harness.form.querySelector<TctDateTimeInput>('tct-date-time-input')!;
    await field.updateComplete;
    expect(harness.values('m')).toEqual(['2026-03-21T14:30']);
    field.value = '2026-04-01T09:15:30';
    await field.updateComplete;
    expect(harness.values('m')).toEqual(['2026-04-01T09:15:30']);
    harness.reset();
    await field.updateComplete;
    expect(field.value).toBe('2026-03-21T14:30');
    field.formStateRestoreCallback('2026-05-05T16:45', 'restore');
    await field.updateComplete;
    expect(field.value).toBe('2026-05-05T16:45');
    field.value = '';
    await field.updateComplete;
    expect(harness.values('m')).toEqual(['']);
  });

  it('the value is a wall-clock date-time: the same string whatever the language or the time zone of the page', async () => {
    for (const lang of ['en-US', 'de-DE', 'ja-JP']) {
      const harness = await formHarness(
        `<tct-date-time-input name="m" value="2026-03-21T23:59" lang="${lang}"></tct-date-time-input>`,
      );
      expect(harness.values('m'), lang).toEqual(['2026-03-21T23:59']);
    }
  });
});

describe('tct-date-time-input: the change action, disabled, status and size', () => {
  it('runs changeAction after a user change; busy until it settles, refusing edits meanwhile', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30"');
    let release!: () => void;
    const calls: string[] = [];
    field.changeAction = (value) => {
      calls.push(value);
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    };
    timeInner(field).focus();
    await pressKeys('ArrowUp');
    await field.updateComplete;
    expect(calls).toEqual(['2026-03-21T14:31']);
    expect(hasCustomState(field, 'busy')).toBe(true);
    expect(timeInner(field).getAttribute('aria-busy')).toBe('true');
    await pressKeys('ArrowUp');
    expect(field.value).toBe('2026-03-21T14:31');
    release();
    await waitUntil(() => !hasCustomState(field, 'busy'), 'idle again');
    expect(timeInner(field).hasAttribute('aria-busy')).toBe(false);
  });

  it('does not run changeAction for a property write', async () => {
    const field = await make('label="Meeting"');
    let calls = 0;
    field.changeAction = () => {
      calls += 1;
    };
    field.value = '2026-03-21T10:00';
    await field.updateComplete;
    expect(calls).toBe(0);
  });

  it('a disabled field with a disabled-message keeps both parts focusable, refuses edits and shows no hint', async () => {
    const field = await make(
      'label="Meeting" value="2026-03-21T14:30" disabled disabled-message="Locked"',
    );
    for (const control of [dateInner(field), timeInner(field)]) {
      expect(control.disabled).toBe(false);
      expect(control.getAttribute('aria-disabled')).toBe('true');
      expect(control.readOnly).toBe(true);
    }
    timeInner(field).focus();
    await userEvent.keyboard('9');
    expect(field.value).toBe('2026-03-21T14:30');
    expect(timeInner(field).placeholder).toBe('Select a time');
  });

  it('draws the error status as the detached message, sets aria-invalid on both parts, and ignores status-variant', async () => {
    const field = await make(
      'label="Meeting" status-type="error" status-message="Pick a slot" status-variant="tooltip" description="Help"',
    );
    expect(dateInner(field).getAttribute('aria-invalid')).toBe('true');
    expect(timeInner(field).getAttribute('aria-invalid')).toBe('true');
    const status = field.shadowRoot!.querySelector('tct-field-status')!;
    expect(status.textContent).toContain('Pick a slot');
    expect(status.getAttribute('variant') ?? 'detached').toBe('detached');
    expect(field.shadowRoot!.querySelector('[part~="status-button"]')).toBeNull();
    expect(boxes(field).every((box) => box.getAttribute('data-status') === 'error')).toBe(true);
  });

  it('the size variants change the height of the boxes', async () => {
    const heights: number[] = [];
    for (const size of ['sm', 'md', 'lg']) {
      const field = await make(`label="Meeting" size="${size}"`);
      heights.push(boxes(field)[0]!.getBoundingClientRect().height);
      expect(boxes(field)[1]!.getBoundingClientRect().height).toBe(heights.at(-1));
    }
    expect(heights[0]).toBeLessThan(heights[1]!);
    expect(heights[1]).toBeLessThan(heights[2]!);
  });

  it('time-label and time-placeholder rename the time part', async () => {
    const field = await make(
      'label="Meeting" time-label="Starts at" time-placeholder="Any time" time-option-interval="60"',
    );
    expect(timeInner(field).getAttribute('aria-label')).toBe('Starts at');
    expect(timeInner(field).placeholder).toBe('Any time');
    await userEvent.click(timeInner(field));
    await waitUntil(() => timeList(field) !== null, 'list');
    expect(timeList(field)!.getAttribute('aria-label')).toBe('Starts at options');
  });
});

describe('tct-date-time-input: languages and direction', () => {
  it('reads day-first dates and 24-hour times in en-GB, and speaks German in de-DE', async () => {
    const gb = await make('label="Meeting" hour-format="24h"', {lang: 'en-GB'});
    await typeDate(gb, '3/4/2026');
    await pressKeys('Tab');
    await gb.hide();
    await typeTime(gb, '1430');
    await pressKeys('Tab');
    expect(gb.value).toBe('2026-04-03T14:30');
    expect(timeInner(gb).value).toBe('14:30');
    const de = await make('label="Termin" value="2026-03-21T14:30" hour-format="24h"', {
      lang: 'de-DE',
    });
    expect(dateInner(de).value).toBe('21. März 2026');
    expect(timeInner(de).value).toBe('14:30');
    expect(timeInner(de).placeholder).not.toBe('Select a time');
    expect(timeInner(de).getAttribute('aria-label')).not.toBe('Termin time');
  });

  it('reads back what it shows in he-IL and ar-SA, and stores ASCII ISO', async () => {
    for (const lang of ['he-IL', 'ar-SA']) {
      const field = await make('label="Meeting" value="2026-03-21T14:30"', {lang, dir: 'rtl'});
      const date = dateInner(field).value;
      const time = timeInner(field).value;
      expect(date, lang).not.toBe('');
      await typeDate(field, date);
      await pressKeys('Tab');
      await field.hide();
      await typeTime(field, time);
      await pressKeys('Tab');
      expect(field.value, lang).toBe('2026-03-21T14:30');
    }
    const arabic = await make('label="Meeting" value="2026-03-21T14:30"', {
      lang: 'ar-SA',
      dir: 'rtl',
    });
    expect(dateInner(arabic).value).toMatch(/[٠-٩]/);
    expect(timeInner(arabic).value).toMatch(/[٠-٩]/);
  });

  it('mirrors in RTL: the date box comes first at the inline start, and the popover aligns with it', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30"', {
      lang: 'he-IL',
      dir: 'rtl',
    });
    const [date, time] = boxes(field).map((box) => box.getBoundingClientRect());
    expect(date!.left).toBeGreaterThan(time!.left);
    await openByToggle(field);
    const layer = picker(field).querySelector('.picker-surface')!.getBoundingClientRect();
    expect(Math.abs(layer.right - date!.right)).toBeLessThan(2);
  });

  it('the preset list shows the reader’s digits and markers in ar-SA', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30" time-option-interval="60"', {
      lang: 'ar-SA',
      dir: 'rtl',
    });
    await userEvent.click(timeInner(field));
    await waitUntil(() => timeList(field) !== null, 'list');
    expect(timeOptions(field)[13]!.textContent.trim()).toMatch(/[٠-٩]/);
  });
});

describe('tct-date-time-input: accessibility and contrast in every state', () => {
  const SCHEMES = ['light', 'dark'] as const;

  /** Waits until nothing is animating (shadow trees included) for a few frames: a state change starts its transition late. */
  async function settle(field: TctDateTimeInput): Promise<void> {
    await field.updateComplete;
    await settleAnimations();
  }

  async function themed(scheme: 'light' | 'dark', attributes: string): Promise<TctDateTimeInput> {
    await emulateMedia({colorScheme: scheme});
    const wrapper = await fixture<HTMLElement>(
      `<div style="padding:16px;inline-size:520px;background:var(--color-background-surface)"><tct-date-time-input ${attributes}></tct-date-time-input></div>`,
      {theme: scheme},
    );
    const field = wrapper.querySelector<TctDateTimeInput>('tct-date-time-input')!;
    await settle(field);
    return field;
  }

  function boxSurface(field: TctDateTimeInput, index: number): Rgba {
    return over(
      parseColor(getComputedStyle(boxes(field)[index]!).backgroundColor),
      backgroundOf(field.parentElement!),
    );
  }

  for (const scheme of SCHEMES) {
    it(`passes axe at rest, focused, filled, disabled and in error (${scheme})`, async () => {
      const field = await themed(
        scheme,
        'label="Meeting" description="Pick one" value="2026-03-21T14:30" has-clear',
      );
      const wrapper = field.parentElement!;
      await expectAccessible(wrapper);
      timeInner(field).focus();
      await settle(field);
      await expectAccessible(wrapper);
      field.disabled = true;
      await settle(field);
      await expectAccessible(wrapper);
      field.disabled = false;
      field.statusType = 'error';
      field.statusMessage = 'Pick a slot';
      await settle(field);
      await expectAccessible(wrapper);
    });

    it(`text meets 4.5:1 in both parts, the placeholders, the error state and the muted drafts (${scheme})`, async () => {
      const filled = await themed(scheme, 'label="Meeting" value="2026-03-21T14:30"');
      expect(
        textContrast(dateInner(filled), boxSurface(filled, 0)),
        `${scheme} date`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        textContrast(timeInner(filled), boxSurface(filled, 1)),
        `${scheme} time`,
      ).toBeGreaterThanOrEqual(4.5);
      const empty = await themed(scheme, 'label="Meeting"');
      for (const [input, index] of [
        [dateInner(empty), 0],
        [timeInner(empty), 1],
      ] as const) {
        const placeholder = getComputedStyle(input, '::placeholder').color;
        expect(
          contrast(parseColor(placeholder), boxSurface(empty, index)),
          `${scheme} placeholder ${index}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      const invalid = await themed(
        scheme,
        'label="Meeting" value="2026-03-21T14:30" status-type="error"',
      );
      expect(
        textContrast(dateInner(invalid), boxSurface(invalid, 0)),
        `${scheme} error`,
      ).toBeGreaterThanOrEqual(4.5);
      await typeTime(empty, 'nonsense');
      await waitUntil(
        () => timeInner(empty).getAttribute('aria-invalid') === 'true',
        'invalid after the pause',
      );
      await settle(empty);
      expect(
        textContrast(timeInner(empty), boxSurface(empty, 1)),
        `${scheme} draft`,
      ).toBeGreaterThanOrEqual(4.5);
      await expectAccessible(empty.parentElement!);
    });

    it(`the preset-time list passes axe, and its options meet 4.5:1 resting, highlighted and selected (${scheme})`, async () => {
      const field = await themed(
        scheme,
        'label="Meeting" value="2026-03-21T14:30" time-option-interval="30"',
      );
      await userEvent.click(timeInner(field));
      await waitUntil(() => timeList(field) !== null, 'list');
      await userEvent.hover(document.documentElement, {position: {x: 1, y: 1}});
      await settle(field);
      await expectAccessible(field.parentElement!);
      const surface = backgroundOf(
        field.shadowRoot!.querySelector('.picker-surface[data-variant="time-options"]')!,
      );
      const paint = (element: HTMLElement): number => {
        const style = getComputedStyle(element);
        return contrast(parseColor(style.color), over(parseColor(style.backgroundColor), surface));
      };
      const options = timeOptions(field);
      const selected = options.find((o) => o.getAttribute('aria-selected') === 'true')!;
      const resting = options.find(
        (o) => o.getAttribute('aria-selected') !== 'true' && !o.hasAttribute('data-highlighted'),
      )!;
      expect(paint(resting), `${scheme} resting`).toBeGreaterThanOrEqual(4.5);
      expect(paint(selected), `${scheme} selected`).toBeGreaterThanOrEqual(4.5);
      await pressKeys('ArrowDown');
      await settle(field);
      const highlighted = timeOptions(field).find((o) => o.hasAttribute('data-highlighted'))!;
      expect(paint(highlighted), `${scheme} highlighted`).toBeGreaterThanOrEqual(4.5);
      await expectAccessible(field.parentElement!);
    });

    it(`the touch sheet passes axe on both tabs, and its tabs and options keep their contrast (${scheme})`, async () => {
      const field = await themed(
        scheme,
        'label="Meeting" value="2026-03-21T14:30" presentation="bottom-sheet"',
      );
      await openSheet(field);
      await settle(field);
      await expectAccessible(sheet(field)!);
      expect(calendar(field)).not.toBeNull();
      await userEvent.click(tabs(field)[1]!);
      await waitUntil(() => option(field, 'hour', 2) !== null, 'time tab');
      await userEvent.hover(document.documentElement, {position: {x: 1, y: 1}});
      await settle(field);
      await expectAccessible(sheet(field)!);
      const selected = option(field, 'hour', 2);
      const style = getComputedStyle(selected);
      const surface = backgroundOf(document.body);
      expect(
        contrast(parseColor(style.color), over(parseColor(style.backgroundColor), surface)),
        `${scheme} selected option`,
      ).toBeGreaterThanOrEqual(4.5);
      await closeSheet(field);
    });
  }

  it('draws the picked preset time in Highlight colours in forced colours, and the boxes keep a focus ring', async () => {
    const field = await make('label="Meeting" value="2026-03-21T14:30" time-option-interval="30"');
    await userEvent.click(timeInner(field));
    await waitUntil(() => timeList(field) !== null, 'list');
    await emulateMedia({forcedColors: 'active'});
    await nextFrame();
    const picked = timeOptions(field).find((o) => o.getAttribute('aria-selected') === 'true')!;
    const style = getComputedStyle(picked);
    expect(style.forcedColorAdjust).toBe('none');
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    await pressKeys('Escape');
    dateInner(field).focus();
    await pressKeys('Shift+Tab');
    expect(getComputedStyle(toggle(field)).outlineStyle).not.toBe('none');
    expect(day).toBeDefined();
  });
});
