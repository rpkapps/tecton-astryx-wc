/**
 * The D-015 codemod (tools/codemods/d015-rename.ts): every rule, the skip list, idempotence, dry runs and
 * the CLI. The old spellings are assembled from parts so that this file is not matched by its own rules.
 */
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {isSkipped, run, transform} from './d015-rename.ts';

const OLD = ['astryx'].join('');
const scope = `@tecton-${OLD}/`;
const id = (rest: string): string => `@${OLD}.${rest}`;
const vendor = `/vendor/tecton-${OLD}/`;
const status = `tecton-${OLD}`;
const retained = `${OLD}-retained`;
const target = (name: string): string =>
  `(${OLD[0]!.toUpperCase()}${OLD.slice(1)} target \`${OLD}-${name}\`)`;

const rewrite = (path: string, text: string): string => transform(path, text).text;

describe('rules', () => {
  it('renames the package scope in imports, manifests and prose', () => {
    expect(rewrite('a.ts', `import {x} from '${scope}core/define.js';`)).toBe(
      "import {x} from '@tecton-wc/core/define.js';",
    );
    expect(rewrite('package.json', `{"dependencies": {"${scope}tokens": "workspace:*"}}`)).toBe(
      '{"dependencies": {"@tecton-wc/tokens": "workspace:*"}}',
    );
  });

  it('maps message ids, including template placeholders, but not a bare prefix constant', () => {
    expect(rewrite('a.ts', `t('${id('pagination.next')}'); \`${id('${ns}.label')}\``)).toBe(
      "t('@tct.pagination.next'); `@tct.${ns}.label`",
    );
    expect(rewrite('a.md', `ids like \`${id('<namespace>.<key>')}\` or \`${id('*')}\``)).toBe(
      'ids like `@tct.<namespace>.<key>` or `@tct.*`',
    );
    const prefixConstant = `const UPSTREAM_ID_PREFIX = '${id('')}';`;
    expect(rewrite('scripts/lib.ts', prefixConstant)).toBe(prefixConstant);
  });

  it('renames the vendor path and the token status ids', () => {
    expect(rewrite('g.mdx', `<link href="${vendor}tecton.css" />`)).toBe(
      '<link href="/vendor/tecton-wc/tecton.css" />',
    );
    expect(rewrite('t.ts', `status === '${status}' || "${status}" || \`${status}\``)).toBe(
      'status === \'tecton-binding\' || "tecton-binding" || `tecton-binding`',
    );
    expect(rewrite('t.ts', `status: '${retained}', ${OLD}RetainedNonTokens`)).toBe(
      "status: 'retained-default', retainedNonTokens",
    );
  });

  it('leaves the owner project name and paths alone when they are not a quoted status id', () => {
    const text = `see /home/user/rpkapps/tecton-${OLD}/packages and (tecton-${OLD} name)`;
    expect(rewrite('a.md', text)).toBe(text);
  });

  it('drops csspart target notes from component sources only', () => {
    const source = [
      ` * @csspart frame - The outer box ${target('banner-frame')}.`,
      ` * @csspart radio - The circle (${target('radio').slice(1, -1)}; the deprecated name is also set).`,
      ` * @csspart item - The row (${target('list-item').slice(1, -1)}, on the same element).`,
      ` * @csspart surface - The box (on \`tct-x\`, ${target('tooltip').slice(1, -1)}).`,
      ` * @csspart button - The native button. ${target('button').slice(1, -1)}.`,
    ].join('\n');
    expect(rewrite('packages/components/src/x/tct-x.ts', source)).toBe(
      [
        ' * @csspart frame - The outer box.',
        ' * @csspart radio - The circle (the deprecated name is also set).',
        ' * @csspart item - The row (on the same element).',
        ' * @csspart surface - The box (on `tct-x`).',
        ' * @csspart button - The native button.',
      ].join('\n'),
    );
    expect(rewrite('docs/note.md', source)).toBe(source);
  });

  it('renames the reference theme in component CSS comments', () => {
    expect(
      rewrite('packages/components/src/x/tct-x.styles.css', `/* ${status} components.ts \`x\` */`),
    ).toBe("/* the Tecton reference theme's components.ts `x` */");
  });

  it('is idempotent', () => {
    const text = [
      `import '${scope}core/x.js'; t('${id('a.b')}'); '${vendor}'; '${status}'; '${retained}';`,
      ` * @csspart a - A ${target('a')}.`,
    ].join('\n');
    const once = rewrite('packages/components/src/x/tct-x.ts', text);
    expect(transform('packages/components/src/x/tct-x.ts', once).text).toBe(once);
    expect(Object.keys(transform('packages/components/src/x/tct-x.ts', once).counts)).toEqual([]);
  });
});

describe('what is skipped', () => {
  it('never touches the upstream catalogs, planning docs or the codemod itself', () => {
    expect(isSkipped('packages/locales/src/catalogs/en.json')).toBe(true);
    expect(isSkipped('docs/plan/DECISIONS.md')).toBe(true);
    expect(isSkipped('docs/research/tecton-theme.md')).toBe(true);
    expect(isSkipped('tools/codemods/d015-rename.ts')).toBe(true);
    expect(isSkipped('apps/docs/public/favicon.png')).toBe(true);
    expect(isSkipped('packages/locales/src/types.ts')).toBe(false);
    expect(isSkipped('docs/CONVENTIONS.md')).toBe(false);
  });
});

describe('run over a directory', () => {
  let root: string;
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), {recursive: true});
    writeFileSync(join(root, path), text);
  };
  const read = (path: string) => readFileSync(join(root, path), 'utf8');

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'tct-d015-'));
  });
  afterEach(() => {
    rmSync(root, {recursive: true, force: true});
  });

  it('rewrites new files, leaves excluded trees alone and reports a second run as clean', () => {
    const catalog = JSON.stringify({[id('button.loading')]: {defaultMessage: 'Loading'}});
    write('packages/new/src/a.ts', `import '${scope}core/x.js'; t('${id('new.key')}');`);
    write('packages/locales/src/catalogs/en.json', catalog);
    write('packages/new/dist/a.js', `'${scope}'`);
    write('packages/new/src/generated/index.ts', `'${scope}'`);
    write('node_modules/x/index.js', `'${scope}'`);
    write('.claude/worktrees/w/a.ts', `'${scope}'`);
    write('docs/plan/D.md', `\`${id('*')}\``);
    write('apps/docs/public/blob.bin', 'a\0b');

    const first = run({root});
    expect(first.changed.map((file) => file.path)).toEqual(['packages/new/src/a.ts']);
    expect(read('packages/new/src/a.ts')).toBe("import '@tecton-wc/core/x.js'; t('@tct.new.key');");
    expect(read('packages/locales/src/catalogs/en.json')).toBe(catalog);
    expect(read('packages/new/dist/a.js')).toBe(`'${scope}'`);
    expect(read('node_modules/x/index.js')).toBe(`'${scope}'`);
    expect(read('.claude/worktrees/w/a.ts')).toBe(`'${scope}'`);
    expect(read('docs/plan/D.md')).toBe(`\`${id('*')}\``);

    expect(run({root}).changed).toEqual([]);
  });

  it('writes nothing on a dry run', () => {
    write('a.ts', `'${scope}core'`);
    const result = run({root, dryRun: true});
    expect(result.changed).toHaveLength(1);
    expect(read('a.ts')).toBe(`'${scope}core'`);
  });
});

describe('CLI', () => {
  it('prints what it changed and stays idempotent on the real repository', () => {
    const script = new URL('./d015-rename.ts', import.meta.url).pathname;
    const result = spawnSync(process.execPath, [script, '--dry-run'], {encoding: 'utf8'});
    expect(result.status).toBe(0);
    // The repository itself has been migrated: a dry run over it finds nothing left to rename.
    expect(result.stdout).toMatch(/would change 0 of \d+ file\(s\)/);
    // A node process scanning the whole repository (thousands of files).
  }, 60_000);
});
