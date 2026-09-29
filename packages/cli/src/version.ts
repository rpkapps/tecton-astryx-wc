/**
 * The CLI's own version (the `version` field of its package.json). Read next to the module; when the module
 * has been bundled into a site build the file is not there, and the version reads as `0.0.0`.
 */
import {readFileSync} from 'node:fs';

function readVersion(): string {
  try {
    const manifest = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as {version?: unknown};
    return typeof manifest.version === 'string' ? manifest.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const VERSION: string = readVersion();
