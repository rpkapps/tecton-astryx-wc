/**
 * Every example renders, opens and passes axe in light and dark. With `TCT_SCREENSHOTS=1` it also
 * writes light and dark screenshots to `reports/screenshots/multi-selector/` (gitignored).
 */
import {describe, expect, it} from 'vitest';
import {page, server} from 'vitest/browser';
import {
  animationsFinished,
  cleanupFixtures,
  expectAccessible,
  fixture,
  nextFrame,
} from '@tecton-wc/testing/index.js';
import '../button/define.js';
import '../form-layout/define.js';
import '../hstack/define.js';
import '../vstack/define.js';
import './define.js';
import type {TctMultiSelector} from './tct-multi-selector.js';
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
    `<div style="padding: 24px 24px 320px; min-inline-size: 420px; background: var(--color-background-body); color: var(--color-text-primary)">${body}</div>`,
    {theme},
  );
  for (const code of scripts) {
    await runModuleScript(root, code);
  }
  await nextFrame();
  await nextFrame();
  return root;
}

describe('multi-selector examples', () => {
  it('has examples', () => {
    expect(Object.keys(examples).length).toBeGreaterThan(0);
  });

  for (const [path, source] of Object.entries(examples)) {
    const id = /\/([^/]+)\.html$/.exec(path)![1]!;
    for (const theme of ['light', 'dark'] as const) {
      it(`${id} renders, opens and passes axe (${theme})`, async () => {
        const root = await mountExample(source, theme);
        const selectors = [...root.querySelectorAll<TctMultiSelector>('tct-multi-selector')];
        expect(selectors.length).toBeGreaterThan(0);
        await Promise.all(selectors.map((selector) => selector.updateComplete));
        await animationsFinished(root);
        await expectAccessible(root);

        // Open the first selector that can open, and check the popup too.
        const first = selectors.find(
          (selector) => !selector.disabled && !selector.readonly && !selector.loading,
        );
        if (first) {
          await first.show();
          await animationsFinished(first.shadowRoot!.querySelector('.layer')!);
          await nextFrame();
          await animationsFinished(root);
          await expectAccessible(root);
          if (shoot) {
            const dir = `${server.config.root}/reports/screenshots/multi-selector`;
            await page.screenshot({path: `${dir}/${id}-${theme}.png`, save: true});
          }
          await first.hide();
        }
        cleanupFixtures();
      });
    }
  }
});
