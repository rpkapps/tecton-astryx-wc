import {existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';

const ALWAYS_SKIPPED = new Set(['node_modules', '.git', 'dist', '.astro']);

export interface WalkOptions {
  /** Directory names never entered (in addition to node_modules, .git, dist). */
  skipDirs?: readonly string[];
}

/** Every file under `dir` (absolute paths, sorted, deterministic). Missing `dir` yields []. */
export function walkFiles(dir: string, options: WalkOptions = {}): string[] {
  if (!existsSync(dir)) return [];
  const skip = new Set([...ALWAYS_SKIPPED, ...(options.skipDirs ?? [])]);
  const out: string[] = [];
  const visit = (current: string) => {
    for (const entry of readdirSync(current, {withFileTypes: true}).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) visit(full);
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  };
  visit(dir);
  return out;
}

/** Immediate subdirectory names of `dir` (sorted). Missing `dir` yields []. */
export function listDirs(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

/** Writes `content` only when it differs (keeps mtimes stable for watchers). Returns true if written. */
export function writeIfChanged(path: string, content: string): boolean {
  if (existsSync(path) && readFileSync(path, 'utf8') === content) return false;
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, content);
  return true;
}
