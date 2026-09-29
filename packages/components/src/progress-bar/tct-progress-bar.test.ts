import {html} from 'lit';
import {userEvent} from 'vitest/browser';
import {beforeEach, describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import {PROGRESS_BAR_VARIANTS} from './progress-bar.types.js';
import './define.js';
import type {TctProgressBar} from './tct-progress-bar.js';

const $ = (bar: TctProgressBar, selector: string): HTMLElement | null =>
  bar.shadowRoot!.querySelector<HTMLElement>(selector);
const track = (bar: TctProgressBar): HTMLElement => $(bar, '[role="progressbar"]')!;

async function make(
  attributes: string,
  props: Partial<TctProgressBar> = {},
): Promise<TctProgressBar> {
  const wrapper = await fixture<HTMLElement>(
    `<div style="inline-size: 300px"><tct-progress-bar ${attributes}></tct-progress-bar></div>`,
  );
  const bar = wrapper.querySelector<TctProgressBar>('tct-progress-bar')!;
  Object.assign(bar, props);
  await bar.updateComplete;
  return bar;
}

runElementSuite({
  tag: 'tct-progress-bar',
  render: () => `<tct-progress-bar label="Storage used" value="50"></tct-progress-bar>`,
  properties: {
    value: 30,
    max: 80,
    label: 'Upload',
    variant: 'success',
    indeterminate: true,
    disabled: true,
  },
  attributes: {value: 'value', max: 'max', label: 'label', variant: 'variant'},
});

describe('tct-progress-bar (ProgressBar.test.tsx)', () => {
  it('renders visible label by default', async () => {
    const bar = await make('value="50" label="Storage used"');
    expect($(bar, '.label')!.textContent.trim()).toBe('Storage used');
    expect($(bar, '.label')!.classList.contains('visually-hidden')).toBe(false);
  });

  it('hides label visually when label-hidden, keeping it as the name', async () => {
    const bar = await make('value="50" label="Hidden label" label-hidden');
    const hidden = bar.shadowRoot!.querySelector<HTMLElement>('.visually-hidden')!;
    expect(hidden.textContent.trim()).toBe('Hidden label');
    expect(track(bar).getAttribute('aria-labelledby')).toBe(hidden.id);
    if (isChromium) expect((await axNode(track(bar))).name).toBe('Hidden label');
  });

  it('shows value label when has-value-label is set', async () => {
    const bar = await make('value="75" label="Upload" has-value-label');
    expect($(bar, '.value-label')!.textContent.trim()).toBe('75%');
  });

  it('uses a custom formatValueLabel for the visible text and aria-valuetext', async () => {
    const bar = await make('value="3" max="5" label="Disk" has-value-label', {
      formatValueLabel: (v, m) => `${v} GB / ${m} GB`,
    });
    expect($(bar, '.value-label')!.textContent.trim()).toBe('3 GB / 5 GB');
    expect(track(bar).getAttribute('aria-valuetext')).toBe('3 GB / 5 GB');
  });

  it('sets aria-valuetext from the default percentage format', async () => {
    const bar = await make('value="50" label="Progress"');
    expect(track(bar).getAttribute('aria-valuetext')).toBe('50%');
    expect(track(bar).getAttribute('aria-valuemin')).toBe('0');
    expect(track(bar).getAttribute('aria-valuemax')).toBe('100');
  });

  it('clamps value to [0, max]', async () => {
    const over = await make('value="150" max="100" label="Over"');
    expect(track(over).getAttribute('aria-valuenow')).toBe('100');
    const under = await make('value="-10" max="100" label="Under"');
    expect(track(under).getAttribute('aria-valuenow')).toBe('0');
  });

  it('renders every variant', async () => {
    for (const variant of PROGRESS_BAR_VARIANTS) {
      const bar = await make(`value="50" label="${variant}" variant="${variant}"`);
      expect(getComputedStyle($(bar, '.fill')!).backgroundColor, variant).not.toBe(
        'rgba(0, 0, 0, 0)',
      );
    }
  });

  it('gives each variant its own fill colour', async () => {
    const colours = new Set<string>();
    for (const variant of PROGRESS_BAR_VARIANTS) {
      const bar = await make(`value="50" label="${variant}" variant="${variant}"`);
      colours.add(getComputedStyle($(bar, '.fill')!).backgroundColor);
    }
    expect(colours.size).toBe(PROGRESS_BAR_VARIANTS.length);
  });

  it('renders at a fixed 8px track height and fills to the value', async () => {
    const bar = await make('value="25" label="Progress"');
    const trackBox = track(bar).getBoundingClientRect();
    const fillBox = $(bar, '.fill')!.getBoundingClientRect();
    expect(trackBox.height).toBe(8);
    expect(fillBox.width / trackBox.width).toBeCloseTo(0.25, 2);
  });

  it('shows the value label with a hidden label', async () => {
    const bar = await make('value="60" label="Hidden" label-hidden has-value-label');
    expect($(bar, '.value-label')!.textContent.trim()).toBe('60%');
    expect(bar.shadowRoot!.querySelector('.visually-hidden')!.textContent.trim()).toBe('Hidden');
  });

  it('renders no visible value label when label-hidden without has-value-label', async () => {
    const bar = await make('value="42" label="Context usage" label-hidden');
    expect($(bar, '.value-label')).toBeNull();
    expect(track(bar).getAttribute('aria-labelledby')).toBe(
      bar.shadowRoot!.querySelector('.visually-hidden')!.id,
    );
  });

  it('handles zero max gracefully', async () => {
    const bar = await make('value="0" max="0" label="Empty" has-value-label');
    expect(track(bar).getAttribute('aria-valuenow')).toBe('0');
    expect(track(bar).getAttribute('aria-valuemax')).toBe('0');
    expect($(bar, '.value-label')!.textContent.trim()).toBe('0%');
  });

  it('treats a NaN value or max as empty progress instead of leaking "NaN"', async () => {
    const nanValue = await make('label="Upload" has-value-label', {value: NaN});
    expect(track(nanValue).getAttribute('aria-valuenow')).toBe('0');
    expect(track(nanValue).getAttribute('aria-valuetext')).toBe('0%');
    const nanMax = await make('value="10" label="Upload" has-value-label', {max: NaN});
    expect(track(nanMax).getAttribute('aria-valuemax')).toBe('0');
    for (const bar of [nanValue, nanMax]) {
      expect(bar.shadowRoot!.textContent).not.toMatch(/NaN|Infinity/);
    }
  });

  describe('disabled state', () => {
    it('renders with disabled, keeps the label and dims text and fill', async () => {
      const normal = await make('value="50" label="Upload" has-value-label');
      const disabled = await make('value="50" label="Canceled" disabled has-value-label');
      expect($(disabled, '.label')!.textContent.trim()).toBe('Canceled');
      expect(getComputedStyle($(disabled, '.label')!).color).not.toBe(
        getComputedStyle($(normal, '.label')!).color,
      );
      expect(getComputedStyle($(disabled, '.fill')!).backgroundColor).not.toBe(
        getComputedStyle($(normal, '.fill')!).backgroundColor,
      );
    });
  });

  describe('indeterminate mode', () => {
    it('omits authored value attributes while indeterminate', async () => {
      const bar = await make('indeterminate label="Loading"');
      for (const name of ['aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-valuetext']) {
        expect(track(bar).hasAttribute(name), name).toBe(false);
      }
    });

    it('is labelled and still renders the label', async () => {
      const bar = await make('indeterminate label="Processing"');
      expect($(bar, '.label')!.textContent.trim()).toBe('Processing');
      expect(track(bar).getAttribute('aria-labelledby')).toBe($(bar, '.label')!.id);
    });

    it('hides the value label even if has-value-label is set', async () => {
      const bar = await make('indeterminate label="Loading" value="50" has-value-label');
      expect($(bar, '.value-label')).toBeNull();
    });

    it('renders with all variants and slides a clipped 40% segment', async () => {
      for (const variant of PROGRESS_BAR_VARIANTS) {
        const bar = await make(`indeterminate label="${variant}" variant="${variant}"`);
        expect(track(bar)).not.toBeNull();
      }
      const bar = await make('indeterminate label="Loading"');
      const style = getComputedStyle($(bar, '.fill')!);
      expect(style.animationName).toBe('tct-progress-slide');
      expect(style.animationIterationCount).toBe('infinite');
      expect(getComputedStyle(track(bar)).overflow).toBe('hidden');
      expect(
        $(bar, '.fill')!.getBoundingClientRect().width / track(bar).getBoundingClientRect().width,
      ).toBeCloseTo(0.4, 2);
    });

    it('drives a direction-aware slide (mirrored keyframes under RTL)', async () => {
      const wrapper = await fixture<HTMLElement>(
        html`<div><tct-progress-bar indeterminate label="Loading"></tct-progress-bar></div>`,
        {dir: 'rtl'},
      );
      const bar = wrapper.querySelector<TctProgressBar>('tct-progress-bar')!;
      await bar.updateComplete;
      expect(getComputedStyle($(bar, '.fill')!).animationName).toBe('tct-progress-slide-rtl');
    });

    it.skipIf(!isChromium)(
      'slows the slide under prefers-reduced-motion instead of stopping it',
      async () => {
        await emulateMedia({reducedMotion: 'reduce'});
        const bar = await make('indeterminate label="Loading"');
        const style = getComputedStyle($(bar, '.fill')!);
        expect(style.animationName).toBe('tct-progress-slide');
        expect(style.animationDuration).toBe('3s');
      },
    );

    it('a determinate bar has no animation', async () => {
      const bar = await make('value="50" label="Loading"');
      expect(getComputedStyle($(bar, '.fill')!).animationName).toBe('none');
    });
  });
});

describe('tct-progress-bar: target marks', () => {
  const marks = (list: {value: number; label: string}[]) => ({marks: list});
  const markEls = (bar: TctProgressBar) => [
    ...bar.shadowRoot!.querySelectorAll<HTMLElement>('.mark'),
  ];

  const targetOf = (mark: HTMLElement): HTMLElement =>
    mark.shadowRoot!.querySelector<HTMLElement>('.target')!;

  it('renders no marks when omitted or empty', async () => {
    expect(markEls(await make('value="50" label="A"'))).toHaveLength(0);
    expect(markEls(await make('value="50" label="A"', marks([])))).toHaveLength(0);
  });

  it('positions a mark by its value on the 0..max scale and centres it on the track', async () => {
    const bar = await make('value="45" label="Fundraiser"', marks([{value: 80, label: 'Goal'}]));
    const [mark] = markEls(bar);
    const trackBox = track(bar).getBoundingClientRect();
    const box = mark!.getBoundingClientRect();
    expect((box.left + box.width / 2 - trackBox.left) / trackBox.width).toBeCloseTo(0.8, 2);
    expect(box.top + box.height / 2).toBeCloseTo(trackBox.top + trackBox.height / 2, 0);
    expect([box.width, box.height]).toEqual([2, 8]);
    const custom = await make('value="1" max="5" label="A"', marks([{value: 4, label: 'Q4'}]));
    const cbox = markEls(custom)[0]!.getBoundingClientRect();
    const ctrack = track(custom).getBoundingClientRect();
    expect((cbox.left + cbox.width / 2 - ctrack.left) / ctrack.width).toBeCloseTo(0.8, 2);
  });

  it('keeps a mark past the current value visible, and renders several', async () => {
    const bar = await make(
      'value="20" label="A"',
      marks([
        {value: 30, label: 'One'},
        {value: 60, label: 'Two'},
        {value: 90, label: 'Three'},
      ]),
    );
    expect(markEls(bar)).toHaveLength(3);
    for (const mark of markEls(bar)) expect(mark.getBoundingClientRect().width).toBeGreaterThan(0);
  });

  it('clamps out-of-range marks to the track edges and drops non-finite ones', async () => {
    const bar = await make(
      'value="50" label="A"',
      marks([
        {value: -20, label: 'Low'},
        {value: 500, label: 'High'},
        {value: NaN, label: 'Bad'},
      ]),
    );
    expect(markEls(bar)).toHaveLength(2);
    const trackBox = track(bar).getBoundingClientRect();
    const [low, high] = markEls(bar).map((mark) => mark.getBoundingClientRect());
    expect(low!.left + low!.width / 2).toBeCloseTo(trackBox.left, 0);
    expect(high!.left + high!.width / 2).toBeCloseTo(trackBox.right, 0);
  });

  it('does not render marks in indeterminate mode', async () => {
    const bar = await make('indeterminate label="A"', marks([{value: 50, label: 'Half'}]));
    expect(markEls(bar)).toHaveLength(0);
  });

  it('marks ticks inside the fill as on the fill, at the leading edge too, and none at zero progress', async () => {
    const bar = await make(
      'value="50" label="A"',
      marks([
        {value: 20, label: 'In'},
        {value: 50, label: 'Edge'},
        {value: 80, label: 'Out'},
      ]),
    );
    expect(markEls(bar).map((mark) => mark.dataset.placement)).toEqual(['fill', 'fill', 'track']);
    const zero = await make(
      'value="0" label="A"',
      marks([
        {value: 0, label: 'Start'},
        {value: 30, label: 'B'},
      ]),
    );
    expect(markEls(zero).map((mark) => mark.dataset.placement)).toEqual(['track', 'track']);
  });

  it('mirrors the fill variant on marks, and uses disabled when disabled', async () => {
    const bar = await make(
      'value="50" label="A" variant="success"',
      marks([{value: 20, label: 'x'}]),
    );
    expect(markEls(bar)[0]!.dataset.variant).toBe('success');
    const disabled = await make(
      'value="50" label="A" variant="success" disabled',
      marks([{value: 20, label: 'x'}]),
    );
    expect(markEls(disabled)[0]!.dataset.variant).toBe('disabled');
  });

  it('colours a mark by what it sits on: surface ink on the fill, primary text on the track, secondary when disabled', async () => {
    const bar = await make(
      'value="50" label="A"',
      marks([
        {value: 20, label: 'In'},
        {value: 80, label: 'Out'},
      ]),
    );
    const [onFill, onTrack] = markEls(bar).map((mark) => getComputedStyle(mark).backgroundColor);
    expect(onFill).not.toBe(onTrack);
    const disabled = await make(
      'value="50" label="A" disabled',
      marks([{value: 80, label: 'Out'}]),
    );
    expect(getComputedStyle(markEls(disabled)[0]!).backgroundColor).not.toBe(onTrack);
  });

  it('keeps tabbable target marks outside the progressbar subtree', async () => {
    const bar = await make('value="50" label="A"', marks([{value: 20, label: 'Goal'}]));
    expect(track(bar).querySelector('.mark')).toBeNull();
    expect(track(bar).querySelector('[tabindex]')).toBeNull();
    for (const mark of markEls(bar)) expect(targetOf(mark).getAttribute('tabindex')).toBe('0');
  });

  it('names every mark with its label (never decorative)', async () => {
    const bar = await make('value="50" label="A"', marks([{value: 20, label: 'Q1 target: 20%'}]));
    if (isChromium) {
      const node = await axNode(targetOf(markEls(bar)[0]!));
      expect([node.role, node.name]).toEqual(['image', 'Q1 target: 20%']);
    }
  });

  it('does not add mark information to the progressbar aria-valuetext', async () => {
    const bar = await make('value="50" label="A"', marks([{value: 80, label: 'Goal'}]));
    expect(track(bar).getAttribute('aria-valuetext')).toBe('50%');
  });

  it('does not clip marks in determinate mode (the track has no overflow clipping)', async () => {
    const bar = await make('value="50" label="A"', marks([{value: 100, label: 'End'}]));
    expect(getComputedStyle(track(bar)).overflow).toBe('visible');
  });

  it('lays out the marks toward the inline start in right-to-left', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div style="inline-size: 300px">
        <tct-progress-bar
          value="10"
          label="A"
          .marks=${[{value: 80, label: 'Goal'}]}
        ></tct-progress-bar>
      </div>`,
      {dir: 'rtl'},
    );
    const bar = wrapper.querySelector<TctProgressBar>('tct-progress-bar')!;
    await bar.updateComplete;
    const trackBox = track(bar).getBoundingClientRect();
    const box = markEls(bar)[0]!.getBoundingClientRect();
    expect((trackBox.right - (box.left + box.width / 2)) / trackBox.width).toBeCloseTo(0.8, 2);
    const fill = $(bar, '.fill')!.getBoundingClientRect();
    expect(fill.right).toBeCloseTo(trackBox.right, 0);
  });
});

describe('tct-progress-bar: localisation, accessibility and forced colours', () => {
  it('localises the default value text (de-DE, ar-SA)', async () => {
    const german = await fixture<HTMLElement>(
      html`<div lang="de-DE">
        <tct-progress-bar value="75" label="Upload" has-value-label></tct-progress-bar>
      </div>`,
    );
    const de = german.querySelector<TctProgressBar>('tct-progress-bar')!;
    await waitUntil(() => /75\s?%/.test($(de, '.value-label')!.textContent), 'German percent');
    expect($(de, '.value-label')!.textContent).toMatch(/75 %/);
    const arabic = await fixture<HTMLElement>(
      html`<div lang="ar-SA" dir="rtl">
        <tct-progress-bar value="75" label="Upload" has-value-label></tct-progress-bar>
      </div>`,
    );
    const ar = arabic.querySelector<TctProgressBar>('tct-progress-bar')!;
    await waitUntil(() => /[٠-٩]/.test($(ar, '.value-label')!.textContent), 'Arabic digits');
    expect(track(ar).getAttribute('aria-valuetext')).toMatch(/[٠-٩]/);
  });

  it('a custom formatter wins over localisation', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div lang="de-DE">
        <tct-progress-bar
          value="3"
          max="5"
          label="Disk"
          has-value-label
          .formatValueLabel=${(v: number, m: number) => `${v}/${m}`}
        ></tct-progress-bar>
      </div>`,
    );
    const bar = wrapper.querySelector<TctProgressBar>('tct-progress-bar')!;
    await bar.updateComplete;
    expect($(bar, '.value-label')!.textContent.trim()).toBe('3/5');
  });

  it('exposes a progressbar with name, value and text in the accessibility tree', async () => {
    if (!isChromium) return;
    const bar = await make('value="40" label="Upload progress" has-value-label');
    const node = await axNode(track(bar));
    expect(node.role).toBe('progressbar');
    expect(node.name).toBe('Upload progress');
    expect(node.valuetext).toBe('40%');
  });

  it('passes axe in every variant and state, light and dark', async () => {
    for (const theme of ['light', 'dark'] as const) {
      const wrapper = await fixture<HTMLElement>(
        html`<div style="display: flex; flex-direction: column; gap: 12px; inline-size: 320px">
          ${PROGRESS_BAR_VARIANTS.map(
            (variant) =>
              html`<tct-progress-bar
                value="60"
                label=${variant}
                variant=${variant}
                has-value-label
              ></tct-progress-bar>`,
          )}
          <tct-progress-bar indeterminate label="Loading"></tct-progress-bar>
          <tct-progress-bar value="20" label="Hidden" label-hidden></tct-progress-bar>
          <tct-progress-bar
            value="45"
            label="Fundraiser"
            .marks=${[{value: 80, label: 'Goal'}]}
          ></tct-progress-bar>
        </div>`,
        {theme},
      );
      await expectAccessible(wrapper);
    }
  });

  it('a disabled bar is marked aria-disabled (inactive, exempt from WCAG 1.4.3) and passes axe', async () => {
    const wrapper = await fixture<HTMLElement>(
      html`<div>
        <tct-progress-bar value="30" label="Canceled" disabled has-value-label></tct-progress-bar>
      </div>`,
    );
    const bar = wrapper.querySelector<TctProgressBar>('tct-progress-bar')!;
    expect($(bar, '.base')!.getAttribute('aria-disabled')).toBe('true');
    // The progressbar keeps its value semantics; only the container says "disabled".
    expect(track(bar).getAttribute('aria-valuenow')).toBe('30');
    await expectAccessible(wrapper);
    bar.disabled = false;
    await bar.updateComplete;
    expect($(bar, '.base')!.hasAttribute('aria-disabled')).toBe(false);
  });

  it.skipIf(!isChromium)(
    'draws the track edge and the fill in system colours in forced colours',
    async () => {
      await emulateMedia({forcedColors: 'active'});
      const bar = await make('value="50" label="A"', {marks: [{value: 80, label: 'Goal'}]});
      expect(getComputedStyle(track(bar)).borderTopStyle).toBe('solid');
      expect(getComputedStyle($(bar, '.fill')!).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    },
  );
});

describe('tct-progress-bar: mark tooltips', () => {
  const markOf = (bar: TctProgressBar, index = 0): HTMLElement =>
    bar.shadowRoot!.querySelectorAll<HTMLElement>('.mark')[index]!;
  const targetOf = (mark: HTMLElement): HTMLElement =>
    mark.shadowRoot!.querySelector<HTMLElement>('.target')!;
  const surfaceOf = (mark: HTMLElement): HTMLElement | null =>
    mark.shadowRoot!.querySelector<HTMLElement>('.tooltip-surface');
  const isOpen = (mark: HTMLElement): boolean => surfaceOf(mark)?.matches(':popover-open') ?? false;

  /** The real mouse pointer stays where the last test left it; park it in an empty corner. */
  beforeEach(async () => {
    const corner = document.createElement('div');
    corner.style.cssText =
      'position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:4px;block-size:4px';
    document.body.append(corner);
    await userEvent.hover(corner);
    corner.remove();
  });

  async function withMarks(): Promise<TctProgressBar> {
    const wrapper = await fixture<HTMLElement>(
      html`<div style="inline-size: 300px; padding: 80px 40px">
        <button>before</button>
        <tct-progress-bar
          value="40"
          label="Sales"
          .marks=${[
            {value: 25, label: 'Milestone: 25%'},
            {value: 75, label: 'Goal: 75%'},
          ]}
        ></tct-progress-bar>
      </div>`,
    );
    const bar = wrapper.querySelector<TctProgressBar>('tct-progress-bar')!;
    await bar.updateComplete;
    return bar;
  }

  it('describes each mark with its own tooltip surface holding the label', async () => {
    const bar = await withMarks();
    for (const [index, label] of ['Milestone: 25%', 'Goal: 75%'].entries()) {
      const mark = markOf(bar, index);
      await (mark as unknown as {updateComplete: Promise<boolean>}).updateComplete;
      expect(surfaceOf(mark)!.textContent.trim()).toBe(label);
      expect(surfaceOf(mark)!.getAttribute('role')).toBe('tooltip');
      expect(targetOf(mark).getAttribute('aria-describedby')).toBe(surfaceOf(mark)!.id);
      expect(targetOf(mark).getAttribute('aria-label')).toBe(label);
    }
  });

  it('shows the tooltip on hover, above the mark, and hides it on leave', async () => {
    const bar = await withMarks();
    const mark = markOf(bar, 1);
    await userEvent.hover(targetOf(mark));
    await waitUntil(() => isOpen(mark), 'tooltip open');
    expect(surfaceOf(mark)!.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      targetOf(mark).getBoundingClientRect().top + 1,
    );
    const corner = document.createElement('div');
    corner.style.cssText =
      'position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:4px;block-size:4px';
    document.body.append(corner);
    await userEvent.hover(corner);
    await waitUntil(() => !isOpen(mark), 'tooltip closed');
    corner.remove();
  });

  it('shows the tooltip on keyboard focus, and Escape closes it', async () => {
    const bar = await withMarks();
    const before = bar.parentElement!.querySelector('button')!;
    before.focus();
    await pressKeys('Tab');
    const mark = markOf(bar, 0);
    expect(mark.shadowRoot!.activeElement).toBe(targetOf(mark));
    await waitUntil(() => isOpen(mark), 'tooltip open on focus');
    await pressKeys('Escape');
    await waitUntil(() => !isOpen(mark), 'tooltip closed by Escape');
  });

  it('draws a focus ring on the focused mark', async () => {
    const bar = await withMarks();
    const before = bar.parentElement!.querySelector('button')!;
    before.focus();
    await pressKeys('Tab');
    const target = targetOf(markOf(bar, 0));
    expect(getComputedStyle(target).outlineStyle).not.toBe('none');
    expect(parseFloat(getComputedStyle(target).outlineWidth)).toBeGreaterThan(0);
  });

  it('passes axe with a mark tooltip open', async () => {
    const bar = await withMarks();
    const mark = markOf(bar, 0);
    await userEvent.hover(targetOf(mark));
    await waitUntil(() => isOpen(mark), 'tooltip open');
    await expectAccessible(bar.parentElement!);
  });
});
