/**
 * CDN bundle smoke test (A§2.5): serves `packages/components/dist` as a static origin, loads
 * `tecton.css` and `cdn/autoloader.js` exactly as the docs describe, adds one element of every
 * public tag and waits until the autoloader has defined it. Fails on any console or page error and when
 * the tokens are missing. With zero components it still checks that the bundle and the stylesheet load.
 * `pnpm build:smoke`, after `pnpm build` (`pnpm check` runs it straight after the build). Uses the browser
 * from `CHROMIUM_PATH` when set (an installed Chrome or Edge), so no Playwright download is needed.
 */
import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cemElements, loadCem} from '../lib/cem.ts';
import {PATHS} from '../lib/paths.ts';
import {launchChromium} from '../docs/browser.ts';
import {serve} from '../docs/static-server.ts';

export async function main(): Promise<number> {
  const dist = join(PATHS.components, 'dist');
  if (!existsSync(join(dist, 'cdn/autoloader.js')) || !existsSync(join(dist, 'tecton.css'))) {
    console.error(
      'cdn-smoke: dist/cdn/autoloader.js or dist/tecton.css is missing; run `pnpm build`.',
    );
    return 1;
  }
  const cem = loadCem(join(PATHS.components, 'custom-elements.json'));
  const tags = cem ? cemElements(cem).map((element) => element.tagName) : [];

  const server = await serve(dist);
  const browser = await launchChromium();
  const problems: string[] = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
    });
    page.on('requestfailed', (request) => problems.push(`request failed: ${request.url()}`));
    await page.route('**/__cdn-smoke.html', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body:
          '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>cdn smoke</title>' +
          '<link rel="stylesheet" href="/tecton.css"></head><body>' +
          `<script type="module" src="/cdn/autoloader.js"></script>${tags.map((tag) => `<${tag}></${tag}>`).join('')}` +
          '</body></html>',
      }),
    );
    await page.goto(`${server.url}/__cdn-smoke.html`, {waitUntil: 'load'});

    for (const tag of tags) {
      const defined = await page
        .evaluate(
          (name) =>
            Promise.race([
              customElements.whenDefined(name).then(() => true),
              new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
            ]),
          tag,
        )
        .catch(() => false);
      if (!defined) problems.push(`<${tag}> was not defined by the CDN autoloader`);
    }
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim(),
    );
    if (accent === '') problems.push('tecton.css did not define --color-accent');
  } finally {
    await browser.close();
    await server.close();
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(`cdn-smoke: ${problem}`);
    console.error(`\ncdn-smoke FAILED: ${problems.length} problem(s).`);
    return 1;
  }
  console.log(
    `cdn-smoke OK: autoloader + tecton.css from dist; ${tags.length} tag(s) defined on sight.`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main());
}
