/**
 * Shortcut parsing and labelling for `tct-kbd` (upstream Kbd.tsx, unchanged in behaviour).
 * Lookups go through `Map`s, so `constructor` and `__proto__` are unknown keys, never prototype hits.
 */

/** Modifier and special keys to their display glyphs. `mod` resolves by platform and is not in here. */
const KEY_DISPLAY = new Map<string, string>([
  ['ctrl', '⌃'], // ⌃
  ['alt', '⌥'], // ⌥
  ['shift', '⇧'], // ⇧
  ['enter', '↵'], // ↵
  ['backspace', '⌫'], // ⌫
  ['escape', 'Esc'],
  ['tab', '⇥'], // ⇥
  ['up', '↑'],
  ['down', '↓'],
  ['left', '←'],
  ['right', '→'],
  ['plus', '+'],
]);

/** Spoken names: the glyphs above are announced meaninglessly by assistive technology. */
const KEY_LABEL = new Map<string, string>([
  ['ctrl', 'Control'],
  ['alt', 'Alt'],
  ['shift', 'Shift'],
  ['enter', 'Enter'],
  ['backspace', 'Backspace'],
  ['escape', 'Escape'],
  ['tab', 'Tab'],
  ['up', 'Up arrow'],
  ['down', 'Down arrow'],
  ['left', 'Left arrow'],
  ['right', 'Right arrow'],
  ['plus', 'Plus'],
]);

const KEY_ALIASES = new Map<string, string>([
  ['esc', 'escape'],
  ['return', 'enter'],
]);

/** Whether the platform is Apple's (`mod` is Command there and Control elsewhere). */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const uaData = (navigator as {userAgentData?: {platform?: unknown}}).userAgentData;
  if (uaData && typeof uaData === 'object') {
    const named = typeof uaData.platform === 'string' ? uaData.platform.trim() : '';
    // A value that names nothing is no answer, not a negative one: builds that rewrite their
    // client-hints identity ship '', and 'Unknown' is the spec's own "cannot say".
    if (named !== '' && named.toLowerCase() !== 'unknown') return /mac/i.test(named);
  }
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

/** The keys of `keys` ("mod+shift+k"), trimmed, lower-cased and alias-normalised, in order. */
export function parseKeys(keys: string): string[] {
  return keys
    .split('+')
    .map((key) => key.trim().toLowerCase())
    .map((key) => KEY_ALIASES.get(key) ?? key);
}

/** What one key shows: a glyph, `Ctrl`/`⌘` for `mod`, or the upper-cased name. */
export function keyDisplay(key: string, isMac: boolean): string {
  if (key === 'mod') return isMac ? '⌘' : 'Ctrl';
  return KEY_DISPLAY.get(key) ?? key.toUpperCase();
}

/** What one key is called aloud. */
export function keyLabel(key: string, isMac: boolean): string {
  if (key === 'mod') return isMac ? 'Command' : 'Control';
  return KEY_LABEL.get(key) ?? key.toUpperCase();
}

/** The accessible name of the whole shortcut, e.g. `Command + K`. */
export function shortcutName(keys: readonly string[], isMac: boolean): string {
  return keys.map((key) => keyLabel(key, isMac)).join(' + ');
}
