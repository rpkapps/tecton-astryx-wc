/**
 * Events of the collection family (WP-5): name, flags and typed payload of each.
 */
import {describe, expect, it} from 'vitest';
import {TctOverflowChangeEvent} from './tct-overflow-change.js';
import {TctTreeToggleEvent} from './tct-tree-toggle.js';

describe('collection events', () => {
  it('tct-tree-toggle: bubbles, composed, cancelable; carries the item id, the next state and the reason', () => {
    const event = new TctTreeToggleEvent('wells', true, 'keyboard');
    expect(event.type).toBe('tct-tree-toggle');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, true]);
    expect([event.id, event.expanded, event.reason]).toEqual(['wells', true, 'keyboard']);
  });

  it('tct-overflow-change: a notification, not cancelable, with the collapsed items', () => {
    const element = document.createElement('div');
    const event = new TctOverflowChangeEvent([{element, index: 3}]);
    expect(event.type).toBe('tct-overflow-change');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, false]);
    expect(event.items).toEqual([{element, index: 3}]);
  });
});
