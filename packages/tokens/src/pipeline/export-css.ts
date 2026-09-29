/**
 * Parser for `tecton-tokens.css`, the generated Tecton design-system export (D-001: authoritative
 * for role values in both modes). Two blocks: `:root, [data-theme="light"], .light { … }` and
 * `.dark, [data-theme="dark"] { … }`. Only custom-property declarations are read.
 */

export interface TectonExport {
  /** `--tecton-color-*` roles, light mode, in document order. */
  light: Map<string, string>;
  /** `--tecton-color-*` roles, dark mode, in document order. */
  dark: Map<string, string>;
  /** Everything that is not a colour (type, space, radius, border width, icon size). Light block only. */
  nonColor: Map<string, string>;
}

const DECLARATION = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+?)\s*;/;

/** Removes CSS block comments. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

export function parseTectonExport(css: string): TectonExport {
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  const nonColor = new Map<string, string>();
  let mode: 'light' | 'dark' | undefined;
  let selectors = '';

  for (const line of stripComments(css).split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    if (mode === undefined) {
      selectors += ` ${trimmed}`;
      if (trimmed.endsWith('{')) {
        if (/\.dark|data-theme="dark"/.test(selectors)) mode = 'dark';
        else if (/:root|data-theme="light"|\.light/.test(selectors)) mode = 'light';
        else throw new Error(`tecton-tokens.css: unrecognised block "${selectors.trim()}"`);
        selectors = '';
      }
      continue;
    }
    if (trimmed === '}') {
      mode = undefined;
      continue;
    }
    if (/^color-scheme\s*:/.test(trimmed)) continue; // not a token
    const match = DECLARATION.exec(line);
    if (!match) throw new Error(`tecton-tokens.css: cannot parse declaration "${trimmed}"`);
    const [, name, value] = match as unknown as [string, string, string];
    if (name.startsWith('--tecton-color-')) {
      const target = mode === 'light' ? light : dark;
      if (target.has(name)) throw new Error(`tecton-tokens.css: duplicate ${mode} ${name}`);
      target.set(name, value.toLowerCase());
    } else if (mode === 'light') {
      if (nonColor.has(name)) throw new Error(`tecton-tokens.css: duplicate ${name}`);
      nonColor.set(name, value);
    } else {
      throw new Error(`tecton-tokens.css: unexpected non-colour ${name} in the dark block`);
    }
  }
  if (mode !== undefined) throw new Error('tecton-tokens.css: unterminated block');

  const lightOnly = [...light.keys()].filter((name) => !dark.has(name));
  const darkOnly = [...dark.keys()].filter((name) => !light.has(name));
  if (lightOnly.length > 0 || darkOnly.length > 0) {
    throw new Error(
      `tecton-tokens.css: light and dark blocks disagree (light only: ${lightOnly.join(', ')}; dark only: ${darkOnly.join(', ')})`,
    );
  }
  return {light, dark, nonColor};
}
