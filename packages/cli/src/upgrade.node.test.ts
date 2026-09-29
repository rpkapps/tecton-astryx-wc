/**
 * `tct upgrade`: stale-block detection and refresh. Ported from the upstream upgrade file-protection tests
 * for the part that applies here: user text outside the managed markers is never overwritten, a hand-edited
 * block is protected, a malformed block is never guessed at, and nothing is written without `--apply`.
 */
import {mkdirSync, readFileSync, symlinkSync, unlinkSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {MARKER_END, MARKER_START} from './agent-docs/state.ts';
import {Sandbox, fixtureRegistry} from './testing/fixture.ts';

let sandbox: Sandbox;
let newer: string;

beforeEach(() => {
  sandbox = new Sandbox();
  // A later registry: one more element, so a block generated from the first is stale.
  const registry = fixtureRegistry();
  const badge = structuredClone(
    registry.components.find((component) => component.folder === 'text')!,
  );
  badge.id = badge.folder = 'badge';
  badge.name = 'Badge';
  badge.tag = 'tct-badge';
  badge.tags = ['tct-badge'];
  badge.elements = badge.elements.map((element) => ({...element, tag: 'tct-badge'}));
  registry.components.push(badge);
  newer = join(sandbox.root, 'newer-registry.json');
  writeFileSync(newer, JSON.stringify(registry));
});
afterEach(() => {
  sandbox.dispose();
});

const read = (path: string) => readFileSync(join(sandbox.cwd, path), 'utf8');

function upgrade(argv: string[], registry?: string) {
  return sandbox.run(['upgrade', ...argv, '--registry', registry ?? newer]);
}
const envelope = (stdout: string) =>
  (
    JSON.parse(stdout) as {
      data: {
        status: string;
        complete: boolean;
        files: {path: string; state: string}[];
        applied: string[];
        skipped: {path: string; reason: string}[];
      };
    }
  ).data;

describe('detection (no writes)', () => {
  it('reports a missing block and exits 0', async () => {
    const result = await sandbox.run(['upgrade']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/No agent-docs block found\. Run `tct init --features agents`/);
    expect(envelope((await sandbox.run(['upgrade', '--json'])).stdout).status).toBe('missing');
  });

  it('reports a current block', async () => {
    await sandbox.run(['init']);
    const result = await sandbox.run(['upgrade']);
    expect(result.stdout).toMatch(/Agent docs are up to date/);
    expect(envelope((await sandbox.run(['upgrade', '--json'])).stdout)).toMatchObject({
      status: 'current',
      complete: true,
    });
  });

  it('detects a stale block against the registry that would generate it now, without writing', async () => {
    await sandbox.run(['init']);
    const before = read('AGENTS.md');
    const result = await upgrade(['--json']);
    expect(result.exitCode).toBe(0);
    expect(envelope(result.stdout)).toMatchObject({
      status: 'stale',
      complete: false,
      files: [{path: 'AGENTS.md', state: 'stale'}],
      applied: [],
    });
    expect(read('AGENTS.md')).toBe(before);
    const text = await upgrade([]);
    expect(text.stdout).toMatch(/Agent docs need attention/);
    expect(text.stdout).toMatch(/Run `tct upgrade --apply`/);
  });

  it('--check exits 1 when a block needs attention, in both modes, and 0 when current', async () => {
    await sandbox.run(['init']);
    expect((await upgrade(['--check'])).exitCode).toBe(1);
    expect((await upgrade(['--check', '--json'])).exitCode).toBe(1);
    expect((await sandbox.run(['upgrade', '--check'])).exitCode).toBe(0);
  });
});

describe('--apply', () => {
  it('refreshes a stale block and touches nothing outside the markers', async () => {
    const before = '# My project\n\nMy own instructions.\n\n';
    const after = '\n\n## Later\n\nMy own trailing text.\n';
    await sandbox.run(['init']);
    const generated = read('AGENTS.md');
    const start = generated.indexOf(MARKER_START);
    const end = generated.indexOf(MARKER_END) + MARKER_END.length;
    sandbox.write('AGENTS.md', `${before}${generated.slice(start, end)}${after}`);
    const result = await upgrade(['--apply']);
    expect(result.exitCode).toBe(0);
    const text = read('AGENTS.md');
    expect(text.startsWith(before)).toBe(true);
    expect(text.endsWith(after)).toBe(true);
    expect(text).toMatch(/tct-badge/);
    expect((await upgrade(['--json'])).stdout).toMatch(/"status": "current"/);
    // A second apply changes nothing.
    const again = read('AGENTS.md');
    await upgrade(['--apply']);
    expect(read('AGENTS.md')).toBe(again);
  });

  it('refreshes every file that carries a block and leaves files without one alone', async () => {
    await sandbox.run(['init', '--agent', 'all']);
    sandbox.write('.cursorrules', 'my own cursor rules\n');
    const result = await upgrade(['--apply', '--json']);
    expect(envelope(result.stdout).applied.sort()).toEqual(['.claude/CLAUDE.md', 'AGENTS.md']);
    expect(read('.cursorrules')).toBe('my own cursor rules\n');
  });

  it('skips a block that was edited by hand unless --force, and exits 1 while it is unresolved', async () => {
    await sandbox.run(['init']);
    const edited = read('AGENTS.md').replace('WORKFLOW', 'MY WORKFLOW');
    sandbox.write('AGENTS.md', edited);
    const detected = await sandbox.run(['upgrade', '--json']);
    expect(envelope(detected.stdout)).toMatchObject({status: 'edited', files: [{state: 'edited'}]});

    const applied = await sandbox.run(['upgrade', '--apply', '--json']);
    expect(applied.exitCode).toBe(1);
    expect(envelope(applied.stdout).skipped[0]).toMatchObject({path: 'AGENTS.md'});
    expect(envelope(applied.stdout).skipped[0]?.reason).toMatch(/--force/);
    expect(read('AGENTS.md')).toBe(edited);

    const forced = await sandbox.run(['upgrade', '--apply', '--force']);
    expect(forced.exitCode).toBe(0);
    expect(read('AGENTS.md')).not.toContain('MY WORKFLOW');
    expect(read('AGENTS.md')).toContain('WORKFLOW');
  });

  it('doctor names only the files that need attention', async () => {
    await sandbox.run(['init', '--agent', 'all']);
    sandbox.write('AGENTS.md', read('AGENTS.md').replace('WORKFLOW', 'MY WORKFLOW'));
    const doctor = await sandbox.run(['doctor', '--json']);
    const check = (
      JSON.parse(doctor.stdout) as {data: {checks: {id: string; message: string}[]}}
    ).data.checks.find((entry) => entry.id === 'agent-docs')!;
    expect(check.message).toBe('The agent-docs block is edited in AGENTS.md.');
  });

  it('never overwrites a malformed block, and says which file to repair', async () => {
    const broken = `# Mine\n\n${MARKER_START}\nnever closed\n`;
    sandbox.write('AGENTS.md', broken);
    const result = await sandbox.run(['upgrade', '--apply', '--json']);
    expect(result.exitCode).toBe(1);
    expect(envelope(result.stdout)).toMatchObject({
      status: 'malformed',
      files: [{path: 'AGENTS.md', state: 'malformed'}],
    });
    expect(read('AGENTS.md')).toBe(broken);
    const doctor = await sandbox.run(['doctor', '--json']);
    const check = (
      JSON.parse(doctor.stdout) as {data: {checks: {id: string; status: string; message: string}[]}}
    ).data.checks.find((entry) => entry.id === 'agent-docs')!;
    expect(check.status).toBe('warn');
    expect(check.message).toMatch(/malformed/);
  });

  it('refuses to write through a symlink that leaves the project', async () => {
    const outside = join(sandbox.root, 'outside');
    mkdirSync(outside);
    await sandbox.run(['init']);
    const generated = read('AGENTS.md');
    writeFileSync(join(outside, 'AGENTS.md'), generated);
    // Replace the file by a link to one outside.
    unlinkSync(join(sandbox.cwd, 'AGENTS.md'));
    symlinkSync(join(outside, 'AGENTS.md'), join(sandbox.cwd, 'AGENTS.md'));
    const result = await upgrade(['--apply', '--json']);
    expect(result.exitCode).toBe(1);
    expect((JSON.parse(result.stdout) as {code: string}).code).toBe('ERR_PATH_TRAVERSAL');
    expect(readFileSync(join(outside, 'AGENTS.md'), 'utf8')).toBe(generated);
  });
});
