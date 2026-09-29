/**
 * Docs pipeline tests against the sample component fixture: shared CSS, docs model, the component
 * page (all A§16.3 sections in order), the agent registry and llms.txt, and the MDX escaping that
 * makes authored Markdown safe to embed.
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {buildRegistry} from '../agent-registry/build.ts';
import {renderLlmsFull, renderLlmsTxt} from '../agent-registry/llms.ts';
import {analyzeComponents} from '../cem/analyze.ts';
import {createFixtureTree, type FixtureTree} from '../cem/testing.ts';
import {cloakCss, lightDomCss} from '../css/shared.ts';
import {cemElements, type CemPackage} from '../lib/cem.ts';
import {
  REQUIRED_SECTIONS,
  componentFolderNames,
  customPropertiesUsed,
  loadComponentDocs,
  missingSections,
  parseExample,
  splitSections,
} from '../lib/docs-model.ts';
import {loadManifest} from '../lib/parity.ts';
import {PATHS} from '../lib/paths.ts';
import {COMPONENT_SECTION_ORDER, renderComponentPage} from './component-page.ts';
import {escapeMdx} from './mdx.ts';
import {parseOpenQuestions} from './site-pages.ts';

let tree: FixtureTree;
let cem: CemPackage;
beforeAll(() => {
  tree = createFixtureTree();
  cem = analyzeComponents(tree);
});
afterAll(() => {
  tree.dispose();
});

describe('cloak.css and light-dom.css', () => {
  it('cloaks defined tags fail-open and reserves space from the JSDoc', () => {
    const css = cloakCss(cem);
    expect(css).toContain('tct-sample-badge');
    expect(css).toContain(':not(:defined)');
    expect(css).toContain('animation: tct-cloak-reveal 0.2s var(--tct-cloak-timeout, 2s) forwards;');
    expect(css).toContain('display: inline-flex;');
    expect(css).toContain('min-block-size: 1.5rem;');
    expect(css).toContain('@layer tecton.reset');
  });

  it('is only a layer declaration when there are no components', () => {
    const css = cloakCss({schemaVersion: '1.0.0', modules: []});
    expect(css).toContain('@layer tecton.reset, tecton.tokens, tecton.light-dom;');
    expect(css).not.toContain(':not(:defined)');
  });

  it('refuses values that could break out of a declaration', () => {
    const bad = structuredClone(cem);
    for (const module of bad.modules) {
      for (const declaration of module.declarations ?? []) {
        if (declaration.tagName) declaration['x-tct'] = {cloakDisplay: 'block; } body { display: none'};
      }
    }
    expect(() => cloakCss(bad)).toThrow(/not a plain CSS keyword/);
  });

  it('concatenates *.light.css files by folder', () => {
    const dir = join(tree.componentsSrc, 'lightfam');
    mkdirSync(dir, {recursive: true});
    writeFileSync(join(dir, 'tct-x.light.css'), '@layer tecton.light-dom {\n  :where(tct-x) p { margin: 0; }\n}\n');
    const css = lightDomCss(tree.componentsSrc);
    expect(css).toContain('/* lightfam/tct-x.light.css */');
    expect(css).toContain(':where(tct-x) p');
    expect(lightDomCss(join(tree.root, 'nowhere'))).toContain('@layer tecton.light-dom');
  });
});

describe('docs model', () => {
  it('splits H2 sections and ignores headings inside code fences', () => {
    const {preamble, sections} = splitSections('intro\n\n## A\n\ntext\n\n```md\n## not a heading\n```\n\n## B\n\nmore\n');
    expect(preamble).toBe('intro');
    expect(sections.map((s) => s.heading)).toEqual(['A', 'B']);
    expect(sections[0]!.body).toContain('## not a heading');
  });

  it('reports missing or empty required sections', () => {
    expect(missingSections([{heading: 'Purpose', body: 'x'}, {heading: 'Anatomy', body: ''}])).toContain('Anatomy');
    expect(missingSections([])).toHaveLength(REQUIRED_SECTIONS.length);
  });

  it('parses the example header comment and strips it from the source', () => {
    const example = parseExample('a', '/a.html', '<!-- title: Variants; description: Every one; really. -->\n<p>x</p>\n');
    expect(example).toMatchObject({title: 'Variants', description: 'Every one; really.', source: '<p>x</p>'});
    expect(parseExample('b', '/b.html', '<p>y</p>').title).toBe('b');
  });

  it('loads the fixture folder: frontmatter, sections, examples in order, parity', () => {
    expect(componentFolderNames(tree.componentsSrc)).toEqual(['sample-badge']);
    const docs = loadComponentDocs(tree.componentsSrc, 'sample-badge');
    expect(docs.problems).toEqual([]);
    expect(docs.frontmatter?.category).toBe('Feedback & Status');
    expect(docs.examples.map((example) => example.id)).toEqual(['variants', 'removable']);
    expect(missingSections(docs.sections)).toEqual([]);
    expect(docs.parity?.entries['core.badge']?.tag).toBe('tct-sample-badge');
    expect(customPropertiesUsed(docs.dir)).toContain('--color-neutral');
    expect(customPropertiesUsed(docs.dir).every((name) => !name.startsWith('--_'))).toBe(true);
  });
});

describe('MDX escaping of authored Markdown', () => {
  it('escapes < { } outside code, keeps code spans and fences verbatim', () => {
    const out = escapeMdx('Remove <label> and {value} `a<b>{c}`\n\n```html\n<x-y a={1}></x-y>\n```\n');
    expect(out).toContain('Remove &lt;label> and &#123;value&#125; `a<b>{c}`');
    expect(out).toContain('<x-y a={1}></x-y>');
  });

  it('defuses lines MDX would parse as ESM', () => {
    expect(escapeMdx('import the styles first')).toBe('&#105;mport the styles first');
    expect(escapeMdx('export it')).toBe('&#101;xport it');
    expect(escapeMdx('important note')).toBe('important note');
  });
});

describe('component page', () => {
  it('has every A§16.3 section, in order, with the sample data', () => {
    const docs = loadComponentDocs(tree.componentsSrc, 'sample-badge');
    const elements = cemElements(cem);
    const page = renderComponentPage({
      docs,
      elements,
      cssVariables: customPropertiesUsed(docs.dir),
      tokens: new Map(),
      messages: [],
      classFiles: [{className: 'TctSampleBadge', file: 'tct-sample-badge'}],
    });
    const headings = [...page.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(headings).toEqual([...COMPONENT_SECTION_ORDER]);
    expect(page).toContain("import example0 from '@examples/sample-badge/examples/variants.html?raw';");
    expect(page).toContain('<Example source={example1} />');
    expect(page).toContain('SAMPLEBADGE-01');
    expect(page).toContain('Enter, Space');
    expect(page).toContain("import '@tecton-astryx/components/sample-badge';");
    // authored text with an unclosed tag must not reach MDX raw
    expect(page).toContain('Remove &lt;label>');
    expect(page).not.toContain('Remove <label>');
  });
});

describe('agent registry and llms.txt', () => {
  it('describes the component from CEM, frontmatter, examples and parity', () => {
    const registry = buildRegistry({
      cem,
      componentsSrc: tree.componentsSrc,
      folders: componentFolderNames(tree.componentsSrc),
      manifest: loadManifest(PATHS.manifest),
      guides: [{slug: 'getting-started', title: 'Getting started', description: 'Begin.', order: 1, body: '## Install\n\nRun it.\n'}],
    });
    expect(registry.categories).toHaveLength(11);
    const [component] = registry.components;
    expect(component).toMatchObject({
      name: 'Badge',
      tag: 'tct-sample-badge',
      category: 'Feedback & Status',
      keywords: expect.arrayContaining(['badge', 'pill']) as string[],
      related: ['text'],
      status: 'implemented',
      documented: true,
      url: '/components/feedback-and-status/sample-badge/',
    });
    expect(component!.dense?.bestPractices).toHaveLength(2);
    expect(component!.elements[0]!.events.map((event) => event.name)).toEqual(['click', 'tct-remove']);
    expect(component!.elements[0]!.keyboard).toHaveLength(1);
    expect(component!.examples.map((example) => example.id)).toEqual(['variants', 'removable']);
    expect(component!.sections.Purpose).toContain('short status');
    expect(registry.topics[0]).toMatchObject({slug: 'getting-started', url: '/guides/getting-started/'});
    expect(registry.topics[0]!.sections.find((s) => s.heading === 'Install')?.body).toBe('Run it.');

    const index = renderLlmsTxt(registry);
    expect(index).toMatch(/^# Tecton Astryx Web Components/);
    expect(index).toContain('- [Getting started](/guides/getting-started/): Begin.');
    expect(index).toContain('- [Badge](/components/feedback-and-status/sample-badge/): `<tct-sample-badge>`: Highlights');
    const full = renderLlmsFull(registry);
    expect(full).toContain('`tct-remove` (bubbles, composed, cancelable)');
    expect(full).toContain('```html');
  });

  it('is valid with zero components', () => {
    const registry = buildRegistry({
      cem: {schemaVersion: '1.0.0', modules: []},
      componentsSrc: join(tree.root, 'nowhere'),
      folders: [],
      manifest: loadManifest(PATHS.manifest),
      guides: [],
    });
    expect(registry.components).toEqual([]);
    expect(renderLlmsTxt(registry)).toContain('No components are documented yet.');
    expect(renderLlmsFull(registry)).toContain('No components are documented yet.');
  });
});

describe('open questions', () => {
  it('parses the table and marks the resolved range', () => {
    const questions = parseOpenQuestions(
      '**Q-01 … Q-02 were resolved on 2026-09-29; see D-013.**\n\n| Id | Question | Context |\n| --- | --- | --- |\n| Q-01 | Old? | ctx |\n| Q-03 | New? | more |\n',
    );
    expect(questions).toEqual([
      {id: 'Q-01', question: 'Old?', context: 'ctx', resolved: true},
      {id: 'Q-03', question: 'New?', context: 'more', resolved: false},
    ]);
  });
});
