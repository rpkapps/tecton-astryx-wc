/**
 * Docs site (A§16): Astro + Starlight, static output, Tecton-skinned.
 *
 *  - Tokens and fonts: `@tecton-astryx/tokens/tecton.css` (tokens + Figtree Variable + IBM Plex Mono),
 *    then `src/styles/docs.css` maps Starlight's `--sl-*` variables onto the tokens (A§16.1).
 *  - Components load from source through the `tct-source` export condition (A§2.3) so `docs:dev` and
 *    `docs:build` need no prior library build; the in-house Vite plugin compiles `*.styles.css`.
 *  - No sharp (D-012): Astro's passthrough image service.
 *  - Sidebar: the 11 upstream categories are static (A§3); each autogenerates from its directory. WP-D's
 *    guides autogenerate from `src/content/docs/guides/`.
 */
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import starlight from '@astrojs/starlight';
import {defineConfig, passthroughImageService} from 'astro/config';
import {defaultClientConditions, defaultServerConditions} from 'vite';
import {tctCss} from '../../tools/vite-plugin-tct-css.ts';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const COMPONENTS_SRC = fileURLToPath(new URL('../../packages/components/src', import.meta.url));

/** The 11 upstream categories (docs/research/astryx-parity-manifest.json), sidebar order. */
const CATEGORIES = [
  ['Action', 'action'],
  ['Chat', 'chat'],
  ['Container', 'container'],
  ['Content', 'content'],
  ['Feedback & Status', 'feedback-and-status'],
  ['Form Controls', 'form-controls'],
  ['Layout', 'layout'],
  ['Navigation', 'navigation'],
  ['Overlay', 'overlay'],
  ['Table & List', 'table-and-list'],
  ['Utility', 'utility'],
];

/** Speculative prefetch of same-origin docs pages. [mwg:improve-next-page-load-performance] */
const SPECULATION_RULES = JSON.stringify({
  prefetch: [
    {
      where: {href_matches: '/*'},
      eagerness: 'moderate',
    },
  ],
});

/**
 * `pnpm generate` runs first in every docs command (A§3): the component pages, reference pages, llms.txt
 * and the registry are generated files. `pnpm check` has generated already and sets TCT_GENERATED=1.
 */
const generate = {
  name: 'tct-generate',
  hooks: {
    'astro:config:setup': () => {
      if (process.env.TCT_GENERATED === '1') return;
      const result = spawnSync('node', ['tools/generate.ts'], {cwd: REPO_ROOT, stdio: 'inherit'});
      if (result.status !== 0) throw new Error('pnpm generate failed; the docs pages cannot be built.');
    },
  },
};

export default defineConfig({
  image: {service: passthroughImageService()},
  vite: {
    plugins: [tctCss({fallbacksFile: '../../packages/tokens/dist/fallbacks.json'})],
    resolve: {
      conditions: ['tct-source', ...defaultClientConditions],
      alias: {'@examples': COMPONENTS_SRC},
    },
    ssr: {resolve: {conditions: ['tct-source', ...defaultServerConditions]}},
    build: {
      rolldownOptions: {
        // Astro's own `use astro:head-inject` marker in every content entry: expected, and very noisy.
        onLog(level, log, handler) {
          if (log.code === 'MODULE_LEVEL_DIRECTIVE') return;
          handler(level, log);
        },
      },
    },
  },
  integrations: [
    generate,
    starlight({
      title: 'Tecton Astryx',
      description:
        'Framework-independent Web Components implementing the Astryx design system with the Tecton visual system.',
      favicon: '/favicon.svg',
      customCss: ['@tecton-astryx/tokens/tecton.css', './src/styles/docs.css'],
      components: {
        // Two-state colour scheme control: system or the pinned opposite. [mwg:dark-mode]
        ThemeSelect: './src/components/ThemeSelect.astro',
        // Pagefind search plus an announced result count (A§16.5).
        Search: './src/components/Search.astro',
      },
      lastUpdated: false,
      pagination: true,
      tableOfContents: {minHeadingLevel: 2, maxHeadingLevel: 3},
      head: [
        {tag: 'meta', attrs: {name: 'color-scheme', content: 'light dark'}},
        // Cross-document view transitions wait for the content of the new page. [mwg:consistent-cross-document-transitions]
        {tag: 'link', attrs: {rel: 'expect', href: '#_top', blocking: 'render'}},
        {tag: 'script', attrs: {type: 'speculationrules'}, content: SPECULATION_RULES},
      ],
      sidebar: [
        {label: 'Home', link: '/'},
        {label: 'Guides', items: [{autogenerate: {directory: 'guides'}}]},
        {
          label: 'Components',
          items: [
            {label: 'Overview', link: '/components/'},
            ...CATEGORIES.map(([label, slug]) => ({
              label,
              collapsed: true,
              items: [{autogenerate: {directory: `components/${slug}`}}],
            })),
          ],
        },
        {label: 'Reference', items: [{autogenerate: {directory: 'reference'}}]},
      ],
    }),
  ],
});
