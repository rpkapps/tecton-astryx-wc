/**
 * The form contract of `FormControlMixin` (A§9.7), through test-only FACE elements. One block per
 * row of the contract: FormData, events, implicit submission (exactly once), reset / restore,
 * fieldset disabled, label activation, validity, displayed invalidity timing (`:state(user-invalid)`
 * and `aria-invalid` together), the frozen message, the validation anchor, observers and submitters.
 *
 * `:state()` assertions are skipped in the Tier-2 run (custom states are forced off there);
 * `aria-invalid` assertions run everywhere.
 */
import {userEvent} from 'vitest/browser';
import {beforeAll, describe, expect, it} from 'vitest';
import {defineElement} from '@tecton-wc/core/define.js';
import {observeControl, unobserveControl} from '@tecton-wc/core/mixins/form-control.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode} from '../a11y.js';
import {recordEvents} from '../events.js';
import {TctTestCheckbox, TctTestGroup, TctTestInput, TctTestSubmit} from '../fixtures/test-form.js';
import {formHarness, hasCustomState, innerControl} from '../forms.js';
import {pressKeys} from '../keyboard.js';
import {isChromium, isTier2} from '../tier.js';
import {aTimeout, nextFrame, waitUntil} from '../timing.js';

beforeAll(() => {
  for (const ctor of [TctTestInput, TctTestCheckbox, TctTestGroup, TctTestSubmit])
    defineElement(ctor);
});

const one = <T extends Element>(root: ParentNode, selector: string): T =>
  root.querySelector<T>(selector)!;

const ariaInvalid = (element: Element): string | null =>
  innerControl(element).getAttribute('aria-invalid');

/** Two frames: validity is recomputed after the render that follows a change. */
const settleValidity = async (element: {updateComplete: Promise<boolean>}): Promise<void> => {
  await element.updateComplete;
  await nextFrame();
  await element.updateComplete;
};

describe('value and FormData', () => {
  it('submits name=value; the value attribute is the default, the property overrides it', async () => {
    const harness = await formHarness(`<tct-test-input name="q" value="hello"></tct-test-input>`);
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    expect(harness.values('q')).toEqual(['hello']);
    expect(input.value).toBe('hello');
    expect(input.defaultValue).toBe('hello');

    input.value = 'typed';
    await input.updateComplete;
    expect(harness.values('q')).toEqual(['typed']);
    // Once set, the property no longer follows the attribute (like a native dirty value).
    input.setAttribute('value', 'changed default');
    await input.updateComplete;
    expect(input.value).toBe('typed');
    expect(input.defaultValue).toBe('changed default');
  });

  it('is present in form.elements and reports its form and name', async () => {
    const harness = await formHarness(`<tct-test-input name="q"></tct-test-input>`);
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    expect(input.form).toBe(harness.form);
    expect([...harness.form.elements]).toContain(input);
    expect(harness.form.elements.namedItem('q')).toBe(input);
  });

  it('submits nothing without a name or when disabled', async () => {
    const harness = await formHarness(
      `<tct-test-input value="a"></tct-test-input><tct-test-input name="d" value="b" disabled></tct-test-input>`,
    );
    expect(harness.entries()).toEqual([]);
  });

  it('a checkbox submits only while checked, as value or "on"', async () => {
    const harness = await formHarness(
      `<tct-test-checkbox name="c"></tct-test-checkbox><tct-test-checkbox name="d" value="yes" default-checked></tct-test-checkbox>`,
    );
    const [c, d] = harness.form.querySelectorAll<TctTestCheckbox>(
      'tct-test-checkbox',
    ) as unknown as [TctTestCheckbox, TctTestCheckbox];
    await d.updateComplete;
    expect(harness.entries()).toEqual([['d', 'yes']]);
    c.checked = true;
    await c.updateComplete;
    expect(harness.entries()).toEqual([
      ['c', 'on'],
      ['d', 'yes'],
    ]);
  });

  it('property writes never emit input or change', async () => {
    const harness = await formHarness(`<tct-test-input name="q"></tct-test-input>`);
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    const events = recordEvents(input, ['input', 'change']);
    input.value = 'x';
    input.disabled = true;
    input.required = true;
    await input.updateComplete;
    expect(events.events).toHaveLength(0);
  });
});

describe('events from user action', () => {
  it('typing fires one input per edit and one composed change on commit', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q"></tct-test-input><button type="button">next</button>`,
    );
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    const events = recordEvents(input, ['input', 'change']);
    await userEvent.click(input);
    await userEvent.keyboard('abc');
    expect(events.counts()).toEqual({input: 3, change: 0});
    expect(harness.values('q')).toEqual(['abc']);

    await pressKeys('Tab');
    expect(events.counts()).toEqual({input: 3, change: 1});
    const change = events.named('change')[0]!;
    expect(change.composed).toBe(true);
    expect(change.bubbles).toBe(true);
  });
});

describe('implicit submission (review H1)', () => {
  it('Enter in a single field with no submit button submits once', async () => {
    const harness = await formHarness(`<tct-test-input name="q" value="x"></tct-test-input>`);
    await userEvent.click(one(harness.form, 'tct-test-input'));
    await pressKeys('Enter');
    expect(harness.submitEvents).toHaveLength(1);
  });

  it('with a native submit button, Enter activates it once and it is the submitter', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" value="x"></tct-test-input><button type="submit" name="go" value="1">Go</button>`,
    );
    await userEvent.click(one(harness.form, 'tct-test-input'));
    await pressKeys('Enter');
    expect(harness.submitEvents).toHaveLength(1);
    expect(harness.submitEvents[0]!.submitter).toBe(one(harness.form, 'button'));
  });

  it('with a library submitter as the default button, Enter submits once', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" value="x"></tct-test-input><tct-test-input name="r" value="y"></tct-test-input>` +
        `<tct-test-submit name="go" value="1">Go</tct-test-submit>`,
    );
    await userEvent.click(harness.form.querySelectorAll('tct-test-input')[1]!);
    await pressKeys('Enter');
    expect(harness.submitEvents).toHaveLength(1);
  });

  it('two fields and no submit button: Enter does nothing (the HTML rule)', async () => {
    const harness = await formHarness(
      `<tct-test-input name="a" value="x"></tct-test-input><tct-test-input name="b" value="y"></tct-test-input>`,
    );
    await userEvent.click(harness.form.querySelector('tct-test-input')!);
    await pressKeys('Enter');
    expect(harness.submitEvents).toHaveLength(0);
  });

  it('a disabled default button does nothing', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" value="x"></tct-test-input><button type="submit" disabled>Go</button>`,
    );
    await userEvent.click(one(harness.form, 'tct-test-input'));
    await pressKeys('Enter');
    expect(harness.submitEvents).toHaveLength(0);
  });

  it('ignores Enter while an IME composes (review M5: isComposing and keyCode 229)', async () => {
    const harness = await formHarness(`<tct-test-input name="q" value="x"></tct-test-input>`);
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    const inner = innerControl(input);
    for (const init of [{isComposing: true}, {keyCode: 229}]) {
      inner.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          composed: true,
          cancelable: true,
          ...init,
        }),
      );
    }
    await aTimeout(20);
    expect(harness.submitEvents).toHaveLength(0);
  });

  it('modified Enter does not submit; a control with enter-submits off does not either', async () => {
    const harness = await formHarness(`<tct-test-input name="q" value="x"></tct-test-input>`);
    await userEvent.click(one(harness.form, 'tct-test-input'));
    await pressKeys('Shift+Enter');
    expect(harness.submitEvents).toHaveLength(0);

    const off = await formHarness(`<tct-test-input name="q" value="x"></tct-test-input>`);
    const input = one<TctTestInput>(off.form, 'tct-test-input');
    input.enterSubmits = false;
    await input.updateComplete;
    await userEvent.click(input);
    await pressKeys('Enter');
    expect(off.submitEvents).toHaveLength(0);
  });

  it('the bridge: Enter in a native text field runs a library default button once', async () => {
    const harness = await formHarness(
      `<input name="a" value="1"><input name="b" value="2"><tct-test-submit name="go" value="1">Go</tct-test-submit>`,
    );
    await userEvent.click(harness.form.querySelector('input')!);
    await pressKeys('Enter');
    expect(harness.submitEvents).toHaveLength(1);
    expect(harness.entries()).toContainEqual(['a', '1']);
  });
});

describe('submitter', () => {
  it('a library submit button submits once; the submitted FormData carries its name and value', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" value="x"></tct-test-input><tct-test-submit name="go" value="save">Save</tct-test-submit>`,
    );
    const submit = one<TctTestSubmit>(harness.form, 'tct-test-submit');
    await userEvent.click(submit);
    expect(harness.submitEvents).toHaveLength(1);
    // The submitter is the temporary native button that carried the name and value (documented platform limit).
    const submitter = harness.submitEvents[0]?.submitter;
    expect(submitter?.localName).toBe('button');
    expect(submitter?.hasAttribute('data-tct-temp-submitter')).toBe(true);
    expect([(submitter as HTMLButtonElement).name, (submitter as HTMLButtonElement).value]).toEqual(
      ['go', 'save'],
    );
    expect(harness.form.querySelector('[data-tct-temp-submitter]')).toBeNull();
  });

  it('a disabled library submit button does nothing', async () => {
    const harness = await formHarness(`<tct-test-submit disabled>Save</tct-test-submit>`);
    harness.form.querySelector('tct-test-submit')!.click();
    expect(harness.submitEvents).toHaveLength(0);
  });

  it('a submit that fails validation does not submit and shows the error (a real attempt)', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" required></tct-test-input><tct-test-submit>Save</tct-test-submit>`,
    );
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    await userEvent.click(one(harness.form, 'tct-test-submit'));
    await settleValidity(input);
    expect(harness.submitEvents).toHaveLength(0);
    expect(ariaInvalid(input)).toBe('true');
    if (!isTier2) expect(hasCustomState(input, 'user-invalid')).toBe(true);
  });

  it('formnovalidate skips validation', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" required></tct-test-input><tct-test-submit formnovalidate>Save</tct-test-submit>`,
    );
    await userEvent.click(one(harness.form, 'tct-test-submit'));
    expect(harness.submitEvents).toHaveLength(1);
  });

  it('type=reset resets the form', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" value="a"></tct-test-input><tct-test-submit type="reset">Reset</tct-test-submit>`,
    );
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    input.value = 'changed';
    await input.updateComplete;
    await userEvent.click(one(harness.form, 'tct-test-submit'));
    await input.updateComplete;
    expect(input.value).toBe('a');
  });

  it('a native submit button click is a submission attempt too (validation shows errors)', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" required></tct-test-input><button type="submit">Go</button>`,
    );
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    await userEvent.click(one(harness.form, 'button'));
    await settleValidity(input);
    expect(harness.submitEvents).toHaveLength(0);
    expect(ariaInvalid(input)).toBe('true');
  });
});

describe('reset and restore', () => {
  it('form.reset() returns the value to the attribute and forgets the interaction', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" value="a" required></tct-test-input>`,
    );
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    input.value = '';
    await userEvent.click(input);
    input.reportValidity();
    await settleValidity(input);
    expect(ariaInvalid(input)).toBe('true');

    harness.reset();
    await settleValidity(input);
    expect(input.value).toBe('a');
    expect(harness.values('q')).toEqual(['a']);
    expect(ariaInvalid(input)).toBeNull();
  });

  it('a checkbox resets to its default', async () => {
    const harness = await formHarness(
      `<tct-test-checkbox name="c" default-checked></tct-test-checkbox>`,
    );
    const box = one<TctTestCheckbox>(harness.form, 'tct-test-checkbox');
    box.checked = false;
    await box.updateComplete;
    expect(harness.entries()).toEqual([]);
    harness.reset();
    await box.updateComplete;
    expect(harness.entries()).toEqual([['c', 'on']]);
  });

  it('formStateRestoreCallback restores the saved state', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q"></tct-test-input><tct-test-checkbox name="c"></tct-test-checkbox>`,
    );
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    const box = one<TctTestCheckbox>(harness.form, 'tct-test-checkbox');
    input.formStateRestoreCallback('saved', 'restore');
    box.formStateRestoreCallback('checked', 'restore');
    await Promise.all([input.updateComplete, box.updateComplete]);
    expect(harness.entries()).toEqual([
      ['q', 'saved'],
      ['c', 'on'],
    ]);
  });
});

describe('disabled and fieldset disabled', () => {
  it('a disabled fieldset disables the control, its inner control, and its submission', async () => {
    const harness = await formHarness(
      `<fieldset><tct-test-input name="q" value="x"></tct-test-input></fieldset>`,
    );
    const fieldset = one<HTMLFieldSetElement>(harness.form, 'fieldset');
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    expect(input.isDisabled).toBe(false);

    fieldset.disabled = true;
    await input.updateComplete;
    expect(input.isDisabled).toBe(true);
    expect(input.disabled).toBe(false);
    expect(innerControl(input).disabled).toBe(true);
    expect(harness.entries()).toEqual([]);
    expect(input.willValidate).toBe(false);

    fieldset.disabled = false;
    await input.updateComplete;
    expect(input.isDisabled).toBe(false);
    expect(innerControl(input).disabled).toBe(false);
    expect(harness.values('q')).toEqual(['x']);
  });

  it('a disabled required control is exempt from validation', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" required disabled></tct-test-input>`,
    );
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    await input.updateComplete;
    expect(input.checkValidity()).toBe(true);
    expect(harness.form.checkValidity()).toBe(true);
  });
});

describe('labels', () => {
  it('<label for> names the inner control and focuses it on click', async () => {
    const harness = await formHarness(
      `<label for="name">Full name</label><tct-test-input id="name" name="q"></tct-test-input>`,
    );
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    expect(input.labels).toHaveLength(1);
    if (isChromium) expect(await axNode(innerControl(input))).toMatchObject({name: 'Full name'});
    await userEvent.click(one(harness.form, 'label'));
    expect(deepActiveElement()).toBe(innerControl(input));
  });

  it('clicking the label of a checkbox toggles it', async () => {
    const harness = await formHarness(
      `<label for="c">Agree</label><tct-test-checkbox id="c" name="c"></tct-test-checkbox>`,
    );
    const box = one<TctTestCheckbox>(harness.form, 'tct-test-checkbox');
    const change = recordEvents(box, 'change');
    await userEvent.click(one(harness.form, 'label'));
    await box.updateComplete;
    expect(box.checked).toBe(true);
    expect(change.events).toHaveLength(1);
    expect(harness.values('c')).toEqual(['on']);
  });

  it('a disabled control ignores its label', async () => {
    const harness = await formHarness(
      `<label for="c">Agree</label><tct-test-checkbox id="c" name="c" disabled></tct-test-checkbox>`,
    );
    const box = one<TctTestCheckbox>(harness.form, 'tct-test-checkbox');
    await userEvent.click(one(harness.form, 'label'));
    expect(box.checked).toBe(false);
  });
});

describe('validity and the timing of displayed invalidity (review M6)', () => {
  it('a required empty control is invalid, but shows nothing until the user acted', async () => {
    const harness = await formHarness(`<tct-test-input name="q" required></tct-test-input>`);
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    await settleValidity(input);
    expect(input.validity.valueMissing).toBe(true);
    expect(input.validationMessage).not.toBe('');
    expect(input.willValidate).toBe(true);
    expect(ariaInvalid(input)).toBeNull();
    expect(input.showInvalid).toBe(false);
    expect(input.displayedValidationMessage).toBe('');
    if (!isTier2) expect(hasCustomState(input, 'user-invalid')).toBe(false);
  });

  it('checkValidity() and form.checkValidity() stay silent', async () => {
    const harness = await formHarness(`<tct-test-input name="q" required></tct-test-input>`);
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    await settleValidity(input);
    const invalid = recordEvents(input, 'invalid');
    expect(input.checkValidity()).toBe(false);
    expect(harness.form.checkValidity()).toBe(false);
    await settleValidity(input);
    // The native `invalid` event still fires; only the display is withheld.
    expect(invalid.events.length).toBeGreaterThan(0);
    expect(ariaInvalid(input)).toBeNull();
    if (!isTier2) expect(hasCustomState(input, 'user-invalid')).toBe(false);
  });

  it('reportValidity() displays the error: aria-invalid and :state(user-invalid) flip together', async () => {
    const harness = await formHarness(`<tct-test-input name="q" required></tct-test-input>`);
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    expect(input.reportValidity()).toBe(false);
    await settleValidity(input);
    expect(ariaInvalid(input)).toBe('true');
    expect(input.showInvalid).toBe(true);
    expect(input.displayedValidationMessage).toBe(input.validationMessage);
    if (!isTier2) expect(hasCustomState(input, 'user-invalid')).toBe(true);
  });

  it('shows the error after the user leaves a field they edited, and clears when fixed', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" pattern="[a-z]+"></tct-test-input><button type="button">next</button>`,
    );
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    await userEvent.click(input);
    await userEvent.keyboard('AB1');
    await settleValidity(input);
    // Still typing: nothing displayed yet.
    expect(ariaInvalid(input)).toBeNull();
    expect(input.validity.patternMismatch).toBe(true);

    await pressKeys('Tab');
    await settleValidity(input);
    expect(ariaInvalid(input)).toBe('true');
    if (!isTier2) expect(hasCustomState(input, 'user-invalid')).toBe(true);

    input.value = 'abc';
    await settleValidity(input);
    expect(input.validity.valid).toBe(true);
    expect(ariaInvalid(input)).toBeNull();
    if (!isTier2) expect(hasCustomState(input, 'user-invalid')).toBe(false);
  });

  it('tabbing through an untouched required field displays nothing', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" required></tct-test-input><button type="button">next</button>`,
    );
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    await userEvent.click(input);
    await pressKeys('Tab');
    await settleValidity(input);
    expect(ariaInvalid(input)).toBeNull();
  });

  it('setCustomValidity() and the invalid attribute are custom errors', async () => {
    const harness = await formHarness(`<tct-test-input name="q" value="x"></tct-test-input>`);
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    input.setCustomValidity('Taken');
    expect(input.validity.customError).toBe(true);
    expect(input.validationMessage).toBe('Taken');
    expect(input.checkValidity()).toBe(false);
    input.setCustomValidity('');
    expect(input.validity.valid).toBe(true);

    input.invalid = true;
    await settleValidity(input);
    expect(input.validity.customError).toBe(true);
    // `invalid` is displayed immediately (it is the author's statement, not a constraint).
    expect(ariaInvalid(input)).toBe('true');
    input.invalid = false;
    await settleValidity(input);
    expect(ariaInvalid(input)).toBeNull();
  });

  it('readonly controls are barred from validation', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" required readonly></tct-test-input>`,
    );
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    await settleValidity(input);
    expect(input.willValidate).toBe(false);
    expect(input.checkValidity()).toBe(true);
  });

  it('a checkbox mirrors the native valueMissing message', async () => {
    const harness = await formHarness(`<tct-test-checkbox name="c" required></tct-test-checkbox>`);
    const box = one<TctTestCheckbox>(harness.form, 'tct-test-checkbox');
    await settleValidity(box);
    expect(box.validity.valueMissing).toBe(true);
    box.checked = true;
    await settleValidity(box);
    expect(box.validity.valid).toBe(true);
  });
});

describe('frozen message (review H7)', () => {
  it('the displayed message holds while the control has focus and refreshes on blur', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" minlength="8"></tct-test-input><button type="button">next</button>`,
    );
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    await userEvent.click(input);
    await userEvent.keyboard('abc');
    await pressKeys('Tab');
    await settleValidity(input);
    const first = input.displayedValidationMessage;
    expect(first).not.toBe('');

    await userEvent.click(input);
    await userEvent.keyboard('de');
    await settleValidity(input);
    expect(input.validationMessage, 'the native message changed with the count').not.toBe(first);
    expect(input.displayedValidationMessage, 'but the one on screen is frozen while focused').toBe(
      first,
    );

    await pressKeys('Tab');
    await settleValidity(input);
    expect(input.displayedValidationMessage).toBe(input.validationMessage);
  });
});

describe('validation anchor (review H6)', () => {
  it('a native control focuses itself when submit is blocked', async () => {
    const harness = await formHarness(
      `<tct-test-input name="q" required></tct-test-input><button type="submit">Go</button>`,
    );
    await userEvent.click(one(harness.form, 'button'));
    await nextFrame();
    expect(deepActiveElement()).toBe(innerControl(one(harness.form, 'tct-test-input')));
  });

  it('a group with no native inner control focuses its first enabled item', async () => {
    const harness = await formHarness(
      `<tct-test-group name="g" required></tct-test-group><button type="submit">Go</button>`,
    );
    const group = one<TctTestGroup>(harness.form, 'tct-test-group');
    await settleValidity(group);
    expect(group.validity.valueMissing).toBe(true);
    await userEvent.click(one(harness.form, 'button'));
    await nextFrame();
    expect(harness.submitEvents).toHaveLength(0);
    const first = group.shadowRoot!.querySelector('button');
    expect(deepActiveElement()).toBe(first);
  });

  it('the group is valid once an item is chosen and then submits its value', async () => {
    const harness = await formHarness(`<tct-test-group name="g" required></tct-test-group>`);
    const group = one<TctTestGroup>(harness.form, 'tct-test-group');
    const items = group.shadowRoot!.querySelectorAll('button');
    await userEvent.click(items[1]!);
    await settleValidity(group);
    expect(group.validity.valid).toBe(true);
    expect(harness.values('g')).toEqual(['b']);
  });
});

describe('observers', () => {
  it('observeControl receives the control after each sync and can drive displayed invalidity', async () => {
    const harness = await formHarness(`<tct-test-input name="q" value="x"></tct-test-input>`);
    const input = one<TctTestInput>(harness.form, 'tct-test-input');
    const seen: Element[] = [];
    const observer = {
      invalid: false,
      controlChanged: (control: HTMLElement) => {
        seen.push(control);
      },
    };
    observeControl(input, observer);
    await settleValidity(input);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((control) => control === input)).toBe(true);
    expect(ariaInvalid(input)).toBeNull();

    observer.invalid = true;
    input.requestUpdate();
    await settleValidity(input);
    expect(ariaInvalid(input)).toBe('true');

    unobserveControl(input, observer);
    await settleValidity(input);
    expect(ariaInvalid(input)).toBeNull();
    const count = seen.length;
    input.requestUpdate();
    await settleValidity(input);
    expect(seen).toHaveLength(count);
  });
});

describe('robustness', () => {
  it('waitUntil sees a control created after the form was parsed (late upgrade)', async () => {
    const harness = await formHarness(`<div id="slot"></div>`);
    const late = document.createElement('tct-test-input');
    late.name = 'late';
    late.value = 'v';
    harness.form.querySelector('#slot')!.append(late);
    await waitUntil(() => harness.values('late').length === 1, 'submitted value present');
    expect(harness.values('late')).toEqual(['v']);
  });
});
