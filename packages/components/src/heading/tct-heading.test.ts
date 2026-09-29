/**
 * tct-heading: levels and semantics, display and custom types, layout helpers and truncation
 * (ported from upstream Heading.test.tsx).
 */
import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {beforeEach, describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {waitUntil} from '@tecton-astryx/testing/timing.js';
import {HEADING_LEVELS} from './heading.types.js';
import './define.js';
import type {TctHeading} from './tct-heading.js';

const LONG = 'A very long heading that cannot possibly fit into the small space it was given here';

const inner = (heading: TctHeading): HTMLElement =>
  heading.shadowRoot!.querySelector<HTMLElement>('.text')!;
const surface = (heading: TctHeading): HTMLElement | null =>
  heading.shadowRoot!.querySelector<HTMLElement>('.tooltip-surface');

async function make(attributes = '', content = 'Title', style = ''): Promise<TctHeading> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="${style}"><tct-heading ${attributes}>${content}</tct-heading></div>`,
  );
  const heading = wrapper.querySelector<TctHeading>('tct-heading')!;
  await heading.updateComplete;
  return heading;
}

async function tokenSize(token: string): Promise<string> {
  const wrapper = await fixture<HTMLElement>('<div><span>x</span></div>');
  const probe = wrapper.firstElementChild as HTMLElement;
  probe.style.fontSize = `var(${token})`;
  return getComputedStyle(probe).fontSize;
}

runElementSuite({
  tag: 'tct-heading',
  render: () => html`<tct-heading level="2">Heading</tct-heading>`,
  properties: {
    level: 3,
    type: 'display-2',
    weight: 'bold',
    accessibilityLevel: 4,
    color: 'secondary',
    display: 'inline',
    maxLines: 2,
    justify: 'center',
    hasStrikethrough: true,
  },
  attributes: {level: 'level', type: 'type', weight: 'weight', color: 'color', display: 'display'},
});

describe('tct-heading: levels and semantics (Heading.test.tsx)', () => {
  it('renders children', async () => {
    const heading = await make('level="1"', 'Page Title');
    expect(heading.textContent).toBe('Page Title');
  });

  it.skipIf(!isChromium).each(HEADING_LEVELS)(
    'level %i is a heading of that level',
    async (level) => {
      const heading = await make(`level="${level}"`, `H${level}`);
      expect(await axNode(heading)).toMatchObject({
        role: 'heading',
        level: String(level),
        name: `H${level}`,
      });
    },
  );

  it('never writes role or aria-level attributes on the host', async () => {
    const heading = await make('level="1"', 'Title');
    expect(heading.hasAttribute('role')).toBe(false);
    expect(heading.hasAttribute('aria-level')).toBe(false);
  });

  it('supports id on the host', async () => {
    const heading = await make('level="2" id="section-title"', 'Section');
    expect(heading.id).toBe('section-title');
  });

  it.skipIf(!isChromium)(
    'accessibility-level changes the announced level, not the visual one',
    async () => {
      const heading = await make('level="2" accessibility-level="3"', 'Sidebar Section');
      expect(await axNode(heading)).toMatchObject({role: 'heading', level: '3'});
      expect(heading.level).toBe(2);
      expect(getComputedStyle(inner(heading)).fontSize).toBe(
        await tokenSize('--text-heading-2-size'),
      );
    },
  );

  it.skipIf(!isChromium)('an invalid level falls back to 2', async () => {
    const heading = await make('level="9"', 'Odd');
    expect(await axNode(heading)).toMatchObject({role: 'heading', level: '2'});
  });

  it.skipIf(!isChromium)('updates the announced level when the level changes', async () => {
    const heading = await make('level="1"', 'Title');
    heading.level = 4;
    await heading.updateComplete;
    expect(await axNode(heading)).toMatchObject({level: '4'});
    heading.accessibilityLevel = 2;
    await heading.updateComplete;
    expect(await axNode(heading)).toMatchObject({level: '2'});
  });

  it('passes axe', async () => {
    await expectAccessible(await make('level="1"', 'Page title'));
    await expectAccessible(await make('level="2" type="display-2"', 'Revenue'));
    await expectAccessible(await make('level="3" color="secondary"', 'Muted'));
  });
});

describe('tct-heading: sizing and types', () => {
  it.each(HEADING_LEVELS)(
    'level %i uses the heading tokens for size, weight and leading',
    async (level) => {
      const heading = await make(`level="${level}"`);
      const style = getComputedStyle(inner(heading));
      expect(style.fontSize).toBe(await tokenSize(`--text-heading-${level}-size`));
      expect(style.fontWeight).toBe('500');
      const probe = document.createElement('span');
      probe.style.cssText = `font-size: var(--text-heading-${level}-size); line-height: var(--text-heading-${level}-leading)`;
      heading.after(probe);
      expect(style.lineHeight).toBe(getComputedStyle(probe).lineHeight);
      probe.remove();
    },
  );

  it('follows the Tecton scale: heading 3 to 6 are large, medium, small, tiny', async () => {
    const sizes: Record<number, string> = {
      1: '24px',
      2: '20px',
      3: '16px',
      4: '14px',
      5: '12px',
      6: '10px',
    };
    for (const [level, size] of Object.entries(sizes)) {
      const heading = await make(`level="${level}"`);
      expect(getComputedStyle(inner(heading)).fontSize).toBe(size);
    }
  });

  it.each(['display-1', 'display-2', 'display-3'] as const)(
    'type %s applies the display scale and keeps the level element',
    async (type) => {
      const heading = await make(`level="1" type="${type}"`, 'Hero');
      expect(getComputedStyle(inner(heading)).fontSize).toBe(
        await tokenSize(`--text-${type}-size`),
      );
      expect(heading.getAttribute('type')).toBe(type);
      if (isChromium) expect(await axNode(heading)).toMatchObject({role: 'heading', level: '1'});
    },
  );

  it('a custom type keeps the level baseline and is reflected for theming', async () => {
    const baseline = await make('level="2"');
    const hero = await make('level="2" type="hero"', 'Custom visual role');
    expect(hero.getAttribute('type')).toBe('hero');
    expect(getComputedStyle(inner(hero)).fontSize).toBe(getComputedStyle(inner(baseline)).fontSize);
    expect(getComputedStyle(inner(hero)).fontWeight).toBe(
      getComputedStyle(inner(baseline)).fontWeight,
    );
  });

  it('an explicit weight wins over the level and the type, and is reflected', async () => {
    const heading = await make('level="2" type="hero" weight="bold"', 'Bold custom visual role');
    expect(heading.getAttribute('weight')).toBe('bold');
    expect(getComputedStyle(inner(heading)).fontWeight).toBe('600');
    const display = await make('level="1" type="display-1" weight="normal"', 'Light');
    expect(getComputedStyle(inner(display)).fontWeight).toBe('400');
  });

  it('reflects level and colour, and does not reflect an omitted type', async () => {
    const heading = await make('level="2" color="secondary"', 'Themed Heading');
    expect(heading.getAttribute('level')).toBe('2');
    expect(heading.getAttribute('color')).toBe('secondary');
    expect(heading.hasAttribute('type')).toBe(false);
  });

  it('the colour defaults to primary and every colour maps to its text role', async () => {
    const probe = await fixture<HTMLElement>('<span>x</span>');
    const role = (token: string): string => {
      probe.style.color = `var(${token})`;
      return getComputedStyle(probe).color;
    };
    expect(getComputedStyle(inner(await make())).color).toBe(role('--color-text-primary'));
    for (const [color, token] of Object.entries({
      secondary: '--color-text-secondary',
      disabled: '--color-text-disabled',
      accent: '--color-text-accent',
    })) {
      expect(getComputedStyle(inner(await make(`color="${color}"`))).color, color).toBe(
        role(token),
      );
    }
  });
});

describe('tct-heading: layout helpers', () => {
  it('is block by default, inline with display="inline", and truncation or capsize force block', async () => {
    const heading = await make();
    expect(getComputedStyle(heading).display).toBe('block');
    expect(getComputedStyle(inner(heading)).display).toBe('block');
    heading.display = 'inline';
    await heading.updateComplete;
    expect(getComputedStyle(heading).display).toBe('inline');
    expect(getComputedStyle(inner(heading)).display).toBe('inline');
    heading.maxLines = 1;
    await heading.updateComplete;
    expect(getComputedStyle(heading).display).toBe('block');
    expect(getComputedStyle(inner(heading)).display).toBe('block');
    heading.maxLines = 0;
    heading.hasCapsize = true;
    await heading.updateComplete;
    expect(getComputedStyle(heading).display).toBe('block');
    expect(getComputedStyle(inner(heading)).display).toBe('block');
  });

  it('has-strikethrough, text-wrap and justify apply', async () => {
    const heading = await make('has-strikethrough text-wrap="balance" justify="center"');
    const style = getComputedStyle(inner(heading));
    expect(style.textDecorationLine).toBe('line-through');
    expect(style.textAlign).toBe('center');
    heading.justify = 'end';
    await heading.updateComplete;
    expect(getComputedStyle(inner(heading)).textAlign).toBe('end');
  });
});

describe('tct-heading: truncation and tooltip', () => {
  beforeEach(async () => {
    const corner = document.createElement('div');
    corner.style.cssText =
      'position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:4px;block-size:4px';
    document.body.append(corner);
    await userEvent.hover(corner);
    corner.remove();
  });

  it('clamps one line with an ellipsis, detects truncation and shows the full text on hover', async () => {
    const heading = await make(
      'level="2" max-lines="1"',
      LONG,
      'inline-size: 160px; margin: 80px 40px',
    );
    const style = getComputedStyle(inner(heading));
    expect(style.textOverflow).toBe('ellipsis');
    expect(style.wordBreak).toBe('break-all');
    await waitUntil(() => heading.truncated, 'truncated');
    expect(surface(heading)!.textContent.trim()).toBe(LONG);
    await userEvent.hover(heading);
    await waitUntil(() => surface(heading)?.matches(':popover-open') === true, 'tooltip open');
  });

  it('several lines use a line clamp; the tooltip can be disabled', async () => {
    const heading = await make(
      'level="3" max-lines="2" no-truncate-tooltip',
      LONG.repeat(2),
      'inline-size: 160px',
    );
    expect(getComputedStyle(inner(heading)).getPropertyValue('-webkit-line-clamp')).toBe('2');
    await waitUntil(() => heading.truncated, 'truncated');
    expect(surface(heading)).toBeNull();
    expect(heading.hasAttribute('title')).toBe(false);
  });

  it('word-break follows the attribute and the default per line count', async () => {
    const two = await make('max-lines="2"', LONG, 'inline-size: 160px');
    expect(getComputedStyle(inner(two)).wordBreak).toBe('normal');
    const forced = await make('max-lines="1" word-break="break-word"', LONG, 'inline-size: 160px');
    expect(getComputedStyle(inner(forced)).wordBreak).toBe('normal');
  });

  it('keeps the full text in the accessibility tree while truncated', async () => {
    const heading = await make('level="2" max-lines="1"', LONG, 'inline-size: 160px');
    await waitUntil(() => heading.truncated, 'truncated');
    if (isChromium) expect(await axNode(heading)).toMatchObject({role: 'heading', name: LONG});
  });
});
