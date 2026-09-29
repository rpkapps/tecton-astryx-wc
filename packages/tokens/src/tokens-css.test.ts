/**
 * The generated stylesheets in a real engine (Chromium locally; Firefox and WebKit in CI): the
 * light-dark() path, the fallback path (forced by rewriting the `@supports` conditions so the engine
 * takes the branch an older browser would), scheme islands, media themes and the font faces.
 * `pnpm generate` (which runs before every test run) writes the files this reads.
 */
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import fontsCss from '../dist/fonts.css?raw';
import tectonCss from '../dist/tecton.css?raw';
import tokensCss from '../dist/tokens.css?raw';

const SUPPORTS = '(color: light-dark(red, red))';

/** What an engine without light-dark() would see: both `@supports` conditions evaluate the other way. */
const withoutLightDark = (css: string) => css.replaceAll(SUPPORTS, '(color: not-a-function(red))');

const sheets: HTMLStyleElement[] = [];
function install(css: string): void {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  sheets.push(style);
}

function fixture(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

const computed = (element: Element, property: string) =>
  getComputedStyle(element)[property as 'color'];
const rgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme');
});

afterEach(() => {
  for (const style of sheets.splice(0)) style.remove();
  document.body.replaceChildren();
  document.documentElement.removeAttribute('data-theme');
});

describe.each([
  ['light-dark() path', (css: string) => css],
  ['fallback path (no light-dark())', withoutLightDark],
] as const)('tokens.css, %s', (_label, transform) => {
  beforeEach(() => install(transform(tokensCss)));

  it('light values by default on a light page', () => {
    document.documentElement.dataset.theme = 'light';
    const el = fixture('<div style="color: var(--color-accent)">x</div>').firstElementChild!;
    expect(computed(el, 'color')).toBe(rgb('#644a78'));
  });

  it('dark values under [data-theme="dark"] on the root', () => {
    document.documentElement.dataset.theme = 'dark';
    const el = fixture('<div style="color: var(--color-accent)">x</div>').firstElementChild!;
    expect(computed(el, 'color')).toBe(rgb('#5d4d68'));
    expect(computed(document.documentElement, 'colorScheme')).toBe('dark');
  });

  it('a dark island in a light page, and a light island inside it', () => {
    document.documentElement.dataset.theme = 'light';
    const host = fixture(`
      <section id="dark" data-theme="dark">
        <p id="a" style="color: var(--color-text-primary)">a</p>
        <section id="light" data-theme="light"><p id="b" style="color: var(--color-text-primary)">b</p></section>
      </section>`);
    expect(computed(host.querySelector('#a')!, 'color')).toBe(rgb('#f6f5f8'));
    expect(computed(host.querySelector('#b')!, 'color')).toBe(rgb('#21172a'));
  });

  it('references to varying tokens (syntax colours, theme-local aliases) follow the island', () => {
    document.documentElement.dataset.theme = 'light';
    const host = fixture(`<section data-theme="dark">
      <i id="keyword" style="color: var(--color-syntax-keyword)">k</i>
      <i id="info" style="color: var(--tecton-color-info)">i</i>
    </section>`);
    expect(computed(host.querySelector('#keyword')!, 'color')).toBe(rgb('#beb1c8'));
    expect(computed(host.querySelector('#info')!, 'color')).toBe(rgb('#8ca7de'));
  });

  it('a scheme island sets its own background, color and accent-color (mwg:component-specific-light-dark-theme)', () => {
    document.documentElement.dataset.theme = 'light';
    const island = fixture('<section data-theme="dark">x</section>').firstElementChild!;
    expect(computed(island, 'backgroundColor')).toBe(rgb('#1d1c1f'));
    expect(computed(island, 'color')).toBe(rgb('#f6f5f8'));
    expect(computed(island, 'accentColor')).toBe(rgb('#5d4d68'));
    expect(computed(island, 'colorScheme')).toBe('dark');
  });

  it('[data-media-theme] pins the ink of its side of the pair', () => {
    document.documentElement.dataset.theme = 'light';
    const media = fixture(
      '<div data-media-theme="dark"><i style="color: var(--color-icon-primary)">i</i></div>',
    ).firstElementChild!;
    expect(computed(media, 'color')).toBe(rgb('#f6f5f8'));
    expect(computed(media.firstElementChild!, 'color')).toBe(rgb('#f6f5f8')); // icon-primary -> on-dark
    expect(computed(media, 'colorScheme')).toBe('dark');
  });

  it('resolves alpha colours, shadows and non-colour tokens', () => {
    document.documentElement.dataset.theme = 'dark';
    const el = fixture(
      '<div style="background-color: var(--color-overlay-hover); box-shadow: var(--shadow-low); padding: var(--spacing-4); font-family: var(--font-family-body)">x</div>',
    ).firstElementChild!;
    // #ffffff0d: engines serialise the alpha differently (rgba() vs color(srgb ... / a)); read the last number
    const alpha = Number(
      computed(el, 'backgroundColor')
        .match(/[\d.]+/g)!
        .at(-1),
    );
    expect(alpha).toBeCloseTo(13 / 255, 2);
    expect(computed(el, 'boxShadow')).toContain('0px 1px 2px');
    expect(computed(el, 'paddingTop')).toBe('16px');
    expect(computed(el, 'fontFamily')).toContain('Figtree Variable');
  });

  it('accent ink is legible on the page in both modes (D-001 override)', () => {
    for (const theme of ['light', 'dark']) {
      document.documentElement.dataset.theme = theme;
      const el = fixture('<div style="color: var(--color-text-accent)">x</div>').firstElementChild!;
      expect(computed(el, 'color')).toBe(theme === 'light' ? rgb('#5c3878') : rgb('#beb1c8'));
      el.parentElement!.remove();
    }
  });
});

describe('tokens.css structure in an engine', () => {
  it('parses without dropping the layer or its rules', () => {
    install(tokensCss);
    const sheet = sheets[0]!.sheet!;
    const kinds = [...sheet.cssRules].map((rule) => rule.constructor.name);
    expect(kinds).toContain('CSSLayerStatementRule');
    expect(kinds).toContain('CSSLayerBlockRule');
    const layer = [...sheet.cssRules].find((rule) => rule instanceof CSSLayerBlockRule)!;
    expect(layer.name).toBe('tecton.tokens');
  });

  it('the layer is beaten by an unlayered application rule without !important', () => {
    document.documentElement.dataset.theme = 'light';
    install(tokensCss);
    install(':root { --color-accent: #123456; }');
    const el = fixture('<div style="color: var(--color-accent)">x</div>').firstElementChild!;
    expect(computed(el, 'color')).toBe(rgb('#123456'));
  });

  it('forced-colors: system colours are declared for the mapped roles', () => {
    install(tokensCss);
    const media = [...sheets[0]!.sheet!.cssRules]
      .flatMap((rule) => [...((rule as CSSGroupingRule).cssRules ?? [])])
      .find((rule) => rule instanceof CSSMediaRule && rule.conditionText.includes('forced-colors'));
    expect(media).toBeDefined();
  });
});

describe('fonts.css and tecton.css', () => {
  const faceRules = (css: string) => {
    install(css);
    const sheet = sheets.at(-1)!.sheet!;
    return [...sheet.cssRules].filter(
      (rule): rule is CSSFontFaceRule => rule instanceof CSSFontFaceRule,
    );
  };

  it('declares the web-font faces and the metric-matched fallbacks', () => {
    const families = faceRules(fontsCss).map((rule) =>
      rule.style.getPropertyValue('font-family').replaceAll('"', ''),
    );
    expect(families.filter((name) => name === 'Figtree Variable')).toHaveLength(2);
    expect(families.filter((name) => name === 'IBM Plex Mono')).toHaveLength(4);
    expect(families).toContain('Figtree Fallback');
    expect(families).toContain('IBM Plex Mono Fallback');
  });

  it('tecton.css carries the same faces and the token layer', () => {
    const rules = faceRules(tectonCss);
    expect(rules).toHaveLength(8);
    const sheet = sheets.at(-1)!.sheet!;
    expect([...sheet.cssRules].some((rule) => rule instanceof CSSLayerBlockRule)).toBe(true);
  });
});
