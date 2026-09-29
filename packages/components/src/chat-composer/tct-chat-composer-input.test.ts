/// <reference types="@vitest/browser-playwright" />
import {html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {cdp, userEvent} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {expectEventCounts, expectEventFlags, recordEvents} from '@tecton-wc/testing/events.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import './define.js';
import {overridePlaintextOnly} from './chat-composer.platform.js';
import {ChatPasteAsTokenController} from './chat-paste-as-token.js';
import type {TctChatComposerInput} from './tct-chat-composer-input.js';

const editableOf = (input: Element): HTMLElement =>
  input.shadowRoot!.querySelector<HTMLElement>('.editable')!;

/** A `paste` with plain text and/or files, as the browser would deliver it. */
function paste(target: Element, data: {text?: string; html?: string; files?: File[]}): ClipboardEvent {
  const clipboardData = new DataTransfer();
  if (data.text !== undefined) clipboardData.setData('text/plain', data.text);
  if (data.html !== undefined) clipboardData.setData('text/html', data.html);
  for (const file of data.files ?? []) clipboardData.items.add(file);
  const event = new ClipboardEvent('paste', {
    clipboardData,
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  target.dispatchEvent(event);
  return event;
}

function drop(target: Element, files: File[], type: 'dragover' | 'drop' = 'drop'): DragEvent {
  const dataTransfer = new DataTransfer();
  for (const file of files) dataTransfer.items.add(file);
  const event = new DragEvent(type, {dataTransfer, bubbles: true, cancelable: true, composed: true});
  target.dispatchEvent(event);
  return event;
}

async function make(attributes = ''): Promise<TctChatComposerInput> {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: 420px"><tct-chat-composer-input ${attributes}></tct-chat-composer-input></div>`,
  );
  return root.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
}

/** Focuses the editable and types with the real keyboard. */
async function type(input: TctChatComposerInput, text: string): Promise<void> {
  if (deepActiveElement() !== editableOf(input)) editableOf(input).focus();
  await userEvent.keyboard(text);
}

afterEach(() => {
  overridePlaintextOnly(undefined);
});

runElementSuite({
  tag: 'tct-chat-composer-input',
  properties: {maxRows: 4, debounceMs: 0, noHistory: true, label: 'Compose'},
  attributes: {maxRows: 'max-rows', debounceMs: 'debounce-ms', noHistory: 'no-history', label: 'label'},
  events: ['tct-chat-submit', 'tct-chat-files', 'tct-chat-paste'],
  // The default render is a named textbox; axe runs on it in the states below.
});

describe('tct-chat-composer-input: rendering', () => {
  it('is a named multiline textbox with a placeholder, and the soft keyboard offers Send', async () => {
    const input = await make();
    const editable = editableOf(input);
    expect(editable.getAttribute('role')).toBe('textbox');
    expect(editable.getAttribute('aria-multiline')).toBe('true');
    expect(editable.getAttribute('aria-label')).toBe('Message input');
    expect(editable.getAttribute('enterkeyhint')).toBe('send');
    expect(editable.getAttribute('aria-placeholder')).toBe('Type a message…');
    expect(editable.getAttribute('contenteditable')).toBe('plaintext-only');
    const placeholder = input.shadowRoot!.querySelector('.placeholder')!;
    expect(placeholder.textContent).toContain('Type a message…');
    expect(placeholder.getAttribute('aria-hidden')).toBe('true');
    if (isChromium) {
      expect(await axNode(editable)).toMatchObject({role: 'textbox', name: 'Message input'});
    }
    await expectAccessible(input);
  });

  it('takes a custom placeholder, label and key hint', async () => {
    const root = await fixture<HTMLElement>(
      `<div><tct-chat-composer-input placeholder="Ask anything" label="Prompt" enterkeyhint="enter"></tct-chat-composer-input></div>`,
    );
    const input = root.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
    const editable = editableOf(input);
    expect(input.shadowRoot!.querySelector('.placeholder')!.textContent).toContain('Ask anything');
    expect(editable.getAttribute('aria-label')).toBe('Prompt');
    expect(editable.getAttribute('enterkeyhint')).toBe('enter');
    input.setAttribute('enterkeyhint', 'done');
    await input.updateComplete;
    expect(editable.getAttribute('enterkeyhint')).toBe('done');
  });

  it('hides the placeholder as soon as there is text', async () => {
    const input = await make();
    await type(input, 'h');
    await input.updateComplete;
    expect(input.shadowRoot!.querySelector('.placeholder')).toBeNull();
  });

  it('starts with the value attribute as the draft, and follows the value property without events', async () => {
    const input = await make('value="first draft"');
    const editable = editableOf(input);
    expect(editable.textContent).toBe('first draft');
    expect(input.shadowRoot!.querySelector('.placeholder')).toBeNull();
    const events = recordEvents(input, ['input', 'change', 'tct-chat-submit']);
    input.value = 'second';
    await input.updateComplete;
    expect(editable.textContent).toBe('second');
    input.value = '';
    await input.updateComplete;
    expect(editable.textContent).toBe('');
    expect(input.shadowRoot!.querySelector('.placeholder')).not.toBeNull();
    expectEventCounts(events, {});
  });

  it('grows with its text up to max-rows and then scrolls', async () => {
    const input = await make('max-rows="3"');
    const editable = editableOf(input);
    const one = editable.getBoundingClientRect().height;
    input.value = 'a\nb';
    await input.updateComplete;
    expect(editable.getBoundingClientRect().height).toBeGreaterThan(one);
    input.value = 'a\nb\nc\nd\ne\nf';
    await input.updateComplete;
    const capped = editable.getBoundingClientRect().height;
    expect(editable.scrollHeight).toBeGreaterThan(editable.clientHeight);
    input.value = 'a\nb\nc\nd\ne\nf\ng\nh';
    await input.updateComplete;
    expect(editable.getBoundingClientRect().height).toBe(capped);
  });
});

describe('tct-chat-composer-input: disabled', () => {
  it('is exposed as disabled, not editable, and still a focus stop', async () => {
    const input = await make('disabled');
    const editable = editableOf(input);
    expect(editable.getAttribute('aria-disabled')).toBe('true');
    expect(editable.getAttribute('contenteditable')).toBe('false');
    editable.focus();
    expect(deepActiveElement()).toBe(editable);
    await userEvent.keyboard('nope');
    expect(input.value).toBe('');
    expect(editable.textContent).toBe('');
    if (isChromium) expect(await axNode(editable)).toMatchObject({role: 'textbox', disabled: 'true'});
    await expectAccessible(input);
  });

  it('keeps focus when it becomes disabled while focused (a send disables the composer)', async () => {
    const input = await make();
    await type(input, 'hi');
    input.disabled = true;
    await input.updateComplete;
    expect(deepActiveElement()).toBe(editableOf(input));
    await userEvent.keyboard('more');
    expect(input.value).toBe('hi');
    input.disabled = false;
    await input.updateComplete;
    await userEvent.keyboard('!');
    expect(input.value).toBe('hi!');
  });

  it('ignores insertText, insertToken and files while disabled', async () => {
    const input = await make('disabled');
    const events = recordEvents(input, ['input', 'tct-chat-files']);
    input.insertText('x');
    expect(input.insertToken({value: '@a', label: 'A'})).toBeUndefined();
    drop(editableOf(input), [new File(['x'], 'a.txt')]);
    expect(input.getValue()).toBe('');
    expectEventCounts(events, {});
  });
});

describe('tct-chat-composer-input: change events and value', () => {
  it('fires one input event per edit and publishes the value, without a change event', async () => {
    const input = await make();
    const events = recordEvents(input, ['input', 'change']);
    await type(input, 'abc');
    expectEventCounts(events, {input: 3, change: 0});
    expect(input.value).toBe('abc');
    expect(input.getValue()).toBe('abc');
    expectEventFlags(events.named('input')[0]!, {bubbles: true, composed: true});
  });

  it('treats whitespace only as empty and keeps the placeholder', async () => {
    const input = await make();
    await type(input, '   ');
    await input.updateComplete;
    expect(input.value).toBe('');
    expect(input.shadowRoot!.querySelector('.placeholder')).not.toBeNull();
  });

  it('insertText inserts at the caret, updates the placeholder and fires input once', async () => {
    const input = await make();
    const events = recordEvents(input, ['input']);
    input.insertText('dictated words');
    await input.updateComplete;
    expect(input.value).toBe('dictated words');
    expect(input.shadowRoot!.querySelector('.placeholder')).toBeNull();
    expectEventCounts(events, {input: 1});
    expect(events.events[0]).toBeInstanceOf(InputEvent);
  });

  it('writes a value from outside without disturbing a caret at the end, and skips the echo of its own edit', async () => {
    const input = await make();
    await type(input, 'ab');
    input.value = 'abcd';
    await input.updateComplete;
    await userEvent.keyboard('e');
    expect(input.value).toBe('abcde');
  });
});

describe('tct-chat-composer-input: Enter, Shift+Enter and IME', () => {
  it('Enter submits the trimmed draft once and clears the field', async () => {
    const input = await make();
    const submits = recordEvents(input, ['tct-chat-submit']);
    const inputs = recordEvents(input, ['input']);
    await type(input, '  hello world  ');
    inputs.events.length = 0;
    await userEvent.keyboard('{Enter}');
    expect(submits.events).toHaveLength(1);
    expect(submits.events[0]!.value).toBe('hello world');
    expectEventFlags(submits.events[0]!, {bubbles: true, composed: true, cancelable: true});
    expect(input.value).toBe('');
    expect(editableOf(input).textContent).toBe('');
    // The clear is one input event, and Enter never became a newline.
    expect(inputs.named('input')).toHaveLength(1);
    await input.updateComplete;
    expect(input.shadowRoot!.querySelector('.placeholder')).not.toBeNull();
  });

  it('Shift+Enter inserts a newline and does not submit', async () => {
    const input = await make();
    const submits = recordEvents(input, ['tct-chat-submit']);
    await type(input, 'one');
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}two');
    expect(submits.events).toHaveLength(0);
    expect(input.value).toBe('one\ntwo');
  });

  it('Enter on a blank draft does nothing (no submit, no blank line)', async () => {
    const input = await make();
    const submits = recordEvents(input, ['tct-chat-submit']);
    await type(input, '{Enter}');
    await userEvent.keyboard('{Enter}');
    expect(submits.events).toHaveLength(0);
    expect(editableOf(input).textContent).toBe('');
  });

  it('a prevented tct-chat-submit keeps the draft and leaves Enter to the editor (touch newline recipe)', async () => {
    const input = await make();
    input.addEventListener('tct-chat-submit', (event) => {
      event.preventDefault();
    });
    await type(input, 'draft');
    await userEvent.keyboard('{Enter}more');
    expect(input.value).toBe('draft\nmore');
  });

  it('a capture-phase keydown handler that prevents Enter takes the key (upstream onKeyDown seam)', async () => {
    const root = await fixture<HTMLElement>(
      `<div><tct-chat-composer-input></tct-chat-composer-input></div>`,
    );
    const input = root.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
    const submits = recordEvents(input, ['tct-chat-submit']);
    root.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) return;
        if (event.key === 'Enter') event.preventDefault();
      },
      true,
    );
    await type(input, 'draft');
    await userEvent.keyboard('{Enter}');
    expect(submits.events).toHaveLength(0);
    expect(input.value).toBe('draft');
  });

  it('does not submit on an Enter that arrives while an IME composition is in progress', async () => {
    const input = await make();
    const submits = recordEvents(input, ['tct-chat-submit']);
    const editable = editableOf(input);
    await type(input, 'draft');
    editable.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true, composed: true}));
    const composing = new KeyboardEvent('keydown', {
      key: 'Enter',
      isComposing: true,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    editable.dispatchEvent(composing);
    expect(submits.events).toHaveLength(0);
    expect(composing.defaultPrevented).toBe(false);
    editable.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true, composed: true}));
    await userEvent.keyboard('{Enter}');
    expect(submits.events).toHaveLength(1);
  });

  it('does not submit on the legacy keyCode 229 confirming Enter (Safari orders it after compositionend)', async () => {
    const input = await make();
    const submits = recordEvents(input, ['tct-chat-submit']);
    await type(input, 'draft');
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      keyCode: 229,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    editableOf(input).dispatchEvent(event);
    expect(submits.events).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it.skipIf(!isChromium)(
    'a real input-method composition never submits on its Enter, and Enter submits once it ended',
    async () => {
      const input = await make();
      const submits = recordEvents(input, ['tct-chat-submit']);
      const editable = editableOf(input);
      const keys: boolean[] = [];
      editable.addEventListener(
        'keydown',
        (event) => {
          keys.push(event.isComposing);
        },
        true,
      );
      await type(input, 'a');
      const session = cdp();
      await session.send('Input.imeSetComposition', {text: 'に', selectionStart: 1, selectionEnd: 1});
      expect(input.value).toBe('aに');
      await userEvent.keyboard('{Enter}');
      expect(keys.at(-1)).toBe(true);
      expect(submits.events).toHaveLength(0);
      await session.send('Input.insertText', {text: 'ほ'});
      await userEvent.keyboard('{Enter}');
      expect(submits.events).toHaveLength(1);
      expect(submits.events[0]!.value).toBe('aほ');
    },
  );

  it('arrow keys during a composition never recall history', async () => {
    const input = await make();
    await type(input, 'first');
    await userEvent.keyboard('{Enter}');
    const editable = editableOf(input);
    editable.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true, composed: true}));
    const arrow = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      isComposing: true,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    editable.dispatchEvent(arrow);
    expect(arrow.defaultPrevented).toBe(false);
    expect(input.value).toBe('');
  });

  it('submit() sends like Enter and reports whether it did', async () => {
    const input = await make();
    const submits = recordEvents(input, ['tct-chat-submit']);
    expect(input.submit()).toBe(false);
    input.insertText('  via method ');
    expect(input.submit()).toBe(true);
    expect(submits.events[0]!.value).toBe('via method');
    expect(input.value).toBe('');
  });
});

describe('tct-chat-composer-input: message history', () => {
  async function withHistory(...messages: string[]): Promise<TctChatComposerInput> {
    const input = await make();
    for (const message of messages) {
      await type(input, message);
      await userEvent.keyboard('{Enter}');
    }
    return input;
  }

  it('ArrowUp at the very start of an empty draft recalls the previous message, fully selected', async () => {
    const input = await withHistory('first');
    await userEvent.keyboard('{ArrowUp}');
    expect(input.value).toBe('first');
    const selection = document.getSelection()!;
    expect(selection.rangeCount).toBeGreaterThan(0);
  });

  it('steps back and forth, and restores the draft being typed past the newest message', async () => {
    const input = await withHistory('first', 'second');
    await type(input, 'pending');
    // Caret at the end of a non-empty draft is not the start: ArrowUp moves the caret instead.
    await userEvent.keyboard('{ArrowUp}');
    expect(input.value).toBe('pending');
    await userEvent.keyboard('{Home}');
    await userEvent.keyboard('{ArrowUp}');
    expect(input.value).toBe('second');
    await userEvent.keyboard('{ArrowUp}');
    expect(input.value).toBe('first');
    await userEvent.keyboard('{ArrowUp}');
    expect(input.value).toBe('first');
    await userEvent.keyboard('{ArrowDown}');
    expect(input.value).toBe('second');
    await userEvent.keyboard('{ArrowDown}');
    expect(input.value).toBe('pending');
  });

  it('does not recall from the middle of the text, and moves the caret between lines as usual', async () => {
    const input = await withHistory('old');
    await type(input, 'ab');
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}');
    expect(input.value).toBe('ab');
  });

  it('does nothing without history, and not at all with no-history', async () => {
    const empty = await make();
    await type(empty, '{ArrowUp}');
    expect(empty.value).toBe('');
    const off = await make('no-history');
    await type(off, 'sent');
    await userEvent.keyboard('{Enter}{ArrowUp}');
    expect(off.value).toBe('');
  });

  it('a recalled draft is a normal draft: one input event, published value', async () => {
    const input = await withHistory('again');
    const events = recordEvents(input, ['input']);
    await userEvent.keyboard('{ArrowUp}');
    expectEventCounts(events, {input: 1});
    expect(input.value).toBe('again');
  });
});

describe('tct-chat-composer-input: paste, files and drops', () => {
  it('pastes plain text at the caret and fires one input event; markup never gets in', async () => {
    const input = await make();
    const events = recordEvents(input, ['input']);
    await type(input, 'ab');
    const event = paste(editableOf(input), {text: 'CD', html: '<b>CD</b><script>1</script>'});
    expect(event.defaultPrevented).toBe(true);
    expect(input.value).toBe('abCD');
    expect(editableOf(input).querySelector('b, script')).toBeNull();
    expect(events.named('input').at(-1)!).toBeInstanceOf(InputEvent);
    expect(events.named('input')).toHaveLength(3);
  });

  it('paste inserts after a focus() that left no selection range', async () => {
    const input = await make();
    editableOf(input).focus();
    document.getSelection()!.removeAllRanges();
    paste(editableOf(input), {text: 'hello'});
    expect(input.value).toBe('hello');
  });

  it('turns a paste over 200 characters into one token chip that submits as its text', async () => {
    const input = await make();
    const long = 'x'.repeat(201);
    paste(editableOf(input), {text: long});
    await input.updateComplete;
    const token = editableOf(input).querySelector('tct-chat-composer-token-element');
    expect(token).not.toBeNull();
    expect(token!.hasAttribute('expandable')).toBe(true);
    expect(input.value).toBe(`${long} `);
    expect(input.getValue()).toBe(`${long} `);
    // Exactly 200 stays text.
    const other = await make();
    paste(editableOf(other), {text: 'y'.repeat(200)});
    expect(editableOf(other).querySelector('tct-chat-composer-token-element')).toBeNull();
    expect(other.value).toBe('y'.repeat(200));
  });

  it('pasteAsToken=false and no-paste-as-token turn conversion off', async () => {
    const off = await make('no-paste-as-token');
    paste(editableOf(off), {text: 'z'.repeat(300)});
    expect(editableOf(off).querySelector('tct-chat-composer-token-element')).toBeNull();
    expect(off.value).toHaveLength(300);
    const other = await make();
    other.pasteAsToken = false;
    paste(editableOf(other), {text: 'z'.repeat(300)});
    expect(editableOf(other).querySelector('tct-chat-composer-token-element')).toBeNull();
  });

  it('a custom ChatPasteAsTokenController sets the threshold and the token', async () => {
    const input = await make();
    input.pasteAsToken = new ChatPasteAsTokenController({
      input: () => input,
      threshold: 10,
      toToken: (text) => ({value: text, label: `Pasted ${text.length}`, variant: 'info'}),
    });
    paste(editableOf(input), {text: 'short text'});
    expect(editableOf(input).querySelector('tct-chat-composer-token-element')).toBeNull();
    paste(editableOf(input), {text: 'a bit longer text'});
    await input.updateComplete;
    const token = editableOf(input).querySelector('tct-chat-composer-token-element')!;
    expect(token.getAttribute('data-tct-token-value')).toBe('a bit longer text');
  });

  it('gives the page first refusal: a prevented tct-chat-paste stops conversion and insertion', async () => {
    const input = await make();
    const events = recordEvents(input, ['input']);
    input.addEventListener('tct-chat-paste', (event) => {
      expect(event.text).toBe('q'.repeat(300));
      event.preventDefault();
    });
    paste(editableOf(input), {text: 'q'.repeat(300)});
    expect(input.value).toBe('');
    // The page handled it without inserting anything: the change is still published once.
    expectEventCounts(events, {input: 1});
  });

  it('publishes once when the page inserts through the handle while handling the paste', async () => {
    const input = await make();
    const events = recordEvents(input, ['input']);
    input.addEventListener('tct-chat-paste', (event) => {
      event.preventDefault();
      input.insertText('[handled]');
    });
    paste(editableOf(input), {text: 'raw'});
    expect(input.value).toBe('[handled]');
    expectEventCounts(events, {input: 1});
  });

  it('a paste claimed by an ancestor in the capture phase is left alone', async () => {
    const root = await fixture<HTMLElement>('<div><tct-chat-composer-input></tct-chat-composer-input></div>');
    const input = root.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
    root.addEventListener('paste', (event) => event.preventDefault(), true);
    paste(editableOf(input), {text: 'mine'});
    expect(input.value).toBe('');
  });

  it('reports files pasted or dropped through tct-chat-files and never inserts them', async () => {
    const input = await make();
    const files = recordEvents(input, ['tct-chat-files']);
    const file = new File(['data'], 'notes.txt', {type: 'text/plain'});
    const pasted = paste(editableOf(input), {files: [file]});
    expect(pasted.defaultPrevented).toBe(true);
    expect((files.events[0] as unknown as {source: string}).source).toBe('paste');
    expect((files.events[0] as unknown as {files: File[]}).files).toEqual([file]);
    const over = drop(editableOf(input), [file], 'dragover');
    expect(over.defaultPrevented).toBe(true);
    const dropped = drop(editableOf(input), [file]);
    expect(dropped.defaultPrevented).toBe(true);
    expect(files.events).toHaveLength(2);
    expect((files.events[1] as unknown as {source: string}).source).toBe('drop');
    expect(input.value).toBe('');
  });

  it('swallows a file drop even when nothing listens, and reports none while disabled', async () => {
    const input = await make('disabled');
    const files = recordEvents(input, ['tct-chat-files']);
    const dropped = drop(editableOf(input), [new File(['x'], 'a.txt')]);
    expect(dropped.defaultPrevented).toBe(true);
    expect(files.events).toHaveLength(0);
  });
});

describe('tct-chat-composer-input: caret and focus', () => {
  it('focus() puts the caret after the draft when there was none', async () => {
    const input = await make('value="pending draft"');
    document.getSelection()!.removeAllRanges();
    input.focus();
    expect(deepActiveElement()).toBe(editableOf(input));
    await userEvent.keyboard('!');
    expect(input.value).toBe('pending draft!');
  });

  it('focus() keeps a caret the user already had in the field', async () => {
    const input = await make('value="pending draft"');
    const editable = editableOf(input);
    editable.focus();
    const text = editable.firstChild!;
    document.getSelection()!.setBaseAndExtent(text, 7, text, 7);
    editable.blur();
    document.getSelection()!.setBaseAndExtent(text, 7, text, 7);
    input.focus();
    await userEvent.keyboard('_');
    expect(input.value).toBe('pending_ draft');
  });

  it('a pending draft survives ArrowUp after focus() (the caret is not at the start)', async () => {
    const input = await make();
    await type(input, 'sent');
    await userEvent.keyboard('{Enter}');
    input.value = 'pending draft';
    await input.updateComplete;
    document.getSelection()!.removeAllRanges();
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(input.value).toBe('pending draft');
  });
});

describe('tct-chat-composer-input: accessibility', () => {
  it('passes axe in the empty, typed and multi-line states, in light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const root = await fixture<HTMLElement>(
        `<div style="inline-size: 420px"><tct-chat-composer-input></tct-chat-composer-input></div>`,
        {theme},
      );
      const input = root.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
      await expectAccessible(root);
      await type(input, 'typed');
      await userEvent.keyboard('{Shift>}{Enter}{/Shift}line two');
      await expectAccessible(root);
    }
  });

  it('shows its own focus ring when keyboard focus lands on it standalone', async () => {
    const root = await fixture<HTMLElement>(
      `<div><button type="button">before</button><tct-chat-composer-input></tct-chat-composer-input></div>`,
    );
    root.querySelector('button')!.focus();
    await userEvent.tab();
    const editable = editableOf(root.querySelector('tct-chat-composer-input')!);
    expect(deepActiveElement()).toBe(editable);
    expect(getComputedStyle(editable).outlineStyle).not.toBe('none');
    await waitUntil(() => getComputedStyle(editable).outlineWidth !== '0px', 'ring width');
  });
});

describe('tct-chat-composer-input: fallback surface (no contenteditable="plaintext-only")', () => {
  it('uses a plain contenteditable and keeps newlines as text', async () => {
    overridePlaintextOnly(false);
    const input = await make();
    const editable = editableOf(input);
    expect(editable.getAttribute('contenteditable')).toBe('true');
    await type(input, 'one');
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}two');
    expect(input.value).toBe('one\ntwo');
    expect(editable.querySelector('div, p, br')).toBeNull();
  });

  it('refuses rich formatting and markup on the fallback surface', async () => {
    overridePlaintextOnly(false);
    const input = await make();
    await type(input, 'abc');
    await userEvent.keyboard('{Control>}a{/Control}{Control>}b{/Control}');
    expect(editableOf(input).querySelector('b, strong')).toBeNull();
    const dropped = new DragEvent('drop', {
      dataTransfer: new DataTransfer(),
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    dropped.dataTransfer!.setData('text/html', '<b>x</b>');
    editableOf(input).dispatchEvent(dropped);
    expect(dropped.defaultPrevented).toBe(true);
    expect(editableOf(input).querySelector('b')).toBeNull();
  });

  it('serialises an engine paragraph structure as lines', async () => {
    overridePlaintextOnly(false);
    const input = await make();
    editableOf(input).innerHTML = 'one<div>two</div><div><br></div><div>four</div>';
    editableOf(input).dispatchEvent(new InputEvent('input', {bubbles: true, composed: true}));
    expect(input.getValue()).toBe('one\ntwo\n\nfour');
  });
});

describe('tct-chat-composer-input: composer context', () => {
  it('works with no composer around it and registers nothing', async () => {
    const template = html`<tct-chat-composer-input></tct-chat-composer-input>`;
    const input = await fixture<TctChatComposerInput>(template);
    expect(input.shadowRoot!.querySelector('.root')!.hasAttribute('data-composer')).toBe(false);
  });
});

describe('tct-chat-composer-input: right to left, forced colours and localisation', () => {
  it('lays text, placeholder and tokens out from the right in right-to-left', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 420px"><tct-chat-composer-input></tct-chat-composer-input></div>`,
      {dir: 'rtl'},
    );
    const input = root.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
    const box = input.getBoundingClientRect();
    const placeholder = input.shadowRoot!.querySelector('.placeholder')!;
    const range = document.createRange();
    range.selectNodeContents(placeholder);
    // The placeholder text starts at the inline start: the right edge in right-to-left.
    expect(box.right - range.getBoundingClientRect().right).toBeLessThan(
      range.getBoundingClientRect().left - box.left,
    );
    input.insertToken({value: '@ada', label: 'Ada Lovelace'});
    await input.updateComplete;
    const chip = editableOf(input).querySelector('[data-tct-token]')!;
    expect(box.right - chip.getBoundingClientRect().right).toBeLessThan(
      chip.getBoundingClientRect().left - box.left,
    );
    expect(input.getValue()).toBe('@ada ');
    await expectAccessible(root);
  });

  it('keeps the text visible in forced colours', async () => {
    if (!isChromium) return;
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const input = await make();
      input.insertToken({value: '@ada', label: 'Ada Lovelace'});
      await input.updateComplete;
      const chip = editableOf(input).querySelector<HTMLElement>('[data-tct-token]')!;
      expect(chip.getBoundingClientRect().width).toBeGreaterThan(0);
      // The system palette colours the text: it must not be forced to transparent.
      expect(getComputedStyle(editableOf(input)).color).not.toBe('rgba(0, 0, 0, 0)');
    } finally {
      await restore();
    }
  });

  it('translates the default label and placeholder, and attributes override them', async () => {
    const root = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-chat-composer-input></tct-chat-composer-input></div>`,
    );
    const input = root.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
    await waitUntil(
      () => editableOf(input).getAttribute('aria-label') !== 'Message input',
      'the German catalog loads',
    );
    expect(input.shadowRoot!.querySelector('.placeholder')!.textContent).not.toContain('Type a message');
    input.label = 'Eigener Name';
    await input.updateComplete;
    expect(editableOf(input).getAttribute('aria-label')).toBe('Eigener Name');
  });
});
