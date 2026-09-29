/**
 * Orchestrator review probes: an independent end-to-end check of the foundation contracts,
 * written by the reviewer rather than by the engineer who built them. Real input goes through
 * `userEvent`, and custom and native controls are mixed in one form.
 */
import {userEvent} from 'vitest/browser';
import {beforeAll, describe, expect, it} from 'vitest';
import {defineElement} from '@tecton-astryx/core/define.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {TctTestInput, TctTestSubmit} from '../fixtures/test-form.js';
import {TctTestLayer} from '../fixtures/test-layer.js';
import {fixture} from '../fixture.js';
import {aTimeout, nextFrame, waitUntil} from '../timing.js';

beforeAll(() => {
  for (const ctor of [TctTestInput, TctTestSubmit, TctTestLayer]) defineElement(ctor);
});

const settle = async () => {
  await nextFrame();
  await nextFrame();
};

describe('probe: mixed form', () => {
  async function setup() {
    const form = await fixture<HTMLFormElement>(`
      <form>
        <tct-test-input name="a" required></tct-test-input>
        <input name="b" value="native">
        <tct-test-submit name="go" value="1">Go</tct-test-submit>
      </form>`);
    const submits: FormData[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(new FormData(form, (event as SubmitEvent).submitter));
    });
    return {form, submits, input: form.querySelector('tct-test-input')!};
  }

  it('Enter on an empty required field does not submit and keeps focus on the field', async () => {
    const {submits, input} = await setup();
    input.focus();
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(submits).toHaveLength(0);
    expect(deepActiveElement()?.closest?.('tct-test-input') ?? deepActiveElement()).toBeTruthy();
    expect(input.matches(':invalid')).toBe(true);
  });

  it('typing then Enter submits exactly once with every value and the default submitter', async () => {
    const {submits, input} = await setup();
    input.focus();
    await userEvent.keyboard('xy');
    await userEvent.keyboard('{Enter}');
    await aTimeout(50);
    expect(submits).toHaveLength(1);
    const data = Object.fromEntries(submits[0]!.entries());
    expect(data).toMatchObject({a: 'xy', b: 'native'});
    expect(data.go).toBe('1');
  });

  it('Enter in the native input submits once and includes the custom control value', async () => {
    const {form, submits, input} = await setup();
    (input as unknown as {value: string}).value = 'set';
    await settle();
    form.querySelector<HTMLInputElement>('input[name=b]')!.focus();
    await userEvent.keyboard('{Enter}');
    await aTimeout(50);
    expect(submits).toHaveLength(1);
    expect(submits[0]!.get('a')).toBe('set');
  });

  it('form.reset() restores the custom control and fieldset[disabled] removes it from FormData', async () => {
    const form = await fixture<HTMLFormElement>(`
      <form><fieldset><tct-test-input name="a" value="start"></tct-test-input></fieldset></form>`);
    const input = form.querySelector('tct-test-input') as unknown as HTMLElement & {value: string};
    input.focus();
    await userEvent.keyboard('{End}zz');
    await settle();
    expect(new FormData(form).get('a')).toBe('startzz');
    form.reset();
    await settle();
    expect(input.value).toBe('start');
    form.querySelector('fieldset')!.disabled = true;
    await settle();
    expect(new FormData(form).has('a')).toBe(false);
    expect(input.matches(':disabled')).toBe(true);
  });

  it('IME composition Enter does not submit', async () => {
    const {submits, input} = await setup();
    (input as unknown as {value: string}).value = 'x';
    await settle();
    input.focus();
    const inner = input.shadowRoot!.querySelector('input')!;
    inner.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true,
        composed: true,
      }),
    );
    await aTimeout(50);
    expect(submits).toHaveLength(0);
  });
});

describe('probe: nested layers', () => {
  it('Escape closes one layer per press, innermost first, and focus returns to each opener', async () => {
    const root = await fixture<HTMLElement>(`
      <div>
        <tct-test-layer id="outer" kind="modal">
          <button slot="trigger" id="t1">open outer</button>
          <tct-test-layer id="inner" kind="popover">
            <button slot="trigger" id="t2">open inner</button>
            <button id="in">inside</button>
          </tct-test-layer>
        </tct-test-layer>
      </div>`);
    const outer = root.querySelector<TctTestLayer>('#outer')!;
    const inner = root.querySelector<TctTestLayer>('#inner')!;
    await userEvent.click(root.querySelector('#t1')!);
    await waitUntil(() => outer.layer.isOpen);
    await userEvent.click(root.querySelector('#t2')!);
    await waitUntil(() => inner.layer.isOpen);

    await userEvent.keyboard('{Escape}');
    await waitUntil(() => !inner.layer.isOpen);
    expect(outer.layer.isOpen).toBe(true);
    await waitUntil(() => deepActiveElement()?.id === 't2');

    await userEvent.keyboard('{Escape}');
    await waitUntil(() => !outer.layer.isOpen);
    await waitUntil(() => deepActiveElement()?.id === 't1');
  });

  it('a cancelled close (preventDefault on tct-open-change) keeps the layer open', async () => {
    const root = await fixture<HTMLElement>(`
      <tct-test-layer kind="popover"><button slot="trigger">t</button><p>x</p></tct-test-layer>`);
    const layer = root as unknown as TctTestLayer;
    layer.addEventListener('tct-open-change', (e) => {
      if (!(e as Event & {open: boolean}).open) e.preventDefault();
    });
    await userEvent.click(root.querySelector('button')!);
    await waitUntil(() => layer.layer.isOpen);
    await userEvent.keyboard('{Escape}');
    await aTimeout(100);
    expect(layer.layer.isOpen).toBe(true);
  });
});
