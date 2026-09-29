/**
 * The events of resizable regions (A§7.6): `tct-size-change` is a notification, `tct-collapse-change`
 * a cancelable intent.
 */
import {describe, expect, it} from 'vitest';
import {TctCollapseChangeEvent} from './tct-collapse-change.js';
import {TctSizeChangeEvent} from './tct-size-change.js';

describe('resizable region events', () => {
  it('tct-size-change: bubbles, composed, not cancelable; carries the size and the reason', () => {
    const event = new TctSizeChangeEvent(240, 'pointer');
    expect(event.type).toBe('tct-size-change');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, false]);
    expect([event.size, event.reason]).toEqual([240, 'pointer']);
  });

  it('tct-collapse-change: cancelable; carries the requested state and the reason', () => {
    const event = new TctCollapseChangeEvent(true, 'keyboard');
    expect(event.type).toBe('tct-collapse-change');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, true]);
    expect([event.collapsed, event.reason]).toEqual([true, 'keyboard']);
  });

  it('preventDefault() is observable by the dispatcher', () => {
    const target = document.createElement('div');
    target.addEventListener('tct-collapse-change', (event) => {
      event.preventDefault();
    });
    expect(target.dispatchEvent(new TctCollapseChangeEvent(true, 'pointer'))).toBe(false);
    expect(target.dispatchEvent(new TctSizeChangeEvent(1, 'keyboard'))).toBe(true);
  });
});
