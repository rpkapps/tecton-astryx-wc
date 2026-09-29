import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {
  checkParity,
  docsWithoutParity,
  expectedApiNames,
  loadSchema,
  type Manifest,
} from './lib/parity.ts';
import {PATHS} from './lib/paths.ts';

const schema = loadSchema(PATHS.paritySchema);
const docsSchema = loadSchema(PATHS.docsFrontmatterSchema);

const manifest: Manifest = {
  baseline: {commit: 'ca632c6594b03aa3933ce9b35d1f6128fbad7a47'},
  entries: [
    {
      id: 'core.button',
      name: 'Button',
      category: 'Action',
      package: '@astryxdesign/core',
      kind: 'component',
      status: 'stable',
      props: [{name: 'variant'}, {name: 'isDisabled'}, {name: 'icon'}],
      events: ['onClick'],
      slots: {children: true, contentProps: ['icon', 'endContent'], renderProps: []},
    },
    {
      id: 'core.text',
      name: 'Text',
      package: '@astryxdesign/core',
      kind: 'component',
      status: 'stable',
      props: [{name: 'type'}],
    },
  ],
};

const entry = (over: Record<string, unknown> = {}) => ({
  tag: 'tct-button',
  status: 'in-progress',
  upstream: {name: 'Button', path: 'packages/core/src/Button/Button.tsx', commit: 'ca632c6'},
  api: [
    {upstream: 'variant', kind: 'prop', as: 'attribute', target: 'variant'},
    {upstream: 'isDisabled', kind: 'prop', as: 'attribute', target: 'disabled'},
    {upstream: 'icon', kind: 'prop', as: 'slot', target: 'icon'},
    {upstream: 'onClick', kind: 'event', as: 'native-event', target: 'click'},
    {upstream: 'endContent', kind: 'prop', as: 'slot', target: 'end'},
  ],
  ...over,
});

function project(folder: string, parity: unknown, extra: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'tct-parity-'));
  const dir = join(root, 'packages/components/src', folder);
  mkdirSync(dir, {recursive: true});
  const file = join(dir, 'parity.json');
  writeFileSync(file, JSON.stringify(parity));
  for (const [name, content] of Object.entries(extra)) {
    mkdirSync(dirname(join(dir, name)), {recursive: true});
    writeFileSync(join(dir, name), content);
  }
  return {root, file};
}

const docsFile = (over: Record<string, string> = {}, omit: string[] = []) => {
  const fields: Record<string, string> = {
    title: 'title: Button',
    folder: 'folder: button',
    category: 'category: Action',
    entries: 'entries: [Button]',
    summary: 'summary: Triggers an action when activated.',
    examples: 'examples: [variants]',
    keywords: 'keywords: [button, btn, cta]',
    dense: [
      'dense:',
      '  description: action trigger',
      '  usage: Triggers an action.',
      '  bestPractices:',
      "    - {do: true, text: 'Primary for the main action.'}",
      '  properties:',
      '    variant: visual style variant',
      '    isDisabled: disabled state',
      '    disabled: disabled state',
    ].join('\n'),
    ...over,
  };
  const body = Object.entries(fields)
    .filter(([key]) => !omit.includes(key))
    .map(([, value]) => value)
    .join('\n');
  return `---\n${body}\n---\n\n## Purpose\n`;
};

const problems = (parity: unknown, extra?: Record<string, string>, cem?: unknown) => {
  const {root, file} = project('button', parity, extra);
  return checkParity({manifest, schema, docsSchema, files: [file], root, cem}).problems.map(
    (p) => p.message,
  );
};

describe('expectedApiNames', () => {
  it('unions props, callbacks and content/render slot props', () => {
    expect(expectedApiNames(manifest.entries[0]!)).toEqual([
      'endContent',
      'icon',
      'isDisabled',
      'onClick',
      'variant',
    ]);
  });
});

describe('checkParity', () => {
  it('passes a complete record', () => {
    expect(
      problems({folder: 'button', workPackage: 'WP-F', entries: {'core.button': entry()}}),
    ).toEqual([]);
  });

  it('passes with no files at all', () => {
    expect(checkParity({manifest, schema, docsSchema, files: []}).problems).toEqual([]);
  });

  it('reports schema violations and stops there', () => {
    const messages = problems({
      folder: 'button',
      workPackage: 'wp',
      entries: {'core.button': {status: 'nope'}},
    });
    expect(messages.some((m) => m.startsWith('schema:'))).toBe(true);
  });

  it('requires a reason for waived rows and a target otherwise', () => {
    const rows = entry().api.map((row) =>
      row.upstream === 'icon' ? {upstream: 'icon', kind: 'prop', as: 'waived'} : row,
    );
    expect(
      problems({
        folder: 'button',
        workPackage: 'WP-F',
        entries: {'core.button': entry({api: rows})},
      }).join('\n'),
    ).toContain('reason');
    const noTarget = entry().api.map((row) =>
      row.upstream === 'icon' ? {upstream: 'icon', kind: 'prop', as: 'slot'} : row,
    );
    expect(
      problems({
        folder: 'button',
        workPackage: 'WP-F',
        entries: {'core.button': entry({api: noTarget})},
      }).join('\n'),
    ).toContain('target');
  });

  it('requires every upstream prop, callback and content prop to be mapped or waived', () => {
    const rows = entry().api.filter(
      (row) => row.upstream !== 'onClick' && row.upstream !== 'endContent',
    );
    const messages = problems({
      folder: 'button',
      workPackage: 'WP-F',
      entries: {'core.button': entry({api: rows})},
    });
    expect(messages).toEqual([
      'core.button: api rows missing for upstream "endContent", "onClick"',
    ]);
  });

  it('skips coverage for not-started entries', () => {
    expect(
      problems({
        folder: 'button',
        workPackage: 'WP-F',
        entries: {'core.button': entry({status: 'not-started', api: []})},
      }),
    ).toEqual([]);
  });

  it('rejects unknown manifest ids, folder mismatches and duplicate claims', () => {
    expect(
      problems({folder: 'button', workPackage: 'WP-F', entries: {'core.nothing': entry()}}),
    ).toEqual(['core.nothing: no such entry in the upstream parity manifest']);
    expect(
      problems({folder: 'other', workPackage: 'WP-F', entries: {'core.button': entry()}})[0],
    ).toContain('directory is "button"');
    const a = project('button', {
      folder: 'button',
      workPackage: 'WP-F',
      entries: {'core.button': entry()},
    });
    const b = project('button', {
      folder: 'button',
      workPackage: 'WP-F',
      entries: {'core.button': entry()},
    });
    const result = checkParity({
      manifest,
      schema,
      docsSchema,
      files: [a.file, b.file],
      root: a.root,
    });
    expect(result.problems.some((p) => p.message.includes('also claimed'))).toBe(true);
  });

  it('requires tests and docs for implemented entries', () => {
    const parity = {
      folder: 'button',
      workPackage: 'WP-F',
      entries: {'core.button': entry({status: 'implemented'})},
    };
    expect(problems(parity)).toEqual([
      'core.button: status implemented but the folder has no *.test.ts',
      'core.button: status implemented but button.docs.md is missing',
    ]);
    expect(
      problems(parity, {
        'tct-button.test.ts': '',
        'button.docs.md': docsFile(),
        'examples/variants.html': '',
      }),
    ).toEqual([]);
  });

  it('checks CEM targets when a manifest exists', () => {
    const cem = {
      modules: [
        {
          declarations: [
            {
              tagName: 'tct-button',
              attributes: [{name: 'variant'}],
              members: [{name: 'disabled'}],
              slots: [{name: 'icon'}, {name: ''}],
              events: [],
            },
          ],
        },
      ],
    };
    const parity = {folder: 'button', workPackage: 'WP-F', entries: {'core.button': entry()}};
    // `end` (slot) and `variant`/`disabled` (present): only `end` is missing; native-event `click` is not checked.
    expect(problems(parity, undefined, cem)).toEqual([
      'core.button: api "endContent" targets slot "end", absent from the CEM for tct-button',
    ]);
  });

  it('accepts an HTML global attribute as an attribute target, but not as another kind', () => {
    const cem = {modules: [{declarations: [{tagName: 'tct-button', attributes: [], members: []}]}]};
    const api = [
      {upstream: 'hasAutoFocus', kind: 'prop', as: 'attribute', target: 'autofocus'},
      {upstream: 'autoFocusProp', kind: 'prop', as: 'property', target: 'autofocus'},
    ];
    const parity = {folder: 'button', workPackage: 'WP-F', entries: {'core.button': entry({api})}};
    const cemProblems = problems(parity, undefined, cem).filter((p) =>
      p.includes('absent from the CEM'),
    );
    expect(cemProblems).toEqual([
      'core.button: api "autoFocusProp" targets property "autofocus", absent from the CEM for tct-button',
    ]);
  });

  describe('docs frontmatter (D-011)', () => {
    const parity = {folder: 'button', workPackage: 'WP-F', entries: {'core.button': entry()}};
    const files = (docs: string) => ({
      'button.docs.md': docs,
      'examples/variants.html': '<!-- title: Variants -->',
    });

    it('accepts complete frontmatter', () => {
      expect(problems(parity, files(docsFile()))).toEqual([]);
    });

    it('requires keywords and dense', () => {
      expect(problems(parity, files(docsFile({}, ['keywords'])))).toEqual([
        'button.docs.md frontmatter: /keywords is required',
      ]);
      expect(problems(parity, files(docsFile({}, ['dense'])))).toEqual([
        'button.docs.md frontmatter: /dense is required',
      ]);
    });

    it('validates the shape of keywords and dense', () => {
      const messages = problems(
        parity,
        files(
          docsFile({
            keywords: 'keywords: []',
            dense:
              'dense:\n  description: x\n  usage: y\n  bestPractices: []\n  properties: {a: b}',
          }),
        ),
      );
      expect(messages).toEqual([
        'button.docs.md frontmatter: /keywords must have at least 1 items',
        'button.docs.md frontmatter: /dense/bestPractices must have at least 1 items',
      ]);
    });

    it('reports missing or malformed frontmatter', () => {
      expect(problems(parity, files('# No frontmatter\n'))).toEqual([
        'button.docs.md: missing frontmatter (CONVENTIONS §7)',
      ]);
      expect(problems(parity, files('---\ntitle: [x\n---\n'))[0]).toContain('unterminated');
    });

    it('checks folder, category, example files and entries against parity.json', () => {
      const messages = problems(parity, {
        'button.docs.md': docsFile({
          folder: 'folder: other',
          category: 'category: Nonsense',
          entries: 'entries: [Other]',
          examples: 'examples: [variants, missing]',
        }),
        'examples/variants.html': '',
      });
      expect(messages).toEqual([
        'button.docs.md: frontmatter folder is "other"',
        'button.docs.md: category "Nonsense" is not one of Action',
        'button.docs.md: example "missing" has no examples/missing.html',
        'button.docs.md: entries is missing "Button" (present in parity.json)',
        'button.docs.md: entries lists "Other", which parity.json does not record',
      ]);
    });

    it('requires dense.properties to describe every public CEM API name', () => {
      const cem = {
        modules: [
          {
            declarations: [
              {
                tagName: 'tct-button',
                attributes: [
                  {name: 'variant'},
                  {name: 'is-disabled', fieldName: 'isDisabled'},
                  {name: 'href'},
                ],
                members: [
                  {name: 'variant'},
                  {name: 'isDisabled'},
                  {name: 'focus', inheritedFrom: {name: 'HTMLElement'}},
                  {name: '_internal'},
                  {name: 'click'},
                ],
                slots: [{name: ''}, {name: 'icon'}],
                events: [{name: 'tct-x'}],
              },
            ],
          },
        ],
      };
      const messages = problems(parity, files(docsFile()), cem).filter((m) =>
        m.includes('dense.properties'),
      );
      expect(messages).toEqual([
        'button.docs.md: dense.properties does not describe tct-button API "href"',
        'button.docs.md: dense.properties does not describe tct-button API "click"',
        'button.docs.md: dense.properties does not describe tct-button API "default"',
        'button.docs.md: dense.properties does not describe tct-button API "icon"',
        'button.docs.md: dense.properties does not describe tct-button API "tct-x"',
      ]);
    });

    it('flags a docs file without a parity.json', () => {
      const root = mkdtempSync(join(tmpdir(), 'tct-parity-'));
      mkdirSync(join(root, 'packages/components/src/orphan'), {recursive: true});
      writeFileSync(join(root, 'packages/components/src/orphan/orphan.docs.md'), docsFile());
      expect(docsWithoutParity(root)).toEqual([
        join(root, 'packages/components/src/orphan/orphan.docs.md'),
      ]);
    });
  });
});
