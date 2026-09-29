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
import {elementDoc} from '../lib/element-api.ts';
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
import {exemptionProblems, parseExampleHeader} from '../lib/example-header.ts';
import {publicText, tokenStatusLabel} from '../lib/public-text.ts';
import {toPublicRegistry} from '../agent-registry/build.ts';
import {categoryPage, componentsOverviewPage, tokensPage} from './site-pages.ts';
import {parseOpenQuestions} from './internal-reports.ts';

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
    // the public page names neither the upstream system nor its mapping/differences sections
    expect(page).not.toMatch(/Astryx|Upstream mapping|Differences from/);
    expect(page).not.toContain('SAMPLEBADGE-01');
    expect(page).toContain('Enter, Space');
    expect(page).toContain("import '@tecton-wc/components/sample-badge';");
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
    expect(index).toMatch(/^# Tecton Web Components/);
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

describe('public site never names the upstream design system', () => {
  it('publicText drops target and upstream pointers and neutralises the rest', () => {
    expect(publicText('The pill (Astryx target `astryx-badge`).')).toBe('The pill.');
    expect(publicText('The native button. Astryx target `astryx-button`.')).toBe('The native button.');
    expect(publicText('Registered icon name (upstream `icon`): an Astryx role such as `close`')).toBe(
      'Registered icon name: a role such as `close`',
    );
    expect(publicText('muted (tecton-astryx name)')).toBe('muted');
    expect(publicText('the default Astryx border maps to Tecton')).toBe('the default border maps to Tecton');
    // package names and message ids are technical identifiers, not prose, and pass through untouched
    const identifiers = 'import x from "@tecton-wc/core/x.js"; id `@tct.button.loading`';
    expect(publicText(identifiers)).toBe(identifiers);
    // the owner's reference theme, cited in parity notes, and upstream data attributes
    expect(publicText('as in tecton-astryx components.ts `item`; tecton-astryx\'s avatar')).toBe(
      "as in the Tecton reference theme's components.ts `item`; the Tecton reference theme's avatar",
    );
    expect(publicText('keyed on data-astryx-media')).toBe('keyed on data-upstream-media');
    expect(tokenStatusLabel('retained-default')).toBe('retained default');
    expect(tokenStatusLabel('tecton-binding')).toBe('Tecton (bound)');
  });

  it('scrubs element API text', () => {
    const doc = elementDoc(cemElements(cem)[0]!);
    expect(JSON.stringify(doc)).not.toMatch(/astryx/i);
    expect(doc.cssParts[0]?.description).toBe('The visible pill.');
  });

  it('overview, category and token pages print no upstream name and list only documented components', () => {
    const pages = new Map([
      ['sample-badge', {category: 'Feedback & Status', title: 'Badge', summary: 'A pill.', tags: ['tct-sample-badge']}],
    ]);
    const overview = componentsOverviewPage(pages);
    const category = categoryPage('Feedback & Status', pages);
    const empty = categoryPage('Action', pages);
    const tokens = tokensPage({
      counts: {tokens: 1, palette: 1, byStatus: {'retained-default': 1}},
      provisionalNonTokens: [],
      retainedNonTokens: [],
      tectonDerivedNonTokens: [],
      tokens: [
        {name: '--x', category: 'motion', light: '1s', dark: '1s', source: 's', status: 'retained-default', description: 'Kept (tecton-astryx name)'},
      ],
    });
    for (const page of [overview, category, empty, tokens]) expect(page).not.toMatch(/astryx/i);
    expect(category).toContain('/components/feedback-and-status/sample-badge/');
    expect(empty).toContain('No components in this category are documented yet.');
    expect(tokens).toContain('retained default');
  });

  it('the public registry omits upstream, mapping, hooks and status names', () => {
    const registry = buildRegistry({
      cem,
      componentsSrc: tree.componentsSrc,
      folders: componentFolderNames(tree.componentsSrc),
      manifest: loadManifest(PATHS.manifest),
      guides: [],
    });
    expect(JSON.stringify(registry)).toMatch(/astryx/i); // the internal registry keeps the mapping
    const publicRegistry = toPublicRegistry(registry);
    expect(JSON.stringify(publicRegistry)).not.toMatch(/astryx/i);
    expect('upstream' in publicRegistry).toBe(false);
    expect('entries' in publicRegistry.components[0]!).toBe(false);
    expect(renderLlmsTxt(publicRegistry)).not.toMatch(/astryx|parity|upstream/i);
    expect(renderLlmsFull(publicRegistry)).not.toMatch(/astryx/i);
  });
});

describe('example header and a11y exemptions', () => {
  it('parses title, description and an exemption with its reason', () => {
    const header = parseExampleHeader(
      '<!-- title: Colours; description: Roles; and more.; a11y-exempt: color-contrast | Disabled text is exempt outside a control, see WCAG. -->\n<p>x</p>',
    );
    expect(header).toMatchObject({
      title: 'Colours',
      description: 'Roles; and more.',
      a11yExempt: {rules: ['color-contrast'], reason: 'Disabled text is exempt outside a control, see WCAG.'},
    });
    expect(header!.length).toBeGreaterThan(20);
    expect(parseExampleHeader('<p>no header</p>')).toBeUndefined();
    expect(parseExampleHeader('<!-- title: T -->')?.a11yExempt).toBeUndefined();
  });

  it('rejects exemptions without a reason or for rules that may not be exempted', () => {
    expect(exemptionProblems(undefined)).toEqual([]);
    expect(exemptionProblems({rules: ['color-contrast'], reason: 'Why it holds, in a sentence.'})).toEqual([]);
    expect(exemptionProblems({rules: ['color-contrast'], reason: ''}).join()).toMatch(/needs a reason/);
    expect(exemptionProblems({rules: ['image-alt'], reason: 'Because reasons, long enough.'}).join()).toMatch(
      /cannot be exempted/,
    );
    expect(exemptionProblems({rules: [], reason: 'Because reasons, long enough.'}).join()).toMatch(/no rule/);
  });
});
