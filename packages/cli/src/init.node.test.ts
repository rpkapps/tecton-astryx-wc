/**
 * `tct init`: behaviour of the agent-docs installer. Ported from the upstream init behaviour and agent-docs
 * path-safety tests: non-interactive, idempotent, presets, explicit paths, removal, and a hard refusal of
 * anything that would write outside the project or corrupt a malformed block.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {MARKER_END, MARKER_START} from './agent-docs/state.ts';
import {Sandbox} from './testing/fixture.ts';

let sandbox: Sandbox;
beforeEach(() => {
  sandbox = new Sandbox();
});
afterEach(() => {
  sandbox.dispose();
});

const read = (path: string) => readFileSync(join(sandbox.cwd, path), 'utf8');
const exists = (path: string) => existsSync(join(sandbox.cwd, path));
const blocks = (text: string) => text.split(MARKER_START).length - 1;

describe('tct init (default)', () => {
  it('installs the tool-agnostic AGENTS.md block and prints next steps', async () => {
    const {exitCode, stdout} = await sandbox.run(['init']);
    expect(exitCode).toBe(0);
    expect(read('AGENTS.md')).toContain(MARKER_START);
    expect(read('AGENTS.md')).toContain(MARKER_END);
    expect(stdout).toMatch(/Next steps:/);
    expect(stdout).toMatch(/Agent docs installed -> AGENTS.md/);
  });

  it('is non-interactive: no prompt text, no wait for input', async () => {
    const {exitCode, stdout, stderr} = await sandbox.run(['init']);
    expect(exitCode).toBe(0);
    expect(stdout).not.toMatch(/\?\s*$/m);
    expect(stderr).toBe('');
  });

  it('is idempotent: re-running keeps one block and identical bytes', async () => {
    await sandbox.run(['init']);
    const first = read('AGENTS.md');
    await sandbox.run(['init']);
    await sandbox.run(['init', '--features', 'agents']);
    expect(read('AGENTS.md')).toBe(first);
    expect(blocks(read('AGENTS.md'))).toBe(1);
  });

  it('the block names the workflow, the rules, the CLI and an index of every element', async () => {
    await sandbox.run(['init']);
    const text = read('AGENTS.md');
    expect(text).toMatch(/WORKFLOW/);
    expect(text).toMatch(/RULES:/);
    expect(text).toMatch(/MORE CLI:/);
    expect(text).toMatch(/Action: tct-button, tct-dropdown-menu, tct-dropdown-menu-item/);
    expect(text).toMatch(
      /Layout: tct-vstack, tct-hstack, tct-stack, tct-stack-item, tct-grid, tct-grid-span/,
    );
    expect(text).toMatch(/docs <topic> +styling, forms/);
    expect(text).toMatch(
      /tct-stack, tct-hstack, tct-vstack, tct-grid, tct-center, tct-card, tct-section/,
    );
  });

  it('never names the upstream design system (D-015)', async () => {
    await sandbox.run(['init']);
    expect(read('AGENTS.md')).not.toMatch(/astryx/i);
  });

  it('uses the project script alias when there is one, else the no-install form', async () => {
    sandbox.write(
      'package.json',
      JSON.stringify({name: 'app', packageManager: 'pnpm@10.0.0', scripts: {tct: 'tct'}}),
    );
    await sandbox.run(['init']);
    expect(read('AGENTS.md')).toMatch(/run every command as `pnpm tct <cmd>`/);
    sandbox.write('AGENTS.md', '# mine\n');
    sandbox.write('package.json', JSON.stringify({name: 'app'}));
    await sandbox.run(['init']);
    expect(read('AGENTS.md')).toMatch(/`npx --no-install tct <cmd>`/);
  });

  it('--json emits the receipt as the only output', async () => {
    const {exitCode, stdout} = await sandbox.run(['init', '--json']);
    expect(exitCode).toBe(0);
    const envelope = JSON.parse(stdout) as {
      type: string;
      data: {mode: string; docsWritten: string[]; docsCreated: string[]};
    };
    expect(envelope.type).toBe('init.run');
    expect(envelope.data).toMatchObject({
      mode: 'default',
      docsWritten: ['AGENTS.md'],
      docsCreated: ['AGENTS.md'],
    });
    expect(stdout).not.toMatch(/Next steps:/);
    expect(read('AGENTS.md')).toContain(MARKER_START);
  });
});

describe('tct init --features', () => {
  it('--features agents writes AGENTS.md; --all is the same today', async () => {
    expect((await sandbox.run(['init', '--features', 'agents'])).exitCode).toBe(0);
    expect(exists('AGENTS.md')).toBe(true);
    expect(exists('.claude')).toBe(false);
    const all = await sandbox.run(['init', '--all', '--json']);
    expect(
      (JSON.parse(all.stdout) as {data: {mode: string; features: string[]}}).data,
    ).toMatchObject({mode: 'features', features: ['agents']});
  });

  it('rejects an unknown feature and writes nothing', async () => {
    const {exitCode, stderr} = await sandbox.run(['init', '--features', 'bogus']);
    expect(exitCode).toBe(1);
    expect(stderr).toMatch(/Unknown features: bogus/);
    expect(stderr).toMatch(/Valid features: agents/);
    expect(readdirSync(sandbox.cwd)).toEqual([]);
  });

  it('theme and template scaffolding are deferred, so they are rejected rather than ignored', async () => {
    const result = await sandbox.run(['init', '--features', 'agents,theme']);
    expect(result.exitCode).toBe(1);
    expect(exists('AGENTS.md')).toBe(false);
  });
});

describe('tct init --agent', () => {
  it('claude targets .claude/CLAUDE.md, or an existing CLAUDE.md', async () => {
    expect((await sandbox.run(['init', '--agent', 'claude'])).exitCode).toBe(0);
    expect(read('.claude/CLAUDE.md')).toContain(MARKER_START);
    expect(exists('AGENTS.md')).toBe(false);
    sandbox.write('CLAUDE.md', '# Mine\n');
    await sandbox.run(['init', '--agent', 'claude']);
    expect(read('CLAUDE.md')).toContain(MARKER_START);
    expect(read('CLAUDE.md').startsWith('# Mine\n')).toBe(true);
  });

  it('cursor targets .cursorrules', async () => {
    await sandbox.run(['init', '--agent', 'cursor']);
    expect(read('.cursorrules')).toContain(MARKER_START);
  });

  it('codex targets AGENTS.md', async () => {
    await sandbox.run(['init', '--agent', 'codex']);
    expect(read('AGENTS.md')).toContain(MARKER_START);
  });

  it('all creates the AGENTS.md and Claude defaults, or refreshes the existing files', async () => {
    await sandbox.run(['init', '--agent', 'all']);
    expect(exists('AGENTS.md')).toBe(true);
    expect(exists('.claude/CLAUDE.md')).toBe(true);
  });

  it('rejects an unknown agent with ERR_UNKNOWN_AGENT and agrees on the exit code in both modes', async () => {
    const human = await sandbox.run(['init', '--agent', 'bogus']);
    const json = await sandbox.run(['init', '--agent', 'bogus', '--json']);
    expect(human.exitCode).toBe(1);
    expect(json.exitCode).toBe(1);
    const envelope = JSON.parse(json.stdout) as {code: string; type?: string};
    expect(envelope.code).toBe('ERR_UNKNOWN_AGENT');
    expect(envelope.type).toBeUndefined();
    expect(readdirSync(sandbox.cwd)).toEqual([]);
  });
});

describe('tct init --agent-docs-path', () => {
  it('writes the block to a custom file, creating directories', async () => {
    const {exitCode} = await sandbox.run(['init', '--agent-docs-path', 'docs/ai/tct.md']);
    expect(exitCode).toBe(0);
    expect(read('docs/ai/tct.md')).toContain(MARKER_START);
    expect(exists('AGENTS.md')).toBe(false);
  });

  it('gives a Cursor .mdc rule its front matter', async () => {
    await sandbox.run(['init', '--agent-docs-path', '.cursor/rules/tct.mdc']);
    expect(read('.cursor/rules/tct.mdc').startsWith('---\ndescription:')).toBe(true);
    expect(read('.cursor/rules/tct.mdc')).toMatch(/alwaysApply: true/);
  });

  it('is repeatable', async () => {
    await sandbox.run(['init', '--agent-docs-path', 'a.md', '--agent-docs-path', 'b.md', '--json']);
    expect(exists('a.md') && exists('b.md')).toBe(true);
  });

  it('refuses a path that escapes the project, an absolute path and a symlink out, writing nothing', async () => {
    const outside = join(sandbox.root, 'outside');
    mkdirSync(outside);
    for (const path of ['../OUT.md', '../outside/x.md', join(outside, 'abs.md')]) {
      const result = await sandbox.run(['init', '--agent-docs-path', path, '--json']);
      expect(result.exitCode, path).toBe(1);
      expect((JSON.parse(result.stdout) as {code: string}).code).toBe('ERR_PATH_TRAVERSAL');
    }
    symlinkSync(outside, join(sandbox.cwd, 'linked'));
    const viaLink = await sandbox.run(['init', '--agent-docs-path', 'linked/x.md', '--json']);
    expect(viaLink.exitCode).toBe(1);
    expect((JSON.parse(viaLink.stdout) as {code: string}).code).toBe('ERR_PATH_TRAVERSAL');
    expect(readdirSync(outside)).toEqual([]);
    expect(exists('AGENTS.md')).toBe(false);
  });

  it('checks every target before writing the first', async () => {
    const result = await sandbox.run([
      'init',
      '--agent-docs-path',
      'ok.md',
      '--agent-docs-path',
      '../bad.md',
    ]);
    expect(result.exitCode).toBe(1);
    expect(exists('ok.md')).toBe(false);
  });

  it('refuses an existing preset file that is a symlink out of the project', async () => {
    const outside = join(sandbox.root, 'outside');
    mkdirSync(outside);
    writeFileSync(join(outside, 'CLAUDE.md'), '# outside\n');
    symlinkSync(join(outside, 'CLAUDE.md'), join(sandbox.cwd, 'CLAUDE.md'));
    const result = await sandbox.run(['init', '--agent', 'claude', '--json']);
    expect(result.exitCode).toBe(1);
    expect(readFileSync(join(outside, 'CLAUDE.md'), 'utf8')).toBe('# outside\n');
  });
});

describe('managed block protection', () => {
  it('leaves every byte outside the markers untouched, before and after', async () => {
    const before = '# My project\n\nHand-written rules.\n\n';
    const after = '\n\n## Afterword\n\nMore of my text.\n';
    sandbox.write('AGENTS.md', `${before}${MARKER_START}\nold body\n${MARKER_END}${after}`);
    const {exitCode} = await sandbox.run(['init']);
    expect(exitCode).toBe(0);
    const text = read('AGENTS.md');
    expect(text.startsWith(before)).toBe(true);
    expect(text.endsWith(after)).toBe(true);
    expect(text).not.toContain('old body');
    expect(blocks(text)).toBe(1);
  });

  it('appends to an existing file without markers and keeps the file', async () => {
    sandbox.write('AGENTS.md', '# Existing\n\nKeep me.\n');
    await sandbox.run(['init']);
    expect(read('AGENTS.md').startsWith('# Existing\n\nKeep me.\n')).toBe(true);
    expect(blocks(read('AGENTS.md'))).toBe(1);
  });

  it('refuses a file with a duplicate or unterminated block instead of guessing', async () => {
    const duplicate = `${MARKER_START}\na\n${MARKER_END}\n\n${MARKER_START}\nb\n${MARKER_END}\n`;
    sandbox.write('AGENTS.md', duplicate);
    const result = await sandbox.run(['init', '--json']);
    expect(result.exitCode).toBe(1);
    expect((JSON.parse(result.stdout) as {code: string}).code).toBe('ERR_AGENT_DOCS_MALFORMED');
    expect(read('AGENTS.md')).toBe(duplicate);

    const unterminated = `# Mine\n${MARKER_START}\nnever closed\n`;
    sandbox.write('AGENTS.md', unterminated);
    expect((await sandbox.run(['init'])).exitCode).toBe(1);
    expect(read('AGENTS.md')).toBe(unterminated);

    const reversed = `${MARKER_END}\nfirst\n${MARKER_START}\n`;
    sandbox.write('AGENTS.md', reversed);
    expect((await sandbox.run(['init'])).exitCode).toBe(1);
    expect(read('AGENTS.md')).toBe(reversed);
  });

  it('does not expand the block beside an @path import of another agent doc', async () => {
    sandbox.write('AGENTS.md', '# Shared\n');
    sandbox.write('CLAUDE.md', '@AGENTS.md\n\nClaude only.\n');
    await sandbox.run(['init']);
    expect(read('AGENTS.md')).toContain(MARKER_START);
    expect(read('CLAUDE.md')).toBe('@AGENTS.md\n\nClaude only.\n');
  });

  it('removes a block an older run duplicated into a wrapper', async () => {
    sandbox.write('AGENTS.md', '# Shared\n');
    sandbox.write('CLAUDE.md', `@AGENTS.md\n\n${MARKER_START}\nold\n${MARKER_END}\n`);
    const result = await sandbox.run(['init', '--json']);
    expect((JSON.parse(result.stdout) as {data: {docsWritten: string[]}}).data.docsWritten).toEqual(
      ['AGENTS.md', 'CLAUDE.md'],
    );
    expect(read('CLAUDE.md')).not.toContain(MARKER_START);
  });
});

describe('tct init --remove-agents', () => {
  it('removes the section it installed and deletes a file that only held it', async () => {
    await sandbox.run(['init']);
    const {exitCode, stdout} = await sandbox.run(['init', '--remove-agents']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/Removed empty AGENTS.md/);
    expect(exists('AGENTS.md')).toBe(false);
  });

  it('keeps everything else in a file with your own text', async () => {
    sandbox.write('AGENTS.md', '# Mine\n\nMy words.\n');
    await sandbox.run(['init']);
    await sandbox.run(['init', '--remove-agents']);
    expect(read('AGENTS.md')).toBe('# Mine\n\nMy words.\n');
  });

  it('emits init.remove with the files touched', async () => {
    await sandbox.run(['init']);
    const {stdout} = await sandbox.run(['init', '--remove-agents', '--json']);
    const envelope = JSON.parse(stdout) as {
      type: string;
      data: {removed: string[]; deleted: string[]};
    };
    expect(envelope.type).toBe('init.remove');
    expect(envelope.data.deleted).toEqual(['AGENTS.md']);
  });

  it('with nothing to remove it says so and exits 0', async () => {
    const {exitCode, stdout} = await sandbox.run(['init', '--remove-agents']);
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/No managed agent-docs block found/);
  });
});

describe('tct init --dry-run', () => {
  it('prints the block and changes nothing', async () => {
    const {exitCode, stdout} = await sandbox.run(['init', '--dry-run']);
    expect(exitCode).toBe(0);
    expect(stdout.startsWith(MARKER_START)).toBe(true);
    expect(readdirSync(sandbox.cwd)).toEqual([]);
  });
});

describe('setup nudge', () => {
  it('reminds a project without the block, on stderr, never in --json and never inside init', async () => {
    sandbox.write('package.json', '{"name":"app"}');
    const env = {TCT_NO_NUDGE: undefined};
    const nudged = await sandbox.run(['component', '--list'], {env});
    expect(nudged.stderr).toMatch(/Next step: run `tct init --features agents`/);
    expect((await sandbox.run(['component', '--list', '--json'], {env})).stderr).toBe('');
    expect((await sandbox.run(['init', '--dry-run'], {env})).stderr).toBe('');
    await sandbox.run(['init']);
    expect((await sandbox.run(['component', '--list'], {env})).stderr).toBe('');
  });

  it('stays quiet outside a project (no package.json)', async () => {
    const result = await sandbox.run(['component', '--list'], {env: {TCT_NO_NUDGE: undefined}});
    expect(result.stderr).toBe('');
  });
});
