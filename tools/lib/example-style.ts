/**
 * Owner rule for examples (`packages/components/src/<folder>/examples/*.html`): layout and surfaces
 * come from the library's own components (tct-stack, tct-hstack, tct-grid, tct-center, tct-card,
 * tct-text …), never from hand-written CSS. Examples are what people and agents copy, so inline
 * layout CSS teaches the wrong thing.
 *
 * Inline `style=""` and `<style>` blocks may only set:
 * - custom properties (`--*`): component theming hooks are part of the public API;
 * - size constraints that keep a demo from filling the page (`inline-size`, `max-inline-size`, …);
 * - `resize` and `overflow`, which demos of resizable or scrolling containers need.
 * Everything else (`display`, `gap`, `flex*`, `grid*`, `padding`, `margin`, `border`, `background`,
 * `color`, `font` …) is reported.
 */

const ALLOWED = new Set([
  'inline-size',
  'min-inline-size',
  'max-inline-size',
  'block-size',
  'min-block-size',
  'max-block-size',
  'resize',
  'overflow',
  'overflow-x',
  'overflow-y',
  'overflow-inline',
  'overflow-block',
]);

export interface StyleViolation {
  line: number;
  property: string;
  source: 'attribute' | 'style-element';
}

export function isAllowedProperty(property: string): boolean {
  const name = property.trim().toLowerCase();
  return name.startsWith('--') || ALLOWED.has(name);
}

/** Property names declared in a CSS declaration list or a whole stylesheet (comments removed). */
function declaredProperties(css: string): {property: string; offset: number}[] {
  const out: {property: string; offset: number}[] = [];
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => ' '.repeat(comment.length));
  // A declaration starts after `{`, `;` or the start of the text: `name :`.
  const pattern = /(^|[{;])\s*(-{0,2}[a-zA-Z][\w-]*)\s*:/g;
  for (const match of stripped.matchAll(pattern)) {
    const property = match[2] ?? '';
    const offset = (match.index ?? 0) + match[0].indexOf(property);
    out.push({property, offset});
  }
  return out;
}

const lineAt = (text: string, offset: number): number => text.slice(0, offset).split('\n').length;

export function findStyleViolations(html: string): StyleViolation[] {
  const violations: StyleViolation[] = [];
  const withoutComments = html.replace(/<!--[\s\S]*?-->/g, (comment) =>
    comment.replace(/[^\n]/g, ' '),
  );

  for (const match of withoutComments.matchAll(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/g)) {
    const value = match[2] ?? match[3] ?? '';
    const valueOffset = (match.index ?? 0) + match[0].indexOf(value);
    for (const {property, offset} of declaredProperties(value)) {
      if (!isAllowedProperty(property)) {
        violations.push({property, line: lineAt(html, valueOffset + offset), source: 'attribute'});
      }
    }
  }

  for (const match of withoutComments.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
    const css = match[1] ?? '';
    const cssOffset = (match.index ?? 0) + match[0].indexOf(css);
    for (const {property, offset} of declaredProperties(css)) {
      if (!isAllowedProperty(property)) {
        violations.push({
          property,
          line: lineAt(html, cssOffset + offset),
          source: 'style-element',
        });
      }
    }
  }

  return violations.sort((a, b) => a.line - b.line);
}
