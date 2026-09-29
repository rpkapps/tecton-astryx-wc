/**
 * tct-date-input: the element and form-control suites, rendering, and typing (text parsing in several
 * locales, drafts, constraints, Enter and IME). The picker, the sheet and native surfaces, validity timing
 * and contrast live in the sibling `tct-date-input.*.test.ts` files. Ported from upstream DateInput.test.tsx
 * where the behaviour applies.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {getAnnouncerRegions} from '@tecton-wc/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {axNode} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {formHarness} from '@tecton-wc/testing/forms.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-wc/testing/suites/form-control.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import '../field/define.js';
import '../form-layout/define.js';
import '../tooltip/define.js';
import './define.js';
import {inner, make, toggle, typeText, useFixedToday} from './fixtures/date-input-test-helpers.js';
import type {TctDateInput} from './tct-date-input.js';

useFixedToday();

runElementSuite({
  tag: 'tct-date-input',
  render: () => html`<tct-date-input label="Event date" name="d"></tct-date-input>`,
  properties: {
    label: 'Other',
    description: 'Help',
    placeholder: 'Pick',
    min: '2026-01-01',
    max: '2026-12-31',
    numberOfMonths: 2,
    weekStartsOn: 'mon',
    format: 'date',
    hasClear: true,
    size: 'lg',
    loading: true,
    width: 200,
    presentation: 'popover',
  },
  attributes: {
    label: 'label',
    description: 'description',
    placeholder: 'placeholder',
    min: 'min',
    max: 'max',
    numberOfMonths: 'number-of-months',
    weekStartsOn: 'week-starts-on',
    format: 'format',
    presentation: 'presentation',
  },
  events: ['tct-open-change', 'tct-after-open-change', 'tct-clear', 'tct-enter'],
});

runFormControlSuite({
  tag: 'tct-date-input',
  render: (attributes) => `<tct-date-input label="Field" ${attributes}></tct-date-input>`,
  validValue: '2026-03-21',
  submitsOnEnter: true,
  readonly: true,
  labelActivation: 'focus',
  innerFocusable: (element) => element.shadowRoot!.querySelector<HTMLElement>('input.input'),
  userEdit: async (element) => {
    const input = element.shadowRoot!.querySelector<HTMLInputElement>('input.input')!;
    await userEvent.click(input);
    await userEvent.clear(input);
    await userEvent.type(input, '2026-03-21');
    await pressKeys('Tab');
  },
});

describe('tct-date-input: rendering', () => {
  it('is a combobox text input with a calendar toggle, a placeholder and no value', async () => {
    const field = await make();
    const input = inner(field);
    expect(input.type).toBe('text');
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-haspopup')).toBe('dialog');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-autocomplete')).toBe('none');
    expect(input.placeholder).toBe('Select a date');
    expect(input.value).toBe('');
    expect(field.value).toBe('');
    expect(toggle(field).getAttribute('aria-label')).toBe('Open calendar');
    if (isChromium) {
      const node = await axNode(input);
      expect(node.role).toBe('combobox');
      expect(node.name).toContain('Event date');
    }
  });

  it('shows the committed date in the chosen format, in the language of the element', async () => {
    const field = await make('label="Event date" value="2026-03-21"');
    expect(inner(field).value).toBe('March 21, 2026');
    for (const [format, expected] of [
      ['date', 'Mar 21, 2026'],
      ['date_long', 'March 21, 2026'],
      ['date_weekday', 'Sat, Mar 21, 2026'],
      ['system_date', '2026-03-21'],
    ] as const) {
      field.format = format;
      await field.updateComplete;
      expect(inner(field).value, format).toBe(expected);
    }
    field.format = (iso) => `<${iso}>`;
    await field.updateComplete;
    expect(inner(field).value).toBe('<2026-03-21>');
    expect(field.value).toBe('2026-03-21');
  });

  it('reads the value property leniently: only a real ISO date is a value', async () => {
    const field = await make('label="Event date" value="2026-03-21"');
    field.value = 'yesterday';
    expect(field.value).toBe('');
    field.value = '2026-02-30';
    expect(field.value).toBe('');
    field.value = '2026-2-3';
    expect(field.value).toBe('2026-02-03');
    field.value = undefined as never;
    expect(field.value).toBe('');
  });

  it('shows a clear button only for an editable value, and clearing fires tct-clear, input and change', async () => {
    const field = await make('label="Event date" value="2026-03-21" has-clear');
    const clear = () => field.shadowRoot!.querySelector<HTMLElement>('tct-input-clear-button');
    expect(clear()).not.toBeNull();
    const events = recordEvents(field, ['tct-clear', 'input', 'change']);
    await userEvent.click(clear()!.shadowRoot!.querySelector('button')!);
    await field.updateComplete;
    expect(field.value).toBe('');
    expect(events.events.map((event) => event.type)).toEqual(['tct-clear', 'input', 'change']);
    expect(clear()).toBeNull();
    field.readonly = true;
    field.value = '2026-03-21';
    await field.updateComplete;
    expect(clear()).toBeNull();
  });

  it('keeps the value when tct-clear is prevented', async () => {
    const field = await make('label="Event date" value="2026-03-21" has-clear');
    field.addEventListener('tct-clear', (event) => event.preventDefault());
    const events = recordEvents(field, ['input', 'change']);
    await userEvent.click(
      field
        .shadowRoot!.querySelector('tct-input-clear-button')!
        .shadowRoot!.querySelector('button')!,
    );
    expect(field.value).toBe('2026-03-21');
    expect(events.events).toHaveLength(0);
  });
});

describe('tct-date-input: typing', () => {
  it('keeps the text as a draft while typing and commits it when the entry ends: one input, one change', async () => {
    const field = await make();
    const events = recordEvents(field, ['input', 'change']);
    await userEvent.click(inner(field));
    await userEvent.type(inner(field), '3/4/2027');
    await field.updateComplete;
    // Every prefix of a date is a date ("3/4" is this year's March 4): nothing is committed mid-entry.
    expect(field.value).toBe('');
    expect(events.events).toHaveLength(0);
    expect(inner(field).value).toBe('3/4/2027');
    await pressKeys('Tab');
    await field.updateComplete;
    expect(field.value).toBe('2027-03-04');
    expect(events.counts()).toEqual({input: 1, change: 1});
    expect(inner(field).value).toBe('March 4, 2027');
  });

  it('shows the invalid state only once typing has paused, and drops it when the text reads again', async () => {
    const field = await make();
    await userEvent.click(inner(field));
    await userEvent.type(inner(field), 'xyz');
    expect(inner(field).hasAttribute('aria-invalid')).toBe(false);
    await waitUntil(
      () => inner(field).getAttribute('aria-invalid') === 'true',
      'invalid after the pause',
    );
    await userEvent.clear(inner(field));
    await userEvent.type(inner(field), '2026-03-05');
    await waitUntil(() => !inner(field).hasAttribute('aria-invalid'), 'valid again');
  });

  it('reads month names, ISO dates and day-first numbers by the locale of the element', async () => {
    const field = await make('label="Event date"', {lang: 'en-GB'});
    await typeText(field, '3/4/2026');
    await pressKeys('Tab');
    expect(field.value).toBe('2026-04-03');
    await typeText(field, 'Jan 25, 2027');
    await pressKeys('Tab');
    expect(field.value).toBe('2027-01-25');
    await typeText(field, '2028-02-29');
    await pressKeys('Tab');
    expect(field.value).toBe('2028-02-29');
  });

  it('reads the text it displays back, in he-IL and ar-SA', async () => {
    for (const lang of ['he-IL', 'ar-SA']) {
      const field = await make('label="Event date" value="2026-03-21"', {lang, dir: 'rtl'});
      const shown = inner(field).value;
      expect(shown, lang).not.toBe('');
      await userEvent.click(inner(field));
      await userEvent.clear(inner(field));
      await userEvent.type(inner(field), shown);
      await pressKeys('Tab');
      expect(field.value, `${lang}: ${shown}`).toBe('2026-03-21');
      expect(inner(field).value).toBe(shown);
      await field.hide();
    }
  });

  it('shows Hebrew names and Arabic-Indic digits for the committed date (Gregorian calendar)', async () => {
    const hebrew = await make('label="תאריך" value="2026-03-21"', {lang: 'he-IL', dir: 'rtl'});
    expect(inner(hebrew).value).toMatch(/מרץ/u);
    const arabic = await make('label="التاريخ" value="2026-03-21"', {lang: 'ar-SA', dir: 'rtl'});
    expect(inner(arabic).value).toMatch(/مارس/u);
    expect(inner(arabic).value).toMatch(/[٠-٩]{4}/u);
    expect(arabic.value).toBe('2026-03-21');
  });

  it('clears the value when the text is emptied and the field is left', async () => {
    const field = await make('label="Event date" value="2026-03-21"');
    const events = recordEvents(field, ['input', 'change']);
    await typeText(field, '');
    await pressKeys('Tab');
    expect(field.value).toBe('');
    expect(events.counts()).toEqual({input: 1, change: 1});
  });

  it('drops text that is not a date when the field is left, says so while it stands, and fires nothing', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const field = await make('label="Event date" value="2026-03-21"');
      const events = recordEvents(field, ['input', 'change']);
      await typeText(field, 'abc');
      await waitUntil(
        () => inner(field).getAttribute('aria-invalid') === 'true',
        'invalid after the pause',
      );
      expect(field.validity.badInput).toBe(true);
      await waitUntil(
        () => getAnnouncerRegions().assertive?.textContent === 'Invalid date',
        'invalid date announced',
        3000,
      );
      await pressKeys('Tab');
      await field.updateComplete;
      expect(field.value).toBe('2026-03-21');
      expect(inner(field).value).toBe('March 21, 2026');
      expect(inner(field).hasAttribute('aria-invalid')).toBe(false);
      expect(events.events).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('refuses a real date that min, max or dateConstraints rule out, and says so', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const field = await make(
        'label="Event date" value="2026-03-21" min="2026-03-01" max="2026-03-31"',
      );
      await typeText(field, '2026-04-02');
      expect(field.value).toBe('2026-03-21');
      await waitUntil(
        () => inner(field).getAttribute('aria-invalid') === 'true',
        'invalid after the pause',
      );
      await waitUntil(
        () => getAnnouncerRegions().assertive?.textContent === 'This date is not available',
        'unavailable announced',
        3000,
      );
      await pressKeys('Tab');
      expect(inner(field).value).toBe('March 21, 2026');
      field.dateConstraints = [(date) => date.getDay() !== 0];
      await field.updateComplete;
      await typeText(field, '2026-03-22');
      await waitUntil(
        () => inner(field).getAttribute('aria-invalid') === 'true',
        'invalid after the pause',
      );
      expect(field.value).toBe('2026-03-21');
    } finally {
      restore();
    }
  });

  it('does not treat a partly typed year as a date', async () => {
    const field = await make('label="Event date"');
    await userEvent.click(inner(field));
    await userEvent.type(inner(field), '3/4/20');
    await pressKeys('Tab');
    // "3/4/20" is not a date (a year has four digits): nothing is committed, and the field goes back.
    expect(field.value).toBe('');
    expect(inner(field).value).toBe('');
  });

  it('Enter commits the text, fires tct-enter, and submits the form once', async () => {
    const form = await formHarness(
      '<tct-date-input label="Event date" name="d"></tct-date-input><button type="submit">Go</button>',
    );
    const field = form.form.querySelector<TctDateInput>('tct-date-input')!;
    await field.updateComplete;
    const enters = recordEvents(field, 'tct-enter');
    await userEvent.click(inner(field));
    await userEvent.type(inner(field), '2026-05-06');
    await pressKeys('Enter');
    expect(enters.events).toHaveLength(1);
    expect(form.submitEvents).toHaveLength(1);
    expect(form.values('d')).toEqual(['2026-05-06']);
    expect(inner(field).value).toBe('May 6, 2026');
  });

  it('an IME composition Enter is not a command', async () => {
    const field = await make('label="Event date"');
    const enters = recordEvents(field, 'tct-enter');
    await userEvent.click(inner(field));
    await userEvent.type(inner(field), '2026-05-06');
    inner(field).dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true,
        composed: true,
        cancelable: true,
      }),
    );
    expect(enters.events).toHaveLength(0);
    expect(inner(field).value).toBe('2026-05-06');
  });

  it('a property write never fires input or change and replaces a draft', async () => {
    const field = await make('label="Event date"');
    await userEvent.click(inner(field));
    await userEvent.type(inner(field), '3/4');
    const events = recordEvents(field, ['input', 'change']);
    field.value = '2026-06-07';
    await field.updateComplete;
    expect(inner(field).value).toBe('June 7, 2026');
    expect(events.events).toHaveLength(0);
  });
});
