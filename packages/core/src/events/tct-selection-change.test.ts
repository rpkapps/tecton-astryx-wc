/**
 * `tct-selection-change` (WP-12): name, flags and typed payload; `preventDefault()` is honoured by `dispatch`.
 */
import {describe, expect, it} from 'vitest';
import {TctSelectionChangeEvent} from './tct-selection-change.js';

describe('tct-selection-change', () => {
  it('bubbles, is composed and cancelable; carries the action, the item, the new selection and the reason', () => {
    const item = {id: 'a', label: 'A'};
    const event = new TctSelectionChangeEvent('add', item, [item], 'keyboard');
    expect(event.type).toBe('tct-selection-change');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, true]);
    expect([event.action, event.item, event.items, event.reason]).toEqual(['add', item, [item], 'keyboard']);
  });

  it('a single selection that is cleared has a null item and no items', () => {
    const event = new TctSelectionChangeEvent('clear', null, [], 'pointer');
    expect([event.item, event.items.length]).toEqual([null, 0]);
  });

  it('preventDefault() is visible to the dispatcher, through a shadow boundary', () => {
    const host = document.createElement('div');
    const root = host.attachShadow({mode: 'open'});
    const inner = root.appendChild(document.createElement('span'));
    document.body.append(host);
    let seen: TctSelectionChangeEvent | undefined;
    host.addEventListener('tct-selection-change', (event) => {
      seen = event;
      event.preventDefault();
    });
    const event = new TctSelectionChangeEvent('select', null, [], 'pointer');
    const notPrevented = inner.dispatchEvent(event);
    host.remove();
    expect(seen).toBe(event);
    expect(notPrevented).toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });
});
