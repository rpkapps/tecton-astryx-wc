/**
 * Every example renders, runs its script and passes axe in light and dark. With `TCT_SCREENSHOTS=1` it
 * also writes light and dark screenshots to `reports/screenshots/chat-layout/` (gitignored).
 */
import {describe, expect, it} from 'vitest';
import {page, server, userEvent} from 'vitest/browser';
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
import '../chat-composer/define.js';
import '../chat-message/define.js';
import '../chat-message-list/define.js';
import '../empty-state/define.js';
import '../grid/define.js';
import '../icon-button/define.js';
import '../text/define.js';
import '../vstack/define.js';
import './define.js';
import type {TctChatComposer} from '../chat-composer/tct-chat-composer.js';
import type {TctChatMessageList} from '../chat-message-list/tct-chat-message-list.js';
import type {TctChatLayout} from './tct-chat-layout.js';

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
  for (const code of scripts) {
    // A module script runs after the current task: wait for it (a script that throws never signals).
    const ran = `example-ran-${++scriptCount}`;
    const finished = new Promise((resolve) => window.addEventListener(ran, resolve, {once: true}));
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `${code}\nwindow.dispatchEvent(new Event('${ran}'));`;
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

describe('example scripts', () => {
  it('follow: sending adds the message and starts a reply that Stop ends', async () => {
    const root = await mountExample(examples['./examples/follow.html']!, 'light');
    const composer = root.querySelector<TctChatComposer>('#follow-composer')!;
    const list = root.querySelector<TctChatMessageList>('#follow-list')!;
    const layout = root.querySelector<TctChatLayout>('#follow-layout')!;
    expect(list.querySelectorAll('tct-chat-message')).toHaveLength(6);
    await composer.updateComplete;
    const editable = composer
      .shadowRoot!.querySelector('tct-chat-composer-input')!
      .shadowRoot!.querySelector<HTMLElement>('.editable')!;
    editable.focus();
    await userEvent.keyboard('How is C-19?{Enter}');
    await waitUntil(
      () => list.querySelectorAll('tct-chat-message').length === 8,
      'the message and the reply',
    );
    expect(composer.stopShown).toBe(true);
    expect(layout.isFollowing).toBe(true);
    // Stop ends the reply: the composer offers Send again.
    const send = composer.shadowRoot!.querySelector('tct-chat-send-button')!;
    await userEvent.click(
      send.shadowRoot!.querySelector('tct-button')!.shadowRoot!.querySelector('button')!,
    );
    await waitUntil(() => !composer.stopShown, 'the reply is stopped');
    expect(list.streaming).toBe(false);
    cleanupFixtures();
  });
});

describe('examples', () => {
  for (const [path, source] of Object.entries(examples)) {
    const id = /\/([^/]+)\.html$/.exec(path)![1]!;
    for (const theme of ['light', 'dark'] as const) {
      it(`${id} renders and passes axe (${theme})`, async () => {
        const root = await mountExample(source, theme);
        expect(root.querySelector('tct-chat-layout')).not.toBeNull();
        await settle();
        await expectAccessible(root);
        if (shoot) {
          const dir = `${server.config.root}/reports/screenshots/chat-layout`;
          await page.screenshot({path: `${dir}/${id}-${theme}.png`, save: true});
        }
        cleanupFixtures();
      });
    }
  }
});
