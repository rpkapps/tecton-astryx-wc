/**
 * The public event classes (A§7.6, A§9.3): name, flags and typed payload of each.
 */
import {describe, expect, it} from 'vitest';
import {TctActionEvent} from './tct-action.js';
import {TctAfterOpenChangeEvent} from './tct-after-open-change.js';
import {TctClearEvent} from './tct-clear.js';
import {TctDismissEvent} from './tct-dismiss.js';
import {TctEnterEvent} from './tct-enter.js';
import {TctOpenChangeEvent} from './tct-open-change.js';
import {TctPressedChangeEvent} from './tct-pressed-change.js';
import {TctRemoveEvent} from './tct-remove.js';
import {TctSnapChangeEvent} from './tct-snap-change.js';
import {TctToastDismissEvent} from './tct-toast-dismiss.js';
import {TctToastHideEvent} from './tct-toast-hide.js';
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

  it('tct-action: a notification (bubbles, composed, not cancelable) with no payload', () => {
    const event = new TctActionEvent();
    expect(event.type).toBe('tct-action');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, false]);
  });

  it('tct-snap-change: a notification with the stop index, its height and what moved it', () => {
    const event = new TctSnapChangeEvent(1, 320, 'keyboard');
    expect(event.type).toBe('tct-snap-change');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, false]);
    expect([event.index, event.height, event.reason]).toEqual([1, 320, 'keyboard']);
  });

  it('tct-toast-dismiss is a cancelable intent, tct-toast-hide the notification that follows', () => {
    const dismiss = new TctToastDismissEvent('auto');
    expect(dismiss.type).toBe('tct-toast-dismiss');
    expect([dismiss.bubbles, dismiss.composed, dismiss.cancelable]).toEqual([true, true, true]);
    expect(dismiss.reason).toBe('auto');
    const hide = new TctToastHideEvent('manual');
    expect(hide.type).toBe('tct-toast-hide');
    expect([hide.bubbles, hide.composed, hide.cancelable]).toEqual([true, true, false]);
    expect(hide.reason).toBe('manual');
  });

  it('tct-pressed-change: cancelable, with the requested pressed state and the reason', () => {
    const event = new TctPressedChangeEvent(true, 'pointer');
    expect(event.type).toBe('tct-pressed-change');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, true]);
    expect([event.pressed, event.reason]).toEqual([true, 'pointer']);
  });

  it('tct-dismiss: cancelable; the reason defaults to the close button', () => {
    const event = new TctDismissEvent();
    expect(event.type).toBe('tct-dismiss');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, true]);
    expect(event.reason).toBe('close-button');
    expect(new TctDismissEvent('escape').reason).toBe('escape');
  });

  it('tct-enter is a cancelable intent without payload', () => {
    const event = new TctEnterEvent();
    expect(event.type).toBe('tct-enter');
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, true]);
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
