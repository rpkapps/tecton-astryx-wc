/**
 * tct-tooltip: wiring, hover/focus/touch policy, WCAG 1.4.13 (ported from upstream Tooltip.test.tsx and
 * useTooltip.test.tsx), the overlay contract, naming through `aria-describedby`, RTL, forced colours.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {beforeEach, describe, expect, it} from 'vitest';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {layerStack} from '@tecton-wc/testing/layers.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runOverlaySuite} from '@tecton-wc/testing/suites/overlay.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {aTimeout, waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {TctTooltip} from './tct-tooltip.js';

const surfaceOf = (tip: TctTooltip): HTMLElement | null =>
  tip.querySelector<HTMLElement>(':scope > tct-tooltip-surface');
const isOpen = (tip: TctTooltip): boolean => tip.isOpen;

/** A tooltip in a padded wrapper; `attributes` may override the default `delay="0"`. */
async function make(attributes = '', trigger = '<button>Save</button>'): Promise<TctTooltip> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div style="padding:60px 40px"><tct-tooltip content="Save the file" ${/\bdelay=/.test(attributes) ? '' : 'delay="0" '}${attributes}>${trigger}</tct-tooltip></div>`,
  );
  const tip = wrapper.querySelector<TctTooltip>('tct-tooltip')!;
  await tip.updateComplete;
  return tip;
}

/** Park the real mouse where nothing renders, so a new fixture is not laid out under it. */
beforeEach(async () => {
  const corner = document.createElement('div');
  corner.style.cssText =
    'position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:4px;block-size:4px';
  document.body.append(corner);
  await userEvent.hover(corner);
  corner.remove();
});

runElementSuite({
  tag: 'tct-tooltip',
  render: () => html`<tct-tooltip content="Tip"><button>Trigger</button></tct-tooltip>`,
  properties: {content: 'Other', placement: 'below', alignment: 'end', delay: 500, disabled: true},
  attributes: {content: 'content', placement: 'placement', alignment: 'alignment', delay: 'delay'},
  events: ['tct-open-change', 'tct-after-open-change'],
  // The host is `display: contents`: it has no box to inspect, and nothing to hide with [hidden] visually.
  skip: ['hostBox'],
});

runOverlaySuite({
  tag: 'tct-tooltip',
  render: ({attributes = '', children = ''}) =>
    `<tct-tooltip content="Tip" delay="0" ${attributes}><button>Trigger</button>${children}</tct-tooltip>`,
  trigger: (element) => element.querySelector('button'),
});

describe('tct-tooltip: wiring (Tooltip.test.tsx)', () => {
  it('renders the trigger element in place', async () => {
    const tip = await make();
    expect(tip.querySelector('button')!.textContent).toBe('Save');
    expect(getComputedStyle(tip).display).toBe('contents');
  });

  it('gives the tooltip layer role="tooltip" linked from the trigger with aria-describedby', async () => {
    const tip = await make();
    const surface = surfaceOf(tip)!;
    expect(surface).not.toBeNull();
    expect(surface.textContent).toBe('Save the file');
    expect(surface.getAttribute('role')).toBe('tooltip');
    expect(surface.getAttribute('popover')).toBe('manual');
    expect(tip.querySelector('button')!.getAttribute('aria-describedby')).toBe(surface.id);
    expect(surface.assignedSlot?.name).toBe('surface');
  });

  it.skipIf(!isChromium)(
    'gives the trigger the tooltip text as its accessible description',
    async () => {
      const tip = await make();
      expect(await axNode(tip.querySelector('button')!)).toMatchObject({
        role: 'button',
        name: 'Save',
        description: 'Save the file',
      });
    },
  );

  it('keeps the author’s own describedby tokens and removes only its own', async () => {
    const tip = await make('', '<button aria-describedby="author-hint">Save</button>');
    const button = tip.querySelector('button')!;
    expect(button.getAttribute('aria-describedby')!.split(' ').sort()).toEqual(
      ['author-hint', surfaceOf(tip)!.id].sort(),
    );
    tip.content = '';
    await tip.updateComplete;
    expect(button.getAttribute('aria-describedby')).toBe('author-hint');
    expect(surfaceOf(tip)).toBeNull();
  });

  it('follows content changes, and is re-created when a framework prunes the satellite', async () => {
    const tip = await make();
    tip.content = 'Save everything';
    await tip.updateComplete;
    expect(surfaceOf(tip)!.textContent).toBe('Save everything');
    surfaceOf(tip)!.remove();
    await waitUntil(() => surfaceOf(tip) !== null, 'satellite restored');
    expect(tip.querySelector('button')!.getAttribute('aria-describedby')).toBe(surfaceOf(tip)!.id);
  });

  it('a disabled or empty tooltip never opens, and an empty one describes nothing', async () => {
    const disabled = await make('disabled');
    await disabled.show();
    expect(isOpen(disabled)).toBe(false);
    await userEvent.hover(disabled.querySelector('button')!);
    await aTimeout(120);
    expect(isOpen(disabled)).toBe(false);
    const empty = await make();
    empty.content = '';
    await empty.updateComplete;
    await empty.show();
    expect(isOpen(empty)).toBe(false);
    expect(empty.querySelector('button')!.hasAttribute('aria-describedby')).toBe(false);
  });

  it('the surface is painted by its inner part and never by the host box', async () => {
    const tip = await make();
    await tip.show();
    const surface = surfaceOf(tip)!;
    const host = getComputedStyle(surface);
    expect(host.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(host.borderTopWidth).toBe('0px');
    const box = surface.shadowRoot!.querySelector<HTMLElement>('.surface')!;
    expect(getComputedStyle(box).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(box).borderRadius).not.toBe('0px');
  });
});

describe('tct-tooltip: text-only trigger', () => {
  it('a text-only body makes the element itself the focusable trigger with a hover indication', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div style="padding:60px 40px"><tct-tooltip content="Tip" delay="0">glossary term</tct-tooltip></div>`,
    );
    const tip = wrapper.querySelector<TctTooltip>('tct-tooltip')!;
    await tip.updateComplete;
    expect(tip.getAttribute('tabindex')).toBe('0');
    expect(tip.getAttribute('aria-describedby')).toBe(surfaceOf(tip)!.id);
    expect(getComputedStyle(tip).textDecorationStyle).toBe('dashed');
    tip.focus();
    await waitUntil(() => isOpen(tip), 'opened by keyboard focus');
  });

  it('hover-indication="never" and an element trigger draw no underline', async () => {
    const plain = await make();
    expect(getComputedStyle(plain).textDecorationLine).toBe('none');
    const wrapper = await fixture<HTMLDivElement>(
      `<div><tct-tooltip content="Tip" hover-indication="never">term</tct-tooltip></div>`,
    );
    const tip = wrapper.querySelector<TctTooltip>('tct-tooltip')!;
    await tip.updateComplete;
    expect(getComputedStyle(tip).textDecorationLine).toBe('none');
  });
});

describe('tct-tooltip: hover', () => {
  it('opens on hover with a cancelable tct-open-change (reason "hover") and closes after the pointer leaves', async () => {
    const tip = await make();
    const button = tip.querySelector('button')!;
    const changes = recordEvents(tip, 'tct-open-change');
    const after = recordEvents(tip, 'tct-after-open-change');

    await userEvent.hover(button);
    await waitUntil(() => isOpen(tip), 'opened on hover');
    expect(surfaceOf(tip)!.matches(':popover-open')).toBe(true);
    expect(tip.open).toBe(true);
    expect(changes.events[0]).toMatchObject({open: true, reason: 'hover', cancelable: true});
    await waitUntil(() => after.events.length === 1, 'commit event');

    await userEvent.unhover(button);
    await waitUntil(() => !isOpen(tip), 'closed after leaving');
    expect(tip.open).toBe(false);
    expect(changes.events.at(-1)).toMatchObject({open: false});
  });

  it('honours the open delay, and a pointer passing across the trigger does not flash the tip', async () => {
    const tip = await make('delay="250"');
    const button = tip.querySelector('button')!;
    await userEvent.hover(button);
    await aTimeout(100);
    expect(isOpen(tip)).toBe(false);
    await waitUntil(() => isOpen(tip), 'opened after the delay', 1500);
    await userEvent.unhover(button);
    await waitUntil(() => !isOpen(tip), 'closed');

    const quick = await make('delay="300"');
    const other = quick.querySelector('button')!;
    await userEvent.hover(other);
    await aTimeout(60);
    await userEvent.unhover(other);
    await aTimeout(450);
    expect(isOpen(quick)).toBe(false);
  });

  it('the surface is hoverable: moving onto it keeps the tip open (WCAG 1.4.13)', async () => {
    const tip = await make('hide-delay="150"');
    await userEvent.hover(tip.querySelector('button')!);
    await waitUntil(() => isOpen(tip), 'opened');
    const surface = surfaceOf(tip)!;
    await userEvent.hover(surface);
    await aTimeout(400);
    expect(isOpen(tip)).toBe(true);
    await userEvent.unhover(surface);
    await waitUntil(() => !isOpen(tip), 'closed once the pointer left the surface too');
  });

  it('pressing the trigger with the mouse dismisses the tip', async () => {
    const tip = await make();
    const button = tip.querySelector('button')!;
    await userEvent.hover(button);
    await waitUntil(() => isOpen(tip), 'opened');
    await userEvent.click(button);
    await waitUntil(() => !isOpen(tip), 'dismissed by the press');
  });
});

describe('tct-tooltip: focus', () => {
  it('opens for keyboard focus and closes when focus leaves, and never moves focus itself', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div style="padding:60px 40px"><button id="before">Before</button>` +
        `<tct-tooltip content="Save the file" delay="0"><button id="target">Save</button></tct-tooltip>` +
        `<button id="after">After</button></div>`,
    );
    const tip = wrapper.querySelector<TctTooltip>('tct-tooltip')!;
    wrapper.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    await waitUntil(() => isOpen(tip), 'opened by keyboard focus');
    expect(deepActiveElement()?.id).toBe('target');
    await pressKeys('Tab');
    await waitUntil(() => !isOpen(tip), 'closed when focus left');
    expect(deepActiveElement()?.id).toBe('after');
  });

  it('a mouse click that merely focuses the trigger does not open it, and focus-trigger "never" ignores keyboard focus', async () => {
    const tip = await make();
    await userEvent.click(tip.querySelector('button')!);
    await aTimeout(150);
    expect(isOpen(tip)).toBe(false);

    const wrapper = await fixture<HTMLDivElement>(
      `<div style="padding:60px 40px"><button id="before">Before</button>` +
        `<tct-tooltip content="x" delay="0" focus-trigger="never"><button id="target">Save</button></tct-tooltip></div>`,
    );
    const never = wrapper.querySelector<TctTooltip>('tct-tooltip')!;
    wrapper.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    await aTimeout(150);
    expect(deepActiveElement()?.id).toBe('target');
    expect(isOpen(never)).toBe(false);
  });
});

describe('tct-tooltip: Escape, veto and the open state (WCAG 1.4.13)', () => {
  it('Escape dismisses the tip with reason "escape", and one press is one layer', async () => {
    const tip = await make();
    await tip.show();
    const changes = recordEvents(tip, 'tct-open-change');
    await pressKeys('Escape');
    await waitUntil(() => !isOpen(tip), 'tip closed');
    expect(changes.events).toHaveLength(1);
    expect(changes.events[0]).toMatchObject({open: false, reason: 'escape'});
    expect(tip.open).toBe(false);
  });

  it('ignores Escape during IME composition', async () => {
    const tip = await make();
    await tip.show();
    for (const init of [{isComposing: true}, {keyCode: 229}]) {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true, ...init}),
      );
    }
    await aTimeout(80);
    expect(isOpen(tip)).toBe(true);
  });

  it('preventing the intent event keeps the tooltip open (a controlled tooltip)', async () => {
    const tip = await make();
    await tip.show();
    tip.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    await pressKeys('Escape');
    await aTimeout(80);
    expect(isOpen(tip)).toBe(true);
    expect(tip.open).toBe(true);
  });

  it('a controlled tooltip follows the state its owner writes and hover only asks', async () => {
    const tip = await make();
    tip.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    const changes = recordEvents(tip, 'tct-open-change');
    await userEvent.hover(tip.querySelector('button')!);
    await waitUntil(() => changes.events.length > 0, 'hover asked');
    await aTimeout(100);
    expect(isOpen(tip)).toBe(false);

    tip.open = true;
    await waitUntil(() => isOpen(tip), 'opened by the owner');
    tip.open = false;
    await waitUntil(() => !isOpen(tip), 'closed by the owner');
    expect(changes.events).toHaveLength(1);
  });

  it('the open attribute shows the tooltip on mount (upstream isDefaultOpen) and it stays dismissible', async () => {
    const tip = await make('open');
    await waitUntil(() => isOpen(tip), 'open on mount');
    const changes = recordEvents(tip, 'tct-open-change');
    await pressKeys('Escape');
    await waitUntil(() => !isOpen(tip), 'dismissed');
    expect(changes.events[0]).toMatchObject({open: false, reason: 'escape'});
  });

  it('a tooltip that is not open never fires tct-open-change from property writes; tct-after-open-change fires once per settled change', async () => {
    const tip = await make();
    const changes = recordEvents(tip, 'tct-open-change');
    const after = recordEvents(tip, 'tct-after-open-change');
    tip.open = true;
    await waitUntil(() => after.events.length === 1, 'opened');
    tip.open = false;
    await waitUntil(() => after.events.length === 2, 'closed');
    expect(changes.events).toHaveLength(0);
    expect(after.events.map((event) => event.open)).toEqual([true, false]);
  });

  it('Escape closes the tip before the modal dialog it sits in, and focus stays on the trigger', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div><dialog open><tct-tooltip content="Tip" delay="0"><button id="t">Trigger</button></tct-tooltip></dialog></div>`,
    );
    const dialog = wrapper.querySelector('dialog')!;
    dialog.close();
    dialog.showModal();
    const tip = wrapper.querySelector<TctTooltip>('tct-tooltip')!;
    await tip.updateComplete;
    wrapper.querySelector<HTMLElement>('#t')!.focus();
    await tip.show();
    await pressKeys('Escape');
    await waitUntil(() => !isOpen(tip), 'tip closed');
    expect(dialog.open).toBe(true);
    expect(deepActiveElement()?.id).toBe('t');
  });
});

describe('tct-tooltip: touch (Tooltip.test.tsx)', () => {
  const tap = (element: Element): void => {
    element.dispatchEvent(
      new PointerEvent('pointerdown', {bubbles: true, composed: true, pointerType: 'touch'}),
    );
  };

  it('auto: a tap on an inert trigger opens the tip, a second tap closes it', async () => {
    const tip = await make('', '<span tabindex="0">Abbr</span>');
    const trigger = tip.querySelector('span')!;
    tap(trigger);
    await waitUntil(() => isOpen(tip), 'opened by tap');
    tap(trigger);
    await waitUntil(() => !isOpen(tip), 'closed by a second tap');
  });

  it('auto: a trigger that performs an action keeps its tap; the tip stays shut', async () => {
    const tip = await make();
    tap(tip.querySelector('button')!);
    await aTimeout(100);
    expect(isOpen(tip)).toBe(false);
  });

  it('touch-trigger "tap" opens even for an action trigger; "none" never opens', async () => {
    const forced = await make('touch-trigger="tap"');
    tap(forced.querySelector('button')!);
    await waitUntil(() => isOpen(forced), 'forced open');
    const never = await make('touch-trigger="none"', '<span tabindex="0">x</span>');
    tap(never.querySelector('span')!);
    await aTimeout(100);
    expect(isOpen(never)).toBe(false);
  });

  it('closes on a tap outside, the dismissal a tap-open owes the user', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div style="padding:60px 40px"><tct-tooltip content="Tip" delay="0"><span tabindex="0">Abbr</span></tct-tooltip><p id="elsewhere">elsewhere</p></div>`,
    );
    const tip = wrapper.querySelector<TctTooltip>('tct-tooltip')!;
    tap(tip.querySelector('span')!);
    await waitUntil(() => isOpen(tip), 'opened');
    await userEvent.click(wrapper.querySelector('#elsewhere')!);
    await waitUntil(() => !isOpen(tip), 'closed');
  });
});

describe('tct-tooltip: layer stack, RTL, forced colours, accessibility', () => {
  it('registers as a hint layer while open and leaves the stack when closed', async () => {
    const tip = await make();
    await tip.show();
    expect(layerStack().map((layer) => layer.kind)).toEqual(['hint']);
    await tip.hide();
    expect(layerStack()).toHaveLength(0);
  });

  it('is placed above the trigger by default and never moves focus', async () => {
    const tip = await make();
    const button = tip.querySelector('button')!;
    button.focus();
    await tip.show();
    await aTimeout(50);
    expect(surfaceOf(tip)!.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      button.getBoundingClientRect().top + 1,
    );
    expect(deepActiveElement()).toBe(button);
  });

  it('an invalid placement or focus trigger falls back to the default', async () => {
    const tip = await make('placement="sideways" focus-trigger="whenever"');
    await tip.show();
    const button = tip.querySelector('button')!;
    expect(surfaceOf(tip)!.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      button.getBoundingClientRect().top + 1,
    );
  });

  it('passes axe while open, and the surface keeps a visible box in forced-colours mode', async () => {
    const tip = await make();
    await tip.show();
    await expectAccessible(tip.parentElement!);
    await emulateMedia({forcedColors: 'active'});
    const box = surfaceOf(tip)!.shadowRoot!.querySelector<HTMLElement>('.surface')!;
    expect(getComputedStyle(box).borderTopStyle).toBe('solid');
    await emulateMedia({forcedColors: 'none'});
  });

  it('reduced motion: no animation runs when the tooltip hides', async () => {
    await emulateMedia({reducedMotion: 'reduce'});
    const tip = await make();
    await tip.show();
    await tip.hide();
    expect(isOpen(tip)).toBe(false);
    await emulateMedia({reducedMotion: 'no-preference'});
  });
});
