/**
 * Every example renders, draws its rows and passes axe in light and dark. With `TCT_SCREENSHOTS=1` it
 * also writes light and dark screenshots to `reports/screenshots/table/` (gitignored).
 *
 * Example scripts `import` from the package and from lit, which the docs bundler resolves; here the
 * imports are replaced by the same modules, already loaded.
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {page, server} from 'vitest/browser';
import {
  aTimeout,
  cleanupFixtures,
  expectAccessible,
  fixture,
  nextFrame,
} from '@tecton-wc/testing/index.js';
import '../badge/define.js';
import '../checkbox-input/define.js';
import '../context-menu/define.js';
import '../hstack/define.js';
import '../text/define.js';
import '../vstack/define.js';
import './define.js';
import * as api from './define.js';
import {useLayeredPreflight} from './table-test-helpers.js';
import type {TctTable} from './tct-table.js';

const examples = import.meta.glob<string>('./examples/*.html', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const shoot = String(import.meta.env.TCT_SCREENSHOTS ?? '') === '1';

/** Examples that show no data rows on purpose. */
const WITHOUT_ROWS = new Set(['empty-state']);

async function mountExample(source: string, theme: 'light' | 'dark'): Promise<HTMLElement> {
  const body = source.replace(/<script type="module">[\s\S]*?<\/script>/g, '');
  const scripts = [...source.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(
    (match) => match[1]!,
  );
  const root = await fixture<HTMLElement>(
    `<div style="padding: 24px; min-inline-size: 420px; background: var(--color-background-body); color: var(--color-text-primary)">${body}</div>`,
    {theme},
  );
  (window as unknown as {__tctExample: unknown}).__tctExample = {...api, html};
  for (const code of scripts) {
    const rewritten = code.replace(
      /import\s+\{([^}]*)\}\s+from\s+'[^']*';?/g,
      (_, names: string) => `const {${names}} = window.__tctExample;`,
    );
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = rewritten;
    root.append(script);
  }
  await nextFrame();
  await Promise.all(
    [...root.querySelectorAll<TctTable>('tct-table')].map((table) => table.updateComplete),
  );
  await aTimeout(30);
  return root;
}

describe('examples', () => {
  it('ships an example for each part of the API', () => {
    const ids = Object.keys(examples).map((path) => /\/([^/]+)\.html$/.exec(path)![1]);
    expect(ids).toEqual(
      expect.arrayContaining([
        'basic',
        'sortable',
        'selection',
        'pagination',
        'column-settings',
        'column-resize',
        'sticky-columns',
        'row-expansion',
        'grouped-rows',
        'tree-data',
        'row-status-and-index',
        'context-menu',
        'large-data',
        'rtl',
      ]),
    );
  });

  for (const [path, source] of Object.entries(examples)) {
    const id = /\/([^/]+)\.html$/.exec(path)![1]!;
    for (const theme of ['light', 'dark'] as const) {
      it(`${id} renders its rows and passes axe (${theme})`, async () => {
        useLayeredPreflight();
        const root = await mountExample(source, theme);
        const tables = [...root.querySelectorAll<TctTable>('tct-table')];
        expect(tables.length).toBeGreaterThan(0);
        if (!WITHOUT_ROWS.has(id)) {
          for (const table of tables) {
            expect(
              table.querySelectorAll('tbody > tr, tct-table-row').length,
              `${id}: rows`,
            ).toBeGreaterThan(0);
          }
        }
        await expectAccessible(root);
        if (shoot) {
          const dir = `${server.config.root}/reports/screenshots/table`;
          await page.screenshot({path: `${dir}/${id}-${theme}.png`, save: true});
        }
        cleanupFixtures();
      });
    }
  }
});
