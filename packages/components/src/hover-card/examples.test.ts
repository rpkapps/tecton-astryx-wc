/**
 * Every example renders, opens and passes axe in light and dark. With `TCT_SCREENSHOTS=1` it also
 * writes light and dark screenshots to `reports/screenshots/hover-card/` (gitignored).
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
import './define.js';
import type {TctHoverCard} from './tct-hover-card.js';

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
    `<div style="padding: 24px 24px 220px; min-inline-size: 420px; background: var(--color-background-body); color: var(--color-text-primary)">${body}</div>`,
    {theme},
  );
  for (const code of scripts) {
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = code;
    root.append(script);
  }
  await nextFrame();
  return root;
}

describe('examples', () => {
  for (const [path, source] of Object.entries(examples)) {
    const id = /\/([^/]+)\.html$/.exec(path)![1]!;
    for (const theme of ['light', 'dark'] as const) {
      it(`${id} renders open and passes axe (${theme})`, async () => {
        const root = await mountExample(source, theme);
        const cards = [...root.querySelectorAll<TctHoverCard>('tct-hover-card')];
        expect(cards.length).toBeGreaterThan(0);
        // Only one card is open at a time; open the first for the check and the screenshot.
        await cards[0]!.show();
        await animationsFinished(cards[0]!.shadowRoot!.querySelector('.layer')!);
        await nextFrame();
        await expectAccessible(root);
        if (shoot) {
          const dir = `${server.config.root}/reports/screenshots/hover-card`;
          await page.screenshot({path: `${dir}/${id}-${theme}.png`, save: true});
        }
        cleanupFixtures();
      });
    }
  }
});
