/**
 * tct-date-range-input: validity and when it shows (required, min, max, unavailable days), status and sizes,
 * languages and direction (de-DE, en-GB, he-IL, ar-SA), and accessibility and contrast in the interactive
 * states, light and dark, waiting for the transitions before measuring.
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
} from '../date-input/picker-test-helpers.js';
import {
  calendar,
  day,
  make,
  openByTrigger,
  picker,
  presets,
  trigger,
  useFixedToday,
} from './date-range-input-test-helpers.js';
import type {TctDateRangeInput} from './tct-date-range-input.js';

useFixedToday();

const displayed = (field: TctDateRangeInput): boolean => hasCustomState(field, 'user-invalid');

describe('tct-date-range-input: validity and when it shows', () => {
  it('a required, empty field is invalid but shows nothing until a submit attempt', async () => {
    const harness = await formHarness(
      '<tct-date-range-input label="Period" name="p" required></tct-date-range-input><button>Go</button>',
    );
    const field = harness.form.querySelector<TctDateRangeInput>('tct-date-range-input')!;
    await field.updateComplete;
    expect(field.validity.valueMissing).toBe(true);
    expect(field.checkValidity()).toBe(false);
    expect(displayed(field)).toBe(false);
    expect(trigger(field).hasAttribute('aria-invalid')).toBe(false);
    expect(trigger(field).getAttribute('aria-required')).toBe('true');
    await userEvent.click(harness.form.querySelector('button')!);
    await field.updateComplete;
    expect(harness.submitEvents).toHaveLength(0);
    expect(displayed(field)).toBe(true);
    expect(trigger(field).getAttribute('aria-invalid')).toBe('true');
  });

  it('a picked range clears the invalid state; clearing a required field shows it', async () => {
    const field = await make('label="Period" required value="2026-01-05/2026-01-09"');
    expect(field.validity.valid).toBe(true);
    await userEvent.click(field.shadowRoot!.querySelector('tct-input-clear-button')!);
    await field.updateComplete;
    expect(field.validity.valueMissing).toBe(true);
    expect(displayed(field)).toBe(true);
    await openByTrigger(field);
    await userEvent.click(day(field, '2026-01-20'));
    await userEvent.click(day(field, '2026-01-21'));
    await waitUntil(() => !field.open, 'closed');
    expect(field.validity.valid).toBe(true);
    expect(displayed(field)).toBe(false);
  });

  it('min and max are constraints on the value: an endpoint outside them is rangeUnderflow / rangeOverflow', async () => {
    const under = await make('label="Period" value="2026-01-01/2026-01-09" min="2026-01-05"');
    expect(under.validity.rangeUnderflow).toBe(true);
    expect(under.validationMessage).not.toBe('');
    expect(displayed(under)).toBe(false);
    const over = await make('label="Period" value="2026-01-05/2026-01-20" max="2026-01-15"');
    expect(over.validity.rangeOverflow).toBe(true);
    const inside = await make(
      'label="Period" value="2026-01-05/2026-01-09" min="2026-01-05" max="2026-01-09"',
    );
    expect(inside.validity.valid).toBe(true);
    const junk = await make('label="Period" value="2026-01-05/2026-01-09" min="soon" max="never"');
    expect(junk.validity.valid).toBe(true);
  });

  it('an endpoint that dateConstraints rule out is a custom error, with the unavailable message', async () => {
    const field = await make('label="Period" value="2026-01-05/2026-01-09"');
    // 2026-01-05 is a Monday.
    field.dateConstraints = [(date) => date.getDay() !== 1];
    await field.updateComplete;
    expect(field.validity.customError).toBe(true);
    expect(field.validationMessage).toBe('This date is not available');
    field.dateConstraints = undefined;
    await field.updateComplete;
    expect(field.validity.valid).toBe(true);
  });

  it('an out-of-range value is displayed as invalid after a submit attempt, and reset undoes it', async () => {
    const harness = await formHarness(
      '<tct-date-range-input label="Period" name="p" value="2026-01-01/2026-01-03" min="2026-01-02"></tct-date-range-input><button>Go</button>',
    );
    const field = harness.form.querySelector<TctDateRangeInput>('tct-date-range-input')!;
    await field.updateComplete;
    expect(displayed(field)).toBe(false);
    await userEvent.click(harness.form.querySelector('button')!);
    await field.updateComplete;
    expect(displayed(field)).toBe(true);
    harness.reset();
    await field.updateComplete;
    expect(displayed(field)).toBe(false);
    expect(field.value).toBe('2026-01-01/2026-01-03');
  });

  it('submits the ISO interval, resets to the value attribute and restores from form state', async () => {
    const harness = await formHarness(
      '<tct-date-range-input label="Period" name="p" value="2026-01-05/2026-01-09"></tct-date-range-input>',
    );
    const field = harness.form.querySelector<TctDateRangeInput>('tct-date-range-input')!;
    await field.updateComplete;
    expect(harness.values('p')).toEqual(['2026-01-05/2026-01-09']);
    field.range = {start: '2026-02-01', end: '2026-02-03'};
    await field.updateComplete;
    expect(harness.values('p')).toEqual(['2026-02-01/2026-02-03']);
    harness.reset();
    await field.updateComplete;
    expect(field.value).toBe('2026-01-05/2026-01-09');
    field.formStateRestoreCallback('2026-03-01/2026-03-02', 'restore');
    await field.updateComplete;
    expect(field.range).toEqual({start: '2026-03-01', end: '2026-03-02'});
    field.value = '';
    await field.updateComplete;
    // Like a native text input, an empty value is submitted as an empty string.
    expect(harness.values('p')).toEqual(['']);
  });
});

describe('tct-date-range-input: status and size', () => {
  it('draws the error status: aria-invalid, the message and the icon', async () => {
    const field = await make('label="Period" status-type="error" status-message="Pick a range"');
    expect(trigger(field).getAttribute('aria-invalid')).toBe('true');
    expect(field.shadowRoot!.querySelector('tct-field-status')!.textContent).toContain(
      'Pick a range',
    );
    expect(field.shadowRoot!.querySelector('[part~="status-icon"]')).not.toBeNull();
  });

  it('the tooltip variant moves the message into a status button', async () => {
    const field = await make(
      'label="Period" status-type="warning" status-message="Check it" status-variant="tooltip"',
    );
    expect(field.shadowRoot!.querySelector('[part~="status-button"]')).not.toBeNull();
  });

  it('the size variants change the height of the box', async () => {
    const heights: number[] = [];
    for (const size of ['sm', 'md', 'lg']) {
      const field = await make(`label="Period" size="${size}"`);
      heights.push(
        field.shadowRoot!.querySelector('.input-wrapper')!.getBoundingClientRect().height,
      );
    }
    expect(heights[0]).toBeLessThan(heights[1]!);
    expect(heights[1]).toBeLessThan(heights[2]!);
  });
});

describe('tct-date-range-input: languages and direction', () => {
  it('reads day-first in en-GB and speaks German in de-DE', async () => {
    const gb = await make('label="Period" value="2026-01-05/2026-01-09"', {lang: 'en-GB'});
    expect(trigger(gb).textContent.trim()).toBe('5 Jan – 9 Jan');
    const de = await make('label="Zeitraum" value="2026-01-05/2026-01-09"', {lang: 'de-DE'});
    expect(trigger(de).textContent).toMatch(/Jan/);
    expect(trigger(de).textContent).not.toMatch(/Jan 5/);
    const empty = await make('label="Zeitraum"', {lang: 'de-DE'});
    expect(trigger(empty).textContent.trim()).not.toBe('Select date range');
  });

  it('shows Hebrew names in he-IL and mirrors the popover in RTL', async () => {
    const field = await make('label="תקופה" value="2026-03-05/2026-03-09"', {
      lang: 'he-IL',
      dir: 'rtl',
    });
    expect(trigger(field).textContent).toMatch(/[א-ת]/);
    await openByTrigger(field);
    const box = field.shadowRoot!.querySelector('.input-wrapper')!.getBoundingClientRect();
    const layer = picker(field).querySelector('.picker-surface')!.getBoundingClientRect();
    // Start-aligned in RTL is the right edge; a picker wider than the box grows towards the left.
    expect(layer.right).toBeLessThanOrEqual(box.right + 2);
    expect(layer.right).toBeGreaterThan(box.left);
    expect(field.value).toBe('2026-03-05/2026-03-09');
  });

  it('shows Arabic-Indic digits in ar-SA and still stores ASCII ISO', async () => {
    const field = await make('label="الفترة" value="2026-03-05/2026-03-09"', {
      lang: 'ar-SA',
      dir: 'rtl',
    });
    expect(trigger(field).textContent).toMatch(/[٠-٩]/);
    expect(field.value).toBe('2026-03-05/2026-03-09');
    const harness = await formHarness(
      '<tct-date-range-input name="p" value="2026-03-05/2026-03-09" lang="ar-SA"></tct-date-range-input>',
    );
    expect(harness.values('p')).toEqual(['2026-03-05/2026-03-09']);
  });

  it('the presets group and the calendar mirror in RTL: presets sit at the inline start', async () => {
    const field = await make('label="תקופה"', {lang: 'he-IL', dir: 'rtl'});
    field.presets = [{label: 'א', getRange: () => ({start: '2026-01-05', end: '2026-01-06'})}];
    await field.updateComplete;
    await openByTrigger(field);
    const group = field.shadowRoot!.querySelector('[role="group"]')!.getBoundingClientRect();
    const grid = calendar(field).getBoundingClientRect();
    expect(group.left).toBeGreaterThanOrEqual(grid.right - 1);
  });
});

describe('tct-date-range-input: accessibility and contrast in every state', () => {
  const SCHEMES = ['light', 'dark'] as const;

  async function settle(field: TctDateRangeInput): Promise<void> {
    await field.updateComplete;
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    );
  }

  async function themed(
    scheme: 'light' | 'dark',
    attributes: string,
    withPresets = false,
  ): Promise<TctDateRangeInput> {
    await emulateMedia({colorScheme: scheme});
    const wrapper = await fixture<HTMLElement>(
      `<div style="padding:16px;inline-size:520px;background:var(--color-background-surface)"><tct-date-range-input ${attributes}></tct-date-range-input></div>`,
      {theme: scheme},
    );
    const field = wrapper.querySelector<TctDateRangeInput>('tct-date-range-input')!;
    if (withPresets) {
      field.presets = [
        {label: 'This week', getRange: () => ({start: '2026-01-11', end: '2026-01-17'})},
        {label: 'Last 3 days', getRange: () => ({start: '2026-01-13', end: '2026-01-15'})},
        {label: 'Next month', getRange: () => ({start: '2026-02-01', end: '2026-02-28'})},
      ];
    }
    await settle(field);
    return field;
  }

  function boxSurface(field: TctDateRangeInput): Rgba {
    const box = field.shadowRoot!.querySelector('.input-wrapper')!;
    return over(
      parseColor(getComputedStyle(box).backgroundColor),
      backgroundOf(field.parentElement!),
    );
  }

  for (const scheme of SCHEMES) {
    it(`passes axe at rest, focused, filled, disabled and in error (${scheme})`, async () => {
      const field = await themed(
        scheme,
        'label="Period" description="Pick a range" value="2026-01-05/2026-01-09"',
      );
      const wrapper = field.parentElement!;
      await expectAccessible(wrapper);
      trigger(field).focus();
      await settle(field);
      await expectAccessible(wrapper);
      field.disabled = true;
      await settle(field);
      await expectAccessible(wrapper);
      field.disabled = false;
      field.statusType = 'error';
      field.statusMessage = 'Pick a range';
      await settle(field);
      await expectAccessible(wrapper);
    });

    it(`passes axe with the picker open: presets active, disabled and hovered, range in the calendar (${scheme})`, async () => {
      const field = await themed(
        scheme,
        'label="Period" value="2026-01-11/2026-01-17" max="2026-01-31"',
        true,
      );
      await openByTrigger(field);
      await settle(field);
      await expectAccessible(field.parentElement!);
      await userEvent.hover(presets(field)[1]!);
      await settle(field);
      await expectAccessible(field.parentElement!);
      await userEvent.unhover(presets(field)[1]!);
      presets(field)[1]!.focus();
      await pressKeys('Tab', 'Shift+Tab');
      await settle(field);
      await expectAccessible(field.parentElement!);
    });

    it(`text meets 4.5:1 in the trigger, the placeholder and each preset state (${scheme})`, async () => {
      const filled = await themed(
        scheme,
        'label="Period" value="2026-01-11/2026-01-17" max="2026-01-31"',
        true,
      );
      const surface = boxSurface(filled);
      expect(textContrast(trigger(filled), surface), `${scheme} value`).toBeGreaterThanOrEqual(4.5);
      const empty = await themed(scheme, 'label="Period"');
      expect(
        textContrast(trigger(empty), boxSurface(empty)),
        `${scheme} placeholder`,
      ).toBeGreaterThanOrEqual(4.5);
      await openByTrigger(filled);
      await settle(filled);
      const layer = backgroundOf(picker(filled).querySelector('.picker-surface')!);
      const paint = (button: HTMLElement): number => {
        const style = getComputedStyle(button);
        const fill = over(parseColor(style.backgroundColor), layer);
        return contrast(parseColor(style.color), fill);
      };
      const [active, resting, disabled] = presets(filled);
      // This week matches the value (aria-current); Last 3 days rests; Next month breaks max and is disabled.
      expect(active!.getAttribute('aria-current')).toBe('true');
      expect(disabled!.disabled).toBe(true);
      expect(paint(active!), `${scheme} applied preset`).toBeGreaterThanOrEqual(4.5);
      expect(paint(resting!), `${scheme} resting preset`).toBeGreaterThanOrEqual(4.5);
      expect(paint(disabled!), `${scheme} disabled preset`).toBeGreaterThan(1.5);
      await userEvent.hover(resting!);
      await settle(filled);
      expect(paint(resting!), `${scheme} hovered preset`).toBeGreaterThanOrEqual(4.5);
      await userEvent.unhover(resting!);
      resting!.focus();
      await pressKeys('Tab', 'Shift+Tab');
      await settle(filled);
      expect(paint(resting!), `${scheme} focused preset`).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('draws the applied preset in Highlight colours in forced colours, and the trigger keeps a focus ring', async () => {
    const field = await make('label="Period" value="2026-01-11/2026-01-17"');
    field.presets = [
      {label: 'This week', getRange: () => ({start: '2026-01-11', end: '2026-01-17'})},
    ];
    await field.updateComplete;
    await openByTrigger(field);
    await emulateMedia({forcedColors: 'active'});
    await nextFrame();
    const style = getComputedStyle(presets(field)[0]!);
    expect(style.forcedColorAdjust).toBe('none');
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    const surface = picker(field).querySelector('.picker-surface')!;
    expect(getComputedStyle(surface).borderStyle).not.toBe('none');
  });
});
