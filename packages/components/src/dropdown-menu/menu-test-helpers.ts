/**
 * Test helpers shared by the menu families (dropdown, more, context menu): a stub for the compact-touch
 * media query that drives the adaptive presentation (CDP touch emulation cannot be undone inside a
 * page), and readers for the parts of an open menu. Not part of the shipped API.
 */
import {COMPACT_TOUCH_PRESENTATION_QUERY} from '@tecton-astryx/core/controllers/adaptive-presentation.js';

interface FakeQuery extends EventTarget {
  matches: boolean;
  media: string;
}

/**
 * Stubs `matchMedia` for the compact-touch query only. Call it BEFORE the element connects (the query
 * is read on connect); `set()` fires `change` on every list handed out so the host re-renders live.
 */
export function stubCompactTouch(initial: boolean): {
  set: (value: boolean) => void;
  restore: () => void;
} {
  const original = window.matchMedia.bind(window);
  const lists = new Set<FakeQuery>();
  let current = initial;
  window.matchMedia = (query: string): MediaQueryList => {
    if (query !== COMPACT_TOUCH_PRESENTATION_QUERY) return original(query);
    const list = Object.assign(new EventTarget(), {
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
    }) as unknown as FakeQuery;
    Object.defineProperty(list, 'matches', {get: () => current});
    lists.add(list);
    return list as unknown as MediaQueryList;
  };
  return {
    set(value) {
      current = value;
      for (const list of lists) {
        list.dispatchEvent(Object.assign(new Event('change'), {matches: value, media: list.media}));
      }
    },
    restore() {
      window.matchMedia = original;
    },
  };
}
