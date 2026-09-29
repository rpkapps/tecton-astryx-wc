import {mkdirSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import stylelint from 'stylelint';
import {describe, expect, it} from 'vitest';
import tct, {findColorLiteral} from './index.ts';

/** All 148 CSS named colours (css-color-4), independent of the plugin's own list. */
const NAMED_COLOR_NAMES = [
  'aliceblue',
  'antiquewhite',
  'aqua',
  'aquamarine',
  'azure',
  'beige',
  'bisque',
  'black',
  'blanchedalmond',
  'blue',
  'blueviolet',
  'brown',
  'burlywood',
  'cadetblue',
  'chartreuse',
  'chocolate',
  'coral',
  'cornflowerblue',
  'cornsilk',
  'crimson',
  'cyan',
  'darkblue',
  'darkcyan',
  'darkgoldenrod',
  'darkgray',
  'darkgreen',
  'darkgrey',
  'darkkhaki',
  'darkmagenta',
  'darkolivegreen',
  'darkorange',
  'darkorchid',
  'darkred',
  'darksalmon',
  'darkseagreen',
  'darkslateblue',
  'darkslategray',
  'darkslategrey',
  'darkturquoise',
  'darkviolet',
  'deeppink',
  'deepskyblue',
  'dimgray',
  'dimgrey',
  'dodgerblue',
  'firebrick',
  'floralwhite',
  'forestgreen',
  'fuchsia',
  'gainsboro',
  'ghostwhite',
  'gold',
  'goldenrod',
  'gray',
  'green',
  'greenyellow',
  'grey',
  'honeydew',
  'hotpink',
  'indianred',
  'indigo',
  'ivory',
  'khaki',
  'lavender',
  'lavenderblush',
  'lawngreen',
  'lemonchiffon',
  'lightblue',
  'lightcoral',
  'lightcyan',
  'lightgoldenrodyellow',
  'lightgray',
  'lightgreen',
  'lightgrey',
  'lightpink',
  'lightsalmon',
  'lightseagreen',
  'lightskyblue',
  'lightslategray',
  'lightslategrey',
  'lightsteelblue',
  'lightyellow',
  'lime',
  'limegreen',
  'linen',
  'magenta',
  'maroon',
  'mediumaquamarine',
  'mediumblue',
  'mediumorchid',
  'mediumpurple',
  'mediumseagreen',
  'mediumslateblue',
  'mediumspringgreen',
  'mediumturquoise',
  'mediumvioletred',
  'midnightblue',
  'mintcream',
  'mistyrose',
  'moccasin',
  'navajowhite',
  'navy',
  'oldlace',
  'olive',
  'olivedrab',
  'orange',
  'orangered',
  'orchid',
  'palegoldenrod',
  'palegreen',
  'paleturquoise',
  'palevioletred',
  'papayawhip',
  'peachpuff',
  'peru',
  'pink',
  'plum',
  'powderblue',
  'purple',
  'rebeccapurple',
  'red',
  'rosybrown',
  'royalblue',
  'saddlebrown',
  'salmon',
  'sandybrown',
  'seagreen',
  'seashell',
  'sienna',
  'silver',
  'skyblue',
  'slateblue',
  'slategray',
  'slategrey',
  'snow',
  'springgreen',
  'steelblue',
  'tan',
  'teal',
  'thistle',
  'tomato',
  'turquoise',
  'violet',
  'wheat',
  'white',
  'whitesmoke',
  'yellow',
  'yellowgreen',
];

async function lint(
  code: string,
  rules: Record<string, unknown>,
  codeFilename?: string,
): Promise<string[]> {
  const result = await stylelint.lint({
    code,
    codeFilename,
    config: {plugins: tct.plugins, rules},
  });
  return result.results.flatMap((r) => r.warnings.map((w) => w.rule));
}

const only = (name: string, option: unknown = true) => ({[`tct/${name}`]: option});

describe('tct/no-palette-vars', () => {
  const rules = only('no-palette-vars');
  it('rejects palette variables in values and declarations', async () => {
    expect(await lint('a { color: var(--tecton-palette-purple-500); }', rules)).toEqual([
      'tct/no-palette-vars',
    ]);
    expect(await lint('a { --tecton-palette-x: 1; }', rules)).toEqual(['tct/no-palette-vars']);
  });
  it('allows semantic tokens', async () => {
    expect(await lint('a { color: var(--color-text); --tecton-focus: 1; }', rules)).toEqual([]);
  });
});

describe('tct/no-import', () => {
  it('rejects @import', async () => {
    expect(await lint('@import "x.css";', only('no-import'))).toEqual(['tct/no-import']);
    expect(await lint('a { color: red; }', only('no-import'))).toEqual([]);
  });
});

describe('tct/no-color-literals', () => {
  const rules = only('no-color-literals');
  it('rejects hex, colour functions and named colours', async () => {
    expect(await lint('a { color: #fff; }', rules)).toHaveLength(1);
    expect(await lint('a { background: rgb(0 0 0 / 50%); }', rules)).toHaveLength(1);
    expect(await lint('a { background: hsl(210 50% 40%); }', rules)).toHaveLength(1);
    expect(await lint('a { border-color: oklch(0.5 0.1 200); }', rules)).toHaveLength(1);
    expect(await lint('a { outline: 2px solid red; }', rules)).toHaveLength(1);
    expect(await lint('a { --_x: #123456; }', rules)).toHaveLength(1);
    expect(
      await lint('a { color: color-mix(in srgb, #fff 50%, transparent); }', rules),
    ).toHaveLength(1);
  });
  it('rejects named colours in properties beyond the colour ones (mask, caret, column-rule)', async () => {
    expect(
      await lint('a { mask-image: linear-gradient(black, transparent); }', rules),
    ).toHaveLength(1);
    expect(await lint('a { caret-color: hotpink; }', rules)).toHaveLength(1);
    expect(await lint('a { column-rule: 1px solid tomato; }', rules)).toHaveLength(1);
    expect(await lint('a { text-emphasis: filled gold; }', rules)).toHaveLength(1);
  });
  it('allows tokens, transparent, currentColor, inherit and identifiers containing colour words', async () => {
    expect(
      await lint(
        'a { color: var(--color-text); background: transparent; border-color: currentcolor; outline-color: CurrentColor; fill: inherit; }',
        rules,
      ),
    ).toEqual([]);
    expect(await lint('a { color: var(--color-red, var(--color-danger)); }', rules)).toEqual([]);
    expect(
      await lint(
        'a { color-scheme: light dark; content: "red #fff"; background-image: url(red.png); }',
        rules,
      ),
    ).toEqual([]);
    expect(await lint('a { animation-name: red-flash; grid-area: teal; }', rules)).toEqual([]);
  });
  it('allows system colours only inside @media (forced-colors: active)', async () => {
    const decl = 'a { border-color: CanvasText; color: LinkText; }';
    expect(await lint(decl, rules)).toHaveLength(2);
    expect(await lint(`@media (forced-colors: active) { ${decl} }`, rules)).toEqual([]);
    expect(
      await lint(
        `@layer a11y { @media (forced-colors: active) and (prefers-color-scheme: dark) { ${decl} } }`,
        rules,
      ),
    ).toEqual([]);
    expect(await lint(`@media (prefers-color-scheme: dark) { ${decl} }`, rules)).toHaveLength(2);
    expect(await lint(`@media not (forced-colors: active) { ${decl} }`, rules)).toHaveLength(2);
    expect(await lint(`@media (forced-colors: none) { ${decl} }`, rules)).toHaveLength(2);
    // Named colours are never allowed, forced colours or not.
    expect(await lint('@media (forced-colors: active) { a { color: red; } }', rules)).toHaveLength(
      1,
    );
  });
  it('exposes the finder', () => {
    expect(findColorLiteral('color', '#abc')).toBe('#abc');
    expect(findColorLiteral('animation-name', 'red')).toBeUndefined();
    expect(findColorLiteral('color', 'Canvas')).toBe('Canvas');
    expect(findColorLiteral('color', 'Canvas', true)).toBeUndefined();
    expect(findColorLiteral('color', 'red', true)).toBe('red');
  });
  it.each(NAMED_COLOR_NAMES)('rejects the CSS named colour "%s"', async (name) => {
    expect(await lint(`a { color: ${name}; }`, rules)).toHaveLength(1);
  });
});

/**
 * Fixture files (tools/stylelint-plugin-tct/fixtures), linted with the repository's own
 * stylelint.config.js under a component path, so the test proves the config wires the D-013 Q-06 rule
 * ("every colour a component paints resolves to a Tecton token") for both `*.styles.css` and
 * `*.light.css`.
 */
describe('component CSS colour rule (fixtures, repository config)', () => {
  const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));
  const ROOT = fileURLToPath(new URL('../../', import.meta.url));

  async function lintFixture(file: string, asFile = file) {
    const code = readFileSync(join(FIXTURES, file), 'utf8');
    const result = await stylelint.lint({
      code,
      codeFilename: join(ROOT, 'packages/components/src/fixture', asFile),
      configFile: join(ROOT, 'stylelint.config.js'),
    });
    return result.results[0]!.warnings;
  }
  /** Source lines (1-based) whose declaration a fixture puts under a `.selector` starting with `prefix`. */
  const lineOf = (file: string, needle: string) =>
    readFileSync(join(FIXTURES, file), 'utf8')
      .split('\n')
      .findIndex((line) => line.includes(needle)) + 1;

  it('reports every declaration of bad-colors.styles.css', async () => {
    const warnings = (await lintFixture('bad-colors.styles.css')).filter(
      (w) => w.rule === 'tct/no-color-literals',
    );
    const source = readFileSync(join(FIXTURES, 'bad-colors.styles.css'), 'utf8')
      .split('\n')
      .flatMap((line, index) => (/^\s+[\w-]+: .+;$/.test(line) ? [index + 1] : []));
    expect(warnings.map((w) => w.line)).toEqual(source);
    expect(warnings[0]).toMatchObject({line: lineOf('bad-colors.styles.css', 'color: #fff')});
    expect(
      warnings.find((w) => w.line === lineOf('bad-colors.styles.css', 'color: ReD')),
    ).toBeDefined();
  });

  it('reports palette variables, including in fallbacks and as declarations', async () => {
    const warnings = (await lintFixture('bad-palette.styles.css')).filter(
      (w) => w.rule === 'tct/no-palette-vars',
    );
    expect(warnings.map((w) => [w.rule, w.line])).toEqual([
      [
        'tct/no-palette-vars',
        lineOf('bad-palette.styles.css', 'color: var(--tecton-palette-purple'),
      ],
      ['tct/no-palette-vars', lineOf('bad-palette.styles.css', 'gray-900')],
      ['tct/no-palette-vars', lineOf('bad-palette.styles.css', '--tecton-palette-purple-500: 1')],
    ]);
  });

  it('applies the same rules to *.light.css', async () => {
    const warnings = (await lintFixture('bad-colors.light.css')).filter((w) =>
      /^tct\/no-(color-literals|palette-vars)$/.test(w.rule),
    );
    expect(
      warnings.map((w) => [w.rule, w.line]).sort((a, b) => Number(a[1]) - Number(b[1])),
    ).toEqual([
      ['tct/no-color-literals', lineOf('bad-colors.light.css', '#abc')],
      ['tct/no-color-literals', lineOf('bad-colors.light.css', 'navy')],
      ['tct/no-palette-vars', lineOf('bad-colors.light.css', 'palette-purple')],
      ['tct/no-color-literals', lineOf('bad-colors.light.css', 'ButtonText')],
    ]);
  });

  it('accepts token-only CSS (transparent, currentColor, inherit, colour words in identifiers)', async () => {
    expect(await lintFixture('good-tokens.styles.css')).toEqual([]);
  });

  it('accepts system colours inside @media (forced-colors: active)', async () => {
    expect(await lintFixture('good-forced-colors.styles.css')).toEqual([]);
  });

  it('does not apply to other stylesheets (docs site, tokens)', async () => {
    const result = await stylelint.lint({
      code: 'a { color: #fff; }',
      codeFilename: join(ROOT, 'apps/docs/src/styles/x.css'),
      configFile: join(ROOT, 'stylelint.config.js'),
    });
    expect(result.results[0]!.warnings).toEqual([]);
  });
});

describe('tct/no-px-font-size', () => {
  const rules = only('no-px-font-size');
  it('rejects px font sizes', async () => {
    expect(await lint('a { font-size: 14px; }', rules)).toHaveLength(1);
    expect(await lint('a { font: 600 14px/1.4 sans-serif; }', rules)).toHaveLength(1);
    expect(await lint('a { --_font-size: 12px; }', rules)).toHaveLength(1);
  });
  it('allows rem, tokens and px elsewhere', async () => {
    expect(await lint('a { font-size: 0.875rem; padding: 4px; }', rules)).toEqual([]);
    expect(await lint('a { font-size: var(--font-size-sm); font: inherit; }', rules)).toEqual([]);
    expect(await lint('a { font: 1rem/16px sans-serif; }', rules)).toEqual([]);
  });
});

describe('tct/no-host-context', () => {
  it('rejects :host-context', async () => {
    expect(
      await lint(':host-context(.dark) a { color: inherit; }', only('no-host-context')),
    ).toEqual(['tct/no-host-context']);
    expect(await lint(':host(.x) a { color: inherit; }', only('no-host-context'))).toEqual([]);
  });
});

describe('tct/host-box-props', () => {
  const rules = only('host-box-props');
  it('rejects box properties on :host and :host()', async () => {
    expect(await lint(':host { background: none; }', rules)).toHaveLength(1);
    expect(
      await lint(':host([variant="a"]) { padding: 0; border-radius: 4px; }', rules),
    ).toHaveLength(2);
    expect(await lint(':host(:dir(rtl)[a="b"]) { margin-inline: 1px; }', rules)).toHaveLength(1);
    expect(await lint(':host, .x { outline: none; }', rules)).toHaveLength(1);
  });
  it('allows layout, inherited and custom properties, and inner parts', async () => {
    expect(
      await lint(':host { display: block; color: inherit; --_bg: red; opacity: 1; }', rules),
    ).toEqual([]);
    expect(await lint(':host([a]) .inner { background: none; padding: 0; }', rules)).toEqual([]);
  });
});

describe('tct/host-selectors', () => {
  const rules = only('host-selectors');
  it('rejects :where() inside :host() and nested pseudo-classes on :host()', async () => {
    expect(await lint(':host(:where(.a)) { display: block; }', rules)).toEqual([
      'tct/host-selectors',
    ]);
    expect(await lint(':host([a]) { &:dir(rtl) { display: none; } }', rules)).toEqual([
      'tct/host-selectors',
    ]);
  });
  it('allows conditions inside :host()', async () => {
    expect(await lint(':host(:dir(rtl)[placement="start"]) { display: block; }', rules)).toEqual(
      [],
    );
    expect(await lint(':host([a]) { .x { display: none; } }', rules)).toEqual([]);
  });
});

describe('tct/layers-required', () => {
  const rules = only('layers-required');
  it('rejects unlayered rules and unknown layers', async () => {
    expect(await lint('a { display: block; }', rules)).toEqual(['tct/layers-required']);
    expect(await lint('@media (min-width: 1px) { a { display: block; } }', rules)).toEqual([
      'tct/layers-required',
    ]);
    expect(await lint('@layer other { a { display: block; } }', rules)).toEqual([
      'tct/layers-required',
      'tct/layers-required',
    ]);
  });
  it('accepts the four layers, nested media, keyframes and the layer statement', async () => {
    const css = `
      @layer reset, component, state, a11y;
      @layer component { a { display: block; } @media (min-width: 1px) { a { color: inherit; } } }
      @layer state { a { &:focus { outline: none; } } }
      @keyframes spin { from { opacity: 0; } to { opacity: 1; } }
    `;
    expect(await lint(css, rules)).toEqual([]);
  });
  it('supports a per-file layer list (light-DOM sheets)', async () => {
    const options = [true, {layers: ['tecton.light-dom']}];
    expect(
      await lint(
        '@layer tecton.light-dom { a { display: block; } }',
        only('layers-required', options),
      ),
    ).toEqual([]);
    expect(
      await lint('@layer component { a { display: block; } }', only('layers-required', options)),
    ).toHaveLength(2);
  });
});

describe('tct/forced-colors-in-a11y-layer', () => {
  const rules = only('forced-colors-in-a11y-layer');
  it('requires @layer a11y around forced-colors media', async () => {
    expect(
      await lint('@media (forced-colors: active) { a { color: CanvasText; } }', rules),
    ).toEqual(['tct/forced-colors-in-a11y-layer']);
    expect(
      await lint(
        '@layer component { @media (forced-colors: active) { a { color: CanvasText; } } }',
        rules,
      ),
    ).toHaveLength(1);
    expect(
      await lint(
        '@layer a11y { @media (forced-colors: active) { a { color: CanvasText; } } }',
        rules,
      ),
    ).toEqual([]);
  });
});

describe('tct/hover-in-media', () => {
  const rules = only('hover-in-media');
  it('requires @media (hover: hover) around :hover', async () => {
    expect(await lint('a:hover { color: inherit; }', rules)).toEqual(['tct/hover-in-media']);
    expect(await lint('@media (hover: hover) { a:hover { color: inherit; } }', rules)).toEqual([]);
    expect(
      await lint('@media (hover:hover) { :host(:hover) a { color: inherit; } }', rules),
    ).toEqual([]);
    expect(await lint('a:focus-visible { color: inherit; }', rules)).toEqual([]);
  });
});

describe('tct/logical-properties', () => {
  const rules = only('logical-properties');
  it('rejects physical properties and values', async () => {
    expect(
      await lint(
        'a { margin-left: 1px; padding-right: 1px; left: 0; width: 1px; height: 1px; }',
        rules,
      ),
    ).toHaveLength(5);
    expect(
      await lint(
        'a { border-top-left-radius: 2px; border-left-color: red; overflow-x: auto; }',
        rules,
      ),
    ).toHaveLength(3);
    expect(await lint('a { text-align: left; float: right; }', rules)).toHaveLength(2);
  });
  it('allows logical properties and justified physical ones', async () => {
    expect(
      await lint(
        'a { margin-inline-start: 1px; inline-size: 1px; inset-inline: 0; text-align: start; }',
        rules,
      ),
    ).toEqual([]);
    expect(
      await lint('a {\n  /* physical: viewport-anchored toast stack */\n  left: 0;\n}', rules),
    ).toEqual([]);
    expect(await lint('a {\n  left: 0; /* physical: numeric axis */\n}', rules)).toEqual([]);
    expect(await lint('a { margin: 0 1px; }', rules)).toEqual([]);
  });
});

describe('tct/known-custom-properties', () => {
  const tokens = ['--color-text', 'spacing-2'];
  const rules = only('known-custom-properties', [true, {tokenNames: tokens}]);
  it('rejects unknown names', async () => {
    expect(await lint('a { color: var(--nope); }', rules)).toEqual(['tct/known-custom-properties']);
    expect(await lint('a { color: var(--color-text, var(--other)); }', rules)).toEqual([
      'tct/known-custom-properties',
    ]);
  });
  it('allows tokens, private properties and properties declared in the same file', async () => {
    expect(
      await lint(
        'a { --local: 1; color: var(--color-text); margin: var(--spacing-2) var(--_x-y) var(--local); }',
        rules,
      ),
    ).toEqual([]);
  });
  it('allows the component own @cssprop names', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tct-stylelint-'));
    mkdirSync(join(dir, 'button'));
    writeFileSync(
      join(dir, 'button', 'tct-button.ts'),
      '/** @cssprop --button-focus-offset - Focus ring offset. */\nexport class X {}\n',
    );
    const file = join(dir, 'button', 'tct-button.styles.css');
    expect(await lint('a { outline-offset: var(--button-focus-offset); }', rules, file)).toEqual(
      [],
    );
    expect(await lint('a { outline-offset: var(--other-offset); }', rules, file)).toEqual([
      'tct/known-custom-properties',
    ]);
  });
  it('enforces nothing when no token set exists yet (before milestone M2)', async () => {
    const missing = only('known-custom-properties', [
      true,
      {tokenNamesFile: '/nonexistent/token-names.json'},
    ]);
    expect(await lint('a { color: var(--whatever); }', missing)).toEqual([]);
  });
});
