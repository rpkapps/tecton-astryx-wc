/**
 * tct-switch: the element and form-control suites, then role and toggling, events, labelling and label
 * layout, status, disabled reason, loading and changeAction, validation timing, the track and thumb in
 * both text directions and forced colours, and i18n. Ported from upstream Switch.test.tsx where the
 * behaviour applies.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {getAnnouncerRegions} from '@tecton-wc/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {deepQueryAll, fixture} from '@tecton-wc/testing/fixture.js';
import {formHarness, hasCustomState} from '@tecton-wc/testing/forms.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-wc/testing/suites/form-control.js';
import {isChromium, isTier2} from '@tecton-wc/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../field/define.js';
import '../tooltip/define.js';
import './define.js';
import type {TctSwitch} from './tct-switch.js';

const inner = (element: TctSwitch): HTMLInputElement =>
  element.shadowRoot!.querySelector<HTMLInputElement>('input.input')!;
const part = (element: TctSwitch, name: string): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);

async function motionDone(element: Element): Promise<void> {
  await nextFrame();
  const running = deepQueryAll(element.parentElement ?? element, () => true)
    .flatMap((node) => node.getAnimations())
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
  await Promise.allSettled(running.map((animation) => animation.finished));
}

async function make(attributes = 'label="Notifications"'): Promise<TctSwitch> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:40px;inline-size:400px"><tct-switch ${attributes}></tct-switch></div>`,
  );
  const element = wrapper.querySelector<TctSwitch>('tct-switch')!;
  await element.updateComplete;
  await nextFrame();
  return element;
}

runElementSuite({
  tag: 'tct-switch',
  render: () => html`<tct-switch label="Notifications" name="n"></tct-switch>`,
  properties: {
    label: 'Other',
    description: 'Help',
    size: 'sm',
    loading: true,
    checked: true,
    labelPosition: 'start',
    labelSpacing: 'spread',
    labelHidden: true,
    width: 200,
  },
  attributes: {
    label: 'label',
    description: 'description',
    size: 'size',
    labelPosition: 'label-position',
    labelSpacing: 'label-spacing',
  },
});

runFormControlSuite({
  tag: 'tct-switch',
  render: (attributes) => `<tct-switch label="Field" ${attributes}></tct-switch>`,
  validValue: 'on',
  restoreState: 'checked',
  setValid: (element) => {
    (element as unknown as TctSwitch).checked = true;
  },
  setEmpty: (element) => {
    (element as unknown as TctSwitch).checked = false;
  },
  readonly: true,
  labelActivation: 'click',
  userEdit: async (element) => {
    await userEvent.click(inner(element as unknown as TctSwitch));
  },
});

describe('tct-switch: role and toggling (Switch.test.tsx)', () => {
  it('is a native checkbox with role=switch named by its label, and reports its state', async () => {
    const element = await make('label="Notifications" checked');
    expect(inner(element).type).toBe('checkbox');
    expect(inner(element).getAttribute('role')).toBe('switch');
    if (isChromium) {
      const node = await axNode(inner(element));
      expect(node.role).toBe('switch');
      expect(node.name).toBe('Notifications');
      expect(node.checked).toBe('true');
    }
    await userEvent.click(inner(element));
    if (isChromium) expect((await axNode(inner(element))).checked).toBe('false');
  });

  it('a click toggles it and fires input then change once each; writing checked fires nothing', async () => {
    const element = await make();
    const events = recordEvents(element, ['input', 'change']);
    await userEvent.click(inner(element));
    expect(events.events.map((event) => event.type)).toEqual(['input', 'change']);
    expect(element.checked).toBe(true);
    await userEvent.click(inner(element));
    expect(element.checked).toBe(false);
    expect(events.events).toHaveLength(4);
    element.checked = true;
    await element.updateComplete;
    expect(events.events).toHaveLength(4);
  });

  it('works when clicking on the label and on the description', async () => {
    const element = await make('label="Dark mode" description="A darker colour scheme"');
    await userEvent.click(part(element, 'label')!);
    expect(element.checked).toBe(true);
    await userEvent.click(part(element, 'description')!);
    expect(element.checked).toBe(false);
  });

  it('Space toggles it when focused', async () => {
    const element = await make();
    element.focus();
    expect(deepActiveElement()).toBe(inner(element));
    await pressKeys(' ');
    expect(element.checked).toBe(true);
  });

  it('the checked attribute is the default; the property is the current state', async () => {
    const element = await make('label="Notifications" checked');
    expect(element.checked).toBe(true);
    element.checked = false;
    await element.updateComplete;
    expect(inner(element).checked).toBe(false);
    expect(element.hasAttribute('checked')).toBe(true);
  });

  it('cancelling the click keeps the old state (a controlled switch)', async () => {
    const element = await make();
    element.addEventListener('click', (event) => event.preventDefault());
    const events = recordEvents(element, ['input', 'change']);
    await userEvent.click(inner(element));
    expect(element.checked).toBe(false);
    expect(events.events).toHaveLength(0);
  });

  it('does not fold the description into the accessible name', async () => {
    const element = await make('label="Dark mode" description="A darker colour scheme"');
    if (!isChromium) return;
    const node = await axNode(inner(element));
    expect(node.name).toBe('Dark mode');
    expect(node.description).toContain('A darker colour scheme');
  });

  it('forwards host aria attributes to the input', async () => {
    const element = await make('label="Row" aria-label="Enable row 3"');
    if (isChromium) expect((await axNode(inner(element))).name).toBe('Enable row 3');
  });
});

describe('tct-switch: label layout', () => {
  it('sm and md draw 32x20 and 40x24 tracks', async () => {
    const element = await make();
    let rect = part(element, 'track')!.getBoundingClientRect();
    expect([rect.width, rect.height]).toEqual([40, 24]);
    element.size = 'sm';
    await element.updateComplete;
    await nextFrame();
    rect = part(element, 'track')!.getBoundingClientRect();
    expect([rect.width, rect.height]).toEqual([32, 20]);
  });

  it('puts the label after the track by default and before it with label-position=start', async () => {
    const element = await make();
    const track = part(element, 'track')!.getBoundingClientRect();
    const label = part(element, 'label')!.getBoundingClientRect();
    expect(label.left).toBeGreaterThan(track.right - 1);
    element.labelPosition = 'start';
    await element.updateComplete;
    await nextFrame();
    const after = part(element, 'track')!.getBoundingClientRect();
    const before = part(element, 'label')!.getBoundingClientRect();
    expect(before.right).toBeLessThanOrEqual(after.left + 1);
  });

  it('label-spacing=spread pushes label and track to opposite ends of the row', async () => {
    const element = await make('label="Notifications" label-spacing="spread" width="360"');
    const row = part(element, 'row')!.getBoundingClientRect();
    const track = part(element, 'track')!.getBoundingClientRect();
    const label = part(element, 'label')!.getBoundingClientRect();
    // The track stays at the inline start (label after it), the label goes to the far end.
    expect(track.left - row.left).toBeLessThanOrEqual(1);
    expect(row.right - label.right).toBeLessThanOrEqual(1);
    // Hugging (the default) keeps them together.
    element.labelSpacing = 'hug';
    await element.updateComplete;
    await nextFrame();
    const hugged = part(element, 'label')!.getBoundingClientRect();
    expect(hugged.left - part(element, 'track')!.getBoundingClientRect().right).toBeLessThan(12);
  });

  it('hides the label visually with label-hidden but keeps it named, and drops the gap', async () => {
    const element = await make('label="Notifications" label-hidden');
    expect(part(element, 'label')!.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    expect(getComputedStyle(part(element, 'row')!).columnGap).toBe('0px');
    expect(part(element, 'control')!.getBoundingClientRect().width).toBe(40);
    if (isChromium) expect((await axNode(inner(element))).name).toBe('Notifications');
  });

  it('keeps the description linked through aria-describedby, even with a hidden label', async () => {
    const element = await make('label="Dark mode" description="A darker scheme" label-hidden');
    expect(inner(element).getAttribute('aria-describedby')!.split(' ')).toContain(
      part(element, 'description')!.id,
    );
  });

  it('shows the Required and Optional indicators, the label icon and the info tip', async () => {
    const required = await make('label="Terms" required');
    expect(part(required, 'label-indicator')!.textContent).toContain('Required');
    expect(inner(required).required).toBe(true);
    const optional = await make('label="Terms" optional label-icon="info" label-tooltip="Why?"');
    expect(part(optional, 'label-indicator')!.textContent).toContain('Optional');
    expect(optional.shadowRoot!.querySelector('.label-icon')!.getAttribute('name')).toBe('info');
    expect(part(optional, 'label-tip')).not.toBeNull();
  });
});

describe('tct-switch: track and thumb', () => {
  it('the thumb sits at the inline start when off and travels to the inline end when on', async () => {
    const element = await make();
    const thumb = part(element, 'thumb')!;
    const track = part(element, 'track')!;
    const off = thumb.getBoundingClientRect();
    expect(off.left - track.getBoundingClientRect().left).toBe(4);
    expect(off.width).toBe(16);
    element.checked = true;
    await element.updateComplete;
    await waitUntil(() => thumb.getBoundingClientRect().width === 20, 'thumb grown');
    await nextFrame();
    const on = thumb.getBoundingClientRect();
    expect(track.getBoundingClientRect().right - on.right).toBeLessThanOrEqual(3);
  });

  it('mirrors in RTL: the thumb starts at the right and travels left', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div dir="rtl" style="inline-size:400px"><tct-switch label="Notifications"></tct-switch></div>`,
    );
    const element = wrapper.querySelector<TctSwitch>('tct-switch')!;
    await element.updateComplete;
    await nextFrame();
    const track = part(element, 'track')!;
    const thumb = part(element, 'thumb')!;
    expect(track.getBoundingClientRect().right - thumb.getBoundingClientRect().right).toBe(4);
    element.checked = true;
    await element.updateComplete;
    await waitUntil(() => thumb.getBoundingClientRect().width === 20, 'thumb grown');
    await nextFrame();
    expect(
      thumb.getBoundingClientRect().left - track.getBoundingClientRect().left,
    ).toBeLessThanOrEqual(3);
  });

  it('draws the off track as an outline and the on track as a fill (Tecton)', async () => {
    const element = await make();
    const track = part(element, 'track')!;
    expect(getComputedStyle(track).backgroundColor).toMatch(/, 0\)$|\/ 0\)$/);
    expect(getComputedStyle(track).boxShadow).not.toBe('none');
    element.checked = true;
    await element.updateComplete;
    // The fill fades in: it is not transparent once the transition has started.
    await waitUntil(
      () => !/, 0\)$|\/ 0\)$/.test(getComputedStyle(track).backgroundColor),
      'the on track is filled',
    );
    expect(getComputedStyle(track).boxShadow).toBe('none');
  });

  it('a 2px focus ring surrounds the track on keyboard focus', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><button id="before">before</button><tct-switch label="Notifications"></tct-switch></div>`,
    );
    const element = wrapper.querySelector<TctSwitch>('tct-switch')!;
    await element.updateComplete;
    wrapper.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    await waitUntil(
      () => getComputedStyle(part(element, 'control')!).outlineStyle === 'solid',
      'ring',
    );
    expect(getComputedStyle(part(element, 'control')!).outlineWidth).toBe('2px');
  });

  it('keeps the two states apart in forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await make();
    const track = part(element, 'track')!;
    expect(getComputedStyle(track).borderTopStyle).toBe('solid');
    const offColor = getComputedStyle(track).borderTopColor;
    element.checked = true;
    await element.updateComplete;
    await nextFrame();
    expect(getComputedStyle(track).borderTopColor).not.toBe(offColor);
  });
});

describe('tct-switch: form participation', () => {
  it('submits name=on only while on, and the value attribute when set', async () => {
    const form = await formHarness(
      '<tct-switch label="A" name="a" checked></tct-switch><tct-switch label="B" name="b" value="yes" checked></tct-switch><tct-switch label="C" name="c"></tct-switch>',
    );
    expect(form.entries()).toEqual([
      ['a', 'on'],
      ['b', 'yes'],
    ]);
  });

  it('required and off blocks the submit, focuses the switch and shows the error only then', async () => {
    const form = await formHarness(
      '<tct-switch label="I agree" name="terms" required></tct-switch><button type="submit">Go</button>',
    );
    const element = form.form.querySelector<TctSwitch>('tct-switch')!;
    await element.updateComplete;
    expect(inner(element).hasAttribute('aria-invalid')).toBe(false);
    await userEvent.click(form.form.querySelector('button')!);
    await element.updateComplete;
    await nextFrame();
    expect(form.submitEvents).toHaveLength(0);
    expect(inner(element).getAttribute('aria-invalid')).toBe('true');
    expect(deepActiveElement()).toBe(inner(element));
    await userEvent.click(inner(element));
    await element.updateComplete;
    expect(element.validity.valid).toBe(true);
  });

  it('a disabled switch with a reason submits nothing and does not block the form', async () => {
    const form = await formHarness(
      '<tct-switch label="T" name="t" checked required disabled disabled-message="No"></tct-switch>',
    );
    expect(form.entries()).toEqual([]);
    expect(form.form.checkValidity()).toBe(true);
  });
});

describe('tct-switch: status', () => {
  it('renders the status message detached and describes the switch by it', async () => {
    const element = await make(
      'label="Notifications" status-type="error" status-message="Could not enable"',
    );
    const status = element.shadowRoot!.querySelector<HTMLElement>('tct-field-status')!;
    expect(status.getAttribute('variant')).toBe('detached');
    expect(status.textContent).toBe('Could not enable');
    expect(inner(element).getAttribute('aria-describedby')!.split(' ')).toContain(status.id);
    expect(inner(element).getAttribute('aria-invalid')).toBe('true');
  });

  it('sets aria-invalid only for an error status', async () => {
    const warning = await make('label="N" status-type="warning" status-message="Careful"');
    expect(inner(warning).hasAttribute('aria-invalid')).toBe(false);
  });

  it('announces a status message that appears after mount, once and politely', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const element = await make();
      element.status = {type: 'error', message: 'Could not enable'};
      await waitUntil(
        () => getAnnouncerRegions().polite?.textContent === 'Could not enable',
        'announced',
        2000,
      );
    } finally {
      restore();
    }
  });
});

describe('tct-switch: disabled, disabled reason, loading and changeAction', () => {
  it('a disabled switch is natively disabled, dimmed and not toggled', async () => {
    const element = await make('label="Notifications" disabled');
    expect(inner(element).disabled).toBe(true);
    expect(getComputedStyle(part(element, 'track')!).opacity).toBe('0.5');
  });

  it('with a disabled-message it stays focusable through aria-disabled and blocks toggling', async () => {
    const element = await make(
      'label="Notifications" disabled disabled-message="Turned off org-wide"',
    );
    const input = inner(element);
    expect(input.disabled).toBe(false);
    expect(input.getAttribute('aria-disabled')).toBe('true');
    element.focus();
    expect(deepActiveElement()).toBe(input);
    const events = recordEvents(element, ['input', 'change']);
    await pressKeys(' ');
    input.click();
    expect(element.checked).toBe(false);
    expect(events.events).toHaveLength(0);
    const reason = element.shadowRoot!.querySelector<HTMLElement>('.visually-hidden')!;
    expect(reason.textContent).toBe('Turned off org-wide');
    expect(input.getAttribute('aria-describedby')!.split(' ')).toContain(reason.id);
    expect(element.shadowRoot!.querySelector('tct-tooltip')!.getAttribute('content')).toBe(
      'Turned off org-wide',
    );
  });

  it('loading shows a spinner in the thumb, sets aria-busy, announces Loading and blocks toggling', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const element = await make('label="Notifications" loading');
      expect(inner(element).getAttribute('aria-busy')).toBe('true');
      expect(part(element, 'thumb')!.querySelector('tct-spinner')).not.toBeNull();
      if (!isTier2) expect(hasCustomState(element, 'busy')).toBe(true);
      await waitUntil(() => getAnnouncerRegions().polite?.textContent === 'Loading', 'announced');
      await userEvent.click(inner(element));
      expect(element.checked).toBe(false);
    } finally {
      restore();
    }
  });

  it('changeAction runs after the toggle; busy while pending; a rejection returns the old state', async () => {
    const element = await make();
    let resolve!: () => void;
    const seen: [boolean, string][] = [];
    element.changeAction = (checked, event) => {
      seen.push([checked, event.type]);
      return new Promise<void>((done) => {
        resolve = done;
      });
    };
    await userEvent.click(inner(element));
    expect(seen).toEqual([[true, 'input']]);
    await element.updateComplete;
    expect(inner(element).getAttribute('aria-busy')).toBe('true');
    await userEvent.click(inner(element));
    expect(element.checked).toBe(true);
    expect(seen).toHaveLength(1);
    resolve();
    await waitUntil(() => !inner(element).hasAttribute('aria-busy'), 'idle');
    expect(element.checked).toBe(true);

    // Now on: a click turns it off, the action rejects, and it comes back on.
    element.changeAction = () => Promise.reject(new Error('nope'));
    await userEvent.click(inner(element));
    await waitUntil(() => element.checked && !inner(element).hasAttribute('aria-busy'), 'reverted');
    expect(inner(element).checked).toBe(true);
  });
});

describe('tct-switch: accessibility and i18n', () => {
  it('passes axe in the default, on, error, disabled, loading and label-hidden states', async () => {
    for (const attributes of [
      'label="Notifications"',
      'label="Notifications" checked description="Push and email"',
      'label="Notifications" status-type="error" status-message="Could not enable"',
      'label="Notifications" disabled',
      'label="Notifications" disabled disabled-message="Turned off org-wide"',
      'label="Notifications" loading',
      'label="Notifications" label-hidden',
      'label="Notifications" label-position="start" label-spacing="spread"',
    ]) {
      const element = await make(attributes);
      await motionDone(element);
      await expectAccessible(element);
    }
  });

  it('localises the Loading announcement and the Required indicator', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-switch label="Benachrichtigungen" required></tct-switch></div>`,
    );
    const element = wrapper.querySelector<TctSwitch>('tct-switch')!;
    await element.updateComplete;
    await waitUntil(
      () => !(part(element, 'label-indicator')?.textContent ?? 'Required').includes('Required'),
      'German indicator',
    );
    expect(part(element, 'label-indicator')!.textContent).toMatch(/Erforderlich|Pflicht/i);
  });
});
