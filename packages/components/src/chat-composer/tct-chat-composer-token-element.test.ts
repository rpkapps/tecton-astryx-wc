/// <reference types="@vitest/browser-playwright" />
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {expectEventCounts, expectEventFlags, recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {animationsFinished, waitUntil} from '@tecton-wc/testing/timing.js';
import '../badge/define.js';
import '../icon/define.js';
import './define.js';
import {BADGE_VARIANTS} from '../badge/badge.types.js';
import {ChatPasteAsTokenController} from './chat-paste-as-token.js';
import {countText, type TctChatComposerTokenElement} from './tct-chat-composer-token-element.js';

const badgeOf = (token: Element): Element => token.shadowRoot!.querySelector('tct-badge')!;
const chipOf = (token: Element): Element => token.shadowRoot!.querySelector('.chip')!;

async function make(attributes = ''): Promise<TctChatComposerTokenElement> {
  const root = await fixture<HTMLElement>(
    `<div style="padding-block-start: 140px"><tct-chat-composer-token-element ${attributes}></tct-chat-composer-token-element></div>`,
  );
  return root.querySelector<TctChatComposerTokenElement>('tct-chat-composer-token-element')!;
}

runElementSuite({
  tag: 'tct-chat-composer-token-element',
  render: () =>
    `<tct-chat-composer-token-element value="@ada" label="Ada"></tct-chat-composer-token-element>`,
  properties: {value: '@grace', label: 'Grace', variant: 'info', icon: 'user', expandable: true},
  attributes: {
    value: 'value',
    label: 'label',
    variant: 'variant',
    icon: 'icon',
    expandable: 'expandable',
  },
  events: ['tct-chat-token-expand'],
});

describe('tct-chat-composer-token-element: content', () => {
  it('shows a badge from the attributes: label, variant and icon', async () => {
    const token = await make('value="@ada" label="Ada Lovelace" variant="info" icon="check"');
    const badge = badgeOf(token);
    expect(badge.getAttribute('label')).toBe('Ada Lovelace');
    expect(badge.getAttribute('variant')).toBe('info');
    expect(badge.querySelector('tct-icon')!.getAttribute('name')).toBe('check');
  });

  it('the token property wins over the attributes', async () => {
    const token = await make('value="@a" label="From attribute"');
    token.token = {value: '@b', label: 'From property', variant: 'success'};
    await token.updateComplete;
    expect(badgeOf(token).getAttribute('label')).toBe('From property');
    expect(badgeOf(token).getAttribute('variant')).toBe('success');
  });

  it('falls back to the value for a label, and to a neutral badge for an unknown variant', async () => {
    const token = await make('value="#topic" variant="nonsense"');
    expect(badgeOf(token).getAttribute('label')).toBe('#topic');
    expect(badgeOf(token).getAttribute('variant')).toBe('neutral');
    for (const variant of BADGE_VARIANTS.slice(0, 3)) {
      token.variant = variant;
      await token.updateComplete;
      expect(badgeOf(token).getAttribute('variant')).toBe(variant);
    }
  });

  it('renders a custom token: a string as text, a template, a node', async () => {
    const token = await make();
    token.token = {value: '/x', render: () => '<b>not bold</b>'};
    await token.updateComplete;
    expect(token.shadowRoot!.querySelector('b')).toBeNull();
    expect(token.shadowRoot!.textContent).toContain('<b>not bold</b>');
    token.token = {value: '/y', render: () => html`<i>template</i>`};
    await token.updateComplete;
    expect(token.shadowRoot!.querySelector('i')!.textContent).toBe('template');
    const node = document.createElement('u');
    node.textContent = 'node';
    token.token = {value: '/z', render: () => node};
    await token.updateComplete;
    expect(token.shadowRoot!.querySelector('u')).toBe(node);
  });

  it('sits inline on the text baseline as one box', async () => {
    const root = await fixture<HTMLElement>(
      `<p>before <tct-chat-composer-token-element value="@a" label="Ada"></tct-chat-composer-token-element> after</p>`,
    );
    const token = root.querySelector('tct-chat-composer-token-element')!;
    expect(getComputedStyle(token).display).toBe('inline-flex');
    expect(getComputedStyle(token).verticalAlign).toBe('middle');
  });
});

describe('tct-chat-composer-token-element: named for assistive technology', () => {
  it.skipIf(!isChromium)('the chip is an image named by its label, else its value', async () => {
    const labelled = await make('value="@ada" label="Ada Lovelace"');
    expect(await axNode(chipOf(labelled))).toMatchObject({role: 'image', name: 'Ada Lovelace'});
    const bare = await make('value="#topic"');
    expect(await axNode(chipOf(bare))).toMatchObject({role: 'image', name: '#topic'});
    labelled.label = 'Ada';
    await labelled.updateComplete;
    expect(await axNode(chipOf(labelled))).toMatchObject({name: 'Ada'});
  });

  it('counts lines and characters for an expandable token, singular and plural', async () => {
    expect(countText('one\ntwo')).toEqual({lines: 2, chars: 7});
    const many = await make('expandable');
    many.value = `${'a'.repeat(50)}\n${'b'.repeat(60)}`;
    await many.updateComplete;
    expect(many.accessibleName).toBe('2 lines, 111 chars');
    const single = await make('expandable');
    single.value = 'x'.repeat(230);
    await single.updateComplete;
    expect(single.accessibleName).toBe('230 chars');
    const one = await make('expandable');
    one.value = 'x';
    await one.updateComplete;
    expect(one.accessibleName).toBe('1 char');
  });

  it('counts in the page language', async () => {
    const root = await fixture<HTMLElement>(
      `<div lang="de-DE"><tct-chat-composer-token-element expandable value="${'x'.repeat(300)}"></tct-chat-composer-token-element></div>`,
    );
    const token = root.querySelector<TctChatComposerTokenElement>(
      'tct-chat-composer-token-element',
    )!;
    // English defaults follow English plural rules; a translated catalog (when one ships the id) would replace them.
    await waitUntil(() => token.accessibleName.length > 0, 'a name');
    expect(token.accessibleName).toContain('300');
  });
});

describe('tct-chat-composer-token-element: right to left and forced colours', () => {
  it('flows in the text direction and passes axe in right-to-left', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 300px; padding-block-start: 140px"><span>שלום <tct-chat-composer-token-element value="@ada" label="Ada"></tct-chat-composer-token-element></span></div>`,
      {dir: 'rtl'},
    );
    const token = root.querySelector<TctChatComposerTokenElement>(
      'tct-chat-composer-token-element',
    )!;
    const word = root.querySelector('span')!.getBoundingClientRect();
    // The word comes first at the inline start (right), the chip after it toward the left.
    expect(token.getBoundingClientRect().right).toBeLessThanOrEqual(word.right);
    expect(token.getBoundingClientRect().left).toBeGreaterThanOrEqual(word.left);
    await expectAccessible(root);
  });

  it('keeps an edge or a fill on the chip in forced colours', async () => {
    if (!isChromium) return;
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const token = await make('value="@ada" label="Ada"');
      const style = getComputedStyle(badgeOf(token));
      expect(token.getBoundingClientRect().width).toBeGreaterThan(0);
      expect(style.visibility).toBe('visible');
      await expectAccessible(token);
    } finally {
      await restore();
    }
  });
});

describe('tct-chat-composer-token-element: an expandable token', () => {
  it('previews the text in a hover card with the counts and an Expand button', async () => {
    const token = await make(`expandable value="${'w'.repeat(40)}\nsecond line"`);
    const card = token.shadowRoot!.querySelector<HTMLElement & {show(): Promise<void>}>(
      'tct-hover-card',
    )!;
    await card.show();
    const preview = token.shadowRoot!.querySelector<HTMLElement>('.preview')!;
    expect(preview.textContent).toBe(`${'w'.repeat(40)}\nsecond line`);
    expect(getComputedStyle(preview).whiteSpace).toBe('pre-wrap');
    expect(token.shadowRoot!.querySelector('.meta')!.textContent).toBe('2 lines, 52 chars');
    expect(token.shadowRoot!.querySelector('tct-button')!.getAttribute('label')).toBe('Expand');
  });

  it('fires a cancelable tct-chat-token-expand with the value, once, when Expand is activated', async () => {
    const token = await make(`expandable value="${'q'.repeat(30)}"`);
    const events = recordEvents(token, ['tct-chat-token-expand']);
    const card = token.shadowRoot!.querySelector<HTMLElement & {show(): Promise<void>}>(
      'tct-hover-card',
    )!;
    await card.show();
    await animationsFinished(
      token.shadowRoot!.querySelector('tct-hover-card')!.shadowRoot!.querySelector('.layer')!,
    );
    await userEvent.click(token.shadowRoot!.querySelector('tct-button')!);
    expectEventCounts(events, {'tct-chat-token-expand': 1});
    expectEventFlags(events.events[0]!, {bubbles: true, composed: true, cancelable: true});
    expect(events.events[0]!.value).toBe('q'.repeat(30));
  });

  it('a token that is not expandable has no card', async () => {
    const token = await make('value="@a" label="A"');
    expect(token.shadowRoot!.querySelector('tct-hover-card')).toBeNull();
  });

  it('passes axe, the card open, in light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const root = await fixture<HTMLElement>(
        `<div style="padding-block-start: 200px"><tct-chat-composer-token-element expandable value="${'z'.repeat(80)}"></tct-chat-composer-token-element><tct-chat-composer-token-element value="@a" label="Ada" variant="success"></tct-chat-composer-token-element></div>`,
        {theme},
      );
      const token = root.querySelector<TctChatComposerTokenElement>(
        'tct-chat-composer-token-element',
      )!;
      const card = token.shadowRoot!.querySelector<HTMLElement & {show(): Promise<void>}>(
        'tct-hover-card',
      )!;
      await card.show();
      await animationsFinished(
        token.shadowRoot!.querySelector('tct-hover-card')!.shadowRoot!.querySelector('.layer')!,
      );
      await expectAccessible(root);
    }
  });
});

describe('ChatPasteAsTokenController', () => {
  const handle = () => {
    const inserted: unknown[] = [];
    return {
      inserted,
      input: {
        insertToken: (token: unknown) => {
          inserted.push(token);
          return 'id';
        },
        expandToken: () => undefined,
        insertText: () => undefined,
        focus: () => undefined,
        getValue: () => '',
      },
    };
  };

  it('converts only pastes over the threshold (200 by default), through the input', () => {
    const {input, inserted} = handle();
    const paste = new ChatPasteAsTokenController({input: () => input});
    expect(paste.threshold).toBe(200);
    expect(paste.handlePaste('a'.repeat(200))).toBe(false);
    expect(paste.handlePaste('a'.repeat(201))).toBe(true);
    expect(inserted).toEqual([{value: 'a'.repeat(201), variant: 'neutral'}]);
  });

  it('reads its options on every paste, so the threshold and the token can change', () => {
    const {input, inserted} = handle();
    const paste = new ChatPasteAsTokenController({input: () => input, threshold: 5});
    expect(paste.handlePaste('123456')).toBe(true);
    paste.options.threshold = 50;
    expect(paste.handlePaste('123456')).toBe(false);
    paste.options.threshold = 1;
    paste.options.toToken = (text) => ({value: text, label: 'custom'});
    expect(paste.handlePaste('ab')).toBe(true);
    expect(inserted.at(-1)).toEqual({value: 'ab', label: 'custom'});
  });

  it('does nothing when there is no input to insert into', () => {
    const paste = new ChatPasteAsTokenController({input: () => null, threshold: 0});
    expect(paste.handlePaste('anything')).toBe(false);
  });
});
