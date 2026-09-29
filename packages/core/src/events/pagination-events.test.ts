/**
 * Events of the paginator (WP-11): name, flags and typed payload of each.
 */
import {describe, expect, it} from 'vitest';
import {TctPageChangeEvent} from './tct-page-change.js';
import {TctPageSizeChangeEvent} from './tct-page-size-change.js';

describe('pagination events', () => {
  it('tct-page-change: bubbles, composed, cancelable; carries the requested page, the current page and the reason', () => {
    const event = new TctPageChangeEvent(4, 3, 'pointer');
    expect(event.type).toBe('tct-page-change');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, true]);
    expect([event.page, event.oldPage, event.reason]).toEqual([4, 3, 'pointer']);
  });

  it('tct-page-size-change: cancelable, with the requested and the current size', () => {
    const event = new TctPageSizeChangeEvent(50, 10);
    expect(event.type).toBe('tct-page-size-change');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, true]);
    expect([event.pageSize, event.oldPageSize]).toEqual([50, 10]);
  });
});
