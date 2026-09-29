/**
 * tct-checkbox-list and its items: the element and form-control suites, then collection mode (values,
 * toggling, events), one tab stop per option, disabled and read-only, status, naming and descriptions,
 * loading and changeAction, the group disabled reason, forms (a multi-value control), density and RTL.
 * Ported from upstream CheckboxList.test.tsx where the behaviour applies.
 */
import {html} from 'lit';
import {page, userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {deepQueryAll, fixture} from '@tecton-wc/testing/fixture.js';
import {formHarness, hasCustomState} from '@tecton-wc/testing/forms.js';
import {pressKeys, tabSequence} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-wc/testing/suites/form-control.js';
import {isChromium, isTier2} from '@tecton-wc/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../button/define.js';
import '../field/define.js';
import '../form-layout/define.js';
import '../tooltip/define.js';
import './define.js';
import type {TctCheckboxList} from './tct-checkbox-list.js';
import type {TctCheckboxListItem} from './tct-checkbox-list-item.js';

const items = (list: TctCheckboxList): TctCheckboxListItem[] => [
  ...list.querySelectorAll<TctCheckboxListItem>('tct-checkbox-list-item'),
];
const boxOf = (item: TctCheckboxListItem): HTMLInputElement => item.control!;
const groupOf = (list: TctCheckboxList): HTMLElement =>
  list.shadowRoot!.querySelector<HTMLElement>('[part="group"]')!;

async function motionDone(element: Element): Promise<void> {
  await nextFrame();
  const running = deepQueryAll(element.parentElement ?? element, () => true)
    .flatMap((node) => node.getAnimations())
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
  await Promise.allSettled(running.map((animation) => animation.finished));
}

const OPTIONS = `
  <tct-checkbox-list-item label="Email" value="email"></tct-checkbox-list-item>
  <tct-checkbox-list-item label="SMS" value="sms"></tct-checkbox-list-item>
  <tct-checkbox-list-item label="Push" value="push"></tct-checkbox-list-item>`;

async function make(
  attributes = 'label="Notifications"',
  body = OPTIONS,
): Promise<TctCheckboxList> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding:24px;inline-size:420px"><tct-checkbox-list ${attributes}>${body}</tct-checkbox-list></div>`,
  );
  const list = wrapper.querySelector<TctCheckboxList>('tct-checkbox-list')!;
  await list.updateComplete;
  await Promise.all(items(list).map((item) => item.updateComplete));
  await nextFrame();
  return list;
}

runElementSuite({
  tag: 'tct-checkbox-list',
  render: () =>
    html`<tct-checkbox-list label="Notifications" name="n"
      ><tct-checkbox-list-item label="Email" value="email"></tct-checkbox-list-item
    ></tct-checkbox-list>`,
  properties: {
    label: 'Other',
    description: 'Help',
    density: 'compact',
    hasDividers: true,
    values: ['email'],
    width: 300,
  },
  attributes: {label: 'label', description: 'description', density: 'density'},
});

runElementSuite({
  tag: 'tct-checkbox-list-item',
  render: () => html`<tct-checkbox-list-item label="Email" value="email"></tct-checkbox-list-item>`,
  properties: {label: 'Other', value: 'x', description: 'Help', loading: true, checked: true},
  attributes: {label: 'label', value: 'value', description: 'description'},
  a11y: false,
});

const restore = new FormData();
restore.append('field', 'a');

runFormControlSuite({
  tag: 'tct-checkbox-list',
  render: (attributes) =>
    `<tct-checkbox-list ${attributes}><tct-checkbox-list-item label="A" value="a"></tct-checkbox-list-item><tct-checkbox-list-item label="B" value="b"></tct-checkbox-list-item></tct-checkbox-list>`,
  validValue: 'a',
  restoreState: restore,
  setValid: (element) => {
    (element as unknown as TctCheckboxList).values = ['a'];
  },
  setEmpty: (element) => {
    (element as unknown as TctCheckboxList).values = [];
  },
  labelActivation: 'focus',
  // The blocked submit focuses the first option's checkbox, two shadow roots down (asserted below); the
  // suite's containment check only looks at one level.
  anchorFocus: false,
  innerFocusable: (element) => element.shadowRoot!.querySelector<HTMLElement>('[part="group"]'),
  userEdit: async (element) => {
    await userEvent.click(
      (element as unknown as TctCheckboxList).querySelector('tct-checkbox-list-item')!.control!,
    );
  },
});

describe('tct-checkbox-list: rendering and semantics (CheckboxList.test.tsx)', () => {
  it('renders the label, the options and a group named by the label', async () => {
    const list = await make('label="Notifications" description="How should we reach you?"');
    expect(list.shadowRoot!.querySelector('[part="label"]')!.textContent).toContain(
      'Notifications',
    );
    expect(items(list)).toHaveLength(3);
    const group = groupOf(list);
    expect(group.getAttribute('role')).toBe('group');
    if (isChromium) {
      const node = await axNode(group);
      expect(node.role).toBe('group');
      expect(node.name).toBe('Notifications');
      expect(node.description).toContain('How should we reach you?');
    }
  });

  it('checks the options in values, and the checked attribute is the default', async () => {
    const list = await make(
      'label="Notifications"',
      `<tct-checkbox-list-item label="Email" value="email" checked></tct-checkbox-list-item>
       <tct-checkbox-list-item label="SMS" value="sms"></tct-checkbox-list-item>`,
    );
    expect(list.values).toEqual(['email']);
    expect(boxOf(items(list)[0]!).checked).toBe(true);
    expect(boxOf(items(list)[1]!).checked).toBe(false);
    list.values = ['sms'];
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    expect(boxOf(items(list)[0]!).checked).toBe(false);
    expect(boxOf(items(list)[1]!).checked).toBe(true);
    expect(items(list)[1]!.checked).toBe(true);
  });

  it('adds and removes a value when the user toggles an option, with input then change once each', async () => {
    const list = await make();
    const events = recordEvents(list, ['input', 'change']);
    await userEvent.click(boxOf(items(list)[0]!));
    expect(list.values).toEqual(['email']);
    await userEvent.click(boxOf(items(list)[2]!));
    expect(list.values).toEqual(['email', 'push']);
    await userEvent.click(boxOf(items(list)[0]!));
    expect(list.values).toEqual(['push']);
    expect(events.events.map((event) => event.type)).toEqual([
      'input',
      'change',
      'input',
      'change',
      'input',
      'change',
    ]);
    expect(
      events.events.every((event) => event.bubbles && (event.type === 'input' || event.composed)),
    ).toBe(true);
    // Writing values fires nothing.
    list.values = [];
    await list.updateComplete;
    expect(events.events).toHaveLength(6);
  });

  it('a controlled list keeps the state its owner decides: cancelling by re-asserting values', async () => {
    const list = await make();
    list.values = ['email'];
    list.addEventListener('change', () => {
      list.values = ['email'];
    });
    await userEvent.click(boxOf(items(list)[1]!));
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    expect(list.values).toEqual(['email']);
    expect(boxOf(items(list)[1]!).checked).toBe(false);
  });

  it('fires a consumer click listener on an item in addition to toggling, once', async () => {
    const list = await make();
    const clicks: EventTarget[] = [];
    items(list)[0]!.addEventListener('click', (event) => clicks.push(event.target!));
    await userEvent.click(boxOf(items(list)[0]!));
    expect(list.values).toEqual(['email']);
    expect(clicks).toHaveLength(1);
  });

  it('is named by the label and the options by their labels', async () => {
    const list = await make();
    if (isChromium) {
      expect((await axNode(boxOf(items(list)[0]!))).name).toBe('Email');
      expect((await axNode(boxOf(items(list)[1]!))).role).toBe('checkbox');
    }
  });

  it('renders the group status message detached', async () => {
    const list = await make(
      'label="Notifications" status-type="error" status-message="Pick at least one"',
    );
    const status = list.shadowRoot!.querySelector<HTMLElement>('tct-field-status')!;
    expect(status.getAttribute('variant')).toBe('detached');
    expect(status.textContent).toBe('Pick at least one');
    expect(groupOf(list).getAttribute('aria-describedby')!.split(' ')).toContain(status.id);
  });

  it('passes density to the items: compact rows draw the small checkbox', async () => {
    const list = await make('label="Notifications" density="compact"');
    const box = items(list)[0]!.shadowRoot!.querySelector('tct-checkbox-input')!;
    expect(box.getAttribute('size')).toBe('sm');
    list.density = 'spacious';
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    expect(
      items(list)[0]!.shadowRoot!.querySelector('tct-checkbox-input')!.getAttribute('size'),
    ).toBe('md');
  });
});

describe('tct-checkbox-list: one tab stop per option (WCAG 4.1.2)', () => {
  it('exposes exactly one focusable control per option, the checkbox: Tab moves from option to option', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div><button id="before">before</button><tct-checkbox-list label="Notifications">${OPTIONS}</tct-checkbox-list><button id="after">after</button></div>`,
    );
    const list = wrapper.querySelector<TctCheckboxList>('tct-checkbox-list')!;
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    const stops = await tabSequence(wrapper, {
      start: wrapper.querySelector<HTMLElement>('#before')!,
      max: 6,
    });
    const inputs = items(list).map((item) => boxOf(item));
    expect(stops.filter((element) => inputs.includes(element as HTMLInputElement))).toEqual(inputs);
    // The rows themselves are not focusable.
    for (const item of items(list)) expect(item.hasAttribute('tabindex')).toBe(false);
  });

  it('clicking the row surface outside the checkbox still toggles it', async () => {
    const list = await make();
    const row = items(list)[0]!;
    const rect = row.getBoundingClientRect();
    // The far end of the row: nothing interactive there.
    await userEvent.click(row, {position: {x: rect.width - 8, y: rect.height / 2}});
    expect(list.values).toEqual(['email']);
  });

  it('toggles with Space on the focused checkbox, which reports its checked state', async () => {
    const list = await make();
    boxOf(items(list)[1]!).focus();
    await pressKeys(' ');
    expect(list.values).toEqual(['sms']);
    if (isChromium) expect((await axNode(boxOf(items(list)[1]!))).checked).toBe('true');
  });

  it('focus() focuses the first enabled option', async () => {
    const list = await make(
      'label="Notifications"',
      `<tct-checkbox-list-item label="A" value="a" disabled></tct-checkbox-list-item><tct-checkbox-list-item label="B" value="b"></tct-checkbox-list-item>`,
    );
    list.focus();
    expect(deepActiveElement()).toBe(boxOf(items(list)[1]!));
  });
});

describe('tct-checkbox-list: disabled and read-only', () => {
  it('disables every checkbox when the list is disabled, and toggles nothing', async () => {
    const list = await make('label="Notifications" disabled');
    for (const item of items(list)) expect(boxOf(item).disabled).toBe(true);
    const events = recordEvents(list, ['input', 'change']);
    boxOf(items(list)[0]!).click();
    expect(list.values).toEqual([]);
    expect(events.events).toHaveLength(0);
  });

  it('disables an individual item', async () => {
    const list = await make(
      'label="Notifications"',
      `<tct-checkbox-list-item label="A" value="a" disabled></tct-checkbox-list-item><tct-checkbox-list-item label="B" value="b"></tct-checkbox-list-item>`,
    );
    expect(boxOf(items(list)[0]!).disabled).toBe(true);
    expect(boxOf(items(list)[1]!).disabled).toBe(false);
  });

  it('read-only shows the state at full strength and blocks changes', async () => {
    const list = await make(
      'label="Notifications" readonly',
      `<tct-checkbox-list-item label="A" value="a" checked></tct-checkbox-list-item><tct-checkbox-list-item label="B" value="b"></tct-checkbox-list-item>`,
    );
    const events = recordEvents(list, ['input', 'change']);
    await userEvent.click(boxOf(items(list)[1]!));
    await userEvent.click(boxOf(items(list)[0]!));
    expect(list.values).toEqual(['a']);
    expect(events.events).toHaveLength(0);
    expect(boxOf(items(list)[0]!).getAttribute('aria-readonly')).toBe('true');
  });

  it('with a disabled-message the checkboxes stay focusable and the group carries the reason', async () => {
    const list = await make(
      'label="Notifications" disabled disabled-message="Managed by your admin"',
    );
    const box = boxOf(items(list)[0]!);
    expect(box.disabled).toBe(false);
    expect(box.getAttribute('aria-disabled')).toBe('true');
    box.focus();
    expect(deepActiveElement()).toBe(box);
    const events = recordEvents(list, ['input', 'change']);
    box.click();
    await pressKeys(' ');
    expect(list.values).toEqual([]);
    expect(events.events).toHaveLength(0);
    const reason = list.shadowRoot!.querySelector<HTMLElement>('.visually-hidden')!;
    expect(reason.textContent).toBe('Managed by your admin');
    expect(groupOf(list).getAttribute('aria-describedby')!.split(' ')).toContain(reason.id);
    expect(list.shadowRoot!.querySelector('tct-tooltip')!.getAttribute('content')).toBe(
      'Managed by your admin',
    );
  });

  it('a disabled list without a reason keeps its checkboxes natively disabled and renders no tooltip text', async () => {
    const list = await make('label="Notifications" disabled');
    expect(boxOf(items(list)[0]!).disabled).toBe(true);
    expect(list.shadowRoot!.querySelector('tct-tooltip')!.getAttribute('content')).toBe('');
  });
});

describe('tct-checkbox-list-item: naming, descriptions and content', () => {
  it('describes the checkbox by a plain or rich description', async () => {
    const list = await make(
      'label="Plan"',
      `<tct-checkbox-list-item label="Pro" value="pro" description="Best for teams"></tct-checkbox-list-item>
       <tct-checkbox-list-item label="Free" value="free"><span slot="description">Great to <strong>start</strong></span></tct-checkbox-list-item>
       <tct-checkbox-list-item label="Custom" value="custom"></tct-checkbox-list-item>`,
    );
    if (!isChromium) return;
    expect((await axNode(boxOf(items(list)[0]!))).description).toContain('Best for teams');
    expect((await axNode(boxOf(items(list)[1]!))).description).toContain('Great to start');
    expect((await axNode(boxOf(items(list)[2]!))).description ?? '').toBe('');
  });

  it('names the checkbox from a rich label through aria-labelledby, and from aria-label when given', async () => {
    const list = await make(
      'label="Plan"',
      `<tct-checkbox-list-item value="pro"><span slot="label">Pro plan <em>Recommended</em></span></tct-checkbox-list-item>
       <tct-checkbox-list-item value="team" aria-label="Team plan option"><span slot="label">Team plan</span></tct-checkbox-list-item>`,
    );
    if (!isChromium) return;
    expect((await axNode(boxOf(items(list)[0]!))).name).toBe('Pro plan Recommended');
    expect((await axNode(boxOf(items(list)[1]!))).name).toBe('Team plan option');
  });

  it('renders end content, and a click on an interactive element in it does not toggle the option', async () => {
    const list = await make(
      'label="Files"',
      `<tct-checkbox-list-item label="report.pdf" value="r"><tct-button slot="end" variant="ghost" size="sm">Open</tct-button></tct-checkbox-list-item>`,
    );
    const button = items(list)[0]!.querySelector<HTMLElement>('tct-button')!;
    expect(button).not.toBeNull();
    await userEvent.click(button);
    expect(list.values).toEqual([]);
  });

  it('marks a checked option with the accent wash on its row', async () => {
    const list = await make();
    await userEvent.click(boxOf(items(list)[0]!));
    await items(list)[0]!.updateComplete;
    const row = items(list)[0]!.shadowRoot!.querySelector('tct-list-item')!;
    expect(row.hasAttribute('data-checked')).toBe(true);
    if (!isTier2) expect(hasCustomState(items(list)[0]!, 'checked')).toBe(true);
  });
});

describe('tct-checkbox-list: loading and changeAction', () => {
  it('shows a spinner in the checkbox of a loading item, marks it aria-busy and blocks it', async () => {
    const list = await make(
      'label="Notifications"',
      `<tct-checkbox-list-item label="Email" value="email" loading></tct-checkbox-list-item><tct-checkbox-list-item label="SMS" value="sms"></tct-checkbox-list-item>`,
    );
    const item = items(list)[0]!;
    if (!isTier2) expect(hasCustomState(item, 'busy')).toBe(true);
    expect(
      item
        .shadowRoot!.querySelector('tct-checkbox-input')!
        .shadowRoot!.querySelector('tct-spinner'),
    ).not.toBeNull();
    expect(boxOf(item).getAttribute('aria-busy')).toBe('true');
    await userEvent.click(boxOf(item));
    expect(list.values).toEqual([]);
    expect(
      items(list)[1]!
        .shadowRoot!.querySelector('tct-checkbox-input')!
        .shadowRoot!.querySelector('tct-spinner'),
    ).toBeNull();
  });

  it('changeAction shows a spinner only on the toggled item while pending, others stay interactive', async () => {
    const list = await make();
    let resolve!: () => void;
    const calls: string[][] = [];
    list.changeAction = (values) => {
      calls.push(values);
      return new Promise<void>((done) => {
        resolve = done;
      });
    };
    await userEvent.click(boxOf(items(list)[0]!));
    expect(calls).toEqual([['email']]);
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    await nextFrame();
    const spinner = (item: TctCheckboxListItem) =>
      item
        .shadowRoot!.querySelector('tct-checkbox-input')!
        .shadowRoot!.querySelector('tct-spinner');
    expect(spinner(items(list)[0]!)).not.toBeNull();
    expect(spinner(items(list)[1]!)).toBeNull();
    expect(boxOf(items(list)[0]!).getAttribute('aria-busy')).toBe('true');
    expect(boxOf(items(list)[1]!).hasAttribute('aria-busy')).toBe(false);
    // Re-toggling the pending item is blocked; another item works.
    await userEvent.click(boxOf(items(list)[0]!));
    expect(list.values).toEqual(['email']);
    await userEvent.click(boxOf(items(list)[1]!));
    expect(list.values).toEqual(['email', 'sms']);
    resolve();
    await waitUntil(() => !boxOf(items(list)[0]!).hasAttribute('aria-busy'), 'idle');
  });

  it('a rejected changeAction restores the previous selection', async () => {
    const list = await make();
    list.changeAction = () => Promise.reject(new Error('nope'));
    await userEvent.click(boxOf(items(list)[0]!));
    await waitUntil(() => list.values.length === 0, 'reverted');
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    expect(boxOf(items(list)[0]!).checked).toBe(false);
  });
});

describe('tct-checkbox-list-item: standalone (select all)', () => {
  it('an item without a value inside a checkbox list is standalone: checked, indeterminate and its own events', async () => {
    const list = await make(
      'label="Notifications"',
      `<tct-checkbox-list-item label="Select all" indeterminate></tct-checkbox-list-item>${OPTIONS}`,
    );
    const all = items(list)[0]!;
    expect(boxOf(all).indeterminate).toBe(true);
    const events = recordEvents(all, ['input', 'change']);
    await userEvent.click(boxOf(all));
    expect(all.checked).toBe(true);
    expect(all.indeterminate).toBe(false);
    expect(events.events.map((event) => event.type)).toEqual(['input', 'change']);
    // The list's values are untouched by a standalone row.
    expect(list.values).toEqual([]);
  });

  it('works in a plain tct-list with the checked attribute as default', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<tct-list><tct-checkbox-list-item label="Remember me" checked></tct-checkbox-list-item></tct-list>`,
    );
    const item = wrapper.querySelector<TctCheckboxListItem>('tct-checkbox-list-item')!;
    await item.updateComplete;
    expect(item.checked).toBe(true);
    expect(boxOf(item).checked).toBe(true);
    await userEvent.click(boxOf(item));
    expect(item.checked).toBe(false);
    expect(item.defaultChecked).toBe(true);
  });
});

describe('tct-checkbox-list: form participation', () => {
  it('submits one entry per checked option under the list name', async () => {
    const form = await formHarness(
      `<tct-checkbox-list label="Notifications" name="channels">
         <tct-checkbox-list-item label="Email" value="email" checked></tct-checkbox-list-item>
         <tct-checkbox-list-item label="SMS" value="sms"></tct-checkbox-list-item>
         <tct-checkbox-list-item label="Push" value="push" checked></tct-checkbox-list-item>
       </tct-checkbox-list>`,
    );
    const list = form.form.querySelector<TctCheckboxList>('tct-checkbox-list')!;
    await list.updateComplete;
    expect(form.values('channels')).toEqual(['email', 'push']);
    await userEvent.click(boxOf(items(list)[1]!));
    expect(form.values('channels')).toEqual(['email', 'push', 'sms']);
    await userEvent.click(boxOf(items(list)[0]!));
    expect(form.values('channels')).toEqual(['push', 'sms']);
  });

  it('reset returns to the options marked checked', async () => {
    const form = await formHarness(
      `<tct-checkbox-list label="Notifications" name="channels">
         <tct-checkbox-list-item label="Email" value="email" checked></tct-checkbox-list-item>
         <tct-checkbox-list-item label="SMS" value="sms"></tct-checkbox-list-item>
       </tct-checkbox-list>`,
    );
    const list = form.form.querySelector<TctCheckboxList>('tct-checkbox-list')!;
    await list.updateComplete;
    await userEvent.click(boxOf(items(list)[1]!));
    await userEvent.click(boxOf(items(list)[0]!));
    expect(form.values('channels')).toEqual(['sms']);
    form.reset();
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    expect(form.values('channels')).toEqual(['email']);
    expect(boxOf(items(list)[0]!).checked).toBe(true);
  });

  it('required with nothing checked blocks the submit, focuses the first option and shows the error', async () => {
    const form = await formHarness(
      `<tct-checkbox-list label="Notifications" name="channels" required>${OPTIONS}</tct-checkbox-list><button type="submit">Go</button>`,
    );
    const list = form.form.querySelector<TctCheckboxList>('tct-checkbox-list')!;
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    expect(list.validity.valueMissing).toBe(true);
    expect(groupOf(list).hasAttribute('aria-invalid')).toBe(false);
    await userEvent.click(form.form.querySelector('button')!);
    await list.updateComplete;
    await nextFrame();
    expect(form.submitEvents).toHaveLength(0);
    expect(groupOf(list).getAttribute('aria-invalid')).toBe('true');
    expect(deepActiveElement()).toBe(boxOf(items(list)[0]!));
    await userEvent.click(boxOf(items(list)[0]!));
    await list.updateComplete;
    expect(list.validity.valid).toBe(true);
  });
});

describe('tct-checkbox-list: appearance and accessibility', () => {
  it('passes axe with descriptions, a status and a disabled item', async () => {
    const list = await make(
      'label="Notifications" description="Pick channels" status-type="error" status-message="Pick at least one"',
      `<tct-checkbox-list-item label="Email" value="email" description="Daily digest"></tct-checkbox-list-item>
       <tct-checkbox-list-item label="SMS" value="sms" disabled></tct-checkbox-list-item>
       <tct-checkbox-list-item value="push"><span slot="label">Push <em>new</em></span></tct-checkbox-list-item>`,
    );
    await motionDone(list);
    await expectAccessible(list);
  });

  it('mirrors in RTL: the checkbox sits at the inline start of the row', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div dir="rtl" style="inline-size:320px"><tct-checkbox-list label="Notifications">${OPTIONS}</tct-checkbox-list></div>`,
    );
    const list = wrapper.querySelector<TctCheckboxList>('tct-checkbox-list')!;
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    await nextFrame();
    const box = items(list)[0]!
      .shadowRoot!.querySelector('tct-checkbox-input')!
      .getBoundingClientRect();
    const row = items(list)[0]!.getBoundingClientRect();
    expect(row.right - box.right).toBeLessThan(box.left - row.left);
  });

  it('localises the option name of a rich label', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-checkbox-list label="Plan"><tct-checkbox-list-item value="pro"><span slot="label">Pro</span></tct-checkbox-list-item></tct-checkbox-list></div>`,
    );
    const list = wrapper.querySelector<TctCheckboxList>('tct-checkbox-list')!;
    await list.updateComplete;
    await Promise.all(items(list).map((item) => item.updateComplete));
    const hidden = items(list)[0]!
      .shadowRoot!.querySelector('tct-checkbox-input')!
      .shadowRoot!.querySelector('[part="label"]')!;
    await waitUntil(() => hidden.textContent.trim() !== 'Checkbox', 'German word');
    expect(hidden.textContent.trim()).toBe('Kontrollkästchen');
  });
});

describe('tct-checkbox-list: form layout', () => {
  it('in a horizontal-labels layout the label sits beside the control', async () => {
    await page.viewport(800, 800);
    const wrapper = await fixture<HTMLElement>(
      `<div style="padding:40px;inline-size:640px"><tct-form-layout direction="horizontal-labels"><tct-checkbox-list label="Options" name="o"><tct-checkbox-list-item label="A" value="a"></tct-checkbox-list-item></tct-checkbox-list></tct-form-layout></div>`,
    );
    const field = wrapper.querySelector<TctCheckboxList>('tct-checkbox-list')!;
    await field.updateComplete;
    await nextFrame();
    const label = field
      .shadowRoot!.querySelector<HTMLElement>('[part="label"]')!
      .getBoundingClientRect();
    const control = field
      .shadowRoot!.querySelector<HTMLElement>('[role="list"]')!
      .getBoundingClientRect();
    expect(label.right).toBeLessThanOrEqual(control.left);
  });
});
