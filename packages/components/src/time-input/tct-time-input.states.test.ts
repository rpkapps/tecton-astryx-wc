/**
 * tct-time-input: validity and when it shows (required, min, max), the change action and busy state, status
 * and sizes, languages and direction (de-DE, en-GB, he-IL, ar-SA), and accessibility and contrast in the
 * interactive states of the field and of the touch sheet, light and dark, waiting for the transitions before
 * measuring.
 */
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
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
  closeSheet,
  inner,
  make,
  openSheet,
  option,
  panel,
  sheet,
  toggle,
  typeText,
  useFixedToday,
} from './time-input-test-helpers.js';
import type {TctTimeInput} from './tct-time-input.js';

useFixedToday();

const displayed = (field: TctTimeInput): boolean => hasCustomState(field, 'user-invalid');

describe('tct-time-input: validity and when it shows', () => {
  it('a required, empty field is invalid but shows nothing until a submit attempt', async () => {
    const harness = await formHarness(
      '<tct-time-input label="Start time" name="t" required></tct-time-input><button>Go</button>',
    );
    const field = harness.form.querySelector<TctTimeInput>('tct-time-input')!;
    await field.updateComplete;
    expect(field.validity.valueMissing).toBe(true);
    expect(field.checkValidity()).toBe(false);
    expect(displayed(field)).toBe(false);
    expect(inner(field).hasAttribute('aria-invalid')).toBe(false);
    expect(inner(field).getAttribute('aria-required')).toBe('true');
    // Visiting the field and leaving it without an edit is not an interaction with the value.
    await userEvent.click(inner(field));
    await pressKeys('Tab');
    expect(displayed(field)).toBe(false);
    await userEvent.click(harness.form.querySelector('button')!);
    await field.updateComplete;
    expect(harness.submitEvents).toHaveLength(0);
    expect(displayed(field)).toBe(true);
    expect(inner(field).getAttribute('aria-invalid')).toBe('true');
  });

  it('shows the invalid state after an edit and leaving the field, and clears it once the value is valid', async () => {
    const field = await make('label="Start time" value="14:30" required');
    expect(field.validity.valid).toBe(true);
    await typeText(field, '');
    await pressKeys('Tab');
    await field.updateComplete;
    expect(field.validity.valueMissing).toBe(true);
    expect(displayed(field)).toBe(true);
    expect(inner(field).getAttribute('aria-invalid')).toBe('true');
    await typeText(field, '9am');
    await pressKeys('Tab');
    await field.updateComplete;
    expect(field.value).toBe('09:00');
    expect(displayed(field)).toBe(false);
  });

  it('min and max are native constraints on the value: rangeUnderflow / rangeOverflow with a message', async () => {
    const under = await make('label="Start time" value="08:00" min="09:00"');
    expect(under.validity.rangeUnderflow).toBe(true);
    expect(under.validationMessage).not.toBe('');
    expect(displayed(under)).toBe(false);
    const over = await make('label="Start time" value="18:00" max="17:00"');
    expect(over.validity.rangeOverflow).toBe(true);
    expect(over.validity.valid).toBe(false);
    const inside = await make('label="Start time" value="10:00" min="09:00" max="17:00"');
    expect(inside.validity.valid).toBe(true);
    const junk = await make('label="Start time" value="10:00" min="soon" max="never"');
    expect(junk.validity.valid).toBe(true);
    // A bound at the edge of the day has no time beyond it, and is still a bound.
    const edge = await make('label="Start time" value="10:00" max="00:00"');
    expect(edge.validity.rangeOverflow).toBe(true);
  });

  it('an out-of-range value is displayed as invalid after a submit attempt, and reset undoes it', async () => {
    const harness = await formHarness(
      '<tct-time-input label="Start time" name="t" value="08:00" min="09:00"></tct-time-input><button>Go</button>',
    );
    const field = harness.form.querySelector<TctTimeInput>('tct-time-input')!;
    await field.updateComplete;
    expect(displayed(field)).toBe(false);
    await userEvent.click(harness.form.querySelector('button')!);
    await field.updateComplete;
    expect(displayed(field)).toBe(true);
    harness.reset();
    await field.updateComplete;
    expect(displayed(field)).toBe(false);
    expect(field.value).toBe('08:00');
  });

  it('submits the ISO time, resets to the value attribute and restores from form state', async () => {
    const harness = await formHarness(
      '<tct-time-input label="Start time" name="t" value="14:30"></tct-time-input>',
    );
    const field = harness.form.querySelector<TctTimeInput>('tct-time-input')!;
    await field.updateComplete;
    expect(harness.values('t')).toEqual(['14:30']);
    field.value = '09:15';
    await field.updateComplete;
    expect(harness.values('t')).toEqual(['09:15']);
    harness.reset();
    await field.updateComplete;
    expect(field.value).toBe('14:30');
    field.formStateRestoreCallback('16:45', 'restore');
    await field.updateComplete;
    expect(field.value).toBe('16:45');
    field.value = '';
    await field.updateComplete;
    expect(harness.values('t')).toEqual(['']);
  });
});

describe('tct-time-input: the change action, disabled, status and size', () => {
  it('runs changeAction after a user change; busy until it settles, refusing edits meanwhile', async () => {
    const field = await make('label="Start time"');
    let release!: () => void;
    const calls: string[] = [];
    field.changeAction = (value) => {
      calls.push(value);
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    };
    await typeText(field, '3pm');
    await pressKeys('Enter');
    await field.updateComplete;
    expect(calls).toEqual(['15:00']);
    expect(hasCustomState(field, 'busy')).toBe(true);
    expect(inner(field).getAttribute('aria-busy')).toBe('true');
    inner(field).focus();
    await pressKeys('ArrowUp');
    expect(field.value).toBe('15:00');
    release();
    await waitUntil(() => !hasCustomState(field, 'busy'), 'idle again');
    expect(inner(field).hasAttribute('aria-busy')).toBe(false);
  });

  it('does not run changeAction for a property write', async () => {
    const field = await make('label="Start time"');
    let calls = 0;
    field.changeAction = () => {
      calls += 1;
    };
    field.value = '10:00';
    await field.updateComplete;
    expect(calls).toBe(0);
  });

  it('a disabled field with a disabled-message stays focusable, refuses edits and shows no format hint', async () => {
    const field = await make('label="Start time" value="14:30" disabled disabled-message="Locked"');
    const control = inner(field);
    expect(control.disabled).toBe(false);
    expect(control.getAttribute('aria-disabled')).toBe('true');
    expect(control.readOnly).toBe(true);
    control.focus();
    await userEvent.keyboard('9');
    expect(field.value).toBe('14:30');
    expect(control.placeholder).toBe('Select a time');
  });

  it('draws the error status: aria-invalid, the message, and the status icon', async () => {
    const field = await make(
      'label="Start time" status-type="error" status-message="Pick a time" description="Help"',
    );
    expect(inner(field).getAttribute('aria-invalid')).toBe('true');
    expect(field.shadowRoot!.querySelector('tct-field-status')!.textContent).toContain(
      'Pick a time',
    );
    expect(field.shadowRoot!.querySelector('[part~="status-icon"]')).not.toBeNull();
    const tooltip = await make(
      'label="Start time" status-type="warning" status-message="Check it" status-variant="tooltip"',
    );
    expect(tooltip.shadowRoot!.querySelector('[part~="status-button"]')).not.toBeNull();
  });

  it('the size variants change the height of the box', async () => {
    const heights: number[] = [];
    for (const size of ['sm', 'md', 'lg']) {
      const field = await make(`label="Start time" size="${size}"`);
      heights.push(
        field.shadowRoot!.querySelector('.input-wrapper')!.getBoundingClientRect().height,
      );
    }
    expect(heights[0]).toBeLessThan(heights[1]!);
    expect(heights[1]).toBeLessThan(heights[2]!);
  });

  it('focuses itself on load with autofocus', async () => {
    const field = await make('label="Start time" autofocus');
    await waitUntil(() => field.shadowRoot!.activeElement === inner(field), 'focused');
  });
});

describe('tct-time-input: languages and direction', () => {
  it('reads 24-hour text in en-GB and de-DE, and shows the localized 12-hour markers', async () => {
    const gb = await make('label="Start time" hour-format="24h"', {lang: 'en-GB'});
    await typeText(gb, '1430');
    await pressKeys('Tab');
    expect(gb.value).toBe('14:30');
    expect(inner(gb).value).toBe('14:30');
    const de = await make('label="Startzeit" hour-format="24h" value="14:30"', {lang: 'de-DE'});
    expect(inner(de).value).toBe('14:30');
    expect(inner(de).placeholder).not.toBe('Select a time');
  });

  it('reads Arabic-Indic digits and the ar-SA markers, and stores ASCII', async () => {
    const field = await make('label="وقت البدء" value="14:30"', {lang: 'ar-SA', dir: 'rtl'});
    expect(inner(field).value).toMatch(/[٠-٩]/);
    const shown = inner(field).value;
    await typeText(field, shown);
    await pressKeys('Tab');
    expect(field.value).toBe('14:30');
    const harness = await formHarness(
      '<tct-time-input name="t" value="14:30" lang="ar-SA"></tct-time-input>',
    );
    expect(harness.values('t')).toEqual(['14:30']);
  });

  it('reads back what it shows in he-IL', async () => {
    const field = await make('label="שעת התחלה" value="14:30" hour-format="24h"', {
      lang: 'he-IL',
      dir: 'rtl',
    });
    const shown = inner(field).value;
    expect(shown).not.toBe('');
    await typeText(field, shown);
    await pressKeys('Tab');
    expect(field.value).toBe('14:30');
  });

  it('mirrors in RTL: the clock sits at the inline start, the text is start-aligned', async () => {
    const field = await make('label="שעת התחלה" value="14:30"', {lang: 'he-IL', dir: 'rtl'});
    const clock = field.shadowRoot!.querySelector('tct-icon.clock')!.getBoundingClientRect();
    const box = field.shadowRoot!.querySelector('.input-wrapper')!.getBoundingClientRect();
    expect(clock.right).toBeGreaterThan(box.left + box.width / 2);
    expect(getComputedStyle(inner(field)).direction).toBe('rtl');
  });

  it('the sheet columns show the reader’s digits and markers in ar-SA', async () => {
    const field = await make('label="وقت البدء" value="14:30" presentation="bottom-sheet"', {
      lang: 'ar-SA',
      dir: 'rtl',
    });
    await openSheet(field);
    expect(option(field, 'hour', 2).textContent.trim()).toMatch(/[٠-٩]/);
    expect(option(field, 'minute', 5).textContent.trim()).toBe('٠٥');
    expect(option(field, 'meridiem', 1).textContent.trim()).not.toBe('PM');
  });
});

describe('tct-time-input: accessibility and contrast in every state', () => {
  const SCHEMES = ['light', 'dark'] as const;

  async function settle(field: TctTimeInput): Promise<void> {
    await field.updateComplete;
    await Promise.all(
      document.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
    );
  }

  async function themed(scheme: 'light' | 'dark', attributes: string): Promise<TctTimeInput> {
    await emulateMedia({colorScheme: scheme});
    const wrapper = await fixture<HTMLElement>(
      `<div style="padding:16px;inline-size:420px;background:var(--color-background-surface)"><tct-time-input ${attributes}></tct-time-input></div>`,
      {theme: scheme},
    );
    const field = wrapper.querySelector<TctTimeInput>('tct-time-input')!;
    await settle(field);
    return field;
  }

  function boxSurface(field: TctTimeInput): Rgba {
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
        'label="Start time" description="Pick one" value="14:30" has-clear',
      );
      const wrapper = field.parentElement!;
      await expectAccessible(wrapper);
      inner(field).focus();
      await settle(field);
      await expectAccessible(wrapper);
      field.disabled = true;
      await settle(field);
      await expectAccessible(wrapper);
      field.disabled = false;
      field.statusType = 'error';
      field.statusMessage = 'Pick a time';
      await settle(field);
      await expectAccessible(wrapper);
    });

    it(`text meets 4.5:1 in the value, the placeholder, the error state and the muted draft (${scheme})`, async () => {
      const filled = await themed(scheme, 'label="Start time" value="14:30"');
      expect(
        textContrast(inner(filled), boxSurface(filled)),
        `${scheme} value`,
      ).toBeGreaterThanOrEqual(4.5);
      const empty = await themed(scheme, 'label="Start time"');
      const placeholder = getComputedStyle(inner(empty), '::placeholder').color;
      expect(
        contrast(parseColor(placeholder), boxSurface(empty)),
        `${scheme} placeholder`,
      ).toBeGreaterThanOrEqual(4.5);
      const invalid = await themed(scheme, 'label="Start time" value="14:30" status-type="error"');
      expect(
        textContrast(inner(invalid), boxSurface(invalid)),
        `${scheme} error`,
      ).toBeGreaterThanOrEqual(4.5);
      await typeText(empty, 'nonsense');
      await waitUntil(
        () => inner(empty).getAttribute('aria-invalid') === 'true',
        'invalid after the pause',
      );
      await settle(empty);
      expect(
        textContrast(inner(empty), boxSurface(empty)),
        `${scheme} draft`,
      ).toBeGreaterThanOrEqual(4.5);
      await expectAccessible(empty.parentElement!);
    });

    it(`the touch sheet passes axe, and its options meet 4.5:1 selected, resting, hovered, focused and disabled (${scheme})`, async () => {
      const field = await themed(
        scheme,
        'label="Start time" value="10:30" min="09:00" max="17:00" presentation="bottom-sheet"',
      );
      await openSheet(field);
      await settle(field);
      await expectAccessible(sheet(field)!);
      const layer = backgroundOf(
        sheet(field)!.shadowRoot!.querySelector('.sheet') ?? sheet(field)!,
      );
      const surface = layer.a === 0 ? backgroundOf(document.body) : layer;
      const paint = (element: HTMLElement): number => {
        const style = getComputedStyle(element);
        return contrast(parseColor(style.color), over(parseColor(style.backgroundColor), surface));
      };
      const selected = option(field, 'hour', 10);
      const resting = option(field, 'minute', 45);
      const disabled = option(field, 'hour', 8);
      expect(selected.getAttribute('aria-selected')).toBe('true');
      expect(paint(selected), `${scheme} selected`).toBeGreaterThanOrEqual(4.5);
      expect(paint(resting), `${scheme} resting`).toBeGreaterThanOrEqual(4.5);
      expect(paint(disabled), `${scheme} disabled`).toBeGreaterThan(1.5);
      await userEvent.hover(resting);
      await settle(field);
      expect(paint(resting), `${scheme} hovered`).toBeGreaterThanOrEqual(4.5);
      await userEvent.hover(selected);
      await settle(field);
      expect(paint(selected), `${scheme} selected and hovered`).toBeGreaterThanOrEqual(4.5);
      await userEvent.unhover(selected);
      resting.focus();
      await pressKeys('ArrowUp', 'ArrowDown');
      await settle(field);
      expect(paint(option(field, 'minute', 45)), `${scheme} focused`).toBeGreaterThanOrEqual(4.5);
      await expectAccessible(sheet(field)!);
    });
  }

  it('draws the selected option in Highlight colours in forced colours, and the toggle keeps a focus ring', async () => {
    const field = await make('label="Start time" value="10:30" presentation="bottom-sheet"');
    await openSheet(field);
    await emulateMedia({forcedColors: 'active'});
    await nextFrame();
    const style = getComputedStyle(option(field, 'hour', 10));
    expect(style.forcedColorAdjust).toBe('none');
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    await closeSheet(field);
    inner(field).focus();
    await pressKeys('Shift+Tab');
    expect(getComputedStyle(toggle(field)).outlineStyle).not.toBe('none');
    expect(panel(field)).not.toBeNull();
  });

  it('the panel keeps its options from the change event of another field', async () => {
    const field = await make('label="Start time" value="10:30" presentation="bottom-sheet"');
    await openSheet(field);
    const events = recordEvents(field, 'change');
    await userEvent.click(option(field, 'minute', 5));
    expect(events.events).toHaveLength(1);
  });
});
