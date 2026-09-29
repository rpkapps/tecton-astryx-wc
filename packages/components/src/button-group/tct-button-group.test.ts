/**
 * `tct-button-group`: role/name/state, the per-member `buttonGroupContext`, elevation, and the roving
 * keyboard model. Members are the shared test chip (a delegating wrapper around a native button) and a
 * context consumer, so the tests run before `tct-button` exists and keep working once it does.
 */
import {html} from 'lit';
import {property} from 'lit/decorators.js';
import {beforeAll, describe, expect, it} from 'vitest';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {
  buttonGroupContext,
  sizeContext,
  type ButtonGroupContextValue,
} from '@tecton-wc/core/context/keys.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {
  axNode,
  deepActiveElement,
  emulateMedia,
  expectAccessible,
  fixture,
  nextFrame,
  pressKeys,
  recordEvents,
  runElementSuite,
  runKeyboardSuite,
  tabSequence,
} from '@tecton-wc/testing/index.js';
import {TctTestChip} from '@tecton-wc/testing/fixtures/test-toolbar.js';
import type {KeyboardRow} from '@tecton-wc/testing/suites/keyboard.js';
import './define.js';
import type {TctButtonGroup} from './tct-button-group.js';

/** A member that reports what the group told it (what `tct-button` reads to square its corners). */
class TctTestMember extends TctElement {
  static override readonly tagName = 'tct-test-member';
  static override shadowRootOptions = {...TctElement.shadowRootOptions, delegatesFocus: true};
  @property({type: Boolean, reflect: true}) disabled = false;
  readonly #group: ContextConsumer<typeof buttonGroupContext> = new ContextConsumer<
    typeof buttonGroupContext
  >(this, {
    context: buttonGroupContext,
    subscribe: true,
  });
  readonly #size: ContextConsumer<typeof sizeContext> = new ContextConsumer<typeof sizeContext>(
    this,
    {
      context: sizeContext,
      subscribe: true,
    },
  );
  get received(): ButtonGroupContextValue | null | undefined {
    return this.#group.value;
  }
  get providedSize(): string | null | undefined {
    return this.#size.value;
  }
  override render() {
    const group = this.#group.value;
    return html`<button
      type="button"
      data-position=${group?.position ?? 'none'}
      data-orientation=${group?.orientation ?? 'none'}
      ?disabled=${this.disabled || group?.disabled}
    >
      <slot></slot>
    </button>`;
  }
}

beforeAll(() => {
  defineElement(TctTestChip);
  defineElement(TctTestMember);
});

const chips = (...labels: string[]): string =>
  labels.map((label) => `<tct-test-chip>${label}</tct-test-chip>`).join('');

async function group(
  attributes = 'label="Actions"',
  inner = chips('Copy', 'Cut', 'Paste'),
  wrapperAttributes = '',
): Promise<TctButtonGroup> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div ${wrapperAttributes}><button id="before">before</button>` +
      `<tct-button-group ${attributes}>${inner}</tct-button-group><button id="after">after</button></div>`,
  );
  const element = wrapper.querySelector('tct-button-group')!;
  await element.updateComplete;
  await nextFrame();
  return element;
}

const members = (element: Element): HTMLElement[] => [...element.children] as HTMLElement[];
const innerButton = (member: Element): HTMLButtonElement =>
  member.shadowRoot!.querySelector('button')!;
const activeLabel = (): string => {
  const root = deepActiveElement()?.getRootNode();
  return (root instanceof ShadowRoot ? root.host : deepActiveElement())?.textContent.trim() ?? '';
};
const tabindexes = (element: Element): (string | null)[] =>
  members(element).map((member) => innerButton(member).getAttribute('tabindex'));

// -------------------------------------------------------------------------------- element suite

runElementSuite({
  tag: 'tct-button-group',
  render: () =>
    html`<tct-button-group label="Actions"
      >${'x'}<tct-test-chip>Copy</tct-test-chip></tct-button-group
    >`,
  properties: {orientation: 'vertical', size: 'lg', elevation: 'med', disabled: true},
  attributes: {orientation: 'orientation', size: 'size', elevation: 'elevation'},
});

// ------------------------------------------------------------------------------ render and API

describe('tct-button-group: rendering', () => {
  it('renders a group with its label as the accessible name', async () => {
    const element = await group();
    expect(await axNode(element)).toMatchObject({role: 'group', name: 'Actions'});
  });

  it('renders all members in order', async () => {
    const element = await group();
    expect(members(element).map((member) => member.textContent.trim())).toEqual([
      'Copy',
      'Cut',
      'Paste',
    ]);
  });

  it('a host aria-label wins over the label property', async () => {
    const element = await group('label="Actions" aria-label="Clipboard"');
    expect(await axNode(element)).toMatchObject({role: 'group', name: 'Clipboard'});
  });

  it('reflects orientation through the reflected attribute, and never through aria-orientation', async () => {
    const element = await group('label="Actions"');
    expect(element.getAttribute('orientation')).toBe('horizontal');
    expect((await axNode(element)).orientation).toBeUndefined();
    element.orientation = 'vertical';
    await element.updateComplete;
    expect(element.getAttribute('orientation')).toBe('vertical');
    const box = element.shadowRoot!.querySelector<HTMLElement>('[part="group"]')!;
    expect(getComputedStyle(box).flexDirection).toBe('column');
  });

  it('an unknown orientation falls back to horizontal', async () => {
    const element = await group('label="Actions" orientation="diagonal"');
    const box = element.shadowRoot!.querySelector<HTMLElement>('[part="group"]')!;
    expect(getComputedStyle(box).flexDirection).toBe('row');
    expect(box.dataset.orientation).toBe('horizontal');
  });

  it('renders a single member without errors', async () => {
    const element = await group('label="Actions"', chips('Copy'));
    expect(members(element)).toHaveLength(1);
    await expectAccessible(element);
  });

  it('is axe clean with several members, vertical, and disabled', async () => {
    for (const attributes of [
      'label="Actions"',
      'label="Actions" orientation="vertical"',
      'label="Actions" disabled',
    ]) {
      const element = await group(attributes);
      await expectAccessible(element);
    }
  });

  it('sets aria-disabled only while disabled', async () => {
    const element = await group();
    const ariaDisabled = async () => (await axNode(element)).disabled;
    expect(await ariaDisabled()).toBeUndefined();
    element.disabled = true;
    await element.updateComplete;
    expect(await ariaDisabled()).toBe('true');
    expect(element.matches(':state(disabled)')).toBe(true);
    element.disabled = false;
    await element.updateComplete;
    expect(await ariaDisabled()).toBeUndefined();
  });

  it('emits no events of its own', async () => {
    const element = await group();
    const recorder = recordEvents(element, ['input', 'change', 'tct-value-change']);
    element.orientation = 'vertical';
    element.size = 'sm';
    element.disabled = true;
    await element.updateComplete;
    await pressKeys('Tab');
    expect(recorder.events).toEqual([]);
  });
});

describe('tct-button-group: elevation', () => {
  const shadowOf = (element: TctButtonGroup): string =>
    getComputedStyle(element.shadowRoot!.querySelector<HTMLElement>('[part="group"]')!).boxShadow;

  it('defaults to flat', async () => {
    const element = await group();
    expect(element.elevation).toBe('none');
    expect(shadowOf(element)).toBe('none');
  });

  it('renders a distinct shadow for each elevation level, on the group', async () => {
    const seen = new Set<string>();
    for (const elevation of ['low', 'med', 'high'] as const) {
      const element = await group(`label="Actions" elevation="${elevation}"`);
      const shadow = shadowOf(element);
      expect(shadow, elevation).not.toBe('none');
      seen.add(shadow);
      const radius = getComputedStyle(
        element.shadowRoot!.querySelector<HTMLElement>('[part="group"]')!,
      ).borderStartStartRadius;
      expect(radius, 'the shadow follows a rounded silhouette').not.toBe('0px');
    }
    expect(seen.size, 'each level differs').toBe(3);
  });

  it('the host itself draws no shadow: the members are not lifted individually', async () => {
    const element = await group('label="Actions" elevation="high"');
    expect(getComputedStyle(element).boxShadow).toBe('none');
  });
});

// --------------------------------------------------------------------------- buttonGroupContext

describe('tct-button-group: context for members', () => {
  const positions = (element: Element): string[] =>
    members(element)
      .filter((member) => member instanceof TctTestMember)
      .map((member) => member.received?.position ?? 'none');

  const consumers = (...labels: string[]): string =>
    labels.map((label) => `<tct-test-member>${label}</tct-test-member>`).join('');

  it('tells each member its own position: first, middle, last', async () => {
    const element = await group('label="Actions"', consumers('a', 'b', 'c', 'd'));
    expect(positions(element)).toEqual(['first', 'middle', 'middle', 'last']);
  });

  it('a lone member is the only one', async () => {
    const element = await group('label="Actions"', consumers('a'));
    expect(positions(element)).toEqual(['only']);
  });

  it('follows members that are added, removed, or hidden', async () => {
    const element = await group('label="Actions"', consumers('a', 'b'));
    const extra = document.createElement('tct-test-member');
    extra.textContent = 'c';
    element.append(extra);
    await nextFrame();
    expect(positions(element)).toEqual(['first', 'middle', 'last']);
    (element.children[1] as HTMLElement).hidden = true;
    await nextFrame();
    expect((element.children[0] as TctTestMember).received?.position).toBe('first');
    expect((element.children[2] as TctTestMember).received?.position).toBe('last');
    (element.children[1] as HTMLElement).hidden = false;
    element.children[2]!.remove();
    await nextFrame();
    expect(positions(element)).toEqual(['first', 'last']);
  });

  it('is not fooled by plumbing: a template or text beside the last member never makes it "middle"', async () => {
    const element = await group(
      'label="Actions"',
      `${consumers('a', 'b')}<template></template> text `,
    );
    expect(positions(element)).toEqual(['first', 'last']);
  });

  it('provides orientation and the disabled state, and updates them', async () => {
    const element = await group('label="Actions"', consumers('a', 'b'));
    const first = element.children[0] as TctTestMember;
    expect(first.received).toMatchObject({orientation: 'horizontal', disabled: false});
    element.orientation = 'vertical';
    element.disabled = true;
    await element.updateComplete;
    await nextFrame();
    expect(first.received).toMatchObject({orientation: 'vertical', disabled: true});
    expect(innerButton(first).disabled).toBe(true);
  });

  it('resolves the size: explicit, else md, and provides it as sizeContext', async () => {
    const element = await group('label="Actions"', consumers('a'));
    const member = element.children[0] as TctTestMember;
    expect(member.received?.size).toBe('md');
    expect(member.providedSize).toBe('md');
    element.size = 'lg';
    await element.updateComplete;
    await nextFrame();
    expect(member.received?.size).toBe('lg');
    expect(member.providedSize).toBe('lg');
  });

  it('answers a consumer nested inside a member, with the position of the member that owns it', async () => {
    const element = await group(
      'label="Actions"',
      `<tct-test-member>a</tct-test-member><tct-test-chip><tct-test-member id="nested">b</tct-test-member></tct-test-chip>`,
    );
    const nested = element.querySelector<TctTestMember>('#nested')!;
    await nested.updateComplete;
    expect(nested.received?.position).toBe('last');
  });

  it('an ancestor group answers nothing for a member of an inner group (the nearest group wins)', async () => {
    const outer = await group(
      'label="Outer"',
      `<tct-test-member>x</tct-test-member><tct-button-group label="Inner"><tct-test-member id="deep">y</tct-test-member></tct-button-group>`,
    );
    const deep = outer.querySelector<TctTestMember>('#deep')!;
    await deep.updateComplete;
    expect(deep.received?.position).toBe('only');
  });
});

// ------------------------------------------------------------------------- roving tab stop

describe('tct-button-group: one tab stop', () => {
  it('only the first enabled member carries tabindex 0', async () => {
    const element = await group();
    expect(tabindexes(element)).toEqual(['0', '-1', '-1']);
  });

  it('takes one Tab to enter and one to leave', async () => {
    const element = await group();
    const wrapper = element.parentElement!;
    wrapper.querySelector<HTMLElement>('#before')!.focus();
    await pressKeys('Tab');
    expect(activeLabel()).toBe('Copy');
    await pressKeys('Tab');
    expect(deepActiveElement()?.id).toBe('after');
    await pressKeys('Shift+Tab');
    expect(activeLabel()).toBe('Copy');
  });

  it('tabSequence sees exactly one stop inside the group', async () => {
    const element = await group();
    const stops = await tabSequence(element, {
      start: element.parentElement!.querySelector<HTMLElement>('#before')!,
    });
    expect(stops.slice(0, 1)).toHaveLength(1);
    expect(stops[1]?.id).toBe('after');
  });

  it('moves the tab stop with arrow navigation and re-enters where it left', async () => {
    const element = await group();
    innerButton(element.children[0]!).focus();
    await pressKeys('ArrowRight');
    expect(activeLabel()).toBe('Cut');
    expect(tabindexes(element)).toEqual(['-1', '0', '-1']);
    await pressKeys('Tab');
    expect(deepActiveElement()?.id).toBe('after');
    await pressKeys('Shift+Tab');
    expect(activeLabel()).toBe('Cut');
  });

  it('never parks the tab stop on a disabled member', async () => {
    const element = await group(
      'label="Actions"',
      '<tct-test-chip disabled>Copy</tct-test-chip><tct-test-chip>Cut</tct-test-chip>',
    );
    expect(tabindexes(element)).toEqual(['-1', '0']);
  });

  it('repairs the tab stop when the member holding it is removed', async () => {
    const element = await group();
    element.children[0]!.remove();
    await nextFrame();
    await nextFrame();
    expect(tabindexes(element)).toEqual(['0', '-1']);
  });

  it('repairs the tab stop when the member holding it becomes disabled', async () => {
    const element = await group();
    const first = element.children[0] as TctTestChip;
    first.disabled = true;
    await first.updateComplete;
    // The group notices on its next update (any slot or property change); nudge it as an app would.
    element.requestUpdate();
    await element.updateComplete;
    await nextFrame();
    expect(tabindexes(element)).toEqual(['-1', '0', '-1']);
  });

  it('contributes no tab stop when the whole group is disabled', async () => {
    const element = await group('label="Actions" disabled');
    const stops = await tabSequence(element, {
      start: element.parentElement!.querySelector<HTMLElement>('#before')!,
    });
    expect(stops[0]?.id).toBe('after');
  });
});

// ---------------------------------------------------------------------------- keyboard table

// The keyboard table is the parity record's (tsconfig lists no JSON, so it is read through the bundler).
const parity = Object.values(
  import.meta.glob<{entries: Record<string, {keyboard: KeyboardRow[]}>}>('./parity.json', {
    eager: true,
    import: 'default',
  }),
)[0]!;
const rowKeys = parity.entries['core.button-group']!.keyboard;

runKeyboardSuite({
  tag: 'tct-button-group',
  render: () =>
    `<tct-button-group label="Actions">${chips('Copy', 'Cut', 'Paste')}</tct-button-group>`,
  table: rowKeys,
  steps: {
    'Enters the group at the member that last had focus (the first enabled member at first); the next Tab leaves the group':
      {
        focus: (element) => (element.previousElementSibling as HTMLElement | null) ?? document.body,
        keys: ['Tab'],
        expect: () => {
          expect(activeLabel()).toBe('Copy');
        },
      },
    'Moves focus to the next enabled member, wrapping after the last': {
      focus: (element) => innerButton(element.children[2]!),
      keys: ['ArrowRight'],
      rtl: {keys: ['ArrowLeft']},
      expect: () => {
        expect(activeLabel()).toBe('Copy');
      },
    },
    'Moves focus to the previous enabled member, wrapping before the first': {
      focus: (element) => innerButton(element.children[0]!),
      keys: ['ArrowLeft'],
      rtl: {keys: ['ArrowRight']},
      expect: () => {
        expect(activeLabel()).toBe('Paste');
      },
    },
    'Moves focus to the next enabled member of a vertical group': {
      setup: (element) => {
        (element as TctButtonGroup).orientation = 'vertical';
      },
      focus: (element) => innerButton(element.children[0]!),
      keys: ['ArrowDown'],
      expect: () => {
        expect(activeLabel()).toBe('Cut');
      },
    },
    'Moves focus to the previous enabled member of a vertical group': {
      setup: (element) => {
        (element as TctButtonGroup).orientation = 'vertical';
      },
      focus: (element) => innerButton(element.children[1]!),
      keys: ['ArrowUp'],
      expect: () => {
        expect(activeLabel()).toBe('Copy');
      },
    },
    'Moves focus to the first enabled member': {
      focus: (element) => innerButton(element.children[2]!),
      keys: ['Home'],
      expect: () => {
        expect(activeLabel()).toBe('Copy');
      },
    },
    'Moves focus to the last enabled member': {
      focus: (element) => innerButton(element.children[0]!),
      keys: ['End'],
      expect: () => {
        expect(activeLabel()).toBe('Paste');
      },
    },
    'Stay with that layer (an open menu); the group does not move focus': {
      setup: (element) => {
        // A member owning a layer: a control inside the member, beside the member's own focus target.
        const nested = document.createElement('button');
        nested.textContent = 'menu item';
        element.children[0]!.append(nested);
      },
      focus: (element) => element.children[0]!.querySelector('button'),
      keys: ['ArrowRight'],
      expect: ({element}) => {
        expect(deepActiveElement()).toBe(element.children[0]!.querySelector('button'));
      },
    },
  },
});

describe('tct-button-group: keyboard details', () => {
  it('skips a disabled member', async () => {
    const element = await group(
      'label="Actions"',
      '<tct-test-chip>Copy</tct-test-chip><tct-test-chip disabled>Cut</tct-test-chip><tct-test-chip>Paste</tct-test-chip>',
    );
    innerButton(element.children[0]!).focus();
    await pressKeys('ArrowRight');
    expect(activeLabel()).toBe('Paste');
  });

  it('leaves arrow keys pressed inside a member (its open menu) to that member', async () => {
    const element = await group();
    const first = element.children[0] as HTMLElement;
    const item = document.createElement('button');
    item.textContent = 'menu item';
    first.append(item);
    item.focus();
    await pressKeys('ArrowRight');
    // The key was pressed on the nested control, not on the member's own focus target: not the group's.
    expect(deepActiveElement()).toBe(item);
  });

  it('follows visual direction in RTL', async () => {
    const element = await group('label="Actions"', chips('Copy', 'Cut', 'Paste'), 'dir="rtl"');
    innerButton(element.children[0]!).focus();
    await pressKeys('ArrowLeft');
    expect(activeLabel()).toBe('Cut');
    await pressKeys('ArrowRight');
    expect(activeLabel()).toBe('Copy');
  });

  it('does not steal arrows when a modifier is held', async () => {
    const element = await group();
    innerButton(element.children[0]!).focus();
    await pressKeys('Alt+ArrowRight');
    expect(activeLabel()).toBe('Copy');
  });
});

// -------------------------------------------------------------------------------------- RTL etc.

describe('tct-button-group: RTL and forced colours', () => {
  it('lays members out inline-start to inline-end in RTL', async () => {
    const element = await group('label="Actions"', chips('Copy', 'Cut'), 'dir="rtl"');
    const [a, b] = members(element).map((member) => member.getBoundingClientRect());
    expect(a!.left).toBeGreaterThan(b!.left);
  });

  it('renders under forced colours and stays accessible', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await group('label="Actions" elevation="low"');
    expect(getComputedStyle(element).display).toBe('inline-flex');
    await expectAccessible(element);
  });
});
