/**
 * The D-015 gate (tools/docs/public-check.ts): generated public output must not name the upstream design
 * system. Tests cover the detector, the scanner over real files, and the CLI failing with exit code 1.
 */
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterAll, beforeAll, describe, expect, it} from 'vitest';
import {countTransitional, publicText, upstreamLeaks} from '../lib/public-text.ts';
import {scanPublicOutputs} from './public-check.ts';

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'tct-public-'));
});
afterAll(() => {
  rmSync(root, {recursive: true, force: true});
});

describe('upstreamLeaks', () => {
  it('finds the name in any case and context', () => {
    expect(upstreamLeaks('Powered by Astryx.')).toHaveLength(1);
    expect(upstreamLeaks('.astryx-button and ASTRYX')).toHaveLength(2);
    expect(upstreamLeaks('Tecton design system')).toEqual([]);
  });

  it('tolerates and counts only the identifiers whose rename is scheduled', () => {
    const text = 'import "@tecton-astryx/core/x.js"; id `@astryx.button.loading`; href="/vendor/tecton-astryx/a.css"';
    expect(upstreamLeaks(text)).toEqual([]);
    expect(countTransitional(text)).toBe(3);
    expect(upstreamLeaks(`${text} and Astryx`)).toHaveLength(1);
  });
});

describe('publicText on authored guide prose', () => {
  it('drops provenance paragraphs and neutralises status names and upstream packages', () => {
    const text = [
      'Body.',
      'Adapted from Astryx docs topic `theme` (+ `theme.doc.dense`) (facebook/astryx @ ca632c6, MIT; see THIRD-PARTY-NOTICES.md).',
      '| `@astryxdesign/core/Button` | `x` | Astryx-retained | _Astryx default_ | `astryx-retained` |',
    ].join('\n');
    const out = publicText(text);
    expect(upstreamLeaks(out)).toEqual([]);
    expect(out).toContain('Body.');
    expect(out).not.toContain('Adapted from');
    expect(out).toContain('upstream/core/Button');
  });
});

describe('scanPublicOutputs and the CLI', () => {
  it('passes clean output and reports guides without failing on them', () => {
    const page = join(root, 'clean.mdx');
    writeFileSync(page, '# Button\n\nUses `@tecton-astryx/components/button`.\n');
    const guides = join(root, 'guides');
    mkdirSync(guides, {recursive: true});
    writeFileSync(join(guides, 'g.mdx'), 'Astryx for React\n');
    const scan = scanPublicOutputs([page], guides);
    expect(scan.leaks).toEqual([]);
    expect(scan.transitional).toBe(1);
    expect(scan.guides).toEqual([{file: join(guides, 'g.mdx'), count: 1}]);
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
  });
});
