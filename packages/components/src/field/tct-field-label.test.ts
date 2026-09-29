/**
 * tct-field-label and tct-input-clear-button used on their own (inside tct-field and tct-text-input they
 * are covered by those suites): the label renders text, icon, indicator, tip and description, and forwards
 * clicks to the control it names; the clear button is named, keeps focus where it is, and shows a tooltip.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import './define.js';
import type {TctFieldLabel} from './tct-field-label.js';
import type {TctInputClearButton} from './tct-input-clear-button.js';

runElementSuite({
  tag: 'tct-field-label',
  render: () => html`<tct-field-label label="Email"></tct-field-label>`,
  properties: {label: 'Name', description: 'Help', required: true, optional: true, disabled: true},
  attributes: {label: 'label', description: 'description'},
});

runElementSuite({
  tag: 'tct-input-clear-button',
  render: () => html`<tct-input-clear-button label="Clear Email"></tct-input-clear-button>`,
  properties: {label: 'Clear Name'},
  attributes: {label: 'label'},
});

async function label(markup: string, control = '<input id="c">'): Promise<TctFieldLabel> {
  const wrapper = await fixture<HTMLElement>(`<div>${markup}${control}</div>`);
  const element = wrapper.querySelector<TctFieldLabel>('tct-field-label')!;
  await element.updateComplete;
  await nextFrame();
  return element;
}

const part = (element: Element, name: string): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`);

describe('tct-field-label', () => {
  it('shows the label attribute, or the slotted text instead of it', async () => {
    const attribute = await label('<tct-field-label label="Email"></tct-field-label>');
    expect(part(attribute, 'label')!.textContent).toContain('Email');
    const slotted = await label(
      '<tct-field-label label="Ignored">Rich <em>text</em></tct-field-label>',
    );
    expect(slotted.textContent).toContain('Rich');
    expect(slotted.shadowRoot!.querySelector('slot')!.assignedNodes().length).toBeGreaterThan(0);
  });

  it('draws the Required / Optional indicator, and an owner’s indicator text replaces it', async () => {
    const required = await label('<tct-field-label label="Name" required></tct-field-label>');
    expect(part(required, 'label-indicator')!.textContent).toContain('Required');
    const optional = await label('<tct-field-label label="Name" optional></tct-field-label>');
    expect(part(optional, 'label-indicator')!.textContent).toContain('Optional');
    const plain = await label('<tct-field-label label="Name"></tct-field-label>');
    expect(part(plain, 'label-indicator')).toBeNull();
    const custom = await label('<tct-field-label label="Name" indicator="Beta"></tct-field-label>');
    expect(part(custom, 'label-indicator')!.textContent).toContain('Beta');
  });

  it('renders a leading icon, a description, and an info tip that is a named button', async () => {
    const element = await label(
      '<tct-field-label label="Key" label-icon="info" description="Where to find it" label-tooltip="Found in settings"></tct-field-label>',
    );
    expect(part(element, 'label')!.querySelector('tct-icon')).not.toBeNull();
    expect(part(element, 'description')!.textContent).toBe('Where to find it');
    const tip = part(element, 'label-tip')!;
    expect(tip.localName).toBe('button');
    expect(tip.getAttribute('aria-label')).toBe('More information');
    const tooltip = element.shadowRoot!.querySelector('tct-tooltip')!;
    expect(tooltip.getAttribute('content')).toBe('Found in settings');
  });

  it('label-hidden keeps the text for assistive technology and drops the tip', async () => {
    const element = await label(
      '<tct-field-label label="Search" label-hidden label-tooltip="x"></tct-field-label>',
    );
    expect(part(element, 'label-tip')).toBeNull();
    const box = element.shadowRoot!.querySelector<HTMLElement>('.label-group')!;
    const rect = box.getBoundingClientRect();
    expect(rect.width).toBeLessThanOrEqual(1);
    expect(rect.height).toBeLessThanOrEqual(1);
  });

  it('a click on the label or on the description focuses the control named by input-id', async () => {
    const element = await label(
      '<tct-field-label label="Email" description="Work address" input-id="c"></tct-field-label>',
    );
    await userEvent.click(part(element, 'label')!);
    expect(deepActiveElement()!.id).toBe('c');
    (deepActiveElement() as HTMLElement).blur();
    await userEvent.click(part(element, 'description')!);
    expect(deepActiveElement()!.id).toBe('c');
  });

  it('a disabled label does not forward clicks, and a group label never does', async () => {
    const disabled = await label(
      '<tct-field-label label="Email" input-id="c" disabled></tct-field-label>',
    );
    await userEvent.click(part(disabled, 'label')!);
    expect(deepActiveElement()!.id).not.toBe('c');
    const group = await label(
      '<tct-field-label label="Email" input-id="c" group-label></tct-field-label>',
    );
    await userEvent.click(part(group, 'label')!);
    expect(deepActiveElement()!.id).not.toBe('c');
  });

  it('passes axe with indicator, icon, tip and description', async () => {
    const element = await label(
      '<tct-field-label label="Key" required label-icon="info" description="Help" label-tooltip="Tip" input-id="c"></tct-field-label>',
    );
    await expectAccessible(element);
  });
});

describe('tct-input-clear-button', () => {
  async function clearButton(): Promise<TctInputClearButton> {
    const wrapper = await fixture<HTMLElement>(
      `<div><input id="i" value="abc"><tct-input-clear-button label="Clear Email"></tct-input-clear-button></div>`,
    );
    const element = wrapper.querySelector<TctInputClearButton>('tct-input-clear-button')!;
    await element.updateComplete;
    await nextFrame();
    return element;
  }
  const nativeOf = (element: TctInputClearButton): HTMLButtonElement =>
    element.shadowRoot!.querySelector<HTMLButtonElement>('button')!;

  it('is a button named by its label, with a close glyph', async () => {
    const element = await clearButton();
    expect(nativeOf(element).getAttribute('aria-label')).toBe('Clear Email');
    expect(nativeOf(element).querySelector('tct-icon')!.getAttribute('name')).toBe('close');
    if (isChromium)
      expect(await axNode(nativeOf(element))).toMatchObject({role: 'button', name: 'Clear Email'});
  });

  it('a pointer press does not take focus away from the input', async () => {
    const element = await clearButton();
    const input = element.parentElement!.querySelector('input')!;
    input.focus();
    const down = new MouseEvent('mousedown', {bubbles: true, cancelable: true, composed: true});
    nativeOf(element).dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(deepActiveElement()).toBe(input);
  });

  it('click is the native click, once per activation, and the tooltip shows the label on keyboard focus', async () => {
    const element = await clearButton();
    let clicks = 0;
    element.addEventListener('click', () => clicks++);
    nativeOf(element).focus();
    await userEvent.keyboard('{Enter}');
    expect(clicks).toBe(1);
    const tooltip = element.shadowRoot!.querySelector('tct-tooltip')!;
    expect(tooltip.getAttribute('content')).toBe('Clear Email');
    element.parentElement!.querySelector('input')!.focus();
    await userEvent.keyboard('{Tab}');
    await waitUntil(() => tooltip.isOpen, 'tooltip open on keyboard focus');
  });

  it('passes axe', async () => {
    await expectAccessible(await clearButton());
  });
});
