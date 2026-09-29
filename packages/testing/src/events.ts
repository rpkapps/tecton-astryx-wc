/**
 * Event assertions (A§15.2, A§7.6): exact counts and flags. The library's event contract is precise
 * (`input` per edit, one composed `change` per commit, no events on property writes), so tests count
 * instead of "was called".
 */
import {expect} from 'vitest';

/** A recorded event; the library events carry `open`, `reason`, `value` etc., so tests read them without casts. */
export type RecordedEvent = Event & {
  readonly open?: boolean;
  readonly reason?: string;
  readonly value?: unknown;
};

export interface EventRecorder {
  /** Every recorded event in dispatch order. */
  readonly events: RecordedEvent[];
  /** Events of one name. */
  named(name: string): RecordedEvent[];
  /** Number of recorded events per name (every requested name is present, possibly 0). */
  counts(): Record<string, number>;
  /** Stops listening. */
  stop(): void;
}

/** Records events named `names` dispatched on (or bubbling to) `target`. */
export function recordEvents(
  target: EventTarget,
  names: string | readonly string[],
): EventRecorder {
  const list = typeof names === 'string' ? [names] : [...names];
  const events: RecordedEvent[] = [];
  const listener = (event: Event): void => {
    events.push(event);
  };
  for (const name of list) target.addEventListener(name, listener);
  return {
    events,
    named: (name) => events.filter((event) => event.type === name),
    counts: () =>
      Object.fromEntries(list.map((name) => [name, events.filter((e) => e.type === name).length])),
    stop: () => {
      for (const name of list) target.removeEventListener(name, listener);
    },
  };
}

/** Asserts the recorded counts equal `expected` exactly (names not listed must be 0). */
export function expectEventCounts(
  recorder: EventRecorder,
  expected: Readonly<Record<string, number>>,
): void {
  const actual = recorder.counts();
  const full = Object.fromEntries(Object.keys(actual).map((name) => [name, expected[name] ?? 0]));
  expect(actual, 'event counts').toEqual(full);
}

/** Asserts `event.bubbles/composed/cancelable` (omitted flags are not checked). */
export function expectEventFlags(
  event: Event,
  flags: {bubbles?: boolean; composed?: boolean; cancelable?: boolean},
): void {
  for (const [flag, value] of Object.entries(flags)) {
    expect(event[flag as 'bubbles' | 'composed' | 'cancelable'], `${event.type}.${flag}`).toBe(
      value,
    );
  }
}

/** Resolves with the next `name` event dispatched on `target`. */
export function oneEvent<E extends Event = Event>(target: EventTarget, name: string): Promise<E> {
  return new Promise((resolve) => {
    target.addEventListener(name, (event) => resolve(event as E), {once: true});
  });
}
