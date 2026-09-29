/** The CLI's own version (the `version` field of its package.json). */
import {readFileSync} from 'node:fs';

export const VERSION: string = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {version: string}
).version;
