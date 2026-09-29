/**
 * MDX helpers for the generated docs pages. Authored sections (`<folder>.docs.md`) are plain
 * Markdown written for humans and agents, but the pages are MDX (they embed components), where `{`,
 * `}` and `<` start expressions and tags. `escapeMdx` makes authored Markdown safe to embed:
 * outside fenced code blocks and `inline code`, `<`, `{` and `}` become HTML entities (so authors write
 * `Remove <label>` or `{value}` freely, at the cost of not being able to use raw HTML or autolinks
 * `<https://…>`; use `[text](url)`), and a paragraph line that would parse as an ESM statement
 * (`import …`, `export …`) is defused.
 */

/** Frontmatter value: a JSON string is valid YAML and needs no further quoting. */
export const yamlString = (value: string): string => JSON.stringify(value);

/** A JSX attribute expression: `{[...]}` from any JSON-serialisable value. */
export const jsxValue = (value: unknown): string => `{${JSON.stringify(value)}}`;

const ENTITIES: Record<string, string> = {'<': '&lt;', '{': '&#123;', '}': '&#125;'};

function escapeText(text: string): string {
  return text.replace(/[<{}]/g, (char) => ENTITIES[char]!);
}

/** Escapes one non-fenced line, leaving inline code spans (any backtick run length) untouched. */
function escapeLine(line: string): string {
  let out = '';
  let index = 0;
  while (index < line.length) {
    const tick = line.indexOf('`', index);
    if (tick === -1) {
      out += escapeText(line.slice(index));
      break;
    }
    out += escapeText(line.slice(index, tick));
    let run = 0;
    while (line[tick + run] === '`') run++;
    const fence = '`'.repeat(run);
    const close = line.indexOf(fence, tick + run);
    if (close === -1) {
      // An unclosed span is literal text.
      out += line.slice(tick);
      break;
    }
    out += line.slice(tick, close + run);
    index = close + run;
  }
  return out;
}

export function escapeMdx(markdown: string): string {
  const out: string[] = [];
  let fence: string | null = null;
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const opener = /^\s*(`{3,}|~{3,})/.exec(line);
    if (opener) {
      if (fence === null) fence = opener[1]!;
      else if (line.trim().startsWith(fence)) fence = null;
      out.push(line);
      continue;
    }
    if (fence !== null) {
      out.push(line);
      continue;
    }
    // MDX reads a line that starts with import/export as ESM.
    const defused = /^\s*(?:import|export)\s/.test(line)
      ? line.replace(/^(\s*)(.)/, (_match, space: string, first: string) => `${space}&#${first.charCodeAt(0)};`)
      : line;
    out.push(escapeLine(defused));
  }
  return out.join('\n');
}
