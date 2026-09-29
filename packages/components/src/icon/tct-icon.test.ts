/**
 * tct-icon: registry resolution, decorative vs labelled semantics (ported from upstream Icon.test.tsx),
 * sizing, colour, RTL mirroring, lazy and raw-SVG glyphs, forced colours.
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {getIcon, registerIcons, resetIcons} from '@tecton-astryx/core/icons/registry.js';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {waitUntil} from '@tecton-astryx/testing/timing.js';
import {ICON_COLORS, ICON_SIZES} from './icon.types.js';
import './define.js';
import type {TctIcon} from './tct-icon.js';

const svgOf = (icon: TctIcon): SVGSVGElement => icon.shadowRoot!.querySelector('svg')!;
const make = (attributes = 'name="check"', style = ''): Promise<TctIcon> =>
  fixture<HTMLElement>(`<div style="${style}"><tct-icon ${attributes}></tct-icon></div>`).then(
    (wrapper) => wrapper.querySelector<TctIcon>('tct-icon')!,
  );

runElementSuite({
  tag: 'tct-icon',
  render: () => html`<tct-icon name="search"></tct-icon>`,
  properties: {name: 'check', color: 'accent', size: 'lg', label: 'Done'},
  attributes: {name: 'name', color: 'color', size: 'size', label: 'label'},
});

describe('tct-icon: rendering (Icon.test.tsx)', () => {
  it('renders the registered glyph as an svg with a viewBox', async () => {
    const icon = await make();
    const svg = svgOf(icon);
    expect(svg).toBeInstanceOf(SVGSVGElement);
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('registers the built-in set as the default layer on first connect, consumer registrations win', async () => {
    registerIcons({check: {viewBox: '0 0 8 8', paths: [{d: 'M0 0h8v8z'}], mode: 'fill'}});
    const icon = await make();
    expect(svgOf(icon).getAttribute('viewBox')).toBe('0 0 8 8');
    expect(getIcon('close')).toBeDefined();
  });

  it('renders nothing for an unregistered name', async () => {
    const icon = await make('name="numberInput:missing"');
    expect(svgOf(icon)).toBeNull();
    expect(icon.getBoundingClientRect().width).toBe(0);
  });

  it('renders the default slot as the fallback for an unregistered name', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><tct-icon name="nope"><svg id="own" viewBox="0 0 4 4"><path d="M0 0h4v4z"/></svg></tct-icon></div>',
    );
    const icon = wrapper.querySelector<TctIcon>('tct-icon')!;
    expect(svgOf(icon)).toBeNull();
    const own = icon.querySelector('svg')!;
    expect(own.getBoundingClientRect().width).toBe(20);
  });

  it('resolves a namespaced key registered after the icon rendered', async () => {
    const icon = await make('name="numberInput:stepperDown"');
    expect(svgOf(icon)).not.toBeNull(); // the default set carries it
    const ns = await make('name="richtext:bold"');
    expect(svgOf(ns)).toBeNull();
    registerIcons({'richtext:bold': {viewBox: '0 0 4 4', paths: [{d: 'M0 0h4v4z'}], mode: 'fill'}});
    await ns.updateComplete;
    expect(svgOf(ns)).not.toBeNull();
  });

  it('loads lazy glyphs (the Tecton domain set) on demand', async () => {
    const icon = await make('name="well"');
    await waitUntil(() => svgOf(icon) !== null, 'well glyph');
    expect(svgOf(icon).querySelectorAll('path').length).toBeGreaterThan(0);
    const filled = await make('name="well-filled"');
    await waitUntil(() => svgOf(filled) !== null, 'well-filled glyph');
  });

  it('sanitises a raw svg body once and clones it per instance (strata keeps its colours)', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><tct-icon name="strata"></tct-icon><tct-icon name="strata"></tct-icon></div>',
    );
    const [a, b] = [...wrapper.querySelectorAll<TctIcon>('tct-icon')] as [TctIcon, TctIcon];
    await waitUntil(() => svgOf(a) && svgOf(b) && svgOf(a).querySelector('path'), 'strata');
    await waitUntil(
      () =>
        new Set([...svgOf(a).querySelectorAll('path')].map((p) => p.getAttribute('fill'))).size > 1,
      'strata raw body',
    );
    const pathsA = [...svgOf(a).querySelectorAll('path')];
    const pathsB = [...svgOf(b).querySelectorAll('path')];
    expect(pathsA.length).toBeGreaterThan(1);
    expect(pathsA[0]).not.toBe(pathsB[0]);
    expect(svgOf(a).querySelector('script, foreignObject, style')).toBeNull();
  });

  it('does not run script from a hostile raw svg body', async () => {
    (globalThis as Record<string, unknown>).__iconXss = false;
    registerIcons({
      evil: {
        viewBox: '0 0 4 4',
        paths: [{d: 'M0 0h4v4z'}],
        mode: 'fill',
        svg: '<path d="M0 0h4v4z" onclick="globalThis.__iconXss=true"/><script>globalThis.__iconXss=true</script><foreignObject><div>x</div></foreignObject>',
      },
    });
    const icon = await make('name="evil"');
    await waitUntil(() => svgOf(icon)?.querySelector('path[d]'), 'evil');
    await new Promise((resolve) => setTimeout(resolve, 100));
    const svg = svgOf(icon);
    expect(svg.querySelector('script, foreignObject')).toBeNull();
    expect(svg.querySelector('[onclick]')).toBeNull();
    expect((globalThis as Record<string, unknown>).__iconXss).toBe(false);
  });

  it('applies stroke mode with the definition width, overridable through --icon-stroke-width', async () => {
    const icon = await make('name="check"');
    const svg = svgOf(icon);
    expect(getComputedStyle(svg).fill).toBe('none');
    expect(getComputedStyle(svg).strokeWidth).toBe('2px');
    icon.style.setProperty('--icon-stroke-width', '1.25');
    expect(getComputedStyle(svg).strokeWidth).toBe('1.25px');
  });

  it('keeps the svg decorative and unfocusable', async () => {
    const icon = await make();
    expect(svgOf(icon).getAttribute('aria-hidden')).toBe('true');
    expect(svgOf(icon).getAttribute('focusable')).toBe('false');
  });
});

describe('tct-icon: sizes and colours', () => {
  const PX = {xsm: 12, sm: 16, md: 20, lg: 24} as const;

  it.each(ICON_SIZES)(
    'size %s draws the Tecton icon size (svg box and font size)',
    async (size) => {
      const icon = await make(`name="check" size="${size}"`);
      const svg = svgOf(icon);
      expect(getComputedStyle(svg).width).toBe(`${PX[size]}px`);
      expect(getComputedStyle(svg).height).toBe(`${PX[size]}px`);
      expect(getComputedStyle(icon).fontSize).toBe(`${PX[size]}px`);
    },
  );

  it('defaults to md when standalone', async () => {
    const icon = await make();
    expect(getComputedStyle(svgOf(icon)).width).toBe('20px');
  });

  it('takes the size an owning component supplies through --_icon-size; an explicit size wins', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div style="--_icon-size: 32px"><tct-icon id="ctx" name="check"></tct-icon><tct-icon id="own" name="check" size="sm"></tct-icon></div>',
    );
    const ctx = wrapper.querySelector<TctIcon>('#ctx')!;
    const own = wrapper.querySelector<TctIcon>('#own')!;
    expect(getComputedStyle(svgOf(ctx)).width).toBe('32px');
    expect(getComputedStyle(svgOf(own)).width).toBe('16px');
  });

  it('sizes a slotted custom svg', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div><tct-icon size="lg"><svg viewBox="0 0 4 4"><path d="M0 0h4v4z"/></svg></tct-icon></div>',
    );
    expect(wrapper.querySelector('svg')!.getBoundingClientRect().width).toBe(24);
  });

  it('inherits the surrounding colour by default and maps every variant to an icon role', async () => {
    const probe = document.createElement('span');
    document.body.append(probe);
    try {
      const icon = await make('name="check"', 'color: rgb(1, 2, 3)');
      expect(getComputedStyle(icon).color).toBe('rgb(1, 2, 3)');
      const roles: Partial<Record<(typeof ICON_COLORS)[number], string>> = {
        primary: '--color-icon-primary',
        secondary: '--color-icon-secondary',
        tertiary: '--color-icon-secondary',
        disabled: '--color-icon-disabled',
        accent: '--color-icon-accent',
        success: '--color-success',
        error: '--color-error',
        warning: '--color-warning',
        blue: '--color-icon-blue',
        purple: '--color-icon-purple',
      };
      for (const [color, token] of Object.entries(roles)) {
        icon.color = color as (typeof ICON_COLORS)[number];
        await icon.updateComplete;
        probe.style.color = `var(${token})`;
        expect(getComputedStyle(icon).color, color).toBe(getComputedStyle(probe).color);
      }
      for (const color of ICON_COLORS) {
        icon.color = color;
        await icon.updateComplete;
        expect(icon.getAttribute('color')).toBe(color);
      }
    } finally {
      probe.remove();
    }
  });
});

describe('tct-icon: label (accessible name)', () => {
  it.skipIf(!isChromium)(
    'is decorative by default: hidden from the accessibility tree',
    async () => {
      const icon = await make();
      expect(icon.getAttribute('aria-hidden')).toBeNull();
      expect(await axNode(icon)).toMatchObject({ignored: 'true'});
    },
  );

  it.skipIf(!isChromium)(
    'a label makes it a meaningful image: role img with that name',
    async () => {
      const icon = await make('name="check" label="Completed"');
      expect(await axNode(icon)).toMatchObject({role: 'image', name: 'Completed'});
      expect(icon.getAttribute('role')).toBeNull();
      await expectAccessible(icon);
    },
  );

  it.skipIf(!isChromium)('an empty label is decorative', async () => {
    const icon = await make('name="check" label=""');
    expect(await axNode(icon)).toMatchObject({ignored: 'true'});
  });

  it.skipIf(!isChromium)('an explicit aria-hidden wins over label', async () => {
    const icon = await make('name="check" label="Close" aria-hidden="true"');
    expect(await axNode(icon)).toMatchObject({ignored: 'true'});
  });

  it.skipIf(!isChromium)('an explicit aria-label overrides the label-derived name', async () => {
    const icon = await make('name="check" label="Close" aria-label="Dismiss"');
    expect(await axNode(icon)).toMatchObject({role: 'image', name: 'Dismiss'});
  });

  it.skipIf(!isChromium)('an explicit role overrides the label-derived role', async () => {
    const icon = await make('name="check" label="Close" role="presentation"');
    expect((await axNode(icon)).role).not.toBe('image');
  });

  it.skipIf(!isChromium)(
    'an icon can be made meaningful with role, aria-label and aria-hidden=false',
    async () => {
      const icon = await make('name="check" role="img" aria-label="Done" aria-hidden="false"');
      expect(await axNode(icon)).toMatchObject({role: 'image', name: 'Done'});
    },
  );

  it('passes axe decorative and labelled, on a surface with real tokens', async () => {
    const decorative = await make('name="search"');
    await expectAccessible(decorative);
    const labelled = await make('name="success" label="Saved" color="success"');
    await expectAccessible(labelled);
  });
});

describe('tct-icon: RTL and forced colours', () => {
  it('mirrors directional glyphs in right-to-left contexts only', async () => {
    const ltr = await fixture<HTMLElement>(
      '<div dir="ltr"><tct-icon name="chevronRight"></tct-icon></div>',
    );
    const rtl = await fixture<HTMLElement>(
      '<div dir="rtl"><tct-icon name="chevronRight"></tct-icon></div>',
    );
    const scale = (root: HTMLElement) =>
      getComputedStyle(svgOf(root.querySelector<TctIcon>('tct-icon')!)).scale;
    expect(scale(ltr)).toBe('none');
    expect(scale(rtl)).toBe('-1 1');
    const plain = await fixture<HTMLElement>(
      '<div dir="rtl"><tct-icon name="search"></tct-icon></div>',
    );
    expect(scale(plain)).toBe('none');
  });

  it.skipIf(!isChromium)(
    'draws in forced colours with a system colour, not transparent',
    async () => {
      const restore = await emulateMedia({forcedColors: 'active'});
      try {
        const icon = await make('name="check" color="accent"');
        const style = getComputedStyle(svgOf(icon));
        expect(style.stroke).not.toBe('none');
        expect(style.stroke).not.toBe('rgba(0, 0, 0, 0)');
        expect(style.display).toBe('block');
      } finally {
        await restore();
      }
    },
  );
});

it('registry reset: the built-in set is registered again for the next icon', async () => {
  await make();
  resetIcons();
  const icon = await make('name="close"');
  expect(svgOf(icon)).not.toBeNull();
});
