/**
 * Every example renders, raises its toast (a click on the first button) and passes axe in light and
 * dark. With `TCT_SCREENSHOTS=1` it also writes light and dark screenshots to
 * `reports/screenshots/toast/` (gitignored).
 *
 * Example scripts `import` from the package and from lit, which the docs bundler resolves; here the
 * imports are replaced by the same modules, already loaded.
 */
import {html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {page, server, userEvent} from 'vitest/browser';
import {
  aTimeout,
  cleanupFixtures,
  expectAccessible,
  fixture,
  nextFrame,
} from '@tecton-wc/testing/index.js';
import './define.js';
import * as api from './toast.api.js';
import {resetToastProviders} from './toaster.js';

const examples = import.meta.glob<string>('./examples/*.html', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const shoot = String(import.meta.env.TCT_SCREENSHOTS ?? '') === '1';

afterEach(() => {
  api.resetToastFallback();
  resetToastProviders();
});

async function mountExample(source: string, theme: 'light' | 'dark'): Promise<HTMLElement> {
  const body = source.replace(/<script type="module">[\s\S]*?<\/script>/g, '');
  const scripts = [...source.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map(
    (match) => match[1]!,
  );
  const root = await fixture<HTMLElement>(
    `<div style="padding: 24px 24px 200px; min-inline-size: 420px; min-block-size: 360px; background: var(--color-background-body); color: var(--color-text-primary)">${body}</div>`,
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
  await aTimeout(30);
  return root;
}

describe('examples', () => {
  for (const [path, source] of Object.entries(examples)) {
    const id = /\/([^/]+)\.html$/.exec(path)![1]!;
    for (const theme of ['light', 'dark'] as const) {
      it(`${id} renders with its toast and passes axe (${theme})`, async () => {
        const root = await mountExample(source, theme);
        const trigger = root.querySelector<HTMLElement>('button[id]:not([slot]):not([data-close])');
        if (trigger) await userEvent.click(trigger);
        await aTimeout(450);
        const toasts = document.querySelectorAll('tct-toast, tct-toast-viewport');
        expect(toasts.length).toBeGreaterThan(0);
        await expectAccessible(root);
        if (shoot) {
          const dir = `${server.config.root}/reports/screenshots/toast`;
          await page.screenshot({path: `${dir}/${id}-${theme}.png`, save: true});
        }
        cleanupFixtures();
      });
    }
  }
});
