import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {waitUntil} from '@tecton-astryx/testing/timing.js';
import '../icon/define.js';
import './define.js';
import type {ChatToken} from './chat-message.types.js';
import {splitTokens} from './chat-message.tokens.js';
import type {TctChatTokenizedText} from './tct-chat-tokenized-text.js';

const base = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const tokens = (element: Element): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('[part~="token"]'),
];

async function make(
  markup: string,
  props: Partial<{tokens: readonly ChatToken[]; text: string}> = {},
  options = {},
): Promise<TctChatTokenizedText> {
  const root = await fixture<HTMLElement>(`<p>${markup}</p>`, options);
  const element = root.querySelector<TctChatTokenizedText>('tct-chat-tokenized-text')!;
  Object.assign(element, props);
  await element.updateComplete;
  return element;
}

const mentions: ChatToken[] = [
  {value: '@u1', label: '@Ana', variant: 'blue'},
  {value: '@u2', label: '@Ben', variant: 'green', icon: 'check'},
];

runElementSuite({
  tag: 'tct-chat-tokenized-text',
  render: () => `<p><tct-chat-tokenized-text>Hello @u1</tct-chat-tokenized-text></p>`,
  properties: {text: 'Hello @u1', tokens: mentions},
  attributes: {text: 'text'},
});

describe('splitTokens', () => {
  it('returns the text as one piece without tokens, and for empty text', () => {
    expect(splitTokens('plain', [])).toEqual(['plain']);
    expect(splitTokens('', mentions)).toEqual(['']);
  });

  it('replaces every literal occurrence, in reading order, keeping the text between', () => {
    const parts = splitTokens('a @u1 b @u2 c @u1', mentions);
    expect(parts.map((part) => (typeof part === 'string' ? part : part.token.value))).toEqual([
      'a ',
      '@u1',
      ' b ',
      '@u2',
      ' c ',
      '@u1',
    ]);
  });

  it('matches values literally: regular-expression characters mean nothing', () => {
    const parts = splitTokens('cost is $5.00 (or a.b)', [
      {value: '$5.00', label: 'five'},
      {value: '(or', label: 'or'},
      {value: 'a.b)', label: 'ab'},
    ]);
    expect(parts.filter((part) => typeof part !== 'string')).toHaveLength(3);
    expect(splitTokens('axb', [{value: 'a.b', label: 'x'}])).toEqual(['axb']);
  });

  it('ignores empty values: the scan always finishes and the text is kept', () => {
    expect(splitTokens('text', [{value: '', label: 'nothing'}])).toEqual(['text']);
    const parts = splitTokens('hi @u1', [{value: '', label: 'nothing'}, ...mentions]);
    expect(parts).toHaveLength(2);
  });

  it('lets the first token in caller order win where two match at the same position', () => {
    const parts = splitTokens('@u12', [
      {value: '@u1', label: 'short'},
      {value: '@u12', label: 'long'},
    ]);
    expect(parts[0]).toMatchObject({token: {label: 'short'}});
    expect(parts[1]).toBe('2');
  });
});

describe('tct-chat-tokenized-text: rendering', () => {
  it('renders text as it is when there are no tokens, so it can wrap every message', async () => {
    const element = await make('<tct-chat-tokenized-text>Hello world</tct-chat-tokenized-text>');
    expect(base(element).textContent).toBe('Hello world');
    expect(tokens(element)).toHaveLength(0);
  });

  it('renders text with no matching token unchanged', async () => {
    const element = await make(
      '<tct-chat-tokenized-text>No mentions here</tct-chat-tokenized-text>',
      {
        tokens: mentions,
      },
    );
    expect(base(element).textContent).toBe('No mentions here');
    expect(tokens(element)).toHaveLength(0);
  });

  it('replaces token values with badges: label, variant and icon', async () => {
    const element = await make(
      '<tct-chat-tokenized-text>Hi @u1 and @u2!</tct-chat-tokenized-text>',
      {tokens: mentions},
    );
    const found = tokens(element);
    expect(found).toHaveLength(2);
    const [first, second] = found.map((token) => token.querySelector('tct-badge')!);
    expect(first!.getAttribute('label')).toBe('@Ana');
    expect(first!.getAttribute('variant')).toBe('blue');
    expect(second!.getAttribute('variant')).toBe('green');
    expect(second!.querySelector('tct-icon')!.getAttribute('name')).toBe('check');
    expect(first!.querySelector('tct-icon')).toBeNull();
    expect(base(element).textContent.replace(/\s+/g, ' ')).toContain('Hi');
    expect(base(element).textContent).toContain('!');
  });

  it('takes the text from the text attribute, ahead of the element content', async () => {
    const element = await make(
      '<tct-chat-tokenized-text text="From @u1">ignored</tct-chat-tokenized-text>',
      {
        tokens: mentions,
      },
    );
    expect(tokens(element)).toHaveLength(1);
    expect(base(element).textContent).not.toContain('ignored');
  });

  it('follows the element content as it grows, the way a stream appends to it', async () => {
    const element = await make('<tct-chat-tokenized-text>Hi </tct-chat-tokenized-text>', {
      tokens: mentions,
    });
    expect(tokens(element)).toHaveLength(0);
    element.append('@u');
    element.append('1 there');
    await waitUntil(() => tokens(element).length === 1, 'token appears once its value is complete');
    expect(base(element).textContent).toContain(' there');
  });

  it('runs custom tokens: a template, a node and a string', async () => {
    let calls = 0;
    const node = document.createElement('kbd');
    node.textContent = 'node';
    const element = await make('<tct-chat-tokenized-text>/a /b /c /d</tct-chat-tokenized-text>', {
      tokens: [
        {value: '/a', render: () => html`<em class="tpl">template</em>`},
        {value: '/b', render: () => node},
        {value: '/c', render: () => 'string'},
        {
          value: '/d',
          render: () => {
            calls++;
            return 'd';
          },
        },
      ],
    });
    const found = tokens(element);
    expect(found).toHaveLength(4);
    expect(found[0]!.querySelector('em.tpl')!.textContent).toBe('template');
    expect(found[1]!.contains(node)).toBe(true);
    expect(found[2]!.textContent!.trim()).toBe('string');
    expect(calls).toBeGreaterThan(0);
  });

  it('calls a custom renderer only for an actual match', async () => {
    let calls = 0;
    await make('<tct-chat-tokenized-text>nothing to see</tct-chat-tokenized-text>', {
      tokens: [
        {
          value: '@nobody',
          render: () => {
            calls++;
            return 'x';
          },
        },
      ],
    });
    expect(calls).toBe(0);
  });

  it('is inline, with no box styles on the host', async () => {
    const element = await make('<tct-chat-tokenized-text>Hello</tct-chat-tokenized-text>');
    const style = getComputedStyle(element);
    expect(style.display).toBe('inline');
    expect(style.paddingTop).toBe('0px');
  });
});

describe('tct-chat-tokenized-text: safety', () => {
  const payload =
    '<img src=x onerror="window.__tokenized_xss = true"><script>window.__tokenized_xss = true</script>';

  it('shows markup in the text as characters, never as elements', async () => {
    (window as unknown as Record<string, unknown>).__tokenized_xss = undefined;
    const element = await make('<tct-chat-tokenized-text></tct-chat-tokenized-text>', {
      text: `${payload} @u1`,
      tokens: mentions,
    });
    expect(base(element).querySelector('img, script')).toBeNull();
    expect(base(element).textContent).toContain('<img src=x');
    expect(base(element).textContent).toContain('<script>');
    expect((window as unknown as Record<string, unknown>).__tokenized_xss).toBeUndefined();
  });

  it('renders markup inside the element content as text too (only its text is read)', async () => {
    const element = await make(
      '<tct-chat-tokenized-text><b>bold</b> @u1</tct-chat-tokenized-text>',
      {tokens: mentions},
    );
    expect(base(element).querySelector('b')).toBeNull();
    expect(base(element).textContent).toContain('bold');
  });

  it('renders markup in a token label and in a custom string as text', async () => {
    (window as unknown as Record<string, unknown>).__tokenized_xss = undefined;
    const element = await make('<tct-chat-tokenized-text>@u1 /x</tct-chat-tokenized-text>', {
      tokens: [
        {value: '@u1', label: payload},
        {value: '/x', render: () => payload},
      ],
    });
    expect(element.shadowRoot!.querySelector('img, script')).toBeNull();
    const badge = tokens(element)[0]!.querySelector('tct-badge')!;
    expect(badge.shadowRoot!.querySelector('img, script')).toBeNull();
    expect(tokens(element)[1]!.textContent).toContain('<img src=x');
    expect((window as unknown as Record<string, unknown>).__tokenized_xss).toBeUndefined();
  });

  it('does not treat a token value that looks like a pattern as one', async () => {
    const element = await make('<tct-chat-tokenized-text>a+b aab</tct-chat-tokenized-text>', {
      tokens: [{value: 'a+b', label: 'plus'}],
    });
    expect(tokens(element)).toHaveLength(1);
  });
});

describe('tct-chat-tokenized-text: accessibility and the announced text', () => {
  it('reads the text and the token labels in order, and is inert', async () => {
    const element = await make(
      '<tct-chat-tokenized-text>Hi @u1, thanks</tct-chat-tokenized-text>',
      {
        tokens: mentions,
      },
    );
    expect(element.announcementText).toBe('Hi @Ana, thanks');
    expect(element.tabIndex).toBe(-1);
    if (isChromium) expect((await axNode(element)).role).not.toBe('status');
    await expectAccessible(element.parentElement!);
  });

  it('announces a custom token by its value', async () => {
    const element = await make('<tct-chat-tokenized-text>run /go</tct-chat-tokenized-text>', {
      tokens: [{value: '/go', render: () => html`<b>Go</b>`}],
    });
    expect(element.announcementText).toBe('run /go');
  });

  it('flows with right-to-left text', async () => {
    const element = await make(
      '<tct-chat-tokenized-text>مرحبا @u1 شكرا</tct-chat-tokenized-text>',
      {tokens: mentions},
      {dir: 'rtl', lang: 'ar-SA'},
    );
    expect(getComputedStyle(base(element)).direction).toBe('rtl');
    expect(tokens(element)).toHaveLength(1);
  });

  it('passes axe with badges of every kind in the dark theme', async () => {
    const root = await fixture<HTMLElement>(
      html`<p style="background: var(--color-background-body)">
        <tct-chat-tokenized-text
          .tokens=${mentions}
          text="Hi @u1 and @u2, see /go"
        ></tct-chat-tokenized-text>
      </p>`,
      {theme: 'dark'},
    );
    await expectAccessible(root);
  });
});
