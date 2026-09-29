/** Repository paths shared by the tools scripts. Scripts never import package source (A§2.3). */
import {dirname, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const PATHS = {
  components: resolve(ROOT, 'packages/components'),
  componentsSrc: resolve(ROOT, 'packages/components/src'),
  coreSrc: resolve(ROOT, 'packages/core/src'),
  manifest: resolve(ROOT, 'docs/research/astryx-parity-manifest.json'),
  paritySchema: resolve(ROOT, 'tools/schemas/parity.schema.json'),
  docsFrontmatterSchema: resolve(ROOT, 'tools/schemas/docs-frontmatter.schema.json'),
  reports: resolve(ROOT, 'reports'),
} as const;

/** Repository-relative POSIX path (stable in messages on every platform). */
export function rel(path: string, root: string = ROOT): string {
  return relative(root, path).split(sep).join('/');
}
