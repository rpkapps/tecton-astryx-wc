/**
 * tct-button as a form submitter (A§9.7 "Submitter", "Implicit submission"): FormData, exact counts,
 * reset, cancellation, validation, fieldset, `form=`, `formaction` overrides.
 */
import {userEvent} from 'vitest/browser';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {formHarness} from '@tecton-wc/testing/forms.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {aTimeout, waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {TctButton} from './tct-button.js';

const buttonOf = (form: HTMLFormElement, selector = 'tct-button'): TctButton =>
  form.querySelector<TctButton>(selector)!;

beforeEach(async () => {
  const corner = document.createElement('div');
  corner.style.cssText =
    'position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:4px;block-size:4px';
  document.body.append(corner);
  await userEvent.hover(corner);
  corner.remove();
});

/** The FormData as the submission builds it, read while the temporary submitter is still in the form. */
function captureData(form: HTMLFormElement): {entries: () => [string, FormDataEntryValue][]} {
  let data: [string, FormDataEntryValue][] | undefined;
  form.addEventListener('submit', (event) => {
    data = [...new FormData(form, event.submitter).entries()];
  });
  return {entries: () => data ?? []};
}

async function submitHarness(content: string) {
  const harness = await formHarness(content);
  for (const button of harness.form.querySelectorAll<TctButton>('tct-button'))
    await button.updateComplete;
  return harness;
}

describe('tct-button type=submit', () => {
  it('is a form-associated element that reports its form', async () => {
    const {form} = await submitHarness('<tct-button type="submit" label="Go"></tct-button>');
    const button = buttonOf(form);
    expect(button.form).toBe(form);
    expect([...form.elements]).toContain(button);
    const outside = await fixture<TctButton>('<tct-button label="Loose"></tct-button>');
    expect(outside.form).toBeNull();
  });

  it('submits exactly once with FormData {a, go=1} (name and value of the submitter)', async () => {
    const harness = await submitHarness(
      '<input name="a" value="x"><tct-button type="submit" name="go" value="1" label="Go"></tct-button>',
    );
    await userEvent.click(buttonOf(harness.form));
    await waitUntil(() => harness.submitEvents.length > 0, 'submit');
    await aTimeout(50);
    expect(harness.submitEvents).toHaveLength(1);
    const submitter = harness.submitEvents[0]!.submitter as HTMLButtonElement;
    expect(submitter.localName).toBe('button'); // a temporary native button, not the host (documented)
    expect(submitter.name).toBe('go');
    expect(submitter.value).toBe('1');
    expect(harness.form.querySelector('[data-tct-temp-submitter]')).toBeNull(); // removed afterwards
  });

  it('the submission carries name=value in FormData', async () => {
    const harness = await submitHarness(
      '<input name="a" value="x"><tct-button type="submit" name="go" value="1" label="Go"></tct-button>',
    );
    const captured = captureData(harness.form);
    buttonOf(harness.form).click();
    await waitUntil(() => harness.submitEvents.length > 0, 'submit');
    expect(captured.entries()).toEqual([
      ['a', 'x'],
      ['go', '1'],
    ]);
  });

  it('only the clicked submitter contributes its entry', async () => {
    const harness = await submitHarness(
      '<tct-button id="one" type="submit" name="action" value="save" label="Save"></tct-button><tct-button id="two" type="submit" name="action" value="publish" label="Publish"></tct-button>',
    );
    const captured = captureData(harness.form);
    await userEvent.click(buttonOf(harness.form, '#two'));
    await waitUntil(() => harness.submitEvents.length > 0, 'submit');
    expect(captured.entries()).toEqual([['action', 'publish']]);
  });

  it('a button without a name submits no entry', async () => {
    const harness = await submitHarness('<tct-button type="submit" label="Go"></tct-button>');
    const captured = captureData(harness.form);
    buttonOf(harness.form).click();
    await waitUntil(() => harness.submitEvents.length > 0, 'submit');
    expect(captured.entries()).toEqual([]);
  });

  it('type=button (the default) never submits', async () => {
    const harness = await submitHarness('<tct-button label="Nothing"></tct-button>');
    await userEvent.click(buttonOf(harness.form));
    await aTimeout(60);
    expect(harness.submitEvents).toHaveLength(0);
  });

  it('host click() submits; so does a click on a <label for>', async () => {
    const harness = await submitHarness(
      '<label for="go">Send it</label><tct-button id="go" type="submit" label="Go"></tct-button>',
    );
    buttonOf(harness.form).click();
    await waitUntil(() => harness.submitEvents.length === 1, 'submit from click()');
    await userEvent.click(harness.form.querySelector('label')!);
    await waitUntil(() => harness.submitEvents.length === 2, 'submit from the label');
  });

  it('cancelling the click cancels the submission and the clickAction', async () => {
    const harness = await submitHarness('<tct-button type="submit" label="Go"></tct-button>');
    const button = buttonOf(harness.form);
    const action = vi.fn();
    button.clickAction = action;
    button.addEventListener('click', (event) => event.preventDefault());
    await userEvent.click(button);
    await aTimeout(60);
    expect(harness.submitEvents).toHaveLength(0);
    expect(action).not.toHaveBeenCalled();
  });

  it('runs a clickAction and the submission for the same click', async () => {
    const harness = await submitHarness('<tct-button type="submit" label="Go"></tct-button>');
    const button = buttonOf(harness.form);
    const action = vi.fn();
    button.clickAction = action;
    await userEvent.click(button);
    await waitUntil(() => harness.submitEvents.length === 1, 'submit');
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('a disabled or busy button submits nothing, from a click or from Enter in a field', async () => {
    const harness = await submitHarness(
      '<input name="a"><tct-button type="submit" label="Go" disabled></tct-button>',
    );
    const button = buttonOf(harness.form);
    button.click();
    harness.form.querySelector('input')!.focus();
    await pressKeys('Enter');
    await aTimeout(60);
    expect(harness.submitEvents).toHaveLength(0);
    button.disabled = false;
    button.loading = true;
    await button.updateComplete;
    button.click();
    await pressKeys('Enter');
    await aTimeout(60);
    expect(harness.submitEvents).toHaveLength(0);
  });

  it('a link button (href) does not submit', async () => {
    const harness = await submitHarness(
      '<tct-button type="submit" href="#nowhere" label="Go"></tct-button>',
    );
    const listener = (event: MouseEvent): void => event.preventDefault();
    window.addEventListener('click', listener);
    await userEvent.click(buttonOf(harness.form));
    window.removeEventListener('click', listener);
    await aTimeout(60);
    expect(harness.submitEvents).toHaveLength(0);
  });
});

describe('implicit submission (Enter in a field)', () => {
  /** Focuses `selector` and presses Enter with the real keyboard; returns what the submission carried. */
  async function pressEnterIn(
    harness: Awaited<ReturnType<typeof submitHarness>>,
    selector: string,
  ) {
    const captured = captureData(harness.form);
    harness.form.querySelector<HTMLInputElement>(selector)!.focus();
    await pressKeys('Enter');
    await aTimeout(120);
    return captured.entries();
  }

  it('one native text input plus tct-button: Enter submits once and the FormData carries the submitter', async () => {
    const harness = await submitHarness(
      '<input name="q" value="x"><tct-button type="submit" name="go" value="1" label="Go"></tct-button>',
    );
    const entries = await pressEnterIn(harness, 'input');
    expect(harness.submitEvents).toHaveLength(1);
    expect(entries).toEqual([
      ['q', 'x'],
      ['go', '1'],
    ]);
    expect((harness.submitEvents[0]!.submitter as HTMLButtonElement).name).toBe('go');
  });

  it('two native text inputs plus only tct-button: Enter submits once with the tct-button as submitter', async () => {
    const harness = await submitHarness(
      '<input name="a" value="x"><input name="b" value="y"><tct-button type="submit" name="go" value="1" label="Go"></tct-button>',
    );
    const entries = await pressEnterIn(harness, '[name=a]');
    expect(harness.submitEvents).toHaveLength(1);
    expect(entries).toEqual([
      ['a', 'x'],
      ['b', 'y'],
      ['go', '1'],
    ]);
  });

  it('a disabled default tct-button: Enter submits nothing, with one field or with two', async () => {
    const one = await submitHarness(
      '<input name="q" value="x"><tct-button type="submit" name="go" label="Go" disabled></tct-button>',
    );
    await pressEnterIn(one, 'input');
    expect(one.submitEvents).toHaveLength(0);
    const two = await submitHarness(
      '<input name="a"><input name="b"><tct-button type="submit" label="Go" disabled></tct-button>',
    );
    await pressEnterIn(two, '[name=a]');
    expect(two.submitEvents).toHaveLength(0);
  });

  it('a native submit button before the tct-button stays the default', async () => {
    const harness = await submitHarness(
      '<input name="q" value="x"><button type="submit" name="native" value="n">Native</button><tct-button type="submit" name="go" value="1" label="Go"></tct-button>',
    );
    const entries = await pressEnterIn(harness, 'input');
    expect(harness.submitEvents).toHaveLength(1);
    expect(harness.submitEvents[0]!.submitter!.localName).toBe('button');
    expect((harness.submitEvents[0]!.submitter as HTMLButtonElement).name).toBe('native');
    expect(entries).toEqual([
      ['q', 'x'],
      ['native', 'n'],
    ]);
  });

  it('a tct-button before a native submit button is the default', async () => {
    const harness = await submitHarness(
      '<input name="q" value="x"><tct-button type="submit" name="go" value="1" label="Go"></tct-button><button type="submit" name="native" value="n">Native</button>',
    );
    const entries = await pressEnterIn(harness, 'input');
    expect(harness.submitEvents).toHaveLength(1);
    expect(entries).toEqual([
      ['q', 'x'],
      ['go', '1'],
    ]);
  });

  it('a busy default button: Enter does not submit', async () => {
    const harness = await submitHarness(
      '<input name="q" value="x"><tct-button type="submit" label="Go" loading></tct-button>',
    );
    await pressEnterIn(harness, 'input');
    expect(harness.submitEvents).toHaveLength(0);
  });

  it('the form bridge installs itself when a submitter connects (idempotently)', async () => {
    // A form of native fields plus tct-button, nothing else: no FormControlMixin element is present.
    const harness = await submitHarness(
      '<input name="q" value="x"><tct-button type="submit" name="go" value="1" label="Go"></tct-button>',
    );
    const other = await submitHarness(
      '<input name="q"><tct-button type="submit" name="go" value="2" label="Go"></tct-button>',
    );
    const entries = await pressEnterIn(harness, 'input');
    expect(entries).toContainEqual(['go', '1']);
    expect(other.submitEvents).toHaveLength(0);
    const second = await pressEnterIn(other, 'input');
    expect(second).toContainEqual(['go', '2']);
    expect(harness.submitEvents).toHaveLength(1); // never twice: a second install must not add a second listener
  });
});

describe('tct-button type=reset', () => {
  it('resets the form to its defaults', async () => {
    const harness = await submitHarness(
      '<input name="a" value="start"><tct-button type="reset" label="Reset"></tct-button>',
    );
    const input = harness.form.querySelector<HTMLInputElement>('input')!;
    input.value = 'changed';
    await userEvent.click(buttonOf(harness.form));
    await waitUntil(() => input.value === 'start', 'reset');
    expect(harness.submitEvents).toHaveLength(0);
  });
});

describe('form association details', () => {
  it('the form attribute associates a button outside the form', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><form id="f"><input name="a" value="x"></form><tct-button type="submit" form="f" name="go" value="1" label="Go"></tct-button></div>',
    );
    const form = wrapper.querySelector<HTMLFormElement>('form')!;
    const button = wrapper.querySelector<TctButton>('tct-button')!;
    await button.updateComplete;
    expect(button.form).toBe(form);
    const submits: Event[] = [];
    form.addEventListener('submit', (event) => {
      submits.push(event);
      event.preventDefault();
    });
    await userEvent.click(button);
    await waitUntil(() => submits.length === 1, 'submit through form=');
  });

  it('a <fieldset disabled> disables the button: no submission, native disabled inside', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<form><fieldset disabled><tct-button type="submit" label="Go"></tct-button></fieldset></form>',
    );
    const form = wrapper as unknown as HTMLFormElement;
    const button = form.querySelector<TctButton>('tct-button')!;
    await button.updateComplete;
    await waitUntil(
      () => button.shadowRoot!.querySelector('.button')!.hasAttribute('disabled'),
      'disabled',
    );
    let submitted = false;
    form.addEventListener('submit', (event) => {
      submitted = true;
      event.preventDefault();
    });
    button.click();
    await aTimeout(60);
    expect(submitted).toBe(false);
    form.querySelector('fieldset')!.disabled = false;
    await waitUntil(
      () => !button.shadowRoot!.querySelector('.button')!.hasAttribute('disabled'),
      'enabled',
    );
  });

  it('constraint validation blocks the submission; formnovalidate skips it', async () => {
    const harness = await submitHarness(
      '<input name="a" required><tct-button type="submit" label="Go"></tct-button><tct-button id="skip" type="submit" formnovalidate label="Save draft"></tct-button>',
    );
    await userEvent.click(buttonOf(harness.form));
    await aTimeout(80);
    expect(harness.submitEvents).toHaveLength(0);
    await userEvent.click(buttonOf(harness.form, '#skip'));
    await waitUntil(() => harness.submitEvents.length === 1, 'submit without validation');
  });

  it('form* attributes override where and how the form submits', async () => {
    const harness = await submitHarness(
      '<tct-button type="submit" formaction="/other" formmethod="post" formtarget="_self" label="Go"></tct-button>',
    );
    buttonOf(harness.form).click();
    await waitUntil(() => harness.submitEvents.length === 1, 'submit');
    const submitter = harness.submitEvents[0]!.submitter as HTMLButtonElement;
    expect(submitter.formAction).toContain('/other');
    expect(submitter.formMethod).toBe('post');
  });
});
