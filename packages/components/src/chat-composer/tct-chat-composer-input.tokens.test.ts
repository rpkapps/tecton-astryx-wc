/// <reference types="@vitest/browser-playwright" />
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {expectEventCounts, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement} from '@tecton-wc/testing/keyboard.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import type {ChatComposerToken} from './chat-composer.types.js';
import type {TctChatComposerInput} from './tct-chat-composer-input.js';
import type {TctChatComposerTokenElement} from './tct-chat-composer-token-element.js';

const editableOf = (input: Element): HTMLElement =>
  input.shadowRoot!.querySelector<HTMLElement>('.editable')!;
const tokensOf = (input: Element): TctChatComposerTokenElement[] => [
  ...editableOf(input).querySelectorAll<TctChatComposerTokenElement>(
    'tct-chat-composer-token-element',
  ),
];

async function make(attributes = ''): Promise<TctChatComposerInput> {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: 420px"><tct-chat-composer-input ${attributes}></tct-chat-composer-input></div>`,
  );
  return root.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
}

async function type(input: TctChatComposerInput, text: string): Promise<void> {
  if (deepActiveElement() !== editableOf(input)) editableOf(input).focus();
  await userEvent.keyboard(text);
}

/** Extends the selection leftwards, one key press at a time, until it covers the chip (the engine needs a press per caret stop). */
async function selectChipBackwards(input: Element): Promise<void> {
  const [token] = tokensOf(input);
  for (let press = 0; press < 5; press++) {
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    const [range] = document.getSelection()!.getComposedRanges({shadowRoots: [input.shadowRoot!]});
    if (range && !range.collapsed) {
      const probe = document.createRange();
      probe.setStart(range.startContainer, range.startOffset);
      probe.setEnd(range.endContainer, range.endOffset);
      if (probe.intersectsNode(token!)) return;
    }
  }
  throw new Error('the chip was never selected');
}

/** The chip inside a token element: the image that carries the name. */
const chip = (token: Element): Element => token.shadowRoot!.querySelector('.chip')!;

const ada: ChatComposerToken = {value: '@ada', label: 'Ada Lovelace', variant: 'info'};

/** The caret as `[node, offset]`, read the way the input reads it (composed ranges). */
function caret(input: Element): {node: Node; offset: number} {
  const selection = document.getSelection()!;
  const [range] = selection.getComposedRanges({shadowRoots: [input.shadowRoot!]});
  return {node: range!.startContainer, offset: range!.startOffset};
}

function setCaret(node: Node, offset: number): void {
  document.getSelection()!.setBaseAndExtent(node, offset, node, offset);
}

describe('inline tokens: insertion', () => {
  it('inserts a token chip with the caret after it, so typing continues; the value carries its value', async () => {
    const input = await make();
    const events = recordEvents(input, ['input']);
    await type(input, 'hi ');
    const id = input.insertToken(ada);
    await input.updateComplete;
    expect(id).toMatch(/^tct-chat-token-/);
    const [token] = tokensOf(input);
    expect(token).toBeDefined();
    expect(token!.getAttribute('contenteditable')).toBe('false');
    expect(token!.getAttribute('data-tct-token-id')).toBe(id);
    expect(token!.getAttribute('data-tct-token-value')).toBe('@ada');
    // One input event for the insertion; the value reads the token as its value plus the space after it.
    expect(events.named('input')).toHaveLength(4);
    expect(input.value).toBe('hi @ada ');
    await userEvent.keyboard('there');
    expect(input.value).toBe('hi @ada there');
    expect(tokensOf(input)).toHaveLength(1);
    expect(input.shadowRoot!.querySelector('.placeholder')).toBeNull();
  });

  it('a token alone makes the draft non-empty, and submits as its value', async () => {
    const input = await make();
    const submits = recordEvents(input, ['tct-chat-submit']);
    input.insertToken(ada);
    await input.updateComplete;
    expect(input.shadowRoot!.querySelector('.placeholder')).toBeNull();
    await userEvent.keyboard('{Enter}');
    expect(submits.events[0]!.value).toBe('@ada');
    expect(tokensOf(input)).toHaveLength(0);
  });

  it('replaces the selected text', async () => {
    const input = await make('value="hello world"');
    const text = editableOf(input).firstChild!;
    editableOf(input).focus();
    document.getSelection()!.setBaseAndExtent(text, 6, text, 11);
    input.insertToken(ada);
    expect(input.value).toBe('hello @ada ');
  });

  it('renders a custom token: text, a template or a DOM node', async () => {
    const input = await make();
    const node = document.createElement('b');
    node.textContent = 'node';
    input.insertToken({value: '/plain', render: () => 'plain text'});
    input.insertToken({value: '/tpl', render: () => html`<i>template</i>`});
    input.insertToken({value: '/node', render: () => node});
    await input.updateComplete;
    const rendered = tokensOf(input).map((token) =>
      token.shadowRoot!.querySelector('.base')!.textContent.trim(),
    );
    expect(rendered).toEqual(['plain text', 'template', 'node']);
    expect(input.value).toBe('/plain /tpl /node ');
  });

  it('a custom token that returns markup as a string shows it as characters, never as HTML', async () => {
    const input = await make();
    input.insertToken({value: '/x', render: () => '<img src=x onerror=alert(1)>'});
    await input.updateComplete;
    const token = tokensOf(input)[0]!;
    expect(token.shadowRoot!.querySelector('img')).toBeNull();
    expect(token.shadowRoot!.textContent).toContain('<img src=x');
  });
});

describe('inline tokens: deleting as a unit', () => {
  it('Backspace right after a token removes it together with its space, in one press', async () => {
    const input = await make();
    input.insertToken(ada);
    await input.updateComplete;
    const events = recordEvents(input, ['input']);
    await userEvent.keyboard('{Backspace}');
    expect(tokensOf(input)).toHaveLength(0);
    expect(editableOf(input).textContent).toBe('');
    expect(input.value).toBe('');
    expectEventCounts(events, {input: 1});
    await input.updateComplete;
    expect(input.shadowRoot!.querySelector('.placeholder')).not.toBeNull();
  });

  it('after text typed behind the token, one Backspace deletes a character and the next removes the token', async () => {
    const input = await make();
    await type(input, 'a ');
    input.insertToken(ada);
    await userEvent.keyboard('x');
    await userEvent.keyboard('{Backspace}');
    expect(tokensOf(input)).toHaveLength(1);
    expect(input.value).toBe('a @ada ');
    await userEvent.keyboard('{Backspace}');
    expect(tokensOf(input)).toHaveLength(0);
    expect(input.value).toBe('a ');
    // The caret is where the token was: typing continues in place.
    await userEvent.keyboard('b');
    expect(input.value).toBe('a b');
  });

  it('Delete before a token removes it as a unit', async () => {
    const input = await make();
    await type(input, 'ab');
    input.insertToken(ada);
    await userEvent.keyboard('cd');
    const text = editableOf(input).firstChild!;
    setCaret(text, 2);
    await userEvent.keyboard('{Delete}');
    expect(tokensOf(input)).toHaveLength(0);
    expect(input.value).toBe('abcd');
  });

  it('Ctrl+Backspace (delete word) next to a token removes the whole token, not part of it', async () => {
    const input = await make();
    input.insertToken(ada);
    await input.updateComplete;
    await userEvent.keyboard('{Control>}{Backspace}{/Control}');
    expect(tokensOf(input)).toHaveLength(0);
    expect(input.value).toBe('');
  });

  it('removes several tokens one by one, back to front', async () => {
    const input = await make();
    input.insertToken({value: '@a', label: 'A'});
    input.insertToken({value: '@b', label: 'B'});
    await input.updateComplete;
    expect(tokensOf(input)).toHaveLength(2);
    await userEvent.keyboard('{Backspace}');
    expect(tokensOf(input).map((token) => token.getAttribute('data-tct-token-value'))).toEqual([
      '@a',
    ]);
    await userEvent.keyboard('{Backspace}');
    expect(tokensOf(input)).toHaveLength(0);
  });

  it('a range selection that covers a token deletes it with the rest', async () => {
    const input = await make();
    await type(input, 'x ');
    input.insertToken(ada);
    await userEvent.keyboard('y');
    editableOf(input).focus();
    const editable = editableOf(input);
    document.getSelection()!.setBaseAndExtent(editable, 0, editable, editable.childNodes.length);
    await userEvent.keyboard('{Backspace}');
    expect(tokensOf(input)).toHaveLength(0);
    expect(input.value).toBe('');
  });

  it('leaves deletions during an IME composition to the browser', async () => {
    const input = await make();
    input.insertToken(ada);
    await input.updateComplete;
    const event = new InputEvent('beforeinput', {
      inputType: 'deleteContentBackward',
      isComposing: true,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    editableOf(input).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(tokensOf(input)).toHaveLength(1);
  });

  it('Backspace inside plain text is untouched', async () => {
    const input = await make();
    await type(input, 'abc');
    await userEvent.keyboard('{Backspace}');
    expect(input.value).toBe('ab');
  });
});

describe('inline tokens: named for screen readers', () => {
  it.skipIf(!isChromium)(
    'is an image named by its label, so the draft reads "hello, Ada Lovelace"',
    async () => {
      const input = await make();
      await type(input, 'hello ');
      input.insertToken(ada);
      await input.updateComplete;
      const token = tokensOf(input)[0]!;
      expect(token.accessibleName).toBe('Ada Lovelace');
      expect(await axNode(chip(token))).toMatchObject({role: 'image', name: 'Ada Lovelace'});
    },
  );

  it.skipIf(!isChromium)(
    'a token without a label is named by its value; a custom token too',
    async () => {
      const input = await make();
      input.insertToken({value: '#topic'});
      input.insertToken({value: '/command', render: () => 'run'});
      await input.updateComplete;
      const [structured, custom] = tokensOf(input);
      expect(await axNode(chip(structured!))).toMatchObject({role: 'image', name: '#topic'});
      expect(await axNode(chip(custom!))).toMatchObject({role: 'image', name: '/command'});
    },
  );

  it('an expandable pasted token is named by its counts (localised)', async () => {
    const input = await make();
    input.insertToken({value: `${'a'.repeat(100)}\n${'b'.repeat(120)}\n${'c'.repeat(10)}`});
    await input.updateComplete;
    const token = tokensOf(input)[0]!;
    expect(token.hasAttribute('expandable')).toBe(true);
    expect(token.accessibleName).toBe('3 lines, 232 chars');
    const one = await make();
    one.insertToken({value: 'z'.repeat(250)});
    await one.updateComplete;
    expect(tokensOf(one)[0]!.accessibleName).toBe('250 chars');
  });

  it('passes axe with tokens in the draft, in light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const root = await fixture<HTMLElement>(
        `<div style="inline-size: 420px"><tct-chat-composer-input></tct-chat-composer-input></div>`,
        {theme},
      );
      const input = root.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
      await type(input, 'ask ');
      input.insertToken(ada);
      input.insertToken({value: `${'w'.repeat(300)}`});
      await input.updateComplete;
      await expectAccessible(root);
    }
  });
});

describe('inline tokens: expanding a pasted text', () => {
  it('expandToken() replaces the token with its text, drops the space and puts the caret after it', async () => {
    const input = await make();
    const long = 'k'.repeat(260);
    const id = input.insertToken({value: long})!;
    const events = recordEvents(input, ['input']);
    input.expandToken(id);
    expect(tokensOf(input)).toHaveLength(0);
    expect(editableOf(input).textContent).toBe(long);
    expect(input.value).toBe(long);
    expectEventCounts(events, {input: 1});
    await userEvent.keyboard('!');
    expect(input.value).toBe(`${long}!`);
  });

  it('the Expand button of the hover card dissolves the token', async () => {
    const input = await make();
    input.insertToken({value: 'm'.repeat(260)});
    await input.updateComplete;
    const token = tokensOf(input)[0]!;
    const card = token.shadowRoot!.querySelector<HTMLElement & {show(): Promise<void>}>(
      'tct-hover-card',
    )!;
    await card.show();
    const expand = token.shadowRoot!.querySelector<HTMLElement>('tct-button')!;
    expect(expand.getAttribute('label')).toBe('Expand');
    const expands = recordEvents(input, ['tct-chat-token-expand']);
    await userEvent.click(expand);
    await waitUntil(() => tokensOf(input).length === 0, 'the token dissolved');
    expect(expands.events).toHaveLength(1);
    expect(expands.events[0]!.value).toBe('m'.repeat(260));
    expect(input.value).toBe('m'.repeat(260));
  });

  it('a keyboard user selects the chip with Shift+Arrow and presses Enter to expand it, without sending', async () => {
    const input = await make();
    const submits = recordEvents(input, ['tct-chat-submit']);
    const long = 'p'.repeat(240);
    input.insertToken({value: long});
    input.focus();
    await selectChipBackwards(input);
    await userEvent.keyboard('{Enter}');
    await waitUntil(() => tokensOf(input).length === 0, 'the chip expanded');
    expect(submits.events).toHaveLength(0);
    expect(input.value).toBe(long);
  });

  it('Enter with a chip that cannot expand selected still sends', async () => {
    const input = await make();
    const submits = recordEvents(input, ['tct-chat-submit']);
    input.insertToken(ada);
    input.focus();
    await selectChipBackwards(input);
    await userEvent.keyboard('{Enter}');
    expect(submits.events).toHaveLength(1);
    expect(submits.events[0]!.value).toBe('@ada');
  });

  it('a page that prevents tct-chat-token-expand keeps the token', async () => {
    const input = await make();
    input.insertToken({value: 'n'.repeat(260)});
    await input.updateComplete;
    input.addEventListener('tct-chat-token-expand', (event) => event.preventDefault());
    const token = tokensOf(input)[0]!;
    const card = token.shadowRoot!.querySelector<HTMLElement & {show(): Promise<void>}>(
      'tct-hover-card',
    )!;
    await card.show();
    await userEvent.click(token.shadowRoot!.querySelector<HTMLElement>('tct-button')!);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();
    expect(tokensOf(input)).toHaveLength(1);
  });
});

describe('inline tokens: writing a value that contains them', () => {
  it('deserialises tokens through the triggers when the value is written from outside', async () => {
    const input = await make();
    input.triggers = [
      {
        character: '@',
        searchSource: {search: () => []},
        onSelect: () => '',
        deserialize: (word) => (word.startsWith('@') ? {value: word, label: word.slice(1)} : null),
      },
    ];
    input.value = 'ping @ada and @bob now';
    await input.updateComplete;
    expect(tokensOf(input).map((token) => token.getAttribute('data-tct-token-value'))).toEqual([
      '@ada',
      '@bob',
    ]);
    // The round trip is exact: no space is added or lost.
    expect(input.getValue()).toBe('ping @ada and @bob now');
    expect(input.value).toBe('ping @ada and @bob now');
  });

  it('shows a value that has no deserialiser as plain text', async () => {
    const input = await make();
    input.value = 'plain @ada';
    await input.updateComplete;
    expect(tokensOf(input)).toHaveLength(0);
    expect(editableOf(input).textContent).toBe('plain @ada');
  });
});

describe('dictation ghost text', () => {
  it('shows interim text after the draft, hidden from assistive technology and out of the value', async () => {
    const input = await make();
    await type(input, 'said ');
    input.setInterimText('some wo');
    await input.updateComplete;
    const ghost = editableOf(input).querySelector<HTMLElement>('[data-tct-interim]')!;
    expect(ghost.textContent).toBe('some wo');
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    expect(input.getValue()).toBe('said ');
    input.setInterimText('some words');
    expect(editableOf(input).querySelectorAll('[data-tct-interim]')).toHaveLength(1);
    expect(ghost.textContent).toBe('some words');
    input.clearInterimText();
    expect(editableOf(input).querySelector('[data-tct-interim]')).toBeNull();
  });

  it('hides the placeholder while there is only interim text, and restores it after', async () => {
    const input = await make();
    input.setInterimText('listening');
    await input.updateComplete;
    expect(input.shadowRoot!.querySelector('.placeholder')).toBeNull();
    input.clearInterimText();
    await input.updateComplete;
    expect(input.shadowRoot!.querySelector('.placeholder')).not.toBeNull();
  });
});

describe('caret handling around tokens', () => {
  it('puts the caret after the space that follows an inserted token', async () => {
    const input = await make();
    input.insertToken(ada);
    const {node, offset} = caret(input);
    expect(node.nodeType).toBe(Node.TEXT_NODE);
    expect(node.nodeValue).toBe(' ');
    expect(offset).toBe(1);
  });
});
