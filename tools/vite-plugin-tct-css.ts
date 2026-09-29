/**
 * In-house Vite plugin (A§2.3, A-04): compiles component stylesheets `*.styles.css` into Lit `css`
 * modules with build-time token fallbacks (A§5.5).
 *
 *   import styles from './tct-button.styles.css';   // -> CSSResult
 *
 * Why `.styles.css`: it avoids the Rolldown `preserveModules` name clash between `x.ts` and `x.css`.
 * Why the id is rewritten to `<file>.styles.css.js`: Vite's own CSS pipeline claims every id that
 * ends in `.css` and would run our JavaScript through PostCSS. A resolved id that ends in `.js` is
 * never treated as CSS, and `load` still reads the original file.
 *
 * Steps per file: refuse `@import` (component CSS must be self-contained), inject token fallbacks,
 * escape backslashes, backticks and `${`, emit `import {css} from 'lit'; export default css\`…\``.
 *
 * Token fallbacks come from `packages/tokens/dist/fallbacks.json` (`token name -> light value`),
 * produced by milestone M2. When the file is absent the plugin is a no-op for fallbacks.
 *
 * Used by the Vitest config, the docs site and the library/CDN builds. Runs on Node type stripping
 * (erasable syntax only).
 */
import {existsSync, readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Plugin} from 'vite';

export const STYLES_SUFFIX = '.styles.css';
/** Suffix appended to the resolved id so Vite's CSS plugins ignore it. */
export const MODULE_SUFFIX = '.js';

export type Fallbacks = Readonly<Record<string, string>>;

export interface TctCssOptions {
  /** Fallback map (`--token` or `token` name -> light value). Overrides `fallbacksFile`. */
  fallbacks?: Fallbacks;
  /** Path to `fallbacks.json`, relative to the Vite root. Missing file means no fallbacks. */
  fallbacksFile?: string;
}

export const DEFAULT_FALLBACKS_FILE = 'packages/tokens/dist/fallbacks.json';

/** Normalises a fallbacks object so keys always carry the leading `--`. */
export function normalizeFallbacks(input: Fallbacks): Map<string, string> {
  const map = new Map<string, string>();
  for (const [name, value] of Object.entries(input)) {
    if (typeof value !== 'string') continue;
    map.set(name.startsWith('--') ? name : `--${name}`, value);
  }
  return map;
}

/** Reads a fallbacks file; returns an empty map when it does not exist or is unreadable JSON. */
export function readFallbacksFile(path: string): Map<string, string> {
  if (!existsSync(path)) return new Map();
  try {
    return normalizeFallbacks(JSON.parse(readFileSync(path, 'utf8')) as Fallbacks);
  } catch {
    return new Map();
  }
}

/**
 * Rewrites `var(--x)` (no fallback, `--x` known) to `var(--x, <value>)`. Existing fallbacks are kept
 * but their own nested `var()` calls are processed. Comments and strings are left untouched.
 */
export function injectFallbacks(css: string, fallbacks: ReadonlyMap<string, string>): string {
  if (fallbacks.size === 0) return css;
  let out = '';
  let i = 0;
  while (i < css.length) {
    const ch = css[i]!;
    // Skip comments and strings verbatim.
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      out += css.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const stop = endOfString(css, i);
      out += css.slice(i, stop);
      i = stop;
      continue;
    }
    if (isVarCallAt(css, i)) {
      const open = i + 3; // index of "("
      const close = matchingParen(css, open);
      if (close !== -1) {
        out += rewriteVarCall(css.slice(open + 1, close), fallbacks);
        i = close + 1;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}

function isVarCallAt(css: string, i: number): boolean {
  if (css[i] !== 'v' || css[i + 1] !== 'a' || css[i + 2] !== 'r' || css[i + 3] !== '(')
    return false;
  const prev = css[i - 1];
  // `var(` must not be the tail of another identifier (e.g. `--my-var(`) .
  return prev === undefined || !/[\w-]/.test(prev);
}

function endOfString(css: string, start: number): number {
  const quote = css[start];
  let i = start + 1;
  while (i < css.length) {
    if (css[i] === '\\') i += 2;
    else if (css[i] === quote) return i + 1;
    else i++;
  }
  return css.length;
}

/** Index of the `)` matching the `(` at `open`, honouring nesting, strings and comments. */
function matchingParen(css: string, open: number): number {
  let depth = 0;
  let i = open;
  while (i < css.length) {
    const ch = css[i]!;
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end === -1) return -1;
      i = end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      i = endOfString(css, i);
      continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

/** Index of the first top-level comma in `args`, or -1. */
function topLevelComma(args: string): number {
  let depth = 0;
  for (let i = 0; i < args.length; i++) {
    const ch = args[i]!;
    if (ch === '"' || ch === "'") {
      i = endOfString(args, i) - 1;
    } else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) return i;
  }
  return -1;
}

function rewriteVarCall(args: string, fallbacks: ReadonlyMap<string, string>): string {
  const comma = topLevelComma(args);
  if (comma === -1) {
    const name = args.trim();
    const value = fallbacks.get(name);
    return value === undefined ? `var(${args})` : `var(${args}, ${value})`;
  }
  const head = args.slice(0, comma + 1);
  const fallback = injectFallbacks(args.slice(comma + 1), fallbacks);
  return `var(${head}${fallback})`;
}

/** Escapes text for inclusion inside a JavaScript template literal (cooked strings, as Lit reads them). */
export function escapeTemplateLiteral(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

/** Throws for constructs component CSS must not contain. */
export function assertComponentCss(css: string, file: string): void {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/@import\b/i.test(withoutComments)) {
    throw new Error(
      `${file}: @import is not allowed in component CSS (A§2.3). ` +
        `Share styles by adding another module to \`static styles\`.`,
    );
  }
}

/** Pure transform: CSS text in, JavaScript module source out. */
export function compileStyles(
  css: string,
  file: string,
  fallbacks: ReadonlyMap<string, string> = new Map(),
): string {
  assertComponentCss(css, file);
  const withFallbacks = injectFallbacks(css, fallbacks);
  return `import {css} from 'lit';\nexport default css\`${escapeTemplateLiteral(withFallbacks)}\`;\n`;
}

function stripQuery(id: string): string {
  const q = id.search(/[?#]/);
  return q === -1 ? id : id.slice(0, q);
}

/** Maps a dev-server URL (`/@fs/<abs>`, root-relative or absolute) to an existing file path. */
function locateFile(path: string, root: string): string | undefined {
  const candidates = [path];
  if (path.startsWith('/@fs/')) candidates.unshift(path.slice('/@fs'.length));
  candidates.push(resolve(root, `.${path.startsWith('/') ? path : `/${path}`}`));
  return candidates.find((candidate) => existsSync(candidate));
}

export function tctCss(options: TctCssOptions = {}): Plugin {
  let fallbacks = new Map<string, string>();
  let fallbacksPath: string | undefined;
  let root = process.cwd();

  const loadFallbacks = () => {
    fallbacks = options.fallbacks
      ? normalizeFallbacks(options.fallbacks)
      : fallbacksPath
        ? readFallbacksFile(fallbacksPath)
        : new Map<string, string>();
  };

  return {
    name: 'tct-css',
    enforce: 'pre',

    configResolved(config) {
      root = config.root;
      fallbacksPath = resolve(config.root, options.fallbacksFile ?? DEFAULT_FALLBACKS_FILE);
      loadFallbacks();
    },

    buildStart() {
      // Re-read on every (re)build so a regenerated fallbacks.json is picked up.
      loadFallbacks();
      if (fallbacksPath && existsSync(fallbacksPath)) this.addWatchFile(fallbacksPath);
    },

    async resolveId(source, importer, resolveOptions) {
      const bare = stripQuery(source);
      if (bare.endsWith(STYLES_SUFFIX + MODULE_SUFFIX)) {
        // A dev-server request for an id we rewrote earlier: the URL is `/@fs/<abs>` or root-relative.
        const file = bare.slice(0, -MODULE_SUFFIX.length);
        const found = locateFile(file, root);
        return found ? found + MODULE_SUFFIX : null;
      }
      if (!bare.endsWith(STYLES_SUFFIX)) return null;
      if (resolveOptions.custom?.['tct-css']) return null;
      const resolved = await this.resolve(source, importer, {
        ...resolveOptions,
        skipSelf: true,
        custom: {...resolveOptions.custom, 'tct-css': true},
      });
      if (!resolved || resolved.external) return resolved;
      const path = stripQuery(resolved.id);
      if (!path.endsWith(STYLES_SUFFIX)) return resolved;
      return {...resolved, id: path + MODULE_SUFFIX};
    },

    load(id) {
      const path = stripQuery(id);
      if (!path.endsWith(STYLES_SUFFIX + MODULE_SUFFIX)) return null;
      const file = path.slice(0, -MODULE_SUFFIX.length);
      this.addWatchFile(file);
      const source = readFileSync(file, 'utf8');
      return {code: compileStyles(source, file, fallbacks), map: null};
    },
  };
}

export default tctCss;
