/**
 * tct-text: rendering, types and tokens, semantics, layout helpers, truncation with the built-in
 * tooltip (ported from upstream Text.test.tsx and useTruncation behaviour).
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {pressKeys} from '@tecton-astryx/testing/keyboard.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {aTimeout, waitUntil} from '@tecton-astryx/testing/timing.js';
import {BUILTIN_TEXT_TYPES, TECTON_TEXT_TYPES, TEXT_SIZES} from './text.types.js';
import './define.js';
import type {TctText} from './tct-text.js';

const LONG =
  'A label far wider than the space it has been given, and then some more words after it';

const inner = (text: TctText): HTMLElement => text.shadowRoot!.querySelector<HTMLElement>('.text')!;
const surface = (text: TctText): HTMLElement | null =>
  text.shadowRoot!.querySelector<HTMLElement>('.tooltip-surface');
const isOpen = (text: TctText): boolean => surface(text)?.matches(':popover-open') ?? false;

async function make(attributes = '', content = 'Hello world', style = ''): Promise<TctText> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="${style}"><tct-text ${attributes}>${content}</tct-text></div>`,
  );
  const text = wrapper.querySelector<TctText>('tct-text')!;
  await text.updateComplete;
  return text;
}

/** Resolves a token to the computed value of `property` by painting it on a probe inside the fixture. */
async function tokenValue(
  property: 'fontSize' | 'fontWeight' | 'lineHeight',
  token: string,
): Promise<string> {
  const wrapper = await fixture<HTMLElement>('<div><span>x</span></div>');
  const probe = wrapper.firstElementChild as HTMLElement;
  if (property === 'fontSize') probe.style.fontSize = `var(${token})`;
  else if (property === 'fontWeight') probe.style.fontWeight = `var(${token})`;
  else probe.style.lineHeight = `var(${token})`;
  probe.style.fontSize ||= '';
  return getComputedStyle(probe)[property];
}

runElementSuite({
  tag: 'tct-text',
  render: () => html`<tct-text>Some text</tct-text>`,
  properties: {
    type: 'large',
    size: 'xl',
    color: 'accent',
    weight: 'bold',
    display: 'block',
    maxLines: 2,
    justify: 'center',
    hasStrikethrough: true,
  },
  attributes: {type: 'type', size: 'size', color: 'color', weight: 'weight', display: 'display'},
});

describe('tct-text: rendering (Text.test.tsx)', () => {
  it('renders without a type (defaults to body) and shows the children', async () => {
    const text = await make('', 'Default body text');
    expect(text.type).toBe('body');
    expect(text.getAttribute('type')).toBe('body');
    expect(text.textContent).toBe('Default body text');
    expect(inner(text).querySelector('slot')).not.toBeNull();
    expect(inner(text).getAttribute('part')).toBe('text');
  });

  it('is inline by default and block with display="block"', async () => {
    const text = await make();
    expect(getComputedStyle(text).display).toBe('inline');
    expect(getComputedStyle(inner(text)).display).toBe('inline');
    text.display = 'block';
    await text.updateComplete;
    expect(getComputedStyle(text).display).toBe('block');
    expect(getComputedStyle(inner(text)).display).toBe('block');
  });

  it('reflects type, size and colour for theming and renders custom types with the body baseline', async () => {
    const body = await make('type="body"');
    const hero = await make('type="hero"');
    expect(hero.getAttribute('type')).toBe('hero');
    expect(getComputedStyle(inner(hero)).fontSize).toBe(getComputedStyle(inner(body)).fontSize);
    expect(getComputedStyle(inner(hero)).fontWeight).toBe(getComputedStyle(inner(body)).fontWeight);
    const sized = await make('type="code" size="2xs"');
    expect(sized.getAttribute('size')).toBe('2xs');
    const brand = await make('color="brand"');
    expect(brand.getAttribute('color')).toBe('brand');
    // a custom colour keeps the primary baseline until the consumer styles it
    const primary = await make('color="primary"');
    expect(getComputedStyle(inner(brand)).color).toBe(getComputedStyle(inner(primary)).color);
  });

  it('applies primary colour to custom types by default and lets colour override them', async () => {
    const hero = await make('type="caption"');
    const primary = await make('type="body"');
    expect(getComputedStyle(inner(hero)).color).toBe(getComputedStyle(inner(primary)).color);
    const muted = await make('type="hero" color="secondary"');
    const secondary = await make('color="secondary"');
    expect(getComputedStyle(inner(muted)).color).toBe(getComputedStyle(inner(secondary)).color);
  });

  it('leaves the native title to the tooltip it already renders (no title attribute)', async () => {
    const text = await make('max-lines="1"', LONG, 'inline-size: 120px');
    await waitUntil(() => text.truncated, 'truncated');
    expect(text.hasAttribute('title')).toBe(false);
    expect(inner(text).hasAttribute('title')).toBe(false);
  });
});

describe('tct-text: semantics (as)', () => {
  it.skipIf(!isChromium)('span, div and label add no role', async () => {
    for (const as of ['span', 'div', 'label']) {
      const text = await make(`as="${as}"`);
      expect((await axNode(text)).role, as).not.toBe('paragraph');
      expect((await axNode(text)).role, as).not.toBe('heading');
    }
  });

  it.skipIf(!isChromium)('as="p" is a paragraph', async () => {
    const text = await make('as="p"', 'A paragraph.');
    expect((await axNode(text)).role).toBe('paragraph');
  });

  it.skipIf(!isChromium)('as="h1" to "h3" are headings of that level', async () => {
    for (const level of [1, 2, 3]) {
      const text = await make(`as="h${level}"`, `Heading ${level}`);
      expect(await axNode(text)).toMatchObject({
        role: 'heading',
        level: String(level),
        name: `Heading ${level}`,
      });
    }
  });

  it('never writes a role or aria-level attribute on the host', async () => {
    const text = await make('as="h2"', 'Title');
    expect(text.hasAttribute('role')).toBe(false);
    expect(text.hasAttribute('aria-level')).toBe(false);
  });

  it('passes axe as a paragraph and as a heading', async () => {
    await expectAccessible(await make('as="p"', 'Paragraph text on the page.'));
    await expectAccessible(await make('as="h2" type="display-2"', 'Display heading'));
    await expectAccessible(await make('type="supporting"', 'Supporting text'));
  });
});

describe('tct-text: types and tokens', () => {
  it.each([
    'body',
    'large',
    'label',
    'supporting',
    'code',
    'display-1',
    'display-2',
    'display-3',
  ] as const)('type %s uses its type-scale tokens for size, weight and leading', async (type) => {
    const text = await make(`type="${type}"`);
    const style = getComputedStyle(inner(text));
    expect(style.fontSize).toBe(await tokenValue('fontSize', `--text-${type}-size`));
    expect(style.fontWeight).toBe(await tokenValue('fontWeight', `--text-${type}-weight`));
    // line-height is a unitless number: compare against the resolved pixel value
    const probe = document.createElement('span');
    probe.textContent = 'x';
    probe.style.cssText = `font-size: var(--text-${type}-size); line-height: var(--text-${type}-leading)`;
    text.after(probe);
    expect(style.lineHeight).toBe(getComputedStyle(probe).lineHeight);
    probe.remove();
  });

  it('the code type uses the code font family; others do not', async () => {
    const code = await make('type="code"');
    const body = await make('type="body"');
    expect(getComputedStyle(inner(code)).fontFamily).toContain('IBM Plex Mono');
    expect(getComputedStyle(inner(body)).fontFamily).not.toContain('IBM Plex Mono');
  });

  it('the inherit type takes size, weight and colour from the surrounding text', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<p style="font-size: 33px; font-weight: 300; line-height: 40px; color: rgb(1, 2, 3)"><tct-text type="inherit">x</tct-text></p>',
    );
    const style = getComputedStyle(inner(wrapper.querySelector<TctText>('tct-text')!));
    expect(style.fontSize).toBe('33px');
    expect(style.fontWeight).toBe('300');
    expect(style.lineHeight).toBe('40px');
    expect(style.color).toBe('rgb(1, 2, 3)');
  });

  it.each(TECTON_TEXT_TYPES)('Tecton type %s renders with its own scale', async (type) => {
    const text = await make(`type="${type}"`);
    const style = getComputedStyle(inner(text));
    const expected: Record<string, {size: string; weight: string}> = {
      'medium-strong': {size: '14px', weight: '500'},
      'small-strong': {size: '12px', weight: '500'},
      tiny: {size: '10px', weight: '500'},
      'large-data': {size: '16px', weight: '400'},
      'medium-data': {size: '14px', weight: '400'},
      'small-data': {size: '12px', weight: '400'},
      'action-medium': {size: '14px', weight: '500'},
      'action-small': {size: '12px', weight: '500'},
    };
    expect(style.fontSize).toBe(expected[type]!.size);
    expect(style.fontWeight).toBe(expected[type]!.weight);
    if (type.endsWith('-data')) {
      expect(style.fontFamily).toContain('IBM Plex Mono');
      expect(style.fontVariantNumeric).toBe('tabular-nums');
    }
  });

  it('the type list is what the docs promise', () => {
    expect([...BUILTIN_TEXT_TYPES, ...TECTON_TEXT_TYPES]).toHaveLength(17);
  });

  it('an explicit size overrides the size only and keeps the type weight and leading', async () => {
    const plain = await make('type="label"');
    const sized = await make('type="label" size="2xl"');
    const a = getComputedStyle(inner(plain));
    const b = getComputedStyle(inner(sized));
    expect(b.fontSize).not.toBe(a.fontSize);
    expect(b.fontSize).toBe(await tokenValue('fontSize', '--font-size-2xl'));
    expect(b.fontWeight).toBe(a.fontWeight);
  });

  it.each(TEXT_SIZES)('size %s maps to its font size token', async (size) => {
    const text = await make(`size="${size}"`);
    const token = size === 'xsm' ? '--font-size-xs' : `--font-size-${size}`;
    expect(getComputedStyle(inner(text)).fontSize).toBe(await tokenValue('fontSize', token));
  });

  it('a weight overrides the type weight', async () => {
    const text = await make('weight="bold"');
    expect(getComputedStyle(inner(text)).fontWeight).toBe(
      await tokenValue('fontWeight', '--font-weight-bold'),
    );
  });

  it('supporting text is secondary; every colour maps to its text role', async () => {
    const probe = await fixture<HTMLElement>('<span>x</span>');
    const role = (token: string): string => {
      probe.style.color = `var(${token})`;
      return getComputedStyle(probe).color;
    };
    const supporting = await make('type="supporting"');
    expect(getComputedStyle(inner(supporting)).color).toBe(role('--color-text-secondary'));
    const colors: Record<string, string> = {
      primary: '--color-text-primary',
      secondary: '--color-text-secondary',
      disabled: '--color-text-disabled',
      placeholder: '--color-text-secondary',
      accent: '--color-text-accent',
    };
    for (const [color, token] of Object.entries(colors)) {
      const text = await make(`color="${color}"`);
      expect(getComputedStyle(inner(text)).color, color).toBe(role(token));
    }
    const explicit = await make('type="supporting" color="primary"');
    expect(getComputedStyle(inner(explicit)).color).toBe(role('--color-text-primary'));
  });
});

describe('tct-text: layout helpers', () => {
  it('has-strikethrough, has-tabular-numbers, text-wrap and justify apply', async () => {
    const text = await make(
      'has-strikethrough has-tabular-numbers text-wrap="balance" justify="center" display="block"',
      '12345',
    );
    const style = getComputedStyle(inner(text));
    expect(style.textDecorationLine).toBe('line-through');
    expect(style.fontVariantNumeric).toBe('tabular-nums');
    expect(style.textWrapMode === 'wrap' || style.textWrap.includes('balance')).toBe(true);
    expect(style.textAlign).toBe('center');
    text.justify = 'end';
    await text.updateComplete;
    expect(getComputedStyle(inner(text)).textAlign).toBe('end');
    text.justify = 'start';
    await text.updateComplete;
    expect(getComputedStyle(inner(text)).textAlign).toBe('start');
  });

  it('has-capsize forces block display and trims the text box where supported', async () => {
    const text = await make('has-capsize', 'Capsize text');
    expect(getComputedStyle(text).display).toBe('block');
    expect(getComputedStyle(inner(text)).display).toBe('block');
    if (CSS.supports('text-box', 'trim-both cap alphabetic')) {
      expect(getComputedStyle(inner(text)).getPropertyValue('text-box-trim')).toBe('trim-both');
    }
  });

  it('max-lines forces block, clamps one line with an ellipsis and several with a line clamp', async () => {
    const one = await make('max-lines="1"', LONG, 'inline-size: 160px');
    expect(getComputedStyle(one).display).toBe('block');
    const oneStyle = getComputedStyle(inner(one));
    expect(oneStyle.overflow).toBe('hidden');
    expect(oneStyle.textOverflow).toBe('ellipsis');
    expect(oneStyle.whiteSpace).toBe('nowrap');
    const two = await make('max-lines="2"', LONG, 'inline-size: 160px');
    const twoStyle = getComputedStyle(inner(two));
    // Chromium reports the clamped block as flow-root; other engines keep -webkit-box.
    expect(['-webkit-box', 'flow-root']).toContain(twoStyle.display);
    expect(twoStyle.getPropertyValue('-webkit-line-clamp')).toBe('2');
    const lineHeight = Number.parseFloat(twoStyle.lineHeight);
    expect(inner(two).getBoundingClientRect().height).toBeLessThanOrEqual(lineHeight * 2 + 1);
  });

  it('word-break defaults to break-all for one line and break-word otherwise, unless set', async () => {
    const one = await make('max-lines="1"', LONG, 'inline-size: 160px');
    const two = await make('max-lines="2"', LONG, 'inline-size: 160px');
    expect(getComputedStyle(inner(one)).wordBreak).toBe('break-all');
    expect(getComputedStyle(inner(two)).wordBreak).toBe('normal');
    expect(getComputedStyle(inner(two)).overflowWrap).toBe('break-word');
    const forced = await make('max-lines="1" word-break="break-word"', LONG, 'inline-size: 160px');
    expect(getComputedStyle(inner(forced)).wordBreak).toBe('normal');
    const all = await make('max-lines="2" word-break="break-all"', LONG, 'inline-size: 160px');
    expect(getComputedStyle(inner(all)).wordBreak).toBe('break-all');
  });
});

describe('tct-text: truncation and tooltip', () => {
  beforeAll(() => undefined);

  /** The real mouse pointer stays where the last test left it; park it in an empty corner. */
  beforeEach(async () => {
    const corner = document.createElement('div');
    corner.style.cssText =
      'position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:4px;block-size:4px';
    document.body.append(corner);
    await userEvent.hover(corner);
    corner.remove();
  });

  it('detects single-line truncation and renders the full text in a tooltip surface', async () => {
    const text = await make('max-lines="1"', LONG, 'inline-size: 120px');
    await waitUntil(() => text.truncated, 'truncated');
    expect(surface(text)).not.toBeNull();
    expect(surface(text)!.textContent.trim()).toBe(LONG);
    expect(surface(text)!.getAttribute('role')).toBe('tooltip');
    expect(inner(text).getAttribute('aria-describedby')).toBe(surface(text)!.id);
  });

  it('is not truncated, and has no tooltip, when the text fits', async () => {
    const text = await make('max-lines="1"', 'Short', 'inline-size: 400px');
    await aTimeout(50);
    expect(text.truncated).toBe(false);
    expect(surface(text)).toBeNull();
  });

  it('detects multi-line truncation, and not a block that fits exactly', async () => {
    const cut = await make('max-lines="2"', LONG.repeat(3), 'inline-size: 160px');
    await waitUntil(() => cut.truncated, 'multi-line truncated');
    const fits = await make('max-lines="6"', LONG, 'inline-size: 160px');
    await aTimeout(50);
    expect(fits.truncated).toBe(false);
  });

  it('shows the tooltip on hover with the full text, above the text, and hides it on leave', async () => {
    const text = await make('max-lines="1"', LONG, 'inline-size: 120px; margin: 80px 40px');
    await waitUntil(() => text.truncated, 'truncated');
    await userEvent.hover(text);
    await waitUntil(() => isOpen(text), 'tooltip open');
    const tip = surface(text)!.getBoundingClientRect();
    const trigger = inner(text).getBoundingClientRect();
    expect(tip.bottom).toBeLessThanOrEqual(trigger.top + 1);
    expect(surface(text)!.textContent.trim()).toBe(LONG);
    const corner = document.createElement('div');
    corner.style.cssText =
      'position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:4px;block-size:4px';
    document.body.append(corner);
    await userEvent.hover(corner);
    await waitUntil(() => !isOpen(text), 'tooltip closed');
    corner.remove();
  });

  it('no-truncate-tooltip disables the tooltip (hasTruncateTooltip={false})', async () => {
    const text = await make('max-lines="1" no-truncate-tooltip', LONG, 'inline-size: 120px');
    await waitUntil(() => text.truncated, 'truncated');
    expect(surface(text)).toBeNull();
    expect(inner(text).hasAttribute('aria-describedby')).toBe(false);
  });

  it('places the tooltip where truncate-tooltip-placement says', async () => {
    const text = await make(
      'max-lines="1" truncate-tooltip-placement="below"',
      LONG,
      'inline-size: 120px; margin: 40px',
    );
    await waitUntil(() => text.truncated, 'truncated');
    await userEvent.hover(text);
    await waitUntil(() => isOpen(text), 'tooltip open');
    expect(surface(text)!.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      inner(text).getBoundingClientRect().bottom - 1,
    );
  });

  it('Escape closes the tooltip', async () => {
    const text = await make('max-lines="1"', LONG, 'inline-size: 120px; margin: 80px 40px');
    await waitUntil(() => text.truncated, 'truncated');
    await userEvent.hover(text);
    await waitUntil(() => isOpen(text), 'tooltip open');
    await pressKeys('Escape');
    await waitUntil(() => !isOpen(text), 'tooltip closed by Escape');
  });

  it('re-measures when the space changes (the tooltip appears and disappears)', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div style="inline-size: 120px"><tct-text max-lines="1">${LONG}</tct-text></div>`,
    );
    const text = wrapper.querySelector<TctText>('tct-text')!;
    await waitUntil(() => text.truncated, 'truncated');
    wrapper.style.inlineSize = '2000px';
    await waitUntil(() => !text.truncated, 'no longer truncated');
    expect(surface(text)).toBeNull();
    wrapper.style.inlineSize = '100px';
    await waitUntil(() => text.truncated, 'truncated again');
  });

  it('re-measures when the text itself changes', async () => {
    const text = await make('max-lines="1"', 'Short', 'inline-size: 200px');
    await aTimeout(30);
    expect(text.truncated).toBe(false);
    text.textContent = LONG;
    await waitUntil(() => text.truncated, 'truncated after edit');
    expect(surface(text)!.textContent.trim()).toBe(LONG);
  });

  it('keeps the full text in the accessibility tree and passes axe with the tooltip open', async () => {
    const text = await make('max-lines="1" as="p"', LONG, 'inline-size: 120px; margin: 80px 40px');
    await waitUntil(() => text.truncated, 'truncated');
    if (isChromium) expect((await axNode(text)).role).toBe('paragraph');
    expect(text.textContent).toBe(LONG);
    await userEvent.hover(text);
    await waitUntil(() => isOpen(text), 'tooltip open');
    await expectAccessible(text);
  });

  it('the start placement flips to the physical right in right-to-left', async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div dir="rtl" style="padding: 40px 300px 40px 40px"><tct-text max-lines="1" truncate-tooltip-placement="start" style="display: block; inline-size: 120px">${LONG}</tct-text></div>`,
    );
    const text = wrapper.querySelector<TctText>('tct-text')!;
    await waitUntil(() => text.truncated, 'truncated');
    await userEvent.hover(text);
    await waitUntil(() => isOpen(text), 'tooltip open');
    expect(surface(text)!.getBoundingClientRect().left).toBeGreaterThanOrEqual(
      inner(text).getBoundingClientRect().right - 1,
    );
  });
});

describe('tct-text: RTL and forced colours', () => {
  it('logical alignment follows the direction', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div dir="rtl" style="inline-size: 300px"><tct-text display="block" justify="end">x</tct-text></div>',
      {},
    );
    const text = wrapper.querySelector<TctText>('tct-text')!;
    const rect = inner(text).getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(text);
    const glyphs = range.getBoundingClientRect();
    expect(glyphs.left).toBeLessThan(rect.left + rect.width / 2); // end in rtl is the left edge
  });

  it.skipIf(!isChromium)('renders in forced colours with its text visible', async () => {
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const text = await make('color="accent"', 'Forced');
      expect(matchMedia('(forced-colors: active)').matches).toBe(true);
      expect(inner(text).getBoundingClientRect().width).toBeGreaterThan(0);
      expect(getComputedStyle(inner(text)).color).not.toBe('rgba(0, 0, 0, 0)');
    } finally {
      await restore();
    }
  });
});
