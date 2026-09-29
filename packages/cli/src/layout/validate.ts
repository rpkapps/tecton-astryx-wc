/**
 * Layout binder and validator: resolves the parsed AST against the element registry and annotates every node
 * with its bound element and attribute assignments.
 *
 * Lenient lexer, strict validator: spelling variants normalise silently (`p6` = `pad=6` = `padding=6`), but
 * semantic problems (unknown elements, attributes, enumerated values, references) are hard errors carrying
 * ranked suggestions. Nothing is guessed.
 */
import {closest} from '../text.ts';
import type {
  Attr,
  Hint,
  KvAttr,
  LayoutDoc,
  LayoutItem,
  LayoutNode,
  LayoutRegistry,
  LayoutValue,
  RawIssue,
  RegistryElement,
} from './ast.ts';
import {KEY_ALIASES} from './parse.ts';
import {resolveElement} from './registry.ts';

/** Boolean flag synonyms: agent-frequency spellings of boolean attributes. */
const FLAG_SYNONYMS: Record<string, string> = {
  scroll: 'scrollable',
  dis: 'disabled',
  req: 'required',
  ro: 'readonly',
};

/** Attributes the expander treats as the node's text when the element has no default slot, in order. */
export const PAYLOAD_ATTRIBUTES = ['label', 'heading', 'content'];

const valueText = (value: unknown): string => String(value);

function suggest(input: string, candidates: readonly string[], max = 4): string[] {
  return closest(input, candidates, max);
}

type Word = {attribute: string; value: string | boolean} | {ambiguous: string[]} | null;

/** A word as an attribute assignment: synonym, boolean attribute (`has-`/`is-` prefixes too), unique enum member. */
function resolveWord(element: RegistryElement, word: string): Word {
  const synonym = FLAG_SYNONYMS[word];
  if (synonym && element.attributes.get(synonym)?.isBoolean)
    return {attribute: synonym, value: true};
  const exact = element.attributes.get(word);
  if (exact?.isBoolean) return {attribute: word, value: true};
  for (const prefix of ['has-', 'is-']) {
    const prefixed = element.attributes.get(prefix + word);
    if (prefixed?.isBoolean) return {attribute: prefixed.name, value: true};
  }
  const hits: string[] = [];
  for (const attribute of element.attributes.values()) {
    if (attribute.enumValues?.includes(word)) hits.push(attribute.name);
  }
  if (hits.length === 1) return {attribute: hits[0]!, value: word};
  if (hits.length > 1) return {ambiguous: hits};
  return null;
}

/** Maps the axis-neutral `j=` and `a=` keys onto the element's real alignment attributes. */
function resolveAxisKey(element: RegistryElement, key: string): string {
  const main = key === '__mainAxis';
  if (element.tag === 'tct-vstack') return main ? 'v-align' : 'h-align';
  if (element.tag === 'tct-hstack') return main ? 'h-align' : 'v-align';
  const generic = main ? 'justify' : 'alignment';
  if (element.attributes.has(generic)) return generic;
  const physical = main ? 'h-align' : 'v-align';
  return element.attributes.has(physical) ? physical : generic;
}

/** Grid's `columns` object shorthand `{min, max, fit|fill}` becomes the real attributes. */
function expandColumns(value: LayoutValue): [string, LayoutValue][] | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || 'idref' in value)
    return null;
  const out: [string, LayoutValue][] = [];
  for (const [key, inner] of Object.entries(value as Record<string, LayoutValue>)) {
    if (key === 'min' || key === 'minWidth') out.push(['column-min-width', inner]);
    else if (key === 'max') out.push(['column-max', inner]);
    else if (key === 'fit' || key === 'fill') out.push(['column-repeat', key]);
    else if (key === 'repeat') out.push(['column-repeat', inner]);
    else out.push([key, inner]);
  }
  return out;
}

export class Validation {
  readonly errors: RawIssue[] = [];
  readonly warnings: RawIssue[] = [];
  private readonly registry: LayoutRegistry;
  private readonly loose: boolean;

  constructor(registry: LayoutRegistry, options: {loose?: boolean} = {}) {
    this.registry = registry;
    this.loose = options.loose === true;
  }

  private error(node: LayoutNode, message: string, suggestions: string[] = []): void {
    this.errors.push({message, line: node.line, col: node.col, suggestions});
  }

  warn(node: LayoutNode, message: string): void {
    this.warnings.push({message, line: node.line, col: node.col});
  }

  private nameCandidates(): string[] {
    return [
      ...this.registry.aliases.keys(),
      ...this.registry.tags,
      ...this.registry.tags.map((tag) => tag.replace(/^tct-/, '')),
    ];
  }

  bindNode(node: LayoutNode, parent: LayoutNode | null): void {
    // An anonymous reference ({element} with no host element).
    if (!node.name && node.hint) {
      node.bound = null;
      this.bindHint(node, node.hint);
      for (const child of node.children) this.bindAny(child, node);
      return;
    }
    const element = resolveElement(this.registry, node.name);
    if (!element) {
      this.error(
        node,
        `Unknown element or alias '${node.name}'`,
        suggest(node.name ?? '', this.nameCandidates()),
      );
      node.bound = null;
    } else {
      node.bound = {element, props: new Map(), slots: []};
      this.bindAttrs(node, element);
      this.bindMods(node, element);
      this.bindSlots(node, element);
      this.checkPairings(node, element, parent);
    }
    if (node.hint) this.bindHint(node, node.hint);
    for (const child of node.children) this.bindAny(child, node);
  }

  bindAny(item: LayoutItem, parent: LayoutNode | null): void {
    if (item.kind === 'group') {
      for (const child of item.children) this.bindAny(child, parent);
    } else {
      this.bindNode(item, parent);
    }
  }

  private bindAttrs(node: LayoutNode, element: RegistryElement): void {
    if (!node.bound) return;
    for (const attr of node.attrs) {
      if (attr.kind === 'kv') this.bindKv(node, element, attr);
      else this.bindWord(node, element, attr);
    }
  }

  private bindWord(node: LayoutNode, element: RegistryElement, attr: Exclude<Attr, KvAttr>): void {
    const bound = node.bound!;
    // `fill` on a stack child wraps it in a stack item: recorded, resolved by the expander.
    if (attr.kind === 'flag' && attr.key === 'fill') {
      bound.props.set('__fill', true);
      return;
    }
    const hit = resolveWord(element, attr.key);
    if (attr.kind === 'flag') {
      if (!hit) {
        this.error(
          node,
          `'${attr.key}' is not an attribute, flag or enumerated value of ${element.tag}`,
          suggest(attr.key, [...element.attributes.keys()]),
        );
      } else if ('ambiguous' in hit) {
        this.error(
          node,
          `'${attr.key}' is ambiguous on ${element.tag}: it is a value of ${hit.ambiguous.join(' and ')}; use key=value`,
        );
      } else {
        bound.props.set(hit.attribute, hit.value);
      }
      return;
    }
    if (!hit || 'ambiguous' in hit || typeof hit.value !== 'boolean') {
      this.error(
        node,
        `'!${attr.key}' does not match a boolean attribute of ${element.tag}`,
        suggest(
          attr.key,
          [...element.attributes.values()]
            .filter((attribute) => attribute.isBoolean)
            .map((attribute) => attribute.name),
        ),
      );
    } else {
      bound.props.set(hit.attribute, false);
    }
  }

  private bindKv(node: LayoutNode, element: RegistryElement, attr: KvAttr): void {
    const bound = node.bound!;
    let key = attr.key.split('.')[0]!;
    key = KEY_ALIASES[key] ?? key;
    if (key === '__mainAxis' || key === '__crossAxis') key = resolveAxisKey(element, key);

    if (key === 'opens') {
      // Overlay trigger binding: the expander emits a data attribute and the wiring script.
      bound.props.set('__opens', attr.value);
      return;
    }
    if (key === 'columns' && element.attributes.has('column-min-width')) {
      const expanded = expandColumns(attr.value);
      if (expanded) {
        for (const [name, value] of expanded) bound.props.set(name, value);
        return;
      }
    }

    const attribute = element.attributes.get(key);
    if (!attribute) {
      this.error(
        node,
        `${element.tag} has no attribute '${key}'${attr.raw && attr.raw !== key ? ` (from '${attr.raw}')` : ''}`,
        suggest(key, [...element.attributes.keys()]),
      );
      return;
    }
    if (
      attribute.enumValues &&
      (typeof attr.value === 'string' || typeof attr.value === 'number')
    ) {
      if (!attribute.enumValues.map(valueText).includes(valueText(attr.value))) {
        this.error(
          node,
          `${element.tag} ${key} must be one of ${attribute.enumValues.join(' | ')}, got '${valueText(attr.value)}'`,
          typeof attr.value === 'string'
            ? suggest(attr.value, attribute.enumValues.map(valueText))
            : [],
        );
        return;
      }
    }
    bound.props.set(key, attr.value);
  }

  private bindMods(node: LayoutNode, element: RegistryElement): void {
    if (!node.bound) return;
    for (const mod of node.enumMods) {
      const hit = resolveWord(element, mod);
      if (!hit || 'ambiguous' in hit) {
        const pool = [...element.attributes.values()]
          .flatMap((attribute) => attribute.enumValues ?? [])
          .map(valueText);
        this.error(
          node,
          hit && 'ambiguous' in hit
            ? `'.${mod}' is ambiguous on ${element.tag} (${hit.ambiguous.join(', ')}); use key=value`
            : `'.${mod}' does not match an enumerated value of any ${element.tag} attribute`,
          suggest(mod, pool),
        );
      } else {
        node.bound.props.set(hit.attribute, hit.value);
      }
    }
  }

  private bindSlots(node: LayoutNode, element: RegistryElement): void {
    if (!node.bound) return;
    for (const slot of node.slots) {
      if (!element.slots.has(slot.key)) {
        this.error(
          node,
          `${element.tag} has no slot '${slot.key}'`,
          element.slots.size > 0
            ? suggest(slot.key, [...element.slots])
            : ['it has only a default slot'],
        );
        continue;
      }
      const value = slot.value;
      if (value && typeof value === 'object' && 'subexpr' in value) {
        for (const sub of value.subexpr) this.bindAny(sub, node);
      }
      if (value && typeof value === 'object' && 'hint' in value) this.bindHint(node, value.hint);
      node.bound.slots.push(slot);
    }
  }

  /**
   * `{name}` names an element: a `tct-*` element of the registry (by tag or short name), or another custom
   * element of your app (a name with a hyphen, emitted unchecked with a warning). Anything else is an
   * error, or with `--loose` a TODO placeholder.
   */
  private bindHint(node: LayoutNode, hint: Hint): void {
    const element = resolveElement(this.registry, hint.name);
    if (element) {
      hint.resolved = {tag: element.tag, known: true};
      return;
    }
    if (hint.name.includes('-') && !hint.name.startsWith('tct-')) {
      hint.resolved = {tag: hint.name, known: false};
      this.warn(
        node,
        `{${hint.name}} is not a tct-* element: emitted as <${hint.name}> and not checked`,
      );
      return;
    }
    if (this.loose) {
      this.warn(
        node,
        `Unknown element reference '{${hint.name}}': emitting a TODO placeholder (--loose)`,
      );
      return;
    }
    this.error(
      node,
      `Unknown element reference '{${hint.name}}': braces must name a tct-* element or an app custom element (with a hyphen)`,
      suggest(hint.name, this.registry.tags),
    );
  }

  private checkPairings(
    node: LayoutNode,
    element: RegistryElement,
    parent: LayoutNode | null,
  ): void {
    const parentTag = parent?.bound?.element.tag ?? null;
    if (element.tag === 'tct-grid-span' && parentTag !== 'tct-grid') {
      this.error(node, 'tct-grid-span is only valid directly under tct-grid');
    }
    if (
      element.tag === 'tct-stack-item' &&
      !['tct-stack', 'tct-vstack', 'tct-hstack'].includes(parentTag ?? '')
    ) {
      this.error(
        node,
        'tct-stack-item is only valid directly under tct-stack, tct-vstack or tct-hstack',
      );
    }
    if (element.tag === 'tct-dialog-header' && parentTag !== null && parentTag !== 'tct-dialog') {
      this.warn(node, 'tct-dialog-header is meant to sit at the top of a tct-dialog');
    }
  }
}

/** Validates (and binds) a parsed document in place. */
export function validate(
  doc: LayoutDoc,
  registry: LayoutRegistry,
  options: {loose?: boolean} = {},
): {errors: RawIssue[]; warnings: RawIssue[]} {
  const validation = new Validation(registry, options);
  for (const item of doc.roots) validation.bindAny(item, null);
  for (const item of doc.overlays) {
    validation.bindAny(item, null);
    if (item.kind === 'node' && !item.id)
      validation.warn(item, `Overlay ${item.name} has no #id: triggers cannot reference it`);
  }
  return {errors: validation.errors, warnings: validation.warnings};
}
