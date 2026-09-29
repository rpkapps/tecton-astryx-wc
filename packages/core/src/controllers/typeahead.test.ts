/**
 * `TypeaheadController` (A§9.13): buffer, cycling, locale-aware base matching, disabled skipping,
 * reset. Pure logic over synthetic key events, so it runs without a host element.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TypeaheadController} from './typeahead.js';

const key = (value: string, init: KeyboardEventInit = {}): KeyboardEvent =>
  new KeyboardEvent('keydown', {key: value, ...init});

const FRUIT = ['Apple', 'Avocado', 'Banana', 'Blueberry', 'Cherry'];

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('isTypeaheadKey', () => {
  const typeahead = new TypeaheadController();

  it('accepts single printable characters, including astral ones, and Alt compositions', () => {
    expect(typeahead.isTypeaheadKey(key('a'))).toBe(true);
    expect(typeahead.isTypeaheadKey(key('É'))).toBe(true);
    expect(typeahead.isTypeaheadKey(key('😀'))).toBe(true);
    expect(typeahead.isTypeaheadKey(key('å', {altKey: true}))).toBe(true);
  });

  it('rejects named keys, chords, composing keys and a lone Space', () => {
    expect(typeahead.isTypeaheadKey(key('Enter'))).toBe(false);
    expect(typeahead.isTypeaheadKey(key('ArrowDown'))).toBe(false);
    expect(typeahead.isTypeaheadKey(key('a', {ctrlKey: true}))).toBe(false);
    expect(typeahead.isTypeaheadKey(key('a', {metaKey: true}))).toBe(false);
    expect(typeahead.isTypeaheadKey(key('a', {isComposing: true}))).toBe(false);
    expect(typeahead.isTypeaheadKey(key(' '))).toBe(false);
  });

  it('Space extends a search in progress', () => {
    const controller = new TypeaheadController();
    controller.match(key('a'), ['a b', 'a c'], -1);
    expect(controller.isTypeaheadKey(key(' '))).toBe(true);
  });
});

describe('match', () => {
  it('finds the first label starting with the typed character, from the start when nothing is current', () => {
    const controller = new TypeaheadController();
    expect(controller.match(key('b'), FRUIT, -1)).toBe(2);
  });

  it('a single character starts after the current item, so repeats walk the matches', () => {
    const controller = new TypeaheadController();
    expect(controller.match(key('a'), FRUIT, -1)).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(controller.match(key('a'), FRUIT, 0)).toBe(1);
    // Same letter again inside the window: still cycling, not "aa".
    expect(controller.match(key('a'), FRUIT, 1)).toBe(0);
  });

  it('a longer buffer refines and may keep the current item', () => {
    const controller = new TypeaheadController();
    expect(controller.match(key('b'), FRUIT, 0)).toBe(2);
    expect(controller.match(key('l'), FRUIT, 2)).toBe(3);
    expect(controller.buffer).toBe('bl');
    const kept = new TypeaheadController();
    kept.match(key('b'), FRUIT, -1);
    expect(kept.match(key('a'), FRUIT, 2)).toBe(2);
  });

  it('the buffer resets after the pause and on reset()', () => {
    const controller = new TypeaheadController({resetMs: 300});
    controller.match(key('c'), FRUIT, -1);
    expect(controller.buffer).toBe('c');
    vi.advanceTimersByTime(301);
    expect(controller.buffer).toBe('');
    controller.match(key('c'), FRUIT, -1);
    controller.reset();
    expect(controller.buffer).toBe('');
  });

  it('is case and accent insensitive', () => {
    const controller = new TypeaheadController();
    expect(controller.match(key('e'), ['Zebra', 'Éclair'], -1)).toBe(1);
    expect(controller.match(key('É'), ['zebra', 'eclair'], -1)).toBe(1);
  });

  it('follows the locale collation (base letters, e.g. Swedish å is not a)', () => {
    const swedish = new TypeaheadController({locale: () => 'sv'});
    expect(swedish.match(key('a'), ['Åsa', 'Anna'], -1)).toBe(1);
    const english = new TypeaheadController({locale: () => 'en'});
    expect(english.match(key('a'), ['Åsa', 'Anna'], -1)).toBe(0);
  });

  it('skips disabled items and null labels; ignores leading whitespace in labels', () => {
    const controller = new TypeaheadController();
    expect(controller.match(key('a'), FRUIT, -1, (index) => index === 0)).toBe(1);
    expect(new TypeaheadController().match(key('x'), [null, undefined, '  Xylophone'], -1)).toBe(2);
  });

  it('never cuts a surrogate pair', () => {
    const controller = new TypeaheadController();
    expect(controller.match(key('😀'), ['nope', '😀 smile'], -1)).toBe(1);
  });

  it('returns -1 for non-typeahead keys, empty lists and no match', () => {
    const controller = new TypeaheadController();
    expect(controller.match(key('Enter'), FRUIT, -1)).toBe(-1);
    expect(controller.match(key('a'), [], -1)).toBe(-1);
    expect(controller.match(key('z'), FRUIT, -1)).toBe(-1);
  });
});
