/**
 * Plain-text helpers: edit distance and the human-output formatters.
 *
 * Human output is a projection of the `--json` data: `record`/`records` print `key: value` lines whose
 * names are the JSON keys, so every field is greppable (`tct search button | grep '^command:'`) and the
 * two views stay in step. ASCII only, no colour, fixed wrap width: byte-for-byte deterministic whether
 * printed or piped to an agent.
 */

export const WRAP_WIDTH = 120;

/** Levenshtein distance (two-row). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({length: b.length + 1}, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** The candidates closest to `input`: a contained name counts as distance 1. */
export function closest(input: string, candidates: readonly string[], max = 4): string[] {
  const lower = input.toLowerCase();
  return candidates
    .map((name) => {
      const candidate = name.toLowerCase();
      const contains =
        lower.length >= 3 &&
        candidate.length >= 3 &&
        (candidate.includes(lower) || lower.includes(candidate));
      const distance = levenshtein(lower, candidate);
      return {name, distance: contains ? Math.min(distance, 1) : distance};
    })
    .filter((entry) => entry.distance <= Math.max(2, Math.floor(input.length / 3)))
    .sort((a, b) => a.distance - b.distance || (a.name < b.name ? -1 : 1))
    .slice(0, max)
    .map((entry) => entry.name);
}

/** Non-ASCII typography to ASCII, so human output stays plain whatever the source data contains. */
export function toAscii(text: string): string {
  return text
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/ /g, ' ');
}

/** Word-wraps at `width`, keeping the text's own line breaks; a word longer than the width stays whole. */
export function wrapText(input: string, width = WRAP_WIDTH, indent = ''): string {
  return input
    .split('\n')
    .map((line) => wrapLine(line, width, indent))
    .join('\n');
}

function wrapLine(line: string, width: number, indent: string): string {
  if (line.length <= width) return line;
  const lead = /^\s*/.exec(line)?.[0] ?? '';
  const words = line.slice(lead.length).split(' ');
  const out: string[] = [];
  let current = lead;
  for (const word of words) {
    const joined = current.trim() === '' ? current + word : `${current} ${word}`;
    if (joined.length > width && current.trim() !== '') {
      out.push(current);
      current = indent + word;
    } else {
      current = joined;
    }
  }
  out.push(current);
  return out.join('\n');
}

const isEmpty = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

const renderValue = (value: unknown): string =>
  Array.isArray(value) ? value.map(String).join(', ') : String(value);

export interface RecordOptions {
  /** Keys to show, in order; missing or empty keys are skipped. Defaults to the object's own keys. */
  fields?: readonly string[];
  format?: Record<string, (value: never) => string>;
  /** `inline`: one record per line, the first field in a padded column and the rest joined by ` - `. */
  layout?: 'stacked' | 'inline';
}

/** Aligned `key: value` lines, one per non-empty field. */
export function record(object: object, options: RecordOptions = {}): string {
  const source = object as Record<string, unknown>;
  const keys = (options.fields ?? Object.keys(source)).filter((key) => !isEmpty(source[key]));
  const width = keys.reduce((max, key) => Math.max(max, key.length), 0);
  return toAscii(
    keys
      .map((key) => {
        const format = options.format?.[key] as ((value: unknown) => string) | undefined;
        const value = format ? format(source[key]) : renderValue(source[key]);
        return `${`${key}:`.padEnd(width + 2)}${value}`;
      })
      .join('\n'),
  );
}

/** One {@link record} per item, separated by a blank line. */
export function records(items: readonly object[], options: RecordOptions = {}): string {
  if (options.layout === 'inline') {
    const [lead, ...rest] = options.fields ?? Object.keys(items[0] ?? {});
    if (lead === undefined) return '';
    const cells = items.map((item) => {
      const source = item as Record<string, unknown>;
      return {
        lead: isEmpty(source[lead]) ? '' : renderValue(source[lead]),
        tail: rest
          .filter((key) => !isEmpty(source[key]))
          .map((key) => renderValue(source[key]))
          .join(' - '),
      };
    });
    const column = Math.min(Math.max(0, ...cells.map((cell) => cell.lead.length)), 32);
    return toAscii(
      cells
        .map((cell) => (cell.tail ? `${cell.lead.padEnd(column)}  ${cell.tail}` : cell.lead))
        .join('\n'),
    );
  }
  return items
    .map((item) => record(item, options))
    .filter(Boolean)
    .join('\n\n');
}

/** A `- item` list. */
export function list(items: readonly string[]): string {
  return toAscii(items.map((item) => `- ${item}`).join('\n'));
}

/** Blank-line-joined blocks; empty blocks are dropped. */
export function blocks(...parts: (string | false | null | undefined)[]): string {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join('\n\n');
}

/** A heading with an optional subtitle directly beneath it. */
export function section(heading: string, subtitle?: string): string {
  return toAscii(subtitle ? `${heading}\n${subtitle}` : heading);
}

/** First sentence of a text (used for one-line summaries). */
export function firstSentence(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const match = /^.*?[.!?](?=\s|$)/.exec(flat);
  return (match ? match[0] : flat).trim();
}

/** Cuts to `max` characters with an ellipsis. */
export function truncate(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, Math.max(0, max - 3)).trimEnd()}...`;
}
