import {html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {expectEventCounts, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {deepActiveElement, pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium, isTier2} from '@tecton-wc/testing/tier.js';
import {aTimeout, waitUntil} from '@tecton-wc/testing/timing.js';
import {userEvent} from 'vitest/browser';
import './define.js';
import type {ChatToolCallItem} from './chat-tool-calls.types.js';
import type {TctChatToolCalls} from './tct-chat-tool-calls.js';

const one: ChatToolCallItem[] = [
  {name: 'read_file', status: 'complete', target: 'Button.tsx', duration: '120ms'},
];
const many: ChatToolCallItem[] = [
  {name: 'read_file', status: 'complete', target: 'Button.tsx', duration: '120ms'},
  {
    name: 'run_tests',
    status: 'complete',
    target: 'yarn test',
    duration: '1.2s',
    additions: 12,
    deletions: 3,
  },
  {name: 'web_search', status: 'running', target: 'CSS anchor positioning', node: 'navi'},
];

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()!();
});

/** Replaces the announcer's transport with a recorder (the announcer uses `ariaNotify` when present). */
function spyOnAnnouncements(): string[] {
  const messages: string[] = [];
  const restore = overrideFeature('ariaNotify', true);
  (document.body as unknown as {ariaNotify: (message: string) => void}).ariaNotify = (message) => {
    messages.push(message);
  };
  cleanups.push(() => {
    delete (document.body as unknown as {ariaNotify?: unknown}).ariaNotify;
    restore();
  });
  return messages;
}

async function make(
  calls: readonly ChatToolCallItem[],
  attributes = '',
  options = {},
): Promise<TctChatToolCalls> {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: 480px"><tct-chat-tool-calls ${attributes}></tct-chat-tool-calls></div>`,
    options,
  );
  const element = root.querySelector<TctChatToolCalls>('tct-chat-tool-calls')!;
  element.calls = calls;
  await element.updateComplete;
  return element;
}

const q = (element: Element, selector: string): HTMLElement | null =>
  element.shadowRoot!.querySelector<HTMLElement>(selector);
const qa = (element: Element, selector: string): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>(selector),
];
const header = (element: Element) => q(element, '[part~="header"]')!;
const group = (element: Element) => q(element, '.group')!;
const hiddenText = (row: Element): string =>
  row.querySelector('tct-visually-hidden')!.textContent.trim();

runElementSuite({
  tag: 'tct-chat-tool-calls',
  render: () => `<tct-chat-tool-calls></tct-chat-tool-calls>`,
  properties: {label: 'Summary', expanded: true},
  attributes: {label: 'label', expanded: 'expanded'},
  events: ['tct-expanded-change'],
});

describe('tct-chat-tool-calls: rendering', () => {
  it('renders nothing for an empty list', async () => {
    const element = await make([]);
    expect(q(element, '.base')).toBeNull();
    expect(element.getBoundingClientRect().height).toBe(0);
  });

  it('renders a single call inline, without group chrome', async () => {
    const element = await make(one);
    expect(q(element, '.header')).toBeNull();
    expect(qa(element, '[part~="call"]')).toHaveLength(1);
    expect(q(element, '[part~="name"]')!.textContent).toBe('read_file');
    expect(q(element, '[part~="target"]')!.textContent).toBe('Button.tsx');
    expect(q(element, '.duration')!.textContent).toBe('120ms');
    // Nothing to disclose: the row is not a button.
    expect(q(element, 'button')).toBeNull();
  });

  it('defaults a call without a status to complete', async () => {
    const element = await make([{name: 'x'}]);
    expect(q(element, '.status')!.dataset.status).toBe('complete');
  });

  it('shows the duration only once a call is complete', async () => {
    const element = await make([
      {name: 'a', status: 'running', duration: '1s'},
      {name: 'b', status: 'error', duration: '2s'},
    ]);
    header(element).click();
    await element.updateComplete;
    expect(qa(element, '.duration')).toHaveLength(0);
    element.calls = [{name: 'a', status: 'complete', duration: '1s'}];
    await element.updateComplete;
    expect(q(element, '.duration')!.textContent).toBe('1s');
  });

  it('shows the node as a neutral badge, the diff stats in success and error inks, and custom stats', async () => {
    const element = await make([
      {name: 'edit', node: 'navi', additions: 12, deletions: 3, stats: 'net +9', target: 'x.ts'},
    ]);
    const badge = q(element, 'tct-badge')!;
    expect(badge.getAttribute('label')).toBe('navi');
    expect(badge.getAttribute('variant')).toBe('neutral');
    expect(q(element, '.additions')!.textContent).toBe('+12');
    expect(q(element, '.deletions')!.textContent).toBe('-3');
    expect(q(element, '.stats')!.textContent).toContain('net +9');
    expect(getComputedStyle(q(element, '.additions')!).color).not.toBe(
      getComputedStyle(q(element, '.deletions')!).color,
    );
  });

  it('shows a zero count of additions or deletions', async () => {
    const element = await make([{name: 'edit', additions: 0, deletions: 0}]);
    expect(q(element, '.additions')!.textContent).toBe('+0');
    expect(q(element, '.deletions')!.textContent).toBe('-0');
  });

  it('shows tool names in the code font and clips a long target with an ellipsis', async () => {
    const element = await make([{name: 'run', target: 'a very long target '.repeat(30)}]);
    expect(getComputedStyle(q(element, '.name')!).fontFamily).toContain('Mono');
    const target = q(element, '.target')!;
    expect(getComputedStyle(target).textOverflow).toBe('ellipsis');
    expect(target.scrollWidth).toBeGreaterThan(target.clientWidth);
    expect(q(element, '.base')!.getBoundingClientRect().width).toBeLessThanOrEqual(480);
  });

  it('keeps every row at least 24px tall', async () => {
    const element = await make(one);
    expect(q(element, '.row')!.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
  });
});

describe('tct-chat-tool-calls: status', () => {
  it.each([
    ['pending', 'Pending', true],
    ['running', 'Running', true],
    ['complete', 'Complete', false],
    ['error', 'Failed', false],
  ] as const)('%s: %s, with a spinner: %s', async (status, text, spinner) => {
    const element = await make([{name: 'tool', status}]);
    const mark = q(element, '.status')!;
    expect(mark.querySelector('tct-spinner') !== null).toBe(spinner);
    expect(mark.querySelector('tct-icon') !== null).toBe(!spinner);
    expect(hiddenText(mark)).toBe(text);
  });

  it('hides the spinner from assistive technology and leaves the status text', async () => {
    const element = await make([{name: 'tool', status: 'running'}]);
    const spinner = q(element, 'tct-spinner')!;
    expect(spinner.getAttribute('aria-hidden')).toBe('true');
    if (isChromium) {
      expect((await axNode(spinner)).ignored).toBe('true');
    }
    const grouped = await make([
      {name: 'other', status: 'complete'},
      {name: 'tool', status: 'running', target: 't'},
    ]);
    if (isChromium) expect((await axNode(header(grouped))).name).toContain('Running');
  });

  it('exposes the error message as hidden text and a native tooltip', async () => {
    const element = await make([
      {name: 'tool', status: 'error', errorMessage: 'ENOENT: no such file', resultDetail: 'stack'},
    ]);
    const mark = q(element, '.status')!;
    expect(hiddenText(mark)).toBe('Error: ENOENT: no such file');
    expect(mark.getAttribute('title')).toBe('ENOENT: no such file');
    if (isChromium)
      expect((await axNode(q(element, 'button.disclosure')!)).name).toContain('Error: ENOENT');
  });

  it('updates in place as the call progresses: running, complete', async () => {
    const element = await make([{name: 'tool', status: 'running', key: 'k'}]);
    element.calls = [{name: 'tool', status: 'complete', key: 'k', duration: '1s'}];
    await element.updateComplete;
    expect(hiddenText(q(element, '.status')!)).toBe('Complete');
    expect(q(element, '.status')!.querySelector('tct-spinner')).toBeNull();
  });

  it('passes axe for every status', async () => {
    const element = await make([
      {name: 'a', status: 'pending', target: 'p'},
      {name: 'b', status: 'running', target: 'r'},
      {name: 'c', status: 'complete', target: 'c', duration: '1s', additions: 1, deletions: 2},
      {name: 'd', status: 'error', target: 'e', errorMessage: 'boom'},
    ]);
    header(element).click();
    await element.updateComplete;
    await expectAccessible(element.parentElement!);
  });
});

describe('tct-chat-tool-calls: group', () => {
  it('collapses several calls into the latest call and a count', async () => {
    const element = await make(many);
    const head = header(element);
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(head.querySelector('.name')!.textContent).toBe('web_search');
    expect(head.querySelector('.target')!.textContent).toBe('CSS anchor positioning');
    expect(head.querySelector('.count')!.textContent).toContain('3');
    expect(hiddenText(head.querySelector('.count')!)).toBe('3 tool calls');
    expect(hiddenText(head.querySelector('.status')!)).toBe('Running');
  });

  it('keeps collapsed rows out of the tab order and the accessibility tree (inert)', async () => {
    const element = await make(
      many.map((call, index) => ({...call, resultDetail: index === 0 ? 'detail' : undefined})),
    );
    expect(group(element).hasAttribute('inert')).toBe(true);
    const height = group(element).getBoundingClientRect().height;
    expect(height).toBe(0);
    header(element).click();
    await element.updateComplete;
    expect(group(element).hasAttribute('inert')).toBe(false);
  });

  it('expands to every call when the header is clicked, and shows the group label', async () => {
    const element = await make(many);
    header(element).click();
    await element.updateComplete;
    expect(element.expanded).toBe(true);
    expect(header(element).getAttribute('aria-expanded')).toBe('true');
    expect(header(element).getAttribute('aria-controls')).toBe(group(element).id);
    expect(q(element, '.group-label')!.textContent).toBe('3 tool calls');
    await waitUntil(() => group(element).getBoundingClientRect().height > 60, 'group opens');
    expect(qa(element, '.list [part~="call"]')).toHaveLength(3);
    expect(q(element, '.list')!.textContent).toContain('yarn test');
  });

  it('uses the label attribute for the expanded summary', async () => {
    const element = await make(many, 'expanded label="Investigated the bug"');
    expect(q(element, '.group-label')!.textContent).toBe('Investigated the bug');
  });

  it('starts expanded with the expanded attribute (the default state)', async () => {
    const element = await make(many, 'expanded');
    expect(header(element).getAttribute('aria-expanded')).toBe('true');
    expect(group(element).hasAttribute('inert')).toBe(false);
  });

  it('toggles from the keyboard: Enter and Space', async () => {
    const element = await make(many);
    header(element).focus();
    await pressKeys('Enter');
    expect(element.expanded).toBe(true);
    await pressKeys(' ');
    expect(element.expanded).toBe(false);
    expect(deepActiveElement()).toBe(header(element));
  });

  it('is one tab stop while collapsed, and reaches every detail button once expanded', async () => {
    const element = await make(many.map((call) => ({...call, resultDetail: 'more'})));
    // Something focusable after the element, so Tab has somewhere to go inside the page.
    const after = document.createElement('button');
    after.textContent = 'after';
    element.parentElement!.append(after);
    header(element).focus();
    await userEvent.tab();
    expect(deepActiveElement()).toBe(after);
    header(element).click();
    await element.updateComplete;
    header(element).focus();
    await userEvent.tab();
    expect(qa(element, '.list button')[0]).toBe(deepActiveElement());
  });

  it('fires one cancelable tct-expanded-change per user toggle, and none for writes', async () => {
    const element = await make(many);
    const recorder = recordEvents(element, ['tct-expanded-change']);
    element.expanded = true;
    await element.updateComplete;
    element.setAttribute('expanded', '');
    element.expanded = false;
    await element.updateComplete;
    expectEventCounts(recorder, {'tct-expanded-change': 0});
    header(element).click();
    await element.updateComplete;
    expectEventCounts(recorder, {'tct-expanded-change': 1});
    const event = recorder.events[0]!;
    expect([event.bubbles, event.composed, event.cancelable]).toEqual([true, true, true]);
    expect((event as unknown as {expanded: boolean; reason: string}).expanded).toBe(true);
    expect((event as unknown as {reason: string}).reason).toBe('trigger');
  });

  it('stays as it is when the intent event is prevented (controlled use)', async () => {
    const element = await make(many);
    element.addEventListener('tct-expanded-change', (event) => {
      event.preventDefault();
    });
    header(element).click();
    await element.updateComplete;
    expect(element.expanded).toBe(false);
    expect(header(element).getAttribute('aria-expanded')).toBe('false');
    element.expanded = true;
    await element.updateComplete;
    expect(header(element).getAttribute('aria-expanded')).toBe('true');
  });

  it.skipIf(isTier2)('exposes :state(expanded)', async () => {
    const element = await make(many);
    expect(element.matches(':state(expanded)')).toBe(false);
    element.expanded = true;
    await element.updateComplete;
    expect(element.matches(':state(expanded)')).toBe(true);
  });

  it('reports the count in the header name, collapsed and expanded', async () => {
    const element = await make(many);
    if (isChromium) {
      expect((await axNode(header(element))).name).toContain('3 tool calls');
      header(element).click();
      await element.updateComplete;
      expect((await axNode(header(element))).name).toContain('3 tool calls');
    }
  });

  it('animates the height only when motion is allowed', async () => {
    const element = await make(many);
    expect(getComputedStyle(group(element)).transitionProperty).toContain('grid-template-rows');
    if (isChromium) {
      await emulateMedia({reducedMotion: 'reduce'});
      const reduced = await make(many);
      expect(getComputedStyle(group(reduced)).transitionProperty).not.toContain(
        'grid-template-rows',
      );
    }
  });

  it('passes axe expanded and collapsed', async () => {
    const element = await make(many);
    await expectAccessible(element.parentElement!);
    header(element).click();
    await element.updateComplete;
    await expectAccessible(element.parentElement!);
  });
});

describe('tct-chat-tool-calls: result detail', () => {
  const withDetail: ChatToolCallItem[] = [
    {name: 'edit', status: 'complete', key: 'e', resultDetail: 'diff --git a/x b/x'},
  ];

  it('makes a row with a result detail a disclosure that shows the detail', async () => {
    const element = await make(withDetail);
    const row = q(element, 'button.disclosure')!;
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(q(element, '.detail')).toBeNull();
    row.click();
    await element.updateComplete;
    expect(row.getAttribute('aria-expanded')).toBe('true');
    const detail = q(element, '.detail')!;
    expect(row.getAttribute('aria-controls')).toBe(detail.id);
    expect(detail.textContent).toBe('diff --git a/x b/x');
    row.click();
    await element.updateComplete;
    expect(q(element, '.detail')).toBeNull();
  });

  it('shows a string detail as text and a template or node as given', async () => {
    const node = document.createElement('pre');
    node.textContent = 'from a node';
    const element = await make([
      {name: 'a', key: 'a', resultDetail: '<img src=x onerror="window.__tool_xss = true">'},
      {name: 'b', key: 'b', resultDetail: html`<code class="tpl">template</code>`},
      {name: 'c', key: 'c', resultDetail: node},
    ]);
    header(element).click();
    await element.updateComplete;
    for (const button of qa(element, 'button.disclosure')) button.click();
    await element.updateComplete;
    const details = qa(element, '.detail');
    expect(details).toHaveLength(3);
    expect(details[0]!.querySelector('img')).toBeNull();
    expect(details[0]!.textContent).toContain('<img');
    expect(details[1]!.querySelector('code.tpl')).not.toBeNull();
    expect(details[2]!.contains(node)).toBe(true);
    expect((window as unknown as Record<string, unknown>).__tool_xss).toBeUndefined();
  });

  it('keeps a detail open while its call updates, when it has a key (streaming)', async () => {
    const element = await make([{name: 'edit', status: 'running', key: 'k', resultDetail: 'a'}]);
    q(element, 'button.disclosure')!.click();
    await element.updateComplete;
    element.calls = [
      {name: 'edit', status: 'complete', key: 'k', duration: '1s', resultDetail: 'a\nb'},
    ];
    await element.updateComplete;
    expect(q(element, '.detail')!.textContent).toBe('a\nb');
  });

  it('keeps a detail open across a status change even without a key', async () => {
    const element = await make([{name: 'edit', status: 'running', resultDetail: 'a'}]);
    q(element, 'button.disclosure')!.click();
    await element.updateComplete;
    element.calls = [{name: 'edit', status: 'complete', resultDetail: 'a'}];
    await element.updateComplete;
    expect(q(element, '.detail')).not.toBeNull();
  });

  it('toggles by keyboard and keeps focus on the row', async () => {
    const element = await make(withDetail);
    const row = q(element, 'button.disclosure')!;
    row.focus();
    await pressKeys('Enter');
    expect(q(element, '.detail')).not.toBeNull();
    expect(deepActiveElement()).toBe(row);
    await pressKeys(' ');
    expect(q(element, '.detail')).toBeNull();
  });

  it('passes axe with the detail open', async () => {
    const element = await make(withDetail);
    q(element, 'button.disclosure')!.click();
    await element.updateComplete;
    await expectAccessible(element.parentElement!);
  });
});

describe('tct-chat-tool-calls: streaming', () => {
  it('never moves focus while calls stream in and change status', async () => {
    const root = await fixture<HTMLElement>(html`
      <div style="inline-size: 480px">
        <button id="elsewhere" type="button">elsewhere</button>
        <tct-chat-tool-calls></tct-chat-tool-calls>
      </div>
    `);
    const element = root.querySelector<TctChatToolCalls>('tct-chat-tool-calls')!;
    const elsewhere = root.querySelector<HTMLButtonElement>('#elsewhere')!;
    elsewhere.focus();
    const calls: ChatToolCallItem[] = [];
    for (let index = 0; index < 30; index++) {
      calls.push({name: `tool_${index}`, status: 'running', key: `k${index}`});
      if (index > 0) calls[index - 1] = {...calls[index - 1]!, status: 'complete'};
      element.calls = [...calls];
      await element.updateComplete;
      expect(document.activeElement).toBe(elsewhere);
    }
    expect(header(element).getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps focus on the header while the calls under it update', async () => {
    const element = await make(many);
    header(element).focus();
    element.calls = [...many, {name: 'more', status: 'running'}];
    await element.updateComplete;
    expect(deepActiveElement()).toBe(header(element));
    expect(header(element).querySelector('.name')!.textContent).toBe('more');
  });

  it('does not speak while calls stream and complete', async () => {
    const messages = spyOnAnnouncements();
    const element = await make([{name: 'a', status: 'running', key: 'a'}]);
    for (let index = 0; index < 20; index++) {
      element.calls = [
        {name: 'a', status: index < 19 ? 'running' : 'complete', key: 'a'},
        {name: `b${index}`, status: 'running', key: `b${index}`},
      ];
      await element.updateComplete;
    }
    await aTimeout(300);
    expect(messages).toEqual([]);
  });

  it('announces a call that fails once, with its error', async () => {
    const messages = spyOnAnnouncements();
    const element = await make([{name: 'run_tests', status: 'running', key: 'r'}]);
    element.calls = [
      {name: 'run_tests', status: 'error', key: 'r', errorMessage: '3 tests failed'},
    ];
    await element.updateComplete;
    element.calls = [
      {name: 'run_tests', status: 'error', key: 'r', errorMessage: '3 tests failed'},
    ];
    await element.updateComplete;
    expect(messages).toEqual(['run_tests: Error: 3 tests failed']);
  });

  it('does not announce failures that were there when the calls were first given (history)', async () => {
    const messages = spyOnAnnouncements();
    await make([
      {name: 'a', status: 'error', errorMessage: 'old'},
      {name: 'b', status: 'complete'},
    ]);
    await aTimeout(50);
    expect(messages).toEqual([]);
  });
});

describe('tct-chat-tool-calls: i18n, direction and theming', () => {
  it('localises the status text and the group label (de-DE)', async () => {
    const element = await make(many, '', {lang: 'de-DE'});
    await waitUntil(
      () => hiddenText(header(element).querySelector('.status')!) !== 'Running',
      'German catalog',
      5000,
    );
    expect(header(element).querySelector('.count')!.textContent).not.toContain('tool calls');
  });

  it('lays out right-to-left: the chevron sits at the start side of the line end', async () => {
    const element = await make(many, '', {dir: 'rtl', lang: 'ar-SA'});
    const chevron = q(element, '.chevron')!.getBoundingClientRect();
    const name = q(element, '.name')!.getBoundingClientRect();
    expect(chevron.right).toBeLessThan(name.left);
  });

  it('passes axe in the dark theme, expanded, with diff stats', async () => {
    const root = await fixture<HTMLElement>(
      html`<div style="inline-size: 480px; background: var(--color-background-body)">
        <tct-chat-tool-calls expanded .calls=${many}></tct-chat-tool-calls>
      </div>`,
      {theme: 'dark'},
    );
    await expectAccessible(root);
  });

  it.skipIf(!isChromium)('draws the focus ring on the header in forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await make(many);
    await userEvent.tab();
    header(element).focus({focusVisible: true});
    expect(getComputedStyle(header(element)).outlineStyle).not.toBe('none');
  });
});
