/**
 * The D-015 gate (tools/docs/public-check.ts): generated public output must not name the upstream design
 * system. Tests cover the detector, the scanner over real files, and the CLI failing with exit code 1.
 */
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {publicData, publicText, upstreamLeaks} from '../lib/public-text.ts';
import {
  authoredPages,
  cliGeneratedTexts,
  distFiles,
  packageMetadataFiles,
  scanGeneratedTexts,
  scanPublicOutputs,
} from './public-check.ts';

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'tct-public-'));
});
afterAll(() => {
  rmSync(root, {recursive: true, force: true});
});

// The old identifiers are assembled from parts so that `tools/codemods/d015-rename.ts` never rewrites these fixtures.
const OLD_SCOPE = ['@tecton', 'astryx/'].join('-');
const OLD_ID = ['@', 'astryx.'].join('');
const OLD_VENDOR = ['/vendor/tecton', 'astryx/'].join('-');

describe('upstreamLeaks', () => {
  it('finds the name in any case and context', () => {
    expect(upstreamLeaks('Powered by Astryx.')).toHaveLength(1);
    expect(upstreamLeaks('.astryx-button and ASTRYX')).toHaveLength(2);
    expect(upstreamLeaks('Tecton design system')).toEqual([]);
  });

  it('is absolute: package scopes, message ids, vendor paths and class names all count', () => {
    const text = `import "${OLD_SCOPE}core/x.js"; id \`${OLD_ID}button.loading\`; href="${OLD_VENDOR}a.css"`;
    expect(upstreamLeaks(text)).toHaveLength(3);
    expect(upstreamLeaks('import "@tecton-wc/core/x.js"; id `@tct.button.loading`; href="/vendor/tecton-wc/a.css"')).toEqual([]);
  });
});

describe('publicData', () => {
  it('sanitises every string inside objects and arrays', () => {
    const out = publicData({notes: ['matching tecton-astryx components.ts `kbd`', 'data-astryx-media'], n: 3});
    expect(JSON.stringify(out)).not.toMatch(/astryx/i);
    expect(out.n).toBe(3);
  });
});

describe('publicText on authored guide prose', () => {
  it('drops provenance paragraphs and neutralises status names and upstream packages', () => {
    const text = [
      'Body.',
      'Adapted from Astryx docs topic `theme` (+ `theme.doc.dense`) (facebook/astryx @ ca632c6, MIT; see THIRD-PARTY-NOTICES.md).',
      '| `@astryxdesign/core/Button` | `x` | Astryx-retained | _Astryx default_ | `retained-default` |',
    ].join('\n');
    const out = publicText(text);
    expect(upstreamLeaks(out)).toEqual([]);
    expect(out).toContain('Body.');
    expect(out).not.toContain('Adapted from');
    expect(out).toContain('upstream/core/Button');
  });
});

describe('what the gate scans', () => {
  it('collects package metadata, dist text files and authored pages outside the guides', () => {
    const packages = join(root, 'packages');
    mkdirSync(join(packages, 'core', 'dist', 'sub'), {recursive: true});
    writeFileSync(join(packages, 'core', 'package.json'), '{}');
    writeFileSync(join(packages, 'core', 'dist', 'a.js'), 'x');
    writeFileSync(join(packages, 'core', 'dist', 'sub', 'b.d.ts'), 'x');
    writeFileSync(join(packages, 'core', 'dist', 'a.js.map'), 'x');
    writeFileSync(join(packages, 'core', 'dist', 'font.woff2'), 'x');
    // testing never ships and is never built: a dist/ there is a stale leftover and is not scanned.
    mkdirSync(join(packages, 'testing', 'dist'), {recursive: true});
    writeFileSync(join(packages, 'testing', 'dist', 'old.d.ts'), 'x');
    expect(packageMetadataFiles(packages)).toEqual([join(packages, 'core', 'package.json')]);
    expect(distFiles(packages).map((file) => file.slice(packages.length + 1))).toEqual([
      'core/dist/a.js',
      'core/dist/sub/b.d.ts',
    ]);
    const content = join(root, 'content');
    for (const dir of ['guides', 'components', 'reference', 'legal']) mkdirSync(join(content, dir), {recursive: true});
    for (const file of ['index.mdx', 'guides/g.mdx', 'components/c.mdx', 'reference/r.mdx', 'legal/n.mdx'])
      writeFileSync(join(content, file), 'x');
    expect(authoredPages(content).map((file) => file.slice(content.length + 1))).toEqual(['index.mdx', 'legal/n.mdx']);
  });
});

describe('scanPublicOutputs and the CLI', () => {
  it('passes clean output and clean guides', () => {
    const page = join(root, 'clean.mdx');
    writeFileSync(page, '# Button\n\nUses `@tecton-wc/components/button`.\n');
    const guides = join(root, 'clean-guides');
    mkdirSync(guides, {recursive: true});
    writeFileSync(join(guides, 'g.mdx'), 'Import `@tecton-wc/core/features.js`.\n');
    const scan = scanPublicOutputs([page], guides);
    expect(scan.leaks).toEqual([]);
    expect(scan.guidesScanned).toBe(1);
  });

  it('fails on an authored guide that names the upstream system', () => {
    const guides = join(root, 'dirty-guides');
    mkdirSync(guides, {recursive: true});
    writeFileSync(join(guides, 'g.mdx'), 'Astryx for React\n');
    const scan = scanPublicOutputs([], guides);
    expect(scan.leaks.map((leak) => leak.file)).toEqual([join(guides, 'g.mdx')]);
  });

  it('fails on a generated page, llms file or registry that names the upstream system', () => {
    const llms = join(root, 'llms.txt');
    const registry = join(root, 'agent-registry.json');
    writeFileSync(llms, '# Library\n\nAn implementation of Astryx.\n');
    writeFileSync(registry, JSON.stringify({library: {name: 'Tecton astryx'}}));
    const scan = scanPublicOutputs([llms, registry], undefined);
    expect(scan.leaks.map((leak) => leak.file)).toEqual([llms, registry]);
  });

  it('exits 1 for a leak and 0 for clean output when run as a script', () => {
    const script = new URL('./public-check.ts', import.meta.url).pathname;
    const bad = join(root, 'bad.txt');
    const good = join(root, 'good.txt');
    writeFileSync(bad, 'Astryx');
    writeFileSync(good, 'Tecton');
    const run = (file: string) => spawnSync(process.execPath, [script, file], {encoding: 'utf8'});
    const failed = run(bad);
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain('FAILED');
    expect(run(good).status).toBe(0);
    // Two node processes, each compiling the script: seconds on a loaded machine, not milliseconds.
  }, 60_000);
});

describe('CLI-generated text', () => {
  it('flags a leak in generated agent docs by the command that produced it', () => {
    const leaks = scanGeneratedTexts([
      {name: 'tct init --dry-run', text: 'Use the Astryx tokens.'},
      {name: 'tct layout grammar', text: 'clean'},
    ]);
    expect(leaks.map((leak) => leak.file)).toEqual(['<tct init --dry-run>']);
  });

  it('is empty when there is no registry to run against', async () => {
    expect(await cliGeneratedTexts(join(root, 'missing-registry.json'))).toEqual([]);
  });

  it('covers the agent-docs block, every command help and the MCP tool definitions, and they are clean', async () => {
    const texts = await cliGeneratedTexts();
    const names = texts.map((entry) => entry.name);
    expect(names).toContain('tct init --agent all --dry-run');
    expect(names).toContain('tct search --help');
    expect(names).toContain('mcp tool definitions');
    expect(texts.find((entry) => entry.name === 'tct init --agent all --dry-run')?.text).toContain(
      '<!-- TCT:START -->',
    );
    expect(scanGeneratedTexts(texts)).toEqual([]);
  }, 60_000);
});
