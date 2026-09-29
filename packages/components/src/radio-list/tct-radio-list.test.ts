/**
 * tct-radio-list and its items: the element and form-control suites, then semantics (radiogroup and radios),
 * choosing (pointer, row, keyboard), the single tab stop and arrow keys in both text directions, disabled and
 * read-only, required (a blocked submit focuses the first option), status, the group disabled reason,
 * descriptions and end content, layout and RTL. Ported from upstream RadioList.test.tsx where the
 * behaviour applies.
 */
import {html} from 'lit';
import {page, userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {recordEvents} from '@tecton-astryx/testing/events.js';
import {deepQueryAll, fixture} from '@tecton-astryx/testing/fixture.js';
import {formHarness, hasCustomState} from '@tecton-astryx/testing/forms.js';
import {pressKeys, tabSequence} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-astryx/testing/suites/form-control.js';
import {isChromium, isTier2} from '@tecton-astryx/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-astryx/testing/timing.js';
import '../field/define.js';
import '../form-layout/define.js';
import '../tooltip/define.js';
import './define.js';
import type {TctRadioList} from './tct-radio-list.js';
import type {TctRadioListItem} from './tct-radio-list-item.js';

const items = (list: TctRadioList): TctRadioListItem[] => [
  ...list.querySelectorAll<TctRadioListItem>('tct-radio-list-item'),
];
const radioOf = (item: TctRadioListItem): HTMLElement => item.focusTarget!;
const groupOf = (list: TctRadioList): HTMLElement =>
  list.shadowRoot!.querySelector<HTMLElement>('[part="group"]')!;

async function motionDone(element: Element): Promise<void> {
  await nextFrame();
  const running = deepQueryAll(element.parentElement ?? element, () => true)
    .flatMap((node) => node.getAnimations())
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
  await Promise.allSettled(running.map((animation) => animation.finished));
}

const OPTIONS = `
  <tct-radio-list-item label="Small" value="s"></tct-radio-list-item>
  <tct-radio-list-item label="Medium" value="m"></tct-radio-list-item>
  <tct-radio-list-item label="Large" value="l"></tct-radio-list-item>`;

async function make(attributes = 'label="Size"', body = OPTIONS): Promise<TctRadioList> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:24px;inline-size:420px"><tct-radio-list ${attributes}>${body}</tct-radio-list></div>`,
  );
  const list = wrapper.querySelector<TctRadioList>('tct-radio-list')!;
  await list.updateComplete;
  await Promise.all(items(list).map((item) => item.updateComplete));
  await nextFrame();
  return list;
}

runElementSuite({
  tag: 'tct-radio-list',
  render: () =>
    html`<tct-radio-list label="Size" name="size"
      ><tct-radio-list-item label="Small" value="s"></tct-radio-list-item
    ></tct-radio-list>`,
  properties: {
    label: 'Other',
    description: 'Help',
    orientation: 'horizontal',
    size: 'sm',
    value: 's',
    width: 300,
  },
  attributes: {
    label: 'label',
    description: 'description',
    orientation: 'orientation',
    size: 'size',
  },
});

runElementSuite({
  tag: 'tct-radio-list-item',
  render: () => html`<tct-radio-list-item label="Small" value="s"></tct-radio-list-item>`,
  properties: {label: 'Other', value: 'x', description: 'Help', disabled: true},
  attributes: {label: 'label', value: 'value', description: 'description'},
  a11y: false,
});

runFormControlSuite({
  tag: 'tct-radio-list',
  render: (attributes) =>
    `<tct-radio-list ${attributes}><tct-radio-list-item label="A" value="a"></tct-radio-list-item><tct-radio-list-item label="B" value="b"></tct-radio-list-item></tct-radio-list>`,
  validValue: 'a',
  labelActivation: 'focus',
  // The blocked submit focuses the first option's radio, two shadow roots down (asserted below); the
  // suite's containment check only looks at one level.
  anchorFocus: false,
  readonly: true,
  innerFocusable: (element) => element.shadowRoot!.querySelector<HTMLElement>('[part="group"]'),
  userEdit: async (element) => {
    await userEvent.click(
      (element as unknown as TctRadioList).querySelector<TctRadioListItem>('tct-radio-list-item')!
        .focusTarget!,
    );
  },
});

describe('tct-radio-list: semantics (RadioList.test.tsx)', () => {
  it('is a radiogroup named by its label and described by its description, with named radios', async () => {
    const list = await make('label="Size" description="Pick one"');
    expect(groupOf(list).getAttribute('role')).toBe('radiogroup');
    expect(items(list)).toHaveLength(3);
    if (!isChromium) return;
    const group = await axNode(groupOf(list));
    expect(group.role).toBe('radiogroup');
    expect(group.name).toBe('Size');
    expect(group.description).toContain('Pick one');
    const radio = await axNode(radioOf(items(list)[1]!));
    expect(radio.role).toBe('radio');
    expect(radio.name).toBe('Medium');
    expect(radio.checked).toBe('false');
  });

  it('the host and its options carry no role and no tabindex: the radio is the one focusable control', async () => {
    const list = await make();
    expect(list.hasAttribute('role')).toBe(false);
    for (const item of items(list)) expect(item.hasAttribute('tabindex')).toBe(false);
  });

  it('value is the chosen option: the attribute is the default, the property the current choice', async () => {
    const list = await make('label="Size" value="m"');
    expect(list.value).toBe('m');
    expect(items(list)[1]!.checked).toBe(true);
    expect(radioOf(items(list)[1]!).getAttribute('aria-checked')).toBe('true');
    expect(radioOf(items(list)[0]!).getAttribute('aria-checked')).toBe('false');
    list.value = 'l';
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    expect(radioOf(items(list)[2]!).getAttribute('aria-checked')).toBe('true');
    expect(list.getAttribute('value')).toBe('m');
    expect(list.defaultValue).toBe('m');
  });
});

describe('tct-radio-list: choosing', () => {
  it('a click on a radio chooses it and fires input then change once each; setting value fires nothing', async () => {
    const list = await make();
    const events = recordEvents(list, ['input', 'change']);
    await userEvent.click(radioOf(items(list)[1]!));
    expect(list.value).toBe('m');
    expect(events.events.map((event) => event.type)).toEqual(['input', 'change']);
    expect(events.events.every((event) => event.bubbles && event.composed)).toBe(true);
    // Choosing the chosen one again is a no-op.
    await userEvent.click(radioOf(items(list)[1]!));
    expect(events.events).toHaveLength(2);
    await userEvent.click(radioOf(items(list)[2]!));
    expect(list.value).toBe('l');
    expect(events.events).toHaveLength(4);
    list.value = 's';
    await list.updateComplete;
    expect(events.events).toHaveLength(4);
  });

  it('a click on the label text or the empty end of the row chooses the option (the row is the click target)', async () => {
    const list = await make();
    const row = items(list)[0]!;
    const rect = row.getBoundingClientRect();
    await userEvent.click(row, {position: {x: rect.width - 8, y: rect.height / 2}});
    expect(list.value).toBe('s');
    await userEvent.click(items(list)[2]!.shadowRoot!.querySelector('[slot="label"]')!);
    expect(list.value).toBe('l');
  });

  it('a click that is cancelled keeps the old choice (a controlled list re-asserts value)', async () => {
    const list = await make('label="Size" value="s"');
    list.addEventListener('change', () => {
      list.value = 's';
    });
    await userEvent.click(radioOf(items(list)[1]!));
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    expect(radioOf(items(list)[0]!).getAttribute('aria-checked')).toBe('true');
    expect(radioOf(items(list)[1]!).getAttribute('aria-checked')).toBe('false');
  });

  it('exposes one checked radio at a time in the accessibility tree', async () => {
    const list = await make('label="Size" value="m"');
    if (!isChromium) return;
    expect((await axNode(radioOf(items(list)[1]!))).checked).toBe('true');
    await userEvent.click(radioOf(items(list)[0]!));
    expect((await axNode(radioOf(items(list)[0]!))).checked).toBe('true');
    expect((await axNode(radioOf(items(list)[1]!))).checked).toBe('false');
  });
});

describe('tct-radio-list: keyboard, one tab stop', () => {
  const stops = (list: TctRadioList): (string | null)[] =>
    items(list).map((item) => radioOf(item).getAttribute('tabindex'));

  it('the chosen option is the only tab stop; with none chosen the first enabled one is', async () => {
    const list = await make('label="Size" value="m"');
    expect(stops(list)).toEqual(['-1', '0', '-1']);
    const none = await make(
      'label="Size"',
      `<tct-radio-list-item label="A" value="a" disabled></tct-radio-list-item><tct-radio-list-item label="B" value="b"></tct-radio-list-item><tct-radio-list-item label="C" value="c"></tct-radio-list-item>`,
    );
    expect(stops(none)).toEqual(['-1', '0', '-1']);
  });

  it('Tab enters the group on the chosen option and leaves it in one press', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><button id="before">before</button><tct-radio-list label="Size" value="m">${OPTIONS}</tct-radio-list><button id="after">after</button></div>`,
    );
    const list = wrapper.querySelector<TctRadioList>('tct-radio-list')!;
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    await nextFrame();
    const visited = await tabSequence(wrapper, {
      start: wrapper.querySelector<HTMLElement>('#before')!,
      max: 4,
    });
    expect(visited[0]).toBe(radioOf(items(list)[1]!));
    expect(visited[1]).toBe(wrapper.querySelector('#after'));
  });

  it('arrow keys move focus and choose the next and previous option, wrapping', async () => {
    const list = await make('label="Size" value="s"');
    const events = recordEvents(list, ['input', 'change']);
    radioOf(items(list)[0]!).focus();
    await pressKeys('ArrowDown');
    expect(list.value).toBe('m');
    expect(deepActiveElement()).toBe(radioOf(items(list)[1]!));
    await pressKeys('ArrowRight');
    expect(list.value).toBe('l');
    await pressKeys('ArrowDown');
    expect(list.value).toBe('s');
    await pressKeys('ArrowUp');
    expect(list.value).toBe('l');
    await pressKeys('ArrowLeft');
    expect(list.value).toBe('m');
    expect(events.events).toHaveLength(10);
    expect(stops(list)).toEqual(['-1', '0', '-1']);
  });

  it('arrow keys skip a disabled option', async () => {
    const list = await make(
      'label="Size" value="s"',
      `<tct-radio-list-item label="A" value="s"></tct-radio-list-item><tct-radio-list-item label="B" value="m" disabled></tct-radio-list-item><tct-radio-list-item label="C" value="l"></tct-radio-list-item>`,
    );
    radioOf(items(list)[0]!).focus();
    await pressKeys('ArrowDown');
    expect(list.value).toBe('l');
  });

  it('Space chooses the focused option, and Home and End do nothing (native radios have none)', async () => {
    const list = await make();
    radioOf(items(list)[1]!).focus();
    await pressKeys(' ');
    expect(list.value).toBe('m');
    await pressKeys('End');
    expect(list.value).toBe('m');
    expect(deepActiveElement()).toBe(radioOf(items(list)[1]!));
  });

  it('mirrors Left and Right in right-to-left text', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div dir="rtl"><tct-radio-list label="Size" orientation="horizontal" value="m">${OPTIONS}</tct-radio-list></div>`,
    );
    const list = wrapper.querySelector<TctRadioList>('tct-radio-list')!;
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    await nextFrame();
    radioOf(items(list)[1]!).focus();
    // Visually left is the next option in RTL.
    await pressKeys('ArrowLeft');
    expect(list.value).toBe('l');
    await pressKeys('ArrowRight');
    expect(list.value).toBe('m');
    // The first option sits at the right edge.
    expect(items(list)[0]!.getBoundingClientRect().left).toBeGreaterThan(
      items(list)[2]!.getBoundingClientRect().left,
    );
  });

  it('a link in the end content is tabbable and its keys do not move the radios', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><tct-radio-list label="Plan" value="a"><tct-radio-list-item label="A" value="a"><a slot="end" href="#a">Details</a></tct-radio-list-item><tct-radio-list-item label="B" value="b"><a slot="end" href="#b">Details</a></tct-radio-list-item></tct-radio-list></div>`,
    );
    const list = wrapper.querySelector<TctRadioList>('tct-radio-list')!;
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    await nextFrame();
    radioOf(items(list)[0]!).focus();
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(items(list)[0]!.querySelector('a'));
    await pressKeys('ArrowDown');
    expect(list.value).toBe('a');
    // The other radios are not tab stops: the next Tab reaches the second link.
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(items(list)[1]!.querySelector('a'));
  });

  it('focus() focuses the tab stop and an external label click focuses it too', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><label for="rl">Outside label</label><tct-radio-list id="rl" value="m">${OPTIONS}</tct-radio-list></div>`,
    );
    const list = wrapper.querySelector<TctRadioList>('tct-radio-list')!;
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    await nextFrame();
    list.focus();
    expect(deepActiveElement()).toBe(radioOf(items(list)[1]!));
    (deepActiveElement() as HTMLElement).blur();
    await userEvent.click(wrapper.querySelector('label')!);
    expect(deepActiveElement()).toBe(radioOf(items(list)[1]!));
  });
});

describe('tct-radio-list: disabled and read-only', () => {
  it('a disabled list disables every option and chooses nothing', async () => {
    const list = await make('label="Size" disabled');
    for (const item of items(list)) {
      expect(radioOf(item).getAttribute('aria-disabled')).toBe('true');
    }
    const events = recordEvents(list, ['input', 'change']);
    radioOf(items(list)[0]!).click();
    expect(list.value).toBe('');
    expect(events.events).toHaveLength(0);
    if (!isTier2) expect(hasCustomState(items(list)[0]!, 'disabled')).toBe(true);
  });

  it('a disabled option cannot be chosen and the others can', async () => {
    const list = await make(
      'label="Size"',
      `<tct-radio-list-item label="A" value="a" disabled></tct-radio-list-item><tct-radio-list-item label="B" value="b"></tct-radio-list-item>`,
    );
    radioOf(items(list)[0]!).click();
    expect(list.value).toBe('');
    await userEvent.click(radioOf(items(list)[1]!));
    expect(list.value).toBe('b');
  });

  it('read-only shows the choice at full strength and blocks changes, arrow keys included', async () => {
    const list = await make('label="Size" value="m" readonly');
    const events = recordEvents(list, ['input', 'change']);
    await userEvent.click(radioOf(items(list)[0]!));
    radioOf(items(list)[1]!).focus();
    await pressKeys('ArrowDown');
    expect(list.value).toBe('m');
    expect(events.events).toHaveLength(0);
    expect(groupOf(list).getAttribute('aria-readonly')).toBe('true');
  });

  it('with a disabled-message the options stay focusable and the group carries the reason', async () => {
    const list = await make(
      'label="Size" disabled disabled-message="Locked by your admin" value="m"',
    );
    const radio = radioOf(items(list)[0]!);
    expect(radio.getAttribute('aria-disabled')).toBe('true');
    radio.focus();
    expect(deepActiveElement()).toBe(radio);
    const events = recordEvents(list, ['input', 'change']);
    await pressKeys('ArrowDown');
    radio.click();
    expect(list.value).toBe('m');
    expect(events.events).toHaveLength(0);
    const reason = list.shadowRoot!.querySelector<HTMLElement>('.visually-hidden')!;
    expect(reason.textContent).toBe('Locked by your admin');
    expect(groupOf(list).getAttribute('aria-describedby')!.split(' ')).toContain(reason.id);
    expect(list.shadowRoot!.querySelector('tct-tooltip')!.getAttribute('content')).toBe(
      'Locked by your admin',
    );
  });

  it('a disabled list with a reason submits nothing and does not block the form', async () => {
    const form = await formHarness(
      `<tct-radio-list label="Size" name="size" value="m" required disabled disabled-message="No">${OPTIONS}</tct-radio-list>`,
    );
    expect(form.entries()).toEqual([]);
    expect(form.form.checkValidity()).toBe(true);
  });
});

describe('tct-radio-list: form participation and required (acceptance)', () => {
  it('submits name=value of the chosen option, nothing while none is chosen, and resets to the value attribute', async () => {
    const form = await formHarness(
      `<tct-radio-list label="Size" name="size" value="m">${OPTIONS}</tct-radio-list>`,
    );
    const list = form.form.querySelector<TctRadioList>('tct-radio-list')!;
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    expect(form.entries()).toEqual([['size', 'm']]);
    await userEvent.click(radioOf(items(list)[2]!));
    expect(form.entries()).toEqual([['size', 'l']]);
    form.reset();
    await list.updateComplete;
    expect(form.entries()).toEqual([['size', 'm']]);
    expect(radioOf(items(list)[1]!).getAttribute('aria-checked')).toBe('true');
  });

  it('required with nothing chosen blocks the submit and focuses the first radio; the error shows only then', async () => {
    const form = await formHarness(
      `<tct-radio-list label="Size" name="size" required>${OPTIONS}</tct-radio-list><button type="submit">Go</button>`,
    );
    const list = form.form.querySelector<TctRadioList>('tct-radio-list')!;
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    await nextFrame();
    expect(list.validity.valueMissing).toBe(true);
    expect(list.willValidate).toBe(true);
    expect(groupOf(list).hasAttribute('aria-invalid')).toBe(false);
    expect(groupOf(list).getAttribute('aria-required')).toBe('true');
    expect(list.shadowRoot!.querySelector('tct-field-status')).toBeNull();

    await userEvent.click(form.form.querySelector('button')!);
    await list.updateComplete;
    await nextFrame();
    expect(form.submitEvents).toHaveLength(0);
    expect(deepActiveElement()).toBe(radioOf(items(list)[0]!));
    expect(groupOf(list).getAttribute('aria-invalid')).toBe('true');
    if (!isTier2) expect(hasCustomState(list, 'user-invalid')).toBe(true);
    const status = list.shadowRoot!.querySelector<HTMLElement>('tct-field-status')!;
    expect(status.getAttribute('variant')).toBe('detached');
    expect(status.textContent.trim()).not.toBe('');

    await userEvent.click(radioOf(items(list)[1]!));
    await list.updateComplete;
    expect(list.validity.valid).toBe(true);
    expect(groupOf(list).hasAttribute('aria-invalid')).toBe(false);
  });

  it('a required list with a chosen option submits', async () => {
    const form = await formHarness(
      `<tct-radio-list label="Size" name="size" required value="s">${OPTIONS}</tct-radio-list><button type="submit">Go</button>`,
    );
    const list = form.form.querySelector<TctRadioList>('tct-radio-list')!;
    await list.updateComplete;
    await userEvent.click(form.form.querySelector('button')!);
    expect(form.submitEvents).toHaveLength(1);
  });

  it('restores a saved choice (restore and autocomplete)', async () => {
    const form = await formHarness(
      `<tct-radio-list label="Size" name="size">${OPTIONS}</tct-radio-list>`,
    );
    const list = form.form.querySelector<TctRadioList>('tct-radio-list')!;
    await list.updateComplete;
    list.formStateRestoreCallback('l', 'restore');
    await list.updateComplete;
    expect(form.entries()).toEqual([['size', 'l']]);
  });
});

describe('tct-radio-list: label, description, status and content', () => {
  it('shows the Required and Optional indicators as text, the info tip and the group label caption', async () => {
    const required = await make('label="Size" required');
    expect(required.shadowRoot!.querySelector('[part="label-indicator"]')!.textContent).toContain(
      'Required',
    );
    const optional = await make('label="Size" optional label-tooltip="Choose the closest"');
    expect(optional.shadowRoot!.querySelector('[part="label-indicator"]')!.textContent).toContain(
      'Optional',
    );
    expect(optional.shadowRoot!.querySelector('[part="label-tip"]')).not.toBeNull();
    // A group caption, not a <label for>.
    expect(required.shadowRoot!.querySelector('[part="label"]')!.localName).toBe('span');
  });

  it('hides the label visually with label-hidden but keeps the group named', async () => {
    const list = await make('label="Size" label-hidden');
    expect(
      list.shadowRoot!.querySelector('[part="label"]')!.getBoundingClientRect().width,
    ).toBeLessThanOrEqual(1);
    if (isChromium) expect((await axNode(groupOf(list))).name).toBe('Size');
  });

  it('renders the status detached and describes the group by it; an error sets aria-invalid', async () => {
    const list = await make('label="Size" status-type="error" status-message="Pick a size"');
    const status = list.shadowRoot!.querySelector<HTMLElement>('tct-field-status')!;
    expect(status.getAttribute('variant')).toBe('detached');
    expect(status.textContent).toBe('Pick a size');
    expect(groupOf(list).getAttribute('aria-describedby')!.split(' ')).toContain(status.id);
    expect(groupOf(list).getAttribute('aria-invalid')).toBe('true');
    const warning = await make('label="Size" status-type="warning" status-message="Careful"');
    expect(groupOf(warning).hasAttribute('aria-invalid')).toBe(false);
  });

  it('names a radio from its label, a rich label or an aria-label, and describes it by its description', async () => {
    const list = await make(
      'label="Plan"',
      `<tct-radio-list-item label="Free" value="free" description="Three projects"></tct-radio-list-item>
       <tct-radio-list-item value="pro"><span slot="label">Pro <em>Recommended</em></span><span slot="description">Great for <strong>teams</strong></span></tct-radio-list-item>
       <tct-radio-list-item value="team" aria-label="Team plan option"><span slot="label">Team</span></tct-radio-list-item>`,
    );
    if (!isChromium) return;
    const free = await axNode(radioOf(items(list)[0]!));
    expect(free.name).toBe('Free');
    expect(free.description).toContain('Three projects');
    const pro = await axNode(radioOf(items(list)[1]!));
    expect(pro.name).toBe('Pro Recommended');
    expect(pro.description).toContain('Great for teams');
    expect((await axNode(radioOf(items(list)[2]!))).name).toBe('Team plan option');
  });

  it('start and end content render beside the label, and a click on an interactive end element does not choose', async () => {
    const list = await make(
      'label="Plan"',
      `<tct-radio-list-item label="Free" value="free"><span slot="start" id="s">$0</span><button slot="end" id="e">Compare</button></tct-radio-list-item>`,
    );
    const item = items(list)[0]!;
    expect(item.querySelector('#s')).not.toBeNull();
    await userEvent.click(item.querySelector<HTMLElement>('#e')!);
    expect(list.value).toBe('');
  });
});

describe('tct-radio-list: layout, size and appearance', () => {
  it('stacks the options vertically by default and puts them in a row with orientation=horizontal', async () => {
    const list = await make();
    const [a, b] = items(list).map((item) => item.getBoundingClientRect());
    expect(b!.top).toBeGreaterThan(a!.bottom - 1);
    list.orientation = 'horizontal';
    await list.updateComplete;
    await nextFrame();
    const [c, d] = items(list).map((item) => item.getBoundingClientRect());
    expect(d!.left).toBeGreaterThan(c!.right - 1);
    expect(Math.abs(d!.top - c!.top)).toBeLessThanOrEqual(1);
  });

  it('sm and md draw 20px and 24px radios; the list size reaches every option', async () => {
    const list = await make();
    expect(radioOf(items(list)[0]!).getBoundingClientRect().width).toBe(24);
    list.size = 'sm';
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    await nextFrame();
    expect(radioOf(items(list)[0]!).getBoundingClientRect().width).toBe(20);
  });

  it('draws the shared radio indicator: an empty ring, and a dot when chosen', async () => {
    const list = await make('label="Size" value="m"');
    const indicator = (item: TctRadioListItem): HTMLElement =>
      item.shadowRoot!.querySelector<HTMLElement>('tct-radio-indicator')!;
    expect(indicator(items(list)[0]!).getAttribute('state')).toBe('unchecked');
    expect(indicator(items(list)[1]!).getAttribute('state')).toBe('checked');
  });

  it('draws a 2px focus ring around the focused radio only for keyboard focus', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><button id="before">before</button><tct-radio-list label="Size" value="m">${OPTIONS}</tct-radio-list></div>`,
    );
    const list = wrapper.querySelector<TctRadioList>('tct-radio-list')!;
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    await nextFrame();
    wrapper.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    const radio = radioOf(items(list)[1]!);
    await waitUntil(() => getComputedStyle(radio).outlineStyle === 'solid', 'ring');
    expect(getComputedStyle(radio).outlineWidth).toBe('2px');
    // The row has no fill or hover wash of its own.
    const row = items(list)[1]!
      .shadowRoot!.querySelector('tct-item')!
      .shadowRoot!.querySelector('[part="item"]')!;
    expect(getComputedStyle(row).backgroundColor).toMatch(/, 0\)$|\/ 0\)$|^rgba\(0, 0, 0, 0\)$/);
  });

  it('keeps the radio ring visible in forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const list = await make('label="Size" value="m"');
    const circle = items(list)[1]!
      .shadowRoot!.querySelector('tct-radio-indicator')!
      .shadowRoot!.querySelector<HTMLElement>('.circle')!;
    expect(getComputedStyle(circle).borderTopStyle).toBe('solid');
  });
});

describe('tct-radio-list: accessibility and i18n', () => {
  it('passes axe with descriptions, a status, a disabled option and rich content', async () => {
    const list = await make(
      'label="Plan" description="Pick a plan" status-type="error" status-message="Pick a plan" value="pro"',
      `<tct-radio-list-item label="Free" value="free" description="Three projects"></tct-radio-list-item>
       <tct-radio-list-item value="pro"><span slot="label">Pro <em>new</em></span></tct-radio-list-item>
       <tct-radio-list-item label="Team" value="team" disabled></tct-radio-list-item>`,
    );
    await motionDone(list);
    await expectAccessible(list);
  });

  it('passes axe read-only, disabled with a reason, and horizontal', async () => {
    for (const attributes of [
      'label="Size" readonly value="m"',
      'label="Size" disabled disabled-message="Locked" value="m"',
      'label="Size" orientation="horizontal" size="sm"',
    ]) {
      const list = await make(attributes);
      await motionDone(list);
      await expectAccessible(list);
    }
  });

  it('localises the Required indicator', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-radio-list label="Größe" required>${OPTIONS}</tct-radio-list></div>`,
    );
    const list = wrapper.querySelector<TctRadioList>('tct-radio-list')!;
    await list.updateComplete;
    const indicator = (): string =>
      list.shadowRoot!.querySelector('[part="label-indicator"]')?.textContent ?? 'Required';
    await waitUntil(() => !indicator().includes('Required'), 'German indicator');
    expect(indicator()).toMatch(/Erforderlich|Pflicht/i);
  });
});

describe('tct-radio-list: form layout', () => {
  it('in a horizontal-labels layout the label sits beside the control', async () => {
    await page.viewport(800, 800);
    const wrapper = await fixture<HTMLElement>(
      `<div style="padding:40px;inline-size:640px"><tct-form-layout direction="horizontal-labels"><tct-radio-list label="Size" name="s"><tct-radio-list-item label="Small" value="s"></tct-radio-list-item></tct-radio-list></tct-form-layout></div>`,
    );
    const field = wrapper.querySelector<TctRadioList>('tct-radio-list')!;
    await field.updateComplete;
    await nextFrame();
    const label = field
      .shadowRoot!.querySelector<HTMLElement>('[part="label"]')!
      .getBoundingClientRect();
    const control = field
      .shadowRoot!.querySelector<HTMLElement>('[part="group"]')!
      .getBoundingClientRect();
    expect(label.right).toBeLessThanOrEqual(control.left);
  });
});
