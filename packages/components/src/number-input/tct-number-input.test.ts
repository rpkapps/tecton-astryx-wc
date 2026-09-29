/**
 * tct-number-input: the element and form-control suites, then rendering, the draft and commit policy,
 * locale parsing (German `1.234,5`), IME full-width digits, stepping by key, wheel and button, clear,
 * units, formatValue, status, disabled reason, RTL, forced colours, axe and i18n. Ported from upstream
 * NumberInput.test.tsx where the behaviour applies.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {getAnnouncerRegions} from '@tecton-astryx/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-astryx/core/features.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {recordEvents} from '@tecton-astryx/testing/events.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {formHarness, hasCustomState} from '@tecton-astryx/testing/forms.js';
import {pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-astryx/testing/suites/form-control.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import '../field/define.js';
import '../tooltip/define.js';
import './define.js';
import type {TctNumberInput} from './tct-number-input.js';

const inner = (field: TctNumberInput): HTMLInputElement =>
  field.shadowRoot!.querySelector<HTMLInputElement>('input.input')!;
const part = (field: TctNumberInput, name: string): HTMLElement | null =>
  field.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`);

async function make(attributes = 'label="Quantity"', lang?: string): Promise<TctNumberInput> {
  const wrapper = await fixture<HTMLElement>(
    `<div ${lang ? `lang="${lang}"` : ''} style="padding:40px;inline-size:420px"><tct-number-input ${attributes}></tct-number-input></div>`,
  );
  const field = wrapper.querySelector<TctNumberInput>('tct-number-input')!;
  await field.updateComplete;
  await nextFrame();
  return field;
}

/** Types `text` into the field (replacing what is there) and leaves it, which commits. */
async function typeAndLeave(field: TctNumberInput, text: string): Promise<void> {
  await userEvent.click(inner(field));
  await userEvent.clear(inner(field));
  if (text) await userEvent.type(inner(field), text);
  await pressKeys('Tab');
  await field.updateComplete;
}

runElementSuite({
  tag: 'tct-number-input',
  render: () => html`<tct-number-input label="Quantity" name="q"></tct-number-input>`,
  properties: {
    label: 'Other',
    description: 'Help',
    placeholder: 'Type',
    min: 1,
    max: 9,
    step: 2,
    integerOnly: true,
    units: 'kg',
    hasClear: true,
    hasSteppers: true,
    size: 'lg',
    loading: true,
    width: 200,
  },
  attributes: {
    label: 'label',
    description: 'description',
    placeholder: 'placeholder',
    min: 'min',
    max: 'max',
    step: 'step',
    integerOnly: 'integer-only',
    units: 'units',
  },
});

runFormControlSuite({
  tag: 'tct-number-input',
  render: (attributes) => `<tct-number-input label="Field" ${attributes}></tct-number-input>`,
  validValue: '42',
  submitsOnEnter: true,
  readonly: true,
  labelActivation: 'focus',
  userEdit: async (element) => {
    const input = element.shadowRoot!.querySelector<HTMLInputElement>('input.input')!;
    await userEvent.click(input);
    await userEvent.type(input, '7');
    await pressKeys('Tab');
  },
});

describe('tct-number-input: rendering', () => {
  it('is a spinbutton text input with the value, range and mode', async () => {
    const field = await make('label="Quantity" value="5" min="1" max="10"');
    const input = inner(field);
    expect(input.type).toBe('text');
    expect(input.getAttribute('role')).toBe('spinbutton');
    expect(input.getAttribute('aria-valuenow')).toBe('5');
    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('10');
    expect(input.inputMode).toBe('decimal');
    expect(input.value).toBe('5');
    field.integerOnly = true;
    await field.updateComplete;
    expect(input.inputMode).toBe('numeric');
    if (isChromium) {
      const node = await axNode(input);
      expect(node.role).toBe('spinbutton');
      expect(node.name).toContain('Quantity');
    }
  });

  it('has no aria-valuenow while empty and an empty text', async () => {
    const field = await make('label="Quantity"');
    expect(inner(field).value).toBe('');
    expect(inner(field).hasAttribute('aria-valuenow')).toBe(false);
    expect(Number.isNaN(field.valueAsNumber)).toBe(true);
    expect(field.value).toBe('');
  });

  it('keeps value a plain number string: sanitised like a native number input', async () => {
    const field = await make('label="Quantity" value="12.50"');
    expect(field.value).toBe('12.50');
    expect(field.valueAsNumber).toBe(12.5);
    field.value = 'abc';
    expect(field.value).toBe('');
    field.value = '3';
    expect(field.valueAsNumber).toBe(3);
    field.valueAsNumber = 8;
    expect(field.value).toBe('8');
    field.valueAsNumber = NaN;
    expect(field.value).toBe('');
  });

  it('forwards placeholder and autocomplete and shows the start icon and units', async () => {
    const field = await make(
      'label="Weight" placeholder="0" autocomplete="off" units="kg" start-icon="search"',
    );
    const input = inner(field);
    expect(input.placeholder).toBe('0');
    expect(input.autocomplete).toBe('off');
    expect(part(field, 'units')!.textContent).toBe('kg');
    expect(part(field, 'start-icon')!.getAttribute('name')).toBe('search');
    // The units are part of the description, so "12" is announced with "kg".
    expect(input.getAttribute('aria-describedby')).toContain(part(field, 'units')!.id);
  });

  it('submits the number in its machine form, whatever the text shows', async () => {
    const form = await formHarness(
      '<tct-number-input label="Price" name="price" value="1234.5"></tct-number-input>',
    );
    const field = form.form.querySelector<TctNumberInput>('tct-number-input')!;
    await field.updateComplete;
    field.formatValue = (n) => `${n.toFixed(2)} EUR`;
    await field.updateComplete;
    expect(inner(field).value).toBe('1234.50 EUR');
    expect(form.entries()).toEqual([['price', '1234.5']]);
  });

  it('formats at rest with formatValue and shows the editable number while focused', async () => {
    const field = await make('label="Size" value="1500"');
    field.formatValue = (n) => `${n / 1000} GB`;
    await field.updateComplete;
    expect(inner(field).value).toBe('1.5 GB');
    expect(inner(field).getAttribute('aria-valuetext')).toBe('1.5 GB');
    expect(inner(field).getAttribute('aria-valuenow')).toBe('1500');
    await userEvent.click(inner(field));
    await field.updateComplete;
    expect(inner(field).value).toBe('1500');
    await pressKeys('Tab');
    await field.updateComplete;
    expect(inner(field).value).toBe('1.5 GB');
  });

  it('shows a label icon before the label text, unless the label is hidden', async () => {
    const field = await make('label="Quantity" label-icon="info"');
    expect(part(field, 'label-icon')!.getAttribute('name')).toBe('info');
    field.labelHidden = true;
    await field.updateComplete;
    expect(part(field, 'label-icon')).toBeNull();
  });

  it('draws the Tecton outlined box at the field height', async () => {
    const field = await make('label="Quantity"');
    const box = part(field, 'input')!;
    expect(getComputedStyle(box).borderTopWidth).toBe('1px');
    expect(box.getBoundingClientRect().height).toBe(32);
    field.size = 'sm';
    await field.updateComplete;
    expect(box.getBoundingClientRect().height).toBe(28);
    field.size = 'lg';
    await field.updateComplete;
    expect(box.getBoundingClientRect().height).toBe(36);
  });
});

describe('tct-number-input: the draft and its commit', () => {
  it('typing changes only the draft: no input or change event until the field is left', async () => {
    const field = await make('label="Quantity" value="1"');
    const events = recordEvents(field, ['input', 'change']);
    await userEvent.click(inner(field));
    await userEvent.clear(inner(field));
    await userEvent.type(inner(field), '25');
    expect(events.events).toHaveLength(0);
    expect(field.value).toBe('1');
    await pressKeys('Tab');
    expect(field.value).toBe('25');
    expect(events.named('input')).toHaveLength(1);
    expect(events.named('change')).toHaveLength(1);
    expect(events.events.map((event) => event.type)).toEqual(['input', 'change']);
  });

  it('commits on Enter too, and an unchanged value fires nothing', async () => {
    const field = await make('label="Quantity" value="4"');
    const events = recordEvents(field, ['input', 'change']);
    await userEvent.click(inner(field));
    await userEvent.keyboard('{Enter}');
    expect(events.events).toHaveLength(0);
    await userEvent.clear(inner(field));
    await userEvent.type(inner(field), '9{Enter}');
    expect(field.value).toBe('9');
    expect(events.events.map((event) => event.type)).toEqual(['input', 'change']);
  });

  it('does not fire events for property writes', async () => {
    const field = await make('label="Quantity" value="4"');
    const events = recordEvents(field, ['input', 'change']);
    field.value = '8';
    field.valueAsNumber = 9;
    await field.updateComplete;
    expect(events.events).toHaveLength(0);
    expect(inner(field).value).toBe('9');
  });

  it('clamps to min and max on commit', async () => {
    const field = await make('label="Quantity" value="5" min="1" max="10"');
    await typeAndLeave(field, '500');
    expect(field.value).toBe('10');
    expect(inner(field).value).toBe('10');
    await typeAndLeave(field, '-4');
    expect(field.value).toBe('1');
  });

  it('rounds nothing, but rejects a fraction with integer-only (the value returns)', async () => {
    const field = await make('label="Quantity" value="5" integer-only');
    await typeAndLeave(field, '2.5');
    expect(field.value).toBe('5');
    expect(inner(field).value).toBe('5');
    await typeAndLeave(field, '7');
    expect(field.value).toBe('7');
  });

  it('returns to the last value when the text is not a number, and says so while it stands', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const field = await make('label="Quantity" value="5"');
      const events = recordEvents(field, ['input', 'change']);
      await userEvent.click(inner(field));
      await userEvent.clear(inner(field));
      await userEvent.type(inner(field), 'abc');
      await field.updateComplete;
      expect(inner(field).getAttribute('aria-invalid')).toBe('true');
      expect(field.validity.badInput).toBe(true);
      await waitUntil(
        () => getAnnouncerRegions().assertive?.textContent === 'Invalid number',
        'invalid number announced',
        3000,
      );
      await pressKeys('Tab');
      await field.updateComplete;
      expect(inner(field).value).toBe('5');
      expect(field.value).toBe('5');
      expect(inner(field).hasAttribute('aria-invalid')).toBe(false);
      expect(events.events).toHaveLength(0);
    } finally {
      restore();
    }
  });

  it('blocks the form submit while unreadable text stands, and keeps the text on Enter', async () => {
    const form = await formHarness(
      '<tct-number-input label="Quantity" name="q" value="5"></tct-number-input><button type="submit">Go</button>',
    );
    const field = form.form.querySelector<TctNumberInput>('tct-number-input')!;
    await field.updateComplete;
    await userEvent.click(inner(field));
    await userEvent.clear(inner(field));
    await userEvent.type(inner(field), 'abc{Enter}');
    expect(form.submitEvents).toHaveLength(0);
    expect(inner(field).value).toBe('abc');
    await userEvent.clear(inner(field));
    await userEvent.type(inner(field), '12{Enter}');
    expect(form.submitEvents).toHaveLength(1);
    expect(form.entries()).toEqual([['q', '12']]);
  });

  it('an empty entry returns the value, or clears it with has-clear', async () => {
    const plain = await make('label="Quantity" value="5"');
    await typeAndLeave(plain, '');
    expect(plain.value).toBe('5');
    const clearable = await make('label="Quantity" value="5" has-clear');
    const events = recordEvents(clearable, ['input', 'change']);
    await typeAndLeave(clearable, '');
    expect(clearable.value).toBe('');
    expect(events.events.map((event) => event.type)).toEqual(['input', 'change']);
  });

  it('required: empty is valueMissing, and shows the error only after the user acted', async () => {
    const field = await make('label="Quantity" required');
    expect(field.validity.valueMissing).toBe(true);
    expect(field.matches(':state(user-invalid)')).toBe(false);
    field.reportValidity();
    await field.updateComplete;
    expect(hasCustomState(field, 'user-invalid')).toBe(true);
    await typeAndLeave(field, '3');
    expect(field.validity.valid).toBe(true);
  });

  it('a programmatic value outside min and max is invalid with the browser message', async () => {
    const field = await make('label="Quantity" min="1" max="10"');
    field.value = '50';
    field.checkValidity();
    expect(field.validity.rangeOverflow).toBe(true);
    expect(field.validationMessage.length).toBeGreaterThan(0);
    field.value = '0';
    field.checkValidity();
    expect(field.validity.rangeUnderflow).toBe(true);
  });
});

describe('tct-number-input: locale parsing', () => {
  it('reads 1.234,5 in de-DE and commits 1234.5', async () => {
    const field = await make('label="Menge"', 'de-DE');
    await typeAndLeave(field, '1.234,5');
    expect(field.value).toBe('1234.5');
    expect(field.valueAsNumber).toBe(1234.5);
    // Shown with the locale's decimal separator, and submitted in machine form.
    expect(inner(field).value).toBe('1234,5');
  });

  it('reads the same text differently in en-US: 1,234.5 is 1234.5 and 1,5 is not a number', async () => {
    const field = await make('label="Quantity"', 'en-US');
    await typeAndLeave(field, '1,234.5');
    expect(field.value).toBe('1234.5');
    await typeAndLeave(field, '1,5');
    expect(field.value).toBe('1234.5');
  });

  it('reads pasted spreadsheet text: currency, accounting negatives and a trailing minus', async () => {
    const field = await make('label="Amount"', 'en-US');
    await typeAndLeave(field, '$1,234.50');
    expect(field.value).toBe('1234.5');
    await typeAndLeave(field, '(1,000)');
    expect(field.value).toBe('-1000');
  });

  it('reads the full-width digits an IME writes', async () => {
    const field = await make('label="Quantity"', 'ja-JP');
    await typeAndLeave(field, '１２３');
    expect(field.value).toBe('123');
  });

  it('shows the editable number with the locale decimal separator, and steps from it', async () => {
    const field = await make('label="Menge" value="1.5" step="0.5"', 'de-DE');
    expect(inner(field).value).toBe('1,5');
    await userEvent.click(inner(field));
    await pressKeys('ArrowUp');
    expect(field.value).toBe('2');
    expect(inner(field).value).toBe('2');
  });
});

describe('tct-number-input: stepping', () => {
  it('ArrowUp and ArrowDown step by step, from the empty field to min and max, and clamp', async () => {
    const field = await make('label="Quantity" min="0" max="3" step="1"');
    const events = recordEvents(field, ['input', 'change']);
    await userEvent.click(inner(field));
    await pressKeys('ArrowUp');
    expect(field.value).toBe('0');
    await pressKeys('ArrowUp');
    await pressKeys('ArrowUp');
    await pressKeys('ArrowUp');
    await pressKeys('ArrowUp');
    expect(field.value).toBe('3');
    await pressKeys('ArrowDown');
    expect(field.value).toBe('2');
    expect(events.named('input').length).toBe(events.named('change').length);
    expect(events.named('input')).toHaveLength(5);
  });

  it('steps without floating-point drift and from the readable draft', async () => {
    const field = await make('label="Price" value="0.1" step="0.1"');
    await userEvent.click(inner(field));
    await pressKeys('ArrowUp');
    expect(field.value).toBe('0.2');
    await pressKeys('ArrowUp');
    expect(field.value).toBe('0.3');
    await userEvent.clear(inner(field));
    await userEvent.type(inner(field), '10');
    await pressKeys('ArrowUp');
    expect(field.value).toBe('10.1');
  });

  it('a modified arrow key does not step', async () => {
    const field = await make('label="Quantity" value="1"');
    await userEvent.click(inner(field));
    await pressKeys('Shift+ArrowUp');
    expect(field.value).toBe('1');
  });

  it('the wheel over the focused field steps and stops the page scroll; unfocused it does not', async () => {
    const field = await make('label="Quantity" value="5"');
    const input = inner(field);
    const idle = new WheelEvent('wheel', {
      deltaY: -10,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    input.dispatchEvent(idle);
    expect(field.value).toBe('5');
    expect(idle.defaultPrevented).toBe(false);
    await userEvent.click(input);
    const up = new WheelEvent('wheel', {
      deltaY: -10,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    input.dispatchEvent(up);
    expect(field.value).toBe('6');
    expect(up.defaultPrevented).toBe(true);
    const down = new WheelEvent('wheel', {
      deltaY: 10,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    input.dispatchEvent(down);
    expect(field.value).toBe('5');
    field.noWheel = true;
    await field.updateComplete;
    const off = new WheelEvent('wheel', {
      deltaY: -10,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    input.dispatchEvent(off);
    expect(field.value).toBe('5');
    expect(off.defaultPrevented).toBe(false);
  });

  it('has-steppers shows two named buttons that are not tab stops and keep focus in the field', async () => {
    const field = await make('label="Quantity" value="5" max="6" has-steppers');
    const up = part(field, 'stepper-increment') as HTMLButtonElement;
    const down = part(field, 'stepper-decrement') as HTMLButtonElement;
    expect(up.getAttribute('aria-label')).toBe('Increment Quantity');
    expect(down.getAttribute('aria-label')).toBe('Decrement Quantity');
    expect(up.tabIndex).toBe(-1);
    const events = recordEvents(field, ['input', 'change']);
    await userEvent.click(up);
    expect(field.value).toBe('6');
    expect(deepActiveElement()).toBe(inner(field));
    expect(up.disabled).toBe(true);
    expect(events.events.map((event) => event.type)).toEqual(['input', 'change']);
    await userEvent.click(down);
    expect(field.value).toBe('5');
    // Tab goes from the field straight past the buttons.
    await pressKeys('Tab');
    expect(part(field, 'stepper-increment')!.matches(':focus')).toBe(false);
  });

  it('steppers span the full height of the box, on the inline end', async () => {
    const field = await make('label="Quantity" value="5" has-steppers');
    const box = part(field, 'input')!.getBoundingClientRect();
    const steppers = part(field, 'steppers')!.getBoundingClientRect();
    expect(Math.round(steppers.height)).toBeGreaterThanOrEqual(Math.round(box.height) - 2);
    expect(Math.round(box.right - steppers.right)).toBeLessThanOrEqual(2);
  });

  it('read-only and disabled fields do not step, whatever the route', async () => {
    const field = await make('label="Quantity" value="5" readonly has-steppers');
    await userEvent.click(inner(field));
    await pressKeys('ArrowUp');
    expect(field.value).toBe('5');
    const wheel = new WheelEvent('wheel', {
      deltaY: -10,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    inner(field).dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect((part(field, 'stepper-increment') as HTMLButtonElement).disabled).toBe(true);
    const disabled = await make('label="Quantity" value="5" disabled');
    disabled.value = '5';
    expect(inner(disabled).disabled).toBe(true);
  });

  it('an IME composition does not step or commit', async () => {
    const field = await make('label="Quantity" value="5"');
    await userEvent.click(inner(field));
    const arrow = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      bubbles: true,
      cancelable: true,
      composed: true,
      isComposing: true,
    });
    inner(field).dispatchEvent(arrow);
    expect(field.value).toBe('5');
    expect(arrow.defaultPrevented).toBe(false);
  });
});

describe('tct-number-input: clear, enter and adornments', () => {
  it('shows the clear button only with a value; it clears, fires tct-clear, input and change and keeps focus', async () => {
    const field = await make('label="Quantity" value="5" has-clear');
    const events = recordEvents(field, ['tct-clear', 'input', 'change']);
    const clear = field.shadowRoot!.querySelector('tct-input-clear-button')!;
    expect(clear.getAttribute('label')).toBe('Clear Quantity');
    await userEvent.click(clear);
    await field.updateComplete;
    expect(field.value).toBe('');
    expect(events.events.map((event) => event.type)).toEqual(['tct-clear', 'input', 'change']);
    expect(field.shadowRoot!.querySelector('tct-input-clear-button')).toBeNull();
    await waitUntil(() => deepActiveElement() === inner(field), 'focus back in the field');
  });

  it('preventing tct-clear keeps the value', async () => {
    const field = await make('label="Quantity" value="5" has-clear');
    field.addEventListener('tct-clear', (event) => {
      event.preventDefault();
    });
    await userEvent.click(field.shadowRoot!.querySelector('tct-input-clear-button')!);
    expect(field.value).toBe('5');
  });

  it('Enter commits, fires tct-enter, and submits the form once; preventing tct-enter stops the submit', async () => {
    const form = await formHarness(
      '<tct-number-input label="Quantity" name="q"></tct-number-input><button type="submit">Go</button>',
    );
    const field = form.form.querySelector<TctNumberInput>('tct-number-input')!;
    await field.updateComplete;
    const enters = recordEvents(field, 'tct-enter');
    await userEvent.click(inner(field));
    await userEvent.type(inner(field), '4{Enter}');
    expect(enters.events).toHaveLength(1);
    expect(form.submitEvents).toHaveLength(1);
    expect(form.entries()).toEqual([['q', '4']]);
    field.addEventListener('tct-enter', (event) => {
      event.preventDefault();
    });
    await userEvent.keyboard('{Enter}');
    expect(form.submitEvents).toHaveLength(1);
  });

  it('clicking the start icon or the padding focuses the field', async () => {
    const field = await make('label="Quantity" start-icon="search"');
    await userEvent.click(part(field, 'start-icon')!, {force: true});
    expect(deepActiveElement()).toBe(inner(field));
  });
});

describe('tct-number-input: status, disabled reason and loading', () => {
  it('shows a status message under the box and marks an error aria-invalid', async () => {
    const field = await make('label="Quantity" status-type="error" status-message="Too many"');
    expect(field.shadowRoot!.querySelector('tct-field-status')!.textContent).toContain('Too many');
    expect(inner(field).getAttribute('aria-invalid')).toBe('true');
    expect(part(field, 'input')!.getAttribute('data-status')).toBe('error');
  });

  it('the tooltip status variant is a focusable named button', async () => {
    const field = await make(
      'label="Quantity" status-type="warning" status-message="Check it" status-variant="tooltip"',
    );
    const button = part(field, 'status-button')!;
    expect(button.getAttribute('aria-label')).toBe('Warning details');
    expect(inner(field).getAttribute('aria-describedby')).toBeTruthy();
  });

  it('a disabled-message keeps the field focusable and read-only, and explains itself', async () => {
    const field = await make(
      'label="Quantity" value="5" disabled disabled-message="Locked for now"',
    );
    const input = inner(field);
    expect(input.disabled).toBe(false);
    expect(input.getAttribute('aria-disabled')).toBe('true');
    expect(input.readOnly).toBe(true);
    input.focus();
    await pressKeys('ArrowUp');
    expect(field.value).toBe('5');
    expect(input.getAttribute('aria-describedby')).toContain('disabled-reason');
  });

  it('loading is busy: :state(busy), aria-busy and a spinner', async () => {
    const field = await make('label="Quantity" loading');
    expect(hasCustomState(field, 'busy')).toBe(true);
    expect(inner(field).getAttribute('aria-busy')).toBe('true');
    expect(part(field, 'busy')).not.toBeNull();
  });
});

describe('tct-number-input: appearance, accessibility and i18n', () => {
  it('mirrors in right-to-left: the steppers move to the start side', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div dir="rtl" style="padding:40px;inline-size:420px"><tct-number-input label="Quantity" value="5" has-steppers></tct-number-input></div>',
    );
    const field = wrapper.querySelector<TctNumberInput>('tct-number-input')!;
    await field.updateComplete;
    await nextFrame();
    const box = part(field, 'input')!.getBoundingClientRect();
    const steppers = part(field, 'steppers')!.getBoundingClientRect();
    expect(Math.round(steppers.left - box.left)).toBeLessThanOrEqual(2);
  });

  it('keeps the box and the steppers visible under forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const field = await make('label="Quantity" value="5" has-steppers');
    expect(getComputedStyle(part(field, 'input')!).borderTopStyle).toBe('solid');
    expect(getComputedStyle(part(field, 'steppers')!).borderInlineStartStyle).toBe('solid');
  });

  it('passes axe in the default, steppers, clear, status, disabled, read-only and loading states', async () => {
    for (const attributes of [
      'label="Quantity"',
      'label="Quantity" value="5" min="0" max="9" has-steppers has-clear units="kg"',
      'label="Quantity" required status-type="error" status-message="Required"',
      'label="Quantity" disabled value="5"',
      'label="Quantity" disabled disabled-message="Locked" value="5"',
      'label="Quantity" readonly value="5"',
      'label="Quantity" label-hidden loading',
    ]) {
      const field = await make(attributes);
      await expectAccessible(field);
    }
  });

  it('localises the stepper and clear names and the Required indicator (de-DE)', async () => {
    const field = await make('label="Menge" value="5" required has-steppers has-clear', 'de-DE');
    await waitUntil(
      () => part(field, 'stepper-increment')?.getAttribute('aria-label') !== 'Increment Menge',
      'German stepper name',
    );
    expect(part(field, 'stepper-increment')!.getAttribute('aria-label')).not.toBe(
      'Increment Menge',
    );
    expect(
      field.shadowRoot!.querySelector('tct-input-clear-button')!.getAttribute('label'),
    ).not.toBe('Clear Menge');
  });
});
