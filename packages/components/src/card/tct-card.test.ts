/**
 * tct-card: variants, elevation, padding and the border-inside-padding rule, scrolling with a fixed
 * height (ported from upstream Card.test.tsx), published container padding, RTL, forced colours.
 */
import {html} from 'lit';
import {describe, expect, it, onTestFinished} from 'vitest';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import {defineTheme} from '@tecton-wc/core/theme/define-theme.js';
import {generateThemeCSS} from '@tecton-wc/core/theme/generate-theme-rules.js';
import {CARD_ELEVATIONS, CARD_VARIANTS} from './card.types.js';
import './define.js';
import type {TctCard} from './tct-card.js';

const baseOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const css = (element: Element) => getComputedStyle(baseOf(element));

async function card(attributes = '', content = '<p>Content</p>') {
  const root = await fixture<HTMLElement>(
    `<div style="inline-size: 300px"><tct-card ${attributes}>${content}</tct-card></div>`,
  );
  return root.querySelector<TctCard>('tct-card')!;
}

/** Resolves a token on the document, so tests compare against the real Tecton value. */
const token = (name: string): string => {
  const probe = document.createElement('div');
  probe.style.backgroundColor = `var(${name})`;
  document.body.append(probe);
  const value = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return value;
};

runElementSuite({
  tag: 'tct-card',
  render: () => html`<tct-card padding="2"><p>content</p></tct-card>`,
  properties: {variant: 'muted', elevation: 'low', padding: 3, width: 200},
  attributes: {variant: 'variant', elevation: 'elevation'},
});

describe('tct-card (Card.test.tsx)', () => {
  it('renders children', async () => {
    const element = await card('', '<b id="c">Card content</b>');
    expect(element.querySelector('#c')!.textContent).toBe('Card content');
    expect(element.shadowRoot!.querySelector('slot')!.assignedElements()).toHaveLength(1);
    expect(baseOf(element).contains(element.shadowRoot!.querySelector('slot'))).toBe(true);
  });

  it('carries the theming target as part "base", with the content inside it', async () => {
    const element = await card();
    expect(baseOf(element).getAttribute('part')).toBe('base');
    expect(getComputedStyle(element).backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('passes unknown attributes through on the host', async () => {
    const element = await card('id="c1" data-testid="card" aria-label="Profile"');
    expect(element.id).toBe('c1');
    expect(element.getAttribute('data-testid')).toBe('card');
  });

  it('reflects variant and elevation, defaulting to the default variant at rest elevation', async () => {
    const element = await card();
    expect(element.variant).toBe('default');
    expect(element.elevation).toBe('none');
    expect(element.getAttribute('variant')).toBe('default');
    expect(element.getAttribute('elevation')).toBe('none');
    element.variant = 'muted';
    element.elevation = 'high';
    await element.updateComplete;
    expect(element.getAttribute('variant')).toBe('muted');
    expect(element.getAttribute('elevation')).toBe('high');
  });

  it('applies a distinct shadow for each elevation level', async () => {
    const shadows = new Set<string>();
    for (const elevation of CARD_ELEVATIONS) {
      const element = await card(`elevation="${elevation}"`);
      const shadow = css(element).boxShadow;
      shadows.add(shadow);
      if (elevation === 'none') {
        expect(shadow).toBe('rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px');
      } else {
        expect(shadow).not.toBe(css(await card()).boxShadow);
      }
    }
    expect(shadows.size).toBe(CARD_ELEVATIONS.length);
  });

  it('elevation uses the shadow tokens', async () => {
    const element = await card('elevation="med"');
    const probe = document.createElement('div');
    probe.style.boxShadow = 'var(--shadow-med)';
    document.body.append(probe);
    const expected = getComputedStyle(probe).boxShadow;
    probe.remove();
    expect(css(element).boxShadow).toContain(expected);
  });

  it('accepts exactly the thirteen built-in variants, each reflected and painted', async () => {
    expect(CARD_VARIANTS).toHaveLength(13);
    const backgrounds = new Map<string, string>();
    for (const variant of CARD_VARIANTS) {
      const element = await card(`variant="${variant}"`);
      expect(element.getAttribute('variant')).toBe(variant);
      backgrounds.set(variant, css(element).backgroundColor);
    }
    expect(backgrounds.get('default')).toBe(token('--color-background-card'));
    expect(backgrounds.get('muted')).toBe(token('--color-background-muted'));
    expect(backgrounds.get('transparent')).toBe('rgba(0, 0, 0, 0)');
    for (const colour of [
      'blue',
      'cyan',
      'gray',
      'green',
      'orange',
      'pink',
      'purple',
      'red',
      'teal',
      'yellow',
    ]) {
      expect(backgrounds.get(colour), colour).toBe(token(`--color-background-${colour}`));
    }
  });

  it('draws the border only on the default variant', async () => {
    const withBorder = await card();
    expect(css(withBorder).borderTopWidth).toBe('1px');
    expect(css(withBorder).borderTopColor).toBe(token('--color-border'));
    for (const variant of ['transparent', 'muted', 'blue']) {
      expect(css(await card(`variant="${variant}"`)).borderTopWidth).toBe('0px');
    }
  });

  it('rounds the corners with the container radius and clips the content', async () => {
    const element = await card();
    expect(css(element).borderTopLeftRadius).toBe('8px');
    expect(css(element).overflowX).toBe('clip');
  });

  describe('a variant a theme added', () => {
    it('renders the selector a theme rule needs', async () => {
      const element = await card('variant="brand"');
      expect(element.getAttribute('variant')).toBe('brand');
      expect(baseOf(element).dataset.variant).toBe('brand');
    });

    it('falls through to base styles instead of another variant, and a theme rule paints it', async () => {
      const element = await card('variant="brand"');
      expect(css(element).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(css(element).borderTopWidth).toBe('0px');
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(
        'tct-card[variant="brand"]::part(base) { background-color: rgb(1, 2, 3); }',
      );
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      try {
        expect(css(element).backgroundColor).toBe('rgb(1, 2, 3)');
      } finally {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
      }
    });
  });
});

describe('tct-card: padding and sizes', () => {
  const insets = (element: Element) => {
    const style = css(element);
    return [
      style.paddingInlineStart,
      style.paddingInlineEnd,
      style.paddingBlockStart,
      style.paddingBlockEnd,
    ].map(parseFloat);
  };

  it('pads to spacing step 4 by default, with the border inside it', async () => {
    const element = await card();
    // 16px asked for = 1px border + 15px padding.
    expect(insets(element)).toEqual([15, 15, 15, 15]);
    const box = baseOf(element).getBoundingClientRect();
    const content = element.querySelector('p')!.getBoundingClientRect();
    expect(Math.round(content.left - box.left)).toBe(16);
  });

  it('borderless variants pad the full step', async () => {
    expect(insets(await card('variant="muted"'))).toEqual([16, 16, 16, 16]);
  });

  it('applies an explicit padding step, zero included', async () => {
    expect(insets(await card('variant="muted" padding="2"'))).toEqual([8, 8, 8, 8]);
    expect(insets(await card('variant="muted" padding="0"'))).toEqual([0, 0, 0, 0]);
    // A padding smaller than the border never goes negative.
    expect(insets(await card('padding="0"'))).toEqual([0, 0, 0, 0]);
    expect(insets(await card('padding="6"'))).toEqual([23, 23, 23, 23]);
  });

  it('most specific padding wins per edge', async () => {
    expect(
      insets(await card('variant="muted" padding="1" padding-inline="4" padding-block-start="8"')),
    ).toEqual([16, 16, 32, 4]);
  });

  it('takes the theme padding from --card-padding and its directional overrides', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 300px; --card-padding: 20px; --card-padding-inline: 30px; --card-padding-block-end: 10px">
        <tct-card variant="muted"><p>x</p></tct-card></div>`,
    );
    expect(insets(root.querySelector('tct-card')!)).toEqual([30, 30, 20, 10]);
  });

  it('an explicit padding attribute beats the theme custom properties', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="inline-size: 300px; --card-padding: 20px"><tct-card variant="muted" padding="1"><p>x</p></tct-card></div>`,
    );
    expect(insets(root.querySelector('tct-card')!)).toEqual([4, 4, 4, 4]);
  });

  it('publishes its padding as container and layout custom properties for descendants', async () => {
    const element = await card('padding="6"');
    const style = css(element);
    expect(style.getPropertyValue('--container-padding-inline-start').trim()).toBe('24px');
    expect(style.getPropertyValue('--container-padding-block-end').trim()).toBe('24px');
    expect(style.getPropertyValue('--layout-padding-outer-x').trim()).toBe('24px');
  });

  it('applies width, height, max-width and min-height', async () => {
    const element = await card('width="200" height="120"');
    expect(element.getBoundingClientRect().width).toBe(200);
    expect(element.getBoundingClientRect().height).toBe(120);
    const capped = await card('max-width="150" min-height="90"');
    expect(capped.getBoundingClientRect().width).toBe(150);
    expect(capped.getBoundingClientRect().height).toBeGreaterThanOrEqual(90);
    const strings = await card('width="50%" height="5rem"');
    expect(strings.getBoundingClientRect().width).toBe(150);
    expect(strings.getBoundingClientRect().height).toBe(80);
  });

  it('a card with a fixed height scrolls its content, and one with auto height does not', async () => {
    const tall = '<div style="block-size: 400px">tall</div>';
    const fixed = await card('height="100"', tall);
    expect(css(fixed).overflowY).toBe('auto');
    expect(baseOf(fixed).scrollHeight).toBeGreaterThan(baseOf(fixed).clientHeight);
    expect(css(await card('height="auto"', tall)).overflowY).toBe('clip');
    expect(css(await card('', tall)).overflowY).toBe('clip');
  });

  it('a percentage height resolves against the parent', async () => {
    const root = await fixture<HTMLElement>(
      '<div style="block-size: 250px"><tct-card height="100%"><p>x</p></tct-card></div>',
    );
    expect(root.querySelector('tct-card')!.getBoundingClientRect().height).toBe(250);
  });

  it('composes an inset ring with the elevation through --_card-ring', async () => {
    const root = await fixture<HTMLElement>(
      '<tct-card elevation="low" style="--_card-ring: inset 0 0 0 2px rgb(9, 8, 7)"><p>x</p></tct-card>',
    );
    const shadow = css(root).boxShadow;
    expect(shadow).toContain('rgb(9, 8, 7)');
    expect(shadow.match(/rgb/g)!.length).toBeGreaterThanOrEqual(2);
  });

  it('a nested card does not inherit its parent padding', async () => {
    const root = await fixture<HTMLElement>(
      '<tct-card variant="muted" padding="8"><tct-card id="inner" variant="muted">x</tct-card></tct-card>',
    );
    expect(parseFloat(css(root.querySelector('#inner')!).paddingInlineStart)).toBe(16);
  });
});

describe('tct-card: accessibility, RTL, forced colours', () => {
  it('adds no semantics of its own and passes axe in every variant', async () => {
    for (const variant of ['default', 'muted', 'blue', 'transparent']) {
      await expectAccessible(await card(`variant="${variant}"`, '<h3>Title</h3><p>Body</p>'));
    }
    await expectAccessible(
      await card('elevation="high" padding="0"', '<button type="button">Go</button>'),
    );
  });

  it('padding-inline-start pads the right edge in RTL', async () => {
    const root = await fixture<HTMLElement>(
      '<div style="inline-size: 300px"><tct-card variant="muted" padding-inline-start="8"><p>x</p></tct-card></div>',
      {dir: 'rtl'},
    );
    const style = css(root.querySelector('tct-card')!);
    expect(style.paddingRight).toBe('32px');
    expect(style.paddingLeft).toBe('16px');
  });

  it.skipIf(!isChromium)(
    'keeps its edge visible in forced-colors mode, even without a border',
    async () => {
      await emulateMedia({forcedColors: 'active'});
      for (const variant of ['default', 'muted']) {
        const element = await card(`variant="${variant}"`);
        expect(css(element).borderTopWidth).toBe('1px');
        expect(css(element).borderTopStyle).toBe('solid');
        // Border plus padding still equals the padding asked for.
        expect(parseFloat(css(element).paddingInlineStart)).toBe(15);
      }
      await expectAccessible(await card());
    },
  );
});

describe('tct-card with a generated theme (--card-padding* from generateThemeCSS)', () => {
  async function themedCard(
    components: Parameters<typeof defineTheme>[0]['components'],
    attributes = '',
  ) {
    const {component} = generateThemeCSS(defineTheme({name: 'card-fixture', components}));
    const style = document.createElement('style');
    style.textContent = component;
    document.head.append(style);
    onTestFinished(() => style.remove());
    const root = await fixture<HTMLElement>(
      `<div data-tct-theme="card-fixture" style="inline-size: 300px"><tct-card variant="transparent" ${attributes}><p>Content</p></tct-card></div>`,
    );
    return css(root.querySelector('tct-card')!);
  }

  it('reads a themed uniform padding through the public property', async () => {
    const style = await themedCard({card: {base: {padding: '20px'}}});
    expect(style.paddingBlockStart).toBe('20px');
    expect(style.paddingInlineStart).toBe('20px');
    expect(style.paddingBlockEnd).toBe('20px');
    expect(style.paddingInlineEnd).toBe('20px');
  });

  it('reads themed directional padding, logical edges only', async () => {
    const style = await themedCard({
      card: {base: {paddingBlock: '8px', paddingInlineStart: '24px'}},
    });
    expect(style.paddingBlockStart).toBe('8px');
    expect(style.paddingBlockEnd).toBe('8px');
    expect(style.paddingInlineStart).toBe('24px');
  });

  it('lets a padding attribute win over the theme', async () => {
    const style = await themedCard({card: {base: {padding: '20px'}}}, 'padding="2"');
    // padding step 2 is the second rung of the spacing scale: 8px in Tecton
    expect(style.paddingBlockStart).toBe('8px');
  });
});

describe('tct-card: keyboard access to a scrolling card', () => {
  const long = '<div style="block-size: 600px">tall</div>';

  it('makes a fixed-height card with overflowing content focusable', async () => {
    const element = await card('height="120"', long);
    await waitUntil(() => baseOf(element).getAttribute('tabindex') === '0', 'tabindex applied');
    await expectAccessible(element.parentElement!);
  });

  it('gives no tab stop when the content fits or the height is not fixed', async () => {
    const fits = await card('height="300"', '<span>short</span>');
    expect(baseOf(fits).hasAttribute('tabindex')).toBe(false);
    const grows = await card('', long);
    expect(baseOf(grows).hasAttribute('tabindex')).toBe(false);
  });

  it('leaves the tab stop to focusable content', async () => {
    const element = await card('height="120"', `${long}<button>Act</button>`);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(baseOf(element).hasAttribute('tabindex')).toBe(false);
  });
});
