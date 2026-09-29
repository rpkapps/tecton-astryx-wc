/**
 * tct-hover-card: element and overlay contracts, trigger ARIA (labelled dialog, unlabelled group),
 * hover/focus/touch behaviour, Escape, keyboard table, a11y, RTL, forced colours. Upstream test names
 * are kept where the behaviour applies.
 */
import {beforeEach, describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {
  aTimeout,
  animationsFinished,
  axNode,
  emulateMedia,
  expectAccessible,
  expectEventFlags,
  fixture,
  layerStack,
  pressKeys,
  recordEvents,
  runElementSuite,
  runKeyboardSuite,
  runOverlaySuite,
  waitUntil,
} from '@tecton-wc/testing/index.js';
import './define.js';
import type {TctHoverCard} from './tct-hover-card.js';

type Row = {keys: string; action: string; when?: string};
const parity = Object.values(
  import.meta.glob<{entries: {'core.hover-card': {keyboard: Row[]}}}>('./parity.json', {
    eager: true,
    import: 'default',
  }),
)[0]!;

const card = (
  attributes = '',
  trigger = '<button id="trigger">Hover me</button>',
  content = '<span>Card content</span>',
) =>
  `<tct-hover-card delay="20" hide-delay="20" ${attributes}>${trigger}<div slot="content">${content}</div></tct-hover-card>`;

async function mount(
  attributes = '',
  trigger?: string,
  content?: string,
  after = '',
): Promise<TctHoverCard> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:100px 40px">${card(attributes, trigger, content)}${after}<p id="outside">outside</p></div>`,
  );
  const element = root.querySelector<TctHoverCard>('tct-hover-card')!;
  await element.updateComplete;
  return element;
}

const layerOf = (el: TctHoverCard): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.layer')!;
const cardOf = (el: TctHoverCard): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.card')!;
const shown = (el: TctHoverCard): boolean => layerOf(el).matches(':popover-open');
const triggerOf = (el: TctHoverCard): HTMLElement =>
  el.querySelector<HTMLElement>(':scope > :not([slot])') ??
  el.shadowRoot!.querySelector<HTMLElement>('.trigger')!;

/** A touch tap as the platform delivers it to a trigger: pointerdown with pointerType touch, then the click. */
function tap(target: Element): void {
  target.dispatchEvent(
    new PointerEvent('pointerenter', {pointerType: 'touch', bubbles: false, composed: true}),
  );
  target.dispatchEvent(
    new PointerEvent('pointerdown', {pointerType: 'touch', bubbles: true, composed: true}),
  );
  target.dispatchEvent(
    new PointerEvent('pointerup', {pointerType: 'touch', bubbles: true, composed: true}),
  );
}

// A stationary real pointer would "enter" a trigger that a later test renders under it.
beforeEach(async () => {
  const parked = await fixture<HTMLElement>(
    '<div style="position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:8px;block-size:8px"></div>',
  );
  await userEvent.hover(parked);
});

runElementSuite({
  tag: 'tct-hover-card',
  render: () => card(),
  properties: {
    placement: 'below',
    alignment: 'start',
    delay: 50,
    hideDelay: 10,
    focusTrigger: 'never',
    touchTrigger: 'tap',
    disabled: true,
    label: 'Profile',
    hoverIndication: 'always',
  },
  attributes: {
    placement: 'placement',
    alignment: 'alignment',
    delay: 'delay',
    hideDelay: 'hide-delay',
    focusTrigger: 'focus-trigger',
    touchTrigger: 'touch-trigger',
    label: 'label',
    hoverIndication: 'hover-indication',
  },
  events: ['tct-open-change', 'tct-after-open-change'],
});

runOverlaySuite({
  tag: 'tct-hover-card',
  render: ({attributes = '', children = ''}) =>
    `<tct-hover-card label="Test" ${attributes}><button>Trigger</button><div slot="content"><button>Inside</button>${children}</div></tct-hover-card>`,
  trigger: (element) => element.querySelector(':scope > button'),
  surface: (element) => element.shadowRoot!.querySelector<HTMLElement>('.layer'),
});

describe('HoverCard', () => {
  it('renders trigger element', async () => {
    const el = await mount();
    expect(triggerOf(el).textContent).toBe('Hover me');
    expect((await axNode(triggerOf(el))).role).toBe('button');
  });

  it('exposes the floating layer as role="group" when no label is provided', async () => {
    const el = await mount();
    expect(cardOf(el).getAttribute('role')).toBe('group');
    expect(cardOf(el).hasAttribute('aria-label')).toBe(false);
    await el.show();
    expect((await axNode(cardOf(el))).role).toBe('group');
  });

  it('exposes the floating layer as a named dialog when label is provided', async () => {
    const el = await mount('label="Profile"');
    expect(cardOf(el).getAttribute('role')).toBe('dialog');
    await el.show();
    expect(await axNode(cardOf(el))).toMatchObject({role: 'dialog', name: 'Profile'});
  });

  it('does not render content initially: the card is closed and out of the accessibility tree', async () => {
    const el = await mount();
    expect(shown(el)).toBe(false);
    expect((await axNode(cardOf(el))).ignored).toBe('true');
  });

  it('anchors to the element trigger itself (no extra box) and positions above it, centred', async () => {
    const el = await mount();
    await el.show();
    await animationsFinished(layerOf(el));
    const trigger = triggerOf(el).getBoundingClientRect();
    const rect = cardOf(el).getBoundingClientRect();
    expect(rect.bottom).toBeLessThanOrEqual(trigger.top + 1);
    expect(Math.abs(rect.left + rect.width / 2 - (trigger.left + trigger.width / 2))).toBeLessThan(
      2,
    );
    expect(getComputedStyle(el.shadowRoot!.querySelector('.trigger')!).display).toBe('contents');
  });

  it('advertises a dialog popup on the trigger when labelled', async () => {
    const el = await mount('label="Profile"');
    const trigger = triggerOf(el);
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.hasAttribute('aria-controls')).toBe(false);
  });

  it('merges existing popup attributes on the trigger when labelled, and restores them on removal', async () => {
    const el = await mount(
      'label="Profile"',
      '<button id="trigger" aria-haspopup="menu" aria-controls="menu-id" aria-expanded="true">Menu</button>',
    );
    const trigger = triggerOf(el);
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    el.label = undefined;
    await el.updateComplete;
    // Unnamed again: the trigger's own attributes are back.
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
    expect(trigger.getAttribute('aria-controls')).toBe('menu-id');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('omits aria-expanded on a trigger whose role does not support it', async () => {
    const el = await mount('label="Profile"', '<span id="trigger" tabindex="0">Plain</span>');
    expect(triggerOf(el).getAttribute('aria-haspopup')).toBe('dialog');
    expect(triggerOf(el).hasAttribute('aria-expanded')).toBe(false);
  });

  it('keeps aria-expanded on a role-less trigger that declares a supporting role', async () => {
    const el = await mount(
      'label="Profile"',
      '<span id="trigger" role="button" tabindex="0">Plain</span>',
    );
    expect(triggerOf(el).getAttribute('aria-expanded')).toBe('false');
  });

  it('leaves a role-less trigger own aria-expanded untouched', async () => {
    const el = await mount(
      'label="Profile"',
      '<span id="trigger" tabindex="0" aria-expanded="true">Plain</span>',
    );
    expect(triggerOf(el).getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps aria-expanded on triggers whose implicit role supports it', async () => {
    for (const trigger of ['<button>b</button>', '<a href="#x">a</a>', '<summary>s</summary>']) {
      const el = await mount('label="Profile"', trigger);
      expect(triggerOf(el).getAttribute('aria-expanded'), trigger).toBe('false');
    }
  });

  it('describes an element trigger with the card text when no label is provided', async () => {
    const el = await mount('', '<button id="trigger">Hover me</button>', 'Rich <b>card</b> text');
    expect(triggerOf(el).getAttribute('aria-description')).toBe('Rich card text');
    expect((await axNode(triggerOf(el))).description).toBe('Rich card text');
  });

  it('preserves an existing aria-describedby on the trigger when no label is provided', async () => {
    const el = await mount('', '<button id="trigger" aria-describedby="other">Hover me</button>');
    expect(triggerOf(el).getAttribute('aria-describedby')).toBe('other');
    expect(triggerOf(el).hasAttribute('aria-description')).toBe(false);
  });

  it('updates aria-expanded when the labelled hover card opens and closes', async () => {
    const el = await mount('label="Profile"');
    await el.show();
    expect(triggerOf(el).getAttribute('aria-expanded')).toBe('true');
    await el.hide();
    expect(triggerOf(el).getAttribute('aria-expanded')).toBe('false');
  });

  it('supports text-only children with an inline focusable wrapper and a dashed underline', async () => {
    const root = await fixture<HTMLElement>(
      `<p>Read the <tct-hover-card delay="20" label="Term">glossary term<span slot="content">Definition</span></tct-hover-card> now.</p>`,
    );
    const el = root.querySelector<TctHoverCard>('tct-hover-card')!;
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector<HTMLElement>('.trigger')!;
    expect(wrapper.getAttribute('tabindex')).toBe('0');
    expect(getComputedStyle(wrapper).display).toBe('inline');
    expect(getComputedStyle(wrapper).textDecorationLine).toBe('underline');
    expect(getComputedStyle(wrapper).textDecorationStyle).toBe('dashed');
    expect(wrapper.getAttribute('aria-haspopup')).toBe('dialog');
    expect(wrapper.hasAttribute('aria-expanded')).toBe(false);
    await el.show();
    expect(wrapper.getAttribute('aria-controls')).toBe(cardOf(el).id);
  });

  it('keeps aria-describedby on text-only children when no label is provided', async () => {
    const root = await fixture<HTMLElement>(
      `<tct-hover-card delay="20">glossary term<div slot="content">Definition</div></tct-hover-card>`,
    );
    const el = root as TctHoverCard;
    const wrapper = el.shadowRoot!.querySelector<HTMLElement>('.trigger')!;
    expect(wrapper.getAttribute('aria-describedby')).toBe(cardOf(el).id);
  });

  it('hover-indication controls the underline: auto for text only, always, never', async () => {
    const withButton = await mount('hover-indication="always"');
    const trigger = withButton.shadowRoot!.querySelector('.trigger')!;
    expect(getComputedStyle(trigger).textDecorationLine).toBe('underline');
    const text = await fixture<TctHoverCard>(
      `<tct-hover-card hover-indication="never">term<div slot="content">x</div></tct-hover-card>`,
    );
    expect(getComputedStyle(text.shadowRoot!.querySelector('.trigger')!).textDecorationLine).toBe(
      'none',
    );
  });
});

describe('opening and closing', () => {
  it('opens on hover after the delay, with an intent event and one after-open-change', async () => {
    const el = await mount();
    const intent = recordEvents(el, 'tct-open-change');
    const after = recordEvents(el, 'tct-after-open-change');
    await userEvent.hover(triggerOf(el));
    await waitUntil(() => el.open && shown(el), 'opened by hover');
    await waitUntil(() => after.events.length === 1, 'after-open-change');
    expect(intent.events[0]!.reason).toBe('hover');
    expect(intent.events[0]!.open).toBe(true);
    expectEventFlags(intent.events[0]!, {bubbles: true, composed: true, cancelable: true});
  });

  it('closes when the pointer leaves after the hide delay', async () => {
    const el = await mount();
    await userEvent.hover(triggerOf(el));
    await waitUntil(() => el.open, 'open');
    await userEvent.hover(document.querySelector('#outside')!);
    await waitUntil(() => !el.open, 'closed');
  });

  it('stays open while the pointer is over the card (hoverable), and closes after it leaves', async () => {
    const el = await mount('hide-delay="60"');
    await userEvent.hover(triggerOf(el));
    await waitUntil(() => el.open && shown(el), 'open');
    await animationsFinished(layerOf(el));
    await userEvent.hover(cardOf(el));
    await aTimeout(200);
    expect(el.open).toBe(true);
    await userEvent.hover(document.querySelector('#outside')!);
    await waitUntil(() => !el.open, 'closed');
  });

  it('opens on keyboard focus of a focusable trigger, immediately', async () => {
    const el = await mount('delay="5000"');
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(triggerOf(el));
    await waitUntil(() => el.open, 'opened by focus');
  });

  it('respects focus-trigger="never"', async () => {
    const el = await mount('focus-trigger="never"');
    await pressKeys('Tab');
    await aTimeout(120);
    expect(el.open).toBe(false);
  });

  it('respects the disabled attribute (hover and focus)', async () => {
    const el = await mount('disabled');
    const intent = recordEvents(el, 'tct-open-change');
    await userEvent.hover(triggerOf(el));
    await pressKeys('Tab');
    await aTimeout(120);
    expect(el.open).toBe(false);
    expect(intent.events).toHaveLength(0);
  });

  it('preventing tct-open-change keeps the card closed', async () => {
    const el = await mount();
    el.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    await userEvent.hover(triggerOf(el));
    await aTimeout(150);
    expect(el.open).toBe(false);
  });

  it('pressing the trigger with a mouse dismisses the card', async () => {
    const el = await mount();
    await userEvent.hover(triggerOf(el));
    await waitUntil(() => el.open, 'open');
    await userEvent.click(triggerOf(el));
    await waitUntil(() => !el.open, 'closed');
  });

  it('show(), hide(), toggle() are programmatic: no intent events', async () => {
    const el = await mount();
    const intent = recordEvents(el, 'tct-open-change');
    const after = recordEvents(el, 'tct-after-open-change');
    await el.show();
    await el.toggle();
    await el.toggle(true);
    await el.hide();
    expect(intent.events).toHaveLength(0);
    expect(after.events.map((e) => e.open)).toEqual([true, false, true, false]);
  });

  describe('open attribute (upstream isDefaultOpen)', () => {
    it('shows the hover card on mount when open is set', async () => {
      const el = await mount('open');
      await waitUntil(() => shown(el), 'shown on mount');
      expect(layerStack()).toHaveLength(1);
    });

    it('emits after-open-change but no intent event on mount', async () => {
      const root = await fixture<HTMLElement>(`<div>${card()}</div>`);
      const el = root.querySelector<TctHoverCard>('tct-hover-card')!;
      const intent = recordEvents(el, 'tct-open-change');
      const after = recordEvents(el, 'tct-after-open-change');
      el.open = true;
      await waitUntil(() => after.events.length === 1, 'after-open-change');
      expect(intent.events).toHaveLength(0);
    });

    it('does not show the hover card on mount when open is not set', async () => {
      const el = await mount();
      await aTimeout(60);
      expect(shown(el)).toBe(false);
    });

    it('hover card is still dismissible after open', async () => {
      const el = await mount('open');
      await waitUntil(() => shown(el), 'shown');
      await pressKeys('Escape');
      await waitUntil(() => !el.open, 'dismissed');
    });
  });
});

describe('Escape key behavior', () => {
  it('hides hover card when Escape is pressed on trigger', async () => {
    const el = await mount();
    triggerOf(el).focus();
    await waitUntil(() => el.open, 'open by focus');
    const intent = recordEvents(el, 'tct-open-change');
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    expect(intent.events[0]!.reason).toBe('escape');
  });

  it('hides hover card when Escape is pressed inside content', async () => {
    const el = await mount('', undefined, '<button id="inside">Follow</button>');
    await el.show();
    el.querySelector<HTMLElement>('#inside')!.focus();
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
  });

  it('refocuses trigger after Escape from content', async () => {
    const el = await mount('', undefined, '<button id="inside">Follow</button>');
    await el.show();
    el.querySelector<HTMLElement>('#inside')!.focus();
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    await waitUntil(() => deepActiveElement() === triggerOf(el), 'trigger focused');
  });

  it('does not re-show hover card after Escape dismiss and refocus', async () => {
    const el = await mount('', undefined, '<button id="inside">Follow</button>');
    await el.show();
    el.querySelector<HTMLElement>('#inside')!.focus();
    await pressKeys('Escape');
    await waitUntil(() => deepActiveElement() === triggerOf(el), 'refocused');
    await aTimeout(150);
    expect(el.open).toBe(false);
  });

  it('keeps the card open while focus moves from the trigger into it, and closes it when focus leaves', async () => {
    // A focusable element after the card gives the last Tab somewhere to land. Without one, focus
    // leaves the page, wraps to the trigger a few ms later and keyboard focus there reopens the card,
    // so `open` is false only for that instant (a frame poll under load misses it).
    const el = await mount(
      '',
      undefined,
      '<button id="inside">Follow</button>',
      '<button id="after">After</button>',
    );
    const intent = recordEvents(el, 'tct-open-change');
    const requests = () => intent.events.map((event) => event.open);

    await pressKeys('Tab');
    // The card must be on screen before the next Tab, or its content is not focusable yet.
    await waitUntil(() => el.open && shown(el), 'card shown');
    await pressKeys('Tab');
    await waitUntil(() => deepActiveElement()?.id === 'inside', 'focus in the card');
    // Leaving the trigger scheduled a close after the hide delay; a timer for twice that delay set now
    // fires after it, so by then the card has had its chance to close and must have declined.
    await aTimeout(el.hideDelay * 2);
    expect(el.open).toBe(true);
    expect(requests()).toEqual([true]);

    await pressKeys('Tab');
    await waitUntil(() => deepActiveElement()?.id === 'after', 'focus past the card');
    await waitUntil(() => !el.open, 'closed after focus left');
    expect(requests()).toEqual([true, false]);
  });
});

describe('touch', () => {
  it('opens on a tap when the trigger performs no action', async () => {
    const el = await mount('', '<span id="trigger" tabindex="0">Plain</span>');
    tap(triggerOf(el));
    await waitUntil(() => el.open && shown(el), 'opened by tap');
  });

  it('stays shut on a tap when the trigger performs an action', async () => {
    const el = await mount();
    tap(triggerOf(el));
    await aTimeout(120);
    expect(el.open).toBe(false);
  });

  it('opens on a tap of an action trigger when touch-trigger is "tap"', async () => {
    const el = await mount('touch-trigger="tap"');
    tap(triggerOf(el));
    await waitUntil(() => el.open, 'opened by tap');
  });

  it('never opens on touch when touch-trigger is "none"', async () => {
    const el = await mount('touch-trigger="none"', '<span id="trigger" tabindex="0">Plain</span>');
    tap(triggerOf(el));
    await aTimeout(120);
    expect(el.open).toBe(false);
  });

  it('survives a tap on its own content', async () => {
    const el = await mount('', '<span id="trigger" tabindex="0">Plain</span>');
    tap(triggerOf(el));
    await waitUntil(() => el.open && shown(el), 'open');
    await animationsFinished(layerOf(el));
    await userEvent.click(cardOf(el));
    await aTimeout(100);
    expect(el.open).toBe(true);
  });

  it('closes on a tap outside', async () => {
    const el = await mount('', '<span id="trigger" tabindex="0">Plain</span>');
    tap(triggerOf(el));
    await waitUntil(() => el.open && shown(el), 'open');
    await userEvent.click(document.querySelector('#outside')!);
    await waitUntil(() => !el.open, 'closed');
  });

  it('closes on a second tap of the trigger', async () => {
    const el = await mount('', '<span id="trigger" tabindex="0">Plain</span>');
    tap(triggerOf(el));
    await waitUntil(() => el.open && shown(el), 'open');
    tap(triggerOf(el));
    await waitUntil(() => !el.open, 'closed');
  });
});

describe('a11y, rtl, forced colours', () => {
  it('passes axe closed and open, labelled and unlabelled', async () => {
    for (const attributes of ['', 'label="Profile"']) {
      const el = await mount(attributes, undefined, '<a href="#profile">View profile</a>');
      await expectAccessible(el);
      await el.show();
      await animationsFinished(layerOf(el));
      await expectAccessible(el);
    }
  });

  it('mirrors start/end placement in RTL', async () => {
    const root = await fixture<HTMLElement>(
      `<div dir="rtl" style="padding:60px 220px">${card('placement="start"')}</div>`,
    );
    const el = root.querySelector<TctHoverCard>('tct-hover-card')!;
    await el.show();
    await animationsFinished(layerOf(el));
    const trigger = triggerOf(el).getBoundingClientRect();
    expect(cardOf(el).getBoundingClientRect().left).toBeGreaterThanOrEqual(trigger.right - 1);
  });

  it('paints the card with system colours in forced colours and keeps the trigger ring', async () => {
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const el = await mount(
        '',
        '<span id="trigger">text</span>'.replace('<span id="trigger">text</span>', 'term'),
      );
      await el.show();
      const style = getComputedStyle(cardOf(el));
      expect(style.borderTopStyle).not.toBe('none');
      expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      await pressKeys('Tab');
      const wrapper = el.shadowRoot!.querySelector<HTMLElement>('.trigger')!;
      await waitUntil(() => deepActiveElement() === wrapper, 'wrapper focused');
      expect(getComputedStyle(wrapper).outlineStyle).not.toBe('none');
    } finally {
      await restore();
    }
  });
});

runKeyboardSuite({
  tag: 'tct-hover-card',
  render: () =>
    card('', '<button id="trigger">Hover me</button>', '<button id="inside">Inside</button>'),
  table: parity.entries['core.hover-card'].keyboard,
  steps: {
    'Focusing the trigger with the keyboard opens the card immediately': {
      focus: (el) => el.parentElement!.querySelector<HTMLElement>('#before'),
      keys: ['Tab'],
      setup: (el) => {
        // Start one stop before the trigger so Tab lands on it.
        el.parentElement!.insertAdjacentHTML('afterbegin', '<button id="before">before</button>');
        el.parentElement!.querySelector<HTMLElement>('#before')!.focus();
      },
      expect: async ({element}) => {
        await waitUntil(() => (element as TctHoverCard).open, 'opened by focus');
      },
    },
    "Moves focus from the trigger into the card's interactive content; the card stays open while focus is inside it":
      {
        focus: (el) => el.querySelector<HTMLElement>('#trigger'),
        keys: ['Tab'],
        setup: async (el) => {
          await (el as TctHoverCard).show();
        },
        expect: async ({element}) => {
          await waitUntil(() => deepActiveElement()?.id === 'inside', 'focus in the card');
          await aTimeout(120);
          expect((element as TctHoverCard).open).toBe(true);
        },
      },
    'Closes the card; focus returns to the trigger when it was inside the card, and refocusing the trigger does not reopen it':
      {
        focus: (el) => el.querySelector<HTMLElement>('#inside'),
        keys: ['Escape'],
        setup: async (el) => {
          await (el as TctHoverCard).show();
        },
        expect: async ({element}) => {
          await waitUntil(() => !(element as TctHoverCard).open, 'closed');
          await waitUntil(() => deepActiveElement()?.id === 'trigger', 'trigger focused');
          await aTimeout(120);
          expect((element as TctHoverCard).open).toBe(false);
        },
      },
  },
  waive: {},
});
