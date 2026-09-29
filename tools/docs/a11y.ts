/**
 * `pnpm docs:a11y` (A§16.5): crawls the BUILT docs site (`apps/docs/dist`, from `pnpm docs:build`) in
 * Chromium and fails on any accessibility problem:
 *
 *  1. axe-core (WCAG 2.0/2.1/2.2 A and AA plus best practices) on every page, in the light and the
 *     dark colour scheme (the site follows the system scheme by default);
 *  2. structure on every page: `lang`, a title, exactly one `main`, a skip link that is the first
 *     focusable element and targets an existing element, every `nav` named, the sidebar marks the
 *     current page with `aria-current="page"`, and every internal link resolves;
 *  3. example previews use the real components: every `tct-*` element inside an `<Example>` preview is
 *     defined once the page has loaded;
 *  4. keyboard and behaviour smoke on the home page and one component page: the skip link moves focus
 *     to the main content; the sidebar is reachable by keyboard; search opens from the keyboard, finds
 *     a page and announces its result count; the copy button copies the example source and reports the
 *     result in a live region; the colour scheme toggle flips and restores the scheme.
 *
 * `reports/docs-a11y.json` records the run. The static server and Chromium helpers live beside this file.
 */
import {createRequire} from 'node:module';
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {BrowserContext, Page} from 'playwright';
import {walkFiles, writeIfChanged} from '../lib/fs.ts';
import {PATHS} from '../lib/paths.ts';
import {DOCS_APP} from '../lib/site.ts';
import {launchChromium} from './browser.ts';
import {serve} from './static-server.ts';

const dist = join(DOCS_APP, 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('docs:a11y: apps/docs/dist is missing; run `pnpm docs:build` first.');
  process.exit(1);
}

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

interface Finding {
  page: string;
  scheme: string;
  kind: string;
  message: string;
}
const findings: Finding[] = [];
const fail = (page: string, scheme: string, kind: string, message: string) => {
  findings.push({page, scheme, kind, message});
};

/** Every built page as a route (`/`, `/components/x/`, `/404.html`). */
function routes(): string[] {
  const out: string[] = [];
  for (const file of walkFiles(dist, {skipDirs: ['_astro', 'pagefind']})) {
    if (!file.endsWith('.html')) continue;
    const path = file.slice(dist.length).split('\\').join('/');
    out.push(path.endsWith('/index.html') ? path.slice(0, -'index.html'.length) : path);
  }
  return out.sort();
}

interface AxeViolation {
  id: string;
  impact: string | null;
  help: string;
  nodes: {
    target: unknown[];
    html: string;
    failureSummary?: string;
    /** Set when the node sits inside an example that declares `a11y-exempt` (tools/lib/example-header.ts). */
    exempt?: {rules: string[]; reason: string; example: string} | null;
  }[];
}

/** Exemptions actually applied: reported in the output so none is silent. */
interface AppliedExemption {
  page: string;
  scheme: string;
  rule: string;
  example: string;
  reason: string;
  nodes: number;
}
const exemptions: AppliedExemption[] = [];

async function runAxe(page: Page): Promise<AxeViolation[]> {
  await page.addScriptTag({content: axeSource});
  return page.evaluate(async () => {
    const axe = (
      window as unknown as {
        axe: {run: (context: Document, options: unknown) => Promise<{violations: AxeViolation[]}>};
      }
    ).axe;
    const result = await axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
      },
      resultTypes: ['violations'],
    });

    // Resolve an axe target (selectors, shadow-DOM paths as nested arrays) to its element.
    const resolve = (target: unknown[]): Element | null => {
      let root: ParentNode = document;
      let element: Element | null = null;
      const step = (selector: string) => {
        element = root.querySelector(selector);
        root = element?.shadowRoot ?? root;
      };
      for (const item of target) {
        if (Array.isArray(item)) for (const selector of item as string[]) step(selector);
        else step(item as string);
      }
      return element;
    };
    // Nearest example figure that declares an exemption, crossing shadow roots.
    const exemptFigure = (start: Element | null): Element | null => {
      let node: Node | null = start;
      while (node) {
        if (node instanceof Element && node.matches('[data-a11y-exempt]')) return node;
        const root: Node = node.getRootNode();
        node = node.parentNode ?? (root instanceof ShadowRoot ? root.host : null);
      }
      return null;
    };
    for (const violation of result.violations) {
      for (const node of violation.nodes) {
        const figure = exemptFigure(resolve(node.target));
        node.exempt = figure
          ? {
              rules: (figure.getAttribute('data-a11y-exempt') ?? '').split(',').filter(Boolean),
              reason: figure.getAttribute('data-a11y-reason') ?? '',
              example: figure.querySelector('figcaption')?.textContent?.trim() ?? 'example',
            }
          : null;
      }
    }
    return result.violations;
  });
}

/** Facts about the page structure, read in the page. */
interface Structure {
  lang: string;
  title: string;
  mains: number;
  skipLink: {href: string; firstFocusable: boolean; targetExists: boolean} | null;
  unnamedNavs: number;
  hasCurrent: boolean;
  links: string[];
  undefinedPreviewTags: string[];
}

function readStructure(page: Page): Promise<Structure> {
  return page.evaluate(() => {
    const focusable = document.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const skip = document.querySelector<HTMLAnchorElement>('a.sl-skip-link, a[href^="#"][class*="skip"]');
    const skipTarget = skip ? document.getElementById(skip.getAttribute('href')!.slice(1)) : null;
    const navs = [...document.querySelectorAll('nav')];
    const previewTags = [...document.querySelectorAll('.tct-example__preview *')]
      .filter((element) => element.localName.startsWith('tct-'))
      .filter((element) => !element.matches(':defined'))
      .map((element) => element.localName);
    return {
      lang: document.documentElement.lang,
      title: document.title,
      mains: document.querySelectorAll('main').length,
      skipLink: skip
        ? {href: skip.getAttribute('href') ?? '', firstFocusable: focusable === skip, targetExists: skipTarget !== null}
        : null,
      unnamedNavs: navs.filter((nav) => !nav.getAttribute('aria-label') && !nav.getAttribute('aria-labelledby')).length,
      hasCurrent: document.querySelector('nav a[aria-current="page"]') !== null,
      links: [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].map((a) => a.getAttribute('href')!),
      undefinedPreviewTags: [...new Set(previewTags)],
    };
  });
}

function checkLink(from: string, href: string, known: Set<string>): string | undefined {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href) || href.startsWith('#') || href === '') return undefined;
  const url = new URL(href, `http://site${from}`);
  const path = url.pathname;
  const candidates = [path, `${path.replace(/\/$/, '')}/`, `${path.replace(/\/$/, '')}.html`];
  if (candidates.some((candidate) => known.has(candidate))) return undefined;
  if (existsSync(join(dist, path)) && !path.endsWith('/')) return undefined; // an asset (llms.txt, favicon, ...)
  return `broken link to ${href}`;
}

async function crawl(context: BrowserContext, base: string, scheme: string, known: Set<string>): Promise<number> {
  const page = await context.newPage();
  let axeViolations = 0;
  for (const route of routes()) {
    const label = `${route} (${scheme})`;
    const response = await page.goto(`${base}${route}`, {waitUntil: 'load'});
    if (!response) {
      fail(route, scheme, 'load', 'no response');
      continue;
    }
    // Let fonts load and lazily registered components upgrade before looking at the page.
    await page.evaluate(() => document.fonts.ready);
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('.tct-example__preview *')]
            .filter((element) => element.localName.startsWith('tct-'))
            .every((element) => element.matches(':defined')),
        undefined,
        {timeout: 5000},
      )
      .catch(() => undefined); // reported below as an undefined preview element
    // Page scripts finish after load: the example previews become focusable regions from a
    // ResizeObserver once upgraded content makes them overflow. A fixed delay raced that on a loaded
    // machine (scrollable-region-focusable flaked), so wait for the state itself: two frames for
    // observers to run, then every preview's region state matches whether it overflows.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll<HTMLElement>('.tct-example__preview')].every(
            (preview) =>
              preview.scrollWidth > preview.clientWidth ===
              (preview.getAttribute('role') === 'region' && preview.tabIndex === 0),
          ),
        undefined,
        {timeout: 5000},
      )
      .catch(() => undefined); // an unreachable overflowing preview is then reported by axe

    for (const violation of await runAxe(page)) {
      // Nodes inside an example that declares an exemption for this rule (with a reason) are skipped
      // and reported; everything else counts.
      const kept = [];
      const skipped = new Map<string, {reason: string; count: number}>();
      for (const node of violation.nodes) {
        const exempt = node.exempt;
        if (exempt && exempt.reason.length >= 20 && exempt.rules.includes(violation.id)) {
          const entry = skipped.get(exempt.example) ?? {reason: exempt.reason, count: 0};
          entry.count++;
          skipped.set(exempt.example, entry);
        } else kept.push(node);
      }
      for (const [example, {reason, count}] of skipped) {
        exemptions.push({page: route, scheme, rule: violation.id, example, reason, nodes: count});
      }
      if (kept.length === 0) continue;
      axeViolations++;
      const nodes = kept
        .slice(0, 4)
        .map((node) => `      ${JSON.stringify(node.target)}  ${node.html.slice(0, 140).replace(/\s+/g, ' ')}`)
        .join('\n');
      fail(route, scheme, `axe:${violation.id}`, `${violation.impact ?? 'n/a'}: ${violation.help}\n${nodes}`);
    }

    // The 404 page is a different template: only axe applies.
    if (route === '/404.html') continue;
    const structure = await readStructure(page);
    if (!structure.lang) fail(route, scheme, 'structure', '<html> has no lang');
    if (!structure.title.trim()) fail(route, scheme, 'structure', 'the page has no <title>');
    if (structure.mains !== 1) fail(route, scheme, 'structure', `expected one <main>, found ${structure.mains}`);
    if (!structure.skipLink) fail(route, scheme, 'skip-link', 'no skip link');
    else {
      if (!structure.skipLink.firstFocusable) fail(route, scheme, 'skip-link', 'the skip link is not the first focusable element');
      if (!structure.skipLink.targetExists) fail(route, scheme, 'skip-link', `target ${structure.skipLink.href} does not exist`);
    }
    if (structure.unnamedNavs > 0) fail(route, scheme, 'landmarks', `${structure.unnamedNavs} <nav> without an accessible name`);
    if (route !== '/' && !structure.hasCurrent) fail(route, scheme, 'current-page', 'no navigation link has aria-current="page"');
    for (const tag of structure.undefinedPreviewTags) fail(route, scheme, 'preview', `<${tag}> in an example preview is not defined`);
    if (scheme === 'light') {
      for (const href of new Set(structure.links)) {
        const problem = checkLink(route, href, known);
        if (problem) fail(route, scheme, 'links', problem);
      }
    }
    void label;
  }
  await page.close();
  return axeViolations;
}

/** Keyboard and behaviour smoke (A§16.5). */
async function smoke(context: BrowserContext, base: string, componentRoute: string | undefined): Promise<void> {
  const page = await context.newPage();
  const scheme = 'smoke';
  const check = (route: string, ok: boolean, message: string) => {
    if (!ok) fail(route, scheme, 'keyboard', message);
  };

  // Skip link: first Tab lands on it, it becomes visible, Enter moves to the content.
  await page.goto(`${base}/`, {waitUntil: 'load'});
  await page.keyboard.press('Tab');
  const skip = await page.evaluate(() => {
    const active = document.activeElement as HTMLAnchorElement | null;
    const box = active?.getBoundingClientRect();
    return {
      isSkip: active?.matches('a.sl-skip-link') ?? false,
      visible: box ? box.width > 1 && box.height > 1 && box.top >= 0 : false,
    };
  });
  check('/', skip.isSkip, 'the first Tab stop is not the skip link');
  check('/', skip.visible, 'the skip link is not visible when focused');
  await page.keyboard.press('Enter');
  const afterSkip = await page.evaluate(() => location.hash);
  check('/', afterSkip === '#_top', `activating the skip link left the hash at "${afterSkip}"`);

  // Sidebar reachable by keyboard: Tab until a sidebar link has focus (bounded).
  await page.goto(`${base}${componentRoute ?? '/components/'}`, {waitUntil: 'load'});
  let reachedSidebar = false;
  for (let i = 0; i < 30 && !reachedSidebar; i++) {
    await page.keyboard.press('Tab');
    reachedSidebar = await page.evaluate(() => {
      const active = document.activeElement;
      return active instanceof HTMLAnchorElement && active.closest('nav[aria-label]') !== null && active.closest('.sidebar-content, starlight-sidebar-persist, #starlight__sidebar') !== null;
    });
  }
  check(componentRoute ?? '/components/', reachedSidebar, 'no sidebar link is reachable with Tab within 30 presses');

  // Search: open with the keyboard shortcut, type, get results and a count announcement.
  await page.goto(`${base}/`, {waitUntil: 'load'});
  await page.keyboard.press('Control+k');
  const dialog = page.locator('dialog[open]');
  await dialog.waitFor({state: 'visible', timeout: 5000}).catch(() => undefined);
  const searchOpen = await dialog.count();
  check('/', searchOpen > 0, 'Ctrl+K did not open the search dialog');
  if (searchOpen > 0) {
    // The search UI loads lazily: wait for its input, then type.
    const input = page.locator('dialog[open] input').first();
    await input.waitFor({state: 'visible', timeout: 8000}).catch(() => undefined);
    await input.fill('components');
    const results = page.locator('dialog[open] .pagefind-ui__result-link');
    await results.first().waitFor({state: 'visible', timeout: 8000}).catch(() => undefined);
    check('/', (await results.count()) > 0, 'search returned no results for "components"');
    // The count must be in a live region (role=status) inside the modal dialog.
    await page
      .waitForFunction(
        () => /\d+\s+results?/i.test(document.querySelector('dialog[open] [role="status"]')?.textContent ?? ''),
        undefined,
        {timeout: 4000},
      )
      .catch(() => undefined);
    const announced = await page.evaluate(
      () => document.querySelector('dialog[open] [role="status"]')?.textContent ?? '',
    );
    check('/', /\d+\s+results?/i.test(announced), `the search result count is not announced (live region says "${announced}")`);
    await page.keyboard.press('Escape');
    check('/', (await page.locator('dialog[open]').count()) === 0, 'Escape did not close the search dialog');
  }

  // Colour scheme toggle: flips the scheme and restores it; the choice is stored.
  await page.goto(`${base}/`, {waitUntil: 'load'});
  const toggle = page.locator('button.tct-theme-toggle');
  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await toggle.click();
  const flipped = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    stored: localStorage.getItem('starlight-theme'),
    status: document.querySelector('[data-status]')?.textContent ?? '',
  }));
  check('/', flipped.theme !== before && flipped.stored === flipped.theme, `theme toggle: ${before} -> ${flipped.theme}, stored ${flipped.stored}`);
  check('/', flipped.status.length > 0, 'theme toggle did not announce the change');
  await toggle.click();
  const restored = await page.evaluate(() => ({theme: document.documentElement.dataset.theme, stored: localStorage.getItem('starlight-theme')}));
  check('/', restored.theme === before && restored.stored === null, `theme toggle did not return to the system scheme (${restored.theme}, ${restored.stored})`);

  // Copy button: copies the source, reports in the live region, returns to "Copy".
  if (componentRoute) {
    await page.goto(`${base}${componentRoute}`, {waitUntil: 'load'});
    const button = page.locator('[data-tct-copy]').first();
    if ((await button.count()) > 0) {
      const source = await page.locator('[data-tct-code]').first().textContent();
      await button.click();
      await page.waitForFunction(() => document.getElementById('tct-copy-status')?.textContent, undefined, {timeout: 3000}).catch(() => undefined);
      const status = await page.evaluate(() => document.getElementById('tct-copy-status')?.textContent ?? '');
      const label = await button.locator('[data-copy-label]').textContent();
      const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
      check(componentRoute, /copied/i.test(status), `copy status region says "${status}"`);
      check(componentRoute, /copied/i.test(label ?? ''), `copy button label is "${label}"`);
      check(componentRoute, (source ?? '').trim() === copied.trim(), 'the clipboard does not hold the displayed example source');
    } else {
      fail(componentRoute, scheme, 'copy', 'no copy button on the component page');
    }
  }
  await page.close();
}

const server = await serve(dist);
const browser = await launchChromium();
let axeViolations = 0;
const all = routes();
const known = new Set(all);
const componentRoute = all.find((route) => /^\/components\/[^/]+\/[^/]+\/$/.test(route) && !route.endsWith('/index.html'));
// Category overview pages are also two segments deep; prefer a page that has an example.
const withExample = all.find((route) => existsSync(join(dist, route, 'index.html')) && readFileSync(join(dist, route, 'index.html'), 'utf8').includes('data-tct-example'));

try {
  for (const scheme of ['light', 'dark'] as const) {
    const context = await browser.newContext({colorScheme: scheme, viewport: {width: 1280, height: 900}, reducedMotion: 'reduce'});
    axeViolations += await crawl(context, server.url, scheme, known);
    await context.close();
  }
  const context = await browser.newContext({
    colorScheme: 'light',
    viewport: {width: 1280, height: 900},
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  await smoke(context, server.url, withExample ?? componentRoute);
  await context.close();
} finally {
  await browser.close();
  await server.close();
}

mkdirSync(PATHS.reports, {recursive: true});
writeIfChanged(join(PATHS.reports, 'docs-a11y.json'), `${JSON.stringify({pages: all.length, findings, exemptions}, null, 2)}\n`);

if (exemptions.length > 0) {
  console.log('docs:a11y exemptions applied (declared in the example header as a11y-exempt, each with a reason):');
  const seen = new Set<string>();
  for (const e of exemptions) {
    const key = `${e.page}|${e.rule}|${e.example}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`  ${e.rule} in ${e.page} ("${e.example}"): ${e.reason}`);
  }
}
if (findings.length > 0) {
  for (const finding of findings) {
    console.error(`FAIL [${finding.kind}] ${finding.page} (${finding.scheme}): ${finding.message}`);
  }
  console.error(`\ndocs:a11y FAILED: ${findings.length} finding(s) over ${all.length} page(s) (${axeViolations} axe violation(s)).`);
  process.exit(1);
}
console.log(`docs:a11y OK: ${all.length} page(s) in light and dark, keyboard smoke passed.`);
