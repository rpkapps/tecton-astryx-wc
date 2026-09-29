/**
 * Turns a component style key into the attribute selectors of the element it targets (upstream
 * `utils/parseStyleKey.ts` and `themeDataAttributeName`, adapted from Astryx, MIT).
 *
 * The web components reflect their visual props and runtime states as attributes on the host, so a
 * key needs no `data-` prefix:
 *
 *  - `base` selects nothing extra;
 *  - `prop:value` selects `[prop="value"]` (the prop name is kebab-cased: `iconOnly` is `icon-only`);
 *  - a bare state selects the boolean attribute, `[state]`;
 *  - `+` combines selectors on the same target.
 *
 * ```ts
 * parseStyleKey('base');                        // ''
 * parseStyleKey('checked');                     // '[checked]'
 * parseStyleKey('variant:secondary');           // '[variant="secondary"]'
 * parseStyleKey('level:1');                     // '[level="1"]'
 * parseStyleKey('variant:destructive+size:sm'); // '[variant="destructive"][size="sm"]'
 * ```
 */

/** The attribute name for a prop: kebab-cased (`listStyle` is `list-style`). */
export function attributeName(prop: string): string {
  return prop.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Escapes a value for a double-quoted CSS attribute selector string. */
function escapeAttributeValue(value: string): string {
  let escaped = '';
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (char === '"' || char === '\\' || codePoint < 0x20 || codePoint === 0x7f) {
      escaped += `\\${(codePoint === 0 ? 0xfffd : codePoint).toString(16)} `;
    } else {
      escaped += char;
    }
  }
  return escaped;
}

/** Parses a component style key into its attribute-selector suffix. */
export function parseStyleKey(key: string): string {
  if (key === 'base') return '';
  return key
    .split('+')
    .map((part) => {
      const separator = part.indexOf(':');
      if (separator === -1) return `[${attributeName(part)}]`;
      const prop = part.slice(0, separator);
      const value = part.slice(separator + 1);
      return `[${attributeName(prop)}="${escapeAttributeValue(value)}"]`;
    })
    .join('');
}
