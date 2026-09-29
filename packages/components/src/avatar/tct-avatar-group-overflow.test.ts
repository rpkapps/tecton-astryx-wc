import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {TctAvatarGroupOverflow} from './tct-avatar-group-overflow.js';

const baseOf = (overflow: TctAvatarGroupOverflow): HTMLElement =>
  overflow.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;

runElementSuite({
  tag: 'tct-avatar-group-overflow',
  render: () => `<tct-avatar-group-overflow count="3"></tct-avatar-group-overflow>`,
  properties: {count: 7, interactive: true},
  attributes: {count: 'count'},
});

describe('tct-avatar-group-overflow (AvatarGroupOverflow.test.tsx)', () => {
  it('shows +N and is named "N more" (role img when static)', async () => {
    const overflow = await fixture<TctAvatarGroupOverflow>(
      html`<tct-avatar-group-overflow count="5"></tct-avatar-group-overflow>`,
    );
    expect(baseOf(overflow).textContent.trim()).toBe('+5');
    expect(baseOf(overflow).getAttribute('aria-label')).toBe('5 more');
    if (isChromium) {
      const node = await axNode(baseOf(overflow));
      expect(node.role).toBe('image');
      expect(node.name).toBe('5 more');
    }
  });

  it('clamps a negative count to 0 instead of rendering "+-3"', async () => {
    const overflow = await fixture<TctAvatarGroupOverflow>(
      html`<tct-avatar-group-overflow count="-3"></tct-avatar-group-overflow>`,
    );
    expect(baseOf(overflow).textContent.trim()).toBe('+0');
    expect(baseOf(overflow).getAttribute('aria-label')).toBe('0 more');
  });

  it('renders custom content instead of +N; the name stays the count phrase', async () => {
    const overflow = await fixture<TctAvatarGroupOverflow>(
      html`<tct-avatar-group-overflow count="4">…</tct-avatar-group-overflow>`,
    );
    expect(baseOf(overflow).textContent.trim()).toBe('');
    expect(overflow.textContent).toBe('…');
    expect(baseOf(overflow).getAttribute('aria-label')).toBe('4 more');
  });

  it('is a static element by default and a focusable button when interactive', async () => {
    const staticOverflow = await fixture<TctAvatarGroupOverflow>(
      html`<tct-avatar-group-overflow count="2"></tct-avatar-group-overflow>`,
    );
    expect(baseOf(staticOverflow).tagName).toBe('SPAN');
    expect(staticOverflow.control).toBeNull();
    const button = await fixture<TctAvatarGroupOverflow>(
      html`<tct-avatar-group-overflow count="2" interactive></tct-avatar-group-overflow>`,
    );
    expect(baseOf(button).tagName).toBe('BUTTON');
    expect(button.control).toBe(baseOf(button));
    expect(baseOf(button).getAttribute('type')).toBe('button');
  });

  it('fires one click per activation, retargeted from the inner button', async () => {
    const overflow = await fixture<TctAvatarGroupOverflow>(
      html`<tct-avatar-group-overflow count="3" interactive></tct-avatar-group-overflow>`,
    );
    const clicks = recordEvents(overflow, 'click');
    overflow.focus();
    expect(deepActiveElement()).toBe(baseOf(overflow));
    await pressKeys('Enter');
    await pressKeys(' ');
    expect(clicks.events).toHaveLength(2);
    expect(clicks.events[0]!.composed).toBe(true);
  });

  it('draws a focus ring on keyboard focus', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div>
        <button type="button">before</button
        ><tct-avatar-group-overflow count="3" interactive></tct-avatar-group-overflow>
      </div>`,
    );
    const overflow = wrapper.querySelector<TctAvatarGroupOverflow>('tct-avatar-group-overflow')!;
    wrapper.querySelector('button')!.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(baseOf(overflow));
    expect(getComputedStyle(baseOf(overflow)).outlineStyle).not.toBe('none');
  });
});

describe('tct-avatar-group-overflow: appearance', () => {
  it('is a circle of the default size (36px + 2px ring) outside a group', async () => {
    const overflow = await fixture<TctAvatarGroupOverflow>(
      html`<tct-avatar-group-overflow count="5"></tct-avatar-group-overflow>`,
    );
    const box = baseOf(overflow).getBoundingClientRect();
    expect([box.width, box.height]).toEqual([40, 40]);
    expect(parseFloat(getComputedStyle(baseOf(overflow)).borderTopLeftRadius)).toBeGreaterThan(100);
  });

  it('grows into a pill for long content instead of clipping it', async () => {
    const overflow = await fixture<TctAvatarGroupOverflow>(
      html`<tct-avatar-group-overflow count="4912"></tct-avatar-group-overflow>`,
    );
    const box = baseOf(overflow).getBoundingClientRect();
    expect(box.width).toBeGreaterThan(40);
    expect(box.height).toBe(40);
  });

  it('keeps the label at or above the supporting text size (legibility floor)', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<tct-avatar-group size="xsm"
        ><tct-avatar-group-overflow count="3"></tct-avatar-group-overflow
      ></tct-avatar-group>`,
    );
    const overflow = wrapper.querySelector<TctAvatarGroupOverflow>('tct-avatar-group-overflow')!;
    expect(parseFloat(getComputedStyle(baseOf(overflow)).fontSize)).toBeGreaterThanOrEqual(12);
  });

  it('matches the group shape', async () => {
    const group = await fixture<HTMLElement>(
      html`<tct-avatar-group shape="square"
        ><tct-avatar-group-overflow count="3"></tct-avatar-group-overflow
      ></tct-avatar-group>`,
    );
    const overflow = group.querySelector<TctAvatarGroupOverflow>('tct-avatar-group-overflow')!;
    expect(getComputedStyle(baseOf(overflow)).borderTopLeftRadius).toBe('0px');
  });
});

describe('tct-avatar-group-overflow: accessibility and i18n', () => {
  it('passes axe static and interactive, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const wrapper = await fixture<HTMLElement>(
        html`<div>
          <tct-avatar-group-overflow count="3"></tct-avatar-group-overflow>
          <tct-avatar-group-overflow count="3" interactive></tct-avatar-group-overflow>
        </div>`,
        {theme},
      );
      await expectAccessible(wrapper);
    }
  });

  it('localises the count phrase (de-DE, ar-SA)', async () => {
    const german = await fixture<HTMLElement>(
      html`<div lang="de-DE">
        <tct-avatar-group-overflow count="3"></tct-avatar-group-overflow>
      </div>`,
    );
    const de = german.querySelector<TctAvatarGroupOverflow>('tct-avatar-group-overflow')!;
    await waitUntil(() => baseOf(de).getAttribute('aria-label') === '3 weitere', 'German');
    const arabic = await fixture<HTMLElement>(
      html`<div lang="ar-SA" dir="rtl">
        <tct-avatar-group-overflow count="3"></tct-avatar-group-overflow>
      </div>`,
    );
    const ar = arabic.querySelector<TctAvatarGroupOverflow>('tct-avatar-group-overflow')!;
    await waitUntil(() => baseOf(ar).getAttribute('aria-label')!.includes('إضافي'), 'Arabic');
  });

  it.skipIf(!isChromium)('keeps a visible edge in forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const overflow = await fixture<TctAvatarGroupOverflow>(
      html`<tct-avatar-group-overflow count="3" interactive></tct-avatar-group-overflow>`,
    );
    expect(getComputedStyle(baseOf(overflow)).borderTopStyle).toBe('solid');
    expect(getComputedStyle(baseOf(overflow)).borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
  });
});
