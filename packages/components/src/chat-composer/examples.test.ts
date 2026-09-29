/**
 * Every example renders, runs its script and passes axe in light and dark. With `TCT_SCREENSHOTS=1` it
 * also writes light and dark screenshots to `reports/screenshots/chat-composer/` (gitignored).
 *
 * Example scripts `import` from the package and from lit, which the docs bundler resolves; here the named
 * imports are replaced by the same modules, already loaded.
 */
import {LitElement, html} from 'lit';
import {TctChatStopEvent} from '@tecton-wc/core/events/tct-chat-stop.js';
import {describe, expect, it} from 'vitest';
import {page, server} from 'vitest/browser';
import {
  cleanupFixtures,
  expectAccessible,
  fixture,
  nextFrame,
  waitUntil,
} from '@tecton-wc/testing/index.js';
import '../avatar/define.js';
import '../badge/define.js';
import '../button/define.js';
import '../grid/define.js';
import '../hstack/define.js';
import '../icon-button/define.js';
import '../text/define.js';
import '../vstack/define.js';
import './define.js';
import {ChatDictationController} from './chat-dictation.js';
import {ChatPasteAsTokenController} from './chat-paste-as-token.js';
import type {TctChatComposer} from './tct-chat-composer.js';
import type {TctChatComposerInput} from './tct-chat-composer-input.js';
import type {TctChatDictationButton} from './tct-chat-dictation-button.js';

const examples = import.meta.glob<string>('./examples/*.html', {
  eager: true,
  query: '?raw',
  import: 'default',
});
const shoot = String(import.meta.env.TCT_SCREENSHOTS ?? '') === '1';

let scriptCount = 0;

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
  (window as unknown as {__tctExample: unknown}).__tctExample = {
    LitElement,
    html,
    ChatDictationController,
    ChatPasteAsTokenController,
  };
  for (const code of scripts) {
    const rewritten = code
      .replace(
        /import\s+\{([^}]*)\}\s+from\s+'[^']*';?/g,
        (_, names: string) => `const {${names}} = window.__tctExample;`,
      )
      .replace(/import\s+'[^']*';?/g, '');
    // A module script runs after the current task: wait for it (a script that throws never signals).
    const ran = `example-ran-${++scriptCount}`;
    const finished = new Promise((resolve) => window.addEventListener(ran, resolve, {once: true}));
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `${rewritten}\nwindow.dispatchEvent(new Event('${ran}'));`;
    root.append(script);
    await finished;
  }
  await nextFrame();
  return root;
}

/** Waits until nothing is transitioning, so axe reads settled colours. */
async function settle(): Promise<void> {
  await nextFrame();
  await Promise.all(
    document.getAnimations().map((animation) => animation.finished.catch(() => {})),
  );
}

const example = (id: string): string => examples[`./examples/${id}.html`]!;

describe('example scripts', () => {
  it('basic: sending shows what was sent and clears the draft', async () => {
    const root = await mountExample(example('basic'), 'light');
    const composer = root.querySelector<TctChatComposer>('#basic-composer')!;
    composer.value = 'Hello there';
    const input =
      composer.shadowRoot!.querySelector<TctChatComposerInput>('tct-chat-composer-input')!;
    await composer.updateComplete;
    await input.updateComplete;
    input.submit();
    expect(root.querySelector('#basic-output')!.textContent).toBe('Sent: Hello there');
    expect(composer.value).toBe('');
    cleanupFixtures();
  });

  it('mentions: the input has an @ and a / trigger', async () => {
    const root = await mountExample(example('mentions'), 'light');
    const input = root.querySelector<TctChatComposerInput>('#mentions-input')!;
    expect(input.triggers?.map((trigger) => trigger.character)).toEqual(['@', '/']);
    cleanupFixtures();
  });

  it('paste: the button pastes the snippet as one expandable chip', async () => {
    const root = await mountExample(example('paste'), 'light');
    root.querySelector<HTMLElement>('#paste-snippet')!.click();
    const input = root.querySelector<TctChatComposerInput>('#paste-input')!;
    await waitUntil(
      () => input.shadowRoot!.querySelector('[data-tct-token][expandable]') !== null,
      'a chip',
    );
    expect(input.getValue()).toContain('compressor trip');
    cleanupFixtures();
  });

  it('stop: Stop ends the reply and re-enables the composer', async () => {
    const root = await mountExample(example('stop'), 'light');
    const composer = root.querySelector<TctChatComposer>('#stop-composer')!;
    expect(composer.stopShown).toBe(true);
    composer.dispatchEvent(new TctChatStopEvent());
    expect(composer.stopShown).toBe(false);
    expect(composer.disabled).toBe(false);
    cleanupFixtures();
  });

  it('dictation: the demo element renders a composer with a dictation button bound to a controller', async () => {
    const root = await mountExample(example('dictation'), 'light');
    const demo = root.querySelector<LitElement>('dictation-demo')!;
    await demo.updateComplete;
    const button = demo.shadowRoot!.querySelector<TctChatDictationButton>(
      'tct-chat-dictation-button',
    )!;
    expect(button.dictation).toBeInstanceOf(ChatDictationController);
    cleanupFixtures();
  });
});

describe('examples', () => {
  for (const [path, source] of Object.entries(examples)) {
    const id = /\/([^/]+)\.html$/.exec(path)![1]!;
    for (const theme of ['light', 'dark'] as const) {
      it(`${id} renders and passes axe (${theme})`, async () => {
        const root = await mountExample(source, theme);
        expect(root.querySelector('tct-chat-composer, dictation-demo')).not.toBeNull();
        await settle();
        await expectAccessible(root);
        if (shoot) {
          const dir = `${server.config.root}/reports/screenshots/chat-composer`;
          await page.screenshot({path: `${dir}/${id}-${theme}.png`, save: true});
        }
        cleanupFixtures();
      });
    }
  }
});
