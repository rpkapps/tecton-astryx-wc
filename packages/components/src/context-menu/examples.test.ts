/**
 * Every example renders, opens and passes axe in light and dark. With `TCT_SCREENSHOTS=1` it also writes
 * light and dark screenshots to `reports/screenshots/context-menu/` (gitignored).
 */
import {describe, expect, it} from 'vitest';
import {page, server} from 'vitest/browser';
import {
  aTimeout,
  animationsFinished,
  cleanupFixtures,
  expectAccessible,
  fixture,
  nextFrame,
} from '@tecton-wc/testing/index.js';
import './define.js';
import '../dropdown-menu/define.js';
import '../card/define.js';
import '../hstack/define.js';
import '../text/define.js';
import '../vstack/define.js';
import type {TctContextMenu} from './tct-context-menu.js';
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
    `<div style="padding: 24px 24px 300px; min-inline-size: 420px; background: var(--color-background-body); color: var(--color-text-primary)">${body}</div>`,
    {theme},
  );
  for (const code of scripts) {
    await runModuleScript(root, code);
  }
  await nextFrame();
  await nextFrame();
  return root;
}

describe('examples', () => {
  for (const [path, source] of Object.entries(examples)) {
    const id = /\/([^/]+)\.html$/.exec(path)![1]!;
    for (const theme of ['light', 'dark'] as const) {
      it(`${id} renders open and passes axe (${theme})`, async () => {
        const root = await mountExample(source, theme);
        const menus = [...root.querySelectorAll<TctContextMenu>('tct-context-menu')];
        expect(menus.length).toBeGreaterThan(0);
        // A disabled menu never opens by user input; `show()` still opens it for the check.
        const first = menus[0]!;
        await first.show();
        const layer = first.shadowRoot!.querySelector('.layer')!;
        await animationsFinished(layer);
        await nextFrame();
        // A pointer left over a submenu row from an earlier test opens its flyout after the hover delay.
        // Contrast is measured on settled colours: let that and every transition (buttons, rows) finish.
        await aTimeout(300);
        await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));
        await expectAccessible(root);
        if (shoot) {
          const dir = `${server.config.root}/reports/screenshots/context-menu`;
          await page.screenshot({path: `${dir}/${id}-${theme}.png`, save: true});
        }
        cleanupFixtures();
      });
    }
  }
});
