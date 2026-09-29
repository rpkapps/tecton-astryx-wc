import {describe, expect, it} from 'vitest';
import {build} from './build.ts';
import {LAYER_STATEMENT} from './emit-css.ts';

const result = build();
const css = (file: string) => result.files.get(file)!;
const names = result.resolved.tokens.map((token) => token.name);

/** Declarations of `--name: value;` inside the first `{ ... }` after `marker`. */
function block(text: string, marker: string): string {
  const start = text.indexOf(marker);
  expect(start, `marker ${marker}`).toBeGreaterThanOrEqual(0);
  const open = text.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i);
  }
  throw new Error('unbalanced block');
}

describe('tokens.css', () => {
  const tokens = css('tokens.css');

  it('declares the layer order first, then everything inside @layer tecton.tokens', () => {
    const body = tokens.replace(/^\/\*![\s\S]*?\*\/\n/, '');
    expect(body.startsWith(`${LAYER_STATEMENT}\n`)).toBe(true);
    expect(
      body.slice(LAYER_STATEMENT.length).trimStart().startsWith('@layer tecton.tokens {'),
    ).toBe(true);
  });

  it('declares every token once on :where(:root) with the light value (fallback path)', () => {
    const base = block(tokens, ':where(:root) {');
    for (const name of names) {
      const count = base.split(`\n    ${name}: `).length - 1;
      expect(count, name).toBe(1);
    }
    expect(base).toContain('color-scheme: light dark;');
    expect(base).toContain('accent-color: var(--color-accent);');
    expect(base).toContain('--color-accent: #644a78;');
  });

  it('carries the source path and the provisional flag in a comment', () => {
    expect(tokens).toMatch(
      /--color-accent: #644a78; \/\* mauve\.onLight\.680 \| violet\.onDark\.220 \*\//,
    );
    expect(tokens).toMatch(
      /--color-data-categorical-blue: #2850a1; \/\* blue\.onLight\.680 \| blue\.onDark\.680 provisional \*\//,
    );
    expect(tokens).toMatch(
      /--color-text-accent: #5c3878; \/\* lilac\.onLight\.830 \| lilac\.onDark\.830 override \*\//,
    );
  });

  it('emits dark values for engines without light-dark() only', () => {
    const fallback = block(tokens, '@supports not (color: light-dark(red, red))');
    expect(fallback).toContain('@media (prefers-color-scheme: dark)');
    expect(fallback).toContain(':where(:root:not([data-theme="light"]))');
    expect(fallback).toContain(':where([data-theme="dark"])');
    expect(fallback).toContain(':where([data-theme="light"])');
    expect(fallback).toContain('--color-accent: #5d4d68;');
    // invariant tokens are not repeated
    expect(fallback).not.toContain('--spacing-4:');
  });

  it('uses one light-dark() value per varying token in the modern path', () => {
    const modern = block(tokens, '@supports (color: light-dark(red, red))');
    expect(modern).toContain('--color-accent: light-dark(#644a78, #5d4d68);');
    expect(modern).toContain('--shadow-low: 0px 1px 2px light-dark(#0000001a, #00000066);');
    expect(modern).not.toContain('--spacing-4:');
  });

  it('sets background, color and accent-color on scheme islands', () => {
    const dark = block(
      tokens.slice(tokens.indexOf('An element that switches scheme')),
      ':where([data-theme="dark"])',
    );
    expect(dark).toContain('color-scheme: dark;');
    expect(dark).toContain('background-color: var(--color-background-body);');
    expect(dark).toContain('color: var(--color-text-primary);');
    expect(dark).toContain('accent-color: var(--color-accent);');
  });

  it('emits [data-media-theme] blocks pinning each side of the pair', () => {
    const onDark = block(tokens, ':where([data-media-theme="dark"])');
    expect(onDark).toContain('color-scheme: dark;');
    expect(onDark).toContain('--color-text-primary: #f6f5f8;');
    expect(onDark).toContain('--color-icon-primary: var(--color-on-dark);');
    const onLight = block(tokens, ':where([data-media-theme="light"])');
    expect(onLight).toContain('color-scheme: light;');
    expect(onLight).toContain('--color-text-primary: #21172a;');
  });

  it('maps a few roles to system colours under forced-colors', () => {
    const forced = block(tokens, '@media (forced-colors: active)');
    expect(forced).toContain('--focus-outline-color: Highlight;');
    expect(forced).toContain('--color-text-primary: CanvasText;');
  });

  it('never registers tokens as <color> (light-dark() must stay live for descendants)', () => {
    expect(tokens).not.toContain('@property');
  });

  it('carries no palette variables', () => {
    expect(tokens).not.toContain('--tecton-palette-');
  });
});

describe('palette.css', () => {
  it('lists all 1,820 primitives on :where(:root) in the layer', () => {
    const palette = css('palette.css');
    expect(palette.match(/^ {4}--tecton-palette-[a-z0-9-]+: #[0-9a-f]+;/gm)).toHaveLength(1820);
    expect(palette).toContain(
      '--tecton-palette-hot-pink-on-dark-460: #ff52a8; /* focus outline */',
    );
    expect(palette).toContain('@layer tecton.tokens {');
  });
});

describe('fonts.css', () => {
  const fonts = css('fonts.css');

  it('declares Figtree Variable and IBM Plex Mono with swap and unicode ranges', () => {
    expect(fonts).toContain('font-family: "Figtree Variable";');
    expect(fonts).toContain('font-weight: 300 900;');
    expect(fonts.match(/font-display: swap;/g)).toHaveLength(6);
    expect(fonts.match(/unicode-range: U\+/g)).toHaveLength(6);
    expect(fonts).toContain('font-weight: 400;');
    expect(fonts).toContain('font-weight: 500;');
  });

  it('adds Capsize metric-matched fallback faces on local system fonts', () => {
    expect(fonts).toMatch(/font-family: "Figtree Fallback";\n {2}src: local\('Arial'\)/);
    expect(fonts).toMatch(
      /font-family: "IBM Plex Mono Fallback";\n {2}src: local\('Courier New'\)/,
    );
    expect(fonts).toMatch(/size-adjust: 100\.\d+%;/);
    expect(fonts).toMatch(/ascent-override: \d+\.\d+%;/);
  });

  it('references only font files it ships', () => {
    const files = new Set(result.fonts.files.map((file) => file.to));
    for (const [, path] of fonts.matchAll(/url\("\.\/(fonts\/[^"]+)"\)/g))
      expect(files.has(path!)).toBe(true);
  });

  it('stacks follow D-003', () => {
    const body = result.resolved.byName.get('--font-family-body')!;
    expect(body.value).toEqual({
      kind: 'literal',
      value: '"Figtree Variable", Figtree, "Figtree Fallback", Helvetica, Arial, sans-serif',
    });
  });
});

describe('tecton.css', () => {
  it('is tokens + fonts under one layer statement', () => {
    const bundle = css('tecton.css');
    expect(bundle.split(LAYER_STATEMENT)).toHaveLength(2);
    expect(bundle).toContain('@layer tecton.tokens {');
    expect(bundle).toContain('@font-face');
    expect(bundle.indexOf('@layer tecton.tokens {')).toBeLessThan(bundle.indexOf('@font-face'));
  });
});

describe('metadata', () => {
  const json = JSON.parse(css('tokens.json')) as {
    tokens: Record<
      string,
      {
        light: string;
        dark: string;
        status: string;
        provisional?: string;
        retained?: string;
        derived?: string;
      }
    >;
    counts: {tokens: number; palette: number};
    breakpoints: {status: string; values: Record<string, number>};
    astryxRetainedNonTokens: {name: string}[];
    tectonDerivedNonTokens: {name: string; value?: string; binds?: Record<string, string>}[];
  };

  it('describes every token with resolved light and dark values', () => {
    expect(Object.keys(json.tokens)).toHaveLength(names.length);
    expect(json.counts.palette).toBe(1820);
    expect(json.tokens['--color-accent']).toMatchObject({
      light: '#644a78',
      dark: '#5d4d68',
      status: 'tecton-export',
    });
    expect(json.tokens['--color-data-blue-5']!.provisional).toBeTruthy();
    expect(json.tokens['--color-syntax-keyword']!.light).toBe('#5c3878'); // reference resolved
    expect(json.breakpoints.values).toEqual({sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536});
  });

  it('records astryx-retained tokens, non-tokens and the Tecton-derived bindings (D-013)', () => {
    expect(json.breakpoints.status).toBe('astryx-retained');
    expect(json.tokens['--duration-fast']).toMatchObject({status: 'astryx-retained'});
    expect(json.tokens['--duration-fast']!.retained).toMatch(/D-013/);
    expect(json.tokens['--duration-fast']!.provisional).toBeUndefined();
    expect(json.tokens['--text-heading-3-size']!.derived).toMatch(/large/);
    expect(json.astryxRetainedNonTokens.map((item) => item.name)).toEqual([
      'breakpoints',
      'z-index',
    ]);
    const derived = Object.fromEntries(
      json.tectonDerivedNonTokens.map((item) => [item.name, item]),
    );
    expect(derived['letter-spacing']!.value).toBe('normal');
    expect(derived['destructive button']!.binds!.background).toBe(
      '--tecton-color-status-error-filled-bg',
    );
    const js = css('tokens.js');
    expect(js).toContain('export const astryxRetainedNonTokens');
    expect(js).toContain('export const tectonDerivedNonTokens');
    expect(css('tokens.d.ts')).toContain("| 'astryx-retained'");
  });

  it('marks retained declarations in tokens.css', () => {
    expect(css('tokens.css')).toMatch(/--duration-fast: 175ms; \/\* astryx-retained \*\//);
  });

  it('exports tokens.js and tokens.d.ts with the same names', () => {
    expect(css('tokens.js')).toContain('export const tokens = Object.freeze(');
    expect(css('tokens.js')).toContain('export function tokenVar(');
    const dts = css('tokens.d.ts');
    expect(dts).toContain('export type TokenName =');
    expect(dts).toContain('| "--color-accent"');
    expect(dts.match(/^ {2}\| "--/gm)).toHaveLength(names.length);
  });

  it('fallbacks.json maps every token to a resolved light value', () => {
    const fallbacks = JSON.parse(css('fallbacks.json')) as Record<string, string>;
    expect(Object.keys(fallbacks)).toHaveLength(names.length);
    expect(fallbacks['--color-accent']).toBe('#644a78');
    expect(fallbacks['--text-body-size']).toBe('0.875rem');
    expect(fallbacks['--font-family-body']).toContain('"Figtree Variable"');
    for (const value of Object.values(fallbacks)) expect(value).not.toContain('var(');
  });

  it('the snapshot lists the emitted names, sorted, without palette names', () => {
    const snapshot = JSON.parse(result.snapshot) as {count: number; names: string[]};
    expect(snapshot.count).toBe(names.length);
    expect(snapshot.names).toEqual([...names].sort());
    expect(snapshot.names.some((name) => name.startsWith('--tecton-palette-'))).toBe(false);
  });
});
