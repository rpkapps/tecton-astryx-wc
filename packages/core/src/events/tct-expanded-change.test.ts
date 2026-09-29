import {describe, expect, it} from 'vitest';
import {TctExpandedChangeEvent} from './tct-expanded-change.js';

describe('tct-expanded-change', () => {
  it('bubbles, is composed and cancelable, and carries the requested state and reason', () => {
    const event = new TctExpandedChangeEvent(true, 'trigger');
    expect(event.type).toBe('tct-expanded-change');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, true]);
    expect([event.expanded, event.reason]).toEqual([true, 'trigger']);
  });

  it('preventDefault() is observable by the dispatcher', () => {
    const target = new EventTarget();
    target.addEventListener('tct-expanded-change', (event) => {
      event.preventDefault();
    });
    expect(target.dispatchEvent(new TctExpandedChangeEvent(false, 'keyboard'))).toBe(false);
  });
});
