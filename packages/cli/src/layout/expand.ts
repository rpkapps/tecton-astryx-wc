/**
 * Layout expander: a bound AST becomes `tct-*` markup.
 *
 * Expansion is code generation, not templating: attributes come from the validated bindings, `fill` children
 * of a stack are wrapped in a stack item, slot content carries its `slot` attribute, text goes to the `label`
 * attribute when the element has one and to its default slot otherwise, and `opens=#id` triggers get a
 * `data-opens` attribute plus a small wiring script. Output is deterministic: the same bound AST gives
 * byte-identical markup.
 */
import {ERROR_CODES, CliError} from '../errors.ts';
import {PAYLOAD_ATTRIBUTES} from './validate.ts';
import type {
  BoundInfo,
  Hint,
  LayoutDoc,
  LayoutItem,
  LayoutNode,
  LayoutRegistry,
  LayoutValue,
  Slot,
} from './ast.ts';

const INDENT = '  ';
/** The most copies one `*N` repeat expands to. */
export const MAX_REPEAT = 10000;
/** The most elements one expansion may emit (nested repeats multiply). */
export const MAX_ELEMENTS = 100000;

const STACKS = new Set(['tct-stack', 'tct-vstack', 'tct-hstack']);

const escapeText = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (text: string): string => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export interface ExpandResult {
  /** The markup, with a trailing module script for the imports (and trigger wiring when used). */
  html: string;
  /** Tags used, sorted. */
  elementsUsed: string[];
  /** Imports that register them, one per family. */
  imports: string[];
  todos: string[];
}

interface Context {
  parent: BoundInfo | null;
  /** The active `$` counter of the outermost repeat, when there is one. */
  counter: number | undefined;
  /** A `slot` attribute to put on the emitted top-level element(s). */
  slot: string | undefined;
}

class Emitter {
  readonly used = new Set<string>();
  readonly todos: string[] = [];
  private readonly registry: LayoutRegistry;
  private emitted = 0;
  usesTriggers = false;

  constructor(registry: LayoutRegistry) {
    this.registry = registry;
  }

  private text(value: string, context: Context): string {
    // `$` is the repeat counter; `\$` is a literal dollar sign.
    return value.replace(/\\\$|\$/g, (match) =>
      match === '\\$' ? '$' : context.counter === undefined ? '$' : String(context.counter),
    );
  }

  private attributeText(name: string, value: LayoutValue, context: Context): string | null {
    if (value === true) return name;
    if (value === false) return null;
    if (typeof value === 'number') return `${name}="${value}"`;
    if (typeof value === 'string') return `${name}="${escapeAttr(this.text(value, context))}"`;
    if (Array.isArray(value))
      return `${name}="${escapeAttr(value.map((inner) => this.text(typeof inner === 'string' || typeof inner === 'number' ? String(inner) : JSON.stringify(inner), context)).join(' '))}"`;
    if ('idref' in value && typeof value.idref === 'string')
      return `${name}="${escapeAttr(value.idref)}"`;
    return `${name}='${JSON.stringify(value).replace(/'/g, '&#39;')}'`;
  }

  emitItems(items: readonly LayoutItem[], depth: number, context: Context): string[] {
    const lines: string[] = [];
    for (const item of items) {
      const count = Math.min(item.repeat ?? 1, MAX_REPEAT);
      const repeated = (item.repeat ?? 1) > 1;
      for (let i = 1; i <= count; i++) {
        const inner: Context =
          repeated && context.counter === undefined ? {...context, counter: i} : context;
        if (item.kind === 'group') lines.push(...this.emitItems(item.children, depth, inner));
        else lines.push(...this.emitNode(item, depth, inner));
      }
    }
    return lines;
  }

  private emitHint(hint: Hint, depth: number, context: Context): string[] {
    const pad = INDENT.repeat(depth);
    const slot = context.slot ? ` slot="${escapeAttr(context.slot)}"` : '';
    if (hint.resolved) {
      if (hint.resolved.known) this.used.add(hint.resolved.tag);
      this.count();
      return [`${pad}<${hint.resolved.tag}${slot}></${hint.resolved.tag}>`];
    }
    this.todos.push(`unresolved element reference {${hint.name}}`);
    return [`${pad}<!-- TODO(layout): element '${hint.name}' is not defined -->`];
  }

  private count(): void {
    if (++this.emitted > MAX_ELEMENTS) {
      throw new CliError(
        `The layout expands to more than ${MAX_ELEMENTS} elements (nested repeats multiply); reduce the *N counts.`,
        ERROR_CODES.ERR_LAYOUT_INVALID,
      );
    }
  }

  private emitSlot(slot: Slot, depth: number, context: Context): string[] {
    const pad = INDENT.repeat(depth);
    const value = slot.value;
    const inner: Context = {...context, slot: slot.key};
    if (value === null) {
      this.todos.push(`@${slot.key} has no value`);
      return [`${pad}<!-- TODO(layout): content for slot '${slot.key}' -->`];
    }
    if (typeof value === 'string') {
      if (this.registry.elements.has('tct-text')) this.used.add('tct-text');
      this.count();
      return [
        `${pad}<tct-text slot="${escapeAttr(slot.key)}">${escapeText(this.text(value, context))}</tct-text>`,
      ];
    }
    if ('hint' in value) return this.emitHint(value.hint, depth, inner);
    if ('idref' in value) {
      this.todos.push(`slot '${slot.key}' references #${value.idref}`);
      return [`${pad}<!-- TODO(layout): slot '${slot.key}' references #${value.idref} -->`];
    }
    return this.emitItems(value.subexpr, depth, inner);
  }

  emitNode(node: LayoutNode, depth: number, context: Context): string[] {
    const pad = INDENT.repeat(depth);
    if (!node.bound) {
      if (node.hint) return this.emitHint(node.hint, depth, context);
      return [`${pad}<!-- unresolved: ${node.name ?? ''} -->`];
    }
    const {element} = node.bound;
    this.used.add(element.tag);
    this.count();

    const props = new Map(node.bound.props);
    const wrapFill = props.get('__fill') === true && STACKS.has(context.parent?.element.tag ?? '');
    props.delete('__fill');
    const opens = props.get('__opens');
    props.delete('__opens');

    let textChild: string | null = null;
    if (node.payload !== null) {
      const payload = this.text(node.payload, context);
      const target = PAYLOAD_ATTRIBUTES.find((name) => element.attributes.has(name));
      if (target && !props.has(target)) props.set(target, payload);
      else if (element.hasDefaultSlot) textChild = payload;
      else this.todos.push(`${element.tag} has no place for the text "${payload}"`);
    }
    if (node.payload2 !== null && element.attributes.has('value') && !props.has('value')) {
      props.set('value', this.text(node.payload2, context));
    }
    if (node.selected) {
      if (element.attributes.get('selected')?.isBoolean) props.set('selected', true);
      else if (element.attributes.get('checked')?.isBoolean) props.set('checked', true);
      else this.todos.push(`${element.tag} has no selected state for '!'`);
    }
    if (opens && typeof opens === 'object' && 'idref' in opens) {
      props.set('data-opens', opens.idref);
      this.usesTriggers = true;
    }

    const attributes: string[] = [];
    if (node.id) attributes.push(`id="${escapeAttr(node.id)}"`);
    if (context.slot && !wrapFill) attributes.push(`slot="${escapeAttr(context.slot)}"`);
    for (const [name, value] of props) {
      const rendered = this.attributeText(name, value, context);
      if (rendered) attributes.push(rendered);
    }
    const open = `<${element.tag}${attributes.length > 0 ? ` ${attributes.join(' ')}` : ''}>`;
    const close = `</${element.tag}>`;

    const childContext: Context = {parent: node.bound, counter: context.counter, slot: undefined};
    const body: string[] = [];
    if (node.hint) body.push(...this.emitHint(node.hint, depth + 1, {...childContext}));
    for (const slot of node.bound.slots) body.push(...this.emitSlot(slot, depth + 1, childContext));
    const children = this.emitItems(node.children, depth + 1, childContext);

    let lines: string[];
    if (body.length === 0 && children.length === 0) {
      lines = [`${pad}${open}${textChild !== null ? escapeText(textChild) : ''}${close}`];
    } else {
      lines = [
        `${pad}${open}`,
        ...(textChild !== null ? [`${INDENT.repeat(depth + 1)}${escapeText(textChild)}`] : []),
        ...body,
        ...children,
        `${pad}${close}`,
      ];
    }
    if (wrapFill) {
      if (this.registry.elements.has('tct-stack-item')) {
        this.used.add('tct-stack-item');
        this.count();
        const slot = context.slot ? ` slot="${escapeAttr(context.slot)}"` : '';
        return [
          `${pad}<tct-stack-item size="fill"${slot}>`,
          ...lines.map((line) => INDENT + line),
          `${pad}</tct-stack-item>`,
        ];
      }
    }
    return lines;
  }
}

/** Expands a validated document into markup. */
export function expand(doc: LayoutDoc, registry: LayoutRegistry): ExpandResult {
  const emitter = new Emitter(registry);
  const context: Context = {parent: null, counter: undefined, slot: undefined};
  const lines = emitter.emitItems(doc.roots, 0, context);
  if (doc.overlays.length > 0) {
    lines.push('', '<!-- overlays: opened by the trigger whose opens=#id names them -->');
    lines.push(...emitter.emitItems(doc.overlays, 0, context));
  }

  const elementsUsed = [...emitter.used].sort();
  const folders = [
    ...new Set(
      elementsUsed
        .map((tag) => registry.elements.get(tag)?.folder)
        .filter((folder): folder is string => Boolean(folder)),
    ),
  ].sort();
  const imports = folders.map((folder) => `import '@tecton-wc/components/${folder}';`);

  const script: string[] = [];
  if (imports.length > 0 || emitter.usesTriggers) {
    script.push('<script type="module">', ...imports.map((line) => INDENT + line));
    if (emitter.usesTriggers) {
      script.push(
        `${INDENT}// Triggers (opens=#id) open the overlay they name.`,
        `${INDENT}for (const trigger of document.querySelectorAll('[data-opens]')) {`,
        `${INDENT}${INDENT}trigger.addEventListener('click', () => void document.getElementById(trigger.dataset.opens)?.show());`,
        `${INDENT}}`,
      );
    }
    script.push('</script>');
  }
  const html = [
    '<!-- Generated by `tct layout expand`: this markup is the artifact; edit freely. -->',
    ...lines,
    ...(script.length > 0 ? ['', ...script] : []),
    '',
  ].join('\n');
  return {html, elementsUsed, imports, todos: emitter.todos};
}
