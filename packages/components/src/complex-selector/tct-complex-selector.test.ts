/**
 * tct-complex-selector: the element, form-control and overlay suites, then the trigger, the dialog popover
 * shell (focus in and back, Escape, outside press, Tab containment), committing from custom content
 * (`commit`, `hide`), the async change action, the open events, disabled and read-only, status, RTL, forced
 * colours and axe. Ported from upstream ComplexSelector.test.tsx where the behaviour applies.
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {expectEventFlags, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {formHarness} from '@tecton-wc/testing/forms.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-wc/testing/suites/form-control.js';
import {runKeyboardSuite} from '@tecton-wc/testing/suites/keyboard.js';
import {runOverlaySuite} from '@tecton-wc/testing/suites/overlay.js';
import {isChromium, isTier2} from '@tecton-wc/testing/tier.js';
import {animationsFinished, nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../input-group/define.js';
import '../tooltip/define.js';
import './define.js';
import type {TctComplexSelector} from './tct-complex-selector.js';

const CONTENT = `<div role="radiogroup" aria-label="Fruit">
  <button type="button" role="radio" aria-checked="false" data-value="apple">Apple</button>
  <button type="button" role="radio" aria-checked="false" data-value="banana">Banana</button>
</div>`;

async function make(
  attributes = 'label="Fruit"',
  content = CONTENT,
  options: {dir?: 'rtl' | 'ltr'; lang?: string} = {},
): Promise<TctComplexSelector> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:40px 40px 320px;inline-size:420px"><tct-complex-selector ${attributes}>${content}</tct-complex-selector></div>`,
    options,
  );
  const el = root.querySelector<TctComplexSelector>('tct-complex-selector')!;
  // The content commits through the element, like a product's own component does.
  el.addEventListener('click', (event) => {
    const value = (event.target as HTMLElement).closest<HTMLElement>('[data-value]')?.dataset.value;
    if (value) {
      el.commit(value);
      void el.hide();
    }
  });
  await el.updateComplete;
  await nextFrame();
  return el;
}

const trigger = (el: TctComplexSelector): HTMLButtonElement =>
  el.shadowRoot!.querySelector<HTMLButtonElement>('button.trigger')!;
const layerOf = (el: TctComplexSelector): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.layer')!;
const surfaceOf = (el: TctComplexSelector): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.surface')!;
const part = (el: TctComplexSelector, name: string): HTMLElement | null =>
  el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
const isShown = (el: TctComplexSelector): boolean => layerOf(el).matches(':popover-open');

async function openByClick(el: TctComplexSelector): Promise<void> {
  await userEvent.click(trigger(el));
  await waitUntil(() => el.open && isShown(el), 'opened');
  await animationsFinished(layerOf(el));
}

runElementSuite({
  tag: 'tct-complex-selector',
  render: () =>
    html`<tct-complex-selector label="Fruit" name="fruit">${'content'}</tct-complex-selector>`,
  properties: {
    label: 'Other',
    description: 'Help',
    placeholder: 'Pick',
    variant: 'ghost',
    size: 'lg',
    triggerLabel: 'Apple',
    startIcon: 'search',
    placement: 'above',
    alignment: 'end',
    loading: true,
    width: 240,
  },
  attributes: {
    label: 'label',
    description: 'description',
    placeholder: 'placeholder',
    variant: 'variant',
    size: 'size',
    triggerLabel: 'trigger-label',
    startIcon: 'start-icon',
    placement: 'placement',
    alignment: 'alignment',
    loading: 'loading',
    width: 'width',
  },
  events: ['tct-open-change', 'tct-after-open-change'],
});

runFormControlSuite({
  tag: 'tct-complex-selector',
  render: (attributes) =>
    `<tct-complex-selector label="Fruit" ${attributes}><p>content</p></tct-complex-selector>`,
  validValue: 'banana',
  required: true,
  readonly: true,
  userEdit: async (el) => {
    const selector = el as unknown as TctComplexSelector;
    await userEvent.click(trigger(selector));
    await waitUntil(() => selector.open, 'open');
    selector.commit('banana');
    await selector.hide();
    await pressKeys('Tab');
  },
  innerFocusable: (el) => trigger(el as TctComplexSelector),
});

describe('tct-complex-selector: the trigger', () => {
  it('shows the placeholder until there is a trigger label, and the label from the attribute or the slot', async () => {
    const el = await make();
    expect(part(el, 'placeholder')!.textContent.trim()).toBe('Select…');
    el.triggerLabel = 'Apple, ripe';
    await el.updateComplete;
    expect(part(el, 'value')!.textContent.trim()).toBe('Apple, ripe');
    const slotted = await make(
      'label="Fruit"',
      `${CONTENT}<span slot="trigger-label"><b>Rich</b> label</span>`,
    );
    expect(part(slotted, 'value')).not.toBeNull();
    expect(slotted.querySelector('[slot="trigger-label"]')).not.toBeNull();
  });

  it('is a button that opens a dialog, named by the label, with the state on the button', async () => {
    const el = await make();
    const button = trigger(el);
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    if (isChromium) {
      const node = await axNode(button);
      expect(node.role).toBe('button');
      expect(node.name).toBe('Fruit');
    }
    await openByClick(el);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe(surfaceOf(el).id);
  });

  it('draws sizes, the ghost variant with a start icon and the busy spinner', async () => {
    for (const size of ['sm', 'md', 'lg']) {
      const el = await make(`label="Fruit" size="${size}"`);
      expect(parseFloat(getComputedStyle(part(el, 'input')!).minBlockSize), size).toBeGreaterThan(
        20,
      );
    }
    const ghost = await make(
      'label="Fruit" variant="ghost" start-icon="search" trigger-label="Apple" loading',
    );
    expect(getComputedStyle(part(ghost, 'input')!).borderTopColor).toBe('rgba(0, 0, 0, 0)');
    expect(part(ghost, 'start-icon')!.getAttribute('name')).toBe('search');
    expect(part(ghost, 'busy')).not.toBeNull();
    expect(trigger(ghost).getAttribute('aria-busy')).toBe('true');
  });

  it('shows a status glyph in place of the chevron and detaches an attached status of the ghost variant', async () => {
    const el = await make('label="Fruit" status-type="error" status-message="Pick one"');
    expect(part(el, 'status-icon')).not.toBeNull();
    expect(part(el, 'indicator')).toBeNull();
    const ghost = await make(
      'label="Fruit" variant="ghost" status-type="warning" status-message="Careful"',
    );
    expect(part(ghost, 'status-icon')).toBeNull();
  });
});

describe('tct-complex-selector: the popover', () => {
  it('opens on a click and on ArrowDown, and closes on the second click', async () => {
    const el = await make();
    const changes = recordEvents(el, ['tct-open-change', 'tct-after-open-change']);
    await openByClick(el);
    await userEvent.click(trigger(el));
    await waitUntil(() => !el.open && !isShown(el), 'closed');
    trigger(el).focus();
    await pressKeys('ArrowDown');
    await waitUntil(() => el.open && isShown(el), 'opened by the key');
    expect(changes.named('tct-open-change').map((e) => [e.open, e.reason])).toEqual([
      [true, 'trigger'],
      [false, 'trigger'],
      [true, 'keyboard'],
    ]);
    expectEventFlags(changes.named('tct-open-change')[0]!, {
      bubbles: true,
      composed: true,
      cancelable: true,
    });
  });

  it('is a dialog named by the label with the slotted content, and puts focus on its first control', async () => {
    const el = await make();
    await openByClick(el);
    const dialog = surfaceOf(el);
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('Fruit');
    await waitUntil(
      () => deepActiveElement() === el.querySelector('[data-value="apple"]'),
      'first control focused',
    );
    if (isChromium) expect((await axNode(dialog)).name).toBe('Fruit');
  });

  it('focuses the dialog itself when the content has no control, and returns focus to the trigger on Escape', async () => {
    const el = await make('label="Fruit"', '<p>Just text</p>');
    await openByClick(el);
    await waitUntil(() => deepActiveElement() === surfaceOf(el), 'dialog focused');
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    await waitUntil(() => deepActiveElement() === trigger(el), 'focus returned');
  });

  it('keeps Tab inside the open popover', async () => {
    const el = await make();
    await openByClick(el);
    await waitUntil(
      () => deepActiveElement() === el.querySelector('[data-value="apple"]'),
      'focused',
    );
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(el.querySelector('[data-value="banana"]'));
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(el.querySelector('[data-value="apple"]'));
    await pressKeys('Shift+Tab');
    expect(deepActiveElement()).toBe(el.querySelector('[data-value="banana"]'));
  });

  it('an outside press closes it (reason outside); the click that dismissed it does not reopen it', async () => {
    const el = await make();
    const changes = recordEvents(el, 'tct-open-change');
    await openByClick(el);
    await userEvent.click(document.body);
    await waitUntil(() => !el.open, 'closed');
    expect(changes.events.at(-1)!.reason).toBe('outside');
    await openByClick(el);
    await userEvent.click(trigger(el));
    await nextFrame();
    await waitUntil(() => !el.open, 'closed by the trigger');
  });

  it('a cancelled open-change keeps it closed', async () => {
    const el = await make();
    el.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    await userEvent.click(trigger(el));
    await nextFrame();
    expect(el.open).toBe(false);
  });

  it('opens below the trigger, at least as wide, and honours placement and end alignment', async () => {
    const el = await make('label="Fruit" width="300"');
    await openByClick(el);
    const box = part(el, 'input')!.getBoundingClientRect();
    const surface = surfaceOf(el).getBoundingClientRect();
    expect(surface.top).toBeGreaterThanOrEqual(box.bottom);
    expect(surface.width).toBeGreaterThanOrEqual(box.width - 1);
    const wide = await make(
      'label="Fruit" width="200" alignment="end" style="margin-inline-start:200px"',
      '<div style="inline-size:320px">wide</div>',
    );
    await openByClick(wide);
    const wideBox = part(wide, 'input')!.getBoundingClientRect();
    // Tier 2 places the surface with the lazily loaded fallback, which does not right-align a surface wider
    // than its trigger to the pixel (a known degraded behaviour); Tier 1 anchors it exactly.
    if (!isTier2) {
      expect(Math.abs(surfaceOf(wide).getBoundingClientRect().right - wideBox.right)).toBeLessThan(
        2,
      );
    }
  });

  it('gives the popover clearance on both block edges, not just the leading one', async () => {
    const el = await make();
    await openByClick(el);
    const style = layerOf(el).style;
    const margin = style.getPropertyValue('margin-block');
    if (isTier2) return;
    expect(margin).not.toBe('');
    expect(margin).not.toBe('0px');
  });

  it('reports every open and close through tct-after-open-change, whatever caused it, once each', async () => {
    const el = await make();
    const after = recordEvents(el, 'tct-after-open-change');
    await el.show();
    await el.hide();
    await openByClick(el);
    await waitUntil(() => after.events.length === 3, 'the third change settled');
    await el.hide();
    await waitUntil(() => after.events.length === 4, 'four settled changes');
    expect(after.events.map((e) => e.open)).toEqual([true, false, true, false]);
    await el.show();
    await el.show();
    expect(after.events).toHaveLength(5);
  });
});

describe('tct-complex-selector: committing', () => {
  it('a commit sets the value, fires input then change once, and shows nothing until the content sets a label', async () => {
    const el = await make();
    const events = recordEvents(el, ['input', 'change']);
    await openByClick(el);
    await userEvent.click(el.querySelector('[data-value="banana"]')!);
    await waitUntil(() => !el.open, 'closed');
    expect(el.value).toBe('banana');
    expect(events.events.map((e) => e.type)).toEqual(['input', 'change']);
    expectEventFlags(events.named('change')[0]!, {bubbles: true, composed: true});
  });

  it('commit returns false and does nothing while disabled or read-only, and fires nothing for the same value', async () => {
    const el = await make('label="Fruit" value="apple"');
    const events = recordEvents(el, ['input', 'change']);
    expect(el.commit('apple')).toBe(true);
    expect(events.events).toHaveLength(0);
    el.readonly = true;
    expect(el.commit('banana')).toBe(false);
    el.readonly = false;
    el.disabled = true;
    expect(el.commit('banana')).toBe(false);
    expect(el.value).toBe('apple');
  });

  it('property and attribute writes to the value fire no events', async () => {
    const el = await make();
    const events = recordEvents(el, ['input', 'change']);
    el.value = 'banana';
    el.setAttribute('value', 'apple');
    await el.updateComplete;
    expect(events.events).toHaveLength(0);
  });

  it('runs the change action: busy while pending, the new value kept, restored on rejection', async () => {
    const el = await make();
    let resolve!: () => void;
    el.changeAction = () =>
      new Promise<void>((done) => {
        resolve = done;
      });
    el.commit('banana');
    await el.updateComplete;
    expect(trigger(el).getAttribute('aria-busy')).toBe('true');
    expect(el.value).toBe('banana');
    resolve();
    await waitUntil(() => trigger(el).getAttribute('aria-busy') === null, 'settled');
    el.changeAction = () => Promise.reject(new Error('no'));
    el.commit('apple');
    await waitUntil(() => el.value === 'banana', 'reverted');
  });

  it('a staged editor commits only from Apply: dismissing without it changes nothing', async () => {
    const el = await make(
      'label="Fruit" value="apple"',
      '<button type="button" id="apply">Apply</button>',
    );
    const events = recordEvents(el, ['input', 'change']);
    await openByClick(el);
    await pressKeys('Escape');
    await waitUntil(() => !el.open, 'closed');
    expect(events.events).toHaveLength(0);
    expect(el.value).toBe('apple');
  });
});

describe('tct-complex-selector: disabled, read-only and validation', () => {
  it('a disabled selector opens nothing; disabled-message keeps it focusable', async () => {
    const el = await make('label="Fruit" disabled disabled-message="Ask an admin"');
    expect(trigger(el).getAttribute('aria-disabled')).toBe('true');
    trigger(el).focus();
    await pressKeys('Enter', 'ArrowDown');
    await nextFrame();
    expect(el.open).toBe(false);
    await el.show();
    expect(el.open).toBe(false);
  });

  it('read-only keeps the value and the tab stop, opens nothing, and is described as read only', async () => {
    const form = await formHarness(
      '<tct-complex-selector label="Fruit" name="fruit" value="apple" readonly trigger-label="Apple"></tct-complex-selector>',
    );
    const el = form.form.querySelector<TctComplexSelector>('tct-complex-selector')!;
    await el.updateComplete;
    await userEvent.click(trigger(el));
    await pressKeys('ArrowDown');
    expect(el.open).toBe(false);
    expect(form.values('fruit')).toEqual(['apple']);
    // A plain button has no read-only state to expose, so it stops advertising a popup instead.
    expect(trigger(el).hasAttribute('aria-haspopup')).toBe(false);
    expect(trigger(el).hasAttribute('aria-readonly')).toBe(false);
  });

  it('closes an open popover when it becomes disabled', async () => {
    const el = await make();
    await openByClick(el);
    el.disabled = true;
    await waitUntil(() => !el.open && !isShown(el), 'closed');
  });

  it('required is satisfied by a value and blocks a submit without one', async () => {
    const form = await formHarness(
      '<tct-complex-selector label="Fruit" name="fruit" required></tct-complex-selector><button type="submit">Go</button>',
    );
    const el = form.form.querySelector<TctComplexSelector>('tct-complex-selector')!;
    await el.updateComplete;
    await userEvent.click(form.form.querySelector('button')!);
    await nextFrame();
    expect(form.submitEvents).toHaveLength(0);
    expect(trigger(el).getAttribute('aria-invalid')).toBe('true');
    el.commit('apple');
    await userEvent.click(form.form.querySelector('button')!);
    expect(form.entries()).toEqual([['fruit', 'apple']]);
  });
});

describe('tct-complex-selector: accessibility and environment', () => {
  it('passes axe closed and open, with a value and a status', async () => {
    const el = await make('label="Fruit" description="Pick one" trigger-label="Apple"');
    await expectAccessible(el);
    await openByClick(el);
    await expectAccessible(el);
    const status = await make('label="Fruit" status-type="error" status-message="Nope"');
    await expectAccessible(status);
  });

  it('takes the group label inside an input group', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="padding:24px;inline-size:420px"><tct-input-group label="Fruit"><tct-complex-selector label="Fruit" trigger-label="Apple"><p>c</p></tct-complex-selector></tct-input-group></div>`,
    );
    const el = root.querySelector<TctComplexSelector>('tct-complex-selector')!;
    await el.updateComplete;
    await nextFrame();
    expect(el.shadowRoot!.querySelector('[part~="label"]')).toBeNull();
    if (isChromium) expect((await axNode(trigger(el))).name).toBe('Fruit');
  });

  it('lays out right to left and aligns the popover to the start edge', async () => {
    const el = await make('label="Fruit" width="300"', CONTENT, {dir: 'rtl'});
    await openByClick(el);
    const box = part(el, 'input')!.getBoundingClientRect();
    expect(Math.abs(surfaceOf(el).getBoundingClientRect().right - box.right)).toBeLessThan(2);
  });

  it('draws readable surfaces in forced colours', async () => {
    const el = await make();
    await openByClick(el);
    const restore = await emulateMedia({forcedColors: 'active'});
    await nextFrame();
    expect(getComputedStyle(surfaceOf(el)).borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
    await restore();
  });

  it('reads German chrome from the nearest lang', async () => {
    const el = await make('label="Obst"', CONTENT, {lang: 'de-DE'});
    await waitUntil(
      () => part(el, 'placeholder')?.textContent.trim() === 'Auswählen…',
      'German placeholder',
      4000,
    );
  });
});

const parity = Object.values(
  import.meta.glob<{
    entries: {'core.complex-selector': {keyboard: {keys: string; action: string; when?: string}[]}};
  }>('./parity.json', {eager: true, import: 'default'}),
)[0]!;

runKeyboardSuite({
  tag: 'tct-complex-selector',
  render: () => `<tct-complex-selector label="Fruit">${CONTENT}</tct-complex-selector>`,
  table: parity.entries['core.complex-selector'].keyboard,
  steps: {
    'Opens the popover and moves focus into it': {
      focus: (element) => trigger(element as TctComplexSelector),
      keys: ['ArrowDown'],
      rtl: {},
      expect: async ({element}) => {
        const el = element as TctComplexSelector;
        await waitUntil(() => el.open && isShown(el), 'opened');
        await waitUntil(
          () => deepActiveElement() === el.querySelector('[data-value="apple"]'),
          'focus inside',
        );
      },
    },
    'Opens or closes the popover': {
      focus: (element) => trigger(element as TctComplexSelector),
      keys: ['Enter', 'Enter'],
      expect: async ({element}) => {
        const el = element as TctComplexSelector;
        // The second Enter lands inside the popover (focus moved there), on the first radio: it does not toggle.
        await waitUntil(() => el.open, 'still open');
      },
    },
    'Closes the popover and returns focus to the trigger': {
      setup: async (element) => {
        await (element as TctComplexSelector).show();
      },
      focus: (element) => trigger(element as TctComplexSelector),
      keys: ['Escape'],
      expect: async ({element}) => {
        const el = element as TctComplexSelector;
        await waitUntil(() => !el.open && !isShown(el), 'closed');
        await waitUntil(() => deepActiveElement() === trigger(el), 'focus returned');
      },
    },
    'Moves between the controls of the content and wraps at the ends': {
      setup: async (element) => {
        await (element as TctComplexSelector).show();
        await waitUntil(
          () => deepActiveElement() === element.querySelector('[data-value="apple"]'),
          'focus inside',
        );
      },
      focus: (element) => element.querySelector<HTMLElement>('[data-value="apple"]'),
      keys: ['Tab', 'Tab'],
      expect: ({element}) => {
        expect(deepActiveElement()).toBe(element.querySelector('[data-value="apple"]'));
      },
    },
  },
});

runOverlaySuite({
  tag: 'tct-complex-selector',
  render: ({attributes = '', children = ''}) =>
    `<tct-complex-selector label="Fruit" ${attributes}><button type="button">Inside</button>${children}</tct-complex-selector><div style="block-size:320px"></div>`,
  trigger: (el) => trigger(el as TctComplexSelector),
  surface: (el) => el.shadowRoot!.querySelector<HTMLElement>('.surface'),
});
