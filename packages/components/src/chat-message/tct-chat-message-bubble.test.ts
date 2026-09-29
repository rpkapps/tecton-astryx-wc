import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {waitUntil} from '@tecton-astryx/testing/timing.js';
import '../avatar/define.js';
import './define.js';
import type {TctChatMessage} from './tct-chat-message.js';
import type {TctChatMessageBubble} from './tct-chat-message-bubble.js';

const part = (element: Element, name: string): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);

async function make(content: ReturnType<typeof html>, options = {}): Promise<HTMLElement> {
  return fixture<HTMLElement>(html`<div style="inline-size: 600px">${content}</div>`, options);
}

const bubble = (root: HTMLElement, selector = 'tct-chat-message-bubble') =>
  root.querySelector<TctChatMessageBubble>(selector)!;

runElementSuite({
  tag: 'tct-chat-message-bubble',
  render: () => `<tct-chat-message-bubble>Hello</tct-chat-message-bubble>`,
  properties: {variant: 'ghost', group: 'first', name: 'Navi', metadata: '2:30 PM', width: '240'},
  attributes: {
    variant: 'variant',
    group: 'group',
    name: 'name',
    metadata: 'metadata',
    width: 'width',
  },
});

describe('tct-chat-message-bubble: rendering', () => {
  it('is a filled bubble by default and reflects the variant', async () => {
    const root = await make(html`<tct-chat-message-bubble>Hi</tct-chat-message-bubble>`);
    const element = bubble(root);
    expect(element.variant).toBe('filled');
    const painted = part(element, 'bubble')!;
    expect(getComputedStyle(painted).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    element.variant = 'ghost';
    await element.updateComplete;
    expect(element.getAttribute('variant')).toBe('ghost');
    expect(getComputedStyle(painted).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('keeps the padding of a ghost bubble on the inline axis and drops it on the block axis', async () => {
    const root = await make(html`
      <tct-chat-message-bubble id="f">Hi</tct-chat-message-bubble>
      <tct-chat-message-bubble id="g" variant="ghost">Hi</tct-chat-message-bubble>
    `);
    const filled = getComputedStyle(part(bubble(root, '#f'), 'bubble')!);
    const ghost = getComputedStyle(part(bubble(root, '#g'), 'bubble')!);
    expect(filled.paddingBlockStart).toBe('12px');
    expect(filled.paddingInlineStart).toBe('16px');
    expect(ghost.paddingBlockStart).toBe('0px');
    expect(ghost.paddingInlineStart).toBe('16px');
  });

  it('uses the chat radius, and the container radius when compact', async () => {
    const root = await make(html`
      <tct-chat-message-bubble id="b">Hi</tct-chat-message-bubble>
      <tct-chat-message density="compact"
        ><tct-chat-message-bubble id="c">Hi</tct-chat-message-bubble></tct-chat-message
      >
    `);
    const radius = (selector: string) =>
      getComputedStyle(part(bubble(root, selector), 'bubble')!).borderStartStartRadius;
    expect(radius('#b')).toBe('12px');
    expect(radius('#c')).toBe('8px');
  });

  it('caps its width at max(80%, 280px) and lets `width` replace the cap', async () => {
    const root = await make(html`
      <tct-chat-message-bubble id="long">${'word '.repeat(200)}</tct-chat-message-bubble>
      <tct-chat-message-bubble id="fixed" width="200"
        >${'word '.repeat(200)}</tct-chat-message-bubble
      >
      <tct-chat-message-bubble id="full" variant="ghost" width="100%"
        >${'word '.repeat(200)}</tct-chat-message-bubble
      >
    `);
    const width = (selector: string) =>
      part(bubble(root, selector), 'bubble')!.getBoundingClientRect().width;
    expect(width('#long')).toBeCloseTo(480, 0);
    expect(width('#fixed')).toBe(200);
    expect(width('#full')).toBeCloseTo(600, 0);
  });

  it('breaks long unbroken words instead of overflowing', async () => {
    const root = await make(
      html`<tct-chat-message-bubble>${'x'.repeat(500)}</tct-chat-message-bubble>`,
    );
    const painted = part(bubble(root), 'bubble')!;
    expect(painted.scrollWidth).toBeLessThanOrEqual(painted.clientWidth);
    expect(painted.getBoundingClientRect().width).toBeLessThanOrEqual(600);
  });

  it('keeps inline runs (text and <strong>) in one paragraph', async () => {
    const root = await make(
      html`<tct-chat-message-bubble>Hello <strong>bold</strong> world</tct-chat-message-bubble>`,
    );
    const painted = part(bubble(root), 'bubble')!;
    expect(painted.getBoundingClientRect().height).toBeLessThan(50);
  });
});

describe('tct-chat-message-bubble: sender and grouping', () => {
  const radii = (element: TctChatMessageBubble) => {
    const style = getComputedStyle(part(element, 'bubble')!);
    return [
      style.borderStartStartRadius,
      style.borderStartEndRadius,
      style.borderEndStartRadius,
      style.borderEndEndRadius,
    ];
  };

  it.each([
    ['assistant', 'first', ['12px', '12px', '2px', '12px']],
    ['assistant', 'middle', ['2px', '12px', '2px', '12px']],
    ['assistant', 'last', ['2px', '12px', '12px', '12px']],
    ['user', 'first', ['12px', '12px', '12px', '2px']],
    ['user', 'middle', ['12px', '2px', '12px', '2px']],
    ['user', 'last', ['12px', '2px', '12px', '12px']],
  ] as const)(
    '%s bubble in group "%s" tightens the sender-side corners',
    async (sender, group, expected) => {
      const root = await make(
        html`<tct-chat-message sender=${sender}
          ><tct-chat-message-bubble group=${group}>Hi</tct-chat-message-bubble></tct-chat-message
        >`,
      );
      expect(radii(bubble(root))).toEqual([...expected]);
    },
  );

  it('follows the reading direction: the tail side flips in right-to-left', async () => {
    const root = await make(
      html`<tct-chat-message sender="assistant"
        ><tct-chat-message-bubble group="first">مرحبا</tct-chat-message-bubble></tct-chat-message
      >`,
      {dir: 'rtl'},
    );
    const style = getComputedStyle(part(bubble(root), 'bubble')!);
    // Physical bottom-right is the inline start in RTL.
    expect(style.borderBottomRightRadius).toBe('2px');
    expect(style.borderBottomLeftRadius).toBe('12px');
  });

  it('reads the sender from the message; a standalone bubble is an assistant bubble', async () => {
    const root = await make(html`
      <tct-chat-message sender="user"
        ><tct-chat-message-bubble id="u">Hi</tct-chat-message-bubble></tct-chat-message
      >
      <tct-chat-message-bubble id="alone">Hi</tct-chat-message-bubble>
    `);
    const senderOf = (selector: string) =>
      bubble(root, selector).shadowRoot!.querySelector<HTMLElement>('.stack')!.dataset.sender;
    expect(senderOf('#u')).toBe('user');
    expect(senderOf('#alone')).toBe('assistant');
  });

  it('follows a change of the message sender', async () => {
    const root = await make(
      html`<tct-chat-message sender="assistant"
        ><tct-chat-message-bubble>Hi</tct-chat-message-bubble></tct-chat-message
      >`,
    );
    const message = root.querySelector<TctChatMessage>('tct-chat-message')!;
    message.sender = 'user';
    await waitUntil(
      () =>
        bubble(root).shadowRoot!.querySelector<HTMLElement>('.stack')!.dataset.sender === 'user',
      'sender through context',
    );
  });
});

describe('tct-chat-message-bubble: name and metadata rows', () => {
  it('renders no name or metadata row unless there is one', async () => {
    const root = await make(html`<tct-chat-message-bubble>Hi</tct-chat-message-bubble>`);
    expect(part(bubble(root), 'name')).toBeNull();
    expect(part(bubble(root), 'metadata')).toBeNull();
  });

  it('shows the name and metadata attributes, aligned with the bubble text', async () => {
    const root = await make(
      html`<tct-chat-message-bubble name="Navi" metadata="2:30 PM">Hi</tct-chat-message-bubble>`,
    );
    const element = bubble(root);
    const name = part(element, 'name')!;
    const meta = part(element, 'metadata')!;
    expect(name.textContent.trim()).toBe('Navi');
    expect(meta.textContent.trim()).toBe('2:30 PM');
    expect(getComputedStyle(name).paddingInlineStart).toBe('16px');
    expect(getComputedStyle(meta).paddingInlineStart).toBe('16px');
    const textLeft = part(element, 'bubble')!.getBoundingClientRect().left + 16;
    expect(name.getBoundingClientRect().left + 16).toBeCloseTo(textLeft, 0);
  });

  it('takes markup through the slots, which win over the attributes', async () => {
    const root = await make(
      html`<tct-chat-message-bubble name="attr" metadata="attr"
        ><em slot="name">Slot name</em>Hi<span slot="metadata"
          >Slot meta</span
        ></tct-chat-message-bubble
      >`,
    );
    const element = bubble(root);
    const nameSlot = part(element, 'name')!.querySelector('slot')!;
    expect(nameSlot.assignedElements()[0]!.textContent).toBe('Slot name');
    expect(part(element, 'metadata')!.querySelector('slot')!.assignedElements()).toHaveLength(1);
  });

  it('end-aligns the rows of a user bubble', async () => {
    const root = await make(
      html`<tct-chat-message sender="user"
        ><tct-chat-message-bubble name="Ana" metadata="now"
          >Hi</tct-chat-message-bubble
        ></tct-chat-message
      >`,
    );
    const element = bubble(root);
    const box = root.getBoundingClientRect();
    expect(part(element, 'name')!.getBoundingClientRect().right).toBeCloseTo(box.right, 0);
    expect(part(element, 'metadata')!.getBoundingClientRect().right).toBeCloseTo(box.right, 0);
  });

  it('tells its message a name row exists, so the avatar drops to line up with the bubble text', async () => {
    const root = await make(html`
      <tct-chat-message id="plain"
        ><tct-avatar slot="avatar" name="A" size="sm"></tct-avatar
        ><tct-chat-message-bubble>Hi</tct-chat-message-bubble></tct-chat-message
      >
      <tct-chat-message id="named"
        ><tct-avatar slot="avatar" name="A" size="sm"></tct-avatar
        ><tct-chat-message-bubble name="Navi">Hi</tct-chat-message-bubble></tct-chat-message
      >
    `);
    const offset = async (id: string) => {
      const message = root.querySelector<TctChatMessage>(`#${id}`)!;
      await waitUntil(() => part(message, 'avatar') !== null, 'avatar rendered');
      return getComputedStyle(part(message, 'avatar')!).marginBlockStart;
    };
    await waitUntil(() => true);
    expect(await offset('plain')).toBe('0px');
    await waitUntil(
      () =>
        getComputedStyle(part(root.querySelector('#named')!, 'avatar')!).marginBlockStart ===
        '20px',
      'avatar offset',
    );
  });

  it('is not a landmark and has no role of its own', async () => {
    const root = await make(html`<tct-chat-message-bubble>Hi</tct-chat-message-bubble>`);
    if (isChromium) expect((await axNode(bubble(root))).role).not.toBe('article');
    await expectAccessible(root);
  });
});

describe('tct-chat-message-bubble: accessibility and theming', () => {
  it('passes axe for every variant, sender and group, with rows', async () => {
    const root = await make(html`
      ${(['assistant', 'user'] as const).map(
        (sender) =>
          html`<tct-chat-message sender=${sender} name=${sender}>
            <tct-chat-message-bubble group="first">First</tct-chat-message-bubble>
            <tct-chat-message-bubble group="last" metadata="2:30 PM">Last</tct-chat-message-bubble>
            <tct-chat-message-bubble variant="ghost">Ghost</tct-chat-message-bubble>
          </tct-chat-message>`,
      )}
    `);
    await expectAccessible(root);
  });

  it('passes axe in the dark theme', async () => {
    const root = await fixture<HTMLElement>(
      html`<div style="background: var(--color-background-body)">
        <tct-chat-message-bubble name="Navi" metadata="now">Hello</tct-chat-message-bubble>
      </div>`,
      {theme: 'dark'},
    );
    await expectAccessible(root);
  });

  it.skipIf(!isChromium)('keeps a visible edge in forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const root = await make(html`<tct-chat-message-bubble>Hi</tct-chat-message-bubble>`);
    const style = getComputedStyle(part(bubble(root), 'bubble')!);
    expect(style.outlineStyle).toBe('solid');
    expect(style.outlineWidth).toBe('1px');
  });

  it('spaces the bubble with density: spacious pads more than balanced', async () => {
    const root = await make(html`
      <tct-chat-message density="spacious"
        ><tct-chat-message-bubble id="s">Hi</tct-chat-message-bubble></tct-chat-message
      >
    `);
    await waitUntil(
      () => getComputedStyle(part(bubble(root, '#s'), 'bubble')!).paddingInlineStart === '20px',
      'spacious padding',
    );
    expect(getComputedStyle(part(bubble(root, '#s'), 'bubble')!).paddingBlockStart).toBe('16px');
  });
});
