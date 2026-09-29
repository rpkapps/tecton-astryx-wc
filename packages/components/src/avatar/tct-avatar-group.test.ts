import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {withFeature} from '@tecton-astryx/testing/tier.js';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {runKeyboardSuite} from '@tecton-astryx/testing/suites/keyboard.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {waitUntil} from '@tecton-astryx/testing/timing.js';
import '../icon/define.js';
import './define.js';
import parity from './parity.json' with {type: 'json'};
import type {TctAvatar} from './tct-avatar.js';
import type {TctAvatarGroup} from './tct-avatar-group.js';
import type {TctAvatarGroupOverflow} from './tct-avatar-group-overflow.js';

const rootOf = (avatar: TctAvatar): HTMLElement =>
  avatar.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const groupOf = (group: TctAvatarGroup): HTMLElement =>
  group.shadowRoot!.querySelector<HTMLElement>('[role="group"]')!;

async function make(attributes: string, children: string): Promise<TctAvatarGroup> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding: 20px"><tct-avatar-group ${attributes}>${children}</tct-avatar-group></div>`,
  );
  const group = wrapper.querySelector<TctAvatarGroup>('tct-avatar-group')!;
  await group.updateComplete;
  await Promise.all(
    [...group.children].map((child) => (child as TctAvatar).updateComplete ?? Promise.resolve()),
  );
  await group.updateComplete;
  return group;
}

const links = `<tct-avatar name="Alice" href="#alice"></tct-avatar><tct-avatar name="Bob" href="#bob"></tct-avatar><tct-avatar name="Charlie" href="#charlie"></tct-avatar>`;

runElementSuite({
  tag: 'tct-avatar-group',
  render: () => `<tct-avatar-group><tct-avatar name="Alice"></tct-avatar></tct-avatar-group>`,
  properties: {size: 'lg', shape: 'square'},
  attributes: {size: 'size', shape: 'shape'},
});

runKeyboardSuite({
  tag: 'tct-avatar-group',
  render: () =>
    `<button type="button">before</button><tct-avatar-group><tct-avatar name="Alice" href="#alice"></tct-avatar><tct-avatar name="Bob" interactive></tct-avatar><tct-avatar name="Charlie" href="#charlie"></tct-avatar></tct-avatar-group>`,
  table: parity.entries['core.avatar-group'].keyboard,
  steps: {
    'Moves focus to the next interactive avatar': {
      focus: (group) => (group.children[0] as TctAvatar).control,
      keys: ['ArrowRight'],
      rtl: {keys: ['ArrowLeft']},
      expect: ({element}) => {
        expect(deepActiveElement()).toBe((element.children[1] as TctAvatar).control);
      },
    },
    'Moves focus to the previous interactive avatar': {
      focus: (group) => (group.children[1] as TctAvatar).control,
      keys: ['ArrowLeft'],
      rtl: {keys: ['ArrowRight']},
      expect: ({element}) => {
        expect(deepActiveElement()).toBe((element.children[0] as TctAvatar).control);
      },
    },
    'Moves focus to the first interactive avatar': {
      focus: (group) => (group.children[2] as TctAvatar).control,
      keys: ['Home'],
      expect: ({element}) => {
        expect(deepActiveElement()).toBe((element.children[0] as TctAvatar).control);
      },
    },
    'Moves focus to the last interactive avatar': {
      focus: (group) => (group.children[0] as TctAvatar).control,
      keys: ['End'],
      expect: ({element}) => {
        expect(deepActiveElement()).toBe((element.children[2] as TctAvatar).control);
      },
    },
    'Enters and leaves the group as one Tab stop': {
      focus: (group) => group.previousElementSibling as HTMLElement | null,
      keys: ['Tab'],
      expect: ({element}) => {
        expect(deepActiveElement()).toBe((element.children[0] as TctAvatar).control);
      },
    },
  },
});

describe('tct-avatar-group (AvatarGroup.test.tsx)', () => {
  it('renders all avatar children', async () => {
    const group = await make(
      '',
      `<tct-avatar name="Alice"></tct-avatar><tct-avatar name="Bob"></tct-avatar><tct-avatar name="Charlie"></tct-avatar>`,
    );
    const names = [...group.children].map((child) =>
      rootOf(child as TctAvatar).getAttribute('aria-label'),
    );
    expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('composes a labelled status into a grouped avatar accessible name (WCAG 4.1.2)', async () => {
    const group = await make(
      '',
      `<tct-avatar name="Alice"><tct-avatar-status-dot slot="status" variant="success" label="Online"></tct-avatar-status-dot></tct-avatar><tct-avatar name="Bob"></tct-avatar>`,
    );
    await waitUntil(
      () => rootOf(group.children[0] as TctAvatar).getAttribute('aria-label') === 'Alice, Online',
      'composed name',
    );
    expect(rootOf(group.children[1] as TctAvatar).getAttribute('aria-label')).toBe('Bob');
  });

  it('renders with role="group" and the default name "Avatars"', async () => {
    const group = await make('', '<tct-avatar name="Alice"></tct-avatar>');
    expect(groupOf(group).getAttribute('aria-label')).toBe('Avatars');
    if (isChromium) {
      const node = await axNode(groupOf(group));
      expect(node.role).toBe('group');
      expect(node.name).toBe('Avatars');
    }
  });

  it('accepts a custom aria-label on the host, and follows it', async () => {
    const group = await make('aria-label="Team members"', '<tct-avatar name="Alice"></tct-avatar>');
    expect(groupOf(group).getAttribute('aria-label')).toBe('Team members');
    group.removeAttribute('aria-label');
    await waitUntil(() => groupOf(group).getAttribute('aria-label') === 'Avatars', 'default name');
  });

  it('reflects size on the group', async () => {
    const group = await make('size="lg"', '<tct-avatar name="Alice"></tct-avatar>');
    expect(group.getAttribute('size')).toBe('lg');
  });

  it('renders an empty group when there are no children', async () => {
    const group = await make('', '');
    expect(groupOf(group)).not.toBeNull();
    expect(group.shadowRoot!.querySelector('.visually-hidden')).toBeNull();
  });
});

describe('tct-avatar-group: roving focus and keyboard hint', () => {
  it('is a single tab stop over interactive avatars (one tabindex=0, rest -1)', async () => {
    const group = await make('', links);
    const controls = [...group.children].map((child) => (child as TctAvatar).control!);
    expect(controls.map((control) => control.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('roves focus with the arrow keys across links and buttons, wrapping at the ends', async () => {
    const group = await make(
      '',
      `<tct-avatar name="Alice" href="#alice"></tct-avatar><tct-avatar name="Bob" interactive></tct-avatar><tct-avatar name="Charlie" href="#charlie"></tct-avatar>`,
    );
    const [alice, bob, charlie] = [...group.children].map((child) => (child as TctAvatar).control!);
    alice!.focus();
    await pressKeys('ArrowRight');
    expect(deepActiveElement()).toBe(bob);
    expect(bob!.getAttribute('tabindex')).toBe('0');
    expect(alice!.getAttribute('tabindex')).toBe('-1');
    await pressKeys('ArrowRight');
    expect(deepActiveElement()).toBe(charlie);
    await pressKeys('ArrowRight');
    expect(deepActiveElement()).toBe(alice);
    await pressKeys('ArrowLeft');
    expect(deepActiveElement()).toBe(charlie);
  });

  it('includes an interactive overflow as the last roving item', async () => {
    const group = await make(
      '',
      `<tct-avatar name="Alice" href="#alice"></tct-avatar><tct-avatar-group-overflow count="3" interactive></tct-avatar-group-overflow>`,
    );
    const alice = (group.children[0] as TctAvatar).control!;
    const overflow = group.children[1] as TctAvatarGroupOverflow;
    alice.focus();
    await pressKeys('ArrowRight');
    expect(deepActiveElement()).toBe(overflow.control);
  });

  it('does NOT rove over a non-avatar button in a status slot', async () => {
    const group = await make(
      '',
      `<tct-avatar name="Alice" href="#alice"><button slot="status" type="button">badge</button></tct-avatar><tct-avatar name="Bob" href="#bob"></tct-avatar>`,
    );
    const alice = (group.children[0] as TctAvatar).control!;
    const bob = (group.children[1] as TctAvatar).control!;
    alice.focus();
    await pressKeys('ArrowRight');
    expect(deepActiveElement()).toBe(bob);
  });

  it('attaches the keyboard hint as the group description when interactive children exist', async () => {
    const group = await make('', links);
    const hint = group.shadowRoot!.querySelector('.visually-hidden')!;
    expect(hint.textContent.trim()).toBe('Use arrow keys to move between avatars');
    if (isChromium) {
      const node = await axNode(groupOf(group));
      expect(node.description).toBe('Use arrow keys to move between avatars');
    }
  });

  it('a purely static group has no tab stop and no keyboard hint', async () => {
    const group = await make(
      '',
      `<tct-avatar name="Alice"></tct-avatar><tct-avatar name="Bob"></tct-avatar>`,
    );
    expect(group.shadowRoot!.querySelector('.visually-hidden')).toBeNull();
    for (const child of group.children) {
      expect(rootOf(child as TctAvatar).hasAttribute('tabindex')).toBe(false);
    }
  });

  it('picks up an avatar that becomes interactive after mount', async () => {
    const group = await make(
      '',
      `<tct-avatar name="Alice"></tct-avatar><tct-avatar name="Bob"></tct-avatar>`,
    );
    (group.children[1] as TctAvatar).href = '#bob';
    await waitUntil(
      () => group.shadowRoot!.querySelector('.visually-hidden') !== null,
      'hint appears',
    );
    expect((group.children[1] as TctAvatar).control!.getAttribute('tabindex')).toBe('0');
  });

  it('merges the author aria-describedby with the hint (element reflection, and text on Tier 2)', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div>
        <p id="note">Project members</p>
        <tct-avatar-group aria-describedby="note"
          ><tct-avatar name="Alice" href="#a"></tct-avatar
        ></tct-avatar-group>
      </div>`,
    );
    const group = wrapper.querySelector<TctAvatarGroup>('tct-avatar-group')!;
    await waitUntil(() => group.shadowRoot!.querySelector('.visually-hidden') !== null, 'hint');
    if (isChromium) {
      const node = await axNode(groupOf(group));
      expect(node.description).toContain('Project members');
      expect(node.description).toContain('Use arrow keys to move between avatars');
    }
    await withFeature('elementReflection', false, async () => {
      group.requestUpdate();
      await group.updateComplete;
      expect(groupOf(group).getAttribute('aria-description')).toContain('Project members');
      expect(groupOf(group).getAttribute('aria-description')).toContain('Use arrow keys');
    });
  });

  it('removes a stale tab stop from an avatar that leaves the group', async () => {
    const group = await make('', links);
    const second = group.children[1] as TctAvatar;
    expect(second.control!.getAttribute('tabindex')).toBe('-1');
    document.body.append(second);
    await second.updateComplete;
    expect(second.control!.hasAttribute('tabindex')).toBe(false);
    second.remove();
  });
});

describe('tct-avatar-group: size cascade, shape and overlap', () => {
  it("the group's size overrides a child's own size", async () => {
    const group = await make('size="lg"', '<tct-avatar name="Alice" size="xsm"></tct-avatar>');
    expect(rootOf(group.children[0] as TctAvatar).getBoundingClientRect().width).toBe(48 + 4);
  });

  it("the group's default size also overrides a child's own size (pinned upstream behaviour)", async () => {
    const group = await make('', '<tct-avatar name="Alice" size="xl"></tct-avatar>');
    expect(rootOf(group.children[0] as TctAvatar).getBoundingClientRect().width).toBe(36 + 4);
  });

  it("outside a group the avatar's own size applies", async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<tct-avatar name="Alice" size="xl"></tct-avatar>`,
    );
    expect(rootOf(wrapper as TctAvatar).getBoundingClientRect().width).toBe(128);
  });

  it("the group's shape overrides a member's own shape, and the default is circle", async () => {
    const square = await make(
      'shape="square"',
      '<tct-avatar name="A" shape="circle"></tct-avatar><tct-avatar-group-overflow count="2"></tct-avatar-group-overflow>',
    );
    expect(getComputedStyle(rootOf(square.children[0] as TctAvatar)).borderTopLeftRadius).toBe(
      '0px',
    );
    const circle = await make('', '<tct-avatar name="A" shape="square"></tct-avatar>');
    expect(
      parseFloat(getComputedStyle(rootOf(circle.children[0] as TctAvatar)).borderTopLeftRadius),
    ).toBeGreaterThan(100);
  });

  it('overlaps every avatar after the first by a quarter of the size, with a surface ring', async () => {
    const group = await make(
      'size="lg"',
      `<tct-avatar name="A"></tct-avatar><tct-avatar name="B"></tct-avatar><tct-avatar name="C"></tct-avatar>`,
    );
    const boxes = [...group.children].map((child) =>
      rootOf(child as TctAvatar).getBoundingClientRect(),
    );
    // 48px avatars + 2px ring each side = 52px; overlap = 12px.
    expect(boxes[0]!.width).toBe(52);
    expect(boxes[1]!.left - boxes[0]!.left).toBeCloseTo(52 - 12, 0);
    expect(boxes[2]!.left - boxes[1]!.left).toBeCloseTo(52 - 12, 0);
    expect(getComputedStyle(rootOf(group.children[0] as TctAvatar)).borderTopWidth).toBe('2px');
  });

  it('overlaps toward the inline start in right-to-left', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div style="padding: 20px">
        <tct-avatar-group size="lg"
          ><tct-avatar name="A"></tct-avatar><tct-avatar name="B"></tct-avatar
        ></tct-avatar-group>
      </div>`,
      {dir: 'rtl'},
    );
    const group = wrapper.querySelector<TctAvatarGroup>('tct-avatar-group')!;
    await group.updateComplete;
    const [a, b] = [...group.children].map((child) =>
      rootOf(child as TctAvatar).getBoundingClientRect(),
    );
    expect(a!.left - b!.left).toBeCloseTo(52 - 12, 0);
  });

  it('passes axe (static, interactive and with an overflow), light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const wrapper = await fixture<HTMLElement>(
        html`<div style="padding: 12px">
          <tct-avatar-group size="lg"
            ><tct-avatar name="Alice"></tct-avatar><tct-avatar name="Bob"></tct-avatar
            ><tct-avatar-group-overflow count="3"></tct-avatar-group-overflow
          ></tct-avatar-group>
          <tct-avatar-group
            ><tct-avatar name="Alice" href="#a"></tct-avatar
            ><tct-avatar-group-overflow count="3" interactive></tct-avatar-group-overflow
          ></tct-avatar-group>
        </div>`,
        {theme},
      );
      await expectAccessible(wrapper);
    }
  });
});

describe('tct-avatar-group: i18n', () => {
  it('localises the group name and the hint (de-DE)', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div lang="de-DE">
        <tct-avatar-group><tct-avatar name="Alice" href="#a"></tct-avatar></tct-avatar-group>
      </div>`,
    );
    const group = wrapper.querySelector<TctAvatarGroup>('tct-avatar-group')!;
    await waitUntil(() => groupOf(group).getAttribute('aria-label') === 'Avatare', 'German name');
    expect(group.shadowRoot!.querySelector('.visually-hidden')!.textContent.trim()).toBe(
      'Mit den Pfeiltasten zwischen Avataren wechseln',
    );
  });
});
