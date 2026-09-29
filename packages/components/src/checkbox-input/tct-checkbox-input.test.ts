/**
 * tct-checkbox-input: the element and form-control suites, then toggling, events, the mixed state,
 * labelling, status, disabled reason, loading and changeAction, validation timing, RTL, forced colours
 * and i18n. Ported from upstream CheckboxInput.test.tsx where the behaviour applies.
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
import {deepQueryAll, fixture} from '@tecton-astryx/testing/fixture.js';
import {formHarness, hasCustomState} from '@tecton-astryx/testing/forms.js';
import {pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-astryx/testing/suites/form-control.js';
import {isChromium, isTier2} from '@tecton-astryx/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import '../field/define.js';
import '../tooltip/define.js';
import './define.js';
import type {TctCheckboxInput} from './tct-checkbox-input.js';

const inner = (checkbox: TctCheckboxInput): HTMLInputElement =>
  checkbox.shadowRoot!.querySelector<HTMLInputElement>('input.input')!;
const part = (checkbox: TctCheckboxInput, name: string): HTMLElement | null =>
  checkbox.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
const indicator = (checkbox: TctCheckboxInput): HTMLElement =>
  checkbox.shadowRoot!.querySelector<HTMLElement>('tct-checkbox-indicator')!;

/** Waits for running animations (a message fading in) so axe measures settled colours. */
async function motionDone(element: Element): Promise<void> {
  await nextFrame();
  const running = deepQueryAll(element.parentElement ?? element, () => true)
    .flatMap((node) => node.getAnimations())
    // A spinner never finishes: only the fades and slides that end.
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
  await Promise.allSettled(running.map((animation) => animation.finished));
}

async function make(attributes = 'label="Accept terms"', extra = ''): Promise<TctCheckboxInput> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:60px 40px"><tct-checkbox-input ${attributes}>${extra}</tct-checkbox-input></div>`,
  );
  const checkbox = wrapper.querySelector<TctCheckboxInput>('tct-checkbox-input')!;
  await checkbox.updateComplete;
  await nextFrame();
  return checkbox;
}

runElementSuite({
  tag: 'tct-checkbox-input',
  render: () => html`<tct-checkbox-input label="Accept" name="a"></tct-checkbox-input>`,
  properties: {
    label: 'Other',
    description: 'Help',
    size: 'sm',
    loading: true,
    checked: true,
    indeterminate: true,
    labelHidden: true,
    width: 200,
  },
  attributes: {
    label: 'label',
    description: 'description',
    size: 'size',
    indeterminate: 'indeterminate',
  },
});

runFormControlSuite({
  tag: 'tct-checkbox-input',
  render: (attributes) => `<tct-checkbox-input label="Field" ${attributes}></tct-checkbox-input>`,
  validValue: 'on',
  restoreState: 'checked',
  setValid: (element) => {
    (element as unknown as TctCheckboxInput).checked = true;
  },
  setEmpty: (element) => {
    (element as unknown as TctCheckboxInput).checked = false;
  },
  readonly: true,
  labelActivation: 'click',
  userEdit: async (element) => {
    await userEvent.click(inner(element as unknown as TctCheckboxInput));
  },
});

describe('tct-checkbox-input: rendering and toggling (CheckboxInput.test.tsx)', () => {
  it('renders a native checkbox in the shadow root, named by its label', async () => {
    const checkbox = await make('label="Accept terms"');
    expect(inner(checkbox).type).toBe('checkbox');
    expect(part(checkbox, 'label')!.textContent).toContain('Accept terms');
    if (isChromium) {
      const node = await axNode(inner(checkbox));
      expect(node.role).toBe('checkbox');
      expect(node.name).toBe('Accept terms');
    }
  });

  it('the checked attribute is the default; the property is the current state', async () => {
    const checkbox = await make('label="Subscribe" checked');
    expect(checkbox.checked).toBe(true);
    expect(checkbox.defaultChecked).toBe(true);
    expect(inner(checkbox).checked).toBe(true);
    checkbox.checked = false;
    await checkbox.updateComplete;
    expect(inner(checkbox).checked).toBe(false);
    expect(checkbox.hasAttribute('checked')).toBe(true);
    expect(checkbox.defaultChecked).toBe(true);
  });

  it('a click toggles it and fires input then change once each; writing checked fires nothing', async () => {
    const checkbox = await make('label="Accept terms"');
    const events = recordEvents(checkbox, ['input', 'change']);
    await userEvent.click(inner(checkbox));
    expect(events.events.map((event) => event.type)).toEqual(['input', 'change']);
    expect(checkbox.checked).toBe(true);
    await userEvent.click(inner(checkbox));
    expect(checkbox.checked).toBe(false);
    expect(events.events).toHaveLength(4);
    checkbox.checked = true;
    await checkbox.updateComplete;
    expect(events.events).toHaveLength(4);
  });

  it('works when clicking on the label and on the description', async () => {
    const checkbox = await make('label="Subscribe" description="Weekly updates"');
    await userEvent.click(part(checkbox, 'label')!);
    expect(checkbox.checked).toBe(true);
    await userEvent.click(part(checkbox, 'description')!);
    expect(checkbox.checked).toBe(false);
  });

  it('Space toggles the focused checkbox', async () => {
    const checkbox = await make('label="Accept terms"');
    checkbox.focus();
    expect(deepActiveElement()).toBe(inner(checkbox));
    await pressKeys(' ');
    expect(checkbox.checked).toBe(true);
    await pressKeys(' ');
    expect(checkbox.checked).toBe(false);
  });

  it('a host click() toggles it once (label activation and programmatic click)', async () => {
    const checkbox = await make('label="Accept terms"');
    const events = recordEvents(checkbox, 'change');
    checkbox.click();
    expect(checkbox.checked).toBe(true);
    expect(events.events).toHaveLength(1);
  });

  it('focus() focuses the input, even when an info tip button comes first', async () => {
    const checkbox = await make('label="Accept terms" label-tooltip="More about terms"');
    checkbox.focus();
    expect(deepActiveElement()).toBe(inner(checkbox));
  });

  it('cancelling the click keeps the old state (a controlled checkbox)', async () => {
    const checkbox = await make('label="Accept terms"');
    checkbox.addEventListener('click', (event) => event.preventDefault());
    const events = recordEvents(checkbox, ['input', 'change']);
    await userEvent.click(inner(checkbox));
    expect(checkbox.checked).toBe(false);
    expect(inner(checkbox).checked).toBe(false);
    expect(events.events).toHaveLength(0);
  });

  it('sm and md draw a 20px and a 24px box', async () => {
    const checkbox = await make('label="Accept terms"');
    expect(indicator(checkbox).getBoundingClientRect().width).toBe(24);
    checkbox.size = 'sm';
    await checkbox.updateComplete;
    await nextFrame();
    expect(indicator(checkbox).getBoundingClientRect().width).toBe(20);
  });

  it('forwards the checked state to the indicator', async () => {
    const checkbox = await make('label="Accept terms"');
    expect(indicator(checkbox).getAttribute('state')).toBe('unchecked');
    checkbox.checked = true;
    await checkbox.updateComplete;
    expect(indicator(checkbox).getAttribute('state')).toBe('checked');
    checkbox.indeterminate = true;
    await checkbox.updateComplete;
    expect(indicator(checkbox).getAttribute('state')).toBe('indeterminate');
  });
});

describe('tct-checkbox-input: indeterminate', () => {
  it('exposes the mixed state through the native indeterminate property and the accessibility tree', async () => {
    const checkbox = await make('label="Select all" indeterminate');
    expect(inner(checkbox).indeterminate).toBe(true);
    if (isChromium) expect((await axNode(inner(checkbox))).checked).toBe('mixed');
  });

  it('a click on an indeterminate checkbox makes it checked and clears the mixed state', async () => {
    const checkbox = await make('label="Select all" indeterminate');
    const events = recordEvents(checkbox, ['input', 'change']);
    await userEvent.click(inner(checkbox));
    expect(checkbox.checked).toBe(true);
    expect(checkbox.indeterminate).toBe(false);
    expect(inner(checkbox).indeterminate).toBe(false);
    expect(events.events).toHaveLength(2);
  });

  it('submits nothing while indeterminate and unchecked', async () => {
    const form = await formHarness(
      '<tct-checkbox-input label="All" name="all" indeterminate></tct-checkbox-input>',
    );
    expect(form.entries()).toEqual([]);
  });
});

describe('tct-checkbox-input: form participation', () => {
  it('submits name=on when checked, and the value attribute when set', async () => {
    const form = await formHarness(
      '<tct-checkbox-input label="A" name="a" checked></tct-checkbox-input><tct-checkbox-input label="B" name="b" value="yes" checked></tct-checkbox-input><tct-checkbox-input label="C" name="c"></tct-checkbox-input>',
    );
    expect(form.entries()).toEqual([
      ['a', 'on'],
      ['b', 'yes'],
    ]);
  });

  it('reset returns to the checked attribute; a user toggle does not change the default', async () => {
    const form = await formHarness(
      '<tct-checkbox-input label="A" name="a" checked></tct-checkbox-input>',
    );
    const checkbox = form.form.querySelector<TctCheckboxInput>('tct-checkbox-input')!;
    await userEvent.click(inner(checkbox));
    expect(form.entries()).toEqual([]);
    form.reset();
    await checkbox.updateComplete;
    expect(checkbox.checked).toBe(true);
    expect(form.entries()).toEqual([['a', 'on']]);
  });

  it('required and unchecked blocks the submit, focuses the checkbox and shows the error only then', async () => {
    const form = await formHarness(
      '<tct-checkbox-input label="I agree" name="terms" required></tct-checkbox-input><button type="submit">Go</button>',
    );
    const checkbox = form.form.querySelector<TctCheckboxInput>('tct-checkbox-input')!;
    await checkbox.updateComplete;
    expect(inner(checkbox).hasAttribute('aria-invalid')).toBe(false);
    expect(checkbox.validity.valueMissing).toBe(true);
    await userEvent.click(form.form.querySelector('button')!);
    await checkbox.updateComplete;
    await nextFrame();
    expect(form.submitEvents).toHaveLength(0);
    expect(inner(checkbox).getAttribute('aria-invalid')).toBe('true');
    expect(deepActiveElement()).toBe(inner(checkbox));
    const status = checkbox.shadowRoot!.querySelector<HTMLElement>('tct-field-status')!;
    expect(status.getAttribute('variant')).toBe('detached');
    expect(status.textContent.trim()).not.toBe('');
    // Checking it clears the error.
    await userEvent.click(inner(checkbox));
    await checkbox.updateComplete;
    expect(checkbox.validity.valid).toBe(true);
  });

  it('does not block the form when required and disabled with a disabledMessage (a disabled control is barred)', async () => {
    const form = await formHarness(
      '<tct-checkbox-input label="Terms" name="terms" required disabled disabled-message="Managed by your admin"></tct-checkbox-input>',
    );
    const checkbox = form.form.querySelector<TctCheckboxInput>('tct-checkbox-input')!;
    await checkbox.updateComplete;
    expect(form.form.checkValidity()).toBe(true);
    expect(form.entries()).toEqual([]);
  });

  it('a checkbox outside the form joins it through the form attribute', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><form id="f"></form><tct-checkbox-input label="A" name="a" form="f" checked></tct-checkbox-input></div>',
    );
    const form = wrapper.querySelector('form')!;
    await wrapper.querySelector<TctCheckboxInput>('tct-checkbox-input')!.updateComplete;
    expect([...new FormData(form).entries()]).toEqual([['a', 'on']]);
  });

  it('read-only keeps the state, blocks toggling, and is submitted', async () => {
    const form = await formHarness(
      '<tct-checkbox-input label="A" name="a" checked readonly></tct-checkbox-input>',
    );
    const checkbox = form.form.querySelector<TctCheckboxInput>('tct-checkbox-input')!;
    await checkbox.updateComplete;
    const events = recordEvents(checkbox, ['input', 'change']);
    await userEvent.click(inner(checkbox));
    expect(checkbox.checked).toBe(true);
    expect(events.events).toHaveLength(0);
    expect(inner(checkbox).getAttribute('aria-readonly')).toBe('true');
    expect(form.entries()).toEqual([['a', 'on']]);
    // Not dimmed, unlike disabled.
    expect(getComputedStyle(indicator(checkbox).shadowRoot!.querySelector('.box')!).opacity).toBe(
      '1',
    );
  });
});

describe('tct-checkbox-input: label, description and naming', () => {
  it('hides the label visually with label-hidden but keeps it named, and drops the gap', async () => {
    const checkbox = await make('label="Accept terms" label-hidden');
    const label = part(checkbox, 'label')!;
    expect(label.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    expect(getComputedStyle(part(checkbox, 'row')!).columnGap).toBe('0px');
    if (isChromium) expect((await axNode(inner(checkbox))).name).toBe('Accept terms');
    expect(part(checkbox, 'control')!.getBoundingClientRect().width).toBe(24);
    expect(part(checkbox, 'label-wrapper')!.getBoundingClientRect().width).toBeLessThanOrEqual(1);
  });

  it('keeps the description linked through aria-describedby, even with a hidden label', async () => {
    const checkbox = await make('label="Subscribe" description="Weekly updates" label-hidden');
    const id = part(checkbox, 'description')!.id;
    expect(inner(checkbox).getAttribute('aria-describedby')!.split(' ')).toContain(id);
    if (isChromium) expect((await axNode(inner(checkbox))).description).toContain('Weekly updates');
  });

  it('merges a host aria-describedby with its own description id', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><p id="hint">Row hint</p><tct-checkbox-input label="Subscribe" description="Weekly updates" aria-describedby="hint"></tct-checkbox-input></div>`,
    );
    const checkbox = wrapper.querySelector<TctCheckboxInput>('tct-checkbox-input')!;
    await checkbox.updateComplete;
    await nextFrame();
    if (isChromium) {
      const node = await axNode(inner(checkbox));
      expect(node.description).toContain('Weekly updates');
      if (!isTier2) expect(node.description).toContain('Row hint');
    }
  });

  it('a host aria-label reaches the inner checkbox and replaces the name', async () => {
    const checkbox = await make('label="Row" aria-label="Select row 3"');
    if (isChromium) expect((await axNode(inner(checkbox))).name).toBe('Select row 3');
  });

  it('shows the Required and Optional indicators as text, and the label icon and info tip', async () => {
    const required = await make('label="Terms" required');
    expect(part(required, 'label-indicator')!.textContent).toContain('Required');
    expect(inner(required).required).toBe(true);
    const optional = await make('label="Terms" optional label-icon="star" label-tooltip="Why?"');
    expect(part(optional, 'label-indicator')!.textContent).toContain('Optional');
    expect(optional.shadowRoot!.querySelector('.label-icon')!.getAttribute('name')).toBe('star');
    expect(part(optional, 'label-tip')).not.toBeNull();
  });
});

describe('tct-checkbox-input: status', () => {
  it('renders the status message detached, with an icon, and describes the checkbox by it', async () => {
    const checkbox = await make(
      'label="Terms" description="Read them" status-type="error" status-message="You must accept"',
    );
    const status = checkbox.shadowRoot!.querySelector<HTMLElement>('tct-field-status')!;
    expect(status.getAttribute('variant')).toBe('detached');
    expect(status.getAttribute('type')).toBe('error');
    expect(status.textContent).toBe('You must accept');
    expect(inner(checkbox).getAttribute('aria-describedby')!.split(' ')).toContain(status.id);
    expect(inner(checkbox).getAttribute('aria-invalid')).toBe('true');
  });

  it('sets aria-invalid only for an error status', async () => {
    const warning = await make('label="Terms" status-type="warning" status-message="Careful"');
    expect(inner(warning).hasAttribute('aria-invalid')).toBe(false);
    const success = await make('label="Terms" status-type="success"');
    expect(inner(success).hasAttribute('aria-invalid')).toBe(false);
  });

  it('announces a status message that appears after mount, once and politely', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const checkbox = await make('label="Terms"');
      checkbox.status = {type: 'error', message: 'You must accept'};
      await waitUntil(
        () => getAnnouncerRegions().polite?.textContent === 'You must accept',
        'announced',
        2000,
      );
      expect(getAnnouncerRegions().assertive).toBeUndefined();
    } finally {
      restore();
    }
  });
});

describe('tct-checkbox-input: disabled, disabled reason, loading and changeAction', () => {
  it('a disabled checkbox is natively disabled and not toggled', async () => {
    const checkbox = await make('label="Terms" disabled');
    expect(inner(checkbox).disabled).toBe(true);
    expect(indicator(checkbox).hasAttribute('disabled')).toBe(true);
    await userEvent.click(part(checkbox, 'label')!).catch(() => undefined);
    expect(checkbox.checked).toBe(false);
  });

  it('with a disabled-message it stays focusable through aria-disabled, blocks toggling and describes itself by the reason', async () => {
    const checkbox = await make('label="Terms" disabled disabled-message="Managed by your admin"');
    const input = inner(checkbox);
    expect(input.disabled).toBe(false);
    expect(input.getAttribute('aria-disabled')).toBe('true');
    checkbox.focus();
    expect(deepActiveElement()).toBe(input);
    const events = recordEvents(checkbox, ['input', 'change']);
    await pressKeys(' ');
    input.click();
    expect(checkbox.checked).toBe(false);
    expect(events.events).toHaveLength(0);
    const reason = checkbox.shadowRoot!.querySelector<HTMLElement>('.visually-hidden')!;
    expect(reason.textContent).toBe('Managed by your admin');
    expect(input.getAttribute('aria-describedby')!.split(' ')).toContain(reason.id);
    const tooltip = checkbox.shadowRoot!.querySelector('tct-tooltip')!;
    expect(tooltip.getAttribute('content')).toBe('Managed by your admin');
  });

  it('shows the reason tooltip on keyboard focus', async () => {
    const checkbox = await make('label="Terms" disabled disabled-message="Managed by your admin"');
    inner(checkbox).focus();
    await pressKeys('Shift+Tab');
    await pressKeys('Tab');
    const tooltip = checkbox.shadowRoot!.querySelector('tct-tooltip')!;
    await waitUntil(() => (tooltip as unknown as {isOpen: boolean}).isOpen, 'tooltip opened');
  });

  it('a disabled checkbox with a reason submits nothing and does not block the form', async () => {
    const form = await formHarness(
      '<tct-checkbox-input label="T" name="t" checked disabled disabled-message="No"></tct-checkbox-input>',
    );
    expect(form.entries()).toEqual([]);
  });

  it('loading shows a spinner in the box, sets aria-busy and blocks toggling', async () => {
    const checkbox = await make('label="Terms" loading');
    expect(inner(checkbox).getAttribute('aria-busy')).toBe('true');
    expect(indicator(checkbox).querySelector('tct-spinner')).not.toBeNull();
    if (!isTier2) expect(hasCustomState(checkbox, 'busy')).toBe(true);
    await userEvent.click(inner(checkbox));
    expect(checkbox.checked).toBe(false);
  });

  it('changeAction runs after the toggle; busy (spinner, aria-busy) while pending; the state stays', async () => {
    const checkbox = await make('label="Terms"');
    let resolve!: () => void;
    const seen: [boolean, string][] = [];
    checkbox.changeAction = (checked, event) => {
      seen.push([checked, event.type]);
      return new Promise<void>((done) => {
        resolve = done;
      });
    };
    await userEvent.click(inner(checkbox));
    expect(seen).toEqual([[true, 'input']]);
    await checkbox.updateComplete;
    expect(inner(checkbox).getAttribute('aria-busy')).toBe('true');
    expect(indicator(checkbox).querySelector('tct-spinner')).not.toBeNull();
    // Re-toggling is blocked while pending.
    await userEvent.click(inner(checkbox));
    expect(checkbox.checked).toBe(true);
    expect(seen).toHaveLength(1);
    resolve();
    await waitUntil(() => !inner(checkbox).hasAttribute('aria-busy'), 'idle again');
    expect(checkbox.checked).toBe(true);
  });

  it('a rejected changeAction returns the checkbox to its old state', async () => {
    const checkbox = await make('label="Terms"');
    checkbox.changeAction = () => Promise.reject(new Error('nope'));
    await userEvent.click(inner(checkbox));
    await waitUntil(
      () => !inner(checkbox).hasAttribute('aria-busy') && !checkbox.checked,
      'reverted',
    );
    expect(inner(checkbox).checked).toBe(false);
  });
});

describe('tct-checkbox-input: appearance', () => {
  it('draws the Tecton indicator states through the shared checkbox indicator and a 2px focus ring on the box', async () => {
    const checkbox = await make('label="Terms"');
    const wrapper = checkbox.parentElement!;
    const before = wrapper.querySelector<HTMLElement>('tct-checkbox-input')!;
    before.focus();
    await pressKeys('Shift+Tab');
    await pressKeys('Tab');
    await waitUntil(
      () => getComputedStyle(part(checkbox, 'control')!).outlineStyle === 'solid',
      'focus ring',
    );
    expect(getComputedStyle(part(checkbox, 'control')!).outlineWidth).toBe('2px');
  });

  it('exports the indicator parts', async () => {
    const checkbox = await make('label="Terms" checked');
    expect(indicator(checkbox).getAttribute('exportparts')).toContain('checkbox-indicator');
    // The painted box is the indicator's own part, re-exported by the checkbox (`::part(checkbox-indicator)`).
    expect(
      indicator(checkbox).shadowRoot!.querySelector('[part~="checkbox-indicator"]'),
    ).not.toBeNull();
  });

  it('width sizes the whole field', async () => {
    const checkbox = await make('label="Terms" width="200"');
    expect(part(checkbox, 'field')!.getBoundingClientRect().width).toBe(200);
  });

  it('mirrors in RTL: the box sits at the inline start', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div dir="rtl" style="inline-size:300px"><tct-checkbox-input label="Terms"></tct-checkbox-input></div>`,
    );
    const checkbox = wrapper.querySelector<TctCheckboxInput>('tct-checkbox-input')!;
    await checkbox.updateComplete;
    await nextFrame();
    const box = indicator(checkbox).getBoundingClientRect();
    const label = part(checkbox, 'label')!.getBoundingClientRect();
    expect(box.left).toBeGreaterThan(label.left);
  });

  it('keeps the box visible in forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const checkbox = await make('label="Terms" checked');
    const box = indicator(checkbox).shadowRoot!.querySelector<HTMLElement>('.box')!;
    expect(getComputedStyle(box).borderTopStyle).toBe('solid');
  });
});

describe('tct-checkbox-input: accessibility', () => {
  it('passes axe in the default, checked, mixed, error, disabled, read-only and loading states', async () => {
    for (const attributes of [
      'label="Terms"',
      'label="Terms" checked description="Read them"',
      'label="Terms" indeterminate',
      'label="Terms" status-type="error" status-message="You must accept"',
      'label="Terms" disabled',
      'label="Terms" disabled disabled-message="Managed by your admin"',
      'label="Terms" readonly checked',
      'label="Terms" loading',
      'label="Terms" label-hidden',
    ]) {
      const checkbox = await make(attributes);
      await motionDone(checkbox);
      await expectAccessible(checkbox);
    }
  });

  it('localises its strings: the Required indicator and the validation message follow the language', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-checkbox-input label="AGB" required></tct-checkbox-input></div>`,
    );
    const checkbox = wrapper.querySelector<TctCheckboxInput>('tct-checkbox-input')!;
    await checkbox.updateComplete;
    await waitUntil(
      () => !(part(checkbox, 'label-indicator')?.textContent ?? 'Required').includes('Required'),
      'German indicator',
    );
    expect(part(checkbox, 'label-indicator')!.textContent).toMatch(/Erforderlich|Pflicht/i);
  });
});
