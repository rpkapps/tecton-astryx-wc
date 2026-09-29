/**
 * The controllers and utilities catalog of the agent registry (D-011): what `tct controllers` and the
 * MCP `get` tool answer with. It is derived from the public surface of `@tecton-wc/core`, i.e. the
 * generated barrel `packages/core/src/generated/index.ts`, plus the JSDoc in each source module, so it
 * cannot drift from what the package exports. Values only (no `export type`), events excluded (they are
 * documented on the elements that fire them).
 *
 * Pure and dependency free: it reads files as data (A§2.3).
 */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {walkFiles} from '../lib/fs.ts';

export type ControllerKind = 'controller' | 'context' | 'mixin' | 'class' | 'function' | 'constant';

export interface RegistryController {
  name: string;
  kind: ControllerKind;
  /** Topic area, from the source folder: controllers, layer, context, i18n, icons, forms, ... */
  area: string;
  /** Import specifier, e.g. `@tecton-wc/core/controllers/media-query.js`. */
  import: string;
  /** The first sentence of the JSDoc. */
  summary: string;
  /** All JSDoc prose (code fences removed). */
  description: string;
  /** The first fenced code block of the JSDoc, when there is one. */
  example: string;
  /** Constructor or function signature, as written in the source. */
  signature: string;
  /** Public members of a class: `name` or `name(args)` with the JSDoc summary when there is one. */
  members: {name: string; signature: string; summary: string}[];
  /** Component folders whose sources use it. */
  usedBy: string[];
}

interface BarrelExport {
  name: string;
  /** Module path relative to `packages/core/src`, without extension, e.g. `controllers/media-query`. */
  module: string;
}

/** `export {a, b} from '../x/y.js';` lines of the generated core barrel (type exports are skipped). */
export function parseBarrel(text: string): BarrelExport[] {
  const out: BarrelExport[] = [];
  for (const match of text.matchAll(/^export \{([^}]*)\} from '\.\.\/([^']+?)\.js';$/gm)) {
    const module = match[2]!;
    for (const raw of match[1]!.split(',')) {
      const name = raw
        .trim()
        .split(/\s+as\s+/)
        .pop()!
        .trim();
      if (name) out.push({name, module});
    }
  }
  return out;
}

/** Strips the comment decoration and returns the text lines of a JSDoc block. */
function docLines(block: string): string[] {
  return block
    .replace(/^\/\*\*+/, '')
    .replace(/\*+\/$/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, ''));
}

interface ParsedDoc {
  prose: string;
  example: string;
}

/** JSDoc prose before the first block tag, without code fences, plus the first code fence. */
export function parseDoc(block: string | undefined): ParsedDoc {
  if (!block) return {prose: '', example: ''};
  const prose: string[] = [];
  let example = '';
  let fence: string[] | null = null;
  for (const line of docLines(block)) {
    if (/^\s*```/.test(line)) {
      if (fence) {
        if (!example) example = fence.join('\n');
        fence = null;
      } else {
        fence = [];
      }
      continue;
    }
    if (fence) {
      fence.push(line);
      continue;
    }
    if (/^\s*@\w+/.test(line)) break;
    prose.push(line);
  }
  // Paragraphs are unwrapped to one line; list items keep their own line.
  const paragraphs: string[] = [];
  let current = '';
  for (const line of prose) {
    if (line.trim() === '') {
      if (current) paragraphs.push(current);
      current = '';
    } else if (/^\s*(?:[-*]|\d+\.)\s/.test(line)) {
      if (current) paragraphs.push(current);
      current = line.trim();
    } else {
      current = current ? `${current} ${line.trim()}` : line.trim();
    }
  }
  if (current) paragraphs.push(current);
  const text = paragraphs
    .map((paragraph, index) => {
      const item = /^(?:[-*]|\d+\.)\s/.test(paragraph);
      const previousItem = index > 0 && /^(?:[-*]|\d+\.)\s/.test(paragraphs[index - 1]!);
      return `${index === 0 ? '' : item && previousItem ? '\n' : '\n\n'}${paragraph}`;
    })
    .join('')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return {prose: text, example: example.trim()};
}

/**
 * Internal cross-references (architecture sections, review ids, guide ids, the upstream hook a controller
 * replaces) mean nothing to a consumer or an agent: dropped from the public catalog.
 */
export function cleanProse(text: string): string {
  return text
    .replace(/\s*\((?:A§|review\b|upstream\b|WORK-BREAKDOWN)[^)]*\)/g, '')
    .replace(/\s*\[mwg:[^\]]*\]/g, '')
    .replace(/,\s*upstream `[^`]*`/g, '')
    .replace(/:?\s*port of upstream `[^`]*`/g, '')
    .replace(/\s*\((?:MIT|[^)]*Meta Platforms[^)]*)\)/g, '')
    .replace(/\s*\(upstream `[^`]*`\)/g, '')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function firstSentence(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const match = /^.*?[.!?](?=\s|$)/.exec(flat);
  return (match ? match[0] : flat).trim();
}

/** The index just past the parenthesis that closes the one at `open` (a balanced scan, strings aware). */
function closingParen(text: string, open: number): number {
  let depth = 0;
  let quote = '';
  for (let i = open; i < text.length; i++) {
    const ch = text[i]!;
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = '';
    } else if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

const oneLine = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/,?\s+\)/g, ')')
    .trim();

interface Declaration {
  kind: 'class' | 'function' | 'const';
  doc: string | undefined;
  signature: string;
  /** Class body text (between the outer braces) for member extraction. */
  body: string;
  extendsName: string;
}

/** Finds `export ... <name>` in a module and its leading JSDoc. */
function findDeclaration(source: string, name: string): Declaration | null {
  const re = new RegExp(
    `^export\\s+(?:declare\\s+)?(?:(abstract\\s+class|class)|(async\\s+function|function)|(?:const|let|var))\\s+${name}\\b`,
    'm',
  );
  const match = re.exec(source);
  if (!match) return null;
  // The JSDoc directly above (only whitespace or decorators between).
  const before = source.slice(0, match.index).trimEnd();
  const doc = before.endsWith('*/') ? before.slice(before.lastIndexOf('/**')) : undefined;
  const kind = match[1] ? 'class' : match[2] ? 'function' : 'const';
  const rest = source.slice(match.index);
  if (kind === 'function') {
    const open = rest.indexOf('(');
    const close = open === -1 ? -1 : closingParen(rest, open);
    let end = close;
    if (close !== -1) {
      // Return type: `: T` up to the body `{` or the end of the declaration.
      const tail = /^\s*(?::\s*([^{;=]+?))?\s*(?:\{|;|$)/m.exec(rest.slice(close));
      end = close + (tail ? tail[0].replace(/\s*[{;]$/, '').length : 0);
    }
    return {
      kind,
      doc,
      signature: oneLine(
        rest.slice(0, end === -1 ? rest.indexOf('\n') : end).replace(/^export\s+/, ''),
      ),
      body: '',
      extendsName: '',
    };
  }
  if (kind === 'class') {
    const head = /^[^{]*\{/.exec(rest);
    const extendsName =
      /extends\s+([A-Za-z0-9_$.]+(?:\([^)]*\))?)/.exec(head?.[0] ?? '')?.[1] ?? '';
    let depth = 0;
    let end = -1;
    const start = head ? head[0].length - 1 : 0;
    let quote = '';
    for (let i = start; i < rest.length; i++) {
      const ch = rest[i]!;
      if (quote) {
        if (ch === quote && rest[i - 1] !== '\\') quote = '';
      } else if (ch === '"' || ch === "'" || ch === '`') quote = ch;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const body = end === -1 ? '' : rest.slice(start + 1, end);
    const ctor = /^\s{2}constructor\s*\(/m.exec(body);
    let signature = '';
    if (ctor) {
      const open = body.indexOf('(', ctor.index);
      const close = closingParen(body, open);
      if (close !== -1) signature = oneLine(`new ${name}${body.slice(open, close)}`);
    }
    return {kind, doc, signature, body, extendsName};
  }
  const line = rest.slice(0, !rest.includes('\n') ? undefined : rest.indexOf('\n'));
  return {
    kind,
    doc,
    signature: oneLine(line.replace(/^export\s+/, '').replace(/\s*[=;{(].*$/, '')),
    body: '',
    extendsName: '',
  };
}

/** Public members of a class body: two-space-indented methods, getters and fields, not private/internal. */
function classMembers(body: string): RegistryController['members'] {
  const members: RegistryController['members'] = [];
  const seen = new Set<string>();
  const lines = body.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const match =
      /^ {2}(?:(?:public|static|async|readonly|override|get|set)\s+)*([A-Za-z][A-Za-z0-9_$]*)\s*(?:(\()|[?!]?\s*[:=;])/.exec(
        line,
      );
    if (!match || /^\s{2}(?:private|protected)\b/.test(line)) continue;
    const name = match[1]!;
    if (
      name === 'constructor' ||
      name.startsWith('_') ||
      seen.has(name) ||
      /^host(?:Connected|Disconnected|Update|Updated)$/.test(name)
    )
      continue;
    // JSDoc above (walk back over blank lines).
    let cursor = index - 1;
    while (cursor >= 0 && lines[cursor]!.trim() === '') cursor--;
    let doc = '';
    if (cursor >= 0 && lines[cursor]!.trim().endsWith('*/')) {
      const end = cursor;
      while (cursor >= 0 && !lines[cursor]!.includes('/**')) cursor--;
      doc = lines
        .slice(Math.max(cursor, 0), end + 1)
        .join('\n')
        .trim();
    }
    if (/@internal\b/.test(doc)) continue;
    let signature = name;
    const isAccessor = /^ {2}(?:(?:public|static|override)\s+)*(?:get|set)\s/.test(line);
    if (match[2] && !isAccessor) {
      const joined = lines.slice(index, index + 8).join('\n');
      const close = closingParen(joined, joined.indexOf('(', line.indexOf(name)));
      if (close !== -1) signature = oneLine(joined.slice(joined.indexOf(name), close));
    }
    seen.add(name);
    members.push({name, signature, summary: firstSentence(cleanProse(parseDoc(doc).prose))});
  }
  return members;
}

const AREA_KIND: Record<string, string> = {
  controllers: 'controllers',
  layer: 'layer',
  context: 'context',
  mixins: 'mixins',
  i18n: 'i18n',
  icons: 'icons',
  indicators: 'indicators',
  forms: 'forms',
  a11y: 'a11y',
  theme: 'theme',
  security: 'security',
  styles: 'styles',
  utils: 'utils',
};

function areaOf(module: string): string {
  const folder = module.split('/')[0]!;
  return AREA_KIND[folder] ?? 'core';
}

function kindOf(name: string, declaration: Declaration): ControllerKind {
  if (declaration.kind === 'class') {
    if (name.endsWith('Controller')) return 'controller';
    if (name.endsWith('Mixin')) return 'mixin';
    return 'class';
  }
  if (declaration.kind === 'function') return name.endsWith('Mixin') ? 'mixin' : 'function';
  return name.endsWith('Context') ? 'context' : 'constant';
}

export interface ControllerInputs {
  coreSrc: string;
  componentsSrc: string;
  folders: readonly string[];
}

/** Modules whose exports are covered elsewhere (events belong to the elements that fire them). */
const SKIPPED_MODULES = /^(?:events|tct-element|provider-element|define)(?:\/|$)/;

export function extractControllers(inputs: ControllerInputs): RegistryController[] {
  const barrel = join(inputs.coreSrc, 'generated/index.ts');
  if (!existsSync(barrel)) return [];
  const exports = parseBarrel(readFileSync(barrel, 'utf8')).filter(
    (entry) => !SKIPPED_MODULES.test(entry.module),
  );

  // Component sources, once, for the usage index.
  const componentText = new Map<string, string>();
  for (const folder of inputs.folders) {
    const files = walkFiles(join(inputs.componentsSrc, folder), {
      skipDirs: ['examples', '__snapshots__', 'fixtures'],
    }).filter((file) => file.endsWith('.ts') && !/\.(?:node\.)?test\.ts$/.test(file));
    componentText.set(folder, files.map((file) => readFileSync(file, 'utf8')).join('\n'));
  }

  const sources = new Map<string, string>();
  const controllers: RegistryController[] = [];
  for (const entry of exports) {
    const path = join(inputs.coreSrc, `${entry.module}.ts`);
    if (!existsSync(path)) continue;
    let source = sources.get(path);
    if (source === undefined) {
      source = readFileSync(path, 'utf8');
      sources.set(path, source);
    }
    const declaration = findDeclaration(source, entry.name);
    if (!declaration) continue;
    // A declaration without its own JSDoc falls back to the module's leading comment.
    const leading = /^\s*\/\*\*[\s\S]*?\*\//.exec(source)?.[0];
    const own = parseDoc(declaration.doc);
    // A pointer ("See the module documentation.") or, for classes and constants, no JSDoc at all: the
    // module's leading comment describes it.
    const usesModuleDoc =
      /^See the module/i.test(own.prose) ||
      (!own.prose && (declaration.kind === 'class' || declaration.kind === 'const'));
    const parsed = usesModuleDoc ? parseDoc(leading) : own;
    // Undocumented exports are internal plumbing (CONVENTIONS §4: undocumented means missing).
    if (!parsed.prose) continue;
    parsed.prose = cleanProse(parsed.prose);
    const kind = kindOf(entry.name, declaration);
    const word = new RegExp(`\\b${entry.name.replace(/[$]/g, '\\$')}\\b`);
    controllers.push({
      name: entry.name,
      kind,
      area: areaOf(entry.module),
      import: `@tecton-wc/core/${entry.module}.js`,
      summary: firstSentence(parsed.prose),
      description: parsed.prose,
      example: parsed.example,
      signature: declaration.signature,
      members: declaration.kind === 'class' ? classMembers(declaration.body) : [],
      usedBy: inputs.folders.filter((folder) => word.test(componentText.get(folder) ?? '')),
    });
  }
  controllers.sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
  return controllers;
}
