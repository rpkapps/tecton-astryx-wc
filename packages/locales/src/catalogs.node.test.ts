/**
 * Black-box tests of the locales generator: they read what `pnpm generate` wrote to `dist/` and the
 * verbatim upstream inputs. ICU validity of the pseudo locale (does every message parse and format)
 * is asserted in `@tecton-wc/core` where `format.ts` owns the formatter.
 */
import {createHash} from 'node:crypto';
import {readdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import {aliases, pseudoTag, tags} from '../dist/aliases.js';
import {loaders} from '../dist/loaders.js';

const catalogDir = fileURLToPath(new URL('./catalogs/', import.meta.url));
const lock = JSON.parse(
  readFileSync(fileURLToPath(new URL('./catalogs.lock.json', import.meta.url)), 'utf8'),
) as Record<string, string>;

/** The upstream catalogs keep their own id prefix; everything shipped is `@tct.*` (D-015). */
const UPSTREAM_PREFIX = '@astryx.';
const shipped = (id: string): string =>
  id.startsWith(UPSTREAM_PREFIX) ? `@tct.${id.slice(UPSTREAM_PREFIX.length)}` : id;
const upstreamEnglish = JSON.parse(readFileSync(`${catalogDir}en.json`, 'utf8')) as Record<
  string,
  {defaultMessage: string}
>;

const load = async (tag: string): Promise<Record<string, string>> => {
  const loader = loaders[tag];
  if (!loader) throw new Error(`no loader for ${tag}`);
  return (await loader()).default;
};

function matching(text: string, open: number): number {
  let level = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') level++;
    else if (text[i] === '}' && --level === 0) return i;
  }
  throw new Error(`unbalanced braces: ${text}`);
}

/**
 * Structural skeleton of an ICU message: argument names and types, plural/select selectors and
 * nested bodies (`depth:name:type`, `depth:selector:one`). Literal text is ignored, so an English
 * message and its pseudo-localisation must produce the same skeleton.
 */
function icuSkeleton(message: string, depth = 0): string[] {
  const tokens: string[] = [];
  for (let i = 0; i < message.length; i++) {
    if (message[i] !== '{') continue;
    const close = matching(message, i);
    const inner = message.slice(i + 1, close);
    const firstComma = inner.indexOf(',');
    if (firstComma === -1) {
      tokens.push(`${depth}:${inner.trim()}:`);
    } else {
      const rest = inner.slice(firstComma + 1);
      const secondComma = rest.indexOf(',');
      const type = (secondComma === -1 ? rest : rest.slice(0, secondComma)).trim();
      tokens.push(`${depth}:${inner.slice(0, firstComma).trim()}:${type}`);
      if (['plural', 'select', 'selectordinal'].includes(type) && secondComma !== -1) {
        const options = rest.slice(secondComma + 1);
        let selector = '';
        for (let j = 0; j < options.length; j++) {
          if (options[j] === '{') {
            const end = matching(options, j);
            tokens.push(`${depth}:selector:${selector.trim()}`);
            tokens.push(...icuSkeleton(options.slice(j + 1, end), depth + 1));
            selector = '';
            j = end;
          } else {
            selector += options[j];
          }
        }
      }
    }
    i = close;
  }
  return tokens;
}

const argumentNames = (message: string): Set<string> =>
  new Set(
    icuSkeleton(message)
      .map((token) => token.split(':')[1]!)
      .filter((name) => name !== 'selector'),
  );

describe('upstream catalogs', () => {
  it('ships the 30 upstream catalogs, byte-identical to the lock', () => {
    const files = readdirSync(catalogDir).filter((name) => name.endsWith('.json'));
    expect(files).toHaveLength(30);
    for (const name of files) {
      const hash = createHash('sha256')
        .update(readFileSync(`${catalogDir}${name}`))
        .digest('hex');
      expect(lock[name], name).toBe(hash);
    }
  });

  it('generates one module per catalog with the same 370 ids', async () => {
    expect(tags).toHaveLength(30);
    const english = await load('en');
    const ids = Object.keys(english);
    expect(ids).toHaveLength(370);
    for (const tag of tags) {
      const messages = await load(tag);
      expect(Object.keys(messages).sort(), tag).toEqual([...ids].sort());
      for (const id of ids) expect(typeof messages[id], `${tag} ${id}`).toBe('string');
    }
    // Imports 30 generated modules; the default 5 s is too tight when the whole suite runs in parallel.
  }, 30_000);

  it('ships every upstream id as @tct.* and the source catalogs stay verbatim', async () => {
    const expected = Object.keys(upstreamEnglish).map(shipped).sort();
    expect(expected.every((id) => id.startsWith('@tct.'))).toBe(true);
    for (const tag of [...tags, pseudoTag]) {
      const messages = await load(tag);
      expect(Object.keys(messages).sort(), tag).toEqual(expected);
      expect(JSON.stringify(messages).toLowerCase(), tag).not.toContain('astryx');
    }
    // The upstream files keep the upstream prefix (byte-identical, hash-locked).
    expect(Object.keys(upstreamEnglish).every((id) => id.startsWith(UPSTREAM_PREFIX))).toBe(true);
  }, 30_000);

  it('keeps every ICU argument of the English message in each translation', async () => {
    const english = await load('en');
    for (const tag of tags) {
      const messages = await load(tag);
      for (const [id, message] of Object.entries(messages)) {
        // A translation may drop a plural branch its language does not need, but never an argument.
        const present = argumentNames(message);
        for (const name of argumentNames(english[id]!)) {
          expect(present, `${tag} ${id}`).toContain(name);
        }
      }
    }
  });
});

describe('English namespace modules', () => {
  it('partition the English catalog by namespace', async () => {
    const english = await load('en');
    const merged: Record<string, string> = {};
    const dir = fileURLToPath(new URL('../dist/en/', import.meta.url));
    const modules = readdirSync(dir).filter((name) => name.endsWith('.js'));
    expect(modules.length).toBeGreaterThanOrEqual(70);
    for (const name of modules) {
      const module = (await import(/* @vite-ignore */ `${dir}${name}`)) as {
        default: Record<string, string>;
      };
      const namespace = name.replace(/\.js$/, '');
      for (const [id, message] of Object.entries(module.default)) {
        expect(id.startsWith(`@tct.${namespace}.`), id).toBe(true);
        merged[id] = message;
      }
    }
    // The mapped upstream ids partition en.json exactly. New `@tct.<folder>.*` ids come from the
    // component folders' `<folder>.messages.json` and exist only in the namespace modules (components
    // pass them as `defaults`), so each must match its folder file.
    const upstreamIds = new Set(Object.keys(upstreamEnglish).map(shipped));
    const upstream = Object.fromEntries(
      Object.entries(merged).filter(([id]) => upstreamIds.has(id)),
    );
    expect(upstream).toEqual(english);
    const componentsSrc = fileURLToPath(new URL('../../components/src/', import.meta.url));
    for (const [id, message] of Object.entries(merged)) {
      if (upstreamIds.has(id)) continue;
      const folder = id.split('.')[1]!;
      const source = JSON.parse(
        readFileSync(`${componentsSrc}${folder}/${folder}.messages.json`, 'utf8'),
      ) as Record<string, string | {defaultMessage: string}>;
      const expected = source[id];
      expect(typeof expected === 'string' ? expected : expected?.defaultMessage, id).toBe(message);
    }
    // Imports 70+ namespace modules and reads the component message files: slow on a loaded machine.
  }, 30_000);
});

describe('pseudo locale', () => {
  it('covers every id, accents letters and keeps the ICU skeleton', async () => {
    const english = await load('en');
    const pseudo = await load(pseudoTag);
    expect(Object.keys(pseudo).sort()).toEqual(Object.keys(english).sort());
    const message = pseudo['@tct.pagination.previousBy']!;
    // "Go back {step, number} {step, plural, one {page} other {pages}}"
    expect(message).toMatch(
      /^\[.*\{step, number\}.*\{step, plural, one \{.*\} other \{.*\}\}.*\]$/,
    );
    expect(message).not.toContain('Go back');
    for (const [id, text] of Object.entries(english)) {
      expect(icuSkeleton(pseudo[id]!), id).toEqual(icuSkeleton(text));
      if (text !== '') expect(pseudo[id]!.length, id).toBeGreaterThan(text.length);
    }
  });
});

describe('aliases and loaders', () => {
  it('aliases point at shipped catalogs', () => {
    const known = new Set<string>([...tags, pseudoTag]);
    for (const [alias, target] of Object.entries(aliases)) {
      expect(known.has(target), `${alias} -> ${target}`).toBe(true);
    }
    expect(aliases.fr).toBe('fr-FR');
    expect(aliases.pt).toBe('pt-BR');
    expect(aliases.zh).toBe('zh-CN');
    expect(aliases['zh-Hant']).toBe('zh-TW');
    expect(aliases['zh-HK']).toBe('zh-TW');
    expect(aliases.nb).toBe('no-NO');
    expect(aliases.nn).toBe('no-NO');
    expect(aliases['en-XA']).toBe(pseudoTag);
  });

  it('has a lazy loader for every catalog and the pseudo locale', () => {
    expect(Object.keys(loaders).sort()).toEqual([...tags, pseudoTag].sort());
  });
});
