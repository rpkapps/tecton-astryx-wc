/**
 * Registry loading (priority, incompatible files) and a contract run against the real generated registry:
 * every command answers, every component has a dense doc, nothing exits non-zero by accident.
 */
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {execute} from './index.ts';
import {loadRegistry, locateRegistry} from './registry/load.ts';
import {Sandbox, fixtureRegistry} from './testing/fixture.ts';

let sandbox: Sandbox;
beforeEach(() => {
  sandbox = new Sandbox();
});
afterEach(() => {
  sandbox.dispose();
});

describe('locating the registry', () => {
  it('prefers --registry, then the environment, then the project install', () => {
    const project = join(sandbox.cwd, 'node_modules/@tecton-wc/components');
    mkdirSync(project, {recursive: true});
    writeFileSync(join(project, 'agent-registry.json'), JSON.stringify(fixtureRegistry()));

    expect(
      locateRegistry({cwd: sandbox.cwd, path: 'x.json', env: {TCT_AGENT_REGISTRY: 'y.json'}}),
    ).toMatchObject({source: 'option', path: join(sandbox.cwd, 'x.json')});
    expect(locateRegistry({cwd: sandbox.cwd, env: {TCT_AGENT_REGISTRY: 'y.json'}})).toMatchObject({
      source: 'env',
    });
    expect(locateRegistry({cwd: sandbox.cwd, env: {}})).toMatchObject({
      source: 'project',
      path: join(project, 'agent-registry.json'),
    });
  });

  it('walks up from a subdirectory to the project install', () => {
    const project = join(sandbox.cwd, 'node_modules/@tecton-wc/components');
    mkdirSync(project, {recursive: true});
    writeFileSync(join(project, 'agent-registry.json'), JSON.stringify(fixtureRegistry()));
    const nested = join(sandbox.cwd, 'src/deep/er');
    mkdirSync(nested, {recursive: true});
    expect(locateRegistry({cwd: nested, env: {}})?.source).toBe('project');
  });
});

describe('reading the registry', () => {
  const read = (content: unknown) => {
    const file = join(sandbox.root, 'bad.json');
    writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
    return () => loadRegistry({cwd: sandbox.cwd, path: file});
  };

  it('rejects a file that is not a registry, an unsupported schema and broken JSON', () => {
    expect(read({hello: 'world'})).toThrow(/is not an agent registry/);
    expect(read({...fixtureRegistry(), schemaVersion: 99})).toThrow(/schema version 99/);
    expect(read('{ not json')).toThrow(/Cannot read/);
  });

  it('reports a missing explicit file with a stable code', async () => {
    const result = await execute(['search', 'button', '--json', '--registry', 'nope.json'], {
      cwd: sandbox.cwd,
      env: {TCT_NO_NUDGE: '1'},
    });
    expect(result.exitCode).toBe(1);
    expect((JSON.parse(result.stdout) as {code: string}).code).toBe('ERR_FILE_NOT_FOUND');
    expect(result.stderr).toBe('');
  });

  it('an incompatible registry is a JSON error with exit code 1, not a crash', async () => {
    const file = join(sandbox.root, 'old.json');
    writeFileSync(file, JSON.stringify({...fixtureRegistry(), schemaVersion: 0}));
    const result = await execute(['component', '--json', '--registry', file], {
      cwd: sandbox.cwd,
      env: {TCT_NO_NUDGE: '1'},
    });
    expect(result.exitCode).toBe(1);
    expect((JSON.parse(result.stdout) as {code: string}).code).toBe('ERR_REGISTRY_INCOMPATIBLE');
  });
});

describe('the real generated registry', () => {
  // The workspace copy is found by walking up from the package, exactly as a checkout would.
  const run = (argv: string[]) =>
    execute(argv, {cwd: process.cwd(), env: {...process.env, TCT_NO_NUDGE: '1'}});

  it('carries a dense doc for every component and answers every read command', async () => {
    const located = locateRegistry({cwd: process.cwd(), env: {}});
    expect(located, 'run `pnpm generate` first').not.toBeNull();
    const {registry} = loadRegistry({cwd: process.cwd(), env: {}});
    expect(registry.components.length).toBeGreaterThan(20);
    const missing = registry.components
      .filter((component) => !component.dense?.description)
      .map((component) => component.folder);
    expect(missing).toEqual([]);

    for (const argv of [
      ['component'],
      ['component', '--detail', 'brief'],
      ['docs'],
      ['controllers'],
      ['discover'],
      ['search', 'button'],
      ['doctor'],
      ['layout', 'grammar'],
      ['gap-report', '--list-categories'],
    ]) {
      const result = await run([...argv, '--json']);
      expect(result.exitCode, argv.join(' ')).toBe(0);
      expect(result.stderr).toBe('');
      const envelope = JSON.parse(result.stdout) as {apiVersion: number; type: string};
      expect(envelope.apiVersion).toBe(1);
      expect(envelope.type).toEqual(expect.any(String));
    }
    // Runs every read command against the full generated registry.
  }, 60_000);

  it('prints a dense doc for tct-button that names its import and API', async () => {
    const result = await run(['component', 'tct-button', '--dense']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/^tct-button \(/);
    expect(result.stdout).toContain("import '@tecton-wc/components/button'");
    expect(result.stdout).toMatch(/^api:$/m);
  });

  it('finds a component by a natural-language query', async () => {
    const result = await run(['search', 'confirm before deleting', '--json']);
    const {data} = JSON.parse(result.stdout) as {data: {results: {name: string}[]}};
    expect(data.results.map((entry) => entry.name)).toContain('tct-dialog');
  });
});
