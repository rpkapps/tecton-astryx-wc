/**
 * Every example renders, opens (a click on its first button, or `open` for the inline preview) and passes
 * axe in light and dark. With `TCT_SCREENSHOTS=1` it also writes light and dark screenshots to
 * `reports/screenshots/alert-dialog/` (gitignored).
 *
 * Example scripts `import` from the package, which the docs bundler resolves; here the imports are
 * replaced by the same modules, already loaded.
 */
import {afterEach, describe, expect, it} from 'vitest';
import {page, server, userEvent} from 'vitest/browser';
import {
  aTimeout,
  cleanupFixtures,
  expectAccessible,
  fixture,
  nextFrame,
  waitUntil,
} from '@tecton-wc/testing/index.js';
import './define.js';
import * as api from './alert-dialog.api.js';
import type {TctAlertDialog} from './tct-alert-dialog.js';
import {runModuleScript} from '@tecton-wc/testing/scripts.js';

const examples = import.meta.glob<string>('./examples/*.html', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const shoot = String(import.meta.env.TCT_SCREENSHOTS ?? '') === '1';

afterEach(() => {
  document.querySelectorAll('[data-tct-imperative-alert-dialog]').forEach((host) => {
    host.remove();
  });
});

async function mountExample(source: string, theme: 'light' | 'dark'): Promise<HTMLElement> {
  const body = source.replace(/<script type="module">[\s\S]*?<\/script>/g, '');
  const scripts = [...source.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(
    (match) => match[1]!,
  );
  const root = await fixture<HTMLElement>(
    `<div style="padding: 24px; min-inline-size: 360px; min-block-size: 320px; background: var(--color-background-body); color: var(--color-text-primary)">${body}</div>`,
    {theme},
  );
  (window as unknown as {__tctExample: unknown}).__tctExample = api;
  for (const code of scripts) {
    const rewritten = code.replace(
      /import\s+\{([^}]*)\}\s+from\s+'[^']*';?/g,
      (_, names: string) => `const {${names}} = window.__tctExample;`,
    );
    await runModuleScript(root, rewritten);
  }
  await nextFrame();
  await aTimeout(30);
  return root;
}

describe('examples', () => {
  for (const [path, source] of Object.entries(examples)) {
    const id = /\/([^/]+)\.html$/.exec(path)![1]!;
    for (const theme of ['light', 'dark'] as const) {
      it(`${id} renders open and passes axe (${theme})`, async () => {
        const root = await mountExample(source, theme);
        const trigger = root.querySelector<HTMLElement>('button[id]');
        if (trigger) await userEvent.click(trigger);
        await aTimeout(700);
        const dialog =
          root.querySelector<TctAlertDialog>('tct-alert-dialog') ??
          document.querySelector<TctAlertDialog>('tct-alert-dialog');
        expect(dialog).not.toBeNull();
        await waitUntil(() => dialog!.open, 'the dialog is open');
        await aTimeout(500);
        await expectAccessible(root);
        await expectAccessible(dialog!);
        if (shoot) {
          const dir = `${server.config.root}/reports/screenshots/alert-dialog`;
          await page.screenshot({path: `${dir}/${id}-${theme}.png`, save: true});
        }
        cleanupFixtures();
      });
    }
  }
});
