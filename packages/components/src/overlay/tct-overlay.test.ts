/**
 * tct-overlay: structure, position, scrim modes and media-theme inversion, controlled visibility,
 * CSS-driven reveal (hover, focus, touch tap), a11y, RTL, forced colours; plus the container-reveal
 * style module (`useContainerReveal`) through a test-only element.
 */
import {css, html} from 'lit';
import {property} from 'lit/decorators.js';
import {afterEach, beforeAll, beforeEach, describe, expect, it} from 'vitest';
import {userEvent} from 'vitest/browser';
import {defineElement} from '@tecton-astryx/core/define.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {deepActiveElement} from '@tecton-astryx/core/utils/focus.js';
import {
  aTimeout,
  emulateMedia,
  expectAccessible,
  fixture,
  nextFrame,
  pressKeys,
  runElementSuite,
  runKeyboardSuite,
  waitUntil,
} from '@tecton-astryx/testing/index.js';
import base from '../styles/base.styles.css';
import containerReveal from './container-reveal.styles.css';
import './define.js';
import type {TctOverlay} from './tct-overlay.js';

type Row = {keys: string; action: string; when?: string};
const parity = Object.values(
  import.meta.glob<{entries: {'core.overlay': {keyboard: Row[]}}}>('./parity.json', {
    eager: true,
    import: 'default',
  }),
)[0]!;

const overlay = (
  attributes = '',
  base = '<div id="media" style="block-size:120px;inline-size:200px">media</div>',
  content = '<button id="action">Quick view</button>',
) => `<tct-overlay ${attributes}>${base}<div slot="content">${content}</div></tct-overlay>`;

async function mount(attributes = '', baseContent?: string, content?: string): Promise<TctOverlay> {
  const root = await fixture<HTMLElement>(
    `<div style="padding:20px">${overlay(attributes, baseContent, content)}<p id="outside">outside</p></div>`,
  );
  const element = root.querySelector<TctOverlay>('tct-overlay')!;
  await element.updateComplete;
  return element;
}

const scrimOf = (el: TctOverlay): HTMLElement =>
  el.shadowRoot!.querySelector<HTMLElement>('.scrim')!;
const rootOf = (el: TctOverlay): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('.root')!;
const opacityOf = (el: TctOverlay): number =>
  Number.parseFloat(getComputedStyle(scrimOf(el)).opacity);
const settled = async (): Promise<void> => {
  await aTimeout(250);
};

// A stationary real pointer would "enter" content that a later test renders under it.
beforeEach(async () => {
  const parked = await fixture<HTMLElement>(
    '<div style="position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:8px;block-size:8px"></div>',
  );
  await userEvent.hover(parked);
});

// runElementSuite's moveBefore check parks the element in a <div> next to the fixture, outside its cleanup.
afterEach(() => {
  for (const stray of document.querySelectorAll('body > div:not([data-test-fixture])')) {
    if (stray.querySelector('tct-overlay')) stray.remove();
  }
});

runElementSuite({
  tag: 'tct-overlay',
  render: () => overlay(),
  properties: {
    showOn: 'hover',
    scrim: 'light',
    position: 'bottom',
    alignment: 'center',
    open: true,
  },
  attributes: {showOn: 'show-on', scrim: 'scrim', position: 'position', alignment: 'alignment'},
});

describe('rendering & structure', () => {
  it('renders the base children', async () => {
    const el = await mount();
    expect(el.querySelector('#media')!.textContent).toBe('media');
    expect(el.querySelector<HTMLSlotElement>(':scope > #media')!.assignedSlot).toBe(
      el.shadowRoot!.querySelector('slot:not([name])'),
    );
  });

  it('renders the overlay content inside the scrim', async () => {
    const el = await mount();
    const content = el.querySelector('[slot=content]')!;
    expect(content.assignedSlot!.parentElement).toBe(scrimOf(el));
  });

  it('exposes the container and the scrim as parts, the scrim after the base content', async () => {
    const el = await mount();
    expect(rootOf(el).getAttribute('part')).toBe('overlay');
    expect(scrimOf(el).getAttribute('part')).toBe('scrim');
    const children = [...rootOf(el).children];
    expect(children.at(-1)).toBe(scrimOf(el));
  });

  it('clips to the container and takes the base content radius', async () => {
    const el = await mount('', '<div style="border-radius:12px;block-size:80px">m</div>');
    expect(getComputedStyle(rootOf(el)).overflow).toBe('clip');
    expect(getComputedStyle(rootOf(el)).borderTopLeftRadius).toBe('12px');
  });
});

describe('position and alignment', () => {
  it('defaults to fill and end', async () => {
    const el = await mount();
    expect(el.position).toBe('fill');
    expect(scrimOf(el).dataset.position).toBe('fill');
    const root = rootOf(el).getBoundingClientRect();
    const scrim = scrimOf(el).getBoundingClientRect();
    expect(scrim.width).toBeCloseTo(root.width, 0);
    expect(scrim.height).toBeCloseTo(root.height, 0);
  });

  it('bottom is a strip on the block end and top on the block start, full width', async () => {
    const bottom = await mount('position="bottom"');
    await settled();
    const root = rootOf(bottom).getBoundingClientRect();
    const strip = scrimOf(bottom).getBoundingClientRect();
    expect(strip.bottom).toBeCloseTo(root.bottom, 0);
    expect(strip.width).toBeCloseTo(root.width, 0);
    expect(strip.height).toBeLessThan(root.height);
    const top = await mount('position="top"');
    await settled();
    expect(scrimOf(top).getBoundingClientRect().top).toBeCloseTo(
      rootOf(top).getBoundingClientRect().top,
      0,
    );
  });

  it('aligns content on the inline axis: start, center, end (mirrors in RTL)', async () => {
    const content = '<button id="action" style="inline-size:40px">a</button>';
    const at = async (alignment: string, dir: 'ltr' | 'rtl' = 'ltr') => {
      const root = await fixture<HTMLElement>(
        `<div dir="${dir}" style="padding:20px">${overlay(`alignment="${alignment}"`, undefined, content)}</div>`,
      );
      const el = root.querySelector<TctOverlay>('tct-overlay')!;
      await el.updateComplete;
      const box = rootOf(el).getBoundingClientRect();
      const button = el.querySelector('#action')!.getBoundingClientRect();
      return {box, button};
    };
    const start = await at('start');
    expect(start.button.left - start.box.left).toBeLessThan(20);
    const end = await at('end');
    expect(end.box.right - end.button.right).toBeLessThan(20);
    const center = await at('center');
    expect(
      Math.abs(center.button.left + 20 - (center.box.left + center.box.width / 2)),
    ).toBeLessThan(2);
    const rtlEnd = await at('end', 'rtl');
    expect(rtlEnd.button.left - rtlEnd.box.left).toBeLessThan(20);
  });
});

describe('scrim mode and media-theme inversion', () => {
  it('dark scrim (default) inverts the content to light ink and washes with the overlay token', async () => {
    const el = await mount();
    const content = el.querySelector('[slot=content]')!;
    expect(content.getAttribute('data-media-theme')).toBe('dark');
    expect(getComputedStyle(scrimOf(el)).backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  });

  it('light scrim inverts the content to dark ink', async () => {
    const el = await mount('scrim="light"');
    expect(el.querySelector('[slot=content]')!.getAttribute('data-media-theme')).toBe('light');
  });

  it('scrim="none" paints no wash and sets no media theme, and removes ours when switched', async () => {
    const el = await mount('scrim="none"');
    expect(el.querySelector('[slot=content]')!.hasAttribute('data-media-theme')).toBe(false);
    expect(getComputedStyle(scrimOf(el)).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    el.scrim = 'dark';
    await el.updateComplete;
    expect(el.querySelector('[slot=content]')!.getAttribute('data-media-theme')).toBe('dark');
    el.scrim = 'none';
    await el.updateComplete;
    expect(el.querySelector('[slot=content]')!.hasAttribute('data-media-theme')).toBe(false);
  });

  it('inverts newly slotted content', async () => {
    const el = await mount();
    const extra = document.createElement('div');
    extra.slot = 'content';
    el.append(extra);
    await waitUntil(() => extra.getAttribute('data-media-theme') === 'dark', 'themed');
  });
});

describe('controlled visibility (open)', () => {
  it('marks the scrim inert and hides it when open is false', async () => {
    const el = await mount();
    el.open = false;
    await el.updateComplete;
    expect(scrimOf(el).hasAttribute('inert')).toBe(true);
    await settled();
    expect(opacityOf(el)).toBe(0);
  });

  it('does not mark the scrim inert when open is true (attribute form)', async () => {
    const el = await mount('show-on="hover" open');
    expect(scrimOf(el).hasAttribute('inert')).toBe(false);
    await settled();
    expect(opacityOf(el)).toBe(1);
    expect(el.hasAttribute('open')).toBe(true);
  });

  it('is never inert in uncontrolled (CSS-driven) mode', async () => {
    for (const showOn of ['always', 'hover', 'focus']) {
      const el = await mount(`show-on="${showOn}"`);
      expect(el.open).toBeUndefined();
      expect(scrimOf(el).hasAttribute('inert'), showOn).toBe(false);
    }
  });

  it('toggles inert when the property flips, and open=undefined hands control back to show-on', async () => {
    const el = await mount('show-on="hover"');
    el.open = false;
    await el.updateComplete;
    expect(scrimOf(el).hasAttribute('inert')).toBe(true);
    el.open = true;
    await el.updateComplete;
    expect(scrimOf(el).hasAttribute('inert')).toBe(false);
    el.open = undefined;
    await el.updateComplete;
    await settled();
    expect(opacityOf(el)).toBe(0);
    expect(el.hasAttribute('open')).toBe(false);
  });
});

describe('reveal: show-on', () => {
  it('always: visible without interaction', async () => {
    const el = await mount('show-on="always"');
    await settled();
    expect(opacityOf(el)).toBe(1);
    expect(el.matches(':state(open)')).toBe(true);
  });

  it('hover: hidden at rest, visible while the pointer is over it, hidden again after', async () => {
    const el = await mount('show-on="hover"');
    await settled();
    expect(opacityOf(el)).toBe(0);
    await userEvent.hover(el);
    await waitUntil(() => opacityOf(el) === 1, 'revealed by hover');
    await userEvent.hover(document.querySelector('#outside')!);
    await waitUntil(() => opacityOf(el) === 0, 'hidden again');
  });

  it('hover-or-focus is an alias of hover', async () => {
    const el = await mount('show-on="hover-or-focus"');
    await userEvent.hover(el);
    await waitUntil(() => opacityOf(el) === 1, 'revealed by hover');
  });

  it('focus: hover does not reveal it, focus inside does', async () => {
    const el = await mount(
      'show-on="focus"',
      '<a id="link" href="#x" style="display:block;block-size:100px">link</a>',
    );
    await userEvent.hover(el);
    await settled();
    expect(opacityOf(el)).toBe(0);
    el.querySelector<HTMLElement>('#link')!.focus();
    await waitUntil(() => opacityOf(el) === 1, 'revealed by focus');
  });

  it('keeps hidden content in the tab order and reveals it when focus reaches it', async () => {
    const el = await mount('show-on="hover"');
    await settled();
    expect(opacityOf(el)).toBe(0);
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(el.querySelector('#action'));
    await waitUntil(() => opacityOf(el) === 1, 'revealed by focus-within');
    expect(getComputedStyle(scrimOf(el)).display).not.toBe('none');
    expect(getComputedStyle(scrimOf(el)).visibility).toBe('visible');
  });

  it('bottom strip slides in from its edge on hover', async () => {
    const el = await mount('show-on="hover" position="bottom"');
    await settled();
    const rest = scrimOf(el).getBoundingClientRect();
    await userEvent.hover(el);
    await waitUntil(() => opacityOf(el) === 1, 'revealed');
    await settled();
    const shown = scrimOf(el).getBoundingClientRect();
    expect(shown.top).toBeLessThan(rest.top);
  });
});

describe('touch', () => {
  /** A hover-less device: the controller reads `(hover: none)`. (CDP touch emulation cannot be undone.) */
  async function coarse(): Promise<() => Promise<void>> {
    const original = window.matchMedia.bind(window);
    window.matchMedia = ((query: string): MediaQueryList => {
      if (query !== '(hover: none)') return original(query);
      return Object.assign(new EventTarget(), {
        matches: true,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
      });
    });
    await nextFrame();
    return () => {
      window.matchMedia = original;
      return Promise.resolve();
    };
  }

  it('a tap toggles the overlay in hover mode on a hover-less device, and never on always/focus', async () => {
    const restore = await coarse();
    try {
      const el = await mount('show-on="hover"');
      await settled();
      expect(opacityOf(el)).toBe(0);
      el.querySelector<HTMLElement>('#media')!.click();
      await waitUntil(() => opacityOf(el) === 1, 'opened by tap');
      el.querySelector<HTMLElement>('#media')!.click();
      await waitUntil(() => opacityOf(el) === 0, 'closed by second tap');
      const always = await mount('show-on="always"');
      always.querySelector<HTMLElement>('#media')!.click();
      await settled();
      expect(opacityOf(always)).toBe(1);
    } finally {
      await restore();
    }
  });

  it('a tap on an interactive element inside does not toggle, and a forced open overrides the tap', async () => {
    const restore = await coarse();
    try {
      const el = await mount('show-on="hover"', '<button id="basebtn">base</button>');
      el.querySelector<HTMLElement>('#basebtn')!.click();
      await settled();
      expect(opacityOf(el)).toBe(0);
      el.open = false;
      await el.updateComplete;
      el.querySelector<HTMLElement>('#basebtn')!.parentElement!.click();
      await settled();
      expect(opacityOf(el)).toBe(0);
    } finally {
      await restore();
    }
  });
});

describe('a11y, rtl, forced colours', () => {
  it('passes axe in every show-on mode and scrim', async () => {
    for (const attributes of [
      '',
      'show-on="hover"',
      'show-on="focus" scrim="light"',
      'scrim="none"',
      'open',
    ]) {
      const el = await mount(attributes);
      await settled();
      await expectAccessible(el);
    }
  });

  it('renders in RTL with the strip still on the block end', async () => {
    const root = await fixture<HTMLElement>(
      `<div dir="rtl" style="padding:20px">${overlay('position="bottom"')}</div>`,
    );
    const el = root.querySelector<TctOverlay>('tct-overlay')!;
    await el.updateComplete;
    await settled();
    expect(scrimOf(el).getBoundingClientRect().bottom).toBeCloseTo(
      rootOf(el).getBoundingClientRect().bottom,
      0,
    );
  });

  it('keeps the scrim edge visible in forced colours', async () => {
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const el = await mount();
      await settled();
      const style = getComputedStyle(scrimOf(el));
      expect(style.borderTopStyle).not.toBe('none');
      expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    } finally {
      await restore();
    }
  });

  it('runs no slide under reduced motion (the fade stays)', async () => {
    const restore = await emulateMedia({reducedMotion: 'reduce'});
    try {
      const el = await mount('show-on="hover" position="bottom"');
      await settled();
      expect(getComputedStyle(scrimOf(el)).translate).toBe('none');
      expect(getComputedStyle(scrimOf(el)).transitionProperty).toBe('opacity');
    } finally {
      await restore();
    }
  });
});

runKeyboardSuite({
  tag: 'tct-overlay',
  render: () => overlay('show-on="hover"'),
  table: parity.entries['core.overlay'].keyboard,
  steps: {
    'Tab reaches hidden overlay content (it is only transparent) and focus inside the container reveals it while `show-on` is `hover` or `focus`':
      {
        setup: (el) => {
          el.parentElement!.insertAdjacentHTML('afterbegin', '<button id="before">before</button>');
          el.parentElement!.querySelector<HTMLElement>('#before')!.focus();
        },
        focus: (el) => el.parentElement!.querySelector<HTMLElement>('#before'),
        keys: ['Tab'],
        expect: async ({element}) => {
          expect(deepActiveElement()).toBe(element.querySelector('#action'));
          await waitUntil(() => opacityOf(element as TctOverlay) === 1, 'revealed');
        },
      },
  },
});

// -------------------------------------------------------------------------- container reveal

class TctTestReveal extends TctElement {
  static override readonly tagName = 'tct-test-reveal';
  static override styles = [
    base,
    containerReveal,
    css`
      :host {
        display: block;
      }
      .row {
        min-block-size: 32px;
      }
    `,
  ];
  @property({attribute: 'reveal-state'}) revealState: string | undefined;
  @property({type: Number}) delay = 0;
  @property({type: Boolean}) preserved = false;
  @property({type: Boolean}) inverted = false;
  @property({attribute: 'visibility'}) forced: string | undefined;

  override render() {
    return html`<div
      class="row reveal-container"
      data-reveal-state=${this.revealState ?? ''}
      style=${this.delay ? `--_hover-delay:${this.delay}ms` : ''}
    >
      Row
      <button
        class="${this.inverted ? 'conceal' : this.preserved ? 'reveal-preserved' : 'reveal'}"
        data-reveal-visibility=${this.forced ?? ''}
      >
        Edit
      </button>
    </div>`;
  }
}

describe('container reveal styles (useContainerReveal)', () => {
  beforeAll(() => {
    defineElement(TctTestReveal);
  });

  const reveal = async (
    attributes = '',
  ): Promise<{host: TctTestReveal; button: HTMLElement; row: HTMLElement}> => {
    const host = await fixture<TctTestReveal>(`<tct-test-reveal ${attributes}></tct-test-reveal>`);
    await host.updateComplete;
    return {
      host,
      button: host.shadowRoot!.querySelector<HTMLElement>('button')!,
      row: host.shadowRoot!.querySelector<HTMLElement>('.row')!,
    };
  };
  const opacity = (element: HTMLElement): number =>
    Number.parseFloat(getComputedStyle(element).opacity);

  it('hides revealed content out of flow at rest, keeps it in the tab order, reveals on hover', async () => {
    const {button, row} = await reveal();
    await settled();
    expect(opacity(button)).toBe(0);
    expect(getComputedStyle(button).position).toBe('absolute');
    expect(getComputedStyle(button).display).not.toBe('none');
    await userEvent.hover(row);
    await waitUntil(() => opacity(button) === 1, 'revealed');
    expect(getComputedStyle(button).position).toBe('static');
  });

  it('reveals on keyboard focus with no dwell', async () => {
    const {button} = await reveal('delay="2000"');
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(button);
    await waitUntil(() => opacity(button) === 1, 'revealed by focus-within');
  });

  it('a hover dwell delays the reveal', async () => {
    const {button, row} = await reveal('delay="400"');
    await userEvent.hover(row);
    await aTimeout(120);
    expect(opacity(button)).toBeLessThan(1);
    await waitUntil(() => opacity(button) === 1, 'revealed after the dwell');
  });

  it('inactive ignores the pointer but not keyboard focus; active pins it revealed', async () => {
    const inactive = await reveal('reveal-state="inactive"');
    await userEvent.hover(inactive.row);
    await settled();
    expect(opacity(inactive.button)).toBe(0);
    inactive.button.focus();
    await waitUntil(() => opacity(inactive.button) === 1, 'focus still reveals');
    const active = await reveal('reveal-state="active"');
    await settled();
    expect(opacity(active.button)).toBe(1);
  });

  it('preserved keeps its layout box while hidden; concealed fades out on hover only', async () => {
    const preserved = await reveal('preserved');
    await settled();
    expect(getComputedStyle(preserved.button).position).toBe('static');
    expect(opacity(preserved.button)).toBe(0);
    const concealed = await reveal('inverted');
    await settled();
    expect(opacity(concealed.button)).toBe(1);
    await userEvent.hover(concealed.row);
    await waitUntil(() => opacity(concealed.button) === 0, 'concealed by hover');
    // Focus never conceals it: a keyboard user must not watch content vanish.
    await userEvent.hover(document.body);
    concealed.button.focus();
    await waitUntil(() => opacity(concealed.button) === 1, 'visible again');
  });

  it('per-element pins: shown ignores the container, hidden yields to focus', async () => {
    const shown = await reveal('visibility="shown"');
    await settled();
    expect(opacity(shown.button)).toBe(1);
    const hidden = await reveal('visibility="hidden"');
    await userEvent.hover(hidden.row);
    await settled();
    expect(opacity(hidden.button)).toBe(0);
    hidden.button.focus();
    await waitUntil(() => opacity(hidden.button) === 1, 'focus wins over a forced hide');
  });

  it('runs no fade under reduced motion', async () => {
    const restore = await emulateMedia({reducedMotion: 'reduce'});
    try {
      const {button} = await reveal();
      expect(getComputedStyle(button).transitionDuration).toBe('0s, 0s');
    } finally {
      await restore();
    }
  });
});
