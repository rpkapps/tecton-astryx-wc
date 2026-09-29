/**
 * Writing the managed block into agent-doc files, and taking it out again.
 *
 * The contract every function keeps: bytes outside the TCT markers are never touched. A file with a
 * malformed block (duplicate or unterminated markers) is refused, never guessed at. Every target is
 * checked with `assertWithin` for the whole run before the first write, so an escape writes nothing.
 */
import {existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync} from 'node:fs';
import {basename, dirname, extname, join, normalize, isAbsolute} from 'node:path';
import {ERROR_CODES, CliError} from '../errors.ts';
import {assertWithin} from '../fs-safety.ts';
import {
  AGENTS_MD,
  CLAUDE_DIR_MD,
  CLAUDE_MD,
  CURSOR_RULES,
  MARKER_END,
  MARKER_START,
  discoverAgentDocs,
} from './state.ts';

export const AGENT_PRESETS = ['claude', 'cursor', 'codex', 'all'] as const;
export type AgentPreset = (typeof AGENT_PRESETS)[number];

/** First existing file wins; the last entry is created when none exists. */
const PRESET_PATHS: Record<Exclude<AgentPreset, 'all'>, string[]> = {
  claude: [CLAUDE_MD, CLAUDE_DIR_MD],
  cursor: [CURSOR_RULES],
  codex: [AGENTS_MD],
};

export interface BlockRange {
  start: number;
  end: number;
}

/**
 * The single well-formed managed block of `content`: END is searched strictly after START so the boundaries
 * can never cross. A file with two STARTs, or a START without an END, is ambiguous and refused.
 */
export function findManagedBlock(content: string, file = 'file'): BlockRange | null {
  const startAt = content.indexOf(MARKER_START);
  if (startAt === -1) {
    if (content.includes(MARKER_END)) {
      throw malformed(`found an end marker with no start marker in ${file}`);
    }
    return null;
  }
  const endAt = content.indexOf(MARKER_END, startAt + MARKER_START.length);
  if (endAt === -1) throw malformed(`found a start marker with no matching end in ${file}`);
  if (content.includes(MARKER_START, startAt + MARKER_START.length)) {
    throw malformed(`multiple "${MARKER_START}" markers found in ${file}`);
  }
  return {start: startAt, end: endAt + MARKER_END.length};
}

const malformed = (what: string): CliError =>
  new CliError(
    `Malformed agent-docs block: ${what}. Remove the duplicate or broken block by hand, then re-run.`,
    ERROR_CODES.ERR_AGENT_DOCS_MALFORMED,
  );

const headerFor = (path: string): string => {
  const title = basename(path);
  if (extname(path) === '.mdc') {
    // Cursor rule files carry front matter; `alwaysApply` makes the rule load in every chat.
    return `---\ndescription: Tecton Web Components: search the docs before writing UI\nalwaysApply: true\n---\n\n# ${title}`;
  }
  return `# ${title}\n\nProject-specific guidance for AI coding agents.`;
};

/**
 * Injects or refreshes the block in one file. Replaces the text between an existing pair of markers; else
 * appends (unless `onlyReplace`); creates the file (with a header) when `create` is set. Returns whether the
 * file was written.
 */
export function injectBlock(
  file: string,
  block: string,
  options: {create?: boolean; onlyReplace?: boolean; header?: string} = {},
): boolean {
  let content: string;
  if (existsSync(file)) {
    content = readFileSync(file, 'utf8');
    const range = findManagedBlock(content, file);
    if (range) {
      content = content.slice(0, range.start) + block + content.slice(range.end);
    } else if (options.onlyReplace) {
      return false;
    } else {
      content = `${content.trimEnd()}\n\n${block}\n`;
    }
  } else if (options.create) {
    const header = options.header ?? headerFor(file);
    content = `${header}\n\n${block}\n`;
  } else {
    return false;
  }
  mkdirSync(dirname(file), {recursive: true});
  writeFileSync(file, content);
  return true;
}

/** Removes the managed block; deletes a file that only held the generated header and the block. */
export function removeBlock(
  file: string,
  options: {deleteIfEmpty?: boolean} = {},
): 'removed' | 'deleted' | 'none' {
  if (!existsSync(file)) return 'none';
  const content = readFileSync(file, 'utf8');
  const range = findManagedBlock(content, file);
  if (!range) return 'none';
  const before = content.slice(0, range.start).trimEnd();
  const after = content.slice(range.end).trimStart();
  const next = `${before}${after ? `\n\n${after}` : ''}\n`;
  if (options.deleteIfEmpty) {
    const rest = next
      .replace(/^---\n[\s\S]*?\n---\n*/, '')
      .replace(/^#.*\n+(?:Project-specific guidance for AI coding agents\.)?\n*/m, '')
      .trim();
    if (rest === '') {
      unlinkSync(file);
      return 'deleted';
    }
  }
  writeFileSync(file, next);
  return 'removed';
}

/** Files that import another agent doc with an `@path` line: they already carry its content. */
function discoverWrappers(dir: string, docs: readonly string[]): Set<string> {
  const known = new Set(docs.map((path) => normalize(path)));
  const imports = new Map<string, Set<string>>();
  for (const path of docs) {
    let content: string;
    try {
      content = readFileSync(join(dir, path), 'utf8');
    } catch {
      continue;
    }
    const targets = new Set<string>();
    for (const line of content.split(/\r?\n/)) {
      const match = /^\s*@(\S+)\s*$/.exec(line);
      if (!match || isAbsolute(match[1]!)) continue;
      const imported = normalize(join(dirname(path), match[1]!));
      if (imported !== normalize(path) && known.has(imported)) targets.add(imported);
    }
    if (targets.size > 0) imports.set(path, targets);
  }
  // Import cycles have no canonical owner: their members stay standalone.
  const cyclic = (start: string): boolean => {
    const visit = (current: string, seen: Set<string>): boolean => {
      for (const next of imports.get(current) ?? []) {
        if (next === start) return true;
        if (seen.has(next)) continue;
        seen.add(next);
        if (visit(next, seen)) return true;
      }
      return false;
    };
    return visit(start, new Set([start]));
  };
  return new Set([...imports.keys()].filter((path) => !cyclic(path)));
}

/** Which files a preset writes: existing ones are updated in place, else the default is created. */
export function resolvePreset(
  dir: string,
  agent: AgentPreset,
): {inject: string[]; create: string[]} {
  if (agent === 'all') {
    const existing = discoverAgentDocs(dir);
    return existing.length > 0
      ? {inject: existing, create: []}
      : {inject: [], create: [AGENTS_MD, CLAUDE_DIR_MD]};
  }
  const candidates = PRESET_PATHS[agent];
  for (const path of candidates)
    if (existsSync(join(dir, path))) return {inject: [path], create: []};
  return {inject: [], create: [candidates[candidates.length - 1]!]};
}

export interface InstallResult {
  /** Files written, relative to the project. */
  written: string[];
  /** The subset of `written` that did not exist before. */
  created: string[];
}

export interface InstallOptions {
  agent?: AgentPreset;
  /** Explicit files (relative, inside the project). Overrides `agent` and auto-detection. */
  paths?: string[];
  /** Only refresh files that already carry a block (`upgrade --apply`). */
  onlyReplace?: boolean;
}

/**
 * Installs the block. Without `agent` or `paths`: every existing agent-doc file is initialised or refreshed
 * (an `@path` wrapper of another agent doc is left alone, and a block an older run duplicated into it is
 * removed); when none exists, `AGENTS.md` (the tool-agnostic standard) is created.
 */
export function installAgentDocs(
  dir: string,
  block: string,
  options: InstallOptions = {},
): InstallResult {
  const written: string[] = [];
  const created: string[] = [];
  const write = (path: string, create: boolean, onlyReplace = false) => {
    const abs = join(dir, path);
    const existed = existsSync(abs);
    if (injectBlock(abs, block, {create, onlyReplace})) {
      written.push(path);
      if (!existed) created.push(path);
    }
  };
  const check = (paths: readonly string[]) => {
    for (const path of paths) assertWithin(path, dir, 'agent docs path');
  };

  if (options.paths && options.paths.length > 0) {
    check(options.paths);
    for (const path of options.paths) write(path, true);
    return {written, created};
  }
  if (options.agent) {
    const {inject, create} = resolvePreset(dir, options.agent);
    check([...inject, ...create]);
    for (const path of inject) write(path, false);
    for (const path of create) write(path, true);
    return {written, created};
  }

  const existing = discoverAgentDocs(dir);
  if (existing.length > 0) {
    const wrappers = discoverWrappers(dir, existing);
    const targets = existing.filter((path) => !wrappers.has(path));
    const marked = (path: string) => readFileSync(join(dir, path), 'utf8').includes(MARKER_START);
    check([
      ...targets.filter((path) => !options.onlyReplace || marked(path)),
      ...[...wrappers].filter(marked),
    ]);
    for (const path of targets) write(path, false, options.onlyReplace);
    for (const path of wrappers) {
      if (removeBlock(join(dir, path)) === 'removed') written.push(path);
    }
    return {written, created};
  }
  if (options.onlyReplace) return {written, created};
  check([AGENTS_MD]);
  write(AGENTS_MD, true);
  return {written, created};
}

/** Removes the block from every known agent-doc file (`init --remove-agents`). */
export function removeAgentDocs(dir: string): {removed: string[]; deleted: string[]} {
  const all = discoverAgentDocs(dir);
  const withBlock = all.filter((path) => {
    try {
      return findManagedBlock(readFileSync(join(dir, path), 'utf8'), path) !== null;
    } catch {
      return true; // Malformed: surfaced by removeBlock below.
    }
  });
  for (const path of withBlock) assertWithin(path, dir, 'agent docs path');
  const removed: string[] = [];
  const deleted: string[] = [];
  for (const path of all) {
    // Files this tool creates by default disappear when nothing else is left in them.
    const outcome = removeBlock(join(dir, path), {
      deleteIfEmpty: path === AGENTS_MD || path === CLAUDE_DIR_MD,
    });
    if (outcome === 'removed') removed.push(path);
    if (outcome === 'deleted') deleted.push(path);
  }
  return {removed, deleted};
}
