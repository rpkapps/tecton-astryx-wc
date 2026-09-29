/**
 * Every example renders, opens (a click on its first button) and passes axe in light and dark. With
 * `TCT_SCREENSHOTS=1` it also writes light and dark screenshots to `reports/screenshots/bottom-sheet/`
 * (gitignored).
 */
import {describe, expect, it} from 'vitest';
import {page, server, userEvent} from 'vitest/browser';
import {
  aTimeout,
  cleanupFixtures,
  expectAccessible,
  fixture,
  nextFrame,
  waitUntil,
} from '@tecton-wc/testing/index.js';
import '../button/define.js';
import '../heading/define.js';
import './define.js';
import type {TctBottomSheetSwitcher} from './tct-bottom-sheet-switcher.js';
import type {TctBottomSheet} from './tct-bottom-sheet.js';
import {runModuleScript} from '@tecton-wc/testing/scripts.js';

const examples = import.meta.glob<string>('./examples/*.html', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const shoot = String(import.meta.env.TCT_SCREENSHOTS ?? '') === '1';

async function mountExample(source: string, theme: 'light' | 'dark'): Promise<HTMLElement> {
  const body = source.replace(/<script type="module">[\s\S]*?<\/script>/g, '');
  const scripts = [...source.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(
    (match) => match[1]!,
  );
  const root = await fixture<HTMLElement>(
    `<div style="padding: 24px; min-inline-size: 320px; min-block-size: 480px; background: var(--color-background-body); color: var(--color-text-primary)">${body}</div>`,
    {theme},
  );
  for (const code of scripts) {
    await runModuleScript(root, code);
  }
  await nextFrame();
  await aTimeout(30);
  return root;
}

const isShowing = (root: HTMLElement): boolean => {
  const switcher = root.querySelector<TctBottomSheetSwitcher>('tct-bottom-sheet-switcher');
  if (switcher) return switcher.activeSheet !== null;
  return [...root.querySelectorAll<TctBottomSheet>('tct-bottom-sheet')].some((sheet) => sheet.open);
};

describe('examples', () => {
  for (const [path, source] of Object.entries(examples)) {
    const id = /\/([^/]+)\.html$/.exec(path)![1]!;
    for (const theme of ['light', 'dark'] as const) {
      it(`${id} renders open and passes axe (${theme})`, async () => {
        const root = await mountExample(source, theme);
        const trigger = root.querySelector<HTMLElement>('tct-button[id]')!;
        await userEvent.click(trigger);
        await waitUntil(() => isShowing(root), 'the sheet is open');
        await aTimeout(700);
        await expectAccessible(root);
        const dialogs = [
          ...root.querySelectorAll<HTMLElement>('tct-bottom-sheet, tct-bottom-sheet-switcher'),
        ];
        for (const host of dialogs) {
          const dialog = host.shadowRoot!.querySelector('dialog');
          if (dialog?.open) await expectAccessible(dialog);
        }
        expect(dialogs.length).toBeGreaterThan(0);
        if (shoot) {
          const dir = `${server.config.root}/reports/screenshots/bottom-sheet`;
          await page.screenshot({path: `${dir}/${id}-${theme}.png`, save: true});
        }
        cleanupFixtures();
      });
    }
  }
});
