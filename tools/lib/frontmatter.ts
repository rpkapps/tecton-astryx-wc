/**
 * Frontmatter reader for `<folder>.docs.md` (CONVENTIONS §7). No YAML library is approved (D-007), so
 * this parses the small YAML subset the conventions use:
 *
 *  - block mappings and block sequences (indentation), `- key: value` sequence items;
 *  - flow sequences `[a, b]` and flow mappings `{do: true, text: 'x'}`, nested, possibly multi-line;
 *  - plain, single-quoted and double-quoted scalars; booleans, null (`null`, `~`), numbers;
 *  - literal (`|`) and folded (`>`) block scalars;
 *  - `#` comments (at line start or after whitespace, outside quotes).
 *
 * Anything else (anchors, tags, merge keys, multi-document streams) throws a clear error so authors
 * stay within the subset instead of silently getting different data.
 */

export interface Frontmatter {
  data: Record<string, unknown>;
  /** Markdown after the closing `---`. */
  body: string;
}

/** Returns null when the text has no leading `---` frontmatter block. */
export function readFrontmatter(text: string): Frontmatter | null {
  const normalized = text.replace(/\r\n?/g, '\n');
  if (!normalized.startsWith('---\n')) return null;
  const end = normalized.indexOf('\n---', 4);
  if (end === -1) throw new Error('frontmatter: missing closing "---"');
  const after = normalized.slice(end + 4);
  if (after !== '' && !after.startsWith('\n'))
    throw new Error('frontmatter: closing "---" must be on its own line');
  const parsed = parseYamlSubset(normalized.slice(4, end));
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('frontmatter: must be a mapping');
  }
  return {data: parsed as Record<string, unknown>, body: after.replace(/^\n/, '')};
}

interface Line {
  indent: number;
  text: string;
  no: number;
}

function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quote) {
      if (quote === '"' && ch === '\\') i++;
      else if (ch === quote) {
        if (quote === "'" && line[i + 1] === "'") i++;
        else quote = null;
      }
    } else if (ch === '"' || ch === "'") {
      // A quote only opens a string at the start of a scalar (after `:`, `[`, `{`, `,`, `- ` or line start).
      const before = line.slice(0, i).trimEnd();
      if (before === '' || /[:[{,-]$/.test(before)) quote = ch;
    } else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]!))) {
      return line.slice(0, i).trimEnd();
    }
  }
  return line.trimEnd();
}

export function parseYamlSubset(source: string): unknown {
  const raw = source.replace(/\r\n?/g, '\n').split('\n');
  const lines: Line[] = [];
  raw.forEach((line, index) => {
    if (line.startsWith('\t'))
      throw new Error(`frontmatter line ${index + 1}: tabs are not allowed for indentation`);
    const text = stripComment(line);
    if (text.trim() === '') return;
    lines.push({indent: text.length - text.trimStart().length, text: text.trim(), no: index + 1});
  });
  // Block scalars keep their raw lines, so they are read from `raw` by line number.
  let pos = 0;

  const fail = (line: Line, message: string): never => {
    throw new Error(`frontmatter line ${line.no}: ${message}`);
  };

  const balanced = (text: string): boolean => {
    let depth = 0;
    let quote: string | null = null;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!;
      if (quote) {
        if (quote === '"' && ch === '\\') i++;
        else if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') depth--;
    }
    return depth <= 0;
  };

  function parseBlock(indent: number): unknown {
    const first = lines[pos];
    if (!first) return null;
    return first.text === '-' || first.text.startsWith('- ')
      ? parseSequence(indent)
      : parseMapping(indent);
  }

  function parseSequence(indent: number): unknown[] {
    const items: unknown[] = [];
    while (pos < lines.length) {
      const line = lines[pos]!;
      if (line.indent !== indent || !(line.text === '-' || line.text.startsWith('- '))) break;
      const rest = line.text.slice(1).trim();
      if (rest === '') {
        pos++;
        const next = lines[pos];
        items.push(next && next.indent > indent ? parseBlock(next.indent) : null);
      } else if (
        /^(?:[A-Za-z0-9_$.-]+|"[^"]*"|'[^']*')\s*:(?:\s|$)/.test(rest) &&
        !/^[[{]/.test(rest)
      ) {
        // `- key: value` starts a mapping whose keys align with `key`.
        const inner = indent + (line.text.length - line.text.slice(1).trimStart().length);
        lines[pos] = {indent: inner, text: rest, no: line.no};
        items.push(parseMapping(inner));
      } else {
        pos++;
        items.push(parseInline(collectFlow(rest, line), line));
      }
    }
    return items;
  }

  /** Joins continuation lines of a multi-line flow collection. */
  function collectFlow(start: string, line: Line): string {
    let text = start;
    if (/^[[{]/.test(text)) {
      while (!balanced(text)) {
        const next = lines[pos];
        if (!next) return fail(line, 'unterminated flow collection');
        text += ` ${next.text}`;
        pos++;
      }
    }
    return text;
  }

  function parseMapping(indent: number): Record<string, unknown> {
    const map: Record<string, unknown> = {};
    while (pos < lines.length) {
      const line = lines[pos]!;
      if (line.indent < indent) break;
      if (line.indent > indent) fail(line, 'unexpected indentation');
      const match = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[A-Za-z0-9_$.-]+)\s*:(?:\s+(.*))?$/.exec(
        line.text,
      );
      if (!match) return fail(line, `cannot read "${line.text}" (expected "key: value")`);
      const keyText = match[1]!;
      const key = /^["']/.test(keyText) ? String(parseScalar(keyText, line)) : keyText;
      if (key in map) fail(line, `duplicate key "${key}"`);
      const value = (match[2] ?? '').trim();
      pos++;
      if (value === '') {
        const next = lines[pos];
        const isSequence = next?.text === '-' || next?.text.startsWith('- ') === true;
        if (next && next.indent > indent) map[key] = parseBlock(next.indent);
        // YAML allows a block sequence at the same indent as its parent key.
        else if (next?.indent === indent && isSequence) map[key] = parseSequence(indent);
        else map[key] = null;
      } else if (/^[|>][+-]?$/.test(value)) {
        map[key] = readBlockScalar(value, line, indent);
      } else {
        map[key] = parseInline(collectFlow(value, line), line);
      }
    }
    return map;
  }

  function readBlockScalar(header: string, line: Line, indent: number): string {
    // Raw lines after the header line, more indented than the key (blank lines included).
    const collected: string[] = [];
    let cursor = line.no; // index in `raw` of the line after the header (line.no is 1-based)
    while (cursor < raw.length) {
      const text = raw[cursor]!;
      if (text.trim() !== '' && text.length - text.trimStart().length <= indent) break;
      collected.push(text);
      cursor++;
    }
    // Skip parsed lines that belong to the scalar.
    while (pos < lines.length && lines[pos]!.no <= cursor) pos++;
    const width = Math.min(
      ...collected
        .filter((text) => text.trim() !== '')
        .map((text) => text.length - text.trimStart().length),
    );
    const body = collected.map((text) =>
      text.trim() === '' ? '' : text.slice(Number.isFinite(width) ? width : 0),
    );
    while (body.length > 0 && body[body.length - 1] === '') body.pop();
    const folded = header.startsWith('>');
    const text = folded
      ? body
          .join('\n')
          .replace(/(?<!\n)\n(?!\n)/g, ' ')
          .replace(/\n\n/g, '\n')
      : body.join('\n');
    return header.endsWith('-') ? text : `${text}\n`;
  }

  // ---- inline values -------------------------------------------------------------------------

  function parseScalar(text: string, line: Line): unknown {
    const value = text.trim();
    if (value.startsWith('"')) {
      try {
        return JSON.parse(value) as string;
      } catch {
        return fail(line, `invalid double-quoted string ${value}`);
      }
    }
    if (value.startsWith("'")) {
      if (!value.endsWith("'") || value.length < 2)
        return fail(line, `unterminated string ${value}`);
      return value.slice(1, -1).replace(/''/g, "'");
    }
    if (/^[&*!]/.test(value))
      return fail(line, `YAML anchors, aliases and tags are not supported ("${value}")`);
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null' || value === '~') return null;
    if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return Number(value);
    return value;
  }

  function parseInline(text: string, line: Line): unknown {
    let i = 0;
    const skip = () => {
      while (i < text.length && /\s/.test(text[i]!)) i++;
    };
    const readQuoted = (): string => {
      const quote = text[i]!;
      const start = i++;
      while (i < text.length) {
        if (quote === '"' && text[i] === '\\') i += 2;
        else if (text[i] === quote) {
          if (quote === "'" && text[i + 1] === "'") i += 2;
          else break;
        } else i++;
      }
      i++;
      return text.slice(start, i);
    };
    const readPlain = (stops: string): string => {
      const start = i;
      while (i < text.length && !stops.includes(text[i]!)) {
        if (
          text[i] === ':' &&
          stops.includes(':') &&
          (i + 1 >= text.length || /[\s,\]}]/.test(text[i + 1]!))
        )
          break;
        i++;
      }
      return text.slice(start, i).trim();
    };
    const parseValue = (stops: string): unknown => {
      skip();
      const ch = text[i];
      if (ch === '[') {
        i++;
        const items: unknown[] = [];
        skip();
        while (i < text.length && text[i] !== ']') {
          items.push(parseValue(',]'));
          skip();
          if (text[i] === ',') i++;
          skip();
        }
        if (text[i] !== ']') return fail(line, 'unterminated [ in flow sequence');
        i++;
        return items;
      }
      if (ch === '{') {
        i++;
        const map: Record<string, unknown> = {};
        skip();
        while (i < text.length && text[i] !== '}') {
          skip();
          const keyText = text[i] === '"' || text[i] === "'" ? readQuoted() : readPlain(':,}');
          skip();
          if (text[i] !== ':') return fail(line, `expected ":" after "${keyText}" in flow mapping`);
          i++;
          const key = /^["']/.test(keyText) ? String(parseScalar(keyText, line)) : keyText;
          if (key in map) fail(line, `duplicate key "${key}"`);
          map[key] = parseValue(',}');
          skip();
          if (text[i] === ',') i++;
          skip();
        }
        if (text[i] !== '}') return fail(line, 'unterminated { in flow mapping');
        i++;
        return map;
      }
      if (ch === '"' || ch === "'") return parseScalar(readQuoted(), line);
      return parseScalar(readPlain(stops), line);
    };

    const value = parseValue('');
    skip();
    if (i < text.length) fail(line, `unexpected "${text.slice(i)}"`);
    return value;
  }

  if (lines.length === 0) return null;
  const result = parseBlock(lines[0]!.indent);
  if (pos < lines.length) fail(lines[pos]!, 'unexpected content');
  return result;
}
