/**
 * tct-token: the element suite, then rendering and colours, the clickable button, the link, the remove
 * button and the linked-and-removable container (no nested interactive content, one click, modifier and
 * middle clicks), disabled, description and hidden labels, overflow, focus, RTL, forced colours and i18n.
 * Ported from upstream Token.test.tsx where the behaviour applies.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it, vi} from 'vitest';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../icon/define.js';
import '../link/define.js';
import '../popover/define.js';
import '../button/define.js';
import '../size-provider/define.js';
import './define.js';
import {textOf} from '../typeahead/fixtures/typeahead-test-helpers.js';
import {TOKEN_COLORS} from './token.types.js';
import type {TctToken} from './tct-token.js';

const root = (token: TctToken): ShadowRoot => token.shadowRoot!;
const base = (token: TctToken): HTMLElement => root(token).querySelector<HTMLElement>('.base')!;
const action = (token: TctToken): HTMLElement | null =>
  root(token).querySelector<HTMLElement>('.action');
const removeButton = (token: TctToken): HTMLButtonElement | null =>
  root(token).querySelector<HTMLButtonElement>('button.remove');

async function make(attributes = 'label="Design"', extra = ''): Promise<TctToken> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:16px;inline-size:420px"><tct-token ${attributes}>${extra}</tct-token><button type="button">after</button></div>`,
  );
  // Links never navigate the test page.
  wrapper.addEventListener('click', (event) => {
    if (event.composedPath().some((node) => node instanceof HTMLAnchorElement))
      event.preventDefault();
  });
  const token = wrapper.querySelector<TctToken>('tct-token')!;
  await token.updateComplete;
  return token;
}

runElementSuite({
  tag: 'tct-token',
  render: () => html`<tct-token label="Design"></tct-token>`,
  properties: {
    label: 'Other',
    size: 'lg',
    color: 'green',
    disabled: true,
    clickable: true,
    removable: true,
    href: '/somewhere',
    target: '_blank',
    rel: 'nofollow',
    description: 'A team',
    labelHidden: true,
    value: 'design',
  },
  attributes: {
    label: 'label',
    size: 'size',
    color: 'color',
    href: 'href',
    description: 'description',
    value: 'value',
  },
  events: ['tct-remove'],
});

describe('tct-token: rendering (Token.test.tsx)', () => {
  it('renders the label as text in a pill, with no role and no interactive content by default', async () => {
    const token = await make();
    expect(textOf(base(token))).toBe('Design');
    expect(base(token).localName).toBe('span');
    expect(root(token).querySelector('button, a')).toBeNull();
    if (isChromium) expect((await axNode(base(token))).role).not.toBe('button');
  });

  it('renders each colour with its own fill and ink; unknown colours fall back to the default', async () => {
    const fills = new Map<string, string>();
    for (const color of TOKEN_COLORS) {
      const token = await make(`label="Design" color="${color}"`);
      const style = getComputedStyle(base(token));
      expect(style.backgroundColor, color).not.toBe('rgba(0, 0, 0, 0)');
      fills.set(color, `${style.backgroundColor}|${style.color}`);
    }
    // Tecton binds `teal` and `cyan` to the same tint (`--color-background-teal` equals `-cyan`): ten looks.
    expect(new Set(fills.values()).size).toBe(TOKEN_COLORS.length - 1);
    expect(fills.get('teal')).toBe(fills.get('cyan'));
    const unknown = await make('label="Design" color="mauve"');
    const fallback = getComputedStyle(base(unknown));
    expect(`${fallback.backgroundColor}|${fallback.color}`).toBe(fills.get('default'));
  });

  it('renders the three sizes at the control height minus 8px', async () => {
    const heights: Record<string, number> = {};
    for (const size of ['sm', 'md', 'lg']) {
      heights[size] = Math.round(
        base(await make(`label="Design" size="${size}"`)).getBoundingClientRect().height,
      );
    }
    expect(heights).toEqual({sm: 20, md: 24, lg: 28});
  });

  it('takes the size of an enclosing size provider unless it sets its own', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><tct-size-provider size="lg"><tct-token label="A"></tct-token><tct-token label="B" size="sm"></tct-token></tct-size-provider></div>`,
    );
    const [a, b] = [...wrapper.querySelectorAll<TctToken>('tct-token')];
    await a!.updateComplete;
    expect(Math.round(base(a!).getBoundingClientRect().height)).toBe(28);
    expect(Math.round(base(b!).getBoundingClientRect().height)).toBe(20);
  });

  it('renders the icon and end slots around the label, and nothing for absent slots', async () => {
    const token = await make(
      'label="Design"',
      '<tct-icon slot="icon" name="search"></tct-icon><span slot="end" id="count">3</span>',
    );
    const slots = [...root(token).querySelectorAll<HTMLSlotElement>('slot')];
    expect(slots.map((slot) => slot.name)).toEqual(['icon', 'end']);
    const bare = await make('label="Plain"');
    expect(root(bare).querySelectorAll('slot')).toHaveLength(0);
  });

  it('hides the label visually but keeps it as the accessible name', async () => {
    const token = await make(
      'label="Design" label-hidden clickable',
      '<tct-icon slot="icon" name="search"></tct-icon>',
    );
    const label = root(token).querySelector<HTMLElement>('.label')!;
    expect(label.classList.contains('visually-hidden')).toBe(true);
    expect(Math.round(label.getBoundingClientRect().width)).toBeLessThanOrEqual(1);
    if (isChromium) expect((await axNode(action(token)!)).name).toBe('Design');
  });

  it('exposes the description as the accessible description of the interactive element', async () => {
    const token = await make('label="Design" clickable description="The design team"');
    if (isChromium) expect((await axNode(action(token)!)).description).toBe('The design team');
  });

  it('truncates a long label with an ellipsis inside a narrow container', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div style="inline-size:100px"><tct-token label="A very long label that cannot fit in a hundred pixels"></tct-token></div>`,
    );
    const token = wrapper.querySelector<TctToken>('tct-token')!;
    await token.updateComplete;
    expect(getComputedStyle(root(token).querySelector('.label')!).textOverflow).toBe('ellipsis');
    expect(base(token).getBoundingClientRect().width).toBeLessThanOrEqual(100);
  });
});

describe('tct-token: clickable (the label is a real button)', () => {
  it('renders a button in a pill; a press fires exactly one click on the host', async () => {
    const token = await make('label="Design" clickable');
    expect(action(token)!.localName).toBe('button');
    expect(action(token)!.getAttribute('type')).toBe('button');
    const clicks = recordEvents(token, 'click');
    await userEvent.click(action(token)!);
    expect(clicks.events).toHaveLength(1);
  });

  it('a press on the pill outside the button (the icon, the padding) presses the button once', async () => {
    const token = await make(
      'label="Design" clickable',
      '<tct-icon slot="icon" name="search"></tct-icon>',
    );
    const origins: (EventTarget | undefined)[] = [];
    token.addEventListener('click', (event) => origins.push(event.composedPath()[0]));
    const box = base(token).getBoundingClientRect();
    await userEvent.click(base(token), {position: {x: 3, y: box.height / 2}});
    // One click reaches the host, and it is the button's own.
    expect(origins).toEqual([action(token)]);
  });

  it('Enter and Space press it (native button)', async () => {
    const token = await make('label="Design" clickable');
    const clicks = recordEvents(token, 'click');
    action(token)!.focus();
    await pressKeys('Enter');
    await pressKeys(' ');
    expect(clicks.events).toHaveLength(2);
  });

  it('is named by its label and exposed as a button', async () => {
    const token = await make('label="Design" clickable');
    if (isChromium)
      expect(await axNode(action(token)!)).toMatchObject({role: 'button', name: 'Design'});
  });

  it('inside a popover trigger a plain token renders as a button so the popover can bind it', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<tct-popover label="Team"><tct-token label="Design"></tct-token><div slot="content">Details</div></tct-popover>`,
    );
    const token = wrapper.querySelector<TctToken>('tct-token')!;
    await token.updateComplete;
    expect(action(token)?.localName).toBe('button');
  });

  it('a disabled token cannot be pressed: the button is disabled and no click reaches the host', async () => {
    const token = await make('label="Design" clickable disabled');
    expect((action(token) as HTMLButtonElement).disabled).toBe(true);
    const clicks = recordEvents(token, 'click');
    await userEvent.click(base(token), {force: true});
    expect(clicks.events).toHaveLength(0);
  });
});

describe('tct-token: link', () => {
  it('renders an anchor as the pill, with the destination, and no button', async () => {
    const token = await make('label="Docs" href="https://example.com/docs"');
    const anchor = base(token) as HTMLAnchorElement;
    expect(anchor.localName).toBe('a');
    expect(anchor.getAttribute('href')).toBe('https://example.com/docs');
    expect(root(token).querySelector('button')).toBeNull();
    if (isChromium) expect(await axNode(anchor)).toMatchObject({role: 'link', name: 'Docs'});
  });

  it('target=_blank adds rel="noopener noreferrer" to the rel the author gave', async () => {
    const token = await make(
      'label="Docs" href="https://example.com" target="_blank" rel="nofollow"',
    );
    const anchor = base(token);
    expect(anchor.getAttribute('target')).toBe('_blank');
    expect(anchor.getAttribute('rel')?.split(' ').sort()).toEqual([
      'nofollow',
      'noopener',
      'noreferrer',
    ]);
  });

  it('refuses a javascript: destination: an anchor without href', async () => {
    const token = await make('label="Docs" href="javascript:alert(1)"');
    expect(base(token).localName).toBe('a');
    expect(base(token).hasAttribute('href')).toBe(false);
  });

  it('a disabled link has no href, so it cannot be followed by any route', async () => {
    const token = await make('label="Docs" href="https://example.com" disabled');
    expect(base(token).hasAttribute('href')).toBe(false);
    expect(base(token).getAttribute('aria-disabled')).toBe('true');
  });

  it('offers an unmodified same-origin click to the enclosing link provider, and cancels the native navigation when it handles it', async () => {
    const navigate = vi.fn((_href: string, _event: Event) => true);
    const wrapper = await fixture<HTMLElement>(
      `<tct-link-provider><tct-token label="Docs" href="/docs"></tct-token></tct-link-provider>`,
    );
    (wrapper as unknown as {navigate: typeof navigate}).navigate = navigate;
    const token = wrapper.querySelector<TctToken>('tct-token')!;
    await token.updateComplete;
    const clicked = recordEvents(token, 'click');
    await userEvent.click(base(token));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0]![0]).toBe('/docs');
    expect(clicked.events[0]!.defaultPrevented).toBe(true);
  });

  it('leaves a modified click, a new-tab link and a cross-origin link to the browser', async () => {
    const navigate = vi.fn((_href: string, _event: Event) => true);
    const wrapper = await fixture<HTMLElement>(
      `<tct-link-provider><tct-token label="A" href="/docs" id="a"></tct-token><tct-token label="B" href="/docs" target="_blank" id="b"></tct-token><tct-token label="C" href="https://elsewhere.example/x" id="c"></tct-token></tct-link-provider>`,
    );
    (wrapper as unknown as {navigate: typeof navigate}).navigate = navigate;
    wrapper.addEventListener('click', (event) => event.preventDefault());
    await Promise.all([...wrapper.children].map((token) => (token as TctToken).updateComplete));
    const [a, b, c] = [...wrapper.querySelectorAll<TctToken>('tct-token')];
    await userEvent.click(base(b!));
    await userEvent.click(base(c!));
    await userEvent.keyboard('{Control>}');
    await userEvent.click(base(a!));
    await userEvent.keyboard('{/Control}');
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('tct-token: removable', () => {
  it('renders a remove button named "Remove {label}" after the label', async () => {
    const token = await make('label="Design" removable');
    const remove = removeButton(token)!;
    expect(remove.getAttribute('aria-label')).toBe('Remove Design');
    if (isChromium)
      expect(await axNode(remove)).toMatchObject({role: 'button', name: 'Remove Design'});
  });

  it('pressing it fires tct-remove with the value (default: the label) and no click on the host', async () => {
    const token = await make('label="Design" removable');
    const events = recordEvents(token, ['tct-remove', 'click']);
    await userEvent.click(removeButton(token)!);
    expect(events.counts()).toEqual({'tct-remove': 1, click: 0});
    expect(events.named('tct-remove')[0]).toMatchObject({value: 'Design'});
    token.value = 'team-1';
    await token.updateComplete;
    await userEvent.click(removeButton(token)!);
    expect(events.named('tct-remove')[1]).toMatchObject({value: 'team-1'});
  });

  it('tct-remove bubbles, composes and is cancelable; the token does not remove itself', async () => {
    const token = await make('label="Design" removable');
    const events = recordEvents(token, 'tct-remove');
    await userEvent.click(removeButton(token)!);
    const [event] = events.events;
    expect([event!.bubbles, event!.composed, event!.cancelable]).toEqual([true, true, true]);
    expect(token.isConnected).toBe(true);
  });

  it('Enter on the focused remove button removes once', async () => {
    const token = await make('label="Design" removable');
    const events = recordEvents(token, 'tct-remove');
    removeButton(token)!.focus();
    await pressKeys('Enter');
    expect(events.events).toHaveLength(1);
  });

  it('a disabled token has a disabled remove button and never fires tct-remove', async () => {
    const token = await make('label="Design" removable disabled');
    expect(removeButton(token)!.disabled).toBe(true);
    const events = recordEvents(token, 'tct-remove');
    await userEvent.click(removeButton(token)!, {force: true});
    expect(events.events).toHaveLength(0);
  });

  it('with clickable, the label and the remove button are separate siblings and separate tab stops (no nested buttons)', async () => {
    const token = await make('label="Design" clickable removable');
    expect(root(token).querySelectorAll('button')).toHaveLength(2);
    expect(root(token).querySelector('button button')).toBeNull();
    const label = action(token) as HTMLButtonElement;
    const remove = removeButton(token)!;
    expect(label.parentElement).toBe(remove.parentElement);
    label.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(remove);
    await pressKeys('Tab');
    expect(deepActiveElement()?.textContent).toBe('after');
  });

  it('the remove button has a hit area larger than its 16px glyph', async () => {
    const token = await make('label="Design" removable');
    const remove = removeButton(token)!;
    expect(Math.round(remove.getBoundingClientRect().width)).toBe(16);
    const after = getComputedStyle(remove, '::after');
    expect(Number.parseFloat(after.width)).toBeGreaterThanOrEqual(24);
  });
});

describe('tct-token: linked and removable (a link and a button as siblings)', () => {
  const setup = async (): Promise<{
    token: TctToken;
    anchor: HTMLAnchorElement;
    clicks: MouseEvent[];
  }> => {
    const token = await make('label="Docs" href="https://example.com/docs" removable');
    const anchor = action(token) as HTMLAnchorElement;
    const clicks: MouseEvent[] = [];
    anchor.addEventListener('click', (event) => clicks.push(event));
    return {token, anchor, clicks};
  };

  it('the link is not the root and does not contain the remove button', async () => {
    const {token, anchor} = await setup();
    expect(anchor.localName).toBe('a');
    expect(base(token).localName).toBe('span');
    expect(anchor.querySelector('button')).toBeNull();
    expect(removeButton(token)!.parentElement).toBe(anchor.parentElement);
  });

  it('a press on the pill outside the link activates the link (the whole surface)', async () => {
    const {token, clicks} = await setup();
    await userEvent.click(base(token), {position: {x: 3, y: 8}});
    expect(clicks).toHaveLength(1);
  });

  it('pressing the remove button removes and does not follow the link', async () => {
    const {token, clicks} = await setup();
    const events = recordEvents(token, 'tct-remove');
    await userEvent.click(removeButton(token)!);
    expect(events.events).toHaveLength(1);
    expect(clicks).toHaveLength(0);
  });

  it('the link and the remove button are separate tab stops', async () => {
    const {token, anchor} = await setup();
    anchor.focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(removeButton(token));
  });

  it('a Ctrl/Cmd click on the pill reaches the link with its modifiers; a middle click opens a new tab', async () => {
    const {token, clicks} = await setup();
    await userEvent.keyboard('{Control>}');
    await userEvent.click(base(token), {position: {x: 3, y: 8}});
    await userEvent.keyboard('{/Control}');
    expect(clicks).toHaveLength(1);
    expect(clicks[0]!.ctrlKey).toBe(true);
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    try {
      base(token).dispatchEvent(
        new MouseEvent('mouseup', {button: 1, bubbles: true, composed: true, cancelable: true}),
      );
      expect(open).toHaveBeenCalledTimes(1);
      expect(open.mock.calls[0]![0]).toBe('https://example.com/docs');
    } finally {
      open.mockRestore();
    }
  });

  it('a modified click that opens a new tab does not fire tct-remove', async () => {
    const {token} = await setup();
    const events = recordEvents(token, 'tct-remove');
    await userEvent.keyboard('{Control>}');
    await userEvent.click(base(token), {position: {x: 3, y: 8}});
    await userEvent.keyboard('{/Control}');
    expect(events.events).toHaveLength(0);
  });

  it('a disabled token proxies nothing', async () => {
    const token = await make('label="Docs" href="https://example.com/docs" removable disabled');
    const anchor = action(token) as HTMLAnchorElement;
    expect(anchor.hasAttribute('href')).toBe(false);
    expect(removeButton(token)!.disabled).toBe(true);
    // Only a linked, removable, enabled token is a pressable container for an enclosing card.
    expect(token.hasAttribute('data-pressable-container')).toBe(false);
  });

  it('a link without removable keeps the anchor as the root', async () => {
    const token = await make('label="Docs" href="https://example.com/docs"');
    expect(base(token).localName).toBe('a');
    expect(token.hasAttribute('data-pressable-container')).toBe(false);
  });
});

describe('tct-token: focus, RTL, forced colours and i18n', () => {
  it('a clickable token draws one focus ring around the whole pill; the inner button draws none', async () => {
    const token = await make('label="Design" clickable removable');
    const after = token.parentElement!.querySelector('button')!;
    after.focus();
    await pressKeys('Shift+Tab', 'Shift+Tab');
    expect(deepActiveElement()).toBe(action(token));
    await waitUntil(
      () => getComputedStyle(base(token)).outlineStyle !== 'none',
      'the ring is drawn',
    );
    expect(getComputedStyle(action(token)!).outlineStyle).toBe('none');
  });

  it('a link token draws the ring on the anchor', async () => {
    const token = await make('label="Docs" href="https://example.com"');
    const after = token.parentElement!.querySelector('button')!;
    after.focus();
    await pressKeys('Shift+Tab');
    await waitUntil(
      () => getComputedStyle(base(token)).outlineStyle !== 'none',
      'the ring is drawn',
    );
  });

  it('forced colours: the pill keeps a system-colour edge and a disabled one turns grey', async () => {
    if (!isChromium) return;
    const token = await make('label="Design" clickable');
    await emulateMedia({forcedColors: 'active'});
    try {
      await nextFrame();
      expect(getComputedStyle(base(token)).borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
    } finally {
      await emulateMedia({forcedColors: 'none'});
    }
  });

  it('RTL: the remove button sits at the inline end (the left) of the pill', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div dir="rtl" style="padding:16px"><tct-token label="تصميم" removable></tct-token></div>`,
      {lang: 'ar-SA'},
    );
    const token = wrapper.querySelector<TctToken>('tct-token')!;
    await token.updateComplete;
    const label = root(token).querySelector('.label')!.getBoundingClientRect();
    const remove = removeButton(token)!.getBoundingClientRect();
    expect(remove.right).toBeLessThan(label.left + 1);
  });

  it('de-DE: the remove button name comes from the catalog, and an attribute-free label stays yours', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-token label="Design" removable></tct-token></div>`,
    );
    const token = wrapper.querySelector<TctToken>('tct-token')!;
    await token.updateComplete;
    await waitUntil(
      () => removeButton(token)!.getAttribute('aria-label') !== 'Remove Design',
      'German catalog loaded',
    );
    expect(removeButton(token)!.getAttribute('aria-label')).toBe('Design entfernen');
  });

  it('passes axe in every form', async () => {
    for (const attributes of [
      'label="Plain"',
      'label="Plain" description="With a description"',
      'label="Clickable" clickable',
      'label="Removable" removable',
      'label="Both" clickable removable',
      'label="Link" href="https://example.com"',
      'label="Linked and removable" href="https://example.com" removable',
      'label="Disabled" clickable removable disabled',
      'label="Design" label-hidden clickable',
    ]) {
      await expectAccessible(
        await make(attributes, '<tct-icon slot="icon" name="search"></tct-icon>'),
      );
    }
  });
});
