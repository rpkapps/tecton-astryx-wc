/**
 * A small, deterministic agent registry for tests: real-shaped data for a handful of elements (layout,
 * button, text, dialog, a compound menu), two controllers and two guides. Command tests use it so they do not
 * depend on the library's growing catalogue; the contract suite additionally runs against the real registry.
 */
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execute, type ExecuteResult} from '../index.ts';
import type {
  AgentRegistry,
  RegistryAttribute,
  RegistryComponent,
  RegistryElement,
} from '../registry/types.ts';

const SPACING = ['0', '0.5', '1', '1.5', '2', '3', '4', '5', '6', '8', '10'];

const attribute = (
  name: string,
  type: string,
  values?: string[],
  description = `${name} attribute`,
): RegistryAttribute => ({
  name,
  property: name,
  type,
  ...(values ? {values} : {}),
  reflects: false,
  description,
});

function element(
  tag: string,
  attributes: RegistryAttribute[],
  slots: string[] = [''],
  extra: Partial<RegistryElement> = {},
): RegistryElement {
  return {
    tag,
    class: `Tct${tag}`,
    summary: `${tag} summary`,
    description: `${tag} description`,
    attributes,
    properties: [],
    methods: [],
    slots: slots.map((name) => ({name, description: name ? `${name} slot` : 'default slot'})),
    events: [],
    cssParts: [{name: 'base', description: 'the box'}],
    cssStates: [],
    cssProperties: [],
    keyboard: [],
    ...extra,
  };
}

function component(
  folder: string,
  name: string,
  category: string,
  elements: RegistryElement[],
  extra: Partial<RegistryComponent> = {},
): RegistryComponent {
  const props: Record<string, string> = {};
  for (const each of elements) {
    for (const attr of each.attributes) props[attr.name] = `${attr.name} in one line`;
    for (const slot of each.slots) props[slot.name || 'default'] = 'slot in one line';
    for (const event of each.events) props[event.name] = 'event in one line';
    for (const method of each.methods) props[method.name] = 'method in one line';
  }
  return {
    id: folder,
    name,
    folder,
    tag: elements[0]!.tag,
    tags: elements.map((each) => each.tag),
    category,
    url: `/components/${category.toLowerCase()}/${folder}/`,
    summary: `${name} summary.`,
    keywords: [folder, name.toLowerCase()],
    related: [],
    status: 'implemented',
    documented: true,
    dense: {
      description: `${name} dense description`,
      usage: `${name} usage sentence.`,
      bestPractices: [
        {do: true, text: `Do use ${name} well.`},
        {do: false, text: `Do not misuse ${name}.`},
      ],
      properties: props,
    },
    elements,
    examples: [
      {
        id: 'basic',
        title: 'Basic',
        description: `${name} basic example`,
        source: `<${elements[0]!.tag}></${elements[0]!.tag}>`,
      },
      {
        id: 'second',
        title: 'Second',
        description: 'another',
        source: `<${elements[0]!.tag} data-x></${elements[0]!.tag}>`,
      },
    ],
    sourceFiles: [`tct-${folder}.ts`, `tct-${folder}.styles.css`, 'define.ts'],
    sections: {Purpose: `${name} purpose.`, 'When to use': `Use ${name} when you need one.`},
    ...extra,
  };
}

const boxAttributes = (): RegistryAttribute[] => [
  attribute('padding', 'SpacingStep | undefined', SPACING),
  attribute('width', 'BoxSize | undefined'),
  attribute('height', 'BoxSize | undefined'),
  attribute('max-width', 'BoxSize | undefined'),
];

const stackAttributes = (): RegistryAttribute[] => [
  attribute('gap', 'SpacingStep | undefined', SPACING),
  attribute('justify', 'StackMainAlignment | undefined', [
    'start',
    'center',
    'end',
    'between',
    'around',
    'evenly',
  ]),
  attribute('alignment', 'StackCrossAlignment | undefined', ['start', 'center', 'end', 'stretch']),
  attribute('h-align', 'StackAlignment | undefined', [
    'start',
    'center',
    'end',
    'stretch',
    'between',
  ]),
  attribute('v-align', 'StackAlignment | undefined', [
    'start',
    'center',
    'end',
    'stretch',
    'between',
  ]),
  attribute('wrap', 'StackWrap', ['nowrap', 'wrap', 'wrap-reverse']),
  attribute('scrollable', 'boolean'),
  ...boxAttributes(),
];

export function fixtureRegistry(): AgentRegistry {
  const button = element(
    'tct-button',
    [
      attribute('variant', 'ButtonVariant', ['primary', 'secondary', 'ghost', 'destructive']),
      attribute('size', 'ButtonSize | undefined', ['sm', 'md', 'lg']),
      attribute('label', 'string'),
      attribute('disabled', 'boolean'),
      attribute('loading', 'boolean'),
      attribute('href', 'string | undefined'),
      attribute('selected', 'boolean'),
    ],
    ['', 'icon', 'end'],
    {
      events: [{name: 'click', description: 'native click', native: true, fields: []}],
      cssStates: [{name: 'busy', description: 'while loading'}],
      keyboard: [{keys: 'Enter, Space', action: 'activate'}],
    },
  );
  const dialog = element(
    'tct-dialog',
    [
      attribute('open', 'boolean'),
      attribute('heading', 'string'),
      attribute('width', 'BoxSize | undefined'),
    ],
    ['', 'footer'],
    {
      methods: [
        {
          name: 'show',
          signature: '() => Promise<void>',
          parameters: [],
          returns: 'Promise<void>',
          description: 'opens it',
        },
      ],
    },
  );
  const menu = element('tct-dropdown-menu', [attribute('label', 'string')]);
  const menuItem = element('tct-dropdown-menu-item', [attribute('disabled', 'boolean')]);

  const components: RegistryComponent[] = [
    component('button', 'Button', 'Action', [button], {
      keywords: ['button', 'btn', 'cta', 'submit', 'action', 'primary'],
      related: ['dialog'],
    }),
    component('dialog', 'Dialog', 'Overlay', [dialog], {
      keywords: ['dialog', 'modal', 'popup', 'confirm'],
    }),
    component('dropdown-menu', 'Dropdown Menu', 'Action', [menu, menuItem], {
      keywords: ['menu', 'dropdown', 'actions'],
    }),
    component('vstack', 'VStack', 'Layout', [element('tct-vstack', stackAttributes())], {
      keywords: ['vstack', 'column', 'stack'],
    }),
    component('hstack', 'HStack', 'Layout', [element('tct-hstack', stackAttributes())], {
      keywords: ['hstack', 'row', 'stack'],
    }),
    component(
      'stack',
      'Stack',
      'Layout',
      [
        element('tct-stack', [
          attribute('direction', 'StackDirection', ['horizontal', 'vertical']),
          ...stackAttributes(),
        ]),
        element('tct-stack-item', [
          attribute('size', 'StackItemSize', ['static', 'fill']),
          attribute('scrollable', 'boolean'),
        ]),
      ],
      {keywords: ['stack', 'flex']},
    ),
    component(
      'grid',
      'Grid',
      'Layout',
      [
        element('tct-grid', [
          attribute('columns', 'GridColumns | undefined'),
          attribute('column-min-width', 'number | undefined'),
          attribute('column-max', 'number | undefined'),
          attribute('column-repeat', 'GridRepeat', ['fill', 'fit']),
          attribute('gap', 'SpacingStep | undefined', SPACING),
          attribute('row-gap', 'SpacingStep | undefined', SPACING),
          attribute('column-gap', 'SpacingStep | undefined', SPACING),
          ...boxAttributes(),
        ]),
        element('tct-grid-span', [attribute('columns', 'GridSpanColumns | undefined')]),
      ],
      {keywords: ['grid', 'columns']},
    ),
    component(
      'card',
      'Card',
      'Container',
      [
        element('tct-card', [
          attribute('variant', 'CardVariant', ['default', 'muted']),
          ...boxAttributes(),
        ]),
      ],
      {
        keywords: ['card', 'surface', 'panel'],
      },
    ),
    component(
      'text',
      'Text',
      'Content',
      [
        element('tct-text', [
          attribute('size', 'TextSize | undefined', ['sm', 'base', 'lg']),
          attribute('weight', 'TextWeight | undefined', ['normal', 'bold']),
        ]),
      ],
      {
        keywords: ['text', 'typography', 'paragraph'],
      },
    ),
  ];

  return {
    schemaVersion: 2,
    library: {name: 'Tecton Web Components', description: 'Fixture library.'},
    categories: ['Action', 'Container', 'Content', 'Layout', 'Overlay'],
    components,
    controllers: [
      {
        name: 'RovingTabindexController',
        kind: 'controller',
        area: 'controllers',
        import: '@tecton-wc/core/controllers/roving-tabindex.js',
        summary: 'Roving tabindex: a composite is one tab stop.',
        description: 'Roving tabindex: a composite is one tab stop. Arrow keys move focus.',
        example: '#roving = new RovingTabindexController(this, {items: () => []});',
        signature:
          'new RovingTabindexController(host: ReactiveControllerHost, options: RovingOptions)',
        members: [
          {name: 'setActive', signature: 'setActive(item)', summary: 'Makes an item the tab stop.'},
        ],
        usedBy: ['button'],
      },
      {
        name: 'announce',
        kind: 'function',
        area: 'a11y',
        import: '@tecton-wc/core/a11y/announcer.js',
        summary: 'Speaks a message to assistive technology.',
        description: 'Speaks a message to assistive technology.',
        example: '',
        signature: 'function announce(message: string): void',
        members: [],
        usedBy: ['dialog'],
      },
    ],
    topics: [
      {
        slug: 'styling',
        title: 'Styling',
        description: 'How to customise appearance.',
        url: '/guides/styling/',
        sections: [
          {heading: '', body: 'Intro text about styling.'},
          {
            heading: 'Design tokens',
            body: 'Use tokens.\n\n```css\n.a { color: var(--color-text); }\n```',
          },
          {heading: 'Parts', body: '| Part | Meaning |\n| --- | --- |\n| base | the box |'},
          {heading: 'Parts and states', body: 'Both.'},
        ],
      },
      {
        slug: 'forms',
        title: 'Forms',
        description: 'Form association.',
        url: '/guides/forms/',
        sections: [{heading: 'Validation', body: 'Validate on submit.'}],
      },
    ],
    tokens: [],
    tokenCounts: null,
  };
}

/** A temporary directory removed by `dispose`. */
export class Sandbox {
  readonly root: string;
  readonly registryPath: string;

  constructor(registry: AgentRegistry = fixtureRegistry()) {
    this.root = mkdtempSync(join(tmpdir(), 'tct-cli-test-'));
    mkdirSync(join(this.root, 'project'), {recursive: true});
    this.registryPath = join(this.root, 'agent-registry.json');
    writeFileSync(this.registryPath, JSON.stringify(registry));
  }

  /** The project directory commands run in. */
  get cwd(): string {
    return join(this.root, 'project');
  }

  write(path: string, content: string): string {
    const file = join(this.cwd, path);
    mkdirSync(join(file, '..'), {recursive: true});
    writeFileSync(file, content);
    return file;
  }

  /** Runs `tct <argv>` in the project against the sandbox registry. */
  run(
    argv: readonly string[],
    options: {stdin?: string; env?: Record<string, string | undefined>} = {},
  ): Promise<ExecuteResult> {
    return execute(argv, {
      cwd: this.cwd,
      env: {
        ...process.env,
        TCT_NO_NUDGE: '1',
        TCT_AGENT_REGISTRY: this.registryPath,
        ...options.env,
      },
      ...(options.stdin !== undefined ? {stdin: options.stdin} : {}),
    });
  }

  dispose(): void {
    rmSync(this.root, {recursive: true, force: true});
  }
}
