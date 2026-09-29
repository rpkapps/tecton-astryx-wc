/**
 * `tct-collapsible` and `tct-collapsible-group`: disclosure semantics, own and group state, the intent
 * and commit events, presentation (dividers, density, chevron), find-in-page reveal, RTL, forced colours.
 * Test names follow upstream `Collapsible.test.tsx`, `CollapsibleGroup.test.tsx`, `useCollapsible.test.tsx`.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {features} from '@tecton-astryx/core/features.js';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {expectEventCounts, expectEventFlags, recordEvents} from '@tecton-astryx/testing/events.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {runKeyboardSuite, type KeyboardRow} from '@tecton-astryx/testing/suites/keyboard.js';
import {nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import {forceFeatures} from '@tecton-astryx/testing/tier.js';
import './define.js';
import type {TctCollapsibleGroup} from './tct-collapsible-group.js';
import type {TctCollapsible} from './tct-collapsible.js';

const trigger = (element: Element): HTMLButtonElement =>
  element.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!;
const content = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
const chevron = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part="chevron"]')!;
const expanded = (element: Element): string | null =>
  trigger(element).getAttribute('aria-expanded');
// Collapsed content keeps a rendered box (content-visibility: hidden), so visibility is its height.
const shown = (element: Element): boolean => content(element).getBoundingClientRect().height > 0;

async function make<T extends Element = TctCollapsible>(markup: string): Promise<T> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div style="width: 400px"><button id="before">before</button>${markup}</div>`,
  );
  const element = wrapper.querySelector<T>('tct-collapsible, tct-collapsible-group')!;
  await nextFrame();
  return element;
}

const single = (attributes = 'trigger="Details"', body = 'Collapsible content') =>
  make(`<tct-collapsible ${attributes}>${body}</tct-collapsible>`);

const accordion = (groupAttributes = '', itemAttributes = '') =>
  make<TctCollapsibleGroup>(
    `<tct-collapsible-group ${groupAttributes}>` +
      ['a', 'b', 'c']
        .map(
          (id) =>
            `<tct-collapsible value="${id}" trigger="Item ${id}" ${itemAttributes}>Body ${id}</tct-collapsible>`,
        )
        .join('') +
      `</tct-collapsible-group>`,
  );
const items = (group: Element): TctCollapsible[] => [...group.querySelectorAll('tct-collapsible')];

runElementSuite({
  tag: 'tct-collapsible',
  render: () => html`<tct-collapsible trigger="Details">Content</tct-collapsible>`,
  properties: {open: true, disabled: true, chevronPosition: 'start', value: 'x'},
  attributes: {chevronPosition: 'chevron-position', value: 'value'},
  events: ['tct-open-change', 'tct-value-change'], // tct-after-open-change is a notification for every change (A§7.6)
});

runElementSuite({
  tag: 'tct-collapsible-group',
  render: () =>
    html`<tct-collapsible-group
      ><tct-collapsible value="a" trigger="A">a</tct-collapsible></tct-collapsible-group
    >`,
  properties: {type: 'multiple', hasDividers: true, density: 'compact', chevronPosition: 'start'},
  attributes: {type: 'type', density: 'density', chevronPosition: 'chevron-position'},
  events: ['tct-value-change'],
  skip: ['hostBox'],
});

describe('tct-collapsible: structure and rendering', () => {
  it('renders the trigger text inside a native button with type="button"', async () => {
    const element = await single();
    expect(trigger(element).type).toBe('button');
    expect(await axNode(trigger(element))).toMatchObject({role: 'button', name: 'Details'});
  });

  it('renders children inside the controlled content region', async () => {
    const element = await single('trigger="Details" open');
    expect(content(element).textContent.trim()).toBe('');
    expect(element.textContent).toBe('Collapsible content');
    expect(shown(element)).toBe(true);
  });

  it('links the trigger to its content region via aria-controls (one tree)', async () => {
    const element = await single();
    expect(trigger(element).getAttribute('aria-controls')).toBe(content(element).id);
    expect(content(element).id).not.toBe('');
  });

  it('renders rich trigger content from the trigger slot', async () => {
    const element = await single(
      '',
      '<span slot="trigger">Rich <b>trigger</b></span>Collapsible content',
    );
    expect(await axNode(trigger(element))).toMatchObject({name: 'Rich trigger'});
  });

  it('is axe clean open, closed and disabled', async () => {
    for (const attributes of [
      'trigger="Details"',
      'trigger="Details" open',
      'trigger="Details" disabled',
    ]) {
      await expectAccessible(await single(attributes));
    }
  });
});

describe('tct-collapsible: own open state', () => {
  it('starts collapsed (aria-expanded="false") and open with the open attribute', async () => {
    const closed = await single();
    expect(expanded(closed)).toBe('false');
    expect(shown(closed)).toBe(false);
    const open = await single('trigger="Details" open');
    expect(expanded(open)).toBe('true');
  });

  it('toggles open and closed when the trigger is clicked', async () => {
    const element = await single();
    await userEvent.click(trigger(element));
    expect(expanded(element)).toBe('true');
    expect(element.open).toBe(true);
    expect(element.hasAttribute('open')).toBe(true);
    await userEvent.click(trigger(element));
    expect(expanded(element)).toBe('false');
    expect(element.open).toBe(false);
  });

  it('toggles via keyboard activation (Enter and Space)', async () => {
    const element = await single();
    trigger(element).focus();
    await pressKeys('Enter');
    expect(expanded(element)).toBe('true');
    await pressKeys(' ');
    expect(expanded(element)).toBe('false');
  });

  it('hides the content region only when collapsed, and keeps it in the tree (until found)', async () => {
    const element = await single();
    expect(shown(element)).toBe(false);
    if (features.hiddenUntilFound)
      expect(content(element).getAttribute('hidden')).toBe('until-found');
    else expect(content(element).hasAttribute('hidden')).toBe(true);
    element.open = true;
    await element.updateComplete;
    expect(shown(element)).toBe(true);
    expect(content(element).hasAttribute('hidden')).toBe(false);
  });

  it('collapsed content is out of the tab order', async () => {
    const element = await single('trigger="Details"', '<button id="inside">inside</button>');
    trigger(element).focus();
    await pressKeys('Tab');
    expect(deepActiveElement()?.id).not.toBe('inside');
    element.open = true;
    await element.updateComplete;
    trigger(element).focus();
    await pressKeys('Tab');
    expect(deepActiveElement()?.id).toBe('inside');
  });

  it('rotates the chevron indicator between open and closed states', async () => {
    const element = await single();
    const before = getComputedStyle(chevron(element)).rotate;
    element.open = true;
    await element.updateComplete;
    await nextFrame();
    await nextFrame();
    expect(getComputedStyle(chevron(element)).rotate).not.toBe(before);
  });

  it('show(), hide() and toggle() are programmatic: no intent event, but the after event fires', async () => {
    const element = await single();
    const recorder = recordEvents(element, ['tct-open-change', 'tct-after-open-change']);
    element.show();
    await element.updateComplete;
    element.toggle();
    await element.updateComplete;
    element.toggle(true);
    await element.updateComplete;
    element.hide();
    await element.updateComplete;
    expectEventCounts(recorder, {'tct-open-change': 0, 'tct-after-open-change': 4});
  });
});

describe('tct-collapsible: events and controlled use', () => {
  it('a click fires a cancelable, bubbling, composed tct-open-change before the change, then the after event', async () => {
    const element = await single();
    const recorder = recordEvents(element, ['tct-open-change', 'tct-after-open-change']);
    let openAtIntent: boolean | undefined;
    element.addEventListener('tct-open-change', () => {
      openAtIntent = element.open;
    });
    await userEvent.click(trigger(element));
    expect(openAtIntent).toBe(false);
    expect(recorder.events.map((event) => event.type)).toEqual([
      'tct-open-change',
      'tct-after-open-change',
    ]);
    expect(recorder.events[0]!.open).toBe(true);
    expect(recorder.events[0]!.reason).toBe('trigger');
    expectEventFlags(recorder.events[0]!, {bubbles: true, composed: true, cancelable: true});
    expectEventFlags(recorder.events[1]!, {bubbles: true, composed: true, cancelable: false});
  });

  it('preventDefault() on the intent event keeps the state (controlled use)', async () => {
    const element = await single();
    element.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    const recorder = recordEvents(element, ['tct-after-open-change']);
    await userEvent.click(trigger(element));
    expect(element.open).toBe(false);
    expect(expanded(element)).toBe('false');
    expect(recorder.events).toEqual([]);
    // The owner applies the state itself.
    element.open = true;
    await element.updateComplete;
    expect(expanded(element)).toBe('true');
  });

  it('property and attribute writes fire no intent event', async () => {
    const element = await single();
    const recorder = recordEvents(element, ['tct-open-change', 'input', 'change']);
    element.open = true;
    element.setAttribute('chevron-position', 'start');
    await element.updateComplete;
    expect(recorder.events).toEqual([]);
  });

  it('requestClose() asks first, like a user would', async () => {
    const element = await single('trigger="Details" open');
    const recorder = recordEvents(element, ['tct-open-change']);
    element.requestClose();
    expect(recorder.events).toHaveLength(1);
    expect(element.open).toBe(false);
  });
});

describe('tct-collapsible: disabled state', () => {
  it('marks the trigger aria-disabled and drops it from the tab order', async () => {
    const element = await single('trigger="Details" disabled');
    expect(trigger(element).getAttribute('aria-disabled')).toBe('true');
    expect(trigger(element).getAttribute('tabindex')).toBe('-1');
    expect((await axNode(trigger(element))).disabled).toBe('true');
    expect(element.matches(':state(disabled)')).toBe(true);
  });

  it('is enabled by default: no aria-disabled, stays in tab order', async () => {
    const element = await single();
    expect(trigger(element).hasAttribute('aria-disabled')).toBe(false);
    expect(trigger(element).hasAttribute('tabindex')).toBe(false);
  });

  it('does not toggle or fire when the trigger is clicked while disabled', async () => {
    const element = await single('trigger="Details" disabled');
    const recorder = recordEvents(element, ['tct-open-change']);
    trigger(element).click();
    expect(element.open).toBe(false);
    expect(recorder.events).toEqual([]);
  });

  it('does not collapse an already-open item: content stays visible', async () => {
    const element = await single('trigger="Details" open');
    element.disabled = true;
    await element.updateComplete;
    expect(shown(element)).toBe(true);
    expect(expanded(element)).toBe('true');
  });
});

describe('tct-collapsible: chevron position', () => {
  const glyphs = (element: Element): string => chevron(element).getAttribute('name')!;
  const before = (element: Element): boolean =>
    !!(
      trigger(element).querySelector('.label')!.compareDocumentPosition(chevron(element)) &
      Node.DOCUMENT_POSITION_PRECEDING
    );

  it('puts the chevron after the label by default and before it with position start', async () => {
    const end = await single();
    expect(before(end)).toBe(false);
    const start = await single('trigger="Details" chevron-position="start"');
    expect(before(start)).toBe(true);
  });

  it('swaps the glyph with the side, not just the position', async () => {
    expect(glyphs(await single())).toBe('chevronDown');
    expect(glyphs(await single('trigger="Details" chevron-position="start"'))).toBe('chevronRight');
  });

  it('gives the label the rest of the row when the chevron leads', async () => {
    const element = await single('trigger="Details" chevron-position="start"');
    const label = trigger(element).querySelector('.label')!;
    expect(getComputedStyle(label).flexGrow).toBe('1');
  });

  it('a leading chevron turns a quarter when open, and the other way in RTL', async () => {
    const element = await single('trigger="Details" chevron-position="start" open');
    await nextFrame();
    await nextFrame();
    expect(getComputedStyle(chevron(element)).rotate).toBe('90deg');
    const rtl = await make(
      '<div dir="rtl"><tct-collapsible trigger="D" chevron-position="start" open></tct-collapsible></div>',
    );
    void rtl;
    const inRtl = document.querySelector<TctCollapsible>('[dir="rtl"] tct-collapsible')!;
    await nextFrame();
    await nextFrame();
    expect(getComputedStyle(chevron(inRtl)).rotate).toBe('-90deg');
  });
});

describe('tct-collapsible: find in page', () => {
  it('opens when the browser reveals a match inside collapsed content (beforematch)', async () => {
    const element = await single();
    const recorder = recordEvents(element, ['tct-open-change', 'tct-after-open-change']);
    content(element).dispatchEvent(new Event('beforematch', {bubbles: true}));
    await element.updateComplete;
    expect(element.open).toBe(true);
    // Not vetoable: the browser reveals regardless, so only the commit event fires.
    expectEventCounts(recorder, {'tct-open-change': 0, 'tct-after-open-change': 1});
  });

  it.skipIf(!features.hiddenUntilFound)(
    'a real browser reveal (fragment navigation into slotted content) opens the item',
    async () => {
      const element = await single('trigger="Details"', '<p id="target">needle</p>');
      expect(element.open).toBe(false);
      location.hash = '#target';
      try {
        await waitUntil(() => element.open);
      } finally {
        history.replaceState(null, '', location.pathname + location.search);
      }
      expect(expanded(element)).toBe('true');
    },
  );

  it('is plainly hidden where hidden="until-found" is unsupported', async () => {
    const restore = forceFeatures({hiddenUntilFound: false});
    try {
      const element = await single();
      expect(content(element).getAttribute('hidden')).toBe('');
    } finally {
      restore();
    }
  });
});

// ------------------------------------------------------------------------------------- group

describe('tct-collapsible-group: single mode', () => {
  it('opens the item matching the value attribute and closes the rest', async () => {
    const group = await accordion('value="b"');
    expect(items(group).map(expanded)).toEqual(['false', 'true', 'false']);
    expect(group.value).toBe('b');
  });

  it('opening one item closes the previously open item; clicking the open item closes it', async () => {
    const group = await accordion('value="a"');
    await userEvent.click(trigger(items(group)[1]!));
    expect(items(group).map(expanded)).toEqual(['false', 'true', 'false']);
    await userEvent.click(trigger(items(group)[1]!));
    expect(items(group).map(expanded)).toEqual(['false', 'false', 'false']);
    expect(group.value).toBe('');
  });

  it('fires the cancelable tct-value-change with the requested value before it changes', async () => {
    const group = await accordion('value="a"');
    const recorder = recordEvents(group, ['tct-value-change']);
    const own = recordEvents(items(group)[1]!, ['tct-open-change']);
    let atIntent: string | string[] | undefined;
    group.addEventListener('tct-value-change', () => {
      atIntent = group.value;
    });
    await userEvent.click(trigger(items(group)[1]!));
    expect(atIntent).toBe('a');
    expect(recorder.events).toHaveLength(1);
    expect(recorder.events[0]!.value).toBe('b');
    expectEventFlags(recorder.events[0]!, {bubbles: true, composed: true, cancelable: true});
    // Inside a group the group decides: the item fires no event of its own.
    expect(own.events).toEqual([]);
  });

  it('preventDefault() keeps the group state (controlled use), and a property write applies it', async () => {
    const group = await accordion('value="a"');
    group.addEventListener('tct-value-change', (event) => {
      event.preventDefault();
    });
    await userEvent.click(trigger(items(group)[1]!));
    expect(items(group).map(expanded)).toEqual(['true', 'false', 'false']);
    group.value = 'c';
    await group.updateComplete;
    await nextFrame();
    expect(items(group).map(expanded)).toEqual(['false', 'false', 'true']);
  });

  it('property writes fire no events', async () => {
    const group = await accordion();
    const recorder = recordEvents(group, ['tct-value-change', 'change', 'input']);
    group.value = 'a';
    await group.updateComplete;
    expect(recorder.events).toEqual([]);
  });

  it('items after the first are toggled independently of a group when they have no value', async () => {
    const group = await make<TctCollapsibleGroup>(
      '<tct-collapsible-group><tct-collapsible trigger="Own">x</tct-collapsible></tct-collapsible-group>',
    );
    const item = items(group)[0]!;
    await userEvent.click(trigger(item));
    expect(item.open).toBe(true);
  });
});

describe('tct-collapsible-group: multiple mode', () => {
  it('allows several items open at once and reports the full array', async () => {
    const group = await accordion('type="multiple"');
    const recorder = recordEvents(group, ['tct-value-change']);
    await userEvent.click(trigger(items(group)[0]!));
    await userEvent.click(trigger(items(group)[2]!));
    expect(items(group).map(expanded)).toEqual(['true', 'false', 'true']);
    expect(group.value).toEqual(['a', 'c']);
    expect(recorder.events.map((event) => event.value)).toEqual([['a'], ['a', 'c']]);
  });

  it('opens several items by default from a space separated value', async () => {
    const group = await accordion('type="multiple" value="a c"');
    expect(items(group).map(expanded)).toEqual(['true', 'false', 'true']);
  });

  it('accepts an array property', async () => {
    const group = await accordion('type="multiple"');
    group.value = ['b', 'c'];
    await group.updateComplete;
    await nextFrame();
    expect(items(group).map(expanded)).toEqual(['false', 'true', 'true']);
  });
});

describe('tct-collapsible-group: presentation', () => {
  it('draws no wrapper box without dividers (display: contents)', async () => {
    const group = await accordion();
    expect(getComputedStyle(group).display).toBe('contents');
  });

  it('with dividers: a flex column, balanced density and a hairline above every item but the first', async () => {
    const group = await accordion('has-dividers');
    expect(getComputedStyle(group).display).toBe('flex');
    const [first, second] = items(group);
    expect(trigger(first!).dataset.density).toBe('balanced');
    const border = (item: Element): string =>
      getComputedStyle(item.shadowRoot!.querySelector('.collapsible')!).borderBlockStartWidth;
    expect(border(first!)).toBe('0px');
    expect(border(second!)).toBe('1px');
  });

  it('an explicit density wins, and applies without dividers', async () => {
    const group = await accordion('density="compact"');
    expect(trigger(items(group)[0]!).dataset.density).toBe('compact');
    expect(getComputedStyle(group).display).toBe('contents');
    const dividers = await accordion('has-dividers density="spacious"');
    expect(trigger(items(dividers)[0]!).dataset.density).toBe('spacious');
  });

  it('items keep no chrome without a group, and without dividers', async () => {
    const standalone = await single();
    expect(trigger(standalone).dataset.density).toBeUndefined();
    const group = await accordion();
    expect(
      items(group)[1]!.shadowRoot!.querySelector('.collapsible')!.hasAttribute('data-divided'),
    ).toBe(false);
  });

  it('takes the chevron position from the group, and an item overrides it', async () => {
    const group = await accordion('chevron-position="start"');
    expect(chevron(items(group)[0]!).dataset.position).toBe('start');
    items(group)[1]!.chevronPosition = 'end';
    await items(group)[1]!.updateComplete;
    expect(chevron(items(group)[1]!).dataset.position).toBe('end');
  });

  it('does not leak group chrome or chevron position into a nested collapsible', async () => {
    const group = await make<TctCollapsibleGroup>(
      '<tct-collapsible-group has-dividers chevron-position="start"><tct-collapsible value="outer" trigger="Outer" open><tct-collapsible id="inner" trigger="Inner" open>x</tct-collapsible></tct-collapsible></tct-collapsible-group>',
    );
    const inner = group.querySelector<TctCollapsible>('#inner')!;
    await inner.updateComplete;
    await nextFrame();
    expect(chevron(inner).dataset.position).toBe('end');
    expect(trigger(inner).dataset.density).toBeUndefined();
  });

  it('a nested item with a value still coordinates through the group', async () => {
    const group = await make<TctCollapsibleGroup>(
      '<tct-collapsible-group type="multiple" value="outer"><tct-collapsible value="outer" trigger="Outer"><tct-collapsible id="inner" value="inner" trigger="Inner">x</tct-collapsible></tct-collapsible></tct-collapsible-group>',
    );
    const inner = group.querySelector<TctCollapsible>('#inner')!;
    await userEvent.click(trigger(inner));
    expect(group.value).toEqual(['outer', 'inner']);
  });

  it('works with items inside other content (a card around each item)', async () => {
    const group = await make<TctCollapsibleGroup>(
      '<tct-collapsible-group value="a"><div><tct-collapsible value="a" trigger="A">a</tct-collapsible></div><div><tct-collapsible value="b" trigger="B">b</tct-collapsible></div></tct-collapsible-group>',
    );
    await userEvent.click(trigger(items(group)[1]!));
    expect(items(group).map(expanded)).toEqual(['false', 'true']);
  });
});

// --------------------------------------------------------------------------------- keyboard

const parity = Object.values(
  import.meta.glob<{entries: Record<string, {keyboard: KeyboardRow[]}>}>('./parity.json', {
    eager: true,
    import: 'default',
  }),
)[0]!;

runKeyboardSuite({
  tag: 'tct-collapsible',
  render: () =>
    `<tct-collapsible trigger="Details"><button id="inside">inside</button></tct-collapsible>`,
  table: parity.entries['core.collapsible']!.keyboard,
  steps: {
    'Toggles the region; the trigger keeps focus': {
      focus: (element) => trigger(element),
      keys: ['Enter'],
      expect: ({element}) => {
        expect((element as TctCollapsible).open).toBe(true);
        expect(deepActiveElement()).toBe(trigger(element));
      },
    },
    'Toggles the region, like Enter': {
      focus: (element) => trigger(element),
      keys: [' '],
      expect: ({element}) => {
        expect((element as TctCollapsible).open).toBe(true);
      },
    },
    'Moves into the content when open and past the trigger when collapsed; a disabled trigger is skipped':
      {
        setup: (element) => {
          (element as TctCollapsible).open = true;
        },
        focus: (element) => trigger(element),
        keys: ['Tab'],
        expect: () => {
          expect(deepActiveElement()?.id).toBe('inside');
        },
      },
  },
});

describe('tct-collapsible: RTL and forced colours', () => {
  it('puts a trailing chevron at the inline end in both directions', async () => {
    await make('<div dir="rtl"><tct-collapsible trigger="Details"></tct-collapsible></div>');
    const element = document.querySelector<TctCollapsible>('[dir="rtl"] tct-collapsible')!;
    const label = trigger(element).querySelector('.label')!.getBoundingClientRect();
    expect(chevron(element).getBoundingClientRect().right).toBeLessThan(label.left + 1);
  });

  it('renders under forced colours and stays accessible', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await single('trigger="Details" open');
    expect(getComputedStyle(trigger(element)).outlineStyle).toBeDefined();
    await expectAccessible(element);
  });

  it('the focus ring is drawn on the trigger', async () => {
    const element = await single();
    await pressKeys('Tab');
    trigger(element).focus();
    await pressKeys('Shift+Tab', 'Tab');
    expect(getComputedStyle(trigger(element)).outlineStyle).not.toBe('none');
  });
});
