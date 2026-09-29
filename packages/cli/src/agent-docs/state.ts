/**
 * Where the managed agent-docs block is written and how a project is recognised as set up.
 * Dependency free (Node built-ins only), so it can also back a postinstall nudge.
 */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

export const AGENTS_MD = 'AGENTS.md';
export const CLAUDE_MD = 'CLAUDE.md';
export const CLAUDE_DIR_MD = '.claude/CLAUDE.md';
export const CURSOR_RULES = '.cursorrules';

export const MARKER_START = '<!-- TCT:START -->';
export const MARKER_END = '<!-- TCT:END -->';

/** Every location a preset (or the default) can write the block: discovery and removal derive from it. */
export const AGENT_DOC_PATHS: readonly string[] = [
  AGENTS_MD,
  CLAUDE_MD,
  CLAUDE_DIR_MD,
  CURSOR_RULES,
];

/** Agent-doc files that exist in a directory, across every location a preset can write. */
export function discoverAgentDocs(dir: string): string[] {
  return AGENT_DOC_PATHS.filter((path) => existsSync(join(dir, path)));
}

/** True when any agent-doc file already carries the managed-block marker (`tct init` has run). */
export function isInitialised(dir: string): boolean {
  for (const path of discoverAgentDocs(dir)) {
    try {
      if (readFileSync(join(dir, path), 'utf8').includes(MARKER_START)) return true;
    } catch {
      // Unreadable: ignore and keep checking the others.
    }
  }
  return false;
}
