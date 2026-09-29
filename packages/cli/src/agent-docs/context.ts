/**
 * The block the installed registry generates for the current project: shared by `init`, `upgrade` and
 * `doctor`, so all three agree on what "current" means.
 */
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import type {CommandContext} from '../command.ts';
import type {LoadedRegistry} from '../registry/load.ts';
import {detectInvocation, renderBlock} from './block.ts';

/** Version of the component library the registry came from: the package.json next to it. */
export function libraryVersion(loaded: LoadedRegistry): string {
  try {
    const pkg = JSON.parse(readFileSync(join(dirname(loaded.path), 'package.json'), 'utf8')) as {
      version?: string;
    };
    if (typeof pkg.version === 'string') return pkg.version;
  } catch {
    // A registry passed with --registry has no package next to it.
  }
  return '0.0.0';
}

export function expectedBlock(context: CommandContext): {
  block: string;
  version: string;
  invocation: string;
} {
  const loaded = context.registry();
  const version = libraryVersion(loaded);
  const invocation = detectInvocation(context.cwd);
  return {
    block: renderBlock({registry: loaded.registry, version, invocation}),
    version,
    invocation,
  };
}
