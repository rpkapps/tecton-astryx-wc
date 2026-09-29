/**
 * Text renderings of a component: full (everything an agent needs to write correct markup), compact, brief
 * (a one-line signature) and dense (built from the authored dense doc, token-efficient).
 *
 * The dense rendering is a projection of `dense`: the one-line description, the dense usage, best practices
 * as do and don't, and one line per public attribute, property, slot, event and method. The docs pipeline
 * fails when `dense.properties` omits a public name, so a dense rendering cannot hide API.
 */
import type {RegistryComponent, RegistryElement} from '../registry/types.ts';
import {importStatement} from '../registry/lookup.ts';
import {truncate} from '../text.ts';

const code = (text: string): string => `\`${text.replace(/`/g, "'")}\``;

/** The public names of an element's API in the order the dense doc lists them. */
export function apiNames(element: RegistryElement): string[] {
  return [
    ...element.attributes.map((attribute) => attribute.name),
    ...element.properties.map((property) => property.name),
    ...element.slots.map((slot) => slot.name || 'default'),
    ...element.events.map((event) => event.name),
    ...element.methods.map((method) => method.name),
  ];
}

function attributeLine(attribute: RegistryElement['attributes'][number]): string {
  const values = attribute.values ? ` one of ${attribute.values.map(code).join(', ')};` : '';
  const fallback = attribute.default === undefined ? '' : ` default ${code(attribute.default)};`;
  const deprecated = attribute.deprecated ? ` DEPRECATED: ${attribute.deprecated}` : '';
  return `- ${code(attribute.name)} (${code(attribute.type)}${attribute.reflects ? ', reflected' : ''}):${values}${fallback} ${attribute.description}${deprecated}`.trimEnd();
}

/** The API of one element: attributes, properties, slots, events, methods. */
export function elementApi(element: RegistryElement, heading = '###'): string[] {
  const out: string[] = [`${heading} ${code(`<${element.tag}>`)}`, ''];
  if (element.description) out.push(element.description, '');
  const block = (title: string, lines: string[]) => {
    if (lines.length > 0) out.push(`${title}:`, '', ...lines, '');
  };
  block('Attributes', element.attributes.map(attributeLine));
  block(
    'Properties (no attribute)',
    element.properties.map((property) =>
      `- ${code(property.name)} (${code(property.type)}${property.readonly ? ', readonly' : ''}): ${property.description}`.trimEnd(),
    ),
  );
  block(
    'Slots',
    element.slots.map((slot) =>
      `- ${slot.name === '' ? '(default)' : code(slot.name)}: ${slot.description}`.trimEnd(),
    ),
  );
  block(
    'Events',
    element.events.map((event) => {
      const flags = [
        event.bubbles && 'bubbles',
        event.composed && 'composed',
        event.cancelable && 'cancelable',
      ]
        .filter(Boolean)
        .join(', ');
      return `- ${code(event.name)}${flags ? ` (${flags})` : ''}: ${event.description}`.trimEnd();
    }),
  );
  block(
    'Methods',
    element.methods.map((method) =>
      `- ${code(`${method.name}${method.signature}`)}: ${method.description}`.trimEnd(),
    ),
  );
  return out;
}

/** Parts, states and custom properties: the styling hooks of an element. */
export function elementStyling(element: RegistryElement, heading = '###'): string[] {
  const out: string[] = [`${heading} ${code(`<${element.tag}>`)}`, ''];
  const block = (title: string, lines: string[]) => {
    if (lines.length > 0) out.push(`${title}:`, '', ...lines, '');
  };
  block(
    'Parts (::part())',
    element.cssParts.map((part) => `- ${code(part.name)}: ${part.description}`.trimEnd()),
  );
  block(
    'States (:state())',
    element.cssStates.map((state) =>
      `- ${code(`:state(${state.name})`)}: ${state.description}`.trimEnd(),
    ),
  );
  block(
    'Custom properties',
    element.cssProperties.map((property) =>
      `- ${code(property.name)}${property.default ? ` (default ${code(property.default)})` : ''}: ${property.description}`.trimEnd(),
    ),
  );
  if (out.length === 2) out.push('No styling hooks are documented for this element.', '');
  return out;
}

function keyboardLines(element: RegistryElement): string[] {
  return element.keyboard.map(
    (row) => `- ${row.keys}: ${row.action}${row.when ? ` (${row.when})` : ''}`,
  );
}

export interface FormatOptions {
  /** Scope the API sections to one element of the family. */
  element?: RegistryElement | null;
}

const scopedElements = (component: RegistryComponent, options: FormatOptions): RegistryElement[] =>
  options.element ? [options.element] : component.elements;

const practices = (component: RegistryComponent): string[] =>
  (component.dense?.bestPractices ?? []).map(
    (practice) => `- ${practice.do ? 'Do' : "Don't"}: ${practice.text}`,
  );

const AUTHORED_SECTIONS = [
  'Purpose',
  'When to use',
  'Alternatives',
  'Anatomy',
  'Variants and states',
  'Screen-reader expectations',
  'Consumer responsibilities',
] as const;

/** Everything an agent needs to write correct markup for the component. */
export function formatFull(component: RegistryComponent, options: FormatOptions = {}): string {
  const elements = scopedElements(component, options);
  const primary = options.element?.tag ?? component.tag;
  const lines: string[] = [
    `# ${component.name}${primary ? ` (${code(`<${primary}>`)})` : ''}`,
    '',
    `Category: ${component.category}. Status: ${component.status}.${component.tags.length > 1 ? ` Elements: ${component.tags.map((tag) => code(tag)).join(', ')}.` : ''}`,
    '',
  ];
  if (component.summary) lines.push(component.summary, '');
  lines.push(`**Import:** ${code(importStatement(component))}`, '');
  if (component.related.length > 0) lines.push(`Related: ${component.related.join(', ')}`, '');
  if (component.dense?.usage) lines.push('## Usage', '', component.dense.usage, '');
  if (component.dense && component.dense.bestPractices.length > 0) {
    lines.push('## Best practices', '', ...practices(component), '');
  }
  lines.push('## API', '');
  for (const element of elements) lines.push(...elementApi(element));
  const keyboard = elements.flatMap(keyboardLines);
  if (keyboard.length > 0) lines.push('## Keyboard', '', ...keyboard, '');
  const form = elements.find((element) => element.form?.formAssociated);
  if (form)
    lines.push(
      '## Form',
      '',
      `Form-associated.${form.form?.notes ? ` ${form.form.notes}` : ''}`,
      '',
    );
  lines.push('## Styling hooks', '');
  for (const element of elements) lines.push(...elementStyling(element));
  if (component.examples.length > 0) {
    lines.push('## Examples', '');
    for (const example of component.examples.slice(0, 3)) {
      lines.push(`### ${example.title}`, '');
      if (example.description) lines.push(example.description, '');
      lines.push('```html', example.source.trim(), '```', '');
    }
    if (component.examples.length > 3) {
      lines.push(
        `${component.examples.length - 3} more example(s): ${component.examples
          .slice(3)
          .map((example) => example.id)
          .join(', ')}. Run \`tct component ${component.tag ?? component.folder} --examples\`.`,
        '',
      );
    }
  }
  for (const heading of AUTHORED_SECTIONS) {
    const body = component.sections[heading];
    if (body && !body.trim().startsWith('Not applicable.'))
      lines.push(`## ${heading}`, '', body.trim(), '');
  }
  return lines.join('\n').trimEnd();
}

/** Import, best practices, a one-line API summary per element and the first example. */
export function formatCompact(component: RegistryComponent, options: FormatOptions = {}): string {
  const elements = scopedElements(component, options);
  const lines: string[] = [
    `# ${component.name}`,
    '',
    component.summary,
    '',
    `Import: ${code(importStatement(component))}`,
    '',
  ];
  if (component.dense && component.dense.bestPractices.length > 0) {
    lines.push('Best practices:', ...practices(component), '');
  }
  for (const element of elements) {
    lines.push(`${code(`<${element.tag}>`)}`);
    if (element.attributes.length > 0) {
      lines.push(
        `  attributes: ${element.attributes
          .map((attribute) =>
            attribute.values ? `${attribute.name}=${attribute.values.join('|')}` : attribute.name,
          )
          .join(', ')}`,
      );
    }
    if (element.properties.length > 0)
      lines.push(`  properties: ${element.properties.map((p) => p.name).join(', ')}`);
    if (element.slots.length > 0)
      lines.push(`  slots: ${element.slots.map((s) => s.name || '(default)').join(', ')}`);
    if (element.events.length > 0)
      lines.push(`  events: ${element.events.map((e) => e.name).join(', ')}`);
    if (element.methods.length > 0)
      lines.push(`  methods: ${element.methods.map((m) => m.name).join(', ')}`);
  }
  const example = component.examples[0];
  if (example)
    lines.push('', `Example (${example.title}):`, '```html', example.source.trim(), '```');
  return lines.join('\n');
}

/** A one-line signature, a shortened description and the first example line: about 300 characters. */
export function formatBrief(component: RegistryComponent, options: FormatOptions = {}): string {
  const elements = scopedElements(component, options);
  const element = elements[0];
  const tag = element?.tag ?? component.tag ?? component.folder;
  const enums: string[] = [];
  const others: string[] = [];
  for (const attribute of element?.attributes ?? []) {
    if (attribute.values && attribute.values.length <= 8)
      enums.push(`${attribute.name}: ${attribute.values.join('|')}`);
    else others.push(attribute.name);
  }
  const lines = [
    `${tag}${enums.length > 0 ? `(${enums.join(', ')})` : ''}  <- '@tecton-wc/components/${component.folder}'`,
  ];
  const description = component.dense?.description ?? component.summary;
  if (description) lines.push(`  ${truncate(description, 80)}`);
  if (others.length > 0) lines.push(`  ${others.join(', ')}`);
  const slots = (element?.slots ?? []).map((slot) => slot.name || '(default)');
  if (slots.length > 0) lines.push(`  slots: ${slots.join(', ')}`);
  const first = component.examples[0]?.source
    .split('\n')
    .find((line) => line.trim().startsWith('<') && !line.trim().startsWith('<!--'));
  if (first) lines.push(`  ${first.trim()}`);
  return `${lines.join('\n')}\n`;
}

/** The token-efficient rendering built from the authored dense doc. */
export function formatDense(component: RegistryComponent, options: FormatOptions = {}): string {
  const elements = scopedElements(component, options);
  const dense = component.dense;
  const tags = options.element ? [options.element.tag] : component.tags;
  const lines: string[] = [
    `${tags.join(', ')} (${component.category})  import '@tecton-wc/components/${component.folder}'`,
  ];
  if (!dense) {
    lines.push(component.summary, '(no dense doc yet: run without --dense for the full page)');
    return `${lines.join('\n')}\n`;
  }
  lines.push(dense.description, `usage: ${dense.usage}`);
  for (const practice of dense.bestPractices)
    lines.push(`${practice.do ? '+' : '-'} ${practice.text}`);
  const names = new Set<string>();
  for (const element of elements) for (const name of apiNames(element)) names.add(name);
  const scoped = options.element !== undefined && options.element !== null;
  const entries = Object.entries(dense.properties).filter(([name]) => !scoped || names.has(name));
  if (entries.length > 0) {
    lines.push('api:');
    for (const [name, description] of entries) lines.push(`  ${name}: ${description}`);
  }
  // Names the dense doc misses (they should not exist) still appear, so nothing is hidden.
  const missing = [...names].filter((name) => !(name in dense.properties));
  for (const name of missing) lines.push(`  ${name}`);
  if (component.related.length > 0) lines.push(`related: ${component.related.join(', ')}`);
  return `${lines.join('\n')}\n`;
}

/** Just the API of the (scoped) elements: `--props`. */
export function formatProps(component: RegistryComponent, options: FormatOptions = {}): string {
  const lines: string[] = [];
  for (const element of scopedElements(component, options))
    lines.push(...elementApi(element, '##'));
  return lines.join('\n').trimEnd();
}

/** Just the styling hooks of the (scoped) elements: `--styling`. */
export function formatStyling(component: RegistryComponent, options: FormatOptions = {}): string {
  const lines: string[] = [];
  for (const element of scopedElements(component, options))
    lines.push(...elementStyling(element, '##'));
  return lines.join('\n').trimEnd();
}

/** All examples with their HTML source: `--examples`. */
export function formatExamples(examples: RegistryComponent['examples']): string {
  return examples
    .map((example) =>
      [
        `## ${example.title} (${example.id})`,
        '',
        example.description,
        '',
        '```html',
        example.source.trim(),
        '```',
      ]
        .filter((line, index, all) => !(line === '' && all[index - 1] === ''))
        .join('\n'),
    )
    .join('\n\n');
}
