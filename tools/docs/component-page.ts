/**
 * One generated MDX page per component folder (A§16.2). Sections appear in the A§16.3 order:
 *
 *   Purpose (A) · When to use, Alternatives (A) · Installation (G) · Anatomy (A) · Examples (from files) ·
 *   Variants and states (A) · Responsive behaviour (A) · Attributes and properties, Methods, Slots,
 *   Events, Styling hooks, Tokens (G, from the CEM and the compiled CSS) · Form semantics (A + G) ·
 *   Keyboard interactions (G, parity.json) · Screen-reader expectations (A) · Localisation (A + G) ·
 *   Consumer responsibilities (A)
 *
 * A = authored in `<folder>.docs.md` (see docs-model.ts); G = generated. Authored sections that are
 * missing make the generator fail (tools/docs/generate.ts), so every page has all of them.
 */
import type {CemElement} from '../lib/cem.ts';
import type {ComponentDocs, DocSection} from '../lib/docs-model.ts';
import {REQUIRED_SECTIONS} from '../lib/docs-model.ts';
import type {ElementDoc} from '../lib/element-api.ts';
import {elementDoc} from '../lib/element-api.ts';
import {publicText, tokenStatusLabel} from '../lib/public-text.ts';
import type {TokenMeta} from '../lib/tokens.ts';
import {escapeMdx, jsxValue, yamlString} from './mdx.ts';

/** The page's H2 sections in order (used by the generator's self-check and by tests). */
export const COMPONENT_SECTION_ORDER = [
  'Purpose',
  'When to use',
  'Alternatives',
  'Installation',
  'Anatomy',
  'Examples',
  'Variants and states',
  'Responsive behaviour',
  'Attributes and properties',
  'Methods',
  'Slots',
  'Events',
  'Styling hooks',
  'Tokens',
  'Form semantics',
  'Keyboard interactions',
  'Screen-reader expectations',
  'Localisation',
  'Consumer responsibilities',
] as const;

export interface ComponentPageInput {
  docs: ComponentDocs;
  elements: readonly CemElement[];
  /** Custom properties read by the folder's CSS (non-private). */
  cssVariables: readonly string[];
  /** Design tokens by name (empty when the token build has not run). */
  tokens: ReadonlyMap<string, TokenMeta>;
  /** Message ids used by the folder's source, with their English text (`undefined` = unknown id). */
  messages: readonly {id: string; english: string | undefined}[];
  /** Element classes and their file names without extension (for the class-only import). */
  classFiles: readonly {className: string; file: string}[];
}

export class DocsError extends Error {}

function authored(sections: readonly DocSection[], heading: string): string {
  const section = sections.find((candidate) => candidate.heading === heading);
  return section ? escapeMdx(publicText(section.body)) : '';
}

const tagText = (tag: string) => `<${tag}>`;

function table(
  caption: string,
  columns: {key: string; label: string; kind?: string}[],
  rows: Record<string, unknown>[],
  empty?: string,
): string {
  return (
    `<DataTable caption=${JSON.stringify(caption)} columns=${jsxValue(columns)} rows=${jsxValue(rows)}` +
    `${empty ? ` empty=${JSON.stringify(empty)}` : ''} />`
  );
}

/** Wraps per-element output: with several elements each gets an H3 named by its tag. */
function perElement(elements: readonly ElementDoc[], render: (element: ElementDoc) => string): string {
  if (elements.length === 1) return render(elements[0]!);
  return elements.map((element) => `### \`${tagText(element.tag)}\`\n\n${render(element)}`).join('\n\n');
}

function optionsText(values: string[] | undefined, type: string): string {
  return values ? values.map((value) => `\`${value}\``).join(' | ') : `\`${type}\``;
}

function installation(
  folder: string,
  tags: string[],
  classFiles: readonly {className: string; file: string}[],
): string {
  const registers = tags.map((tag) => `\`${tagText(tag)}\``).join(', ');
  return [
    `Load the stylesheet once and register the family (${registers} and the elements it renders):`,
    '',
    '```js',
    `import '@tecton-astryx/components/tecton.css';`,
    `import '@tecton-astryx/components/${folder}';`,
    '```',
    '',
    'Or let the autoloader define tags lazily, the first time they appear in the page:',
    '',
    '```js',
    `import '@tecton-astryx/components/autoloader.js';`,
    '```',
    '',
    ...(classFiles.length > 0
      ? [
          'Import a class without registering it (for scoped registries and subclassing):',
          '',
          '```js',
          ...classFiles.map(
            (file) =>
              `import {${file.className}} from '@tecton-astryx/components/${folder}/${file.file}.js';`,
          ),
          '```',
          '',
        ]
      : []),
    'Self-hosted CDN build (the library is not published to a registry):',
    '',
    '```html',
    '<link rel="stylesheet" href="/tecton/tecton.css" />',
    '<script type="module" src="/tecton/cdn/autoloader.js"></script>',
    '```',
  ].join('\n');
}

export function renderComponentPage(input: ComponentPageInput): string {
  const {docs, elements: cemElementList} = input;
  const meta = docs.frontmatter;
  if (!meta) throw new DocsError(`${docs.folder}: no ${docs.folder}.docs.md frontmatter`);

  const elements = cemElementList.map((element) => ({element, doc: elementDoc(element)}));
  const docsList = elements.map((entry) => entry.doc);
  const tags = docsList.map((doc) => doc.tag);
  const parityEntries = Object.entries(docs.parity?.entries ?? {});
  const rank = ['not-started', 'in-progress', 'implemented', 'verified'];
  const status = parityEntries.reduce(
    (lowest, [, entry]) => (rank.indexOf(entry.status) < rank.indexOf(lowest) ? entry.status : lowest),
    parityEntries[0]?.[1].status ?? 'not-started',
  );
  const provisionalCount = parityEntries.reduce((sum, [, entry]) => sum + (entry.provisional?.length ?? 0), 0);

  const imports = new Set([
    `import ComponentMeta from '@/components/ComponentMeta.astro';`,
    `import DataTable from '@/components/DataTable.astro';`,
    `import Example from '@/components/Example.astro';`,
  ]);
  docs.examples.forEach((example, index) => {
    imports.add(`import example${index} from '@examples/${docs.folder}/examples/${example.id}.html?raw';`);
  });

  const s = docs.sections;
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);

  push(
    '---',
    `title: ${yamlString(meta.title)}`,
    `description: ${yamlString(meta.summary)}`,
    'sidebar:',
    `  label: ${yamlString(meta.title)}`,
    'editUrl: false',
    '---',
    '',
    `{/* GENERATED by tools/docs/generate.ts from ${docs.folder}.docs.md, the CEM and parity.json. Do not edit; do not commit. */}`,
    '',
    ...imports,
    '',
    `<ComponentMeta tags=${jsxValue(tags)} status=${JSON.stringify(status)} category=${JSON.stringify(meta.category)} provisional={${provisionalCount}} />`,
    '',
  );

  // Purpose, When to use, Alternatives.
  for (const heading of ['Purpose', 'When to use', 'Alternatives'] as const) {
    push(`## ${heading}`, '', authored(s, heading), '');
  }

  push('## Installation', '', installation(docs.folder, tags, input.classFiles), '');

  push('## Anatomy', '', authored(s, 'Anatomy'), '');

  // Examples: rendered from files, in frontmatter order.
  push('## Examples', '');
  if (docs.examples.length === 0) push('This page has no examples yet.', '');
  docs.examples.forEach((example, index) => {
    push(`### ${escapeMdx(publicText(example.title))}`, '');
    if (example.description) push(escapeMdx(publicText(example.description)), '');
    push(`<Example source={example${index}} />`, '');
  });

  // Extra authored H2 sections (beyond the required ones) sit between the variants and the API.
  push('## Variants and states', '', authored(s, 'Variants and states'), '');
  push('## Responsive behaviour', '', authored(s, 'Responsive behaviour'), '');
  for (const extra of s.filter((section) => !(REQUIRED_SECTIONS as readonly string[]).includes(section.heading))) {
    push(`## ${escapeMdx(extra.heading)}`, '', escapeMdx(extra.body), '');
  }

  // API tables.
  push(
    '## Attributes and properties',
    '',
    perElement(docsList, (doc) => {
      const attributeRows = doc.attributes.map((attribute) => ({
        name: attribute.name,
        property: attribute.property,
        type: optionsText(attribute.values, attribute.type),
        default: attribute.default ?? '',
        reflects: attribute.reflects ? 'yes' : '',
        description: `${attribute.deprecated ? `**Deprecated** ${attribute.deprecated}. ` : ''}${attribute.description}`,
      }));
      const propertyRows = doc.properties.map((property) => ({
        name: property.name,
        type: optionsText(property.values, property.type),
        default: property.default ?? '',
        access: property.readonly ? 'read-only' : 'read/write',
        description: property.description,
      }));
      return [
        table(
          `Attributes of ${tagText(doc.tag)}`,
          [
            {key: 'name', label: 'Attribute', kind: 'code'},
            {key: 'property', label: 'Property', kind: 'code'},
            {key: 'type', label: 'Type'},
            {key: 'default', label: 'Default', kind: 'code'},
            {key: 'reflects', label: 'Reflects'},
            {key: 'description', label: 'Description'},
          ],
          attributeRows,
          'This element has no attributes.',
        ),
        '',
        table(
          `Properties of ${tagText(doc.tag)} without an attribute`,
          [
            {key: 'name', label: 'Property', kind: 'code'},
            {key: 'type', label: 'Type'},
            {key: 'default', label: 'Default', kind: 'code'},
            {key: 'access', label: 'Access'},
            {key: 'description', label: 'Description'},
          ],
          propertyRows,
          'This element has no properties that are not also attributes.',
        ),
      ].join('\n');
    }),
    '',
  );

  push(
    '## Methods',
    '',
    perElement(docsList, (doc) =>
      table(
        `Methods of ${tagText(doc.tag)}`,
        [
          {key: 'name', label: 'Method', kind: 'code'},
          {key: 'signature', label: 'Signature', kind: 'code'},
          {key: 'description', label: 'Description'},
        ],
        doc.methods.map((method) => ({
          name: method.name,
          signature: method.signature,
          description: method.description,
        })),
        'This element has no public methods.',
      ),
    ),
    '',
  );

  push(
    '## Slots',
    '',
    perElement(docsList, (doc) =>
      table(
        `Slots of ${tagText(doc.tag)}`,
        [
          {key: 'name', label: 'Slot', kind: 'code'},
          {key: 'description', label: 'Description'},
        ],
        doc.slots.map((slot) => ({name: slot.name === '' ? '(default)' : slot.name, description: slot.description})),
        'This element has no slots.',
      ),
    ),
    '',
  );

  push(
    '## Events',
    '',
    perElement(docsList, (doc) =>
      table(
        `Events of ${tagText(doc.tag)}`,
        [
          {key: 'name', label: 'Event', kind: 'code'},
          {key: 'type', label: 'Type', kind: 'code'},
          {key: 'bubbles', label: 'Bubbles'},
          {key: 'composed', label: 'Composed'},
          {key: 'cancelable', label: 'Cancelable'},
          {key: 'payload', label: 'Payload', kind: 'codes'},
          {key: 'description', label: 'Description'},
        ],
        doc.events.map((event) => ({
          name: event.name,
          type: event.class ?? (event.native ? 'native' : ''),
          bubbles: event.class ? (event.bubbles ? 'yes' : 'no') : '',
          composed: event.class ? (event.composed ? 'yes' : 'no') : '',
          cancelable: event.class ? (event.cancelable ? 'yes' : 'no') : '',
          payload: event.fields.map((field) => `${field.name}: ${field.type}`),
          description: event.description,
        })),
        'This element fires no events.',
      ),
    ),
    '',
  );

  // Styling hooks.
  const stylingElements = docsList;
  push(
    '## Styling hooks',
    '',
    perElement(stylingElements, (doc) =>
      [
        table(
          `Parts of ${tagText(doc.tag)}`,
          [
            {key: 'name', label: 'Part', kind: 'code'},
            {key: 'description', label: 'Description'},
          ],
          doc.cssParts.map((part) => ({name: part.name, description: part.description})),
          'No CSS parts.',
        ),
        '',
        table(
          `Custom states of ${tagText(doc.tag)}`,
          [
            {key: 'name', label: 'State', kind: 'code'},
            {key: 'description', label: 'Description'},
          ],
          doc.cssStates.map((state) => ({name: `:state(${state.name})`, description: state.description})),
          'No custom states.',
        ),
        '',
        table(
          `Custom properties of ${tagText(doc.tag)}`,
          [
            {key: 'name', label: 'Custom property', kind: 'code'},
            {key: 'default', label: 'Default', kind: 'code'},
            {key: 'description', label: 'Description'},
          ],
          doc.cssProperties.map((property) => ({
            name: property.name,
            default: property.default ?? '',
            description: property.description,
          })),
          'No component custom properties.',
        ),
      ].join('\n'),
    ),
    '',
  );

  // Tokens read by the compiled CSS.
  const ownProperties = new Set(docsList.flatMap((doc) => doc.cssProperties.map((property) => property.name)));
  const tokenRows = input.cssVariables
    .filter((name) => !ownProperties.has(name))
    .map((name) => ({name, token: input.tokens.get(name)}));
  push(
    '## Tokens',
    '',
    'Design tokens the component reads. Values follow the active colour scheme.',
    '',
    table(
      `Design tokens used by ${docs.folder}`,
      [
        {key: 'name', label: 'Token', kind: 'code'},
        {key: 'category', label: 'Category'},
        {key: 'light', label: 'Light', kind: 'swatch'},
        {key: 'dark', label: 'Dark', kind: 'swatch'},
        {key: 'status', label: 'Status', kind: 'badge'},
      ],
      tokenRows.map(({name, token}) => ({
        name,
        category: token?.category ?? '',
        light: token?.light ?? '',
        dark: token?.dark ?? '',
        status: token ? tokenStatusLabel(token.status) : 'unknown',
        statusTone:
          token?.status === 'provisional' ? 'warning' : token?.status === 'astryx-retained' ? 'info' : undefined,
      })),
      'This component reads no design tokens.',
    ),
    '',
  );

  // Form semantics: authored text, then the generated facts.
  const formFacts = parityEntries.filter(([, entry]) => entry.form).map(([id, entry]) => ({id, entry}));
  push('## Form semantics', '', authored(s, 'Form semantics'), '');
  if (formFacts.length > 0) {
    push(
      table(
        'Form association',
        [
          {key: 'tag', label: 'Element', kind: 'code'},
          {key: 'associated', label: 'Form-associated'},
          {key: 'notes', label: 'Notes'},
        ],
        formFacts.map(({entry}) => ({
          tag: entry.tag ? tagText(entry.tag) : '',
          associated: entry.form?.formAssociated ? 'yes' : 'no',
          notes: entry.form?.notes ?? '',
        })),
      ),
      '',
    );
  }

  // Keyboard, from parity.json.
  const keyboardRows = parityEntries.flatMap(([, entry]) =>
    (entry.keyboard ?? []).map((row) => ({
      element: entry.tag ? tagText(entry.tag) : '',
      keys: row.keys,
      action: row.action,
      when: row.when ?? '',
    })),
  );
  push(
    '## Keyboard interactions',
    '',
    table(
      'Keyboard interactions',
      [
        {key: 'element', label: 'Element', kind: 'code'},
        {key: 'keys', label: 'Keys', kind: 'kbd'},
        {key: 'action', label: 'Action'},
        {key: 'when', label: 'When'},
      ],
      keyboardRows,
      'This component has no keyboard interactions of its own.',
    ),
    '',
  );

  push('## Screen-reader expectations', '', authored(s, 'Screen-reader expectations'), '');

  push('## Localisation', '', authored(s, 'Localisation'), '');
  push(
    table(
      'Message ids',
      [
        {key: 'id', label: 'Message id', kind: 'code'},
        {key: 'english', label: 'English'},
      ],
      input.messages.map((message) => ({id: message.id, english: message.english ?? '(not in any catalog)'})),
      'This component reads no message ids.',
    ),
    '',
  );

  push('## Consumer responsibilities', '', authored(s, 'Consumer responsibilities'), '');

  return `${out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}
