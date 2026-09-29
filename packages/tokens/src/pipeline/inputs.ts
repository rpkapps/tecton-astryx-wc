/** Loading and hash-verifying the token inputs (A§5.1). */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import type {AllowFile, PairsFile} from './contrast.ts';
import type {Inputs} from './model.ts';

/** `packages/tokens` */
export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const INPUTS_DIR = join(PACKAGE_ROOT, 'src', 'inputs');
export const DIST_DIR = join(PACKAGE_ROOT, 'dist');
export const SNAPSHOT_FILE = join(PACKAGE_ROOT, 'snapshots', 'token-names.json');

export interface LockFile {
  version: number;
  files: Record<string, {sha256: string; bytes: number; origin: string}>;
}

/** Palette hash pinned by A§5.1 and the semantic map (independent of the lock file). */
export const PALETTE_SHA256 = '4731ddd0b9f362261c77fbd4531dfc4cc0d924406eeb5636a8442d4a951367f3';

export function sha256(buffer: Buffer | string): string {
  return createHash('sha256').update(buffer).digest('hex');
}

const readInput = (name: string) => readFileSync(join(INPUTS_DIR, name));
const readJson = <T>(name: string): T => JSON.parse(readInput(name).toString('utf8')) as T;

/** One line per mismatch; empty when every locked input matches. */
export function verifyInputHashes(dir: string = INPUTS_DIR): string[] {
  const problems: string[] = [];
  const lock = JSON.parse(readFileSync(join(dir, 'inputs.lock.json'), 'utf8')) as LockFile;
  for (const [name, entry] of Object.entries(lock.files)) {
    let actual: string;
    try {
      actual = sha256(readFileSync(join(dir, name)));
    } catch {
      problems.push(`${name}: file is missing`);
      continue;
    }
    if (actual !== entry.sha256)
      problems.push(`${name}: sha256 ${actual} does not match inputs.lock.json (${entry.sha256})`);
  }
  const palette = lock.files['tecton.tokens.json'];
  if (palette?.sha256 !== PALETTE_SHA256)
    problems.push(`tecton.tokens.json must be pinned to ${PALETTE_SHA256} (A§5.1)`);
  return problems;
}

/** Contrast inputs (authored): the pair rules and the allowlist of known design shortfalls. */
export function loadContrastInputs(): {pairs: PairsFile; allow: AllowFile} {
  return {
    pairs: readJson<PairsFile>('contrast.pairs.json'),
    allow: readJson<AllowFile>('contrast.allow.json'),
  };
}

export function loadInputs(): Inputs {
  return {
    paletteJson: readJson('tecton.tokens.json'),
    exportCss: readInput('tecton-tokens.css').toString('utf8'),
    semanticMap: readJson('semantic-map.json'),
    upstreamTokens: readJson('upstream-tokens.json'),
    tailwindNames: readJson('tailwind-v4-theme-names.json'),
    overrides: readJson('bindings.overrides.json'),
    extraTokens: readJson('extra-tokens.json'),
    provisional: readJson('provisional.json'),
    unresolvedAllow: readJson('unresolved.allow.json'),
  };
}
