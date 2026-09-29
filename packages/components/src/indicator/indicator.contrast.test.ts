/**
 * D-013 Q-05: an indicator is the sole carrier of a control's state, so its boundary and fill must
 * measure >= 3:1 (WCAG 1.4.11) against the surface it sits on, in both colour modes and at rest and
 * hovered. Measured from the painted, computed colours (after `color-mix`), not from token values.
 */
import {describe, expect, it} from 'vitest';
import {fixture} from '@tecton-wc/testing/fixture.js';
import './define.js';
import type {TctCheckboxIndicator} from './tct-checkbox-indicator.js';
import type {TctRadioIndicator} from './tct-radio-indicator.js';

type Rgb = readonly [number, number, number];

/** Normalises any CSS colour (rgb(), color(srgb …), oklab …) to sRGB 0..255 through a canvas pixel. */
function toRgb(color: string): Rgb {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', {willReadFrequently: true})!;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = '#000';
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r!, g!, b!];
}

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number): number => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(toRgb(a)), luminance(toRgb(b))].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const THEMES = ['light', 'dark'] as const;

/** The surfaces an indicator sits on: the page and a card (both Tecton background roles). */
const SURFACES = ['--color-background-body', '--color-background-card'] as const;

async function mount(
  tag: 'tct-checkbox-indicator' | 'tct-radio-indicator',
  state: string,
  theme: 'light' | 'dark',
  hovered: boolean,
  surfaceToken: (typeof SURFACES)[number],
): Promise<{surface: string; paint: HTMLElement}> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="padding: 8px; background-color: var(${surfaceToken})"><${tag} state="${state}"></${tag}></div>`,
    {theme},
  );
  if (hovered) wrapper.style.setProperty('--_indicator-hover', '1');
  const host = wrapper.querySelector<TctCheckboxIndicator | TctRadioIndicator>(tag)!;
  const paint = host.shadowRoot!.querySelector<HTMLElement>('.box, .circle')!;
  return {surface: getComputedStyle(wrapper).backgroundColor, paint};
}

describe('indicator non-text contrast (D-013 Q-05)', () => {
  for (const theme of THEMES) {
    for (const hovered of [false, true]) {
      for (const surfaceToken of SURFACES) {
        const where = `${theme}${hovered ? ', hovered' : ''}, on ${surfaceToken.replace('--color-background-', '')}`;

        it(`checkbox: the unchecked border is >= 3:1 against the surface (${where})`, async () => {
          const {surface, paint} = await mount(
            'tct-checkbox-indicator',
            'unchecked',
            theme,
            hovered,
            surfaceToken,
          );
          expect(contrast(getComputedStyle(paint).borderTopColor, surface)).toBeGreaterThanOrEqual(
            3,
          );
        });

        for (const state of ['checked', 'indeterminate']) {
          it(`checkbox: the ${state} fill is >= 3:1 against the surface, and the glyph >= 3:1 against the fill (${where})`, async () => {
            const {surface, paint} = await mount(
              'tct-checkbox-indicator',
              state,
              theme,
              hovered,
              surfaceToken,
            );
            const style = getComputedStyle(paint);
            expect(contrast(style.backgroundColor, surface)).toBeGreaterThanOrEqual(3);
            const glyph = paint.querySelector<HTMLElement>(
              state === 'checked' ? '.check' : '.dash',
            )!;
            const glyphColor =
              state === 'checked'
                ? getComputedStyle(glyph).color
                : getComputedStyle(glyph).backgroundColor;
            expect(contrast(glyphColor, style.backgroundColor)).toBeGreaterThanOrEqual(3);
          });
        }

        for (const state of ['unchecked', 'checked']) {
          it(`radio: the ${state} ring is >= 3:1 against the surface (${where})`, async () => {
            const {surface, paint} = await mount(
              'tct-radio-indicator',
              state,
              theme,
              hovered,
              surfaceToken,
            );
            expect(
              contrast(getComputedStyle(paint).borderTopColor, surface),
            ).toBeGreaterThanOrEqual(3);
          });
        }

        it(`radio: the checked dot is >= 3:1 against the surface it sits on (${where})`, async () => {
          // Tecton's outlined input fill is transparent in light mode, so the dot sits on the surface.
          const {surface, paint} = await mount(
            'tct-radio-indicator',
            'checked',
            theme,
            hovered,
            surfaceToken,
          );
          const dot = paint.querySelector<HTMLElement>('.dot')!;
          expect(contrast(getComputedStyle(dot).backgroundColor, surface)).toBeGreaterThanOrEqual(
            3,
          );
        });
      }
    }
  }
});
