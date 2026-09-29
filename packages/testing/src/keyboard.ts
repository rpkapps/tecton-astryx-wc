/// <reference types="@vitest/browser-playwright" />
/**
 * Keyboard helpers (A§15.2) over Vitest's `userEvent`, which drives the real browser keyboard
 * (trusted events: implicit form submission, default actions and `:focus-visible` all behave).
 */
import {userEvent} from 'vitest/browser';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';

export {deepActiveElement};

/** `'Shift+Tab'` -> `{Shift>}{Tab}{/Shift}`; `'a'` -> `a`; `'Escape'` -> `{Escape}`. */
function toKeyboardSyntax(chord: string): string {
  const keys = chord.split('+');
  const key = keys.pop()!;
  const held = keys.map((modifier) => `{${modifier}>}`).join('');
  const released = [...keys]
    .reverse()
    .map((modifier) => `{/${modifier}}`)
    .join('');
  const literal =
    key.length === 1 ? (key === '{' || key === '[' ? `${key}${key}` : key) : `{${key}}`;
  return `${held}${literal}${released}`;
}

/**
 * Presses each chord in turn: `pressKeys('ArrowDown', 'Shift+Tab', 'Enter', 'a')`. Chords are
 * `Modifier+Key` (`Control`, `Shift`, `Alt`, `Meta`).
 */
export async function pressKeys(...chords: string[]): Promise<void> {
  for (const chord of chords) await userEvent.keyboard(toKeyboardSyntax(chord));
}

/**
 * Tabs through the page starting after `start` (focused first) and returns the deep active element
 * after every press, until focus leaves `root` (inclusive of the first element outside), cycles, or
 * `max` presses were made. Use to assert tab order and that composites are single tab stops.
 */
export async function tabSequence(
  root: Element,
  options: {start?: HTMLElement; max?: number; shift?: boolean} = {},
): Promise<Element[]> {
  const {start, max = 30, shift = false} = options;
  start?.focus();
  const visited: Element[] = [];
  for (let i = 0; i < max; i++) {
    await pressKeys(shift ? 'Shift+Tab' : 'Tab');
    const active = deepActiveElement();
    if (!active || visited.includes(active)) break;
    visited.push(active);
    const inside =
      root.contains(active) || root.shadowRoot?.contains(active) === true || isInside(root, active);
    if (!inside) break;
  }
  return visited;
}

function isInside(root: Element, node: Element): boolean {
  for (
    let current: Node | null = node;
    current;
    current = current.parentNode ?? (current as ShadowRoot).host
  ) {
    if (current === root) return true;
  }
  return false;
}
