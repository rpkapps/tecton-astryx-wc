/**
 * Answers `buttonGroupContext` requests per consumer (A§9.4). The context value carries the
 * requesting button's own `position` (`first | middle | last | only`), so one shared value would be
 * wrong: this provider replies to every consumer with its own slice and re-notifies all of them when
 * the group's members, size, orientation or disabled state change. Positions are derived in JS from
 * the members that are actually rendered (a hidden member, a `<template>` or a stray text node never
 * makes a neighbour "middle"), which is why the group does not rely on `:last-child` (upstream #2508).
 *
 * Speaks the Context Community Protocol, so a consumer built with `@lit/context` works too.
 */
import type {ReactiveController} from 'lit';
import {
  ContextProviderEvent,
  type ContextCallback,
  type ContextRequestEvent,
  type UnknownContext,
} from '@tecton-astryx/core/context/protocol.js';
import {
  buttonGroupContext,
  type ButtonGroupContextValue,
  type ButtonGroupPosition,
} from '@tecton-astryx/core/context/keys.js';

const NOT_MEMBERS = new Set(['template', 'script', 'style', 'slot']);

/** Elements of `host` that take part in the group: rendered, not `hidden`, not markup plumbing. */
export function groupMembers(host: HTMLElement): HTMLElement[] {
  return [...host.children].filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && !child.hidden && !NOT_MEMBERS.has(child.localName),
  );
}

/** The member of `host` that is `node` or contains it (following shadow hosts), or `null`. */
export function memberContaining(host: HTMLElement, node: Node): HTMLElement | null {
  for (
    let current: Node | null = node;
    current && current !== host;
    current = current.parentNode ?? (current as ShadowRoot).host
  ) {
    if (current.parentNode === host) return current as HTMLElement;
  }
  return null;
}

export function positionOf(
  member: HTMLElement | null,
  members: readonly HTMLElement[],
): ButtonGroupPosition {
  const index = member ? members.indexOf(member) : -1;
  if (index < 0 || members.length <= 1) return 'only';
  if (index === 0) return 'first';
  return index === members.length - 1 ? 'last' : 'middle';
}

/** What the provider needs from the group element. */
export interface MemberContextHost extends HTMLElement {
  addController(controller: ReactiveController): void;
  /** The group-level part of the value (everything except `position`). */
  groupContext(): Omit<ButtonGroupContextValue, 'position'>;
}

interface Subscription {
  consumer: Element;
  last: ButtonGroupContextValue;
  unsubscribe: () => void;
}

function sameValue(a: ButtonGroupContextValue, b: ButtonGroupContextValue): boolean {
  return (
    a.size === b.size &&
    a.orientation === b.orientation &&
    a.position === b.position &&
    (a.disabled ?? false) === (b.disabled ?? false)
  );
}

export class ButtonGroupMemberContext implements ReactiveController {
  readonly #host: MemberContextHost;
  readonly #subscriptions = new Map<ContextCallback<ButtonGroupContextValue>, Subscription>();
  #children: MutationObserver | undefined;
  #hidden: MutationObserver | undefined;

  constructor(host: MemberContextHost) {
    this.#host = host;
    host.addController(this);
  }

  /** Re-sends the value to every subscribed member (children, size, orientation or disabled changed). */
  refresh(): void {
    const members = groupMembers(this.#host);
    for (const [callback, subscription] of [...this.#subscriptions]) {
      if (!subscription.consumer.isConnected) {
        this.#subscriptions.delete(callback);
        continue;
      }
      const next = this.#valueFor(subscription.consumer, members);
      if (sameValue(next, subscription.last)) continue;
      subscription.last = next;
      callback(next, subscription.unsubscribe);
    }
  }

  hostConnected(): void {
    this.#host.addEventListener('context-request', this.#onRequest as EventListener);
    const refresh = (): void => {
      this.refresh();
    };
    // Members come and go, or are hidden: positions follow. Two observers, because observing the
    // same node twice with one observer replaces the first registration.
    this.#children ??= new MutationObserver(refresh);
    this.#children.observe(this.#host, {childList: true});
    this.#hidden ??= new MutationObserver(refresh);
    this.#hidden.observe(this.#host, {
      attributes: true,
      attributeFilter: ['hidden'],
      subtree: true,
    });
    this.#host.dispatchEvent(new ContextProviderEvent(buttonGroupContext, this.#host));
  }

  hostDisconnected(): void {
    this.#host.removeEventListener('context-request', this.#onRequest as EventListener);
    this.#children?.disconnect();
    this.#hidden?.disconnect();
  }

  #valueFor(consumer: Element, members: readonly HTMLElement[]): ButtonGroupContextValue {
    return {
      ...this.#host.groupContext(),
      position: positionOf(memberContaining(this.#host, consumer), members),
    };
  }

  readonly #onRequest = (event: ContextRequestEvent<UnknownContext>): void => {
    if ((event.context as unknown) !== buttonGroupContext) return;
    const consumer = event.contextTarget ?? (event.composedPath()[0] as Element);
    if (consumer === this.#host) return;
    event.stopPropagation();
    const callback = event.callback as unknown as ContextCallback<ButtonGroupContextValue>;
    const value = this.#valueFor(consumer, groupMembers(this.#host));
    if (event.subscribe) {
      // One stable `unsubscribe` per subscription: a consumer treats a new function as "a different
      // provider took over" and would cancel the subscription it just received.
      const unsubscribe = (): void => {
        this.#subscriptions.delete(callback);
      };
      this.#subscriptions.set(callback, {consumer, last: value, unsubscribe});
      callback(value, unsubscribe);
    } else {
      callback(value);
    }
  };
}
