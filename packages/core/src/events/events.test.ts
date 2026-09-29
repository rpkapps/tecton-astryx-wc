/**
 * The public event classes (A§7.6, A§9.3): name, flags and typed payload of each.
 */
import {describe, expect, it} from 'vitest';
import {TctAfterOpenChangeEvent} from './tct-after-open-change.js';
import {TctClearEvent} from './tct-clear.js';
import {TctOpenChangeEvent} from './tct-open-change.js';
import {TctRemoveEvent} from './tct-remove.js';
import {TctValueChangeEvent} from './tct-value-change.js';

describe('library events', () => {
  it('tct-open-change: bubbles, composed, cancelable; carries the requested state and reason', () => {
    const event = new TctOpenChangeEvent(true, 'escape');
    expect(event.type).toBe('tct-open-change');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, true]);
    expect([event.open, event.reason]).toEqual([true, 'escape']);
  });

  it('tct-after-open-change: a notification, not cancelable', () => {
    const event = new TctAfterOpenChangeEvent(false);
    expect(event.type).toBe('tct-after-open-change');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, false]);
    expect(event.open).toBe(false);
  });

  it('tct-value-change: cancelable, with value, oldValue and reason', () => {
    const event = new TctValueChangeEvent('b', 'a', 'keyboard');
    expect(event.type).toBe('tct-value-change');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, true]);
    expect([event.value, event.oldValue, event.reason]).toEqual(['b', 'a', 'keyboard']);
  });

  it('tct-clear and tct-remove are cancelable intents', () => {
    const clear = new TctClearEvent();
    expect([clear.type, clear.cancelable, clear.composed]).toEqual(['tct-clear', true, true]);
    const remove = new TctRemoveEvent('tag-1');
    expect([remove.type, remove.cancelable, remove.value]).toEqual(['tct-remove', true, 'tag-1']);
  });

  it('preventDefault() is observable by the dispatcher', () => {
    const target = document.createElement('div');
    target.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    expect(target.dispatchEvent(new TctOpenChangeEvent(false, 'outside'))).toBe(false);
    expect(target.dispatchEvent(new TctAfterOpenChangeEvent(false))).toBe(true);
  });
});
