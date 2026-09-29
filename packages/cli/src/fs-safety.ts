/**
 * Path safety for every command that writes to a user-controlled path.
 *
 * `path.join` silently re-roots an absolute path and follows `..`, and a symlink can carry a write out of
 * the project. `assertWithin` resolves the path against the root and refuses (`ERR_PATH_TRAVERSAL`) an
 * absolute path, a `..` escape, and a path whose nearest existing ancestor (or the file itself) is a
 * symlink that leaves the root. Nothing is written before every target in a run has been checked.
 */
import {existsSync, lstatSync, realpathSync} from 'node:fs';
import {dirname, isAbsolute, relative, resolve, sep} from 'node:path';
import {ERROR_CODES, CliError} from './errors.ts';

const inside = (root: string, target: string): boolean => {
  const rel = relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

/** The real path of `path`, or of its nearest existing ancestor with the missing tail re-appended. */
function realOrAncestor(path: string): string {
  let current = path;
  const tail: string[] = [];
  while (!existsSync(current) && !isLink(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    tail.unshift(current.slice(parent.length + 1));
    current = parent;
  }
  let real: string;
  try {
    real = realpathSync(current);
  } catch {
    // A dangling symlink: resolve where it points, so an escape is still caught.
    real = current;
  }
  return tail.length > 0 ? resolve(real, ...tail) : real;
}

function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

export function assertWithin(targetPath: string, rootDir: string, label = 'path'): string {
  if (typeof targetPath !== 'string' || targetPath.length === 0) {
    throw new CliError(
      `Invalid ${label}: must be a non-empty string.`,
      ERROR_CODES.ERR_INVALID_ARGUMENT,
    );
  }
  if (targetPath.includes('\0')) {
    throw new CliError(`Invalid ${label}: contains a NUL byte.`, ERROR_CODES.ERR_PATH_TRAVERSAL);
  }
  if (isAbsolute(targetPath)) {
    throw new CliError(
      `Invalid ${label} "${targetPath}": absolute paths are not allowed. Use a path relative to the project root.`,
      ERROR_CODES.ERR_PATH_TRAVERSAL,
    );
  }
  const root = resolve(rootDir);
  const resolved = resolve(root, targetPath);
  if (!inside(root, resolved)) {
    throw new CliError(
      `Invalid ${label} "${targetPath}": it resolves outside the project.`,
      ERROR_CODES.ERR_PATH_TRAVERSAL,
    );
  }
  // Symlinks: the real location must stay inside the real root.
  if (!inside(realOrAncestor(root), realOrAncestor(resolved))) {
    throw new CliError(
      `Invalid ${label} "${targetPath}": it resolves through a symbolic link outside the project.`,
      ERROR_CODES.ERR_PATH_TRAVERSAL,
    );
  }
  return resolved;
}

/** True when the target is `dir` itself or lives beneath it. */
export const isWithin = (dir: string, target: string): boolean =>
  inside(resolve(dir), resolve(target));

export const posix = (path: string): string => path.split(sep).join('/');
