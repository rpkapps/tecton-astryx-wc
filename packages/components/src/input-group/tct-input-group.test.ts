/**
 * tct-input-group and tct-input-group-text: the element suite, then the group contract (role and name,
 * size for the controls inside, one focus ring around addons, shared borders, status, disabled, invalid
 * mirroring, RTL, forced colours). Ported from upstream InputGroup.test.tsx where the behaviour applies.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {deepQueryAll, fixture} from '@tecton-astryx/testing/fixture.js';
import {pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium, isTier2} from '@tecton-astryx/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import '../text-input/define.js';
import './define.js';
import type {TctInputGroup} from './tct-input-group.js';
import type {TctInputGroupText} from './tct-input-group-text.js';
import type {TctTextInput} from '../text-input/tct-text-input.js';

const groupPart = (group: TctInputGroup): HTMLElement =>
  group.shadowRoot!.querySelector<HTMLElement>('[part="group"]')!;
const boxOf = (input: TctTextInput): HTMLElement =>
  input.shadowRoot!.querySelector<HTMLElement>('[part="input"]')!;
const cellOf = (text: TctInputGroupText): HTMLElement =>
  text.shadowRoot!.querySelector<HTMLElement>('[part="text"]')!;

/** Waits for every running animation (a message fading in) so axe measures settled colours. */
async function motionDone(root: Element): Promise<void> {
  await nextFrame();
  const running = deepQueryAll(root.parentElement ?? root, () => true).flatMap((element) =>
    element.getAnimations(),
  );
  await Promise.allSettled(running.map((animation) => animation.finished));
}

async function make(attributes = 'label="Price"', body?: string): Promise<TctInputGroup> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:24px;inline-size:420px"><tct-input-group ${attributes}>${
      body ??
      `<tct-input-group-text>$</tct-input-group-text>
       <tct-text-input label="Amount" label-hidden name="amount"></tct-text-input>
       <tct-input-group-text>USD</tct-input-group-text>`
    }</tct-input-group></div>`,
  );
  const group = wrapper.querySelector<TctInputGroup>('tct-input-group')!;
  await group.updateComplete;
  await nextFrame();
  return group;
}

runElementSuite({
  tag: 'tct-input-group',
  render: () =>
    html`<tct-input-group label="Price"
      ><tct-input-group-text>$</tct-input-group-text
      ><tct-text-input label="Amount" label-hidden></tct-text-input
    ></tct-input-group>`,
  properties: {
    label: 'Other',
    description: 'Help',
    size: 'lg',
    disabled: true,
    labelTooltip: 'More',
    statusType: 'warning',
  },
  attributes: {label: 'label', description: 'description', size: 'size'},
});

runElementSuite({
  tag: 'tct-input-group-text',
  render: () => html`<tct-input-group-text>$</tct-input-group-text>`,
});

describe('tct-input-group: semantics (InputGroup.test.tsx)', () => {
  it('is a group named by its label, with the description and status as its description', async () => {
    const group = await make(
      'label="Price" description="In US dollars" status-type="error" status-message="Too high"',
    );
    const role = groupPart(group);
    expect(role.getAttribute('role')).toBe('group');
    expect(role.getAttribute('aria-labelledby')).toBeTruthy();
    expect(role.getAttribute('aria-describedby')!.split(' ')).toHaveLength(2);
    if (isChromium) {
      const node = await axNode(role);
      expect(node.role).toBe('group');
      expect(node.name).toBe('Price');
      expect(node.description).toContain('In US dollars');
      expect(node.description).toContain('Too high');
    }
  });

  it('renders the label once and hides it visually with label-hidden, keeping it for assistive technology', async () => {
    const group = await make('label="Price" label-hidden');
    const label = group.shadowRoot!.querySelector<HTMLElement>('[part="label"]')!;
    expect(label.textContent).toContain('Price');
    expect(label.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    if (isChromium) expect((await axNode(groupPart(group))).name).toBe('Price');
  });

  it('shows the Required and Optional indicators and the label info tip', async () => {
    const required = await make('label="Price" required');
    expect(required.shadowRoot!.querySelector('[part="label-indicator"]')!.textContent).toContain(
      'Required',
    );
    const optional = await make('label="Price" optional label-tooltip="In dollars"');
    expect(optional.shadowRoot!.querySelector('[part="label-indicator"]')!.textContent).toContain(
      'Optional',
    );
    expect(optional.shadowRoot!.querySelector('[part="label-tip"]')).not.toBeNull();
  });

  it('shows the status message under the group as a detached message with an icon', async () => {
    const group = await make(
      'label="Price" status-type="warning" status-message="Check the amount"',
    );
    const status = group.shadowRoot!.querySelector('tct-field-status')!;
    expect(status.getAttribute('variant')).toBe('detached');
    expect(status.getAttribute('type')).toBe('warning');
    expect(status.textContent).toContain('Check the amount');
    group.status = {type: 'success', message: 'Fine'};
    await group.updateComplete;
    expect(group.statusType).toBe('success');
    expect(group.shadowRoot!.querySelector('tct-field-status')!.textContent).toContain('Fine');
  });

  it('passes axe with addons, a description and a status', async () => {
    const group = await make(
      'label="Price" description="In US dollars" status-type="error" status-message="Too high"',
    );
    await motionDone(group);
    await expectAccessible(group);
  });
});

describe('tct-input-group: size (SizeProvider)', () => {
  it('sets the group height and gives its size to the controls inside unless they choose their own', async () => {
    const group = await make('label="Price" size="lg"');
    expect(groupPart(group).getBoundingClientRect().height).toBe(36);
    const input = group.querySelector<TctTextInput>('tct-text-input')!;
    expect(boxOf(input).getBoundingClientRect().height).toBe(36);
    group.size = 'sm';
    await group.updateComplete;
    await nextFrame();
    expect(groupPart(group).getBoundingClientRect().height).toBe(28);
    expect(boxOf(input).getBoundingClientRect().height).toBe(28);
  });

  it('is md by default', async () => {
    const group = await make();
    expect(groupPart(group).getBoundingClientRect().height).toBe(32);
  });

  it('a control with its own size keeps it', async () => {
    const group = await make(
      'label="Price" size="lg"',
      '<tct-text-input label="Amount" label-hidden size="sm"></tct-text-input>',
    );
    const input = group.querySelector<TctTextInput>('tct-text-input')!;
    expect(boxOf(input).getBoundingClientRect().height).toBe(28);
  });
});

describe('tct-input-group: one connected box and one focus ring', () => {
  it('joins the members: borders overlap by one border width and only the outer corners are round', async () => {
    const group = await make();
    const [prefix, suffix] = [...group.querySelectorAll<TctInputGroupText>('tct-input-group-text')];
    const input = group.querySelector<TctTextInput>('tct-text-input')!;
    const prefixCell = cellOf(prefix!);
    const suffixCell = cellOf(suffix!);
    const box = boxOf(input);

    expect(getComputedStyle(prefixCell).borderStartStartRadius).toBe('4px');
    expect(getComputedStyle(prefixCell).borderStartEndRadius).toBe('0px');
    expect(getComputedStyle(suffixCell).borderStartEndRadius).toBe('4px');
    expect(getComputedStyle(suffixCell).borderStartStartRadius).toBe('0px');
    // The input is a middle member: no round corner at all.
    for (const corner of ['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'] as const) {
      expect(getComputedStyle(box)[`border${corner}Radius`], corner).toBe('0px');
    }
    // Overlap by exactly one border width.
    const a = prefixCell.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    expect(a.right - b.left).toBe(1);
    // Same height.
    expect(a.height).toBe(b.height);
  });

  it('an input first or last in the group rounds its outer corners', async () => {
    const group = await make(
      'label="Price"',
      '<tct-input-group-text>https://</tct-input-group-text><tct-text-input label="Host" label-hidden></tct-text-input>',
    );
    const box = boxOf(group.querySelector<TctTextInput>('tct-text-input')!);
    expect(getComputedStyle(box).borderStartEndRadius).toBe('4px');
    expect(getComputedStyle(box).borderStartStartRadius).toBe('0px');
  });

  it('draws exactly one focus ring, on the group, when the input is focused with the keyboard', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><button id="before">before</button><tct-input-group label="Price">
        <tct-input-group-text>$</tct-input-group-text>
        <tct-text-input label="Amount" label-hidden></tct-text-input>
      </tct-input-group></div>`,
    );
    const group = wrapper.querySelector<TctInputGroup>('tct-input-group')!;
    const input = group.querySelector<TctTextInput>('tct-text-input')!;
    await group.updateComplete;
    wrapper.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    await waitUntil(() => groupPart(group).hasAttribute('data-focus-visible'), 'group ring');
    const ring = getComputedStyle(groupPart(group));
    expect(ring.outlineStyle).toBe('solid');
    expect(ring.outlineWidth).toBe('2px');
    // The member's own ring is gone: one ring, not two.
    expect(getComputedStyle(boxOf(input)).outlineStyle).toBe('none');
    // The addon lies inside the ring: the ring encloses the whole group.
    const groupBox = groupPart(group).getBoundingClientRect();
    const prefix = group.querySelector<TctInputGroupText>('tct-input-group-text')!;
    expect(prefix.getBoundingClientRect().left).toBeGreaterThanOrEqual(groupBox.left);

    (document.activeElement as HTMLElement | null)?.blur();
    input.blur();
    await waitUntil(() => !groupPart(group).hasAttribute('data-focus-visible'), 'ring removed');
    expect(getComputedStyle(groupPart(group)).outlineStyle).toBe('none');
  });

  it('a pointer click into the input draws the ring too (a text field is always focus-visible)', async () => {
    const group = await make();
    const input = group.querySelector<TctTextInput>('tct-text-input')!;
    await userEvent.click(input);
    await waitUntil(() => groupPart(group).hasAttribute('data-focus-visible'), 'group ring');
    expect(getComputedStyle(boxOf(input)).outlineStyle).toBe('none');
  });

  it('a lone control outside a group keeps its own ring', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><tct-text-input label="Alone"></tct-text-input></div>',
    );
    const input = wrapper.querySelector<TctTextInput>('tct-text-input')!;
    await userEvent.click(input);
    await nextFrame();
    expect(getComputedStyle(boxOf(input)).outlineStyle).toBe('solid');
  });
});

describe('tct-input-group: status, disabled and invalidity', () => {
  it('colours the addon borders with the status', async () => {
    const group = await make('label="Price" status-type="error"');
    const cell = cellOf(group.querySelector<TctInputGroupText>('tct-input-group-text')!);
    const probe = document.createElement('div');
    probe.style.color = 'var(--tecton-color-status-error-outline-border-strong)';
    document.body.append(probe);
    expect(getComputedStyle(cell).borderTopColor).toBe(getComputedStyle(probe).color);
    probe.remove();
  });

  it('mirrors a control that displays invalidity onto the group (observers)', async () => {
    const group = await make(
      'label="Price"',
      '<tct-input-group-text>$</tct-input-group-text><tct-text-input label="Amount" label-hidden required></tct-text-input>',
    );
    const input = group.querySelector<TctTextInput>('tct-text-input')!;
    await input.updateComplete;
    expect(groupPart(group).hasAttribute('data-status')).toBe(false);
    input.reportValidity();
    await waitUntil(
      () => groupPart(group).getAttribute('data-status') === 'error',
      'invalid mirrored',
    );
    if (!isTier2) expect(group.matches(':state(invalid)')).toBe(true);
    input.value = 'ok';
    input.checkValidity();
    await input.updateComplete;
    await waitUntil(() => !groupPart(group).hasAttribute('data-status'), 'invalid cleared');
  });

  it('disabled dims the group and its label but leaves the controls to their own disabled', async () => {
    const group = await make('label="Price" disabled');
    expect(groupPart(group).getAttribute('aria-disabled')).toBe('true');
    expect(getComputedStyle(groupPart(group)).opacity).toBe('0.5');
    const input = group.querySelector<TctTextInput>('tct-text-input')!;
    expect(input.disabled).toBe(false);
    if (!isTier2) expect(group.matches(':state(disabled)')).toBe(true);
  });
});

describe('tct-input-group: layout and locale', () => {
  it('mirrors the corners in RTL', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div dir="rtl" style="padding:24px;inline-size:420px"><tct-input-group label="Price">
        <tct-input-group-text>$</tct-input-group-text>
        <tct-text-input label="Amount" label-hidden></tct-text-input>
      </tct-input-group></div>`,
    );
    const group = wrapper.querySelector<TctInputGroup>('tct-input-group')!;
    await group.updateComplete;
    await nextFrame();
    const cell = cellOf(group.querySelector<TctInputGroupText>('tct-input-group-text')!);
    // The prefix is the inline-start member, on the right in RTL.
    const rect = cell.getBoundingClientRect();
    const groupRect = groupPart(group).getBoundingClientRect();
    expect(groupRect.right - rect.right).toBeLessThanOrEqual(1);
    expect(getComputedStyle(cell).borderTopRightRadius).toBe('4px');
    expect(getComputedStyle(cell).borderTopLeftRadius).toBe('0px');
  });

  it('localises the Required indicator', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-input-group label="Preis" required>
        <tct-text-input label="Betrag" label-hidden></tct-text-input>
      </tct-input-group></div>`,
    );
    const group = wrapper.querySelector<TctInputGroup>('tct-input-group')!;
    await group.updateComplete;
    await waitUntil(
      () =>
        !(
          group.shadowRoot!.querySelector('[part="label-indicator"]')?.textContent ?? 'Required'
        ).includes('Required'),
      'German indicator',
    );
    expect(group.shadowRoot!.querySelector('[part="label-indicator"]')!.textContent).toMatch(
      /Erforderlich|Pflicht/i,
    );
  });

  it('keeps the borders visible in forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const group = await make();
    const cell = cellOf(group.querySelector<TctInputGroupText>('tct-input-group-text')!);
    expect(getComputedStyle(cell).borderTopWidth).toBe('1px');
    expect(getComputedStyle(cell).borderTopStyle).toBe('solid');
  });
});
