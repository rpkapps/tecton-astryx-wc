/**
 * `pnpm licenses:check` (A§18.6, D-007a, D-008). Walks the whole installed tree via
 * `pnpm licenses list --json` and fails on any licence outside the allowlist, on dev-only tools
 * leaking into the shipped runtime tree, on a missing THIRD-PARTY-NOTICES.md entry, and on breaches
 * of D-008 (a LICENSE file, or a package.json that is not `private` + `UNLICENSED`).
 */
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {listDirs} from '../lib/fs.ts';
import {ROOT} from '../lib/paths.ts';
import {
  evaluateLicenses,
  REQUIRED_NOTICE_TEXT,
  SHIPPED_ASSET_PACKAGES,
  SHIPPED_PACKAGES,
  type Finding,
  type PackageLicense,
} from './policy.ts';

function pnpmLicenses(args: readonly string[]): PackageLicense[] {
  const result = spawnSync('pnpm', [...args, 'licenses', 'list', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: {...process.env, NO_COLOR: '1'},
  });
  if (result.status !== 0 && !result.stdout.trim().startsWith('{')) {
    if (/No licenses in packages found/i.test(result.stdout + result.stderr)) return [];
    throw new Error(
      `pnpm ${args.join(' ')} licenses list failed:\n${result.stderr || result.stdout}`,
    );
  }
  const text = result.stdout.trim();
  if (!text.startsWith('{')) return []; // "No licenses in packages found"
  const grouped = JSON.parse(text) as Record<
    string,
    {name: string; versions: string[]; license?: string}[]
  >;
  return Object.entries(grouped).flatMap(([license, packages]) =>
    packages.map((pkg) => ({
      name: pkg.name,
      versions: pkg.versions,
      license: pkg.license ?? license,
    })),
  );
}

function workspaceManifests(): {path: string; json: Record<string, unknown>}[] {
  const dirs = [
    '.',
    ...listDirs(join(ROOT, 'packages')).map((name) => `packages/${name}`),
    ...listDirs(join(ROOT, 'apps')).map((name) => `apps/${name}`),
    'tools',
  ];
  return dirs
    .map((dir) => join(dir, 'package.json'))
    .filter((path) => existsSync(join(ROOT, path)))
    .map((path) => ({
      path,
      json: JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as Record<string, unknown>,
    }));
}

function checkOwnLicence(): Finding[] {
  const findings: Finding[] = [];
  for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE']) {
    if (existsSync(join(ROOT, name))) {
      findings.push({
        level: 'error',
        message: `${name} must not exist (D-008: the library is unlicensed)`,
      });
    }
  }
  for (const {path, json} of workspaceManifests()) {
    if (json.private !== true)
      findings.push({level: 'error', message: `${path}: "private" must be true (D-008)`});
    if (json.license !== 'UNLICENSED') {
      findings.push({level: 'error', message: `${path}: "license" must be "UNLICENSED" (D-008)`});
    }
  }
  return findings;
}

function checkNotices(shippedNames: ReadonlySet<string>): Finding[] {
  const path = join(ROOT, 'THIRD-PARTY-NOTICES.md');
  if (!existsSync(path))
    return [{level: 'error', message: 'THIRD-PARTY-NOTICES.md is missing (D-007a, D-008)'}];
  const text = readFileSync(path, 'utf8');
  const findings: Finding[] = [];
  const mentioned = (name: string) => text.includes(`\`${name}\``) || text.includes(`\`${name}@`);
  for (const name of [...shippedNames, ...SHIPPED_ASSET_PACKAGES]) {
    if (!mentioned(name))
      findings.push({level: 'error', message: `THIRD-PARTY-NOTICES.md does not list \`${name}\``});
  }
  for (const needle of REQUIRED_NOTICE_TEXT) {
    if (!text.includes(needle))
      findings.push({level: 'error', message: `THIRD-PARTY-NOTICES.md must mention "${needle}"`});
  }
  return findings;
}

function main(): number {
  const all = pnpmLicenses([]);
  const shippedNames = new Set<string>();
  for (const pkg of SHIPPED_PACKAGES) {
    for (const entry of pnpmLicenses(['--filter', pkg, '--prod'])) shippedNames.add(entry.name);
  }

  const findings = [
    ...evaluateLicenses({all, shippedNames}),
    ...checkOwnLicence(),
    ...checkNotices(shippedNames),
  ];

  for (const finding of findings.filter((f) => f.level === 'warning'))
    console.warn(`warning: ${finding.message}`);
  const errors = findings.filter((f) => f.level === 'error');
  for (const finding of errors) console.error(`error: ${finding.message}`);

  if (errors.length > 0) {
    console.error(`\nlicenses:check FAILED (${errors.length} error(s)).`);
    return 1;
  }
  console.log(
    `licenses:check OK: ${all.length} installed packages checked, ${shippedNames.size} in the shipped runtime tree, ` +
      `${findings.length} warning(s).`,
  );
  return 0;
}

process.exit(main());
