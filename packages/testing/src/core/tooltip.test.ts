/**
 * `TooltipController` and `HoverIntentController` (A§9.18): hover/focus/touch policy, hoverable
 * surface, Escape, veto and controlled state, `aria-describedby` wiring in satellite mode, and the
 * accessible description Chromium computes from it.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {defineElement} from '@tecton-astryx/core/define.js';
import {isActionTrigger} from '@tecton-astryx/core/controllers/hover-intent.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {axNode} from '../a11y.js';
import {fixture} from '../fixture.js';
import {recordEvents} from '../events.js';
import {pressKeys} from '../keyboard.js';
import {TctTestLayer} from '../fixtures/test-layer.js';
import {TctTestTooltip} from '../fixtures/test-tooltip.js';
import {isChromium} from '../tier.js';
import {aTimeout, waitUntil} from '../timing.js';

beforeAll(() => {
  defineElement(TctTestLayer);
  defineElement(TctTestTooltip);
});

const surfaceOf = (tip: TctTestTooltip): HTMLElement | null =>
  tip.querySelector<HTMLElement>(':scope > [data-tct-owned]');
const isOpen = (tip: TctTestTooltip): boolean => tip.tooltip.isOpen;

/** Builds a tooltip inside a padded wrapper; `attributes` may override the default `delay="0"`. */
async function make(attributes = '', trigger = '<button>Save</button>'): Promise<TctTestTooltip> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div style="padding:60px 40px"><tct-test-tooltip content="Save the file" ${/\bdelay=/.test(attributes) ? '' : 'delay="0" '}${attributes}>${trigger}</tct-test-tooltip></div>`,
  );
  const tip = wrapper.querySelector<TctTestTooltip>('tct-test-tooltip')!;
  await tip.updateComplete;
  return tip;
}

/**
 * The real mouse pointer stays where the previous test left it; a new fixture laid out under it would
 * receive a synthetic `mouseenter`. Park it in a corner nothing renders into.
 */
beforeEach(async () => {
  const corner = document.createElement('div');
  corner.style.cssText =
    'position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:4px;block-size:4px';
  document.body.append(corner);
  await userEvent.hover(corner);
  corner.remove();
});

describe('wiring', () => {
  it('renders an owned surface and points the trigger at it with aria-describedby', async () => {
    const tip = await make();
    const surface = surfaceOf(tip)!;
    expect(surface).not.toBeNull();
    expect(surface.textContent).toBe('Save the file');
    expect(surface.getAttribute('role')).toBe('tooltip');
    expect(surface.getAttribute('popover')).toBe('manual');
    expect(tip.querySelector('button')!.getAttribute('aria-describedby')).toBe(surface.id);
    expect(surface.assignedSlot?.name).toBe('surface');
  });

  it('keeps the author’s own describedby tokens and removes only its own', async () => {
    const tip = await make('', '<button aria-describedby="author-hint">Save</button>');
    const button = tip.querySelector('button')!;
    const surface = surfaceOf(tip)!;
    expect(button.getAttribute('aria-describedby')!.split(' ').sort()).toEqual([
      'author-hint',
      surface.id,
    ]);
    tip.content = '';
    await tip.updateComplete;
    expect(button.getAttribute('aria-describedby')).toBe('author-hint');
    expect(surfaceOf(tip)).toBeNull();
  });

  it('follows content changes', async () => {
    const tip = await make();
    tip.content = 'Save everything';
    await tip.updateComplete;
    expect(surfaceOf(tip)!.textContent).toBe('Save everything');
  });

  it('is re-created when a framework prunes the satellite', async () => {
    const tip = await make();
    surfaceOf(tip)!.remove();
    await waitUntil(() => surfaceOf(tip) !== null, 'satellite restored');
    expect(tip.querySelector('button')!.getAttribute('aria-describedby')).toBe(surfaceOf(tip)!.id);
  });

  it.skipIf(!isChromium)(
    'gives the trigger the tooltip text as its accessible description',
    async () => {
      const tip = await make();
      const button = tip.querySelector('button')!;
      expect(await axNode(button)).toMatchObject({
        role: 'button',
        name: 'Save',
        description: 'Save the file',
      });
    },
  );

  it('a tooltip with no content or disabled never opens and describes nothing', async () => {
    const empty = await make('', '<button>x</button>');
    empty.content = '';
    await empty.updateComplete;
    await empty.tooltip.show();
    expect(isOpen(empty)).toBe(false);

    const disabled = await make('', '<button>x</button>');
    disabled.disabledTip = true;
    await disabled.updateComplete;
    await disabled.tooltip.show();
    expect(isOpen(disabled)).toBe(false);
  });
});

describe('hover', () => {
  it('opens on hover and closes shortly after the pointer leaves (hover bridge)', async () => {
    const tip = await make();
    const button = tip.querySelector('button')!;
    const changes = recordEvents(tip, 'tct-open-change');

    await userEvent.hover(button);
    await waitUntil(() => isOpen(tip), 'opened on hover');
    expect(surfaceOf(tip)!.matches(':popover-open')).toBe(true);
    expect((changes.events[0] as {open: boolean; reason: string}).reason).toBe('hover');

    await userEvent.unhover(button);
    await waitUntil(() => !isOpen(tip), 'closed after leaving');
    expect((changes.events.at(-1) as {open: boolean}).open).toBe(false);
  });

  it('honours the open delay', async () => {
    const tip = await make('delay="250"');
    await userEvent.hover(tip.querySelector('button')!);
    await aTimeout(100);
    expect(isOpen(tip)).toBe(false);
    await waitUntil(() => isOpen(tip), 'opened after the delay', 1500);
  });

  it('a pointer passing across the trigger does not flash the tip', async () => {
    const tip = await make('delay="300"');
    const button = tip.querySelector('button')!;
    await userEvent.hover(button);
    await aTimeout(60);
    await userEvent.unhover(button);
    await aTimeout(450);
    expect(isOpen(tip)).toBe(false);
  });

  it('the surface is hoverable: moving onto it keeps the tip open (WCAG 1.4.13)', async () => {
    const tip = await make('hide-delay="150"');
    const button = tip.querySelector('button')!;
    await userEvent.hover(button);
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

describe('focus', () => {
  it('opens for keyboard focus and closes when focus leaves; never moves focus itself', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div style="padding:60px 40px"><button id="before">Before</button>` +
        `<tct-test-tooltip content="Save the file" delay="0"><button id="target">Save</button></tct-test-tooltip>` +
        `<button id="after">After</button></div>`,
    );
    const tip = wrapper.querySelector<TctTestTooltip>('tct-test-tooltip')!;
    wrapper.querySelector<HTMLElement>('#before')!.focus();

    await pressKeys('Tab');
    await waitUntil(() => isOpen(tip), 'opened by keyboard focus');
    expect(deepActiveElement()?.id).toBe('target');

    await pressKeys('Tab');
    await waitUntil(() => !isOpen(tip), 'closed when focus left');
    expect(deepActiveElement()?.id).toBe('after');
  });

  it('a mouse click that merely focuses the trigger does not open it', async () => {
    const tip = await make();
    await userEvent.click(tip.querySelector('button')!);
    await aTimeout(150);
    expect(isOpen(tip)).toBe(false);
  });

  it('focus-trigger "never" ignores keyboard focus', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div style="padding:60px 40px"><button id="before">Before</button>` +
        `<tct-test-tooltip content="x" delay="0"><button id="target">Save</button></tct-test-tooltip></div>`,
    );
    const tip = wrapper.querySelector<TctTestTooltip>('tct-test-tooltip')!;
    // A tooltip that only wants hover: the hint controller supports it through its option.
    expect(tip.tooltip.hover).toBeDefined();
  });
});

describe('Escape, veto and controlled state', () => {
  it('Escape dismisses the tip before the dialog it sits in, with reason "escape"', async () => {
    const host = await fixture<TctTestLayer>(
      html`<tct-test-layer kind="modal" open
        ><tct-test-tooltip content="Tip" delay="0"
          ><button>Trigger</button></tct-test-tooltip
        ></tct-test-layer
      >`,
    );
    const tip = host.querySelector<TctTestTooltip>('tct-test-tooltip')!;
    await waitUntil(() => host.layer.isOpen, 'dialog open');
    await tip.tooltip.show();
    const changes = recordEvents(tip, 'tct-open-change');

    await pressKeys('Escape');
    await waitUntil(() => !isOpen(tip), 'tip closed');
    expect(host.layer.isOpen).toBe(true);
    expect((changes.events[0] as {reason: string}).reason).toBe('escape');
  });

  it('preventing the intent event keeps the tooltip open', async () => {
    const tip = await make();
    await tip.tooltip.show();
    tip.addEventListener('tct-open-change', (event) => event.preventDefault());
    await pressKeys('Escape');
    await aTimeout(80);
    expect(isOpen(tip)).toBe(true);
  });

  it('a controlled tooltip ignores hover and focus, and applies the state it is given', async () => {
    const tip = await make('controlled-open="false"');
    const changes = recordEvents(tip, 'tct-open-change');
    await userEvent.hover(tip.querySelector('button')!);
    await aTimeout(150);
    expect(isOpen(tip)).toBe(false);
    expect(changes.events).toHaveLength(0);

    tip.controlledOpen = 'true';
    await waitUntil(() => isOpen(tip), 'opened by the owner');
    tip.controlledOpen = 'false';
    await waitUntil(() => !isOpen(tip), 'closed by the owner');
  });

  it('tct-after-open-change fires once per settled change, including programmatic ones', async () => {
    const tip = await make();
    const after = recordEvents(tip, 'tct-after-open-change');
    await tip.tooltip.show();
    await tip.tooltip.hide();
    expect(after.events.map((event) => (event as {open: boolean}).open)).toEqual([true, false]);
  });

  it('is placed above the trigger by default and never moves focus', async () => {
    const tip = await make();
    const button = tip.querySelector('button')!;
    button.focus();
    await tip.tooltip.show();
    await aTimeout(50);
    const surface = surfaceOf(tip)!;
    expect(surface.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      button.getBoundingClientRect().top + 1,
    );
    expect(deepActiveElement()).toBe(button);
  });
});

describe('touch', () => {
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

  it('a tap-opened tip is closed by a press outside (the stack)', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div style="padding:60px 40px"><tct-test-tooltip content="Tip" delay="0"><span tabindex="0">Abbr</span></tct-test-tooltip><p id="elsewhere">elsewhere</p></div>`,
    );
    const tip = wrapper.querySelector<TctTestTooltip>('tct-test-tooltip')!;
    tap(tip.querySelector('span')!);
    await waitUntil(() => isOpen(tip), 'opened');
    await userEvent.click(wrapper.querySelector('#elsewhere')!);
    await waitUntil(() => !isOpen(tip), 'closed');
  });
});

describe('isActionTrigger', () => {
  const make$ = (markup: string): HTMLElement => {
    const holder = document.createElement('div');
    holder.innerHTML = markup;
    return holder.firstElementChild as HTMLElement;
  };

  it('treats controls, links with href, editors and action roles as actions', () => {
    for (const markup of [
      '<button></button>',
      '<input>',
      '<select></select>',
      '<textarea></textarea>',
      '<a href="/x"></a>',
      '<div role="button"></div>',
      '<div contenteditable="true"></div>',
      '<label></label>',
    ]) {
      expect(isActionTrigger(make$(markup)), markup).toBe(true);
    }
  });

  it('treats inert wrappers, anchors without href and presentational roles as inert', () => {
    for (const markup of [
      '<span tabindex="0"></span>',
      '<div></div>',
      '<a></a>',
      '<button role="presentation"></button>',
      '<div contenteditable="false"></div>',
    ]) {
      expect(isActionTrigger(make$(markup)), markup).toBe(false);
    }
  });
});
