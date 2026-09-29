/**
 * Lucide extraction (A§12, D-009): reads the dev-only `lucide` package and writes
 *
 *   packages/icons/src/lucide/<name>.ts   one `IconDefinition` data module per glyph (tree-shakeable)
 *   packages/icons/src/lucide.ts          `lucideIcons` lazy loaders + `lucideIconNames`
 *
 * Both are generated, gitignored build output (`pnpm generate` runs this file first-class). The
 * default set (`packages/icons/src/default.ts`) is authored: it maps the Astryx role names onto these
 * modules. `lucide` is never a runtime dependency; the generated modules contain plain data.
 */
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeIfChanged} from '../lib/fs.ts';
import {ROOT, rel} from '../lib/paths.ts';
import {
  iconNodeToDefinition,
  parseAliases,
  renderIconModule,
  renderRegistry,
  type IconNode,
} from './lucide-convert.ts';

const LUCIDE_DIR = join(ROOT, 'node_modules', 'lucide');
const ICONS_DIR = join(LUCIDE_DIR, 'dist', 'esm', 'icons');
const OUT_DIR = join(ROOT, 'packages', 'icons', 'src', 'lucide');
const REGISTRY_FILE = join(ROOT, 'packages', 'icons', 'src', 'lucide.ts');

async function main(): Promise<number> {
  if (!existsSync(ICONS_DIR)) {
    console.error(
      `  icons: ${rel(ICONS_DIR)} not found; is the dev-only "lucide" package installed?`,
    );
    return 1;
  }
  const {version, license} = JSON.parse(readFileSync(join(LUCIDE_DIR, 'package.json'), 'utf8')) as {
    version: string;
    license: string;
  };
  if (license !== 'ISC') {
    console.error(`  icons: lucide is licensed "${license}", expected ISC (D-009)`);
    return 1;
  }

  const names = readdirSync(ICONS_DIR)
    .filter((file) => file.endsWith('.mjs'))
    .map((file) => file.slice(0, -'.mjs'.length))
    .sort();

  // Remove modules of glyphs that no longer exist (a Lucide upgrade can drop icons).
  mkdirSync(OUT_DIR, {recursive: true});
  const wanted = new Set(names.map((name) => `${name}.ts`));
  for (const file of readdirSync(OUT_DIR)) if (!wanted.has(file)) rmSync(join(OUT_DIR, file));

  let changed = 0;
  for (const name of names) {
    const module = (await import(pathToFileURL(join(ICONS_DIR, `${name}.mjs`)).href)) as {
      default: IconNode;
    };
    let source: string;
    try {
      source = renderIconModule(iconNodeToDefinition(module.default, name), version);
    } catch (error) {
      console.error(`  icons: ${name}: ${(error as Error).message}`);
      return 1;
    }
    if (writeIfChanged(join(OUT_DIR, `${name}.ts`), source)) changed++;
  }

  const aliasSource = readFileSync(join(LUCIDE_DIR, 'dist', 'esm', 'iconsAndAliases.mjs'), 'utf8');
  const aliases = parseAliases(aliasSource, new Set(names));
  const registryChanged = writeIfChanged(REGISTRY_FILE, renderRegistry(names, aliases, version));

  console.log(
    `  icons: lucide@${version}: ${names.length} glyph modules (${changed} changed), ` +
      `${aliases.size} aliases${registryChanged ? ', wrote lucide.ts' : ''}`,
  );
  return 0;
}

process.exit(await main());
