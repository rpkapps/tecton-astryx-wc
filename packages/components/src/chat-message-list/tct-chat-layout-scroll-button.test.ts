import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {expectEventCounts, recordEvents} from '@tecton-astryx/testing/events.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {aTimeout, waitUntil} from '@tecton-astryx/testing/timing.js';
import '../chat-message/define.js';
import './define.js';
import type {TctChatLayoutScrollButton} from './tct-chat-layout-scroll-button.js';

const pill = (element: Element) => element.shadowRoot!.querySelector<HTMLElement>('.pill')!;
const inner = (element: Element) => element.shadowRoot!.querySelector<HTMLElement>('tct-button')!;
/** The native button inside the tct-button inside the pill (what assistive technology sees). */
const native = (element: Element) =>
  inner(element).shadowRoot!.querySelector<HTMLElement>('button')!;

/** Whether `node` is `host` or inside it, crossing shadow roots. */
function within(host: Element, node: Node | null): boolean {
  for (let current = node; current; current = current.parentNode ?? (current as ShadowRoot).host) {
    if (current === host) return true;
  }
  return false;
}

async function make(attributes = '', options = {}): Promise<TctChatLayoutScrollButton> {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: 400px"><tct-chat-layout-scroll-button ${attributes}></tct-chat-layout-scroll-button></div>`,
    options,
  );
  return root.querySelector<TctChatLayoutScrollButton>('tct-chat-layout-scroll-button')!;
}

/** The pill's own fade finishes before geometry or colour is measured. */
const shown = (element: TctChatLayoutScrollButton) =>
  waitUntil(() => getComputedStyle(pill(element)).opacity === '1', 'the pill has faded in');

runElementSuite({
  tag: 'tct-chat-layout-scroll-button',
  render: () => `<tct-chat-layout-scroll-button visible></tct-chat-layout-scroll-button>`,
  properties: {visible: true, label: 'New messages'},
  attributes: {visible: 'visible', label: 'label'},
});

describe('tct-chat-layout-scroll-button: visibility', () => {
  it('is hidden by default: not painted, inert, and not in the accessibility tree', async () => {
    const button = await make();
    expect(button.visible).toBe(false);
    expect(getComputedStyle(pill(button)).visibility).toBe('hidden');
    expect(getComputedStyle(pill(button)).opacity).toBe('0');
    expect(pill(button).hasAttribute('inert')).toBe(true);
    if (isChromium) expect((await axNode(native(button))).ignored).toBe('true');
  });

  it('fades in when visible, and reflects the attribute', async () => {
    const button = await make();
    button.visible = true;
    await button.updateComplete;
    expect(button.hasAttribute('visible')).toBe(true);
    await shown(button);
    expect(getComputedStyle(pill(button)).visibility).toBe('visible');
    expect(pill(button).hasAttribute('inert')).toBe(false);
    if (isChromium) expect((await axNode(native(button))).role).toBe('button');
  });

  it('is reachable by keyboard exactly while visible, and never the first tab stop at rest', async () => {
    const root = await fixture<HTMLElement>(`
      <div>
        <button id="before" type="button">before</button>
        <tct-chat-layout-scroll-button></tct-chat-layout-scroll-button>
        <button id="after" type="button">after</button>
      </div>`);
    const button = root.querySelector<TctChatLayoutScrollButton>('tct-chat-layout-scroll-button')!;
    root.querySelector<HTMLElement>('#before')!.focus();
    await userEvent.tab();
    expect((deepActiveElement() as HTMLElement).id).toBe('after');
    button.visible = true;
    await button.updateComplete;
    // `visibility` rides the fade: it turns visible with the first frame of the transition.
    await waitUntil(() => getComputedStyle(pill(button)).visibility === 'visible', 'pill visible');
    root.querySelector<HTMLElement>('#before')!.focus();
    await userEvent.tab();
    expect(within(button, deepActiveElement())).toBe(true);
  });

  it('lets pointer events through outside the pill, and takes them on the visible pill', async () => {
    const button = await make('visible');
    await shown(button);
    expect(getComputedStyle(button).pointerEvents).toBe('none');
    expect(getComputedStyle(pill(button)).pointerEvents).toBe('auto');
    const wrapper = button
      .shadowRoot!.querySelector<HTMLElement>('.wrapper')!
      .getBoundingClientRect();
    const inside = document.elementFromPoint(wrapper.left + 2, wrapper.top + 2);
    expect(inside === button).toBe(false);
  });
});

describe('tct-chat-layout-scroll-button: label', () => {
  it('is an icon button named "Scroll to bottom" without a label, with a tooltip', async () => {
    const button = await make('visible');
    await shown(button);
    const control = inner(button);
    expect(control.hasAttribute('icon-only')).toBe(true);
    expect(control.getAttribute('label')).toBe('Scroll to bottom');
    expect(control.getAttribute('icon')).toBe('chevronDown');
    if (isChromium) expect((await axNode(native(button))).name).toBe('Scroll to bottom');
    const box = pill(button).getBoundingClientRect();
    expect(box.width).toBeCloseTo(box.height, 0);
    expect(box.height).toBe(32);
  });

  it('widens into a labelled pill with the label as its text and name', async () => {
    const button = await make('visible label="New messages"');
    await shown(button);
    await waitUntil(() => pill(button).getBoundingClientRect().width > 80, 'the pill widens');
    const control = inner(button);
    expect(control.hasAttribute('icon-only')).toBe(false);
    expect(control.getAttribute('label')).toBe('New messages');
    expect(control.textContent.trim()).toBe('New messages');
    expect(pill(button).getBoundingClientRect().width).toBeLessThanOrEqual(200);
    if (isChromium) expect((await axNode(native(button))).name).toBe('New messages');
    expect(getComputedStyle(pill(button)).borderTopLeftRadius).not.toBe('0px');
  });

  it('clips a very long label to 200px', async () => {
    const button = await make(
      'visible label="A label far too long to fit in a floating pill of two hundred pixels"',
    );
    await shown(button);
    await waitUntil(() => pill(button).getBoundingClientRect().width >= 199, 'grows to the cap');
    expect(pill(button).getBoundingClientRect().width).toBeLessThanOrEqual(200);
  });

  it('grows the label pill by animating width only when motion is allowed', async () => {
    const button = await make('visible label="New messages"');
    expect(getComputedStyle(pill(button)).transitionProperty).toContain('max-inline-size');
    if (isChromium) {
      await emulateMedia({reducedMotion: 'reduce'});
      const reduced = await make('visible label="New messages"');
      expect(getComputedStyle(pill(reduced)).transitionProperty).not.toContain('max-inline-size');
      expect(getComputedStyle(pill(reduced)).transitionProperty).toContain('opacity');
    }
  });
});

describe('tct-chat-layout-scroll-button: click', () => {
  it('raises exactly one native click per activation, retargeted to the host', async () => {
    const button = await make('visible');
    await shown(button);
    const recorder = recordEvents(button, ['click']);
    await userEvent.click(inner(button));
    expectEventCounts(recorder, {click: 1});
    expect(recorder.events[0]!.target).toBe(button);
    inner(button).focus();
    await pressKeys('Enter');
    await pressKeys(' ');
    expectEventCounts(recorder, {click: 3});
  });

  it('takes no pointer click while hidden: the pill is not a target', async () => {
    const button = await make();
    const recorder = recordEvents(button, ['click']);
    const box = pill(button).getBoundingClientRect();
    expect(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)).not.toBe(
      button,
    );
    await userEvent.click(button.parentElement!, {position: {x: box.left + 4, y: box.top + 4}});
    expectEventCounts(recorder, {click: 0});
  });
});

describe('tct-chat-layout-scroll-button: focus when it hides', () => {
  async function withList() {
    const root = await fixture<HTMLElement>(html`
      <div>
        <tct-chat-message-list no-announce>
          <tct-chat-message sender="assistant"
            ><tct-chat-message-bubble>One</tct-chat-message-bubble></tct-chat-message
          >
          <tct-chat-message sender="user"
            ><tct-chat-message-bubble>Two</tct-chat-message-bubble></tct-chat-message
          >
        </tct-chat-message-list>
        <button id="target" type="button">target</button>
        <tct-chat-layout-scroll-button visible></tct-chat-layout-scroll-button>
      </div>
    `);
    const button = root.querySelector<TctChatLayoutScrollButton>('tct-chat-layout-scroll-button')!;
    await shown(button);
    return {root, button};
  }

  it('moves focus to the newest message of the nearest list', async () => {
    const {root, button} = await withList();
    inner(button).focus();
    button.visible = false;
    await button.updateComplete;
    const list = root.querySelector('tct-chat-message-list')!;
    expect(deepActiveElement()).toBe(list.lastElementChild);
  });

  it('moves focus to focusTarget, given as an element or a function', async () => {
    const {root, button} = await withList();
    const target = root.querySelector<HTMLElement>('#target')!;
    button.focusTarget = target;
    inner(button).focus();
    button.visible = false;
    await button.updateComplete;
    expect(deepActiveElement()).toBe(target);

    button.visible = true;
    await button.updateComplete;
    button.focusTarget = () => root.querySelector<HTMLElement>('tct-chat-message-list');
    inner(button).focus();
    button.visible = false;
    await button.updateComplete;
    expect(deepActiveElement()).toBe(root.querySelector('tct-chat-message-list'));
  });

  it('leaves focus alone when the button did not hold it', async () => {
    const {root, button} = await withList();
    const target = root.querySelector<HTMLElement>('#target')!;
    target.focus();
    button.visible = false;
    await button.updateComplete;
    expect(document.activeElement).toBe(target);
  });

  it('does not throw when there is nowhere to send focus', async () => {
    const button = await make('visible');
    await shown(button);
    inner(button).focus();
    button.visible = false;
    await button.updateComplete;
    expect(button.isConnected).toBe(true);
  });
});

describe('tct-chat-layout-scroll-button: i18n, direction and theming', () => {
  it('localises "Scroll to bottom" (de-DE) and lets the label win', async () => {
    const button = await make('visible', {lang: 'de-DE'});
    await waitUntil(
      () => inner(button).getAttribute('label') !== 'Scroll to bottom',
      'German catalog',
      5000,
    );
    button.label = 'Neue Nachrichten';
    await button.updateComplete;
    expect(inner(button).getAttribute('label')).toBe('Neue Nachrichten');
  });

  it('renders in Arabic (ar-SA) right-to-left, the label pill centred', async () => {
    const button = await make('visible label="رسائل جديدة"', {lang: 'ar-SA', dir: 'rtl'});
    await shown(button);
    expect(getComputedStyle(pill(button)).direction).toBe('rtl');
    const host = button.getBoundingClientRect();
    const box = pill(button).getBoundingClientRect();
    expect(box.left + box.width / 2).toBeCloseTo(host.left + host.width / 2, 0);
  });

  it('passes axe visible: icon, labelled, and in the dark theme', async () => {
    const icon = await make('visible');
    await shown(icon);
    await expectAccessible(icon.parentElement!);
    const labelled = await make('visible label="New messages"');
    await shown(labelled);
    await expectAccessible(labelled.parentElement!);
    const dark = await fixture<HTMLElement>(
      html`<div style="background: var(--color-background-body)">
        <tct-chat-layout-scroll-button visible label="New messages"></tct-chat-layout-scroll-button>
      </div>`,
      {theme: 'dark'},
    );
    await shown(dark.querySelector<TctChatLayoutScrollButton>('tct-chat-layout-scroll-button')!);
    await expectAccessible(dark);
  });

  it.skipIf(!isChromium)('keeps a visible edge in forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const button = await make('visible');
    await shown(button);
    const style = getComputedStyle(pill(button));
    expect(style.borderTopStyle).toBe('solid');
    expect(style.borderTopWidth).toBe('1px');
  });
});
