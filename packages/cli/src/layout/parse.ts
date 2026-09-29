/**
 * Layout expression parser: two surfaces, one AST.
 *
 * Compact:  V[gap=4] > (Tx"Title" + H[gap=2] > (B.primary"Save" + B"Cancel"))
 * Outline:  indentation for nesting, `slot:` lines, `repeat N:` blocks.
 *
 * Both surfaces produce the same AST and share the attribute-token grammar, so the validator and the
 * expander never know which dialect the author wrote. Whitespace is insignificant in compact form; `^`
 * (climb up) is rejected with a correction (groups are the documented way). Pure: no I/O, no registry.
 */
import type {
  Attr,
  Hint,
  LayoutDoc,
  LayoutGroup,
  LayoutItem,
  LayoutNode,
  LayoutValue,
  Slot,
  SlotValue,
} from './ast.ts';

export class LayoutParseError extends Error {
  readonly line: number;
  readonly col: number;

  constructor(message: string, line: number, col: number) {
    super(message);
    this.name = 'LayoutParseError';
    this.line = line;
    this.col = col;
  }
}

/** Keys that expand to full attribute names before validation. */
export const KEY_ALIASES: Record<string, string> = {
  p: 'padding',
  pad: 'padding',
  g: 'gap',
  c: 'columns',
  cols: 'columns',
  w: 'width',
  h: 'height',
  mw: 'max-width',
  mh: 'min-height',
  rg: 'row-gap',
  cg: 'column-gap',
  t: 'type',
  sz: 'size',
  v: 'variant',
  dir: 'direction',
  dv: 'dividers',
  // Axis-neutral alignment: resolved per element in the validator.
  j: '__mainAxis',
  a: '__crossAxis',
  justify: '__mainAxis',
  align: '__crossAxis',
};

/** Fused shorthand letters (`p6`, `g4`, `mw960`): the letters must be a key alias. */
const FUSED = new Set(['p', 'g', 'c', 'w', 'h', 'mw', 'mh', 'rg', 'cg']);

export function makeNode(name: string | null, line: number, col: number): LayoutNode {
  return {
    kind: 'node',
    name,
    id: null,
    enumMods: [],
    payload: null,
    payload2: null,
    attrs: [],
    slots: [],
    hint: null,
    repeat: null,
    selected: false,
    children: [],
    line,
    col,
  };
}

const makeGroup = (line: number, col: number): LayoutGroup => ({
  kind: 'group',
  repeat: null,
  children: [],
  line,
  col,
});

const isIdentStart = (ch: string | undefined): boolean => ch !== undefined && /[A-Za-z]/.test(ch);
const isIdent = (ch: string | undefined): boolean => ch !== undefined && /[A-Za-z0-9_-]/.test(ch);

/** Splits at depth-0 whitespace, where (), [], {} and quotes raise depth. */
function tokenize(text: string, line: number, startCol: number): {text: string; col: number}[] {
  const tokens: {text: string; col: number}[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i]!)) i++;
    if (i >= text.length) break;
    const start = i;
    let depth = 0;
    let quote: string | null = null;
    while (i < text.length) {
      const ch = text[i]!;
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") quote = ch;
      else if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) depth--;
      else if (/\s/.test(ch) && depth === 0) break;
      i++;
    }
    if (quote)
      throw new LayoutParseError(`Unterminated ${quote} string`, line, startCol + start + 1);
    if (depth > 0)
      throw new LayoutParseError(
        'Unbalanced brackets in attribute list',
        line,
        startCol + start + 1,
      );
    tokens.push({text: text.slice(start, i), col: startCol + start + 1});
  }
  return tokens;
}

const MAX_VALUE_DEPTH = 64;

/** A scalar, object or list attribute value. */
export function parseValue(raw: string, depth = 0): LayoutValue {
  if (depth > MAX_VALUE_DEPTH) {
    throw new LayoutParseError(
      `Attribute value nested too deeply (limit ${MAX_VALUE_DEPTH})`,
      0,
      0,
    );
  }
  const s = raw.trim();
  if (/^(['"]).*\1$/.test(s)) return s.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s.startsWith('#')) return {idref: s.slice(1)};
  if (s.startsWith('{') && s.endsWith('}')) {
    const object: Record<string, LayoutValue> = {};
    for (const part of splitTop(s.slice(1, -1), ',')) {
      const index = part.indexOf(':');
      if (index === -1) object[part.trim()] = true;
      else object[part.slice(0, index).trim()] = parseValue(part.slice(index + 1), depth + 1);
    }
    return object;
  }
  if (s.startsWith('[') && s.endsWith(']'))
    return splitTop(s.slice(1, -1), ',').map((v) => parseValue(v, depth + 1));
  if (s.includes(',')) return splitTop(s, ',').map((v) => parseValue(v, depth + 1));
  return s; // a bare word: an enum string
}

/** Splits on a separator at bracket and quote depth 0. */
function splitTop(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if ('([{'.includes(ch)) {
      depth++;
      current += ch;
    } else if (')]}'.includes(ch)) {
      depth--;
      current += ch;
    } else if (ch === separator && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim() !== '') parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** `{name +flag +flag2 :arg}` (braces removed). */
function parseHintBody(body: string, line: number, col: number): Hint {
  const match = /^([a-z0-9][a-z0-9-]*)((?:\s*\+[a-z0-9-]+)*)(?:\s*:(.*))?$/.exec(body.trim());
  if (!match) {
    throw new LayoutParseError(
      `'{${body}}' is not an element reference: braces take a kebab-case element name (e.g. {kpi-card}); ` +
        `for text use a quoted payload: Tx"${body}"`,
      line,
      col,
    );
  }
  return {
    name: match[1]!,
    flags: (match[2] ?? '')
      .split('+')
      .map((flag) => flag.trim())
      .filter(Boolean),
    arg: match[3] !== undefined ? match[3].trim() : null,
  };
}

/** Parses the text of a group or a slot value; anything left over is a located syntax error. */
function parseSubExpression(text: string, line: number, col: number): LayoutItem[] {
  const stream = new CompactStream(text, line, col);
  const items = parseCompactSiblings(stream);
  stream.skipWs();
  if (!stream.eof()) stream.error(`Unexpected '${stream.peek()}'`);
  return items;
}

/** One attribute token: an attribute record or a slot record. */
function parseAttrToken(token: {text: string; col: number}, line: number): Attr | Slot {
  const {text, col} = token;

  if (text.startsWith('@')) {
    const equals = text.indexOf('=');
    if (equals === -1) return {kind: 'slot', key: text.slice(1), value: null, line, col};
    const name = text.slice(1, equals);
    const rest = text.slice(equals + 1);
    let value: SlotValue;
    if (rest.startsWith('(') && rest.endsWith(')')) {
      value = {subexpr: parseSubExpression(rest.slice(1, -1), line, col + equals + 2)};
    } else if (/^(['"]).*\1$/.test(rest)) {
      value = rest.slice(1, -1);
    } else if (rest.startsWith('{') && rest.endsWith('}')) {
      value = {hint: parseHintBody(rest.slice(1, -1), line, col)};
    } else if (rest.startsWith('#')) {
      value = {idref: rest.slice(1)};
    } else {
      value = {subexpr: parseSubExpression(rest, line, col + equals + 2)};
    }
    return {kind: 'slot', key: name, value, line, col};
  }

  if (text.startsWith('!') && text.length > 1) return {kind: 'neg', key: text.slice(1), line, col};

  // key=value, split at the first depth-0 '='
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === '=' && depth === 0) {
      const rawKey = text.slice(0, i);
      if (!/^[A-Za-z][A-Za-z0-9.-]*$/.test(rawKey)) {
        throw new LayoutParseError(`Invalid attribute key '${rawKey}'`, line, col);
      }
      return {kind: 'kv', key: rawKey, value: parseValue(text.slice(i + 1)), raw: text, line, col};
    }
  }

  // fused shorthand: letters + number (p6, g0.5)
  const fused = /^([a-z]{1,2})(\d+(?:\.\d+)?)$/.exec(text);
  if (fused && FUSED.has(fused[1]!)) {
    return {kind: 'kv', key: fused[1]!, value: Number(fused[2]), raw: text, line, col};
  }
  // fused object: letters + {...} (c{min:340})
  const fusedObject = /^([a-z]{1,2})(\{.*\})$/.exec(text);
  if (fusedObject && FUSED.has(fusedObject[1]!)) {
    return {
      kind: 'kv',
      key: fusedObject[1]!,
      value: parseValue(fusedObject[2]!),
      raw: text,
      line,
      col,
    };
  }
  if (/^[A-Za-z][A-Za-z0-9-]*$/.test(text)) return {kind: 'flag', key: text, line, col};
  throw new LayoutParseError(`Cannot parse attribute '${text}'`, line, col);
}

// ─── compact surface ──────────────────────────────────────────────────────

/**
 * A layout tree this deep is never hand-authored. Without a cap the recursive descent blows the call stack
 * and surfaces a raw RangeError instead of a located parse error.
 */
const MAX_COMPACT_DEPTH = 512;
let compactDepth = 0;

class CompactStream {
  readonly src: string;
  i = 0;
  private readonly baseLine: number;
  private readonly baseCol: number;

  constructor(src: string, line = 1, col = 1) {
    this.src = src;
    this.baseLine = line;
    this.baseCol = col;
  }

  pos(): {line: number; col: number} {
    const lines = this.src.slice(0, this.i).split('\n');
    return {
      line: this.baseLine + lines.length - 1,
      col: (lines.length === 1 ? this.baseCol : 1) + lines[lines.length - 1]!.length,
    };
  }

  peek(offset = 0): string | undefined {
    return this.src[this.i + offset];
  }

  next(): string {
    return this.src[this.i++]!;
  }

  eof(): boolean {
    return this.i >= this.src.length;
  }

  skipWs(): void {
    while (!this.eof() && /\s/.test(this.peek()!)) this.i++;
  }

  error(message: string): never {
    const {line, col} = this.pos();
    throw new LayoutParseError(message, line, col);
  }

  /** Consumes through the matching close bracket and returns the inner text. */
  readBalanced(open: string, close: string): string {
    const startPos = this.pos();
    if (this.peek() !== open) this.error(`Expected '${open}'`);
    this.next();
    const start = this.i;
    let depth = 1;
    let quote: string | null = null;
    while (!this.eof()) {
      const ch = this.next();
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === open && open !== close) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return this.src.slice(start, this.i - 1);
      }
    }
    throw new LayoutParseError(`Unclosed '${open}'`, startPos.line, startPos.col);
  }

  readString(): string {
    const quote = this.next();
    const start = this.i;
    while (!this.eof() && this.peek() !== quote) this.next();
    if (this.eof()) this.error('Unterminated string');
    const text = this.src.slice(start, this.i);
    this.next();
    return text;
  }
}

function parseCompactNode(s: CompactStream): LayoutNode {
  const {line, col} = s.pos();
  let name = '';
  // A term may start with `{element}`: an anonymous reference with no wrapping element.
  if (s.peek() !== '{') {
    if (!isIdentStart(s.peek()))
      s.error(`Expected an element name, found '${s.peek() ?? 'end of input'}'`);
    while (
      !s.eof() &&
      (/[A-Za-z0-9]/.test(s.peek()!) || (s.peek() === '-' && /[A-Za-z0-9]/.test(s.peek(1) ?? '')))
    ) {
      name += s.next();
    }
  }
  const node = makeNode(name || null, line, col);

  // postfix pieces in any sensible order: #id .mod "payload" [attrs] {hint} *N !
  for (;;) {
    const ch = s.peek();
    if (ch === '#') {
      s.next();
      let id = '';
      while (!s.eof() && isIdent(s.peek())) id += s.next();
      if (!id) s.error('Expected an id after #');
      node.id = id;
    } else if (ch === '.') {
      s.next();
      let mod = '';
      while (!s.eof() && /[a-z0-9-]/.test(s.peek()!)) mod += s.next();
      if (!mod) s.error("Expected an enum value after '.'");
      node.enumMods.push(mod);
    } else if (ch === '"' || ch === "'") {
      const text = s.readString();
      if (node.payload === null) node.payload = text;
      else node.payload2 = text;
    } else if (ch === ':' && (s.peek(1) === '"' || s.peek(1) === "'")) {
      s.next();
      node.payload2 = s.readString();
    } else if (ch === '[') {
      const {line: attrLine} = s.pos();
      const body = s.readBalanced('[', ']');
      for (const token of tokenize(body, attrLine, 0)) {
        const attr = parseAttrToken(token, attrLine);
        if (attr.kind === 'slot') node.slots.push(attr);
        else node.attrs.push(attr);
      }
    } else if (ch === '{') {
      const {line: hintLine, col: hintCol} = s.pos();
      node.hint = parseHintBody(s.readBalanced('{', '}'), hintLine, hintCol);
    } else if (ch === '*') {
      s.next();
      let n = '';
      while (!s.eof() && /\d/.test(s.peek()!)) n += s.next();
      if (!n) s.error("Expected a count after '*'");
      node.repeat = Number(n);
    } else if (ch === '!') {
      s.next();
      node.selected = true;
    } else {
      break;
    }
  }

  s.skipWs();
  if (s.peek() === '>') {
    s.next();
    node.children = parseCompactSiblings(s);
    if (node.children.length === 0) s.error("Expected an element after '>'");
  }
  return node;
}

const cloneItem = <T extends LayoutItem>(item: T): T => JSON.parse(JSON.stringify(item)) as T;

function parseCompactTerm(s: CompactStream): LayoutItem {
  s.skipWs();
  if (s.peek() === '(') {
    const {line, col} = s.pos();
    const body = s.readBalanced('(', ')');
    const group = makeGroup(line, col);
    group.children = parseSubExpression(body, line, col + 1);
    s.skipWs();
    if (s.peek() === '*') {
      s.next();
      let n = '';
      while (!s.eof() && /\d/.test(s.peek()!)) n += s.next();
      if (!n) s.error("Expected a count after '*'");
      group.repeat = Number(n);
    }
    s.skipWs();
    if (s.peek() === '>') {
      s.next();
      const children = parseCompactSiblings(s);
      for (const child of group.children) {
        if (child.kind === 'node') child.children.push(...children.map((each) => cloneItem(each)));
      }
    }
    return group;
  }
  return parseCompactNode(s);
}

function parseCompactSiblings(s: CompactStream): LayoutItem[] {
  if (++compactDepth > MAX_COMPACT_DEPTH) {
    compactDepth--;
    s.error(`Layout is nested too deeply (limit ${MAX_COMPACT_DEPTH}); flatten the tree`);
  }
  try {
    const terms: LayoutItem[] = [];
    for (;;) {
      s.skipWs();
      if (s.eof()) break;
      if (s.peek() === '^')
        s.error("'^' climb-up is not supported: group siblings with (...) instead");
      terms.push(parseCompactTerm(s));
      s.skipWs();
      if (s.peek() === '^')
        s.error("'^' climb-up is not supported: group siblings with (...) instead");
      if (s.peek() === '+') {
        s.next();
        s.skipWs();
        if (s.eof() || s.peek() === ')') s.error("Expected an element after '+'");
        continue;
      }
      break;
    }
    return terms;
  } finally {
    compactDepth--;
  }
}

export function parseCompact(source: string): LayoutDoc {
  compactDepth = 0;
  const parts = source.split(/;;/);
  const main = new CompactStream(parts[0]!);
  const roots = parseCompactSiblings(main);
  main.skipWs();
  if (!main.eof()) main.error(`Unexpected '${main.peek()}'`);
  const overlays: LayoutItem[] = [];
  for (const part of parts.slice(1)) {
    const s = new CompactStream(part);
    overlays.push(...parseCompactSiblings(s));
    s.skipWs();
    if (!s.eof()) s.error(`Unexpected '${s.peek()}'`);
  }
  return {roots, overlays, form: 'compact'};
}

// ─── outline surface ──────────────────────────────────────────────────────

/** One outline line's node chain: `Card > VStack gap=4 !scroll`. */
function parseOutlineChain(text: string, line: number): {head: LayoutNode; tail: LayoutNode} {
  let head: LayoutNode | null = null;
  let tail: LayoutNode | null = null;
  for (const segment of splitTop(text, '>')) {
    const node = parseOutlineNodeSegment(segment, line);
    if (!head) head = node;
    else tail!.children.push(node);
    tail = node;
  }
  return {head: head!, tail: tail!};
}

function parseOutlineNodeSegment(segment: string, line: number): LayoutNode {
  const tokens = tokenize(segment, line, 0);
  if (tokens.length === 0) throw new LayoutParseError('Empty node', line, 1);
  const first = tokens[0]!;
  // An anonymous element reference: a line that starts with `{element}`.
  if (first.text.startsWith('{') && first.text.endsWith('}')) {
    const node = makeNode(null, line, first.col);
    node.hint = parseHintBody(first.text.slice(1, -1), line, first.col);
    for (const token of tokens.slice(1)) {
      if (/^[x*]\d+$/.test(token.text)) node.repeat = Number(token.text.slice(1));
    }
    return node;
  }
  const match = /^([A-Za-z][A-Za-z0-9-]*)(#[A-Za-z0-9_-]+)?((?:\.[a-z0-9-]+)*)$/.exec(first.text);
  if (!match)
    throw new LayoutParseError(`Expected an element name, found '${first.text}'`, line, first.col);
  const node = makeNode(match[1]!, line, first.col);
  if (match[2]) node.id = match[2].slice(1);
  if (match[3]) node.enumMods = match[3].split('.').filter(Boolean);

  for (const token of tokens.slice(1)) {
    const t = token.text;
    if (/^(['"]).*\1$/.test(t)) {
      if (node.payload === null) node.payload = t.slice(1, -1);
      else node.payload2 = t.slice(1, -1);
    } else if (/^:(['"]).*\1$/.test(t)) {
      node.payload2 = t.slice(2, -1);
    } else if (/^[x*]\d+$/.test(t)) {
      node.repeat = Number(t.slice(1));
    } else if (t === '!') {
      node.selected = true;
    } else if (t.startsWith('{') && t.endsWith('}')) {
      node.hint = parseHintBody(t.slice(1, -1), line, token.col);
    } else {
      const attr = parseAttrToken(token, line);
      if (attr.kind === 'slot') node.slots.push(attr);
      else node.attrs.push(attr);
    }
  }
  return node;
}

interface Frame {
  indent: number;
  container: LayoutItem[];
  node: LayoutNode | null;
}

export function parseOutline(source: string): LayoutDoc {
  const roots: LayoutItem[] = [];
  const overlays: LayoutItem[] = [];
  const stack: Frame[] = [{indent: -1, container: roots, node: null}];
  let inOverlays = false;

  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index]!;
    const lineNo = index + 1;
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    const indent = (/^[ \t]*/.exec(raw) ?? [''])[0].replace(/\t/g, '  ').length;
    const text = trimmed;

    if (text === 'overlays:') {
      inOverlays = true;
      stack.length = 1;
      continue;
    }

    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) stack.pop();
    const parent = stack[stack.length - 1]!;
    const container = parent === stack[0] && inOverlays ? overlays : parent.container;

    const repeat = /^repeat\s+(\d+):$/.exec(text);
    if (repeat) {
      const group = makeGroup(lineNo, indent + 1);
      group.repeat = Number(repeat[1]);
      container.push(group);
      stack.push({indent, container: group.children, node: null});
      continue;
    }

    // One `.*` capture keeps this linear: the inline value is trimmed in code.
    const slotMatch = /^@?([a-z][A-Za-z0-9]*):(.*)$/.exec(text);
    if (slotMatch && !text.startsWith('http')) {
      if (!parent.node)
        throw new LayoutParseError(
          `Slot '${slotMatch[1]}:' has no parent element`,
          lineNo,
          indent + 1,
        );
      const subexpr: LayoutItem[] = [];
      parent.node.slots.push({
        kind: 'slot',
        key: slotMatch[1]!,
        value: {subexpr},
        line: lineNo,
        col: indent + 1,
      });
      const inline = slotMatch[2]!.trim();
      if (inline) {
        const {head, tail} = parseOutlineChain(inline, lineNo);
        subexpr.push(head);
        stack.push({indent, container: tail.children, node: tail});
      } else {
        stack.push({indent, container: subexpr, node: null});
      }
      continue;
    }

    const {head, tail} = parseOutlineChain(text, lineNo);
    container.push(head);
    stack.push({indent, container: tail.children, node: tail});
  }
  return {roots, overlays, form: 'outline'};
}

// ─── entry points ─────────────────────────────────────────────────────────

/**
 * Which surface the source uses. Multi-line input is outline unless every line break sits inside an
 * operator chain (a trailing `>`/`+`/`;;` or unclosed brackets), which is multi-line compact.
 */
export function detectForm(source: string): 'compact' | 'outline' {
  const lines = source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#') && !line.startsWith('//'));
  if (lines.length <= 1) return 'compact';
  if (lines.some((line) => /^(overlays:|repeat\s+\d+:)/.test(line))) return 'outline';
  for (let i = 0; i < lines.length - 1; i++) {
    const endsOpen = /[>+(]$/.test(lines[i]!) || lines[i]!.endsWith(';;');
    const startsOperator = /^[>+)]/.test(lines[i + 1]!) || lines[i + 1]!.startsWith(';;');
    if (!endsOpen && !startsOperator) return 'outline';
  }
  return 'compact';
}

export function parse(
  source: string,
  options: {form?: 'compact' | 'outline' | 'auto'} = {},
): LayoutDoc {
  const form =
    options.form === undefined || options.form === 'auto' ? detectForm(source) : options.form;
  return form === 'outline' ? parseOutline(source) : parseCompact(source);
}
