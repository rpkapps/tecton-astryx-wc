/// <reference types="node" />
/**
 * Golden test (WP-1 acceptance): the CSS the theme utilities generate for the Tecton theme carries the
 * same token set as the token pipeline's `tokens.css`, token for token, in both colour schemes.
 *
 * The theme is built from the pipeline's own metadata (`tokens.json`: a value where the two schemes
 * agree, a `[light, dark]` pair otherwise), passed through `defineTheme`, and lowered by
 * `generateThemeCSS`. What comes out is compared with the declarations `tokens.css` emits (the light
 * base, and the `light-dark()` block that wins where it is supported), evaluated for each scheme. Two
 * independent code paths (the pipeline emitter and the theme generator) must agree on every value.
 */
import {readFileSync} from 'node:fs';
import {beforeAll, describe, expect, it} from 'vitest';
import {defineTheme, type DefinedTheme, type TokenValue} from './define-theme.js';
import {generateOnMediaCSS, generateThemeCSS} from './generate-theme-rules.js';
import {DEFAULT_WIDTH_BREAKPOINTS} from './theme-adaptations.js';
import {pipeline, pipelineTokens, registerPipelineDefaults} from './_tokens-fixture.js';

type Scheme = 'light' | 'dark';

const tokensCss = readFileSync(new URL('../../../tokens/dist/tokens.css', import.meta.url), 'utf8');

/** The text between the braces of the first block whose header contains `marker`, from `from`. */
function block(css: string, marker: string, from = 0): {body: string; end: number} {
  const start = css.indexOf(marker, from);
  if (start === -1) throw new Error(`no block "${marker}"`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return {body: css.slice(open + 1, i), end: i};
  }
  throw new Error(`unclosed block "${marker}"`);
}

/** `--name: value;` declarations (comments stripped), in order. */
function declarations(body: string): Map<string, string> {
  const map = new Map<string, string>();
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of clean.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(match[1]!, match[2]!.trim());
  }
  return map;
}

/** Splits on top-level commas. */
function splitArguments(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    else if (text[i] === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim());
}

/** Evaluates every `light-dark(a, b)` (at any depth) for a scheme. */
function pick(value: string, scheme: Scheme): string {
  const marker = 'light-dark(';
  const at = value.indexOf(marker);
  if (at === -1) return value;
  let depth = 0;
  let end = -1;
  for (let i = at + marker.length - 1; i < value.length; i++) {
    if (value[i] === '(') depth++;
    else if (value[i] === ')' && --depth === 0) {
      end = i;
      break;
    }
  }
  const [light = '', dark = ''] = splitArguments(value.slice(at + marker.length, end));
  return pick(
    value.slice(0, at) + pick(scheme === 'light' ? light : dark, scheme) + value.slice(end + 1),
    scheme,
  );
}

/** Substitutes `var(--x)` references from `map`, following chains. */
function resolve(value: string, map: Map<string, string>, depth = 0): string {
  if (depth > 8) throw new Error(`reference chain too deep: ${value}`);
  return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    const target = map.get(name);
    return target === undefined ? `var(${name})` : resolve(target, map, depth + 1);
  });
}

/** Normalises formatting that carries no meaning (case, spacing after commas). */
const normal = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\s*,\s*/g, ',')
    .replace(/\s+/g, ' ')
    .trim();

/** The effective declaration of every token `tokens.css` emits, per scheme. */
function pipelineValues(scheme: Scheme): Map<string, string> {
  const layer = block(tokensCss, '@layer tecton.tokens {').body;
  const base = declarations(block(layer, ':where(:root) {').body);
  const supports = block(layer, '@supports (color: light-dark(red, red)) {');
  const modern = declarations(block(supports.body, ':where(:root) {').body);
  const raw = new Map([...base, ...modern]);
  const evaluated = new Map<string, string>();
  for (const [name, value] of raw) evaluated.set(name, pick(value, scheme));
  return new Map([...evaluated].map(([name, value]) => [name, resolve(value, evaluated)]));
}

function tectonInput(): Record<string, TokenValue> {
  const input: Record<string, TokenValue> = {};
  for (const [name, token] of Object.entries(pipelineTokens())) {
    input[name] = token.light === token.dark ? token.light : [token.light, token.dark];
  }
  return input;
}

let theme: DefinedTheme;
let warnings: string[];
let generated: Map<string, string>;

beforeAll(() => {
  registerPipelineDefaults();
  theme = defineTheme({name: 'tecton', tokens: tectonInput()});
  warnings = [];
  const {component} = generateThemeCSS(theme, warnings);
  generated = declarations(block(component, ':scope {').body);
});

/** How many other tokens reference `name` in the generated theme (their value changes when it does). */
function dependents(name: string): number {
  return [...generated].filter(([key, value]) => key !== name && value.includes(`var(${name})`))
    .length;
}

describe('generateThemeCSS(tectonTheme) versus tokens.css', () => {
  it('drops nothing: every declaration is a declaration the boundary check accepts', () => {
    expect(warnings).toEqual([]);
  });

  it('declares exactly the pipeline token set', () => {
    const expected = Object.keys(pipelineTokens()).sort();
    expect([...generated.keys()].sort()).toEqual(expected);
    expect(generated.size).toBe(pipeline().tokens ? Object.keys(pipelineTokens()).length : 0);
  });

  it('emits the same token names as tokens.css', () => {
    expect([...pipelineValues('light').keys()].sort()).toEqual([...generated.keys()].sort());
  });

  /** Tokens whose value in `map` differs from tokens.css in `scheme`. */
  function differences(map: Map<string, string>, scheme: Scheme): string[] {
    const expected = pipelineValues(scheme);
    const evaluated = new Map([...map].map(([name, value]) => [name, pick(value, scheme)]));
    const actual = new Map(
      [...evaluated].map(([name, value]) => [name, resolve(value, evaluated)]),
    );
    const differing: string[] = [];
    for (const [name, value] of expected) {
      if (normal(actual.get(name) ?? '') !== normal(value)) {
        differing.push(`${name}: theme ${actual.get(name)} | tokens.css ${value}`);
      }
    }
    return differing;
  }

  it.each(['light', 'dark'] as const)('resolves every token to the same %s value', (scheme) => {
    expect(differences(generated, scheme)).toEqual([]);
  });

  it('would notice a token that differs (the comparison is not vacuous)', () => {
    const changed = new Map(generated);
    changed.set('--color-accent', 'light-dark(#000001, #000002)');
    changed.delete('--spacing-4');
    expect(differences(changed, 'light')).toHaveLength(2 + dependents('--color-accent'));
    expect(differences(changed, 'dark').length).toBeGreaterThanOrEqual(2);
  });

  it('writes a [light, dark] pair as light-dark() and a shared value as-is', () => {
    expect(generated.get('--color-accent')).toBe(
      `light-dark(${pipelineTokens()['--color-accent']!.light}, ${pipelineTokens()['--color-accent']!.dark})`,
    );
    expect(generated.get('--spacing-4')).toBe(pipelineTokens()['--spacing-4']!.light);
  });

  it('scopes the block to the theme and stops at a nested theme', () => {
    const {component} = generateThemeCSS(theme);
    expect(component.startsWith('@scope ([data-tct-theme="tecton"]) to ([data-tct-theme]) {')).toBe(
      true,
    );
  });
});

describe('generateOnMediaCSS(tectonTheme) versus tokens.css', () => {
  const PINNED = [
    '--color-text-primary',
    '--color-text-secondary',
    '--color-background-surface',
    '--color-border',
  ];
  const media = (side: Scheme): DefinedTheme =>
    defineTheme({
      name: 'tecton-media',
      // The side's value of each pinned role, as the pipeline pins it.
      [side === 'dark' ? 'onDark' : 'onLight']: {
        tokens: Object.fromEntries(PINNED.map((name) => [name, pipelineTokens()[name]![side]])),
      },
    });

  it.each(['dark', 'light'] as const)('pins the %s side like [data-media-theme]', (side) => {
    const css = generateOnMediaCSS(media(side));
    const generatedBlock = declarations(block(css, `[data-media-theme="${side}"] {`).body);
    const pipelineBlock = declarations(
      block(tokensCss, `:where([data-media-theme="${side}"]) {`).body,
    );
    for (const name of PINNED) {
      expect(normal(generatedBlock.get(name) ?? ''), name).toBe(
        normal(pipelineBlock.get(name) ?? ''),
      );
    }
    for (const name of ['--color-icon-primary', '--color-accent']) {
      expect(pipelineBlock.get(name), name).toBe(`var(--color-on-${side})`);
    }
    expect(css).toContain(`color-scheme: ${side};`);
  });
});

describe('DEFAULT_WIDTH_BREAKPOINTS', () => {
  it('are the retained upstream defaults the pipeline records', () => {
    expect({...DEFAULT_WIDTH_BREAKPOINTS}).toEqual(pipeline().breakpoints.values);
  });
});
