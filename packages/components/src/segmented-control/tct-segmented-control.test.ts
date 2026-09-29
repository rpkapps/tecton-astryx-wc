/**
 * `tct-segmented-control` and `tct-segmented-control-item`: the radio group model (selection follows
 * focus, Tab never selects), the form contract when named, the disabled reason, sizes and layout, the
 * keyboard hint, RTL and forced colours. Test names follow upstream `SegmentedControl.test.tsx`.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {beforeAll, describe, expect, it} from 'vitest';
import {axNode} from '@tecton-astryx/testing/a11y.js';
import {expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {expectEventCounts, recordEvents} from '@tecton-astryx/testing/events.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {formHarness} from '@tecton-astryx/testing/forms.js';
import {deepActiveElement, pressKeys, tabSequence} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-astryx/testing/suites/form-control.js';
import {runKeyboardSuite} from '@tecton-astryx/testing/suites/keyboard.js';
import {nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import {defineElement} from '@tecton-astryx/core/define.js';
import {TctIcon} from '../icon/tct-icon.js';
import type {KeyboardRow} from '@tecton-astryx/testing/suites/keyboard.js';
import './define.js';
import type {TctSegmentedControl} from './tct-segmented-control.js';
import type {TctSegmentedControlItem} from './tct-segmented-control-item.js';

beforeAll(() => {
  defineElement(TctIcon);
});

const ITEMS =
  '<tct-segmented-control-item value="grid" label="Grid"></tct-segmented-control-item>' +
  '<tct-segmented-control-item value="list" label="List"></tct-segmented-control-item>' +
  '<tct-segmented-control-item value="table" label="Table"></tct-segmented-control-item>';

async function control(
  attributes = 'label="View mode" value="grid"',
  inner = ITEMS,
  wrapperAttributes = '',
): Promise<TctSegmentedControl> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div ${wrapperAttributes} style="width: 480px"><button id="before">before</button>` +
      `<tct-segmented-control ${attributes}>${inner}</tct-segmented-control><button id="after">after</button></div>`,
  );
  const element = wrapper.querySelector('tct-segmented-control')!;
  await element.updateComplete;
  await nextFrame();
  return element;
}

const items = (element: Element): TctSegmentedControlItem[] =>
  [...element.children] as TctSegmentedControlItem[];
const item = (element: Element, value: string): TctSegmentedControlItem =>
  items(element).find((candidate) => candidate.value === value)!;
const focused = (): string => (deepActiveElement() as TctSegmentedControlItem | null)?.value ?? '';
const tabindexes = (element: Element): (string | null)[] =>
  items(element).map((candidate) => candidate.getAttribute('tabindex'));
const radiogroup = (element: TctSegmentedControl): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[role="radiogroup"]')!;

// -------------------------------------------------------------------------------- element suite

runElementSuite({
  tag: 'tct-segmented-control',
  render: () =>
    html`<tct-segmented-control label="View mode" value="grid"
      ><tct-segmented-control-item value="grid" label="Grid"></tct-segmented-control-item
      ><tct-segmented-control-item value="list" label="List"></tct-segmented-control-item
    ></tct-segmented-control>`,
  properties: {size: 'lg', layout: 'fill', disabledMessage: 'Not now', name: 'view', value: 'list'},
  attributes: {size: 'size', layout: 'layout', name: 'name'},
});

runElementSuite({
  tag: 'tct-segmented-control-item',
  render: () =>
    html`<tct-segmented-control label="View mode" value="a"
      ><tct-segmented-control-item id="under-test" value="a" label="A"></tct-segmented-control-item
    ></tct-segmented-control>`,
  properties: {value: 'b', label: 'B', labelHidden: true, disabled: true},
  attributes: {value: 'value', label: 'label'},
  skip: ['a11y', 'hostBox'],
});

// ------------------------------------------------------------------------------ rendering (upstream)

describe('tct-segmented-control: rendering', () => {
  it('renders a radiogroup named by label, with a radio per item', async () => {
    const element = await control();
    expect(await axNode(radiogroup(element))).toMatchObject({
      role: 'radiogroup',
      name: 'View mode',
    });
    const grid = await axNode(item(element, 'grid'));
    expect(grid).toMatchObject({role: 'radio', name: 'Grid', checked: 'true'});
    expect(await axNode(item(element, 'list'))).toMatchObject({role: 'radio', checked: 'false'});
  });

  it('updates aria-checked when value changes', async () => {
    const element = await control();
    element.value = 'list';
    await element.updateComplete;
    await nextFrame();
    expect((await axNode(item(element, 'grid'))).checked).toBe('false');
    expect((await axNode(item(element, 'list'))).checked).toBe('true');
    expect(item(element, 'list').matches(':state(selected)')).toBe(true);
  });

  it('the value attribute is the initial selection and the property follows until set', async () => {
    const element = await control('label="View mode" value="list"');
    expect(element.value).toBe('list');
    expect(element.defaultValue).toBe('list');
    element.value = 'table';
    element.setAttribute('value', 'grid');
    expect(element.value).toBe('table');
  });

  it('renders with different sizes', async () => {
    const heights: number[] = [];
    for (const size of ['sm', 'md', 'lg']) {
      const element = await control(`label="View mode" value="grid" size="${size}"`);
      heights.push(item(element, 'grid').getBoundingClientRect().height);
    }
    expect(heights[0]).toBeLessThan(heights[1]!);
    expect(heights[1]).toBeLessThan(heights[2]!);
  });

  it('the size follows an enclosing provider, else md', async () => {
    const element = await control();
    expect(radiogroup(element).dataset.size).toBe('md');
    element.size = 'sm';
    await element.updateComplete;
    expect(radiogroup(element).dataset.size).toBe('sm');
  });

  it('renders an item with an icon', async () => {
    const element = await control(
      'label="View mode" value="grid"',
      '<tct-segmented-control-item value="grid" label="Grid"><tct-icon slot="icon" name="check"></tct-icon></tct-segmented-control-item>',
    );
    const icon = element.querySelector('tct-icon')!;
    expect(icon.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(await axNode(item(element, 'grid'))).toMatchObject({name: 'Grid'});
  });

  it('renders an icon-only item with its label as the accessible name', async () => {
    const element = await control(
      'label="View mode" value="grid"',
      '<tct-segmented-control-item value="grid" label="Grid" label-hidden><tct-icon slot="icon" name="check"></tct-icon></tct-segmented-control-item>',
    );
    const grid = item(element, 'grid');
    expect(grid.shadowRoot!.querySelector('.label')).toBeNull();
    expect(await axNode(grid)).toMatchObject({role: 'radio', name: 'Grid'});
  });

  it('keeps hug layout content-sized inside a stretching parent', async () => {
    const element = await control();
    expect(element.getBoundingClientRect().width).toBeLessThan(480);
  });

  it('fill layout stretches the control and shares the width equally', async () => {
    const element = await control('label="View mode" value="grid" layout="fill"');
    const width = element.getBoundingClientRect().width;
    expect(width).toBeGreaterThan(400);
    const widths = items(element).map((candidate) => candidate.getBoundingClientRect().width);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1.5);
  });

  it('fill items can shrink and truncate long labels', async () => {
    const element = await control(
      'label="View mode" value="a" layout="fill"',
      '<tct-segmented-control-item value="a" label="An extremely long label that cannot possibly fit into a narrow segment"></tct-segmented-control-item><tct-segmented-control-item value="b" label="B"></tct-segmented-control-item>',
      '',
    );
    element.parentElement!.style.width = '200px';
    await nextFrame();
    const label = items(element)[0]!.shadowRoot!.querySelector<HTMLElement>('.label')!;
    expect(getComputedStyle(label).overflow).toBe('hidden');
    expect(getComputedStyle(label).textOverflow).toBe('ellipsis');
    expect(element.getBoundingClientRect().width).toBeLessThanOrEqual(200);
  });

  it('promotes the first enabled item when the value matches no item and the first is disabled', async () => {
    const element = await control(
      'label="View mode" value="nonexistent"',
      '<tct-segmented-control-item value="grid" label="Grid" disabled></tct-segmented-control-item><tct-segmented-control-item value="list" label="List"></tct-segmented-control-item><tct-segmented-control-item value="table" label="Table"></tct-segmented-control-item>',
    );
    expect(tabindexes(element)).toEqual(['-1', '0', '-1']);
  });

  it('is axe clean: selected, disabled, with icons', async () => {
    for (const attributes of [
      'label="View mode" value="grid"',
      'label="View mode" value="grid" disabled',
      'label="View mode" disabled disabled-message="Choose a project first"',
    ]) {
      await expectAccessible(await control(attributes));
    }
  });
});

// -------------------------------------------------------------------------------- selection

describe('tct-segmented-control: selection and events', () => {
  it('a click selects the item and fires input then change once', async () => {
    const element = await control();
    const recorder = recordEvents(element, ['input', 'change']);
    await userEvent.click(item(element, 'list'));
    expect(element.value).toBe('list');
    expect(recorder.events.map((event) => event.type)).toEqual(['input', 'change']);
    for (const event of recorder.events) {
      expect(event.bubbles).toBe(true);
      expect(event.composed).toBe(true);
    }
  });

  it('does not fire when clicking the already-selected item', async () => {
    const element = await control();
    const recorder = recordEvents(element, ['input', 'change']);
    await userEvent.click(item(element, 'grid'));
    expectEventCounts(recorder, {input: 0, change: 0});
  });

  it('fires nothing for property and attribute writes', async () => {
    const element = await control();
    const recorder = recordEvents(element, ['input', 'change']);
    element.value = 'table';
    element.setAttribute('layout', 'fill');
    await element.updateComplete;
    expectEventCounts(recorder, {input: 0, change: 0});
  });

  it('calls a consumer click handler in addition to selecting', async () => {
    const element = await control();
    let clicks = 0;
    item(element, 'list').addEventListener('click', () => {
      clicks++;
    });
    await userEvent.click(item(element, 'list'));
    expect(clicks).toBe(1);
    expect(element.value).toBe('list');
  });

  it('lets a consumer click handler opt out of selection via preventDefault', async () => {
    const element = await control();
    // Registered before the control's own listener runs? The item listens first; prevent in capture.
    item(element, 'list').addEventListener('click', (event) => event.preventDefault(), {
      capture: true,
    });
    await userEvent.click(item(element, 'list'));
    expect(element.value).toBe('grid');
  });

  it('a disabled item cannot be selected by click', async () => {
    const element = await control(
      'label="View mode" value="grid"',
      '<tct-segmented-control-item value="grid" label="Grid"></tct-segmented-control-item><tct-segmented-control-item value="list" label="List" disabled></tct-segmented-control-item>',
    );
    const recorder = recordEvents(element, ['change']);
    item(element, 'list').click();
    expect(element.value).toBe('grid');
    expect(recorder.events).toEqual([]);
  });

  it('read-only blocks selection', async () => {
    const element = await control('label="View mode" value="grid" readonly');
    item(element, 'list').click();
    expect(element.value).toBe('grid');
  });
});

// ---------------------------------------------------------------------------- roving keyboard

describe('tct-segmented-control: keyboard', () => {
  it('the selected item is the single tab stop', async () => {
    const element = await control('label="View mode" value="list"');
    expect(tabindexes(element)).toEqual(['-1', '0', '-1']);
  });

  it('Tab enters on the selected item and leaves on the next Tab', async () => {
    const element = await control('label="View mode" value="list"');
    element.parentElement!.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(focused()).toBe('list');
    await pressKeys('Tab');
    expect(deepActiveElement()?.id).toBe('after');
  });

  describe('tab-through is a pure focus move (#3597)', () => {
    it('does not fire change when tabbing in with an unmatched value', async () => {
      const element = await control('label="View" value="archived"');
      const recorder = recordEvents(element, ['input', 'change']);
      element.parentElement!.querySelector<HTMLElement>('#before')!.focus();
      await pressKeys('Tab');
      expect(focused()).toBe('grid');
      expectEventCounts(recorder, {input: 0, change: 0});
      expect(element.value).toBe('archived');
    });

    it('does not fire change when tabbing in while the selected item is disabled', async () => {
      const element = await control(
        'label="View" value="list"',
        '<tct-segmented-control-item value="grid" label="Grid"></tct-segmented-control-item><tct-segmented-control-item value="list" label="List" disabled></tct-segmented-control-item>',
      );
      const recorder = recordEvents(element, ['input', 'change']);
      element.parentElement!.querySelector<HTMLElement>('#before')!.focus();
      await pressKeys('Tab');
      expectEventCounts(recorder, {input: 0, change: 0});
    });

    it('still selects on arrow-key navigation within the group', async () => {
      const element = await control();
      const recorder = recordEvents(element, ['input', 'change']);
      item(element, 'grid').focus();
      await pressKeys('ArrowRight');
      expect(element.value).toBe('list');
      expectEventCounts(recorder, {input: 1, change: 1});
    });
  });

  it('wraps around from last to first with ArrowRight and back with ArrowLeft', async () => {
    const element = await control('label="View" value="table"');
    item(element, 'table').focus();
    await pressKeys('ArrowRight');
    expect(focused()).toBe('grid');
    expect(element.value).toBe('grid');
    await pressKeys('ArrowLeft');
    expect(focused()).toBe('table');
    expect(element.value).toBe('table');
  });

  it('Home and End focus and select the first and last item', async () => {
    const element = await control('label="View" value="list"');
    item(element, 'list').focus();
    await pressKeys('End');
    expect(focused()).toBe('table');
    expect(element.value).toBe('table');
    await pressKeys('Home');
    expect(focused()).toBe('grid');
    expect(element.value).toBe('grid');
  });

  it('skips disabled items during keyboard navigation', async () => {
    const element = await control(
      'label="View" value="grid"',
      '<tct-segmented-control-item value="grid" label="Grid"></tct-segmented-control-item><tct-segmented-control-item value="list" label="List" disabled></tct-segmented-control-item><tct-segmented-control-item value="table" label="Table"></tct-segmented-control-item>',
    );
    item(element, 'grid').focus();
    await pressKeys('ArrowRight');
    expect(focused()).toBe('table');
    expect(element.value).toBe('table');
  });

  it('Space selects the focused item that is not yet selected', async () => {
    const element = await control();
    item(element, 'list').focus(); // programmatic focus: a pure focus move, no selection
    expect(element.value).toBe('grid');
    await pressKeys(' ');
    expect(element.value).toBe('list');
  });

  it('follows visual direction in RTL', async () => {
    const element = await control('label="View" value="grid"', ITEMS, 'dir="rtl"');
    item(element, 'grid').focus();
    await pressKeys('ArrowLeft');
    expect(focused()).toBe('list');
    await pressKeys('ArrowRight');
    expect(focused()).toBe('grid');
  });

  it('shows the keyboard hint once, on first keyboard entry, and never on a click', async () => {
    const element = await control();
    const hint = element.shadowRoot!.querySelector<HTMLElement>('[part="keyboard-hint"]')!;
    await userEvent.click(item(element, 'list'));
    await nextFrame();
    expect(hint.matches(':popover-open')).toBe(false);
    element.parentElement!.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    await waitUntil(() => hint.matches(':popover-open'));
    expect(hint.getAttribute('aria-hidden')).toBe('true');
    await pressKeys('ArrowRight');
    await waitUntil(() => !hint.matches(':popover-open'));
  });
});

// The keyboard table is the parity record's (tsconfig lists no JSON, so it is read through the bundler).
const parity = Object.values(
  import.meta.glob<{entries: Record<string, {keyboard: KeyboardRow[]}>}>('./parity.json', {
    eager: true,
    import: 'default',
  }),
)[0]!;
const keyboardRows = parity.entries['core.segmented-control']!.keyboard;

runKeyboardSuite({
  tag: 'tct-segmented-control',
  render: () =>
    `<tct-segmented-control label="View mode" value="list">${ITEMS}</tct-segmented-control>`,
  table: keyboardRows,
  steps: {
    'Enters the control at the selected segment (the first enabled one when nothing is selected) without changing the value; the next Tab leaves':
      {
        focus: (element) => (element.previousElementSibling as HTMLElement | null) ?? document.body,
        keys: ['Tab'],
        expect: ({element}) => {
          expect(focused()).toBe('list');
          expect((element as TctSegmentedControl).value).toBe('list');
        },
      },
    'Moves focus to the next enabled segment and selects it, wrapping after the last': {
      focus: (element) => item(element, 'table'),
      keys: ['ArrowRight'],
      rtl: {keys: ['ArrowLeft']},
      expect: ({element}) => {
        expect(focused()).toBe('grid');
        expect((element as TctSegmentedControl).value).toBe('grid');
      },
    },
    'Moves focus to the previous enabled segment and selects it, wrapping before the first': {
      focus: (element) => item(element, 'grid'),
      keys: ['ArrowLeft'],
      rtl: {keys: ['ArrowRight']},
      expect: ({element}) => {
        expect(focused()).toBe('table');
        expect((element as TctSegmentedControl).value).toBe('table');
      },
    },
    'Moves focus to the first enabled segment and selects it': {
      focus: (element) => item(element, 'table'),
      keys: ['Home'],
      expect: ({element}) => {
        expect(focused()).toBe('grid');
        expect((element as TctSegmentedControl).value).toBe('grid');
      },
    },
    'Moves focus to the last enabled segment and selects it': {
      focus: (element) => item(element, 'grid'),
      keys: ['End'],
      expect: ({element}) => {
        expect(focused()).toBe('table');
        expect((element as TctSegmentedControl).value).toBe('table');
      },
    },
    'Selects the focused segment': {
      focus: (element) => item(element, 'grid'),
      keys: [' '],
      expect: ({element}) => {
        expect((element as TctSegmentedControl).value).toBe('grid');
      },
    },
    'Selects the focused segment, like Space': {
      focus: (element) => item(element, 'grid'),
      keys: ['Enter'],
      expect: ({element}) => {
        expect((element as TctSegmentedControl).value).toBe('grid');
      },
    },
  },
});

// ---------------------------------------------------------------------------------- disabled

describe('tct-segmented-control: disabled', () => {
  it('does not change the value when the group is disabled', async () => {
    const element = await control('label="View" value="grid" disabled');
    const recorder = recordEvents(element, ['input', 'change']);
    item(element, 'list').click();
    expect(element.value).toBe('grid');
    expect(recorder.events).toEqual([]);
    expect(radiogroup(element).getAttribute('aria-disabled')).toBe('true');
    expect(element.matches(':state(disabled)')).toBe(true);
  });

  it('a disabled group is not a tab stop when it has no reason', async () => {
    const element = await control('label="View" value="grid" disabled');
    const stops = await tabSequence(element, {
      start: element.parentElement!.querySelector<HTMLElement>('#before')!,
    });
    expect(stops[0]?.id).toBe('after');
    expect(tabindexes(element)).toEqual(['-1', '-1', '-1']);
  });

  it('disables individual items', async () => {
    const element = await control(
      'label="View" value="grid"',
      '<tct-segmented-control-item value="grid" label="Grid"></tct-segmented-control-item><tct-segmented-control-item value="list" label="List" disabled></tct-segmented-control-item>',
    );
    expect((await axNode(item(element, 'list'))).disabled).toBe('true');
    expect(item(element, 'list').matches(':state(disabled)')).toBe(true);
  });

  describe('disabledMessage', () => {
    const message = 'Choose a project to switch views';
    const explained = (): Promise<TctSegmentedControl> =>
      control(`label="View mode" value="grid" disabled disabled-message="${message}"`);
    const tip = (element: TctSegmentedControl): HTMLElement =>
      element.shadowRoot!.querySelector<HTMLElement>('.disabled-message')!;

    it('describes the radiogroup with the reason', async () => {
      const element = await explained();
      expect(tip(element).textContent).toBe(message);
      expect(await axNode(radiogroup(element))).toMatchObject({description: message});
    });

    it('shows the reason tooltip on hover when the control is disabled with a reason', async () => {
      const element = await explained();
      await userEvent.hover(radiogroup(element));
      await waitUntil(() => tip(element).matches(':popover-open'));
      await userEvent.unhover(radiogroup(element));
      await waitUntil(() => !tip(element).matches(':popover-open'));
    });

    it('shows the reason tooltip on keyboard focus, and the selected segment is the tab stop', async () => {
      const element = await explained();
      expect(tabindexes(element)).toEqual(['0', '-1', '-1']);
      element.parentElement!.querySelector<HTMLElement>('#before')!.focus();
      await pressKeys('Tab');
      expect(focused()).toBe('grid');
      await waitUntil(() => tip(element).matches(':popover-open'));
    });

    it('does not describe or show a tooltip when not disabled', async () => {
      const element = await control(`label="View mode" value="grid" disabled-message="${message}"`);
      expect(radiogroup(element).getAttribute('aria-describedby')).toBeNull();
      expect(tip(element).textContent.trim()).toBe('');
    });

    it('does not render a tooltip when disabled without a reason', async () => {
      const element = await control('label="View mode" value="grid" disabled');
      expect(radiogroup(element).getAttribute('aria-describedby')).toBeNull();
    });

    it('blocks selection while focusable-disabled', async () => {
      const element = await explained();
      const recorder = recordEvents(element, ['change']);
      item(element, 'list').click();
      await pressKeys('Tab');
      expect(element.value).toBe('grid');
      expect(recorder.events).toEqual([]);
    });
  });
});

// ------------------------------------------------------------------------------------- form

runFormControlSuite({
  tag: 'tct-segmented-control',
  render: (attributes) =>
    `<tct-segmented-control label="View mode" ${attributes}>${ITEMS}</tct-segmented-control>`,
  validValue: 'list',
  readonly: true,
  userEdit: async (element) => {
    const target = element.querySelector<HTMLElement>('[value="list"]')!;
    await userEvent.click(target);
  },
});

describe('tct-segmented-control: form details', () => {
  it('submits the selected value under its name and nothing when empty', async () => {
    const form = await formHarness(
      `<tct-segmented-control name="view" label="View mode" value="table">${ITEMS}</tct-segmented-control>`,
    );
    expect(form.values('view')).toEqual(['table']);
    const control = form.form.querySelector<TctSegmentedControl>('tct-segmented-control')!;
    control.value = '';
    await control.updateComplete;
    expect(form.entries()).toEqual([]);
  });

  it('reset returns to the value attribute', async () => {
    const form = await formHarness(
      `<tct-segmented-control name="view" label="View mode" value="grid">${ITEMS}</tct-segmented-control>`,
    );
    const control = form.form.querySelector<TctSegmentedControl>('tct-segmented-control')!;
    await userEvent.click(item(control, 'table'));
    expect(form.values('view')).toEqual(['table']);
    form.reset();
    await control.updateComplete;
    expect(control.value).toBe('grid');
  });
});

// --------------------------------------------------------------------- RTL, forced colours

describe('tct-segmented-control: RTL and forced colours', () => {
  it('lays segments out from the inline start in RTL', async () => {
    const element = await control('label="View" value="grid"', ITEMS, 'dir="rtl"');
    const [first, second] = items(element).map((candidate) => candidate.getBoundingClientRect());
    expect(first!.left).toBeGreaterThan(second!.left);
  });

  it('renders under forced colours: the selected segment uses Highlight and focus stays visible', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await control();
    const painted = item(element, 'grid').shadowRoot!.querySelector<HTMLElement>('.item')!;
    expect(getComputedStyle(painted).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    item(element, 'grid').focus();
    await pressKeys('Shift+Tab');
    await pressKeys('Tab');
    expect(getComputedStyle(painted).outlineStyle).not.toBe('none');
    // The keyboard hint fades in on the first keyboard focus: axe must not sample it mid-fade.
    await waitUntil(
      () =>
        element.shadowRoot!.querySelectorAll('.keyboard-hint').length === 0 ||
        getComputedStyle(element.shadowRoot!.querySelector('.keyboard-hint')!).opacity === '1',
      'keyboard hint settled',
    );
    await expectAccessible(element);
  });
});
