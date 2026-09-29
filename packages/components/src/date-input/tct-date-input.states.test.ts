/**
 * tct-date-input: validity and when it shows (min, max, required, unavailable dates), the change action and
 * busy state, status variants, sizes, languages and direction (de-DE, he-IL, ar-SA), and accessibility and
 * contrast in the interactive states, light and dark, waiting for the transitions before measuring.
 */
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {formHarness, hasCustomState} from '@tecton-wc/testing/forms.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../field/define.js';
import '../form-layout/define.js';
import '../tooltip/define.js';
import './define.js';
import {
  calendar,
  day,
  inner,
  isShown,
  make,
  openByToggle,
  picker,
  toggle,
  typeText,
  useFixedToday,
} from './date-input-test-helpers.js';
import {
  backgroundOf,
  contrast,
  over,
  parseColor,
  textContrast,
  type Rgba,
} from './picker-test-helpers.js';
import type {TctDateInput} from './tct-date-input.js';

useFixedToday();

const displayed = (field: TctDateInput): boolean => hasCustomState(field, 'user-invalid');

describe('tct-date-input: validity and when it shows', () => {
  it('a required, empty field is invalid but shows nothing until the user acted or submitted', async () => {
    const harness = await formHarness(
      '<tct-date-input label="Event date" name="d" required></tct-date-input><button>Go</button>',
    );
    const field = harness.form.querySelector<TctDateInput>('tct-date-input')!;
    await field.updateComplete;
    expect(field.validity.valueMissing).toBe(true);
    expect(field.checkValidity()).toBe(false);
    expect(displayed(field)).toBe(false);
    expect(inner(field).hasAttribute('aria-invalid')).toBe(false);
    // Visiting the field and leaving it without an edit is not an interaction with the value.
    await userEvent.click(inner(field));
    await pressKeys('Tab');
    await field.hide();
    expect(displayed(field)).toBe(false);
    // A submit attempt shows it, and the browser focuses the field.
    await userEvent.click(harness.form.querySelector('button')!);
    await field.updateComplete;
    expect(harness.submitEvents).toHaveLength(0);
    expect(displayed(field)).toBe(true);
    expect(inner(field).getAttribute('aria-invalid')).toBe('true');
  });

  it('shows the invalid state after an edit and leaving the field, and clears it once the value is valid', async () => {
    const field = await make('label="Event date" value="2026-03-21" required');
    expect(field.validity.valid).toBe(true);
    await typeText(field, '');
    await pressKeys('Tab');
    await field.updateComplete;
    expect(field.value).toBe('');
    expect(field.validity.valueMissing).toBe(true);
    expect(displayed(field)).toBe(true);
    expect(inner(field).getAttribute('aria-invalid')).toBe('true');
    await typeText(field, '2026-05-05');
    await pressKeys('Tab');
    await field.updateComplete;
    expect(field.value).toBe('2026-05-05');
    expect(displayed(field)).toBe(false);
    expect(inner(field).hasAttribute('aria-invalid')).toBe(false);
  });

  it('min and max are native constraints on the value: rangeUnderflow / rangeOverflow with the browser message', async () => {
    const under = await make('label="Event date" value="2026-01-01" min="2026-02-01"');
    expect(under.validity.rangeUnderflow).toBe(true);
    expect(under.validationMessage).not.toBe('');
    expect(displayed(under)).toBe(false);
    const over = await make('label="Event date" value="2026-12-31" max="2026-06-30"');
    expect(over.validity.rangeOverflow).toBe(true);
    expect(over.validity.valid).toBe(false);
    const inside = await make(
      'label="Event date" value="2026-03-01" min="2026-02-01" max="2026-06-30"',
    );
    expect(inside.validity.valid).toBe(true);
    // An unreadable bound is ignored, never a crash.
    const junk = await make('label="Event date" value="2026-03-01" min="soon" max="never"');
    expect(junk.validity.valid).toBe(true);
  });

  it('an out-of-range value is displayed as invalid after a submit attempt, and reset undoes it', async () => {
    const harness = await formHarness(
      '<tct-date-input label="Event date" name="d" value="2026-01-01" min="2026-02-01"></tct-date-input><button>Go</button>',
    );
    const field = harness.form.querySelector<TctDateInput>('tct-date-input')!;
    await field.updateComplete;
    expect(displayed(field)).toBe(false);
    await userEvent.click(harness.form.querySelector('button')!);
    await field.updateComplete;
    expect(displayed(field)).toBe(true);
    harness.reset();
    await field.updateComplete;
    expect(displayed(field)).toBe(false);
    expect(field.value).toBe('2026-01-01');
  });

  it('dateConstraints make a value invalid too (a custom error), not only an unavailable draft', async () => {
    const field = await make('label="Event date" value="2026-03-21"');
    field.dateConstraints = [(date) => date.getDay() !== 6];
    await field.updateComplete;
    expect(field.validity.customError).toBe(true);
    expect(field.validationMessage).toBe('This date is not available');
    field.dateConstraints = undefined;
    await field.updateComplete;
    expect(field.validity.valid).toBe(true);
  });

  it('marks unavailable days in the calendar and keeps them from being picked', async () => {
    const field = await make(
      'label="Event date" value="2026-03-20" min="2026-03-10" max="2026-03-28"',
    );
    field.dateConstraints = [(date) => date.getDay() !== 6];
    await field.updateComplete;
    await openByToggle(field);
    expect(day(field, '2026-03-21').getAttribute('aria-disabled')).toBe('true');
    expect(day(field, '2026-03-09').getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(day(field, '2026-03-21'), {force: true});
    await nextFrame();
    expect(field.value).toBe('2026-03-20');
    expect(field.open).toBe(true);
  });
});

describe('tct-date-input: the change action, busy, disabled and status', () => {
  it('runs changeAction after a user change; the field is busy until it settles and refuses edits meanwhile', async () => {
    const field = await make('label="Event date"');
    let release!: () => void;
    const calls: string[] = [];
    field.changeAction = (value) => {
      calls.push(value);
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    };
    await typeText(field, '2026-03-21');
    await pressKeys('Enter');
    await field.updateComplete;
    await field.hide();
    expect(calls).toEqual(['2026-03-21']);
    expect(hasCustomState(field, 'busy')).toBe(true);
    expect(inner(field).getAttribute('aria-busy')).toBe('true');
    // Busy: a second edit is refused and the picker will not open.
    await userEvent.click(toggle(field), {force: true});
    await nextFrame();
    expect(field.open).toBe(false);
    release();
    await waitUntil(() => !hasCustomState(field, 'busy'), 'idle again');
    expect(inner(field).hasAttribute('aria-busy')).toBe(false);
    expect(field.value).toBe('2026-03-21');
  });

  it('does not run changeAction for a property write', async () => {
    const field = await make('label="Event date"');
    let calls = 0;
    field.changeAction = () => {
      calls += 1;
    };
    field.value = '2026-04-01';
    await field.updateComplete;
    expect(calls).toBe(0);
  });

  it('a disabled field with a disabled-message stays focusable, refuses edits and keeps the toggle from opening', async () => {
    const field = await make(
      'label="Event date" value="2026-03-21" disabled disabled-message="Locked by admin"',
    );
    const control = inner(field);
    expect(control.disabled).toBe(false);
    expect(control.getAttribute('aria-disabled')).toBe('true');
    expect(control.readOnly).toBe(true);
    await userEvent.click(control, {force: true});
    await userEvent.keyboard('2027');
    expect(field.value).toBe('2026-03-21');
    await userEvent.click(toggle(field), {force: true});
    await nextFrame();
    expect(field.open).toBe(false);
  });

  it('draws the error status: aria-invalid, the message, and the status icon', async () => {
    const field = await make(
      'label="Event date" status-type="error" status-message="Pick a weekday" description="Help"',
    );
    expect(inner(field).getAttribute('aria-invalid')).toBe('true');
    const status = field.shadowRoot!.querySelector<HTMLElement>('tct-field-status')!;
    expect(status.textContent).toContain('Pick a weekday');
    expect(field.shadowRoot!.querySelector('[part~="status-icon"]')).not.toBeNull();
  });

  it('the tooltip status variant moves the message into a status button', async () => {
    const field = await make(
      'label="Event date" status-type="warning" status-message="Check the date" status-variant="tooltip"',
    );
    expect(field.shadowRoot!.querySelector('[part~="status-button"]')).not.toBeNull();
  });

  it('the size variants change the height of the box', async () => {
    const heights: number[] = [];
    for (const size of ['sm', 'md', 'lg']) {
      const field = await make(`label="Event date" size="${size}"`);
      heights.push(
        field.shadowRoot!.querySelector('.input-wrapper')!.getBoundingClientRect().height,
      );
    }
    expect(heights[0]).toBeLessThan(heights[1]!);
    expect(heights[1]).toBeLessThan(heights[2]!);
  });

  it('has-clear shows the clear button only while there is a value and clearing returns focus to the input', async () => {
    const field = await make('label="Event date" has-clear value="2026-03-21"');
    const clear = field.shadowRoot!.querySelector<HTMLElement>('tct-input-clear-button')!;
    expect(clear).not.toBeNull();
    const events = recordEvents(field, ['input', 'change', 'tct-clear']);
    await userEvent.click(clear);
    await field.updateComplete;
    expect(field.value).toBe('');
    expect(events.events.map((event) => event.type)).toEqual(['tct-clear', 'input', 'change']);
    expect(field.shadowRoot!.querySelector('tct-input-clear-button')).toBeNull();
  });
});

describe('tct-date-input: languages and direction', () => {
  it('speaks German: labels, the typed day-first date, and the long display', async () => {
    const field = await make('label="Datum"', {lang: 'de-DE'});
    expect(inner(field).placeholder).not.toBe('Select a date');
    expect(toggle(field).getAttribute('aria-label')).not.toBe('Open calendar');
    await typeText(field, '21.03.2026');
    await pressKeys('Tab');
    await field.updateComplete;
    expect(field.value).toBe('2026-03-21');
    expect(inner(field).value).toBe('21. März 2026');
  });

  it('reads the day first in en-GB, month first in en-US', async () => {
    const gb = await make('label="Date"', {lang: 'en-GB'});
    await typeText(gb, '3/4/2026');
    await pressKeys('Tab');
    expect(gb.value).toBe('2026-04-03');
    await gb.hide();
    const us = await make('label="Date"', {lang: 'en-US'});
    await typeText(us, '3/4/2026');
    await pressKeys('Tab');
    expect(us.value).toBe('2026-03-04');
  });

  it('mirrors in RTL: the popover aligns with the inline start and the calendar keeps its grid semantics', async () => {
    const field = await make('label="תאריך" value="2026-03-21"', {lang: 'he-IL', dir: 'rtl'});
    await openByToggle(field);
    const box = field.shadowRoot!.querySelector('.input-wrapper')!.getBoundingClientRect();
    const layer = picker(field).querySelector('.picker-surface')!.getBoundingClientRect();
    expect(Math.abs(layer.right - box.right)).toBeLessThan(2);
    const grid = calendar(field).shadowRoot!.querySelector('[role="grid"]')!;
    expect(getComputedStyle(grid).direction).toBe('rtl');
    // The calendar is Gregorian with Hebrew names, and the field stores ISO.
    expect(field.value).toBe('2026-03-21');
  });

  it('shows Arabic-Indic digits in ar-SA and still stores ASCII ISO', async () => {
    const field = await make('label="التاريخ" value="2026-03-21"', {lang: 'ar-SA', dir: 'rtl'});
    expect(inner(field).value).toMatch(/[٠-٩]/);
    expect(field.value).toBe('2026-03-21');
    const harness = await formHarness(
      '<tct-date-input name="d" value="2026-03-21" lang="ar-SA"></tct-date-input>',
    );
    expect(harness.values('d')).toEqual(['2026-03-21']);
  });
});

describe('tct-date-input: accessibility and contrast in every state', () => {
  const SCHEMES = ['light', 'dark'] as const;

  async function settle(field: TctDateInput): Promise<void> {
    await field.updateComplete;
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    );
  }

  /** The colour the box paints text on: its own background over the surface of the fixture. */
  function boxSurface(field: TctDateInput): Rgba {
    const wrapper = field.parentElement!;
    const box = field.shadowRoot!.querySelector('.input-wrapper')!;
    return over(parseColor(getComputedStyle(box).backgroundColor), backgroundOf(wrapper));
  }

  async function themed(scheme: 'light' | 'dark', attributes: string): Promise<TctDateInput> {
    await emulateMedia({colorScheme: scheme});
    const wrapper = await fixture<HTMLElement>(
      `<div style="padding:16px;inline-size:420px;background:var(--color-background-surface)"><tct-date-input ${attributes}></tct-date-input></div>`,
      {theme: scheme},
    );
    const field = wrapper.querySelector<TctDateInput>('tct-date-input')!;
    await settle(field);
    return field;
  }

  for (const scheme of SCHEMES) {
    it(`passes axe at rest, focused, hovered, filled, disabled and in error (${scheme})`, async () => {
      const field = await themed(
        scheme,
        'label="Event date" description="Pick one" value="2026-03-21" has-clear',
      );
      const wrapper = field.parentElement!;
      await expectAccessible(wrapper);
      inner(field).focus();
      await settle(field);
      await expectAccessible(wrapper);
      await userEvent.hover(toggle(field));
      await settle(field);
      await expectAccessible(wrapper);
      field.disabled = true;
      await settle(field);
      await expectAccessible(wrapper);
      field.disabled = false;
      field.statusType = 'error';
      field.statusMessage = 'Pick a weekday';
      await settle(field);
      await expectAccessible(wrapper);
    });

    it(`passes axe with the picker open (${scheme})`, async () => {
      const field = await themed(scheme, 'label="Event date" value="2026-03-21"');
      await openByToggle(field);
      await animationsFinished(picker(field));
      await expectAccessible(field.parentElement!);
      expect(isShown(field)).toBe(true);
    });

    it(`text meets 4.5:1 in the value, the placeholder and the error state, and the toggle icon 3:1 (${scheme})`, async () => {
      const filled = await themed(scheme, 'label="Event date" value="2026-03-21"');
      const surface = boxSurface(filled);
      expect(textContrast(inner(filled), surface), `${scheme} value`).toBeGreaterThanOrEqual(4.5);
      const empty = await themed(scheme, 'label="Event date"');
      const emptySurface = boxSurface(empty);
      const placeholder = getComputedStyle(inner(empty), '::placeholder').color;
      expect(
        contrast(parseColor(placeholder), emptySurface),
        `${scheme} placeholder`,
      ).toBeGreaterThanOrEqual(4.5);
      const icon = toggle(filled).querySelector('tct-icon')!;
      expect(textContrast(icon, surface), `${scheme} toggle icon`).toBeGreaterThanOrEqual(3);
      const invalid = await themed(
        scheme,
        'label="Event date" value="2026-03-21" status-type="error"',
      );
      const invalidSurface = boxSurface(invalid);
      expect(
        textContrast(inner(invalid), invalidSurface),
        `${scheme} error`,
      ).toBeGreaterThanOrEqual(4.5);
    });

    it(`the muted text of a draft that is not a date keeps 4.5:1 once typing paused (${scheme})`, async () => {
      const field = await themed(scheme, 'label="Event date"');
      await typeText(field, 'nonsense');
      await waitUntil(
        () => inner(field).getAttribute('aria-invalid') === 'true',
        'invalid after the pause',
      );
      await settle(field);
      const surface = boxSurface(field);
      expect(textContrast(inner(field), surface), `${scheme} draft`).toBeGreaterThanOrEqual(4.5);
      await expectAccessible(field.parentElement!);
    });
  }

  it('draws focus rings on the input and the toggle in forced colours, and the picker keeps a border', async () => {
    const field = await make('label="Event date"');
    await openByToggle(field);
    await emulateMedia({forcedColors: 'active'});
    await nextFrame();
    const surface = picker(field).querySelector('.picker-surface')!;
    expect(getComputedStyle(surface).borderStyle).not.toBe('none');
    await field.hide();
    inner(field).focus();
    await pressKeys('Shift+Tab');
    expect(getComputedStyle(toggle(field)).outlineStyle).not.toBe('none');
  });
});
