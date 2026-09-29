/**
 * `tct-toggle-button-group`: group semantics, single and multiple selection, the cancelable
 * `tct-value-change`, disabled and size cascade. Members are a test consumer of the group context (what
 * `tct-toggle-button` reads), so the group is tested on its own; `tct-toggle-button.test.ts` covers the
 * real button inside a group. Names follow upstream `ToggleButton.test.tsx` (group sections).
 */
import {html} from 'lit';
import {property} from 'lit/decorators.js';
import {userEvent} from 'vitest/browser';
import {beforeAll, describe, expect, it} from 'vitest';
import {ContextConsumer} from '@tecton-astryx/core/context/protocol.js';
import {defineElement} from '@tecton-astryx/core/define.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {expectEventFlags, recordEvents} from '@tecton-astryx/testing/events.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {pressKeys, tabSequence} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {nextFrame} from '@tecton-astryx/testing/timing.js';
import {toggleButtonGroupContext} from './toggle-button.context.js';
import type {TctToggleButtonGroup} from './tct-toggle-button-group.js';
import './define.js';

/** A member that reads the group context the way `tct-toggle-button` does. */
class TctTestToggle extends TctElement {
  static override readonly tagName = 'tct-test-toggle';
  static override shadowRootOptions = {...TctElement.shadowRootOptions, delegatesFocus: true};
  @property() value = '';
  @property({type: Boolean, reflect: true}) disabled = false;
  readonly #group = new ContextConsumer(this, {context: toggleButtonGroupContext, subscribe: true});
  get groupSize(): string | undefined {
    return this.#group.value?.size;
  }
  override render() {
    const group = this.#group.value;
    const pressed = group && this.value ? group.isPressed(this.value) : false;
    return html`<button
      type="button"
      aria-pressed=${String(pressed)}
      ?disabled=${this.disabled || group?.disabled}
      @click=${(event: Event) => {
        if (group && this.value) group.toggle(this.value, event);
      }}
    >
      <slot></slot>
    </button>`;
  }
}

beforeAll(() => {
  defineElement(TctTestToggle);
});

const toggles = (labels: string[]): string =>
  labels
    .map((label) => `<tct-test-toggle value="${label.toLowerCase()}">${label}</tct-test-toggle>`)
    .join('');

async function group(
  attributes = 'label="View mode"',
  inner = toggles(['List', 'Grid', 'Table']),
  wrapperAttributes = '',
): Promise<TctToggleButtonGroup> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div ${wrapperAttributes}><button id="before">before</button><tct-toggle-button-group ${attributes}>${inner}</tct-toggle-button-group><button id="after">after</button></div>`,
  );
  const element = wrapper.querySelector('tct-toggle-button-group')!;
  await element.updateComplete;
  await nextFrame();
  return element;
}

const members = (element: Element): TctTestToggle[] => [...element.children] as TctTestToggle[];
const inner = (member: Element): HTMLButtonElement => member.shadowRoot!.querySelector('button')!;
const pressed = (element: Element): string[] =>
  members(element).map((member) => inner(member).getAttribute('aria-pressed')!);

runElementSuite({
  tag: 'tct-toggle-button-group',
  render: () =>
    html`<tct-toggle-button-group label="View mode"
      ><tct-test-toggle value="a">A</tct-test-toggle></tct-toggle-button-group
    >`,
  properties: {type: 'multiple', orientation: 'vertical', size: 'lg', disabled: true},
  attributes: {type: 'type', orientation: 'orientation', size: 'size'},
  events: ['tct-value-change'],
});

describe('tct-toggle-button-group: rendering', () => {
  it('renders a group with role="group" and its label as the name', async () => {
    const element = await group();
    expect(await axNode(element)).toMatchObject({role: 'group', name: 'View mode'});
  });

  it('a host aria-label wins over the label property', async () => {
    const element = await group('label="View mode" aria-label="Layout"');
    expect(await axNode(element)).toMatchObject({name: 'Layout'});
  });

  it('lays members out with a gap, and stacks them when vertical', async () => {
    const element = await group();
    const [a, b] = members(element).map((member) => member.getBoundingClientRect());
    expect(b!.left).toBeGreaterThan(a!.right);
    element.orientation = 'vertical';
    await element.updateComplete;
    const [c, d] = members(element).map((member) => member.getBoundingClientRect());
    expect(d!.top).toBeGreaterThanOrEqual(c!.bottom);
    expect(Math.abs(d!.left - c!.left)).toBeLessThan(1);
  });

  it('every member stays a tab stop: the group adds no roving focus', async () => {
    const element = await group();
    const stops = await tabSequence(element, {
      start: element.parentElement!.querySelector<HTMLElement>('#before')!,
    });
    expect(stops.slice(0, 3)).toHaveLength(3);
    expect(stops[3]?.id).toBe('after');
  });

  it('provides its size to the members (explicit, else md)', async () => {
    const element = await group();
    expect(members(element)[0]!.groupSize).toBe('md');
    element.size = 'sm';
    await element.updateComplete;
    await nextFrame();
    expect(members(element)[0]!.groupSize).toBe('sm');
  });

  it('is axe clean: none, some pressed, disabled', async () => {
    for (const attributes of [
      'label="View mode"',
      'label="View mode" value="grid"',
      'label="View mode" disabled',
    ]) {
      await expectAccessible(await group(attributes));
    }
  });
});

describe('tct-toggle-button-group: single', () => {
  it('marks the button matching the value attribute as pressed', async () => {
    const element = await group('label="View mode" value="grid"');
    expect(pressed(element)).toEqual(['false', 'true', 'false']);
    expect(element.value).toBe('grid');
  });

  it('selects a different button on click', async () => {
    const element = await group('label="View mode" value="list"');
    await userEvent.click(inner(members(element)[1]!));
    expect(pressed(element)).toEqual(['false', 'true', 'false']);
    expect(element.value).toBe('grid');
  });

  it('allows deselection by clicking the pressed button (value becomes null)', async () => {
    const element = await group('label="View mode" value="list"');
    await userEvent.click(inner(members(element)[0]!));
    expect(pressed(element)).toEqual(['false', 'false', 'false']);
    expect(element.value).toBeNull();
  });

  it('fires a cancelable, bubbling, composed tct-value-change before the change', async () => {
    const element = await group('label="View mode" value="list"');
    const recorder = recordEvents(element, ['tct-value-change']);
    let atIntent: unknown;
    element.addEventListener('tct-value-change', () => {
      atIntent = element.value;
    });
    await userEvent.click(inner(members(element)[1]!));
    expect(atIntent).toBe('list');
    expect(recorder.events).toHaveLength(1);
    expect(recorder.events[0]!.value).toBe('grid');
    expect((recorder.events[0] as unknown as {oldValue: unknown}).oldValue).toBe('list');
    expect(recorder.events[0]!.reason).toBe('trigger');
    expectEventFlags(recorder.events[0]!, {bubbles: true, composed: true, cancelable: true});
  });

  it('preventDefault() keeps the selection (controlled use); a property write applies it', async () => {
    const element = await group('label="View mode" value="list"');
    element.addEventListener('tct-value-change', (event) => {
      event.preventDefault();
    });
    await userEvent.click(inner(members(element)[1]!));
    expect(pressed(element)).toEqual(['true', 'false', 'false']);
    element.value = 'table';
    await element.updateComplete;
    await nextFrame();
    expect(pressed(element)).toEqual(['false', 'false', 'true']);
  });

  it('property and attribute writes fire no events', async () => {
    const element = await group();
    const recorder = recordEvents(element, ['tct-value-change', 'input', 'change']);
    element.value = 'grid';
    element.setAttribute('type', 'multiple');
    await element.updateComplete;
    expect(recorder.events).toEqual([]);
  });
});

describe('tct-toggle-button-group: multiple', () => {
  it('marks several buttons as pressed from a space separated value', async () => {
    const element = await group('label="View mode" type="multiple" value="list table"');
    expect(pressed(element)).toEqual(['true', 'false', 'true']);
    expect(element.value).toEqual(['list', 'table']);
  });

  it('adds a value when clicking an unpressed button and removes it when clicking a pressed one', async () => {
    const element = await group('label="View mode" type="multiple" value="list"');
    const recorder = recordEvents(element, ['tct-value-change']);
    await userEvent.click(inner(members(element)[1]!));
    expect(element.value).toEqual(['list', 'grid']);
    await userEvent.click(inner(members(element)[0]!));
    expect(element.value).toEqual(['grid']);
    expect(recorder.events.map((event) => event.value)).toEqual([['list', 'grid'], ['grid']]);
  });

  it('accepts an array property', async () => {
    const element = await group('label="View mode" type="multiple"');
    element.value = ['grid', 'table'];
    await element.updateComplete;
    await nextFrame();
    expect(pressed(element)).toEqual(['false', 'true', 'true']);
  });
});

describe('tct-toggle-button-group: disabled state', () => {
  it('disables every member when the group is disabled, and toggles nothing', async () => {
    const element = await group('label="View mode" disabled');
    expect(members(element).every((member) => inner(member).disabled)).toBe(true);
    const recorder = recordEvents(element, ['tct-value-change']);
    inner(members(element)[0]!).click();
    expect(recorder.events).toEqual([]);
    expect(element.matches(':state(disabled)')).toBe(true);
  });

  it('keeps a member disabled when the group disables nothing, and leaves the rest selectable', async () => {
    const element = await group(
      'label="View mode"',
      '<tct-test-toggle value="a" disabled>A</tct-test-toggle><tct-test-toggle value="b">B</tct-test-toggle>',
    );
    expect(inner(members(element)[0]!).disabled).toBe(true);
    await userEvent.click(inner(members(element)[1]!));
    expect(element.value).toBe('b');
  });

  it('a member cannot re-enable itself inside a disabled group', async () => {
    const element = await group(
      'label="View mode" disabled',
      '<tct-test-toggle value="a">A</tct-test-toggle>',
    );
    members(element)[0]!.disabled = false;
    await members(element)[0]!.updateComplete;
    expect(inner(members(element)[0]!).disabled).toBe(true);
  });
});

describe('tct-toggle-button-group: keyboard, RTL and forced colours', () => {
  it('Enter and Space toggle the focused member', async () => {
    const element = await group();
    inner(members(element)[0]!).focus();
    await pressKeys('Enter');
    expect(element.value).toBe('list');
    await pressKeys('Tab', ' ');
    expect(element.value).toBe('grid');
  });

  it('lays out from the inline start in RTL', async () => {
    const element = await group('label="View mode"', toggles(['A', 'B']), 'dir="rtl"');
    const [a, b] = members(element).map((member) => member.getBoundingClientRect());
    expect(a!.left).toBeGreaterThan(b!.left);
  });

  it('renders under forced colours and stays accessible', async () => {
    await emulateMedia({forcedColors: 'active'});
    await expectAccessible(await group('label="View mode" value="grid"'));
  });
});
