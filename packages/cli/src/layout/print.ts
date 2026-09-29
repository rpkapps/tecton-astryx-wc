/**
 * Canonical printers: AST to compact or outline text. `tct layout check` echoes both surfaces so either party
 * (agent or human) can work in the one it prefers, and the round trip (parse, print, parse) is a conformance
 * test. Printing is best-effort canonical: spelling variants the lexer normalised come out in canonical form.
 */
import type {Hint, LayoutDoc, LayoutItem, LayoutNode, LayoutValue} from './ast.ts';

/**
 * Quote a string. The lexer has no escape mechanism (a quoted run ends at the next matching delimiter), so
 * the delimiter the string does not contain is chosen; a string with both kinds is unrepresentable and
 * degrades to double quotes.
 */
function quote(text: string): string {
  return text.includes('"') && !text.includes("'") ? `'${text}'` : `"${text}"`;
}

function valueText(value: LayoutValue): string {
  if (typeof value === 'string') return /[\s,'"]/.test(value) ? quote(value) : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map(valueText).join(',')}]`;
  if ('idref' in value && typeof value.idref === 'string') return `#${value.idref}`;
  if ('subexpr' in value || 'hint' in value) return '';
  return `{${Object.entries(value as Record<string, LayoutValue>)
    .map(([key, inner]) => (inner === true ? key : `${key}:${valueText(inner)}`))
    .join(',')}}`;
}

function hintText(hint: Hint): string {
  let out = hint.name;
  for (const flag of hint.flags) out += ` +${flag}`;
  if (hint.arg) out += `:${hint.arg}`;
  return `{${out}}`;
}

function attrTokens(node: LayoutNode): string[] {
  return node.attrs.map((attr) => {
    if (attr.kind === 'kv') return `${attr.key}=${valueText(attr.value)}`;
    if (attr.kind === 'flag') return attr.key;
    return `!${attr.key}`;
  });
}

function slotTokensCompact(node: LayoutNode): string[] {
  return node.slots.map((slot) => {
    const value = slot.value;
    if (value === null) return `@${slot.key}`;
    if (typeof value === 'string') return `@${slot.key}=${quote(value)}`;
    if ('hint' in value) return `@${slot.key}=${hintText(value.hint)}`;
    if ('idref' in value) return `@${slot.key}=#${value.idref}`;
    return `@${slot.key}=(${siblingsCompact(value.subexpr)})`;
  });
}

function nodeCompact(node: LayoutNode): string {
  let out = node.name ?? '';
  if (node.id) out += `#${node.id}`;
  for (const mod of node.enumMods) out += `.${mod}`;
  if (node.payload !== null) out += quote(node.payload);
  if (node.payload2 !== null) out += `:${quote(node.payload2)}`;
  const attrs = [...attrTokens(node), ...slotTokensCompact(node)];
  if (attrs.length > 0) out += `[${attrs.join(' ')}]`;
  if (node.hint) out += hintText(node.hint);
  if (node.selected) out += '!';
  if (node.repeat) out += `*${node.repeat}`;
  if (node.children.length > 0) out += ` > ${siblingsCompact(node.children)}`;
  return out;
}

function termCompact(item: LayoutItem): string {
  if (item.kind === 'group') {
    let out = `(${siblingsCompact(item.children)})`;
    if (item.repeat) out += `*${item.repeat}`;
    return out;
  }
  return nodeCompact(item);
}

function siblingsCompact(items: LayoutItem[]): string {
  return items
    .map((item, index) => {
      const text = termCompact(item);
      // `a > b + c` binds b and c to a: a non-last sibling that opens a `>` chain needs a group.
      const needsGroup =
        index < items.length - 1 && item.kind === 'node' && item.children.length > 0;
      return needsGroup ? `(${text})` : text;
    })
    .join(' + ');
}

export function toCompact(doc: LayoutDoc): string {
  let out = siblingsCompact(doc.roots);
  for (const overlay of doc.overlays) out += ` ;; ${termCompact(overlay)}`;
  return out;
}

// ── outline ───────────────────────────────────────────────────────────────

const isSimpleNode = (item: LayoutItem): item is LayoutNode =>
  item.kind === 'node' && item.children.length === 0 && item.slots.length === 0;

function nodeOutlineLines(node: LayoutNode, depth: number): string[] {
  const pad = '  '.repeat(depth);
  let line = node.name ?? '';
  if (node.id) line += `#${node.id}`;
  for (const mod of node.enumMods) line += `.${mod}`;
  if (node.payload !== null) line += ` ${quote(node.payload)}`;
  if (node.payload2 !== null) line += ` :${quote(node.payload2)}`;
  const attrs = attrTokens(node);
  if (attrs.length > 0) line += ` ${attrs.join(' ')}`;
  if (node.hint) line += ` ${hintText(node.hint)}`;
  if (node.selected) line += ' !';
  if (node.repeat) line += ` x${node.repeat}`;

  const lines = [pad + line.trimStart()];
  for (const slot of node.slots) {
    const value = slot.value;
    if (value && typeof value === 'object' && 'subexpr' in value) {
      const first = value.subexpr[0];
      if (value.subexpr.length === 1 && first && isSimpleNode(first)) {
        lines.push(`${pad}  ${slot.key}: ${nodeOutlineLines(first, 0)[0]}`);
      } else {
        lines.push(`${pad}  ${slot.key}:`);
        for (const sub of value.subexpr) lines.push(...itemOutlineLines(sub, depth + 2));
      }
    } else if (typeof value === 'string') {
      lines.push(`${pad}  ${slot.key}: ${quote(value)}`);
    } else if (value && typeof value === 'object' && 'hint' in value) {
      lines.push(`${pad}  ${slot.key}: ${hintText(value.hint)}`);
    } else if (value && typeof value === 'object' && 'idref' in value) {
      lines.push(`${pad}  ${slot.key}: #${value.idref}`);
    } else {
      lines.push(`${pad}  ${slot.key}:`);
    }
  }
  for (const child of node.children) lines.push(...itemOutlineLines(child, depth + 1));
  return lines;
}

function itemOutlineLines(item: LayoutItem, depth: number): string[] {
  if (item.kind === 'group') {
    // A repeat-less group only disambiguates compact sibling chains: indentation already does that.
    if (!item.repeat || item.repeat === 1)
      return item.children.flatMap((child) => itemOutlineLines(child, depth));
    const lines = [`${'  '.repeat(depth)}repeat ${item.repeat}:`];
    for (const child of item.children) lines.push(...itemOutlineLines(child, depth + 1));
    return lines;
  }
  return nodeOutlineLines(item, depth);
}

export function toOutline(doc: LayoutDoc): string {
  const lines: string[] = [];
  for (const item of doc.roots) lines.push(...itemOutlineLines(item, 0));
  if (doc.overlays.length > 0) {
    lines.push('', 'overlays:');
    for (const item of doc.overlays) lines.push(...itemOutlineLines(item, 1));
  }
  return lines.join('\n');
}
