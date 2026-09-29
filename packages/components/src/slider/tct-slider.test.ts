/**
 * tct-slider: the element and form-control suites, then rendering (single and range), keyboard, pointer, marks,
 * value text (localised), FormData, disabled and read-only, status, RTL, vertical, forced colours, axe and
 * i18n. Ported from upstream Slider.test.tsx where the behaviour applies.
 */
import {html} from 'lit';
import {page, userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {formHarness, hasCustomState} from '@tecton-wc/testing/forms.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-wc/testing/suites/form-control.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../field/define.js';
import '../form-layout/define.js';
import '../tooltip/define.js';
import './define.js';
import {clamp, parseValues, percentOf, snapToStep} from './slider.types.js';
import type {TctSlider} from './tct-slider.js';

const thumbs = (slider: TctSlider): HTMLElement[] => [
  ...slider.shadowRoot!.querySelectorAll<HTMLElement>('.thumb'),
];
const thumb = (slider: TctSlider, index = 0): HTMLElement => thumbs(slider)[index]!;
const track = (slider: TctSlider): HTMLElement =>
  slider.shadowRoot!.querySelector<HTMLElement>('.track')!;
const part = (slider: TctSlider, name: string): HTMLElement | null =>
  slider.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`);

async function make(
  attributes = 'label="Volume"',
  lang?: string,
  dir?: string,
): Promise<TctSlider> {
  const wrapper = await fixture<HTMLElement>(
    `<div ${lang ? `lang="${lang}"` : ''} ${dir ? `dir="${dir}"` : ''} style="padding:60px 40px;inline-size:420px"><tct-slider ${attributes}></tct-slider></div>`,
  );
  const slider = wrapper.querySelector<TctSlider>('tct-slider')!;
  await slider.updateComplete;
  await nextFrame();
  return slider;
}

/** Where the thumb's centre sits for `fraction` (0 to 1) along a horizontal, left-to-right track. */
function pointAt(slider: TctSlider, fraction: number, rtl = false): {x: number; y: number} {
  const rect = track(slider).getBoundingClientRect();
  const offset = 10 + fraction * (rect.width - 20);
  return {x: rtl ? rect.right - offset : rect.left + offset, y: rect.top + rect.height / 2};
}

function pointer(target: Element, type: string, x: number, y: number): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      clientX: x,
      clientY: y,
      pointerId: 7,
      button: 0,
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  );
}

runElementSuite({
  tag: 'tct-slider',
  render: () => html`<tct-slider label="Volume" name="v"></tct-slider>`,
  properties: {
    label: 'Other',
    description: 'Help',
    min: 10,
    max: 50,
    step: 5,
    orientation: 'vertical',
    range: true,
    minStepsBetweenThumbs: 2,
    valueDisplay: 'text',
    loading: true,
    width: 200,
  },
  attributes: {
    label: 'label',
    description: 'description',
    min: 'min',
    max: 'max',
    step: 'step',
    orientation: 'orientation',
    range: 'range',
    minStepsBetweenThumbs: 'min-steps-between-thumbs',
    valueDisplay: 'value-display',
  },
});

runFormControlSuite({
  tag: 'tct-slider',
  render: (attributes) => `<tct-slider label="Field" ${attributes}></tct-slider>`,
  validValue: '40',
  required: false,
  readonly: true,
  labelActivation: false,
  userEdit: async (element) => {
    const slider = element as unknown as TctSlider;
    const target = thumb(slider);
    target.focus();
    await pressKeys('ArrowRight');
  },
});

describe('slider maths', () => {
  it('snaps to the step from min without floating-point error', () => {
    expect(snapToStep(0.30000000000000004, 0, 0.1)).toBe(0.3);
    expect(snapToStep(7, 0, 5)).toBe(5);
    expect(snapToStep(8, 0, 5)).toBe(10);
    expect(snapToStep(3, 1, 2)).toBe(3);
    expect(clamp(12, 0, 10)).toBe(10);
    expect(percentOf(25, 0, 100)).toBe(25);
    expect(percentOf(5, 5, 5)).toBe(0);
    expect(parseValues('20, 80')).toEqual([20, 80]);
    expect(parseValues('50 x')).toEqual([50]);
  });
});

describe('tct-slider: rendering', () => {
  it('a single thumb is a slider named by the label with its range and value', async () => {
    const slider = await make('label="Volume" value="40" description="Master volume"');
    const target = thumb(slider);
    expect(target.getAttribute('role')).toBe('slider');
    expect(target.getAttribute('aria-valuemin')).toBe('0');
    expect(target.getAttribute('aria-valuemax')).toBe('100');
    expect(target.getAttribute('aria-valuenow')).toBe('40');
    expect(target.getAttribute('aria-orientation')).toBe('horizontal');
    expect(target.tabIndex).toBe(0);
    if (isChromium) {
      const node = await axNode(target);
      expect(node.role).toBe('slider');
      expect(node.name).toContain('Volume');
      expect(node.description).toContain('Master volume');
    }
  });

  it('defaults: min 0, max 100, step 1, value at the minimum, valueDisplay tooltip', async () => {
    const slider = await make('label="Volume"');
    expect(thumb(slider).getAttribute('aria-valuenow')).toBe('0');
    expect(slider.value).toBe('0');
    expect(slider.valueAsNumber).toBe(0);
    expect(slider.valueDisplay).toBe('tooltip');
    expect(part(slider, 'bubble')!.textContent).toBe('0');
  });

  it('a range is a group named by the label with two named thumbs', async () => {
    const slider = await make('label="Price range" range value="20,80"');
    expect(track(slider).getAttribute('role')).toBe('group');
    expect(track(slider).getAttribute('aria-labelledby')).toBeTruthy();
    const [low, high] = thumbs(slider);
    expect(low!.getAttribute('aria-label')).toBe('Minimum value');
    expect(high!.getAttribute('aria-label')).toBe('Maximum value');
    expect(low!.getAttribute('aria-valuenow')).toBe('20');
    expect(high!.getAttribute('aria-valuenow')).toBe('80');
    expect(slider.values).toEqual([20, 80]);
    expect(slider.value).toBe('20,80');
    if (isChromium) {
      const node = await axNode(track(slider));
      expect(node.role).toBe('group');
      expect(node.name).toContain('Price range');
    }
  });

  it('a range without a value spans min to max', async () => {
    const slider = await make('label="Price range" range min="10" max="50"');
    expect(slider.values).toEqual([10, 50]);
  });

  it('clamps a value to the range, and reads value and values both ways', async () => {
    const slider = await make('label="Volume" min="10" max="20" value="500"');
    expect(slider.valueAsNumber).toBe(20);
    slider.value = '5';
    expect(slider.valueAsNumber).toBe(10);
    slider.values = [15];
    expect(slider.value).toBe('15');
    slider.valueAsNumber = 12;
    expect(slider.value).toBe('12');
  });

  it('the fill and the thumb sit on the thumb travel: at min and max the thumb stays inside the track', async () => {
    const slider = await make('label="Volume" value="0"');
    const rect = track(slider).getBoundingClientRect();
    let box = thumb(slider).getBoundingClientRect();
    expect(Math.round(box.left)).toBe(Math.round(rect.left));
    slider.value = '100';
    await slider.updateComplete;
    box = thumb(slider).getBoundingClientRect();
    expect(Math.round(box.right)).toBe(Math.round(rect.right));
    slider.value = '50';
    await slider.updateComplete;
    const middle = thumb(slider).getBoundingClientRect();
    expect(Math.round(middle.left + middle.width / 2)).toBe(Math.round(rect.left + rect.width / 2));
    const fill = part(slider, 'fill')!.getBoundingClientRect();
    expect(Math.round(fill.right)).toBe(Math.round(middle.left + middle.width / 2));
  });

  it('a range fills between its thumbs', async () => {
    const slider = await make('label="Price" range value="25,75"');
    const fill = part(slider, 'fill')!.getBoundingClientRect();
    const [low, high] = thumbs(slider).map((el) => el.getBoundingClientRect());
    expect(Math.round(fill.left)).toBe(Math.round(low!.left + low!.width / 2));
    expect(Math.round(fill.right)).toBe(Math.round(high!.left + high!.width / 2));
  });

  it('a vertical slider puts the minimum at the bottom and the maximum at the top', async () => {
    const slider = await make('label="Volume" orientation="vertical" value="0"');
    const rect = track(slider).getBoundingClientRect();
    expect(rect.height).toBeGreaterThan(rect.width);
    expect(thumb(slider).getAttribute('aria-orientation')).toBe('vertical');
    let box = thumb(slider).getBoundingClientRect();
    expect(Math.round(box.bottom)).toBe(Math.round(rect.bottom));
    slider.value = '100';
    await slider.updateComplete;
    box = thumb(slider).getBoundingClientRect();
    expect(Math.round(box.top)).toBe(Math.round(rect.top));
  });

  it('draws the accent on the fill and the thumb, and the muted track behind', async () => {
    const slider = await make('label="Volume" value="40"');
    expect(getComputedStyle(part(slider, 'fill')!).backgroundColor).toBe(
      getComputedStyle(thumb(slider)).backgroundColor,
    );
    expect(getComputedStyle(part(slider, 'track')!).backgroundColor).not.toBe(
      getComputedStyle(part(slider, 'fill')!).backgroundColor,
    );
    expect(thumb(slider).getBoundingClientRect().width).toBe(20);
  });
});

describe('tct-slider: keyboard', () => {
  it('arrows step, Page keys move ten steps, Home and End go to the ends; input and change fire per key', async () => {
    const slider = await make('label="Volume" value="50" step="2"');
    const events = recordEvents(slider, ['input', 'change']);
    thumb(slider).focus();
    await pressKeys('ArrowRight');
    expect(slider.valueAsNumber).toBe(52);
    await pressKeys('ArrowUp');
    expect(slider.valueAsNumber).toBe(54);
    await pressKeys('ArrowLeft');
    await pressKeys('ArrowDown');
    expect(slider.valueAsNumber).toBe(50);
    await pressKeys('PageUp');
    expect(slider.valueAsNumber).toBe(70);
    await pressKeys('PageDown');
    await pressKeys('PageDown');
    expect(slider.valueAsNumber).toBe(30);
    await pressKeys('End');
    expect(slider.valueAsNumber).toBe(100);
    await pressKeys('Home');
    expect(slider.valueAsNumber).toBe(0);
    expect(events.named('input')).toHaveLength(9);
    expect(events.named('change')).toHaveLength(9);
    expect(thumb(slider).getAttribute('aria-valuenow')).toBe('0');
  });

  it('stops at the ends without events', async () => {
    const slider = await make('label="Volume" value="100"');
    const events = recordEvents(slider, ['input', 'change']);
    thumb(slider).focus();
    await pressKeys('ArrowRight');
    await pressKeys('End');
    expect(slider.valueAsNumber).toBe(100);
    expect(events.events).toHaveLength(0);
  });

  it('steps from fractional values without drift', async () => {
    const slider = await make('label="Opacity" min="0" max="1" step="0.1" value="0"');
    thumb(slider).focus();
    for (let i = 0; i < 3; i++) await pressKeys('ArrowRight');
    expect(slider.valueAsNumber).toBe(0.3);
  });

  it('keys with a modifier and other keys do nothing', async () => {
    const slider = await make('label="Volume" value="50"');
    thumb(slider).focus();
    await pressKeys('Control+ArrowRight');
    await pressKeys('Alt+ArrowRight');
    await pressKeys('Meta+ArrowRight');
    await pressKeys('a');
    await pressKeys('Tab');
    expect(slider.valueAsNumber).toBe(50);
  });

  it('a range thumb cannot pass the other, and honours the gap of min-steps-between-thumbs', async () => {
    const slider = await make('label="Price" range value="40,60" min-steps-between-thumbs="5"');
    thumb(slider, 0).focus();
    await pressKeys('End');
    expect(slider.values).toEqual([55, 60]);
    expect(thumb(slider, 0).getAttribute('aria-valuemax')).toBe('55');
    expect(thumb(slider, 1).getAttribute('aria-valuemin')).toBe('60');
    thumb(slider, 1).focus();
    await pressKeys('Home');
    expect(slider.values).toEqual([55, 60]);
  });

  it('Tab moves through the thumbs of a range in order', async () => {
    const slider = await make('label="Price" range value="20,80"');
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(thumb(slider, 0));
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(thumb(slider, 1));
  });

  it('draws the focus ring for the keyboard, and shows the value bubble while a thumb has focus', async () => {
    const slider = await make('label="Volume" value="40"');
    await pressKeys('Tab');
    expect(getComputedStyle(thumb(slider)).outlineStyle).not.toBe('none');
    await waitUntil(
      () => getComputedStyle(part(slider, 'bubble')!).visibility === 'visible',
      'bubble shown',
    );
  });

  it('in right-to-left text Left goes toward the maximum and Right toward the minimum', async () => {
    const slider = await make('label="Volume" value="50"', undefined, 'rtl');
    thumb(slider).focus();
    await pressKeys('ArrowLeft');
    expect(slider.valueAsNumber).toBe(51);
    await pressKeys('ArrowRight');
    await pressKeys('ArrowRight');
    expect(slider.valueAsNumber).toBe(49);
    await pressKeys('ArrowUp');
    expect(slider.valueAsNumber).toBe(50);
  });
});

describe('tct-slider: pointer', () => {
  it('a press on the track moves the value there, focuses the thumb, and fires input then change at the end', async () => {
    const slider = await make('label="Volume" value="0"');
    const events = recordEvents(slider, ['input', 'change']);
    const at = pointAt(slider, 0.5);
    pointer(track(slider), 'pointerdown', at.x, at.y);
    expect(slider.valueAsNumber).toBe(50);
    expect(deepActiveElement()).toBe(thumb(slider));
    expect(events.named('input')).toHaveLength(1);
    expect(events.named('change')).toHaveLength(0);
    pointer(track(slider), 'pointerup', at.x, at.y);
    expect(events.named('change')).toHaveLength(1);
  });

  it('dragging fires input per change and one change at the end, and follows the pointer beyond the ends', async () => {
    const slider = await make('label="Volume" value="10"');
    const events = recordEvents(slider, ['input', 'change']);
    const start = pointAt(slider, 0.1);
    pointer(track(slider), 'pointerdown', start.x, start.y);
    for (const fraction of [0.3, 0.6, 0.9]) {
      const at = pointAt(slider, fraction);
      pointer(track(slider), 'pointermove', at.x, at.y);
    }
    expect(slider.valueAsNumber).toBe(90);
    expect(hasCustomState(slider, 'dragging')).toBe(true);
    const beyond = pointAt(slider, 2);
    pointer(track(slider), 'pointermove', beyond.x, beyond.y);
    expect(slider.valueAsNumber).toBe(100);
    pointer(track(slider), 'pointerup', beyond.x, beyond.y);
    expect(hasCustomState(slider, 'dragging')).toBe(false);
    expect(events.named('input').length).toBeGreaterThanOrEqual(4);
    expect(events.named('change')).toHaveLength(1);
  });

  it('pressing on the thumb where it is changes nothing and fires nothing', async () => {
    const slider = await make('label="Volume" value="50"');
    const events = recordEvents(slider, ['input', 'change']);
    const at = pointAt(slider, 0.5);
    pointer(thumb(slider), 'pointerdown', at.x, at.y);
    pointer(track(slider), 'pointerup', at.x, at.y);
    expect(slider.valueAsNumber).toBe(50);
    expect(events.events).toHaveLength(0);
  });

  it('snaps to the step', async () => {
    const slider = await make('label="Volume" value="0" step="25"');
    const at = pointAt(slider, 0.4);
    pointer(track(slider), 'pointerdown', at.x, at.y);
    expect(slider.valueAsNumber).toBe(50);
    pointer(track(slider), 'pointerup', at.x, at.y);
  });

  it('a range moves the nearest thumb, and a press on a thumb keeps it when the values coincide', async () => {
    const slider = await make('label="Price" range value="20,80"');
    const near = pointAt(slider, 0.7);
    pointer(track(slider), 'pointerdown', near.x, near.y);
    expect(slider.values).toEqual([20, 70]);
    pointer(track(slider), 'pointerup', near.x, near.y);
    const low = pointAt(slider, 0.1);
    pointer(track(slider), 'pointerdown', low.x, low.y);
    expect(slider.values).toEqual([10, 70]);
    pointer(track(slider), 'pointerup', low.x, low.y);

    const same = await make('label="Price" range value="50,50"');
    const at = pointAt(same, 0.5);
    pointer(thumb(same, 1), 'pointerdown', at.x, at.y);
    const to = pointAt(same, 0.8);
    pointer(track(same), 'pointermove', to.x, to.y);
    expect(same.values).toEqual([50, 80]);
    pointer(track(same), 'pointerup', to.x, to.y);
  });

  it('a press on a tick snaps to that tick, and the thumb is not the keyboard ring afterwards', async () => {
    const slider = await make(
      'label="Volume" value="0" marks=\'[{"value":0,"label":"Off"},{"value":100,"label":"Max"}]\'',
    );
    expect(slider.marks).toEqual([
      {value: 0, label: 'Off'},
      {value: 100, label: 'Max'},
    ]);
    const label = slider.shadowRoot!.querySelector<HTMLElement>(
      '.mark-label[data-mark-value="100"]',
    )!;
    const rect = label.getBoundingClientRect();
    pointer(label, 'pointerdown', rect.left + 1, rect.top + 1);
    expect(slider.valueAsNumber).toBe(100);
    pointer(track(slider), 'pointerup', rect.left + 1, rect.top + 1);
    await slider.updateComplete;
    expect(thumb(slider).hasAttribute('data-pointer')).toBe(true);
    expect(getComputedStyle(thumb(slider)).outlineStyle).toBe('none');
    await pressKeys('ArrowLeft');
    await slider.updateComplete;
    expect(thumb(slider).hasAttribute('data-pointer')).toBe(false);
  });

  it('a real click on the track moves the value', async () => {
    const slider = await make('label="Volume" value="0"');
    const rect = track(slider).getBoundingClientRect();
    await userEvent.click(track(slider), {
      position: {x: 10 + 0.25 * (rect.width - 20), y: rect.height / 2},
    });
    expect(Math.abs(slider.valueAsNumber - 25)).toBeLessThanOrEqual(1);
  });

  it('a vertical slider maps the bottom to the minimum', async () => {
    const slider = await make('label="Volume" orientation="vertical" value="0"');
    const rect = track(slider).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    pointer(track(slider), 'pointerdown', x, rect.top + 10);
    expect(slider.valueAsNumber).toBe(100);
    pointer(track(slider), 'pointermove', x, rect.bottom - 10);
    expect(slider.valueAsNumber).toBe(0);
    pointer(track(slider), 'pointerup', x, rect.bottom - 10);
  });

  it('in right-to-left text the minimum is at the right', async () => {
    const slider = await make('label="Volume" value="0"', undefined, 'rtl');
    const rect = track(slider).getBoundingClientRect();
    expect(Math.round(thumb(slider).getBoundingClientRect().right)).toBe(Math.round(rect.right));
    const at = pointAt(slider, 0.75, true);
    pointer(track(slider), 'pointerdown', at.x, at.y);
    expect(slider.valueAsNumber).toBe(75);
    pointer(track(slider), 'pointerup', at.x, at.y);
  });
});

describe('tct-slider: value text and display', () => {
  it('writes the value in the language of the page for the value text and the bubble (de-DE)', async () => {
    const slider = await make(
      'label="Betrag" min="0" max="5000" step="0.5" value="1234.5"',
      'de-DE',
    );
    expect(thumb(slider).getAttribute('aria-valuetext')).toBe('1.234,5');
    expect(part(slider, 'bubble')!.textContent).toBe('1.234,5');
    expect(thumb(slider).getAttribute('aria-valuenow')).toBe('1234.5');
    const english = await make(
      'label="Amount" min="0" max="5000" step="0.5" value="1234.5"',
      'en-US',
    );
    expect(thumb(english).getAttribute('aria-valuetext')).toBe('1,234.5');
    if (isChromium) expect((await axNode(thumb(slider))).valueText ?? '1.234,5').toBe('1.234,5');
  });

  it('a small whole value needs no value text; formatValue writes it', async () => {
    const plain = await make('label="Volume" value="40"');
    expect(thumb(plain).hasAttribute('aria-valuetext')).toBe(false);
    plain.formatValue = (value) => `${value}%`;
    await plain.updateComplete;
    expect(thumb(plain).getAttribute('aria-valuetext')).toBe('40%');
    expect(part(plain, 'bubble')!.textContent).toBe('40%');
  });

  it('value-display=text shows the value after the track (a range as start to end) and no bubble', async () => {
    const single = await make('label="Volume" value="40" value-display="text"');
    expect(part(single, 'value')!.textContent).toBe('40');
    expect(part(single, 'bubble')).toBeNull();
    const range = await make('label="Price" range value="20,80" value-display="text"');
    expect(part(range, 'value')!.textContent).toBe('20 – 80');
  });

  it('value-display=none shows neither', async () => {
    const slider = await make('label="Volume" value="40" value-display="none"');
    expect(part(slider, 'value')).toBeNull();
    expect(part(slider, 'bubble')).toBeNull();
  });

  it('the bubble shows on hover and while dragging, and follows the value', async () => {
    const slider = await make('label="Volume" value="0"');
    const bubble = part(slider, 'bubble')!;
    expect(getComputedStyle(bubble).visibility).toBe('hidden');
    const at = pointAt(slider, 0.3);
    pointer(track(slider), 'pointerdown', at.x, at.y);
    await slider.updateComplete;
    await waitUntil(() => getComputedStyle(bubble).visibility === 'visible', 'bubble shown');
    expect(bubble.textContent).toBe('30');
    pointer(track(slider), 'pointerup', at.x, at.y);
  });
});

describe('tct-slider: marks', () => {
  it('draws ticks and labels at their values, and marks the filled ones', async () => {
    const slider = await make('label="Volume" value="50"');
    slider.marks = [{value: 0, label: 'Low'}, {value: 50}, {value: 100, label: 'High'}];
    await slider.updateComplete;
    const marks = [...slider.shadowRoot!.querySelectorAll<HTMLElement>('.mark')];
    expect(marks).toHaveLength(3);
    expect(marks.map((mark) => mark.hasAttribute('data-filled'))).toEqual([true, true, false]);
    const labels = [...slider.shadowRoot!.querySelectorAll('.mark-label')].map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(['Low', 'High']);
    const trackBox = track(slider).getBoundingClientRect();
    const middle = marks[1]!.getBoundingClientRect();
    expect(Math.round(middle.left + middle.width / 2)).toBe(
      Math.round(trackBox.left + trackBox.width / 2),
    );
  });

  it('a range fills the ticks between its thumbs', async () => {
    const slider = await make('label="Price" range value="20,80"');
    slider.marks = [{value: 0}, {value: 50}, {value: 100}];
    await slider.updateComplete;
    const marks = [...slider.shadowRoot!.querySelectorAll<HTMLElement>('.mark')];
    expect(marks.map((mark) => mark.hasAttribute('data-filled'))).toEqual([false, true, false]);
  });
});

describe('tct-slider: form', () => {
  it('submits the value under the name, and a range submits the start then the end', async () => {
    const form = await formHarness(
      '<tct-slider label="Volume" name="volume" value="40"></tct-slider><tct-slider label="Price" name="price" range value="20,80"></tct-slider>',
    );
    const [volume, price] = [...form.form.querySelectorAll<TctSlider>('tct-slider')];
    await volume!.updateComplete;
    await price!.updateComplete;
    expect(form.entries()).toEqual([
      ['volume', '40'],
      ['price', '20'],
      ['price', '80'],
    ]);
    thumb(price!, 1).focus();
    await pressKeys('ArrowLeft');
    expect(form.values('price')).toEqual(['20', '79']);
  });

  it('a submit reads the value after a key press at once, and reset returns to the value attribute', async () => {
    const form = await formHarness(
      '<tct-slider label="Volume" name="volume" value="40"></tct-slider><button type="submit">Go</button>',
    );
    const slider = form.form.querySelector<TctSlider>('tct-slider')!;
    await slider.updateComplete;
    thumb(slider).focus();
    await pressKeys('End');
    expect(form.values('volume')).toEqual(['100']);
    form.form.reset();
    await slider.updateComplete;
    expect(form.values('volume')).toEqual(['40']);
    expect(thumb(slider).getAttribute('aria-valuenow')).toBe('40');
  });

  it('restores a range from its saved state', async () => {
    const form = await formHarness(
      '<tct-slider label="Price" name="price" range value="20,80"></tct-slider>',
    );
    const slider = form.form.querySelector<TctSlider>('tct-slider')!;
    await slider.updateComplete;
    const state = new FormData();
    state.append('price', '30');
    state.append('price', '60');
    slider.formStateRestoreCallback(state, 'restore');
    await slider.updateComplete;
    expect(slider.values).toEqual([30, 60]);
  });
});

describe('tct-slider: disabled, read-only, status and required', () => {
  it('a disabled slider is out of the tab order, ignores keys and pointers, and submits nothing', async () => {
    const form = await formHarness(
      '<tct-slider label="Volume" name="volume" value="40" disabled></tct-slider>',
    );
    const slider = form.form.querySelector<TctSlider>('tct-slider')!;
    await slider.updateComplete;
    expect(thumb(slider).tabIndex).toBe(-1);
    expect(thumb(slider).getAttribute('aria-disabled')).toBe('true');
    thumb(slider).focus();
    await pressKeys('ArrowRight');
    const at = pointAt(slider, 0.9);
    pointer(track(slider), 'pointerdown', at.x, at.y);
    expect(slider.valueAsNumber).toBe(40);
    expect(form.entries()).toEqual([]);
    expect(getComputedStyle(part(slider, 'fill')!).backgroundColor).not.toBe(
      getComputedStyle(part(await make('label="Volume" value="40"'), 'fill')!).backgroundColor,
    );
  });

  it('a disabled-message keeps the thumb focusable and explains, and the value cannot change', async () => {
    const slider = await make(
      'label="Volume" value="40" disabled disabled-message="Locked while sharing"',
    );
    expect(thumb(slider).tabIndex).toBe(0);
    expect(thumb(slider).getAttribute('aria-disabled')).toBe('true');
    expect(thumb(slider).getAttribute('aria-describedby')).toContain('disabled-reason');
    expect(part(slider, 'bubble')).toBeNull();
    thumb(slider).focus();
    await pressKeys('ArrowRight');
    expect(slider.valueAsNumber).toBe(40);
  });

  it('read-only shows the value at full strength but bars changes and is still submitted', async () => {
    const form = await formHarness(
      '<tct-slider label="Volume" name="volume" value="40" readonly></tct-slider>',
    );
    const slider = form.form.querySelector<TctSlider>('tct-slider')!;
    await slider.updateComplete;
    expect(thumb(slider).getAttribute('aria-readonly')).toBe('true');
    expect(thumb(slider).tabIndex).toBe(0);
    thumb(slider).focus();
    await pressKeys('ArrowRight');
    expect(slider.valueAsNumber).toBe(40);
    expect(form.values('volume')).toEqual(['40']);
  });

  it('shows a detached status message with an icon, and an error marks every thumb aria-invalid', async () => {
    const slider = await make(
      'label="Price" range value="20,80" status-type="error" status-message="Too wide a range"',
    );
    expect(slider.shadowRoot!.querySelector('tct-field-status')!.textContent).toContain(
      'Too wide a range',
    );
    expect(slider.shadowRoot!.querySelector('tct-field-status')!.getAttribute('variant')).toBe(
      'detached',
    );
    expect(thumbs(slider).every((el) => el.getAttribute('aria-invalid') === 'true')).toBe(true);
  });

  it('required is conveyed by a hidden "Required" text, since aria-required is not defined for a slider', async () => {
    const slider = await make('label="Volume" required');
    const described = thumb(slider)
      .getAttribute('aria-describedby')!
      .split(' ')
      .map((id) => slider.shadowRoot!.getElementById(id)?.textContent)
      .join(' ');
    expect(described).toContain('Required');
    expect(thumb(slider).hasAttribute('aria-required')).toBe(false);
    expect(slider.validity.valid).toBe(true);
  });

  it('a press on the label focuses the thumb', async () => {
    const slider = await make('label="Volume"');
    await userEvent.click(part(slider, 'label')!);
    expect(deepActiveElement()).toBe(thumb(slider));
  });
});

describe('tct-slider: form layout, appearance and accessibility', () => {
  it('in a horizontal-labels layout the label sits beside the slider', async () => {
    await page.viewport(800, 800);
    const wrapper = await fixture<HTMLElement>(
      '<div style="padding:40px;inline-size:640px"><tct-form-layout direction="horizontal-labels"><tct-slider label="Volume"></tct-slider></tct-form-layout></div>',
    );
    const slider = wrapper.querySelector<TctSlider>('tct-slider')!;
    await slider.updateComplete;
    await nextFrame();
    const label = part(slider, 'label')!.getBoundingClientRect();
    expect(label.right).toBeLessThanOrEqual(track(slider).getBoundingClientRect().left);
  });

  it('keeps the rail, the fill and the thumb visible under forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const slider = await make('label="Volume" value="40"');
    expect(getComputedStyle(thumb(slider)).borderTopStyle).toBe('solid');
    expect(getComputedStyle(part(slider, 'fill')!).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('passes axe as a single slider, a range, vertical, disabled, with marks, read-only and with a status', async () => {
    for (const attributes of [
      'label="Volume" value="40"',
      'label="Price" range value="20,80"',
      'label="Volume" orientation="vertical" value="40"',
      'label="Volume" disabled value="40"',
      'label="Volume" disabled disabled-message="Locked" value="40"',
      'label="Volume" readonly value="40"',
      'label="Volume" value="40" required value-display="text"',
      'label="Volume" value="40" status-type="error" status-message="Too loud"',
      'label="Volume" label-hidden value="40"',
    ]) {
      const slider = await make(attributes);
      await expectAccessible(slider);
    }
    const marked = await make('label="Volume" value="40"');
    marked.marks = [
      {value: 0, label: 'Low'},
      {value: 100, label: 'High'},
    ];
    await marked.updateComplete;
    await expectAccessible(marked);
  });

  it('localises the Required text (de-DE)', async () => {
    const slider = await make('label="Lautstärke" required', 'de-DE');
    await waitUntil(
      () => !(part(slider, 'label-indicator')?.textContent ?? 'Required').includes('Required'),
      'German indicator',
      3000,
    );
    expect(part(slider, 'label-indicator')!.textContent).not.toContain('Required');
  });
});
