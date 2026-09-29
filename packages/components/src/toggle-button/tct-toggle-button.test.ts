/**
 * tct-toggle-button: naming, pressed state, the cancelable tct-pressed-change, pressedChangeAction
 * (optimistic, interruptible, restored on rejection), disabled with a tooltip, and the real button
 * inside a tct-toggle-button-group and a tct-button-group. Names follow upstream ToggleButton.test.tsx.
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {describe, expect, it, vi} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {expectEventFlags, recordEvents} from '@tecton-astryx/testing/events.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {pressKeys, tabSequence} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {aTimeout, nextFrame} from '@tecton-astryx/testing/timing.js';
import '../button-group/define.js';
import type {TctButton} from '../button/tct-button.js';
import './define.js';
import type {TctToggleButton} from './tct-toggle-button.js';
import type {TctToggleButtonGroup} from './tct-toggle-button-group.js';

const button = (toggle: TctToggleButton): TctButton =>
  toggle.shadowRoot!.querySelector<TctButton>('tct-button')!;
const inner = (toggle: TctToggleButton): HTMLElement =>
  button(toggle).shadowRoot!.querySelector<HTMLElement>('.button')!;

async function make(attributes = 'label="Bold"', content = ''): Promise<TctToggleButton> {
  const wrapper = await fixture<HTMLElement>(
    `<div><tct-toggle-button ${attributes}>${content}</tct-toggle-button></div>`,
  );
  const toggle = wrapper.querySelector<TctToggleButton>('tct-toggle-button')!;
  await toggle.updateComplete;
  await button(toggle).updateComplete;
  return toggle;
}

/** Clicks with the real pointer and waits for the activation (it runs after the event dispatched). */
async function click(toggle: HTMLElement): Promise<void> {
  await userEvent.click(toggle);
  await aTimeout(30);
}

runElementSuite({
  tag: 'tct-toggle-button',
  render: () => html`<tct-toggle-button label="Bold"></tct-toggle-button>`,
  properties: {
    label: 'Italic',
    pressed: true,
    value: 'italic',
    size: 'lg',
    elevation: 'high',
    icon: 'check',
    pressedIcon: 'add',
    tooltip: 'Tip',
  },
  attributes: {label: 'label', pressed: 'pressed', size: 'size', elevation: 'elevation'},
  events: ['tct-pressed-change'],
});

describe('tct-toggle-button: elevation (ToggleButton.test.tsx)', () => {
  it('reflects the elevation and passes it to the inner button', async () => {
    const toggle = await make('label="Bold" elevation="med"');
    expect(toggle.getAttribute('elevation')).toBe('med');
    await button(toggle).updateComplete;
    expect(button(toggle).elevation).toBe('med');
  });

  it('defaults to flat (elevation none)', async () => {
    const toggle = await make();
    expect(toggle.elevation).toBe('none');
    expect(button(toggle).elevation).toBe('none');
  });

  it('is retained inside a group: grouped toggles keep their own elevation', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<tct-toggle-button-group label="Text"><tct-toggle-button value="b" label="Bold" elevation="high"></tct-toggle-button></tct-toggle-button-group>',
    );
    const toggle = wrapper.querySelector<TctToggleButton>('tct-toggle-button')!;
    await toggle.updateComplete;
    expect(button(toggle).elevation).toBe('high');
  });
});

describe('tct-toggle-button: rendering (ToggleButton.test.tsx)', () => {
  it('renders with label as visible text', async () => {
    const toggle = await make();
    expect(inner(toggle).textContent).toContain('Bold');
    expect(await axNode(inner(toggle))).toMatchObject({role: 'button', name: 'Bold'});
  });

  it('renders children instead of label when provided', async () => {
    const toggle = await make('label="Bold"', 'Strong');
    expect(button(toggle).textContent).toBe('');
    expect(await axNode(inner(toggle))).toMatchObject({role: 'button'});
    expect(toggle.textContent).toBe('Strong');
    const label = button(toggle).shadowRoot!.querySelector('.label')!;
    expect(label.querySelector('slot')).not.toBeNull();
  });

  it('renders an icon-only button with the label as its accessible name', async () => {
    const toggle = await make('label="Bold" icon="check" icon-only');
    expect(await axNode(inner(toggle))).toMatchObject({role: 'button', name: 'Bold'});
    expect(button(toggle).shadowRoot!.querySelector('.label')).toBeNull();
  });

  it('draws a ghost button and delegates focus to it', async () => {
    const toggle = await make();
    expect(button(toggle).variant).toBe('ghost');
    toggle.focus();
    expect(toggle.shadowRoot!.activeElement).toBe(button(toggle));
  });

  it('does not create an empty icon slot inside the button', async () => {
    const toggle = await make();
    expect(button(toggle).querySelector('slot[slot="icon"]')).toBeNull();
    expect(button(toggle).shadowRoot!.querySelector('.icon-slot')).toBeNull();
  });

  it('forwards a slotted icon and a slotted pressed-icon', async () => {
    const toggle = await make(
      'label="Star" icon-only',
      '<tct-icon slot="icon" name="check"></tct-icon><tct-icon slot="pressed-icon" name="add"></tct-icon>',
    );
    expect(button(toggle).querySelector('slot[name="icon"]')).not.toBeNull();
    toggle.pressed = true;
    await toggle.updateComplete;
    expect(button(toggle).querySelector('slot[name="pressed-icon"]')).not.toBeNull();
    expect(button(toggle).querySelector('slot[name="icon"]')).toBeNull();
  });
});

describe('tct-toggle-button: pressed state (ToggleButton.test.tsx)', () => {
  it('sets aria-pressed=false when not pressed', async () => {
    const toggle = await make();
    expect(inner(toggle).getAttribute('aria-pressed')).toBe('false');
    expect(await axNode(inner(toggle))).toMatchObject({role: 'button', pressed: 'false'});
  });

  it('sets aria-pressed=true when pressed, and the :state(pressed) flag', async () => {
    const toggle = await make('label="Bold" pressed');
    expect(inner(toggle).getAttribute('aria-pressed')).toBe('true');
    expect(await axNode(inner(toggle))).toMatchObject({pressed: 'true'});
    expect(toggle.matches(':state(pressed)')).toBe(true);
  });

  it('fires tct-pressed-change with true when clicking an unpressed button, and presses it', async () => {
    const toggle = await make();
    const events = recordEvents(toggle, ['tct-pressed-change']);
    await click(toggle);
    expect(events.events.map((e) => (e as CustomEvent & {pressed: boolean}).pressed)).toEqual([
      true,
    ]);
    expect(toggle.pressed).toBe(true);
    expect(toggle.hasAttribute('pressed')).toBe(true);
    await toggle.updateComplete;
    expect(inner(toggle).getAttribute('aria-pressed')).toBe('true');
  });

  it('fires tct-pressed-change with false when clicking a pressed button, and releases it', async () => {
    const toggle = await make('label="Bold" pressed');
    const events = recordEvents(toggle, ['tct-pressed-change']);
    await click(toggle);
    expect(events.events.map((e) => (e as CustomEvent & {pressed: boolean}).pressed)).toEqual([
      false,
    ]);
    expect(toggle.pressed).toBe(false);
  });

  it('the intent event is cancelable, bubbles and is composed, with reason trigger', async () => {
    const toggle = await make();
    const events = recordEvents(toggle, ['tct-pressed-change']);
    await click(toggle);
    expectEventFlags(events.events[0]!, {bubbles: true, composed: true, cancelable: true});
    expect((events.events[0] as CustomEvent & {reason: string}).reason).toBe('trigger');
  });

  it('a controlled binding cancels the event and sets pressed itself', async () => {
    const toggle = await make();
    toggle.addEventListener('tct-pressed-change', (event) => {
      event.preventDefault();
    });
    await click(toggle);
    expect(toggle.pressed).toBe(false);
    toggle.pressed = true;
    await toggle.updateComplete;
    expect(inner(toggle).getAttribute('aria-pressed')).toBe('true');
  });

  it('writing pressed or the attribute never fires an event', async () => {
    const toggle = await make();
    const events = recordEvents(toggle, ['tct-pressed-change']);
    toggle.pressed = true;
    toggle.toggleAttribute('pressed', false);
    await toggle.updateComplete;
    expect(events.events).toHaveLength(0);
  });

  it('renders pressedIcon when pressed', async () => {
    const toggle = await make('label="Star" icon="check" pressed-icon="add" pressed icon-only');
    expect(button(toggle).icon).toBe('add');
  });

  it('renders icon when not pressed even if pressedIcon is provided', async () => {
    const toggle = await make('label="Star" icon="check" pressed-icon="add" icon-only');
    expect(button(toggle).icon).toBe('check');
  });

  it('falls back to icon when pressed without a pressedIcon', async () => {
    const toggle = await make('label="Star" icon="check" pressed icon-only');
    expect(button(toggle).icon).toBe('check');
  });

  it('does not fire events when disabled', async () => {
    const toggle = await make('label="Bold" disabled');
    const events = recordEvents(toggle, ['tct-pressed-change']);
    await userEvent.click(toggle, {force: true}).catch(() => undefined);
    toggle.click();
    await aTimeout(20);
    expect(events.events).toHaveLength(0);
    expect(toggle.pressed).toBe(false);
  });

  it('host.click() toggles once, like a native button', async () => {
    const toggle = await make();
    const clicks = vi.fn();
    toggle.addEventListener('click', clicks);
    const events = recordEvents(toggle, ['tct-pressed-change']);
    toggle.click();
    await aTimeout(20);
    expect(events.events).toHaveLength(1);
    expect(clicks).toHaveBeenCalledTimes(1);
    expect(toggle.pressed).toBe(true);
  });

  it('toggles from the keyboard with Enter and Space', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><button id="before">b</button><tct-toggle-button label="Bold"></tct-toggle-button></div>',
    );
    const toggle = wrapper.querySelector<TctToggleButton>('tct-toggle-button')!;
    await toggle.updateComplete;
    wrapper.querySelector<HTMLButtonElement>('#before')!.focus();
    await pressKeys('Tab');
    await pressKeys('Enter');
    await aTimeout(20);
    expect(toggle.pressed).toBe(true);
    await pressKeys('Space');
    await aTimeout(20);
    expect(toggle.pressed).toBe(false);
  });

  it('has one tab stop', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><button id="before">b</button><tct-toggle-button label="Bold"></tct-toggle-button><button id="after">a</button></div>',
    );
    const stops = await tabSequence(wrapper, {
      start: wrapper.querySelector<HTMLElement>('#before')!,
    });
    expect(stops[0]).toBe(inner(wrapper.querySelector<TctToggleButton>('tct-toggle-button')!));
    expect(stops[1]?.id).toBe('after');
  });
});

describe('tct-toggle-button: pressedChangeAction (ToggleButton.test.tsx)', () => {
  const deferred = () => {
    const resolvers: {resolve: () => void; reject: (error: Error) => void}[] = [];
    const action = vi.fn(
      (_pressed: boolean) =>
        new Promise<void>((resolve, reject) => {
          resolvers.push({resolve, reject});
        }),
    );
    return {action, resolvers};
  };

  it('shows the optimistic pressed state and stays interruptible while pending', async () => {
    const toggle = await make('label="Favorite"');
    const {action, resolvers} = deferred();
    toggle.pressedChangeAction = action;
    await toggle.updateComplete;
    await click(toggle);
    await button(toggle).updateComplete;
    expect(action).toHaveBeenCalledWith(true);
    expect(inner(toggle).getAttribute('aria-pressed')).toBe('true');
    expect(inner(toggle).getAttribute('aria-busy')).toBe('true');
    expect(inner(toggle)).toHaveProperty('disabled', false);
    resolvers[0]!.resolve();
    await aTimeout(20);
  });

  it('clears the busy state once the action settles', async () => {
    const toggle = await make('label="Favorite"');
    const {action, resolvers} = deferred();
    toggle.pressedChangeAction = action;
    await toggle.updateComplete;
    await click(toggle);
    await button(toggle).updateComplete;
    expect(inner(toggle).getAttribute('aria-busy')).toBe('true');
    resolvers[0]!.resolve();
    await aTimeout(30);
    await button(toggle).updateComplete;
    expect(inner(toggle).hasAttribute('aria-busy')).toBe(false);
    expect(inner(toggle)).toHaveProperty('disabled', false);
    expect(toggle.pressed).toBe(true);
  });

  it('interrupts an in-flight action on re-click (true -> false -> true)', async () => {
    const toggle = await make('label="Favorite"');
    const {action, resolvers} = deferred();
    toggle.pressedChangeAction = action;
    await toggle.updateComplete;
    await click(toggle);
    await click(toggle);
    await click(toggle);
    expect(action.mock.calls.map(([pressed]) => pressed)).toEqual([true, false, true]);
    expect(toggle.pressed).toBe(true);
    for (const {resolve} of resolvers) resolve();
    await aTimeout(30);
  });

  it('supports a synchronous pressedChangeAction', async () => {
    const toggle = await make('label="Favorite"');
    const action = vi.fn();
    toggle.pressedChangeAction = action;
    await toggle.updateComplete;
    await click(toggle);
    expect(action).toHaveBeenCalledWith(true);
    await button(toggle).updateComplete;
    expect(inner(toggle).hasAttribute('aria-busy')).toBe(false);
    expect(toggle.pressed).toBe(true);
  });

  it('runs the intent event before the action, with the same next state', async () => {
    const toggle = await make('label="Favorite"');
    const order: string[] = [];
    toggle.addEventListener('tct-pressed-change', (event) => {
      order.push(`event:${String((event as unknown as {pressed: boolean}).pressed)}`);
    });
    toggle.pressedChangeAction = (pressed) => {
      order.push(`action:${String(pressed)}`);
    };
    await toggle.updateComplete;
    await click(toggle);
    expect(order).toEqual(['event:true', 'action:true']);
  });

  it('keeps event-only toggles synchronous without pending feedback', async () => {
    const toggle = await make('label="Favorite"');
    await click(toggle);
    await button(toggle).updateComplete;
    expect(inner(toggle).hasAttribute('aria-busy')).toBe(false);
  });

  it('runs an action without a listener, settling to the new state', async () => {
    const toggle = await make('label="Favorite"');
    const {action, resolvers} = deferred();
    toggle.pressedChangeAction = action;
    await toggle.updateComplete;
    await click(toggle);
    resolvers[0]!.resolve();
    await aTimeout(30);
    expect(toggle.pressed).toBe(true);
  });

  it('skips pressedChangeAction when tct-pressed-change is cancelled', async () => {
    const toggle = await make('label="Favorite"');
    const action = vi.fn();
    toggle.pressedChangeAction = action;
    toggle.addEventListener('tct-pressed-change', (event) => {
      event.preventDefault();
    });
    await toggle.updateComplete;
    await click(toggle);
    expect(action).not.toHaveBeenCalled();
    expect(toggle.pressed).toBe(false);
  });

  it('restores the previous state when the action rejects', async () => {
    const toggle = await make('label="Favorite"');
    const {action, resolvers} = deferred();
    toggle.pressedChangeAction = action;
    await toggle.updateComplete;
    const unhandled = vi.fn();
    const onError = (event: PromiseRejectionEvent): void => {
      event.preventDefault();
      unhandled(event.reason);
    };
    window.addEventListener('unhandledrejection', onError);
    try {
      await click(toggle);
      expect(toggle.pressed).toBe(true);
      resolvers[0]!.reject(new Error('nope'));
      await aTimeout(50);
    } finally {
      window.removeEventListener('unhandledrejection', onError);
    }
    expect(toggle.pressed).toBe(false);
  });
});

describe('tct-toggle-button: disabled state (ToggleButton.test.tsx)', () => {
  it('a tooltip-bearing disabled toggle stays focusable but inert', async () => {
    const toggle = await make('label="Bold" disabled tooltip="Needs a selection"');
    const events = recordEvents(toggle, ['tct-pressed-change']);
    toggle.focus();
    expect(toggle.shadowRoot!.activeElement).toBe(button(toggle));
    expect(inner(toggle).getAttribute('aria-disabled')).toBe('true');
    await click(toggle);
    expect(events.events).toHaveLength(0);
    expect(toggle.pressed).toBe(false);
  });

  it('still toggles an enabled toggle that carries the same tooltip', async () => {
    const toggle = await make('label="Bold" tooltip="Needs a selection"');
    await click(toggle);
    expect(toggle.pressed).toBe(true);
  });
});

describe('tct-toggle-button: inside tct-toggle-button-group (single)', () => {
  async function group(
    attributes = 'label="View mode" value="list"',
  ): Promise<TctToggleButtonGroup> {
    const wrapper = await fixture<HTMLElement>(
      `<tct-toggle-button-group ${attributes}>
        <tct-toggle-button value="list" label="List"></tct-toggle-button>
        <tct-toggle-button value="grid" label="Grid"></tct-toggle-button>
        <tct-toggle-button value="table" label="Table"></tct-toggle-button>
      </tct-toggle-button-group>`,
    );
    const element = wrapper as unknown as TctToggleButtonGroup;
    await element.updateComplete;
    await nextFrame();
    return element;
  }
  const items = (element: Element): TctToggleButton[] => [
    ...element.querySelectorAll<TctToggleButton>('tct-toggle-button'),
  ];
  const states = (element: Element): string[] =>
    items(element).map((item) => inner(item).getAttribute('aria-pressed')!);

  it('renders a group with role="group" and its label', async () => {
    const element = await group();
    expect(await axNode(element)).toMatchObject({role: 'group', name: 'View mode'});
  });

  it('marks the selected button as pressed', async () => {
    const element = await group();
    expect(states(element)).toEqual(['true', 'false', 'false']);
  });

  it('selects a different button on click and fires tct-value-change from the group', async () => {
    const element = await group();
    const events = recordEvents(element, ['tct-value-change', 'tct-pressed-change']);
    await click(items(element)[1]!);
    expect(events.events.map((e) => e.type)).toEqual(['tct-value-change']);
    expect(element.value).toBe('grid');
    await nextFrame();
    expect(states(element)).toEqual(['false', 'true', 'false']);
  });

  it('allows deselection by clicking the active button', async () => {
    const element = await group();
    await click(items(element)[0]!);
    expect(element.value).toBeNull();
    await nextFrame();
    expect(states(element)).toEqual(['false', 'false', 'false']);
  });

  it('a cancelled tct-value-change keeps the selection', async () => {
    const element = await group();
    element.addEventListener('tct-value-change', (event) => {
      event.preventDefault();
    });
    await click(items(element)[2]!);
    expect(element.value).toBe('list');
    expect(states(element)).toEqual(['true', 'false', 'false']);
  });

  it('the group owns the selection even when a member has standalone handlers', async () => {
    const element = await group();
    const member = items(element)[1]!;
    const action = vi.fn();
    member.pressedChangeAction = action;
    const events = recordEvents(member, ['tct-pressed-change']);
    await click(member);
    expect(events.events).toHaveLength(0);
    expect(action).not.toHaveBeenCalled();
    expect(element.value).toBe('grid');
  });

  it('a member size is the group size unless it sets its own', async () => {
    const element = await group('label="View mode" size="sm"');
    const [a, b] = items(element);
    b!.size = 'lg';
    await b!.updateComplete;
    await nextFrame();
    expect(inner(a!).getAttribute('data-size')).toBe('sm');
    expect(inner(b!).getAttribute('data-size')).toBe('lg');
  });

  it('every button is a tab stop', async () => {
    const element = await group();
    element.insertAdjacentHTML('beforebegin', '<button id="before">b</button>');
    const stops = await tabSequence(element, {
      start: document.getElementById('before')!,
    });
    expect(stops.slice(0, 3)).toEqual(items(element).map((item) => inner(item)));
  });
});

describe('tct-toggle-button: inside tct-toggle-button-group (multiple)', () => {
  async function group(attributes = 'label="Text style" type="multiple" value="bold"') {
    const wrapper = await fixture<HTMLElement>(
      `<tct-toggle-button-group ${attributes}>
        <tct-toggle-button value="bold" label="Bold"></tct-toggle-button>
        <tct-toggle-button value="italic" label="Italic"></tct-toggle-button>
        <tct-toggle-button value="underline" label="Underline"></tct-toggle-button>
      </tct-toggle-button-group>`,
    );
    const element = wrapper as unknown as TctToggleButtonGroup;
    await element.updateComplete;
    await nextFrame();
    return element;
  }
  const items = (element: Element): TctToggleButton[] => [
    ...element.querySelectorAll<TctToggleButton>('tct-toggle-button'),
  ];

  it('marks selected buttons as pressed', async () => {
    const element = await group('label="Text style" type="multiple" value="bold underline"');
    expect(items(element).map((item) => inner(item).getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'true',
    ]);
  });

  it('adds a value when clicking an unpressed button', async () => {
    const element = await group();
    await click(items(element)[1]!);
    expect(element.value).toEqual(['bold', 'italic']);
  });

  it('removes a value when clicking a pressed button', async () => {
    const element = await group();
    await click(items(element)[0]!);
    expect(element.value).toEqual([]);
  });
});

describe('tct-toggle-button: group disabled state (ToggleButton.test.tsx)', () => {
  const build = async (groupAttributes: string, memberAttributes = '') => {
    const wrapper = await fixture<HTMLElement>(
      `<tct-toggle-button-group label="G" ${groupAttributes}>
        <tct-toggle-button value="a" label="A" ${memberAttributes}></tct-toggle-button>
        <tct-toggle-button value="b" label="B"></tct-toggle-button>
      </tct-toggle-button-group>`,
    );
    const element = wrapper as unknown as TctToggleButtonGroup;
    await element.updateComplete;
    await nextFrame();
    return [...element.querySelectorAll<TctToggleButton>('tct-toggle-button')];
  };

  it('keeps a member disabled when the group disables nothing', async () => {
    const [a, b] = await build('', 'disabled');
    expect(inner(a!).hasAttribute('disabled')).toBe(true);
    expect(inner(b!).hasAttribute('disabled')).toBe(false);
  });

  it('leaves the rest of an enabled group selectable', async () => {
    const [a, b] = await build('', 'disabled');
    await click(b!);
    expect(b!.matches(':state(pressed)')).toBe(true);
    expect(a!.matches(':state(pressed)')).toBe(false);
  });

  it('disables a member that says nothing when the group is disabled', async () => {
    const [a, b] = await build('disabled');
    expect(inner(a!).hasAttribute('disabled')).toBe(true);
    expect(inner(b!).hasAttribute('disabled')).toBe(true);
  });

  it('a member cannot re-enable itself inside a disabled group', async () => {
    const [a] = await build('disabled');
    a!.disabled = false;
    await a!.updateComplete;
    await nextFrame();
    expect(inner(a!).hasAttribute('disabled')).toBe(true);
  });
});

describe('tct-toggle-button: inside tct-button-group', () => {
  it('takes its corners and size from the button group, and stays toggleable', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<tct-button-group label="Formatting" size="sm">
        <tct-toggle-button label="Bold"></tct-toggle-button>
        <tct-toggle-button label="Italic"></tct-toggle-button>
        <tct-toggle-button label="Underline"></tct-toggle-button>
      </tct-button-group>`,
    );
    await nextFrame();
    await aTimeout(30);
    const toggles = [...wrapper.querySelectorAll<TctToggleButton>('tct-toggle-button')];
    for (const toggle of toggles) await toggle.updateComplete;
    expect(toggles.map((toggle) => inner(toggle).dataset.position)).toEqual([
      'first',
      'middle',
      'last',
    ]);
    expect(inner(toggles[0]!).dataset.size).toBe('sm');
    await click(toggles[1]!);
    expect(toggles[1]!.pressed).toBe(true);
  });
});

describe('tct-toggle-button: appearance, accessibility, RTL, forced colours', () => {
  const colorOf = async (token: string, property: 'color' | 'backgroundColor') => {
    const probe = await fixture<HTMLElement>('<span>x</span>');
    probe.style[property] = `var(${token})`;
    return getComputedStyle(probe)[property];
  };

  it('a pressed toggle paints Tecton activated fill and ink', async () => {
    const toggle = await make('label="Bold" pressed');
    const control = inner(toggle);
    expect(getComputedStyle(control).backgroundColor).toBe(
      await colorOf('--tecton-color-toggle-button-activated-fill', 'backgroundColor'),
    );
    expect(getComputedStyle(control).color).toBe(
      await colorOf('--tecton-color-toggle-button-activated-text', 'color'),
    );
  });

  it('a released toggle keeps the ghost fill', async () => {
    const toggle = await make();
    expect(getComputedStyle(inner(toggle)).backgroundColor).not.toBe(
      await colorOf('--tecton-color-toggle-button-activated-fill', 'backgroundColor'),
    );
  });

  it('passes axe: released, pressed, icon-only, disabled, busy, in a group', async () => {
    await expectAccessible(await make());
    await expectAccessible(await make('label="Bold" pressed'));
    await expectAccessible(await make('label="Bold" icon="check" icon-only pressed'));
    await expectAccessible(await make('label="Bold" disabled'));
    await expectAccessible(await make('label="Bold" loading'));
    const wrapper = await fixture<HTMLElement>(
      '<tct-toggle-button-group label="Text" type="multiple" value="b"><tct-toggle-button value="b" label="Bold"></tct-toggle-button><tct-toggle-button value="i" label="Italic"></tct-toggle-button></tct-toggle-button-group>',
    );
    await nextFrame();
    await expectAccessible(wrapper);
  });

  it('exposes the pressed state on the accessible button', async () => {
    const toggle = await make('label="Bold" icon="check" icon-only pressed');
    expect(await axNode(inner(toggle))).toMatchObject({
      role: 'button',
      name: 'Bold',
      pressed: 'true',
    });
  });

  it('lays out mirrored in right-to-left', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div dir="rtl"><tct-toggle-button label="Bold" icon="check"></tct-toggle-button></div>',
    );
    const toggle = wrapper.querySelector<TctToggleButton>('tct-toggle-button')!;
    await toggle.updateComplete;
    await button(toggle).updateComplete;
    const icon = button(toggle).shadowRoot!.querySelector('.icon-slot')!.getBoundingClientRect();
    const label = button(toggle).shadowRoot!.querySelector('.label')!.getBoundingClientRect();
    expect(icon.left).toBeGreaterThanOrEqual(label.right - 1);
  });

  it.skipIf(!isChromium)('paints a pressed toggle as Highlight in forced colours', async () => {
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const toggle = await make('label="Bold" pressed icon-only icon="check"');
      const pressed = getComputedStyle(inner(toggle));
      const released = getComputedStyle(inner(await make('label="Bold" icon-only icon="check"')));
      expect(pressed.backgroundColor).not.toBe(released.backgroundColor);
    } finally {
      await restore();
    }
  });
});
