/**
 * Vitest root config (A§15.1): one node project plus one browser project per engine.
 *
 * - `node`: `*.node.test.ts` and `tools/**\/*.test.ts` (generators, checks, plugins, SSR-import).
 * - `browser-<engine>`: `packages/*\/src/**\/*.test.ts` (minus `*.node.test.ts`) in real browsers
 *   through the Playwright provider. Engines come from `TCT_BROWSERS` (default `chromium`;
 *   CI runs `chromium,firefox,webkit`).
 *
 * Chromium: `$CHROMIUM_PATH`, else `/opt/pw-browsers/chromium` when it exists (the local build is
 * Chromium 141 and does not match the revision Playwright expects), else Playwright's own build.
 * Never run `playwright install` locally.
 *
 * `TCT_TIER2=1` is exposed to test code as `import.meta.env.TCT_TIER2` (`envPrefix` below); the
 * M4 setup file uses it to force `implicitAnchor`, `elementReflection` and `customStates` off.
 */
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {playwright} from '@vitest/browser-playwright';
import {defaultClientConditions, defaultServerConditions} from 'vite';
import {defineConfig} from 'vitest/config';
import {tctCss} from './tools/vite-plugin-tct-css.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SOURCE_CONDITION = 'tct-source';
const LOCAL_CHROMIUM = '/opt/pw-browsers/chromium';

type Engine = 'chromium' | 'firefox' | 'webkit';
const ENGINES: readonly Engine[] = ['chromium', 'firefox', 'webkit'];

export function requestedEngines(env: NodeJS.ProcessEnv = process.env): Engine[] {
  const raw = (env.TCT_BROWSERS ?? 'chromium')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const unknown = raw.filter((name) => !ENGINES.includes(name as Engine));
  if (unknown.length > 0) {
    throw new Error(
      `TCT_BROWSERS: unknown engine(s) ${unknown.join(', ')}; use ${ENGINES.join(', ')}`,
    );
  }
  return [...new Set(raw)] as Engine[];
}

export function chromiumExecutablePath(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.CHROMIUM_PATH) return env.CHROMIUM_PATH;
  return existsSync(LOCAL_CHROMIUM) ? LOCAL_CHROMIUM : undefined;
}

// Packages the browser project imports; pre-bundling them up front avoids a mid-run dependency
// optimisation, which reloads the page and fails the running test file.
const OPTIMIZE_DEPS = [
  'lit',
  'lit/decorators.js',
  'lit/directive.js',
  'lit/directives/class-map.js',
  'lit/directives/if-defined.js',
  'lit/directives/live.js',
  'lit/directives/ref.js',
  'lit/directives/repeat.js',
  'lit/directives/style-map.js',
  'lit/static-html.js',
  '@floating-ui/dom',
  '@internationalized/date',
  'intl-messageformat',
  'dompurify',
];

const SETUP_FILE = 'packages/testing/src/setup.ts';
const setupFiles = existsSync(new URL(SETUP_FILE, `file://${ROOT}`)) ? [SETUP_FILE] : [];

export default defineConfig({
  plugins: [tctCss()],
  // Lets `import.meta.env.TCT_TIER2` (and friends) reach browser tests.
  envPrefix: ['VITE_', 'TCT_'],
  resolve: {
    conditions: [SOURCE_CONDITION, ...defaultClientConditions],
  },
  ssr: {
    resolve: {conditions: [SOURCE_CONDITION, ...defaultServerConditions]},
  },
  optimizeDeps: {include: OPTIMIZE_DEPS},
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['packages/*/src/**/*.node.test.ts', 'tools/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', 'tools/**/fixtures/**'],
        },
      },
      ...requestedEngines().map((engine) => ({
        extends: true,
        test: {
          name: `browser-${engine}`,
          include: ['packages/*/src/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', 'packages/*/src/**/*.node.test.ts'],
          setupFiles,
          browser: {
            enabled: true,
            headless: true,
            // Failure screenshots would land in the worktree; CI uploads no browser artifacts.
            screenshotFailures: false,
            provider: playwright(
              engine === 'chromium' && chromiumExecutablePath()
                ? {launchOptions: {executablePath: chromiumExecutablePath()}}
                : {},
            ),
            instances: [{browser: engine}],
          },
        },
      })),
    ],
  },
});
