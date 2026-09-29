/**
 * Pure helpers of the locales generator (A§9.15): catalog parsing, the pseudo locale, the alias table
 * and the JavaScript / declaration renderers. `generate.ts` does the file IO.
 *
 * Runs on Node type stripping (erasable syntax only, `.ts` extensions in relative imports).
 */

/** One upstream catalog entry (`{defaultMessage, description}`). */
export interface CatalogEntry {
  defaultMessage: string;
  description?: string;
}

export type UpstreamCatalog = Record<string, CatalogEntry>;
export type FlatMessages = Record<string, string>;

/**
 * Base-tag aliases (A§9.15). Keys are matched case-insensitively against the requested locale after
 * subtag stripping; values are shipped catalog tags. The runtime walks `language-script-region` →
 * `language-script` → `language-region` → `language` and takes the first hit.
 */
export const ALIASES: Readonly<Record<string, string>> = {
  af: 'af-ZA',
  ar: 'ar-SA',
  ca: 'ca-ES',
  cs: 'cs-CZ',
  da: 'da-DK',
  de: 'de-DE',
  el: 'el-GR',
  es: 'es-ES',
  fi: 'fi-FI',
  fr: 'fr-FR',
  he: 'he-IL',
  iw: 'he-IL',
  hu: 'hu-HU',
  it: 'it-IT',
  ja: 'ja-JP',
  ko: 'ko-KR',
  nl: 'nl-NL',
  no: 'no-NO',
  nb: 'no-NO',
  nn: 'no-NO',
  'nb-NO': 'no-NO',
  'nn-NO': 'no-NO',
  pl: 'pl-PL',
  pt: 'pt-BR',
  ro: 'ro-RO',
  ru: 'ru-RU',
  sr: 'sr-SP',
  'sr-RS': 'sr-SP',
  'sr-Cyrl': 'sr-SP',
  'sr-Cyrl-RS': 'sr-SP',
  sv: 'sv-SE',
  tr: 'tr-TR',
  uk: 'uk-UA',
  vi: 'vi-VN',
  zh: 'zh-CN',
  'zh-Hans': 'zh-CN',
  'zh-Hans-CN': 'zh-CN',
  'zh-SG': 'zh-CN',
  'zh-Hant': 'zh-TW',
  'zh-Hant-TW': 'zh-TW',
  'zh-HK': 'zh-TW',
  'zh-Hant-HK': 'zh-TW',
  'zh-MO': 'zh-TW',
  'zh-Hant-MO': 'zh-TW',
  // Conventional pseudo-locale tag (Android/ICU accent pseudo-locale).
  'en-XA': 'pseudo',
};

export const PSEUDO_TAG = 'pseudo';

// ------------------------------------------------------------------------------------------ ids

/**
 * The upstream catalogs are kept byte-identical, so their ids carry the upstream namespace. Every id the
 * package ships is `@tct.<namespace>.<key>`: the generator maps the upstream prefix (D-015).
 */
export const UPSTREAM_ID_PREFIX = '@astryx.';
export const SHIPPED_ID_PREFIX = '@tct.';

/** The shipped form of an upstream catalog id (`<upstream prefix>pagination.next` -> `@tct.pagination.next`). */
export function shippedId(upstreamId: string): string {
  return upstreamId.startsWith(UPSTREAM_ID_PREFIX)
    ? SHIPPED_ID_PREFIX + upstreamId.slice(UPSTREAM_ID_PREFIX.length)
    : upstreamId;
}

/** `@tct.pagination.next` -> `pagination`; other id shapes have no namespace. */
export function namespaceOf(id: string): string | undefined {
  const match = /^@tct\.([^.]+)\./.exec(id);
  return match?.[1];
}

/** Flattens an upstream catalog to `{shipped id: message}`, sorted by shipped id. */
export function flatten(catalog: UpstreamCatalog): FlatMessages {
  const out: FlatMessages = {};
  for (const id of Object.keys(catalog).sort()) out[shippedId(id)] = catalog[id]!.defaultMessage;
  return out;
}

/**
 * Parses a component folder's `<folder>.messages.json` (`{"@tct.<folder>.<key>": "text" | {defaultMessage}}`)
 * and validates that every id belongs to the folder.
 */
export function parseFolderMessages(folder: string, json: unknown, file: string): FlatMessages {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error(`${file}: expected an object of message ids`);
  }
  const out: FlatMessages = {};
  for (const [id, value] of Object.entries(json)) {
    if (!id.startsWith(`@tct.${folder}.`)) {
      throw new Error(`${file}: id "${id}" must start with "@tct.${folder}."`);
    }
    const message =
      typeof value === 'string' ? value : (value as Partial<CatalogEntry> | null)?.defaultMessage;
    if (typeof message !== 'string') {
      throw new Error(`${file}: id "${id}" needs a string or {defaultMessage}`);
    }
    out[id] = message;
  }
  return out;
}

// ------------------------------------------------------------------------------------- pseudo

const ACCENTS: Readonly<Record<string, string>> = {
  a: 'à',
  b: 'ƀ',
  c: 'ç',
  d: 'ð',
  e: 'é',
  f: 'ƒ',
  g: 'ĝ',
  h: 'ĥ',
  i: 'î',
  j: 'ĵ',
  k: 'ķ',
  l: 'ļ',
  m: 'ɱ',
  n: 'ñ',
  o: 'ô',
  p: 'ƥ',
  q: 'ƣ',
  r: 'ŕ',
  s: 'š',
  t: 'ţ',
  u: 'û',
  v: 'ṽ',
  w: 'ŵ',
  x: 'ẋ',
  y: 'ý',
  z: 'ž',
  A: 'À',
  B: 'Ɓ',
  C: 'Ç',
  D: 'Ð',
  E: 'É',
  F: 'Ƒ',
  G: 'Ĝ',
  H: 'Ĥ',
  I: 'Î',
  J: 'Ĵ',
  K: 'Ķ',
  L: 'Ļ',
  M: 'Ṁ',
  N: 'Ñ',
  O: 'Ô',
  P: 'Ƥ',
  Q: 'Ǫ',
  R: 'Ŕ',
  S: 'Š',
  T: 'Ţ',
  U: 'Û',
  V: 'Ṽ',
  W: 'Ŵ',
  X: 'Ẋ',
  Y: 'Ý',
  Z: 'Ž',
};

const accent = (text: string): string => text.replace(/[A-Za-z]/g, (ch) => ACCENTS[ch] ?? ch);

/** Index of the `}` that closes the `{` at `open` (ICU nesting; quoted `'{'` is skipped). */
function closingBrace(message: string, open: number): number {
  let depth = 0;
  for (let i = open; i < message.length; i++) {
    const ch = message[i];
    if (ch === "'" && (message[i + 1] === '{' || message[i + 1] === '}')) {
      const end = message.indexOf("'", i + 1);
      if (end !== -1) i = end;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i;
  }
  throw new Error(`Unbalanced braces in ICU message: ${message}`);
}

/**
 * Accents the literal text of an ICU message and leaves everything the formatter interprets alone:
 * argument names, `plural`/`select` keywords, selectors, `#`, and apostrophe-quoted text.
 */
function accentMessage(message: string): string {
  let out = '';
  let text = '';
  const flush = () => {
    out += accent(text);
    text = '';
  };
  for (let i = 0; i < message.length; i++) {
    const ch = message[i]!;
    if (ch === "'") {
      // ICU quoting: `''` is a literal apostrophe, `'{...'` quotes braces.
      if (message[i + 1] === "'") {
        text += "''";
        i++;
      } else if (message[i + 1] === '{' || message[i + 1] === '}') {
        flush();
        const end = message.indexOf("'", i + 1);
        const stop = end === -1 ? message.length - 1 : end;
        out += message.slice(i, stop + 1);
        i = stop;
      } else {
        text += ch;
      }
    } else if (ch === '{') {
      flush();
      const close = closingBrace(message, i);
      out += accentArgument(message.slice(i + 1, close));
      i = close;
    } else {
      text += ch;
    }
  }
  flush();
  return out;
}

/** `{name}`, `{name, number}`, `{n, plural, one {…} other {…}}` -> the same with accented bodies. */
function accentArgument(inner: string): string {
  const parts = /^([^,]*),\s*(plural|selectordinal|select)\s*,([\s\S]*)$/.exec(inner);
  if (!parts) return `{${inner}}`;
  const [, name, kind, options] = parts;
  let rebuilt = '';
  for (let i = 0; i < options!.length; i++) {
    const ch = options![i]!;
    if (ch === '{') {
      const close = closingBrace(options!, i);
      rebuilt += `{${accentMessage(options!.slice(i + 1, close))}}`;
      i = close;
    } else {
      rebuilt += ch; // selectors, `offset:n`, whitespace
    }
  }
  return `{${name}, ${kind},${rebuilt}}`;
}

/**
 * Pseudo-localises one ICU message: accented letters, roughly 30 % longer, wrapped in brackets.
 * Placeholders and plural/select structure are untouched, so the result formats like the original.
 */
export function pseudoLocalize(message: string): string {
  if (message === '') return message;
  const accented = accentMessage(message);
  const padding = '~'.repeat(Math.max(1, Math.round(message.length * 0.3)));
  return `[${accented} ${padding}]`;
}

// ---------------------------------------------------------------------------------- renderers

const BANNER =
  '// GENERATED by packages/locales/scripts/generate.ts. Do not edit; do not commit.\n';

function sorted(messages: FlatMessages): FlatMessages {
  const out: FlatMessages = {};
  for (const id of Object.keys(messages).sort()) out[id] = messages[id]!;
  return out;
}

/** `export default {...}` catalog module. */
export function renderMessagesModule(messages: FlatMessages): string {
  return `${BANNER}export default ${JSON.stringify(sorted(messages), null, 2)};\n`;
}

/**
 * Declaration for a catalog module. Self-contained on purpose: `tsc -b` also emits `dist/types.d.ts`
 * from `src/types.ts`, and a generated file importing it would be both an input and an output.
 */
export function renderMessagesDeclaration(): string {
  return `${BANNER}declare const messages: Readonly<Record<string, string>>;\nexport default messages;\n`;
}

export function renderLoadersModule(tags: readonly string[]): string {
  const lines = tags.map((tag) => `  ${JSON.stringify(tag)}: () => import('./${tag}.js'),`);
  return `${BANNER}export const loaders = {\n${lines.join('\n')}\n};\n`;
}

export function renderLoadersDeclaration(): string {
  return (
    `${BANNER}export declare const loaders: Readonly<\n` +
    `  Record<string, () => Promise<{readonly default: Readonly<Record<string, string>>}>>\n` +
    `>;\n`
  );
}

export function renderAliasesModule(tags: readonly string[]): string {
  return (
    `${BANNER}/** Catalog tags shipped as \`<tag>.js\` (30 upstream catalogs). */\n` +
    `export const tags = ${JSON.stringify(tags)};\n` +
    `/** The generated pseudo-locale tag (\`pseudo.js\`). */\n` +
    `export const pseudoTag = ${JSON.stringify(PSEUDO_TAG)};\n` +
    `/** Base-tag aliases: requested tag (case-insensitive) to a shipped tag. */\n` +
    `export const aliases = ${JSON.stringify(ALIASES, null, 2)};\n`
  );
}

export function renderAliasesDeclaration(): string {
  return (
    `${BANNER}export declare const tags: readonly string[];\n` +
    `export declare const pseudoTag: string;\n` +
    `export declare const aliases: Readonly<Record<string, string>>;\n`
  );
}

/** Checks every alias target exists; returns the offending aliases. */
export function invalidAliases(tags: readonly string[]): string[] {
  const known = new Set([...tags, PSEUDO_TAG]);
  return Object.entries(ALIASES)
    .filter(([, target]) => !known.has(target))
    .map(([alias, target]) => `${alias} -> ${target}`);
}
