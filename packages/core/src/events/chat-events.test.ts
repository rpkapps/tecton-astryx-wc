/**
 * The chat composer's event classes (A§7.6, A§9.3): name, flags and typed payload of each.
 */
import {describe, expect, it} from 'vitest';
import {TctChatFilesEvent} from './tct-chat-files.js';
import {TctChatPasteEvent} from './tct-chat-paste.js';
import {TctChatSendEvent} from './tct-chat-send.js';
import {TctChatStopEvent} from './tct-chat-stop.js';
import {TctChatSubmitEvent} from './tct-chat-submit.js';
import {TctChatTokenExpandEvent} from './tct-chat-token-expand.js';

const flags = (event: Event): boolean[] => [event.bubbles, event.composed, event.cancelable];

describe('chat composer events', () => {
  it('tct-chat-submit: a cancelable intent carrying the trimmed draft', () => {
    const event = new TctChatSubmitEvent('hello');
    expect(event.type).toBe('tct-chat-submit');
    expect(flags(event)).toEqual([true, true, true]);
    expect(event.value).toBe('hello');
  });

  it('tct-chat-send: a cancelable intent with no payload', () => {
    const event = new TctChatSendEvent();
    expect(event.type).toBe('tct-chat-send');
    expect(flags(event)).toEqual([true, true, true]);
  });

  it('tct-chat-stop: a notification, not cancelable', () => {
    const event = new TctChatStopEvent();
    expect(event.type).toBe('tct-chat-stop');
    expect(flags(event)).toEqual([true, true, false]);
  });

  it('tct-chat-files: a notification with the files and where they came from', () => {
    const file = new File(['x'], 'a.txt');
    const event = new TctChatFilesEvent([file], 'drop');
    expect(event.type).toBe('tct-chat-files');
    expect(flags(event)).toEqual([true, true, false]);
    expect(event.files).toEqual([file]);
    expect(event.source).toBe('drop');
  });

  it('tct-chat-paste: a cancelable intent with the plain text', () => {
    const event = new TctChatPasteEvent('pasted');
    expect(event.type).toBe('tct-chat-paste');
    expect(flags(event)).toEqual([true, true, true]);
    expect(event.text).toBe('pasted');
  });

  it('tct-chat-token-expand: a cancelable intent with the token value', () => {
    const event = new TctChatTokenExpandEvent('long text');
    expect(event.type).toBe('tct-chat-token-expand');
    expect(flags(event)).toEqual([true, true, true]);
    expect(event.value).toBe('long text');
  });
});
