/**
 * tct-spinner: progressbar semantics and naming, sizes and shades, theming variables, reduced motion,
 * i18n (ported from upstream Spinner.test.tsx).
 */
import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {aTimeout, waitUntil} from '@tecton-astryx/testing/timing.js';
import {SPINNER_GEOMETRY, SPINNER_SHADES, SPINNER_SIZES} from './spinner.types.js';
import './define.js';
import type {TctSpinner} from './tct-spinner.js';

async function make(
  attributes = '',
  content = '',
  options: {lang?: string; dir?: 'ltr' | 'rtl'} = {},
): Promise<TctSpinner> {
  const wrapper = await fixture<HTMLElement>(
    `<div><tct-spinner ${attributes}>${content}</tct-spinner></div>`,
    options,
  );
  const spinner = wrapper.querySelector<TctSpinner>('tct-spinner')!;
  await spinner.updateComplete;
  return spinner;
}

const parts = (spinner: TctSpinner) => ({
  box: spinner.shadowRoot!.querySelector<HTMLElement>('.spinner')!,
  ring: spinner.shadowRoot!.querySelector<SVGSVGElement>('.ring')!,
  arc: spinner.shadowRoot!.querySelector<SVGCircleElement>('.arc')!,
  track: spinner.shadowRoot!.querySelector<SVGCircleElement>('.track')!,
});

runElementSuite({
  tag: 'tct-spinner',
  render: () => html`<tct-spinner></tct-spinner>`,
  properties: {size: 'xl', shade: 'subtle', label: 'Fetching'},
  attributes: {size: 'size', shade: 'shade', label: 'label'},
});

describe('tct-spinner: semantics and naming (Spinner.test.tsx)', () => {
  it.skipIf(!isChromium)(
    'is an indeterminate progress bar named "Loading" by default',
    async () => {
      const spinner = await make();
      expect(await axNode(spinner)).toMatchObject({role: 'progressbar', name: 'Loading'});
      expect(spinner.hasAttribute('role')).toBe(false);
    },
  );

  it.skipIf(!isChromium)('a visible label names it and is rendered below the ring', async () => {
    const spinner = await make('label="Fetching data"');
    expect(await axNode(spinner)).toMatchObject({role: 'progressbar', name: 'Fetching data'});
    expect(spinner.shadowRoot!.querySelector('tct-text')!.textContent).toBe('Fetching data');
    const ring = parts(spinner).box.getBoundingClientRect();
    const text = spinner.shadowRoot!.querySelector('tct-text')!.getBoundingClientRect();
    expect(text.top).toBeGreaterThanOrEqual(ring.bottom - 1);
  });

  it.skipIf(!isChromium)('an explicit aria-label wins over the label and the default', async () => {
    const spinner = await make('label="Loading..." aria-label="Please wait"');
    expect((await axNode(spinner)).name).toBe('Please wait');
  });

  it.skipIf(!isChromium)(
    'rich label content in the slot keeps the default name "Loading"',
    async () => {
      const spinner = await make('', '<span id="rich">Rich content</span>');
      expect(spinner.querySelector('#rich')!.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        parts(spinner).box.getBoundingClientRect().bottom - 1,
      );
      expect((await axNode(spinner)).name).toBe('Loading');
    },
  );

  it.skipIf(!isChromium)('the slot replaces the label text', async () => {
    const spinner = await make('label="Text label"', '<b>Slotted</b>');
    expect(spinner.textContent).toBe('Slotted');
    expect((await axNode(spinner)).name).toBe('Text label');
  });

  it('passes axe with and without a label, and in every shade', async () => {
    await expectAccessible(await make());
    await expectAccessible(await make('label="Loading data" size="lg"'));
    for (const shade of SPINNER_SHADES) await expectAccessible(await make(`shade="${shade}"`));
  });
});

describe('tct-spinner: i18n', () => {
  it.skipIf(!isChromium)('localizes the default assistive label through the catalog', async () => {
    const german = await make('', '', {lang: 'de-DE'});
    for (let attempt = 0; attempt < 60 && (await axNode(german)).name === 'Loading'; attempt++) {
      await aTimeout(50); // the German catalog loads lazily
    }
    expect((await axNode(german)).name).toBe('Wird geladen');
  });

  it.skipIf(!isChromium)('an explicit aria-label beats the localized default', async () => {
    const spinner = await make('aria-label="Veuillez patienter"', '', {lang: 'fr-FR'});
    expect((await axNode(spinner)).name).toBe('Veuillez patienter');
  });

  it('renders in right-to-left contexts', async () => {
    const spinner = await make('label="جار التحميل"', '', {lang: 'ar-SA', dir: 'rtl'});
    expect(getComputedStyle(spinner).direction).toBe('rtl');
    expect(parts(spinner).ring.getBoundingClientRect().width).toBeGreaterThan(0);
  });
});

describe('tct-spinner: sizes, shades and theming', () => {
  it.each(SPINNER_SIZES)(
    'size %s is a ring of that diameter in a box with a stroke on each side',
    async (size) => {
      const spinner = await make(`size="${size}"`);
      const {diameter, stroke} = SPINNER_GEOMETRY[size];
      const {box, ring, arc} = parts(spinner);
      expect(box.getBoundingClientRect().width).toBe(diameter + stroke * 2);
      expect(box.getBoundingClientRect().height).toBe(diameter + stroke * 2);
      expect(ring.getBoundingClientRect().width).toBe(diameter + stroke * 2);
      expect(Number.parseFloat(getComputedStyle(arc).r)).toBe(diameter / 2);
      expect(Number.parseFloat(getComputedStyle(arc).strokeWidth)).toBe(stroke);
    },
  );

  it('defaults to md and reflects size and shade', async () => {
    const spinner = await make();
    expect(spinner.getAttribute('size')).toBe('md');
    expect(spinner.getAttribute('shade')).toBe('default');
    expect(parts(spinner).box.getBoundingClientRect().width).toBe(20);
  });

  it('draws the arc over 37.5% of the circle, starting at twelve o’clock', async () => {
    const spinner = await make('size="xl"');
    const {arc} = parts(spinner);
    const [dash, gap] = getComputedStyle(arc)
      .strokeDasharray.split(',')
      .map((part) => Number.parseFloat(part));
    const circumference = Math.PI * 28;
    expect(dash! / circumference).toBeCloseTo(0.375, 2);
    expect(dash! + gap!).toBeCloseTo(circumference, 1);
    expect(getComputedStyle(arc).transform).toBe('matrix(0, -1, 1, 0, 0, 0)');
  });

  it('shades: default is the Tecton progress role, subtle secondary text, inherit the surrounding colour', async () => {
    const probe = await fixture<HTMLElement>('<span>x</span>');
    const resolved = (token: string): string => {
      probe.style.color = `var(${token})`;
      return getComputedStyle(probe).color;
    };
    expect(getComputedStyle(parts(await make()).arc).stroke).toBe(
      resolved('--tecton-color-progress-primary'),
    );
    expect(getComputedStyle(parts(await make('shade="subtle"')).arc).stroke).toBe(
      resolved('--color-text-secondary'),
    );
    expect(getComputedStyle(parts(await make('shade="on-media"')).arc).stroke).toBe(
      resolved('--color-on-dark'),
    );
    const wrapper = await fixture<HTMLElement>(
      '<div style="color: rgb(9, 8, 7)"><tct-spinner shade="inherit"></tct-spinner></div>',
    );
    const inherit = parts(wrapper.querySelector<TctSpinner>('tct-spinner')!);
    expect(getComputedStyle(inherit.arc).stroke).toBe('rgb(9, 8, 7)');
    expect(getComputedStyle(inherit.track).strokeOpacity).toBe('0.3');
  });

  it('the public custom properties re-theme the ring', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div style="--spinner-diameter: 40px; --spinner-stroke-width: 5px; --spinner-color: rgb(1, 2, 3); --spinner-track-color: transparent; --spinner-arc-fraction: 0.75"><tct-spinner size="xl"></tct-spinner></div>',
    );
    const spinner = wrapper.querySelector<TctSpinner>('tct-spinner')!;
    const {box, arc, track} = parts(spinner);
    expect(box.getBoundingClientRect().width).toBe(50);
    expect(getComputedStyle(arc).stroke).toBe('rgb(1, 2, 3)');
    expect(getComputedStyle(track).stroke).toBe('rgba(0, 0, 0, 0)');
    const [dash] = getComputedStyle(arc)
      .strokeDasharray.split(',')
      .map((part) => Number.parseFloat(part));
    expect(dash! / (Math.PI * 40)).toBeCloseTo(0.75, 2);
  });

  it('keeps its size in a narrow flex host', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div style="display: flex; inline-size: 6px"><tct-spinner size="lg"></tct-spinner></div>',
    );
    expect(
      parts(wrapper.querySelector<TctSpinner>('tct-spinner')!).box.getBoundingClientRect().width,
    ).toBe(24);
  });
});

describe('tct-spinner: motion and forced colours', () => {
  it('animates the arc and pins every ring to the timeline origin', async () => {
    const spinner = await make();
    const {arc} = parts(spinner);
    await waitUntil(
      () => arc.getAnimations().some((animation) => animation.startTime === 0),
      'pinned animation',
    );
    expect(getComputedStyle(arc).animationName).toBe('tct-dash');
    expect(getComputedStyle(arc).animationIterationCount).toBe('infinite');
  });

  it.skipIf(!isChromium)('slows down instead of stopping under reduced motion', async () => {
    const restore = await emulateMedia({reducedMotion: 'reduce'});
    try {
      const spinner = await make();
      const style = getComputedStyle(parts(spinner).arc);
      expect(style.animationName).toBe('tct-dash');
      expect(style.animationDuration).toBe('3s');
    } finally {
      await restore();
    }
  });

  it('spins in the normal duration when motion is allowed', async () => {
    const spinner = await make();
    expect(getComputedStyle(parts(spinner).arc).animationDuration).toBe('0.73s');
  });

  it.skipIf(!isChromium)('draws in forced colours', async () => {
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const spinner = await make();
      expect(getComputedStyle(parts(spinner).arc).stroke).not.toBe('none');
      expect(parts(spinner).ring.getBoundingClientRect().width).toBeGreaterThan(0);
    } finally {
      await restore();
    }
  });
});
