/**
 * The lookup commands: component, docs, controllers, discover, doctor, gap-report. Includes the detail-level
 * contract (brief < compact < full), the dense projection and the text/JSON parity of every view.
 */
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {apiNames} from './format/component.ts';
import {Sandbox, fixtureRegistry} from './testing/fixture.ts';

let sandbox: Sandbox;
beforeEach(() => {
  sandbox = new Sandbox();
});
afterEach(() => {
  sandbox.dispose();
});

// Envelope payloads are checked field by field below; a loose type keeps the assertions readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = <T = any>(stdout: string): T => (JSON.parse(stdout) as {data: T}).data;
const code = (stdout: string) => (JSON.parse(stdout) as {code: string}).code;

describe('tct component', () => {
  it('lists by category, sorted, with imports (names view)', async () => {
    const {stdout, exitCode} = await sandbox.run(['component']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^Components \(9\)$/m);
    expect(stdout).toMatch(/^tct-button +@tecton-wc\/components\/button$/m);
    expect(stdout.indexOf('tct-button')).toBeLessThan(stdout.indexOf('tct-vstack'));
    expect(stdout).toMatch(/Usage: tct component <name>/);
  });

  it('--category filters case-insensitively and rejects an unknown one with the valid list', async () => {
    const layout = await sandbox.run(['component', '--category', 'layout', '--json']);
    expect(Object.keys(data<{components: object}>(layout.stdout).components)).toEqual(['Layout']);
    const unknown = await sandbox.run(['component', '--category', 'nope', '--json']);
    expect(code(unknown.stdout)).toBe('ERR_UNKNOWN_CATEGORY');
    expect(
      (JSON.parse(unknown.stdout) as {suggestions: {name: string}[]}).suggestions.map(
        (s) => s.name,
      ),
    ).toContain('Layout');
  });

  it('list detail levels increase in size: brief < compact < full, all distinct', async () => {
    const out = async (level: string) =>
      (await sandbox.run(['component', '--list', '--detail', level])).stdout;
    const [brief, compact, full] = [await out('brief'), await out('compact'), await out('full')];
    expect(brief.length).toBeGreaterThan(0);
    expect(compact.length).toBeGreaterThan(brief.length);
    expect(full.length).toBeGreaterThan(compact.length);
    expect(new Set([brief, compact, full]).size).toBe(3);
    expect(brief).not.toMatch(/^description:/m);
    expect(compact).toMatch(/^description:/m);
    expect(full).toMatch(/<- '@tecton-wc\/components\/button'/);
  });

  it('--json list is one component.list type across levels, tagged by data.detail', async () => {
    for (const [level, detail] of [
      ['brief', 'names'],
      ['compact', 'compact'],
      ['full', 'full'],
    ] as const) {
      const result = await sandbox.run(['component', '--list', '--detail', level, '--json']);
      const envelope = JSON.parse(result.stdout) as {
        type: string;
        data: {detail: string; components: Record<string, unknown[]>};
      };
      expect(envelope.type).toBe('component.list');
      expect(envelope.data.detail).toBe(detail);
      expect(Object.keys(envelope.data.components)).toContain('Action');
    }
    const compact = data(
      (await sandbox.run(['component', '--list', '--detail', 'compact', '--json'])).stdout,
    );
    expect(compact.components.Action[0]).toMatchObject({
      name: 'tct-button',
      import: '@tecton-wc/components/button',
    });
  });

  it('resolves a tag, folder, display name, angle-bracketed tag and any case', async () => {
    for (const name of ['tct-button', 'button', 'Button', '<tct-button>', 'BUTTON']) {
      const result = await sandbox.run(['component', name, '--json']);
      expect(result.exitCode, name).toBe(0);
      expect(data(result.stdout).tag).toBe('tct-button');
    }
  });

  it('full detail carries the import, usage, best practices, API, keyboard, styling and examples', async () => {
    const {stdout} = await sandbox.run(['component', 'tct-button']);
    expect(stdout).toMatch(/^# Button \(`<tct-button>`\)$/m);
    expect(stdout).toContain("**Import:** `import '@tecton-wc/components/button';`");
    expect(stdout).toMatch(/## Best practices/);
    expect(stdout).toMatch(/- Do: Do use Button well\./);
    expect(stdout).toMatch(/- Don't: Do not misuse Button\./);
    expect(stdout).toMatch(/`variant` \(`ButtonVariant`\): one of `primary`, `secondary`/);
    expect(stdout).toMatch(/## Keyboard\n\n- Enter, Space: activate/);
    expect(stdout).toMatch(/:state\(busy\)/);
    expect(stdout).toMatch(/```html\n<tct-button><\/tct-button>\n```/);
  });

  it('compact and brief are progressively smaller', async () => {
    const [full, compact, brief] = await Promise.all(
      ['full', 'compact', 'brief'].map(
        async (level) => (await sandbox.run(['component', 'tct-button', '--detail', level])).stdout,
      ),
    );
    expect(full!.length).toBeGreaterThan(compact!.length);
    expect(compact!.length).toBeGreaterThan(brief!.length);
    expect(brief).toMatch(
      /^tct-button\(variant: primary\|secondary\|ghost\|destructive, size: sm\|md\|lg\)  <- '@tecton-wc\/components\/button'/,
    );
    expect(brief!.length).toBeLessThan(500);
  });

  it('--props, --examples, --example and --styling narrow to one view (one flag at a time)', async () => {
    const props = await sandbox.run(['component', 'tct-button', '--props', '--json']);
    expect(
      data(props.stdout).elements[0].attributes.map((attribute: {name: string}) => attribute.name),
    ).toContain('variant');
    expect((await sandbox.run(['component', 'tct-button', '--props'])).stdout).not.toMatch(
      /## Best practices/,
    );

    const examples = await sandbox.run(['component', 'tct-button', '--examples', '--json']);
    expect(data(examples.stdout).examples.map((example: {id: string}) => example.id)).toEqual([
      'basic',
      'second',
    ]);
    const one = await sandbox.run(['component', 'tct-button', '--example', 'second']);
    expect(one.stdout.trim()).toBe('<tct-button data-x></tct-button>');
    const missing = await sandbox.run(['component', 'tct-button', '--example', 'nope', '--json']);
    expect(code(missing.stdout)).toBe('ERR_NO_EXAMPLE');

    const styling = await sandbox.run(['component', 'tct-button', '--styling', '--json']);
    expect(data(styling.stdout).elements[0].cssParts).toEqual([
      {name: 'base', description: 'the box'},
    ]);

    const both = await sandbox.run(['component', 'tct-button', '--props', '--styling', '--json']);
    expect(code(both.stdout)).toBe('ERR_INVALID_ARGUMENT');
    expect(code((await sandbox.run(['component', '--props', '--json'])).stdout)).toBe(
      'ERR_MISSING_ARGUMENT',
    );
  });

  it('naming an element of a compound family scopes the answer to it', async () => {
    const result = await sandbox.run(['component', 'tct-dropdown-menu-item', '--json']);
    const detail = data(result.stdout);
    expect(detail).toMatchObject({
      tag: 'tct-dropdown-menu-item',
      scopedTo: 'tct-dropdown-menu-item',
      parent: 'tct-dropdown-menu',
    });
    expect(detail.elements).toHaveLength(1);
    const family = data((await sandbox.run(['component', 'tct-dropdown-menu', '--json'])).stdout);
    expect(family.elements).toHaveLength(2);
    expect(family.scopedTo).toBeUndefined();
  });

  it('an unknown element is ERR_UNKNOWN_COMPONENT with similar names, in both modes', async () => {
    const json = await sandbox.run(['component', 'tct-buton', '--json']);
    expect(code(json.stdout)).toBe('ERR_UNKNOWN_COMPONENT');
    const text = await sandbox.run(['component', 'tct-buton']);
    expect(text.stderr).toMatch(/No element named "tct-buton"/);
    expect(text.stderr).toMatch(/tct-button/);
  });

  it('--source needs the workspace that holds the element; elsewhere it is ERR_NO_SOURCE listing the files', async () => {
    const none = await sandbox.run(['component', 'tct-button', '--source', '--json']);
    expect(code(none.stdout)).toBe('ERR_NO_SOURCE');
    sandbox.write('packages/components/src/button/tct-button.ts', 'export class TctButton {}\n');
    const found = await sandbox.run(['component', 'tct-button', '--source']);
    expect(found.stdout).toBe('export class TctButton {}\n');
    const json = data(
      (await sandbox.run(['component', 'tct-button', '--source', '--json'])).stdout,
    );
    expect(json).toMatchObject({
      file: 'packages/components/src/button/tct-button.ts',
      folder: 'button',
    });
  });
});

describe('the dense projection', () => {
  it('is built from the authored dense doc: description, usage, do and dont, one line per API name', async () => {
    const {stdout} = await sandbox.run(['component', 'tct-button', '--dense']);
    const lines = stdout.trimEnd().split('\n');
    expect(lines[0]).toBe("tct-button (Action)  import '@tecton-wc/components/button'");
    expect(lines[1]).toBe('Button dense description');
    expect(lines[2]).toBe('usage: Button usage sentence.');
    expect(lines).toContain('+ Do use Button well.');
    expect(lines).toContain('- Do not misuse Button.');
    expect(lines).toContain('api:');
    expect(lines).toContain('  variant: variant in one line');
    expect(lines).toContain('  related'.replace('related', 'click: event in one line'));
    expect(lines.at(-1)).toBe('related: dialog');
  });

  it('is complete: every public attribute, property, slot, event and method appears', async () => {
    const registry = fixtureRegistry();
    for (const component of registry.components) {
      const {stdout} = await sandbox.run(['component', component.tag!, '--dense']);
      for (const element of component.elements) {
        if (component.tags.length > 1 && element.tag !== component.tag) continue;
        for (const name of apiNames(element))
          expect(stdout, `${element.tag}: ${name}`).toContain(`  ${name}`);
      }
    }
  });

  it('shows a name the dense doc forgot, so nothing is hidden', async () => {
    const registry = fixtureRegistry();
    delete registry.components.find((component) => component.folder === 'button')!.dense!.properties
      .loading;
    writeFileSync(sandbox.registryPath, JSON.stringify(registry));
    const {stdout} = await sandbox.run(['component', 'tct-button', '--dense']);
    expect(stdout).toMatch(/^ {2}loading$/m);
  });

  it('is much smaller than the full page and needs no dense doc to work', async () => {
    const dense = (await sandbox.run(['component', 'tct-button', '--dense'])).stdout;
    const full = (await sandbox.run(['component', 'tct-button'])).stdout;
    expect(dense.length).toBeLessThan(full.length);
    const registry = fixtureRegistry();
    registry.components[0]!.dense = null;
    writeFileSync(sandbox.registryPath, JSON.stringify(registry));
    const bare = await sandbox.run(['component', 'tct-button', '--dense']);
    expect(bare.exitCode).toBe(0);
    expect(bare.stdout).toMatch(/no dense doc yet/);
  });

  it('--dense --json is the dense projection with meta.dense set', async () => {
    const envelope = JSON.parse(
      (await sandbox.run(['component', 'tct-button', '--dense', '--json'])).stdout,
    ) as {
      type: string;
      data: Record<string, unknown>;
      meta: {dense: boolean};
    };
    expect(envelope.type).toBe('component.detail');
    expect(envelope.meta).toEqual({dense: true});
    expect(Object.keys(envelope.data).sort()).toEqual([
      'category',
      'dense',
      'folder',
      'import',
      'name',
      'related',
      'summary',
      'tag',
      'tags',
    ]);
    expect(envelope.data.dense).toHaveProperty('properties.variant');
  });

  it('applies to lists, docs, controllers, search and doctor too', async () => {
    const list = (await sandbox.run(['component', '--list', '--dense'])).stdout;
    expect(list).toMatch(/^## Action$/m);
    expect(list).toMatch(/^tct-button {2}Button dense description$/m);
    expect((await sandbox.run(['docs', 'styling', '--dense'])).stdout).toMatch(/^# Styling$/m);
    expect(
      (await sandbox.run(['controllers', 'RovingTabindexController', '--dense'])).stdout,
    ).toMatch(/^RovingTabindexController \(controller\)/);
    expect((await sandbox.run(['doctor', '--dense'])).exitCode).toBe(0);
  });
});

describe('tct docs', () => {
  it('lists topics; a topic prints whole; --index lists the section keys; a section prints alone', async () => {
    const list = await sandbox.run(['docs']);
    expect(list.stdout).toMatch(/^topic: +styling$/m);
    const topic = await sandbox.run(['docs', 'styling']);
    expect(topic.stdout).toMatch(/^# Styling$/m);
    expect(topic.stdout).toMatch(/^## Design tokens$/m);
    const index = await sandbox.run(['docs', 'styling', '--index']);
    expect(index.stdout).toMatch(/^design-tokens +Design tokens - Use tokens\.$/m);
    expect(index.stdout).toMatch(/Read one section: tct docs styling <section>/);
    const section = await sandbox.run(['docs', 'styling', 'design-tokens']);
    expect(section.stdout).toMatch(/^## Design tokens$/m);
    expect(section.stdout).not.toMatch(/^## Parts$/m);
  });

  it('finds a section by key, then exact title, then a unique part of a title; an ambiguous query is refused', async () => {
    const title = (query: string) => sandbox.run(['docs', 'styling', query, '--json']);
    expect(data((await title('design-tokens')).stdout).id).toBe('design-tokens');
    expect(data((await title('Design Tokens')).stdout).id).toBe('design-tokens');
    expect(data((await title('tokens')).stdout).id).toBe('design-tokens');
    expect(data((await title('parts')).stdout).id).toBe('parts');
    const ambiguous = await title('part');
    expect(code(ambiguous.stdout)).toBe('ERR_UNKNOWN_SECTION');
    expect((JSON.parse(ambiguous.stdout) as {suggestions: unknown[]}).suggestions).toHaveLength(2);
    expect(code((await title('zzz')).stdout)).toBe('ERR_UNKNOWN_SECTION');
  });

  it('detail levels: brief < compact < full; compact and brief drop code, dense compresses tables', async () => {
    const out = async (...argv: string[]) =>
      (await sandbox.run(['docs', 'styling', ...argv])).stdout;
    const [full, compact, brief] = [
      await out(),
      await out('--detail', 'compact'),
      await out('--detail', 'brief'),
    ];
    expect(full.length).toBeGreaterThan(compact.length);
    expect(full.length).toBeGreaterThan(brief.length);
    expect(full).toMatch(/```css/);
    expect(compact).not.toMatch(/```css/);
    expect(brief).not.toMatch(/```css/);
    expect(brief).toMatch(/^Design tokens: Use tokens\.$/m);
    expect(await out('--dense')).toMatch(/^Part = Meaning$/m);
    expect(full).toMatch(/\| Part \| Meaning \|/);
  });

  it('an unknown topic suggests near names', async () => {
    const result = await sandbox.run(['docs', 'stiling', '--json']);
    expect(code(result.stdout)).toBe('ERR_UNKNOWN_TOPIC');
    expect(
      (JSON.parse(result.stdout) as {suggestions: {name: string}[]}).suggestions[0]?.name,
    ).toBe('styling');
  });
});

describe('tct controllers', () => {
  it('lists by area, prints one, and its members', async () => {
    const list = await sandbox.run(['controllers']);
    expect(list.stdout).toMatch(/^Controllers and utilities \(2\)$/m);
    expect(list.stdout).toMatch(/^RovingTabindexController +controller$/m);
    const detail = await sandbox.run(['controllers', 'RovingTabindexController']);
    expect(detail.stdout).toContain(
      "**Import:** `import {RovingTabindexController} from '@tecton-wc/core/controllers/roving-tabindex.js';`",
    );
    expect(detail.stdout).toMatch(/## Members/);
    expect(detail.stdout).toMatch(/Used by: tct-button/);
    const members = await sandbox.run([
      'controllers',
      'RovingTabindexController',
      '--members',
      '--json',
    ]);
    expect(data(members.stdout).members[0].name).toBe('setActive');
  });

  it('--category filters by area; an unknown area or name is an error with suggestions', async () => {
    const a11y = data((await sandbox.run(['controllers', '--category', 'a11y', '--json'])).stdout);
    expect(Object.keys((a11y as {controllers: object}).controllers)).toEqual(['a11y']);
    expect(code((await sandbox.run(['controllers', '--category', 'nope', '--json'])).stdout)).toBe(
      'ERR_UNKNOWN_CATEGORY',
    );
    const unknown = await sandbox.run(['controllers', 'RovingTabindexControler', '--json']);
    expect(code(unknown.stdout)).toBe('ERR_UNKNOWN_CONTROLLER');
    expect(
      (JSON.parse(unknown.stdout) as {suggestions: {name: string}[]}).suggestions[0]?.name,
    ).toBe('RovingTabindexController');
  });

  it('detail levels keep names < compact < full', async () => {
    const out = async (level: string) =>
      (await sandbox.run(['controllers', '--detail', level])).stdout;
    const [brief, compact, full] = [await out('brief'), await out('compact'), await out('full')];
    expect(compact.length).toBeGreaterThan(brief.length);
    expect(full.length).toBeGreaterThan(compact.length);
    expect(brief).not.toMatch(/import \{/);
    expect(full).toMatch(/import \{/);
  });
});

describe('tct discover', () => {
  function installPackage(name: string, registry: unknown, manifest: Record<string, unknown> = {}) {
    const dir = join(sandbox.cwd, 'node_modules', ...name.split('/'));
    mkdirSync(dir, {recursive: true});
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name,
        version: '2.1.0',
        description: 'Acme widgets',
        tct: {agentRegistry: './agent-registry.json'},
        ...manifest,
      }),
    );
    writeFileSync(join(dir, 'agent-registry.json'), JSON.stringify(registry));
    return dir;
  }

  const acme = () => {
    const registry = fixtureRegistry();
    registry.components = registry.components
      .filter((component) => component.folder === 'card')
      .map((component) => ({
        ...component,
        tag: 'acme-card',
        tags: ['acme-card'],
        elements: component.elements.map((element) => ({...element, tag: 'acme-card'})),
      }));
    return registry;
  };

  it('lists the library and every installed package that ships a registry', async () => {
    installPackage('@acme/widgets', acme());
    const result = await sandbox.run(['discover', '--json']);
    const entries = data<{name: string; version?: string; components: string[]}[]>(result.stdout);
    expect(entries.map((entry) => entry.name)).toEqual(['@tecton-wc/components', '@acme/widgets']);
    expect(entries[1]).toMatchObject({version: '2.1.0', components: ['acme-card']});
    expect((JSON.parse(result.stdout) as {meta: {configured: boolean}}).meta.configured).toBe(true);
  });

  it('lists only the library when nothing else is installed', async () => {
    const result = await sandbox.run(['discover', '--json']);
    expect((JSON.parse(result.stdout) as {meta: {configured: boolean}}).meta.configured).toBe(
      false,
    );
  });

  it('browses a package, an element of it, and searches across packages', async () => {
    installPackage('@acme/widgets', acme());
    const pkg = await sandbox.run(['discover', '@acme/widgets']);
    expect(pkg.stdout).toMatch(/^components: +acme-card$/m);
    const element = await sandbox.run(['discover', '@acme/widgets/acme-card', '--dense']);
    expect(element.stdout).toMatch(/^acme-card \(Container\)/);
    // `card` is an exact name in the library, so it would resolve straight to it; `car` matches both.
    const search = await sandbox.run(['discover', 'car', '--json']);
    const found = JSON.parse(search.stdout) as {type: string; data: {matches: {package: string}[]}};
    expect(found.type).toBe('discover.search');
    expect(found.data.matches.map((match) => match.package)).toEqual([
      '@tecton-wc/components',
      '@acme/widgets',
    ]);
    const single = await sandbox.run(['discover', 'acme', '--json']);
    expect((JSON.parse(single.stdout) as {type: string}).type).toBe('discover.detail.doc');
  });

  it('reports an unknown package, an unknown element and an unreadable registry without failing the rest', async () => {
    installPackage('@acme/broken', {not: 'a registry'});
    const list = await sandbox.run(['discover', '--json']);
    const envelope = JSON.parse(list.stdout) as {
      data: {name: string}[];
      meta: {invalid: {name: string}[]};
    };
    expect(envelope.data.map((entry) => entry.name)).toEqual(['@tecton-wc/components']);
    expect(envelope.meta.invalid[0]?.name).toBe('@acme/broken');
    expect(code((await sandbox.run(['discover', '@nope/pkg', '--json'])).stdout)).toBe(
      'ERR_UNKNOWN_PACKAGE',
    );
    expect(
      code((await sandbox.run(['discover', '@tecton-wc/components/nope', '--json'])).stdout),
    ).toBe('ERR_UNKNOWN_COMPONENT');
    expect(code((await sandbox.run(['discover', 'qzxjkvw', '--json'])).stdout)).toBe(
      'ERR_NOT_FOUND',
    );
  });

  it('refuses a registry path that leaves its package', async () => {
    const dir = installPackage('@acme/escape', acme(), {
      tct: {agentRegistry: '../../../../agent-registry.json'},
    });
    void dir;
    const list = await sandbox.run(['discover', '--json']);
    const envelope = JSON.parse(list.stdout) as {
      data: {name: string}[];
      meta: {invalid: {name: string; error: string}[]};
    };
    expect(envelope.data.map((entry) => entry.name)).not.toContain('@acme/escape');
    expect(envelope.meta.invalid[0]?.error).toMatch(/outside the package/);
  });
});

describe('tct doctor', () => {
  it('passes a healthy project and reports each check with a stable id', async () => {
    sandbox.write('package.json', JSON.stringify({name: 'app', scripts: {tct: 'tct'}}));
    sandbox.write(
      'src/main.js',
      "import '@tecton-wc/components/tecton.css';\nimport '@tecton-wc/components/button';\n",
    );
    sandbox.write('index.html', '<tct-button label="x"></tct-button>');
    await sandbox.run(['init']);
    const result = await sandbox.run(['doctor', '--json']);
    const {checks, summary} = data<{
      checks: {id: string; status: string}[];
      summary: Record<string, number>;
    }>(result.stdout);
    const byId = Object.fromEntries(checks.map((check) => [check.id, check.status]));
    expect(byId).toMatchObject({
      'node-version': 'pass',
      registry: 'pass',
      stylesheet: 'pass',
      'elements-registered': 'pass',
      'unknown-elements': 'pass',
      'agent-docs': 'pass',
    });
    expect(summary.fail).toBe(0);
    expect(result.exitCode).toBe(0);
  });

  it('warns about a missing stylesheet, unregistered and unknown elements, with a fix', async () => {
    sandbox.write('package.json', '{"name":"app"}');
    sandbox.write('index.html', '<tct-button></tct-button><tct-buton></tct-buton>');
    const {checks} = data<{checks: {id: string; status: string; message: string; fix?: string}[]}>(
      (await sandbox.run(['doctor', '--json'])).stdout,
    );
    const byId = Object.fromEntries(checks.map((check) => [check.id, check]));
    expect(byId.stylesheet?.status).toBe('warn');
    expect(byId.stylesheet?.fix).toMatch(/tecton\.css/);
    expect(byId['elements-registered']?.status).toBe('warn');
    expect(byId['unknown-elements']).toMatchObject({status: 'warn'});
    expect(byId['unknown-elements']?.message).toMatch(/tct-buton \(index\.html\)/);
    expect(byId['unknown-elements']?.fix).toMatch(/did you mean tct-button/);
  });

  it('does not treat elements the project defines itself, tests or markdown as unknown', async () => {
    sandbox.write('package.json', '{"name":"app"}');
    sandbox.write(
      'src/own.js',
      "customElements.define('tct-mine', class extends HTMLElement {});\n",
    );
    sandbox.write('index.html', '<tct-mine></tct-mine>');
    sandbox.write('src/thing.test.ts', 'const x = "<tct-fake>";');
    sandbox.write('README.md', 'Use `<tct-imaginary>` here.');
    const {checks} = data<{checks: {id: string; status: string}[]}>(
      (await sandbox.run(['doctor', '--json'])).stdout,
    );
    expect(checks.find((check) => check.id === 'unknown-elements')?.status).toBe('pass');
  });

  it('exits 1 when a check fails (no registry), 0 for warnings, and never writes anything', async () => {
    const result = await sandbox.run(['doctor', '--json'], {
      env: {TCT_AGENT_REGISTRY: '/nonexistent.json'},
    });
    expect(result.exitCode).toBe(1);
    const {checks} = data<{checks: {id: string; status: string}[]}>(result.stdout);
    expect(checks.find((check) => check.id === 'registry')?.status).toBe('fail');
    const warned = await sandbox.run(['doctor']);
    expect(warned.exitCode).toBe(0);
    expect(existsSync(join(sandbox.cwd, 'AGENTS.md'))).toBe(false);
  });

  it('reports a registry with an unsupported schema version as a failed check with a fix', async () => {
    writeFileSync(sandbox.registryPath, JSON.stringify({...fixtureRegistry(), schemaVersion: 99}));
    const {checks} = data<{checks: {id: string; status: string; message: string}[]}>(
      (await sandbox.run(['doctor', '--json'])).stdout,
    );
    const registry = checks.find((check) => check.id === 'registry')!;
    expect(registry.status).toBe('fail');
    expect(registry.message).toMatch(/schema version 99/);
  });
});

describe('tct gap-report', () => {
  const report = [
    'gap-report',
    'tct-button',
    '--category',
    'missing_variant',
    '--reason',
    'Need a compact size',
  ];

  it('lists the categories', async () => {
    const list = data<{value: string}[]>(
      (await sandbox.run(['gap-report', '--list-categories', '--json'])).stdout,
    );
    expect(list.map((entry) => entry.value)).toEqual([
      'missing_component',
      'missing_variant',
      'layout_gap',
      'styling_gap',
      'a11y_gap',
      'api_friction',
      'docs_gap',
      'other',
    ]);
  });

  it('routes to the owning package and says nothing was filed publicly', async () => {
    const result = await sandbox.run([...report, '--json']);
    const receipt = data(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(receipt).toMatchObject({
      status: 'routed_only',
      package: '@tecton-wc/components',
      issuesUrl: null,
      filedCount: 0,
      routedOnlyCount: 1,
    });
    expect(receipt.deliveries[0]).toMatchObject({handlerType: 'fallback', status: 'routed_only'});
    expect(receipt.deliveries[0].message).toMatch(/nothing was filed/);
  });

  it('--output appends one JSON line to a file inside the project (a project handler)', async () => {
    const result = await sandbox.run([
      ...report,
      '--additional-context',
      'more',
      '--output',
      '.tct/gaps.jsonl',
      '--json',
    ]);
    expect(data(result.stdout)).toMatchObject({status: 'filed', filedCount: 1});
    await sandbox.run([...report, '--output', '.tct/gaps.jsonl']);
    const lines = readFileSync(join(sandbox.cwd, '.tct/gaps.jsonl'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!)).toMatchObject({
      component: 'tct-button',
      category: 'missing_variant',
      reason: 'Need a compact size',
      detail: 'more',
      package: '@tecton-wc/components',
    });
    const outside = await sandbox.run([...report, '--output', '../gaps.jsonl', '--json']);
    expect(code(outside.stdout)).toBe('ERR_PATH_TRAVERSAL');
  });

  it('routes to a contributed package by element, and asks for --package when two provide it', async () => {
    const dir = join(sandbox.cwd, 'node_modules/@acme/widgets');
    mkdirSync(dir, {recursive: true});
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({name: '@acme/widgets', version: '1.0.0', tct: {agentRegistry: './r.json'}}),
    );
    const registry = fixtureRegistry();
    registry.components = registry.components.filter(
      (component) => component.folder === 'button' || component.folder === 'card',
    );
    registry.components[1]!.tags = ['acme-card'];
    registry.components[1]!.tag = 'acme-card';
    registry.components[1]!.elements[0]!.tag = 'acme-card';
    writeFileSync(join(dir, 'r.json'), JSON.stringify(registry));
    const owned = await sandbox.run([
      'gap-report',
      'acme-card',
      '--category',
      'docs_gap',
      '--reason',
      'x',
      '--json',
    ]);
    expect(data(owned.stdout).package).toBe('@acme/widgets');
    const ambiguous = await sandbox.run([...report, '--json']);
    expect(code(ambiguous.stdout)).toBe('ERR_AMBIGUOUS_COMPONENT');
    const chosen = await sandbox.run([...report, '--package', '@tecton-wc/components', '--json']);
    expect(data(chosen.stdout).package).toBe('@tecton-wc/components');
    expect(code((await sandbox.run([...report, '--package', '@nope/x', '--json'])).stdout)).toBe(
      'ERR_UNKNOWN_PACKAGE',
    );
  });

  it('validates its inputs: required fields, lengths and category', async () => {
    expect(
      code(
        (await sandbox.run(['gap-report', '--category', 'docs_gap', '--reason', 'x', '--json']))
          .stdout,
      ),
    ).toBe('ERR_MISSING_ARGUMENT');
    expect(code((await sandbox.run(['gap-report', 'x', '--reason', 'x', '--json'])).stdout)).toBe(
      'ERR_MISSING_ARGUMENT',
    );
    expect(
      code((await sandbox.run(['gap-report', 'x', '--category', 'docs_gap', '--json'])).stdout),
    ).toBe('ERR_MISSING_ARGUMENT');
    expect(
      code(
        (await sandbox.run(['gap-report', 'x', '--category', 'bogus', '--reason', 'x', '--json']))
          .stdout,
      ),
    ).toBe('ERR_INVALID_ARGUMENT');
    expect(
      code(
        (
          await sandbox.run([
            'gap-report',
            'x'.repeat(121),
            '--category',
            'docs_gap',
            '--reason',
            'x',
            '--json',
          ])
        ).stdout,
      ),
    ).toBe('ERR_INVALID_ARGUMENT');
    expect(
      code(
        (
          await sandbox.run([
            'gap-report',
            'x',
            '--category',
            'docs_gap',
            '--reason',
            'x'.repeat(2001),
            '--json',
          ])
        ).stdout,
      ),
    ).toBe('ERR_INVALID_ARGUMENT');
    expect(
      code(
        (
          await sandbox.run([
            'gap-report',
            'x',
            '--category',
            'docs_gap',
            '--reason',
            'x',
            '--additional-context',
            'x'.repeat(8001),
            '--json',
          ])
        ).stdout,
      ),
    ).toBe('ERR_INVALID_ARGUMENT');
  });
});
