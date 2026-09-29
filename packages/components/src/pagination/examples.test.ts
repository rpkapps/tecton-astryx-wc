/**
 * Every example renders and passes axe in light and dark, and the interactive ones respond to a click.
 * With `TCT_SCREENSHOTS=1` it also writes light and dark screenshots to `reports/screenshots/pagination/`
 * (gitignored).
 */
import {describe, expect, it} from 'vitest';
import {page, server, userEvent} from 'vitest/browser';
import {cleanupFixtures, expectAccessible, fixture, nextFrame} from '@tecton-wc/testing/index.js';
import '../hstack/define.js';
import '../text/define.js';
import '../vstack/define.js';
import './define.js';
import type {TctPagination} from './tct-pagination.js';
import {runModuleScript} from '@tecton-wc/testing/scripts.js';

const examples = import.meta.glob<string>('./examples/*.html', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const shoot = String(import.meta.env.TCT_SCREENSHOTS ?? '') === '1';

/** Renders an example; its inline module script runs as it does on the docs page. */
async function mountExample(source: string, theme: 'light' | 'dark'): Promise<HTMLElement> {
  const body = source.replace(/<script type="module">[\s\S]*?<\/script>/g, '');
  const scripts = [...source.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(
    (match) => match[1]!,
  );
  const root = await fixture<HTMLElement>(
    `<div style="padding: 24px 24px 120px; min-inline-size: 520px; background: var(--color-background-body); color: var(--color-text-primary)">${body}</div>`,
    {theme},
  );
  for (const code of scripts) {
    await runModuleScript(root, code);
  }
  await nextFrame();
  await nextFrame();
  return root;
}

describe('pagination examples', () => {
  it('has examples', () => {
    expect(Object.keys(examples).length).toBeGreaterThan(0);
  });

  for (const [path, source] of Object.entries(examples)) {
    const id = /\/([^/]+)\.html$/.exec(path)![1]!;
    for (const theme of ['light', 'dark'] as const) {
      it(`${id} renders and passes axe (${theme})`, async () => {
        const root = await mountExample(source, theme);
        const paginations = [...root.querySelectorAll<TctPagination>('tct-pagination')];
        expect(paginations.length).toBeGreaterThan(0);
        await Promise.all(paginations.map((element) => element.updateComplete));
        await expectAccessible(root);
        if (shoot) {
          const dir = `${server.config.root}/reports/screenshots/pagination`;
          await page.screenshot({path: `${dir}/${id}-${theme}.png`, save: true});
        }
        cleanupFixtures();
      });
    }
  }

  it('basic: choosing a page updates the page the example reports', async () => {
    const root = await mountExample(examples['./examples/basic.html']!, 'light');
    const element = root.querySelector<TctPagination>('tct-pagination')!;
    await element.updateComplete;
    await userEvent.click(element.shadowRoot!.querySelector('tct-button.next')!);
    expect(element.page).toBe(4);
    expect(root.querySelector('[data-page]')!.textContent).toBe('4');
    cleanupFixtures();
  });

  it('cursor: next runs out when the example says there is no more', async () => {
    const root = await mountExample(examples['./examples/cursor.html']!, 'light');
    const element = root.querySelector<TctPagination>('tct-pagination')!;
    await element.updateComplete;
    for (let index = 0; index < 3; index++) {
      await userEvent.click(element.shadowRoot!.querySelector('tct-button.next')!);
      await element.updateComplete;
    }
    expect(element.page).toBe(4);
    expect(element.hasMore).toBe(false);
    cleanupFixtures();
  });
});
