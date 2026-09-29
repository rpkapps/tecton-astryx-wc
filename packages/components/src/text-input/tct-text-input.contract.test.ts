/**
 * Acceptance criterion 4 (form contract) and the slotted-input mode of tct-text-input (A§9.8).
 *
 * A `<form>` holds `tct-text-input name=a required`, a `tct-field` wrapping a native `<input name=b>`, and
 * a submit button with `name=go value=1`. Enter in the text input submits exactly once with
 * `FormData {a, b, go=1}`; an empty required field blocks the submit, focuses the text input and shows
 * `:state(user-invalid)` and `aria-invalid` only then; `form.checkValidity()` shows nothing; reset restores
 * the attribute defaults; `<fieldset disabled>` disables both controls; `form=` works from outside the
 * form; a label click focuses; and slotted-input mode submits the author's input exactly once.
 */
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {recordEvents} from '@tecton-astryx/testing/events.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {formHarness, hasCustomState, type FormHarness} from '@tecton-astryx/testing/forms.js';
import {pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {isChromium, isTier2} from '@tecton-astryx/testing/tier.js';
import {aTimeout, nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import '../field/define.js';
import '../tooltip/define.js';
import './define.js';
import type {TctField} from '../field/tct-field.js';
import type {TctTextInput} from './tct-text-input.js';

import '../button/define.js';
const SUBMIT = 'tct-button';

const innerOf = (input: TctTextInput): HTMLInputElement =>
  input.shadowRoot!.querySelector<HTMLInputElement>('input.input')!;

/** The data of each submission as the submit event saw it (the temporary submitter is gone afterwards). */
function captureSubmissions(harness: FormHarness): Record<string, string>[] {
  const captured: Record<string, string>[] = [];
  harness.form.addEventListener('submit', (event) => {
    captured.push(
      Object.fromEntries(new FormData(harness.form, event.submitter).entries()) as Record<
        string,
        string
      >,
    );
  });
  return captured;
}

interface Slice {
  harness: FormHarness;
  text: TctTextInput;
  field: TctField;
  nativeB: HTMLInputElement;
}

async function slice(extra = '', formAttributes = ''): Promise<Slice> {
  const harness = await formHarness(
    `<tct-text-input id="a" label="Name" name="a" required value="${'' /* default empty */}"></tct-text-input>` +
      `<tct-field label="Second"><input name="b" value="bee"></tct-field>` +
      `<${SUBMIT} type="submit" name="go" value="1">Go</${SUBMIT}>${extra}`,
    {attributes: formAttributes ? {id: 'f'} : {}},
  );
  const text = harness.form.querySelector<TctTextInput>('tct-text-input')!;
  const field = harness.form.querySelector<TctField>('tct-field')!;
  await text.updateComplete;
  await field.updateComplete;
  await nextFrame();
  return {
    harness,
    text,
    field,
    nativeB: harness.form.querySelector<HTMLInputElement>('input[name=b]')!,
  };
}

describe('form contract (acceptance 4)', () => {
  it('Enter in the text input submits exactly once with FormData {a, b, go=1}', async () => {
    const {harness, text} = await slice();
    const captured = captureSubmissions(harness);
    await userEvent.click(innerOf(text));
    await userEvent.keyboard('hello');
    await pressKeys('Enter');
    await aTimeout(50);
    expect(harness.submitEvents).toHaveLength(1);
    expect(captured).toEqual([{a: 'hello', b: 'bee', go: '1'}]);
  });

  it('an empty required field blocks the submit, focuses the text input, and shows the error only then', async () => {
    const {harness, text} = await slice();
    const seen = () => hasCustomState(text, 'user-invalid');
    // Nothing is shown before the user acted: not on load, not on a programmatic validity check.
    expect(innerOf(text).hasAttribute('aria-invalid')).toBe(false);
    if (!isTier2) expect(seen()).toBe(false);
    expect(text.validity.valueMissing).toBe(true);

    await userEvent.click(harness.form.querySelector(SUBMIT)!);
    await waitUntil(
      () => innerOf(text).getAttribute('aria-invalid') === 'true',
      'aria-invalid shown',
    );
    expect(harness.submitEvents).toHaveLength(0);
    expect(deepActiveElement()).toBe(innerOf(text));
    if (!isTier2) expect(seen()).toBe(true);
    // The browser's message is shown as the field's status, and Enter still does not submit.
    expect(text.shadowRoot!.querySelector('tct-field-status')).not.toBeNull();
    await pressKeys('Enter');
    await aTimeout(50);
    expect(harness.submitEvents).toHaveLength(0);
  });

  it('form.checkValidity() does not show errors, while the control’s own reportValidity() does', async () => {
    const {harness, text} = await slice();
    expect(harness.form.checkValidity()).toBe(false);
    await text.updateComplete;
    await nextFrame();
    expect(innerOf(text).hasAttribute('aria-invalid')).toBe(false);
    if (!isTier2) expect(hasCustomState(text, 'user-invalid')).toBe(false);
    expect(text.reportValidity()).toBe(false);
    await waitUntil(
      () => innerOf(text).getAttribute('aria-invalid') === 'true',
      'shown by reportValidity',
    );
  });

  it('form.reset() restores the attribute defaults and clears the displayed error', async () => {
    const harness = await formHarness(
      `<tct-text-input label="Name" name="a" value="Ada" required></tct-text-input>` +
        `<tct-field label="Second"><input name="b" value="bee"></tct-field>`,
    );
    const text = harness.form.querySelector<TctTextInput>('tct-text-input')!;
    await text.updateComplete;
    await userEvent.click(innerOf(text));
    await userEvent.keyboard('{Control>}a{/Control}{Backspace}new');
    harness.form.querySelector<HTMLInputElement>('input[name=b]')!.value = 'changed';
    text.reportValidity();
    expect(harness.values('a')).toEqual(['new']);
    harness.reset();
    await text.updateComplete;
    await nextFrame();
    expect(text.value).toBe('Ada');
    expect(innerOf(text).value).toBe('Ada');
    expect(harness.values('a')).toEqual(['Ada']);
    expect(harness.values('b')).toEqual(['bee']);
    expect(innerOf(text).hasAttribute('aria-invalid')).toBe(false);
  });

  it('<fieldset disabled> disables both the text input and the native input, and nothing is submitted', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<form><fieldset disabled>` +
        `<tct-text-input label="Name" name="a" value="x"></tct-text-input>` +
        `<tct-field label="Second"><input name="b" value="bee"></tct-field></fieldset></form>`,
    );
    const text = wrapper.querySelector<TctTextInput>('tct-text-input')!;
    await text.updateComplete;
    await nextFrame();
    expect(text.isDisabled).toBe(true);
    expect(text.matches(':disabled')).toBe(true);
    expect(innerOf(text).disabled).toBe(true);
    expect(wrapper.querySelector<HTMLInputElement>('input[name=b]')!.matches(':disabled')).toBe(
      true,
    );
    expect([...new FormData(wrapper as unknown as HTMLFormElement).keys()]).toEqual([]);
    wrapper.querySelector('fieldset')!.disabled = false;
    await text.updateComplete;
    expect(text.isDisabled).toBe(false);
    expect(new FormData(wrapper as unknown as HTMLFormElement).get('a')).toBe('x');
  });

  it('form= associates a text input placed outside the form', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><form id="f"><input name="plain" value="p"></form>` +
        `<tct-text-input form="f" label="Outside" name="outside" value="o"></tct-text-input></div>`,
    );
    const form = wrapper.querySelector('form')!;
    const text = wrapper.querySelector<TctTextInput>('tct-text-input')!;
    await text.updateComplete;
    expect(text.form).toBe(form);
    expect([...form.elements]).toContain(text);
    expect(Object.fromEntries(new FormData(form).entries())).toEqual({plain: 'p', outside: 'o'});
  });

  it('a click on the label focuses the text input; an external <label for> does too', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><label for="ext">External</label><tct-text-input id="ext" name="x"></tct-text-input>` +
        `<tct-text-input label="Own" name="y"></tct-text-input></div>`,
    );
    const [ext, own] = [...wrapper.querySelectorAll<TctTextInput>('tct-text-input')] as [
      TctTextInput,
      TctTextInput,
    ];
    await ext.updateComplete;
    await own.updateComplete;
    await userEvent.click(wrapper.querySelector('label')!);
    expect(deepActiveElement()).toBe(innerOf(ext));
    await userEvent.click(own.shadowRoot!.querySelector('[part="label"]')!);
    expect(deepActiveElement()).toBe(innerOf(own));
  });

  it('a submit with a valid form submits once with the submitter entry (submit button default)', async () => {
    const {harness, text} = await slice();
    const captured = captureSubmissions(harness);
    text.value = 'Ada';
    await text.updateComplete;
    await userEvent.click(harness.form.querySelector(SUBMIT)!);
    await aTimeout(50);
    expect(harness.submitEvents).toHaveLength(1);
    expect(captured[0]?.go).toBe('1');
  });
});

describe('slotted-input mode (A§9.8)', () => {
  async function make(
    extra = '',
    inputAttributes = 'name="email" value="ada@example.com" autocomplete="email"',
  ) {
    const harness = await formHarness(
      `<tct-text-input label="Email" description="We never share it" ${extra}>` +
        `<input slot="input" ${inputAttributes}></tct-text-input>` +
        `<${SUBMIT} type="submit" name="go" value="1">Go</${SUBMIT}>`,
    );
    const text = harness.form.querySelector<TctTextInput>('tct-text-input')!;
    await text.updateComplete;
    await nextFrame();
    return {harness, text, input: text.querySelector<HTMLInputElement>('input')!};
  }

  it('submits the author’s input exactly once: no double entry from the host, and Enter submits once', async () => {
    const {harness, text, input} = await make();
    expect(harness.values('email')).toEqual(['ada@example.com']);
    expect(harness.entries().filter(([name]) => name === 'email')).toHaveLength(1);
    input.focus();
    await pressKeys('Enter');
    await aTimeout(50);
    expect(harness.submitEvents).toHaveLength(1);
    expect(harness.values('email')).toEqual(['ada@example.com']);
    expect(text.value).toBe('ada@example.com');
  });

  it('the chrome is satellites in the light DOM, wired with aria-labelledby and aria-describedby next to the input', async () => {
    const {text, input} = await make('status-type="error" status-message="Bad address"');
    const label = text.querySelector<HTMLElement>(':scope > [slot="label"]')!;
    const description = text.querySelector<HTMLElement>(':scope > [slot="description"]')!;
    const status = text.querySelector<HTMLElement>(':scope > [slot="status"]')!;
    expect(label.localName).toBe('tct-field-label');
    expect(input.getAttribute('aria-labelledby')).toBe(label.id);
    expect(input.getAttribute('aria-describedby')!.split(' ')).toEqual([description.id, status.id]);
    expect(text.shadowRoot!.querySelector('[part="label"]')).toBeNull();
    expect(text.shadowRoot!.querySelector('tct-field-status')).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    if (isChromium) {
      expect(await axNode(input)).toMatchObject({
        role: 'textbox',
        name: 'Email',
        description: 'We never share it Bad address',
      });
    }
  });

  it('pressing the label focuses the author’s input; validity mirrors the input and the anchor is the input', async () => {
    const {harness, text, input} = await make('', 'name="email" required');
    await userEvent.click(text.querySelector('[slot="label"]')!);
    expect(deepActiveElement()).toBe(input);
    input.blur();
    expect(text.validity.valueMissing).toBe(true);
    await userEvent.click(harness.form.querySelector(SUBMIT)!);
    await waitUntil(() => deepActiveElement() === input, 'the blocked submit focuses the input');
    expect(harness.submitEvents).toHaveLength(0);
    await waitUntil(() => input.getAttribute('aria-invalid') === 'true', 'shown after the attempt');
  });

  it('native input and change events bubble through the host exactly once each (nothing re-dispatched)', async () => {
    const {text, input} = await make('', 'name="email"');
    const inputs = recordEvents(text, 'input');
    const changes = recordEvents(text, 'change');
    await userEvent.click(input);
    await userEvent.keyboard('ab');
    await pressKeys('Tab');
    expect(inputs.events).toHaveLength(2);
    expect(changes.events).toHaveLength(1);
    expect(inputs.events[0]!.target).toBe(input);
    expect(text.value).toBe('ab');
  });

  it('value passes through to the author’s input, and the clear button clears it (input then change)', async () => {
    const {text, input} = await make('has-clear', 'name="email" value="abc"');
    expect(text.value).toBe('abc');
    text.value = 'xyz';
    expect(input.value).toBe('xyz');
    await text.updateComplete;
    const clear = text.shadowRoot!.querySelector<HTMLElement>('tct-input-clear-button')!;
    const order: string[] = [];
    for (const name of ['input', 'change', 'tct-clear'])
      text.addEventListener(name, () => order.push(name));
    await userEvent.click(clear.shadowRoot!.querySelector('button')!);
    await waitUntil(() => input.value === '', 'cleared');
    expect(order).toEqual(['tct-clear', 'input', 'change']);
    await waitUntil(() => deepActiveElement() === input, 'focus returned to the input');
  });

  it('a <fieldset disabled> disables the author’s input natively, and the host reports disabled', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<form><fieldset disabled><tct-text-input label="Email"><input slot="input" name="email" value="x"></tct-text-input></fieldset></form>`,
    );
    const text = wrapper.querySelector<TctTextInput>('tct-text-input')!;
    await text.updateComplete;
    expect(text.querySelector('input')!.matches(':disabled')).toBe(true);
    expect(text.isDisabled).toBe(true);
    expect([...new FormData(wrapper as unknown as HTMLFormElement).keys()]).toEqual([]);
  });

  it('tct-enter fires from a slotted input, cancelable; preventing it stops the implicit submission', async () => {
    const {harness, text, input} = await make('', 'name="email" value="x"');
    const enters = recordEvents(text, 'tct-enter');
    input.focus();
    await pressKeys('Enter');
    await aTimeout(50);
    expect(enters.events).toHaveLength(1);
    expect(harness.submitEvents).toHaveLength(1);
    text.addEventListener('tct-enter', (event) => event.preventDefault());
    await pressKeys('Enter');
    await aTimeout(50);
    expect(harness.submitEvents).toHaveLength(1);
  });

  it('switching between modes follows the markup: removing the slotted input returns to the shadow input', async () => {
    const {text, input} = await make();
    input.remove();
    await waitUntil(
      () => text.shadowRoot!.querySelector('input.input') !== null,
      'shadow input rendered',
    );
    expect(text.shadowRoot!.querySelector('[part="label"]')).not.toBeNull();
  });

  it('passes axe', async () => {
    const {text} = await make('status-type="warning" status-message="Check it"');
    // The status fades in: measure contrast once the motion settled (shadow trees included).
    const box = text.querySelector('tct-field-status')!.shadowRoot!.querySelector('.status')!;
    await waitUntil(() => getComputedStyle(box).opacity === '1', 'status faded in');
    await expectAccessible(text);
  });
});
