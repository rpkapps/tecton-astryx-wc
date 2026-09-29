/**
 * Every example renders and passes axe in light and dark (the docs page renders the same files). With
 * `TCT_SCREENSHOTS=1` it also writes light and dark screenshots to `reports/screenshots/stepper/`
 * (gitignored).
 */
import {describe, expect, it} from 'vitest';
import {page, server, userEvent} from 'vitest/browser';
import {cleanupFixtures, expectAccessible, fixture, nextFrame} from '@tecton-wc/testing/index.js';
import './define.js';
import '../vstack/define.js';
import '../card/define.js';
import '../text/define.js';
import '../icon/define.js';

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
    `<div style="padding: 24px; min-inline-size: 420px; background: var(--color-background-body); color: var(--color-text-primary)">${body}</div>`,
    {theme},
  );
  for (const code of scripts) {
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = code;
    root.append(script);
  }
  await nextFrame();
  await nextFrame();
  return root;
}

describe('examples', () => {
  it('has examples', () => {
    expect(Object.keys(examples).length).toBeGreaterThan(0);
  });

  for (const [path, source] of Object.entries(examples)) {
    const id = /\/([^/]+)\.html$/.exec(path)![1]!;
    for (const theme of ['light', 'dark'] as const) {
      it(`${id} renders and passes axe (${theme})`, async () => {
        const root = await mountExample(source, theme);
        // Park the pointer away and let every transition finish: contrast is measured on settled colours.
        await userEvent.hover(document.body, {position: {x: 0, y: 0}}).catch(() => undefined);
        await nextFrame();
        await Promise.allSettled(document.getAnimations().map((animation) => animation.finished));
        await expectAccessible(root);
        if (shoot) {
          const dir = `${server.config.root}/reports/screenshots/stepper`;
          await page.screenshot({path: `${dir}/${id}-${theme}.png`, save: true});
        }
        cleanupFixtures();
      });
    }
  }
});
