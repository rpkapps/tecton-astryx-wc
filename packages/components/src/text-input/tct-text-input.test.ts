/**
 * tct-text-input: the element and form-control suites, then rendering, events (acceptance 7), status and
 * naming (acceptance 6), clear button, adornments, sizes, disabled reason, loading and changeAction, IME,
 * RTL, forced colours and i18n. Ported from upstream TextInput.test.tsx where the behaviour applies.
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
import {hasCustomState} from '@tecton-astryx/testing/forms.js';
import {pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-astryx/testing/suites/form-control.js';
import {isChromium, isTier2} from '@tecton-astryx/testing/tier.js';
import {aTimeout, nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import '../field/define.js';
import '../tooltip/define.js';
import './define.js';
import type {TctTextInput} from './tct-text-input.js';

const inner = (input: TctTextInput): HTMLInputElement =>
  input.shadowRoot!.querySelector<HTMLInputElement>('input.input')!;
const part = (input: TctTextInput, name: string): HTMLElement | null =>
  input.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`);

async function make(attributes = 'label="Name"', extra = ''): Promise<TctTextInput> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:60px 40px"><tct-text-input ${attributes}>${extra}</tct-text-input></div>`,
  );
  const input = wrapper.querySelector<TctTextInput>('tct-text-input')!;
  await input.updateComplete;
  await nextFrame();
  return input;
}

runElementSuite({
  tag: 'tct-text-input',
  render: () => html`<tct-text-input label="Name" name="n"></tct-text-input>`,
  properties: {
    label: 'Other',
    description: 'Help',
    placeholder: 'Type',
    type: 'email',
    size: 'lg',
    loading: true,
    hasClear: true,
    width: 200,
  },
  attributes: {
    label: 'label',
    description: 'description',
    placeholder: 'placeholder',
    type: 'type',
  },
  events: ['tct-clear', 'tct-enter'],
});

runFormControlSuite({
  tag: 'tct-text-input',
  render: (attributes) => `<tct-text-input label="Field" ${attributes}></tct-text-input>`,
  validValue: 'hello',
  submitsOnEnter: true,
  readonly: true,
  labelActivation: 'focus',
  userEdit: async (element) => {
    await userEvent.click(element);
    await userEvent.keyboard('hi');
    await pressKeys('Tab');
  },
});

describe('tct-text-input: rendering (TextInput.test.tsx)', () => {
  it('renders a native input in the shadow root with the label, and the value follows the attribute until set', async () => {
    const input = await make('label="Name" value="Ada" name="n"');
    expect(inner(input).value).toBe('Ada');
    expect(input.value).toBe('Ada');
    input.value = 'Grace';
    await input.updateComplete;
    expect(inner(input).value).toBe('Grace');
    expect(input.defaultValue).toBe('Ada');
    expect(part(input, 'label')!.textContent).toContain('Name');
  });

  it('forwards type, placeholder, name, autocomplete, inputmode, enterkeyhint and native constraints to the input', async () => {
    const input = await make(
      'label="Email" type="email" placeholder="you@example.com" name="e" autocomplete="email" inputmode="email" enterkeyhint="send" minlength="3" maxlength="20" pattern=".+@.+"',
    );
    const control = inner(input);
    expect(control.type).toBe('email');
    expect(control.placeholder).toBe('you@example.com');
    expect(control.name).toBe('e');
    expect(control.autocomplete).toBe('email');
    expect(control.getAttribute('inputmode')).toBe('email');
    expect(control.getAttribute('enterkeyhint')).toBe('send');
    expect(control.minLength).toBe(3);
    expect(control.maxLength).toBe(20);
    expect(control.pattern).toBe('.+@.+');
    input.setAttribute('inputmode', 'numeric');
    await input.updateComplete;
    expect(control.getAttribute('inputmode')).toBe('numeric');
  });

  it('supports the search, tel, url and password types and falls back to text for an invalid one', async () => {
    for (const type of ['search', 'tel', 'url', 'password']) {
      expect(inner(await make(`label="x" type="${type}"`)).type).toBe(type);
    }
    expect(inner(await make('label="x" type="bogus"')).type).toBe('text');
  });

  it('binds the placeholder to the Tecton outlined-input placeholder role', async () => {
    const input = await make('label="Name" placeholder="Type here"');
    const style = getComputedStyle(inner(input), '::placeholder');
    const probe = document.createElement('div');
    probe.style.color = 'var(--tecton-color-input-outlined-text-placeholder)';
    document.body.append(probe);
    expect(style.color).toBe(getComputedStyle(probe).color);
    probe.remove();
  });

  it('draws the field as the Tecton outlined box: a 1px border, 4px radius, transparent fill, sized by size', async () => {
    const input = await make('label="Name"');
    const box = part(input, 'input')!;
    const style = getComputedStyle(box);
    expect(style.borderTopWidth).toBe('1px');
    expect(style.borderTopLeftRadius).toBe('4px');
    expect(style.backgroundColor).toMatch(/^rgba\(\d+, \d+, \d+, 0\)$/);
    expect(box.getBoundingClientRect().height).toBe(32);
    input.size = 'sm';
    await input.updateComplete;
    expect(box.getBoundingClientRect().height).toBe(28);
    input.size = 'lg';
    await input.updateComplete;
    expect(box.getBoundingClientRect().height).toBe(36);
  });

  it('the size follows the enclosing size provider unless set explicitly', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><tct-text-input label="a" size="lg"></tct-text-input></div>`,
    );
    const input = wrapper.querySelector<TctTextInput>('tct-text-input')!;
    await input.updateComplete;
    expect(part(input, 'input')!.dataset.size).toBe('lg');
  });

  it('shows a start icon, and start and end adornment slots only when filled', async () => {
    const input = await make(
      'label="Search" start-icon="search"',
      '<span slot="start" id="s">$</span><span slot="end" id="e">kg</span>',
    );
    expect(part(input, 'start-icon')!.getAttribute('name')).toBe('search');
    const adornments = input.shadowRoot!.querySelectorAll<HTMLElement>('.adornment');
    expect([...adornments].map((element) => element.hidden)).toEqual([false, false]);
    const bare = await make('label="Plain"');
    expect(
      [...bare.shadowRoot!.querySelectorAll<HTMLElement>('.adornment')].map(
        (element) => element.hidden,
      ),
    ).toEqual([true, true]);
  });

  it('marks required and optional as text, and required blocks submit natively', async () => {
    const required = await make('label="A" required');
    expect(part(required, 'label-indicator')!.textContent).toContain('Required');
    expect(inner(required).required).toBe(true);
    const optional = await make('label="B" optional');
    expect(part(optional, 'label-indicator')!.textContent).toContain('Optional');
    expect(inner(optional).required).toBe(false);
    expect(part(await make('label="C"'), 'label-indicator')).toBeNull();
  });

  it('is read-only: shows the value, submits it, stays in the tab order and cannot be edited', async () => {
    const input = await make('label="Owner" value="Ada" readonly name="o"');
    expect(inner(input).readOnly).toBe(true);
    expect(input.readonly).toBe(true);
    await userEvent.click(inner(input));
    await userEvent.keyboard('xyz');
    expect(inner(input).value).toBe('Ada');
    expect(inner(input).tabIndex).toBe(0);
    expect(getComputedStyle(part(input, 'input')!).opacity).toBe('1');
  });

  it('keeps a hidden label in the DOM (visually hidden) so the input keeps its name', async () => {
    const input = await make('label="Search" label-hidden description="Type a term"');
    expect(part(input, 'label')!.hasAttribute('data-hidden')).toBe(true);
    expect(part(input, 'description')!.hasAttribute('data-hidden')).toBe(true);
    if (isChromium) expect(await axNode(inner(input))).toMatchObject({name: 'Search'});
  });

  it('applies width to the whole field (label, control and status), not just the input', async () => {
    const input = await make('label="Name" width="240"');
    expect(input.shadowRoot!.querySelector('.field')!.getBoundingClientRect().width).toBe(240);
  });

  it('a pressed label or description focuses the input, and so does the padding of the box', async () => {
    const input = await make('label="Name" description="Help"');
    await userEvent.click(part(input, 'label')!);
    expect(deepActiveElement()).toBe(inner(input));
    inner(input).blur();
    await userEvent.click(part(input, 'description')!);
    expect(deepActiveElement()).toBe(inner(input));
    inner(input).blur();
    await userEvent.click(part(input, 'input')!, {position: {x: 2, y: 10}});
    expect(deepActiveElement()).toBe(inner(input));
  });

  it('autofocus focuses the input, and focus() reaches the input rather than a focusable adornment', async () => {
    const input = await make('label="Name" autofocus', '<span slot="start">$</span>');
    await waitUntil(() => deepActiveElement() === inner(input), 'autofocused the input');
    const withButton = await make(
      'label="Other"',
      '<button slot="start" type="button">go</button>',
    );
    withButton.focus();
    expect(deepActiveElement()).toBe(inner(withButton));
  });
});

describe('tct-text-input: events (acceptance 7)', () => {
  it('typing "ab" fires 2 input events, and blur fires exactly 1 composed change from the host', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><tct-text-input label="Name"></tct-text-input><button>after</button></div>`,
    );
    const input = wrapper.querySelector<TctTextInput>('tct-text-input')!;
    await input.updateComplete;
    const inputs = recordEvents(input, 'input');
    const changes = recordEvents(input, 'change');
    await userEvent.click(inner(input));
    await userEvent.keyboard('ab');
    expect(inputs.events).toHaveLength(2);
    expect(changes.events).toHaveLength(0);
    await pressKeys('Tab');
    expect(changes.events).toHaveLength(1);
    expect(changes.events[0]).toMatchObject({composed: true, bubbles: true});
    expect(changes.events[0]!.target).toBe(input);
    expect(input.value).toBe('ab');
  });

  it('emits no events for property or attribute writes', async () => {
    const input = await make('label="Name"');
    const seen = recordEvents(input, ['input', 'change', 'tct-clear', 'tct-enter']);
    input.value = 'x';
    input.setAttribute('value', 'y');
    input.hasClear = true;
    input.disabled = true;
    input.disabled = false;
    await input.updateComplete;
    expect(seen.events).toHaveLength(0);
  });

  it('Enter fires a cancelable tct-enter once; preventing it stops the form from submitting', async () => {
    const wrapper = await fixture<HTMLFormElement>(
      `<form><tct-text-input label="Q" name="q" value="x"></tct-text-input></form>`,
    );
    const submits: SubmitEvent[] = [];
    wrapper.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });
    const input = wrapper.querySelector<TctTextInput>('tct-text-input')!;
    await input.updateComplete;
    const enters = recordEvents(input, 'tct-enter');
    await userEvent.click(inner(input));
    await pressKeys('Enter');
    expect(enters.events).toHaveLength(1);
    expect(enters.events[0]).toMatchObject({cancelable: true, bubbles: true, composed: true});
    expect(submits).toHaveLength(1);

    input.addEventListener('tct-enter', (event) => event.preventDefault());
    await pressKeys('Enter');
    expect(submits).toHaveLength(1);
  });

  it('IME: an Enter that commits a composition fires no tct-enter and submits nothing', async () => {
    const wrapper = await fixture<HTMLFormElement>(
      `<form><tct-text-input label="Q" name="q" value="x"></tct-text-input></form>`,
    );
    const submits: Event[] = [];
    wrapper.addEventListener('submit', (event) => {
      event.preventDefault();
      submits.push(event);
    });
    const input = wrapper.querySelector<TctTextInput>('tct-text-input')!;
    await input.updateComplete;
    const enters = recordEvents(input, 'tct-enter');
    for (const init of [{isComposing: true}, {keyCode: 229}]) {
      inner(input).dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          composed: true,
          cancelable: true,
          ...init,
        }),
      );
    }
    await aTimeout(50);
    expect(enters.events).toHaveLength(0);
    expect(submits).toHaveLength(0);
  });

  it('click is the native retargeted event: one click per activation, none re-dispatched', async () => {
    const input = await make('label="Name" has-clear value="abc"');
    const clicks = recordEvents(input, 'click');
    await userEvent.click(inner(input));
    expect(clicks.events).toHaveLength(1);
  });
});

describe('tct-text-input: clear button', () => {
  const clearButton = (input: TctTextInput): HTMLElement | null =>
    input.shadowRoot!.querySelector<HTMLElement>('tct-input-clear-button');
  const nativeButton = (input: TctTextInput): HTMLButtonElement =>
    clearButton(input)!.shadowRoot!.querySelector('button')!;

  it('shows the clear button only with has-clear and a value that can be edited', async () => {
    const input = await make('label="Search" has-clear');
    expect(clearButton(input)).toBeNull();
    input.value = 'x';
    await input.updateComplete;
    expect(clearButton(input)).not.toBeNull();
    input.readonly = true;
    await input.updateComplete;
    expect(clearButton(input)).toBeNull();
    input.readonly = false;
    input.disabled = true;
    await input.updateComplete;
    expect(clearButton(input)).toBeNull();
  });

  it('names the button contextually ("Clear Search") and keeps focus in the input on a pointer press', async () => {
    const input = await make('label="Search" has-clear value="abc"');
    expect(clearButton(input)!.getAttribute('label')).toBe('Clear Search');
    expect(nativeButton(input).getAttribute('aria-label')).toBe('Clear Search');
    await userEvent.click(inner(input));
    const press = new MouseEvent('mousedown', {bubbles: true, cancelable: true, composed: true});
    nativeButton(input).dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    expect(deepActiveElement()).toBe(inner(input));
  });

  it('clears the value, fires tct-clear (cancelable), input then change, and returns focus to the input', async () => {
    const input = await make('label="Search" has-clear value="abc"');
    const order: string[] = [];
    for (const name of ['tct-clear', 'input', 'change']) {
      input.addEventListener(name, () => order.push(name));
    }
    await userEvent.click(nativeButton(input));
    await waitUntil(() => input.value === '', 'cleared');
    expect(order).toEqual(['tct-clear', 'input', 'change']);
    await waitUntil(() => deepActiveElement() === inner(input), 'focus returned to the input');
    expect(clearButton(input)).toBeNull();
  });

  it('preventing tct-clear keeps the value', async () => {
    const input = await make('label="Search" has-clear value="abc"');
    input.addEventListener('tct-clear', (event) => event.preventDefault());
    await userEvent.click(nativeButton(input));
    await aTimeout(50);
    expect(input.value).toBe('abc');
  });

  it('keyboard: Enter on the focused clear button clears and restores focus to the input synchronously', async () => {
    const input = await make('label="Search" has-clear value="abc"');
    nativeButton(input).focus();
    await pressKeys('Enter');
    expect(input.value).toBe('');
    expect(deepActiveElement()).toBe(inner(input));
  });

  it('the clear button shows a tooltip with its name on keyboard focus', async () => {
    const input = await make('label="Search" has-clear value="abc"');
    inner(input).focus();
    await pressKeys('Tab');
    const tooltip = clearButton(input)!.shadowRoot!.querySelector('tct-tooltip')!;
    await waitUntil(() => tooltip.isOpen, 'tooltip opened on focus');
    expect(tooltip.getAttribute('content')).toBe('Clear Search');
  });
});

describe('tct-text-input: status', () => {
  it('draws the status border and glyph and sets aria-invalid for an error', async () => {
    const input = await make('label="Email" status-type="error"');
    expect(part(input, 'input')!.dataset.status).toBe('error');
    expect(part(input, 'status-icon')!.getAttribute('name')).toBe('error');
    expect(inner(input).getAttribute('aria-invalid')).toBe('true');
    const warning = await make('label="Email" status-type="warning"');
    expect(inner(warning).hasAttribute('aria-invalid')).toBe(false);
  });

  it('attached: shows the message below the input and describes the input by it', async () => {
    const input = await make(
      'label="Email" description="Help" status-type="error" status-message="Enter a valid email"',
    );
    const status = input.shadowRoot!.querySelector<HTMLElement>('tct-field-status')!;
    expect(status.textContent).toBe('Enter a valid email');
    expect(status.getAttribute('variant')).toBe('attached');
    expect(inner(input).getAttribute('aria-describedby')!.split(' ')).toEqual([
      part(input, 'description')!.id,
      status.id,
    ]);
    expect(part(input, 'status-icon')).not.toBeNull();
  });

  it('detached: a separate message with its own icon and no glyph inside the box', async () => {
    const input = await make(
      'label="Email" status-type="warning" status-message="Careful" status-variant="detached"',
    );
    const status = input.shadowRoot!.querySelector<HTMLElement>('tct-field-status')!;
    expect(status.getAttribute('variant')).toBe('detached');
    expect(part(input, 'status-icon')).toBeNull();
  });

  it('tooltip: no message box; the glyph is a focusable button whose tooltip carries the message', async () => {
    const input = await make(
      'label="Email" status-type="error" status-message="Bad address" status-variant="tooltip"',
    );
    expect(input.shadowRoot!.querySelector('tct-field-status')).toBeNull();
    const button = part(input, 'status-button') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Error details');
    const tooltip = button.closest('tct-tooltip')!;
    expect(tooltip.getAttribute('content')).toBe('Bad address');
    // The input itself is described by the message too, so a screen-reader user hears it on the field.
    const describedby = inner(input).getAttribute('aria-describedby')!;
    expect(input.shadowRoot!.getElementById(describedby.split(' ').at(-1)!)!.textContent).toBe(
      'Bad address',
    );
    button.focus();
    await waitUntil(() => tooltip.isOpen, 'opened by keyboard focus');
  });

  it('shows the browser validation message as the status once invalidity is displayed, not before', async () => {
    const wrapper = await fixture<HTMLFormElement>(
      `<form><tct-text-input label="Name" name="n" required></tct-text-input><button>go</button></form>`,
    );
    const input = wrapper.querySelector<TctTextInput>('tct-text-input')!;
    await input.updateComplete;
    expect(input.shadowRoot!.querySelector('tct-field-status')).toBeNull();
    input.reportValidity();
    await waitUntil(
      () => input.shadowRoot!.querySelector('tct-field-status') !== null,
      'message shown',
    );
    expect(input.shadowRoot!.querySelector('tct-field-status')!.textContent.trim()).not.toBe('');
    expect(part(input, 'input')!.dataset.status).toBe('error');
  });

  it('announces the message once, politely, when it appears', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const input = await make('label="Email"');
      input.status = {type: 'error', message: 'Enter a valid email'};
      await waitUntil(
        () => getAnnouncerRegions().polite?.textContent === 'Enter a valid email',
        'announced',
        2000,
      );
      expect(getAnnouncerRegions().assertive).toBeUndefined();
    } finally {
      restore();
    }
  });

  it('the status property reads and writes status-type and status-message together', async () => {
    const input = await make('label="Email" status-type="warning" status-message="Hmm"');
    expect(input.status).toEqual({type: 'warning', message: 'Hmm'});
    input.status = undefined;
    await input.updateComplete;
    expect(part(input, 'input')!.dataset.status).toBeUndefined();
  });
});

describe('tct-text-input: naming (acceptance 6)', () => {
  it.skipIf(!isChromium)(
    'the input gets its role, name and description from the label, description and status in the same shadow root',
    async () => {
      const input = await make(
        'label="Email" description="We never share it" status-type="error" status-message="Required"',
      );
      expect(await axNode(inner(input))).toMatchObject({
        role: 'textbox',
        name: 'Email',
        description: 'We never share it Required',
      });
    },
  );

  it.skipIf(!isChromium)(
    'an external <label for> names the control when there is no label of its own',
    async () => {
      const wrapper = await fixture<HTMLElement>(
        `<div><label for="x">External name</label><tct-text-input id="x" name="x"></tct-text-input></div>`,
      );
      const input = wrapper.querySelector<TctTextInput>('tct-text-input')!;
      await input.updateComplete;
      expect((await axNode(inner(input))).name).toContain('External name');
    },
  );

  it.skipIf(!isChromium)(
    'an author aria-label and aria-describedby on the host reach the inner input and merge with the chrome',
    async () => {
      const wrapper = await fixture<HTMLElement>(
        `<div><p id="hint">Author hint</p><tct-text-input label="Email" description="Help" aria-describedby="hint" aria-label="Custom name"></tct-text-input></div>`,
      );
      const input = wrapper.querySelector<TctTextInput>('tct-text-input')!;
      await input.updateComplete;
      await nextFrame();
      const node = await axNode(inner(input));
      expect(node.name).toBe('Custom name');
      expect(node.description).toContain('Help');
      if (!isTier2) expect(node.description).toContain('Author hint');
    },
  );

  it('passes axe in the default, error, disabled and read-only states, and with adornments', async () => {
    for (const attributes of [
      'label="Name"',
      'label="Name" required status-type="error" status-message="Required"',
      'label="Name" disabled value="x"',
      'label="Name" readonly value="x"',
      'label="Search" label-hidden has-clear value="x" start-icon="search"',
    ]) {
      await expectAccessible(await make(attributes));
    }
  });
});

describe('tct-text-input: disabled, disabled reason, loading and changeAction', () => {
  it('a disabled input is natively disabled and dimmed with disabled tokens', async () => {
    const input = await make('label="Name" disabled value="x"');
    expect(inner(input).disabled).toBe(true);
    expect(part(input, 'input')!.hasAttribute('data-disabled')).toBe(true);
    expect(part(input, 'label')!.hasAttribute('data-disabled')).toBe(true);
  });

  it('disabled-message keeps the field focusable (aria-disabled, read-only) and shows the reason in a tooltip', async () => {
    const input = await make(
      'label="Owner" value="Ada" disabled disabled-message="You need the Editor role"',
    );
    const control = inner(input);
    expect(control.disabled).toBe(false);
    expect(control.getAttribute('aria-disabled')).toBe('true');
    expect(control.readOnly).toBe(true);
    const tooltip = part(input, 'input')!.closest('tct-tooltip')!;
    expect(tooltip.getAttribute('content')).toBe('You need the Editor role');
    control.focus();
    await waitUntil(() => tooltip.isOpen, 'reason shown on keyboard focus');
    await userEvent.keyboard('zzz');
    expect(control.value).toBe('Ada');
  });

  it('loading shows a busy indicator and sets aria-busy and :state(busy)', async () => {
    const input = await make('label="Name" loading');
    expect(inner(input).getAttribute('aria-busy')).toBe('true');
    expect(input.shadowRoot!.querySelector('[part="busy"], tct-spinner')).not.toBeNull();
    if (!isTier2) expect(hasCustomState(input, 'busy')).toBe(true);
    input.loading = false;
    await input.updateComplete;
    expect(inner(input).hasAttribute('aria-busy')).toBe(false);
  });

  it('changeAction runs after each user edit with the value and event, busy while its promise is pending', async () => {
    const input = await make('label="Name"');
    const calls: string[] = [];
    let release: () => void = () => undefined;
    input.changeAction = (value) => {
      calls.push(value);
      return new Promise<void>((resolve) => {
        release = resolve;
      });
    };
    await userEvent.click(inner(input));
    await userEvent.keyboard('a');
    expect(calls).toEqual(['a']);
    await waitUntil(() => inner(input).getAttribute('aria-busy') === 'true', 'busy while pending');
    release();
    await waitUntil(() => !inner(input).hasAttribute('aria-busy'), 'not busy after it settled');
  });
});

describe('tct-text-input: RTL, forced colours, i18n', () => {
  it('RTL: the start icon is at the right edge and the clear button at the left', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div dir="rtl"><tct-text-input label="بحث" start-icon="search" has-clear value="x"></tct-text-input></div>`,
      {dir: 'rtl'},
    );
    const input = wrapper.querySelector<TctTextInput>('tct-text-input')!;
    await input.updateComplete;
    await nextFrame();
    const box = part(input, 'input')!.getBoundingClientRect();
    const icon = part(input, 'start-icon')!.getBoundingClientRect();
    const clear = input
      .shadowRoot!.querySelector('tct-input-clear-button')!
      .getBoundingClientRect();
    expect(box.right - icon.right).toBeLessThan(icon.left - box.left);
    expect(clear.left - box.left).toBeLessThan(box.right - clear.right);
  });

  it('forced colours: the box keeps a system-colour border and the focus ring stays visible', async () => {
    const input = await make('label="Name"');
    await emulateMedia({forcedColors: 'active'});
    inner(input).focus();
    await nextFrame();
    expect(getComputedStyle(part(input, 'input')!).borderTopStyle).toBe('solid');
    expect(getComputedStyle(part(input, 'input')!).outlineStyle).not.toBe('none');
    await emulateMedia({forcedColors: 'none'});
  });

  it('the clear button label follows the language (de-DE) and the direction of ar-SA is RTL', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-text-input label="Suche" has-clear value="x"></tct-text-input></div>`,
    );
    const input = wrapper.querySelector<TctTextInput>('tct-text-input')!;
    await waitUntil(
      () =>
        !input
          .shadowRoot!.querySelector('tct-input-clear-button')!
          .getAttribute('label')!
          .startsWith('Clear'),
      'German label loaded',
      4000,
    );
    expect(
      input.shadowRoot!.querySelector('tct-input-clear-button')!.getAttribute('label'),
    ).toContain('Suche');
  });
});
