/**
 * Read-only assessment of the managed blocks in a project against the block the installed registry would
 * generate now. The detection half of `tct upgrade` (which never writes on its own) and of `tct doctor`.
 *
 * Per file: `current` (byte-identical to a fresh block), `stale` (an unedited older block), `edited` (the body
 * no longer matches the hash recorded with it: a person changed it), `malformed` (duplicate or unterminated
 * markers). A project is `missing` when no file carries a block.
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {CliError} from '../errors.ts';
import {readBlock} from './block.ts';
import {findManagedBlock} from './files.ts';
import {discoverAgentDocs} from './state.ts';

export type BlockState = 'current' | 'stale' | 'edited' | 'malformed';

export interface BlockFile {
  path: string;
  state: BlockState;
  /** Library version recorded in the block header. */
  blockVersion: string | null;
  /** Why the file needs attention (malformed and edited blocks). */
  detail?: string;
}

export interface Inspection {
  status: 'missing' | 'current' | 'stale' | 'edited' | 'malformed';
  files: BlockFile[];
}

export function inspectAgentDocs(dir: string, expectedBlock: string): Inspection {
  const files: BlockFile[] = [];
  for (const path of discoverAgentDocs(dir)) {
    let content: string;
    try {
      content = readFileSync(join(dir, path), 'utf8');
    } catch {
      continue;
    }
    if (!content.includes('<!-- TCT:START -->') && !content.includes('<!-- TCT:END -->')) continue;
    let range;
    try {
      range = findManagedBlock(content, path);
    } catch (error) {
      files.push({
        path,
        state: 'malformed',
        blockVersion: null,
        detail: error instanceof CliError ? error.message : String(error),
      });
      continue;
    }
    if (!range) continue;
    const actual = content.slice(range.start, range.end);
    const facts = readBlock(actual);
    if (actual === expectedBlock) files.push({path, state: 'current', blockVersion: facts.version});
    else if (!facts.intact) {
      files.push({
        path,
        state: 'edited',
        blockVersion: facts.version,
        detail: 'the block body was changed by hand (it no longer matches its recorded hash)',
      });
    } else files.push({path, state: 'stale', blockVersion: facts.version});
  }
  const worst = (['malformed', 'edited', 'stale'] as const).find((state) =>
    files.some((file) => file.state === state),
  );
  return {status: files.length === 0 ? 'missing' : (worst ?? 'current'), files};
}
