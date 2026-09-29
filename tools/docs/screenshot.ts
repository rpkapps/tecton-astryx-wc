/**
 * Screenshots of the built docs site into `reports/` (gitignored), for reviews and hand-offs.
 *
 *   node tools/docs/screenshot.ts [--full] [--at=<selector>] / /components/feedback-and-status/sample-badge/
 *
 * One PNG per route and colour scheme: `reports/docs-<route>-<light|dark>.png`. Needs `pnpm docs:build`.
 */
import {existsSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {PATHS} from '../lib/paths.ts';
import {DOCS_SITE} from '../lib/site.ts';
import {launchChromium} from './browser.ts';
import {serve} from './static-server.ts';

const dist = DOCS_SITE;
if (!existsSync(join(dist, 'index.html'))) {
  console.error('screenshot: apps/docs/dist/client is missing; run `pnpm docs:build` first.');
  process.exit(1);
}
const args = process.argv.slice(2);
const full = args.includes('--full');
const at = args.find((arg) => arg.startsWith('--at='))?.slice('--at='.length);
const routeArgs = args.filter((arg) => !arg.startsWith('--'));
const routes = routeArgs.length > 0 ? routeArgs : ['/'];
mkdirSync(PATHS.reports, {recursive: true});

const server = await serve(dist);
const browser = await launchChromium();
try {
  for (const scheme of ['light', 'dark'] as const) {
    const context = await browser.newContext({
      colorScheme: scheme,
      viewport: {width: 1280, height: 900},
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    for (const route of routes) {
      await page.goto(`${server.url}${route}`, {waitUntil: 'networkidle'});
      await page.evaluate(() => document.fonts.ready);
      if (at) await page.locator(at).first().scrollIntoViewIfNeeded();
      const name = route.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'home';
      const file = join(PATHS.reports, `docs-${name}-${scheme}.png`);
      await page.screenshot({path: file, fullPage: full});
      console.log(`screenshot: ${file}`);
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
