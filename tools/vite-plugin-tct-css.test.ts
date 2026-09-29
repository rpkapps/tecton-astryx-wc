import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {runInNewContext} from 'node:vm';
import {join} from 'node:path';
import {build} from 'vite';
import {describe, expect, it} from 'vitest';
import {
  compileStyles,
  escapeTemplateLiteral,
  injectFallbacks,
  normalizeFallbacks,
  readFallbacksFile,
  tctCss,
} from './vite-plugin-tct-css.ts';

const fallbacks = normalizeFallbacks({
  'color-text': '#111',
  '--spacing-2': '8px',
  'color-bg': 'light-dark(#fff, #000)',
});

describe('injectFallbacks', () => {
  it('adds the light value to bare var() calls of known tokens', () => {
    expect(injectFallbacks('a { color: var(--color-text); }', fallbacks)).toBe(
      'a { color: var(--color-text, #111); }',
    );
    expect(injectFallbacks('a { gap: var(--spacing-2) var( --spacing-2 ); }', fallbacks)).toBe(
      'a { gap: var(--spacing-2, 8px) var( --spacing-2 , 8px); }',
    );
  });

  it('keeps existing fallbacks and unknown or private names', () => {
    expect(injectFallbacks('a { color: var(--color-text, red); }', fallbacks)).toBe(
      'a { color: var(--color-text, red); }',
    );
    expect(injectFallbacks('a { color: var(--_bg); margin: var(--unknown); }', fallbacks)).toBe(
      'a { color: var(--_bg); margin: var(--unknown); }',
    );
  });

  it('processes var() calls nested in fallbacks', () => {
    expect(injectFallbacks('a { color: var(--_x, var(--color-text)); }', fallbacks)).toBe(
      'a { color: var(--_x, var(--color-text, #111)); }',
    );
    expect(injectFallbacks('a { color: var(--_x, calc(var(--spacing-2) * 2)); }', fallbacks)).toBe(
      'a { color: var(--_x, calc(var(--spacing-2, 8px) * 2)); }',
    );
  });

  it('handles values with commas and parentheses', () => {
    expect(injectFallbacks('a { background: var(--color-bg); }', fallbacks)).toBe(
      'a { background: var(--color-bg, light-dark(#fff, #000)); }',
    );
  });

  it('leaves comments and strings alone', () => {
    const css = '/* var(--color-text) */ a::after { content: "var(--color-text)"; }';
    expect(injectFallbacks(css, fallbacks)).toBe(css);
  });

  it('does not treat the tail of another identifier as var()', () => {
    expect(injectFallbacks('a { x: my-var(--color-text); }', fallbacks)).toBe(
      'a { x: my-var(--color-text); }',
    );
  });

  it('is a no-op without fallbacks', () => {
    expect(injectFallbacks('a { color: var(--color-text); }', new Map())).toBe(
      'a { color: var(--color-text); }',
    );
  });
});

describe('escapeTemplateLiteral', () => {
  it('escapes backslashes, backticks and ${', () => {
    expect(escapeTemplateLiteral('content: "\\201C"; a`b ${c}')).toBe(
      'content: "\\\\201C"; a\\`b \\${c}',
    );
  });
});

describe('compileStyles', () => {
  it('emits a Lit css module that round-trips the CSS text exactly', () => {
    const source = '.a::before { content: "\\201C"; }\n/* `tick` and ${dollar} */\n';
    const code = compileStyles(source, 'x.styles.css');
    expect(code.startsWith("import {css} from 'lit';\nexport default css`")).toBe(true);
    // Evaluate the template literal with a stub `css` tag that returns the cooked text.
    const body = code.slice(code.indexOf('css`') + 3, code.lastIndexOf('`;') + 1);
    const cooked = runInNewContext(body) as string;
    expect(cooked).toBe(source);
  });

  it('rejects @import', () => {
    expect(() => compileStyles('@import "a.css";', 'x.styles.css')).toThrow(
      /@import is not allowed/,
    );
    expect(() => compileStyles('/* @import "a.css"; */ a{}', 'x.styles.css')).not.toThrow();
  });
});

describe('readFallbacksFile', () => {
  it('returns an empty map when the file is missing or invalid', () => {
    expect(readFallbacksFile('/nonexistent/fallbacks.json').size).toBe(0);
    const dir = mkdtempSync(join(tmpdir(), 'tct-css-'));
    writeFileSync(join(dir, 'bad.json'), '{nope');
    expect(readFallbacksFile(join(dir, 'bad.json')).size).toBe(0);
  });

  it('reads token -> value maps', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tct-css-'));
    writeFileSync(
      join(dir, 'fallbacks.json'),
      JSON.stringify({'color-text': '#111', '--x': '1px'}),
    );
    const map = readFallbacksFile(join(dir, 'fallbacks.json'));
    expect(map.get('--color-text')).toBe('#111');
    expect(map.get('--x')).toBe('1px');
  });
});

describe('vite integration (library build)', () => {
  async function bundle(files: Record<string, string>, plugin = tctCss()) {
    const root = mkdtempSync(join(tmpdir(), 'tct-css-build-'));
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(join(root, name, '..'), {recursive: true});
      writeFileSync(join(root, name), content);
    }
    const result = await build({
      root,
      logLevel: 'silent',
      configFile: false,
      plugins: [plugin],
      build: {
        write: false,
        lib: {entry: join(root, 'entry.js'), formats: ['es'], fileName: 'out'},
        rollupOptions: {external: ['lit']},
        minify: false,
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) =>
      'output' in r ? r.output : [],
    );
    return outputs.map((chunk) => ('code' in chunk ? chunk.code : '')).join('\n');
  }

  it('turns an imported *.styles.css into a css module and injects fallbacks', async () => {
    const code = await bundle(
      {
        'entry.js': "import styles from './a.styles.css';\nexport {styles};\n",
        'a.styles.css': '@layer component { a { color: var(--color-text); content: "\\201C"; } }\n',
      },
      tctCss({fallbacks: {'color-text': '#111'}}),
    );
    expect(code).toMatch(/from ["']lit["']/);
    expect(code).toContain('color: var(--color-text, #111)');
    expect(code).toContain('content: "\\\\201C"');
  });

  it('works without a fallbacks file', async () => {
    const code = await bundle({
      'entry.js': "import styles from './a.styles.css';\nexport {styles};\n",
      'a.styles.css': 'a { color: var(--color-text); }\n',
    });
    expect(code).toContain('color: var(--color-text)');
    expect(code).not.toContain('--color-text,');
  });

  it('fails the build on @import', async () => {
    await expect(
      bundle({
        'entry.js': "import styles from './a.styles.css';\nexport {styles};\n",
        'a.styles.css': '@import "b.css";\n',
      }),
    ).rejects.toThrow(/@import is not allowed/);
  });
});
