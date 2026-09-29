/**
 * tct-theme: colour mode and theme name for the subtree, the theme-island rule, the outermost theme's
 * synchronisation of `<html data-theme>`, and the themeContext (ported from upstream Theme.test.tsx).
 */
import {html} from 'lit';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {themeContext} from '@tecton-wc/core/context/keys.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {waitUntil} from '@tecton-wc/testing/timing.js';
import '../button/define.js';
import './define.js';
import type {TctTheme} from './tct-theme.js';
import {themeName} from './theme.types.js';

/** A consumer written the way any family reads the context. */
class TestThemeProbe extends TctElement {
  static override readonly tagName = 'tct-test-theme-probe';
  readonly consumer = new ContextConsumer(this, {context: themeContext, subscribe: true});
  get theme() {
    return this.consumer.value;
  }
}
defineElement(TestThemeProbe);

/** Renders a probe in its own shadow root: the request must cross the boundary. */
class TestThemeHost extends TctElement {
  static override readonly tagName = 'tct-test-theme-host';
  override render() {
    return html`<tct-test-theme-probe></tct-test-theme-probe>`;
  }
}
defineElement(TestThemeHost);

const root = document.documentElement;

async function mount(markup: string): Promise<HTMLElement> {
  return fixture<HTMLElement>(`<div>${markup}</div>`);
}

const themeIn = (container: ParentNode, selector = 'tct-theme'): TctTheme =>
  container.querySelector<TctTheme>(selector)!;
const probeIn = (container: ParentNode, selector = 'tct-test-theme-probe'): TestThemeProbe =>
  container.querySelector<TestThemeProbe>(selector)!;

afterEach(() => {
  globalThis.tctDevMode = undefined;
  root.removeAttribute('data-theme');
  root.removeAttribute('data-tct-theme');
});

runElementSuite({
  tag: 'tct-theme',
  render: () => html`<tct-theme mode="light"><tct-button>Save</tct-button></tct-theme>`,
  properties: {mode: 'dark', theme: 'tecton'},
  attributes: {mode: 'mode', theme: 'theme'},
  // A theme island is a block that paints the surface: that is its job (A§8.1, theme-island rule).
  hostBox: false,
  shadow: false,
});

describe('tct-theme: mode and name (Theme.test.tsx)', () => {
  it('defaults to the tecton theme in system mode, and reflects the mode', async () => {
    const container = await mount('<tct-theme></tct-theme>');
    const theme = themeIn(container);
    expect(theme.mode).toBe('system');
    expect(theme.getAttribute('mode')).toBe('system');
    expect(theme.getAttribute('data-tct-theme')).toBe('tecton');
    expect(theme.hasAttribute('data-theme')).toBe(false);
  });

  it.each(['light', 'dark'] as const)(
    'mode %s sets data-theme and pins color-scheme',
    async (mode) => {
      const container = await mount(`<tct-theme mode="${mode}"></tct-theme>`);
      const theme = themeIn(container);
      expect(theme.getAttribute('data-theme')).toBe(mode);
      expect(getComputedStyle(theme).colorScheme).toBe(mode);
    },
  );

  it('system mode lets the operating system choose (color-scheme: light dark)', async () => {
    const container = await mount('<tct-theme></tct-theme>');
    expect(getComputedStyle(themeIn(container)).colorScheme).toBe('light dark');
  });

  it('accepts a theme object with a name, and falls back to tecton without one', async () => {
    expect(themeName({name: 'ocean'})).toBe('ocean');
    expect(themeName('ocean')).toBe('ocean');
    expect(themeName('')).toBe('tecton');
    expect(themeName(undefined)).toBe('tecton');
    const container = await mount('<tct-theme></tct-theme>');
    const theme = themeIn(container);
    theme.theme = {name: 'ocean'};
    await theme.updateComplete;
    expect(theme.getAttribute('data-tct-theme')).toBe('ocean');
    theme.theme = '';
    await theme.updateComplete;
    expect(theme.getAttribute('data-tct-theme')).toBe('tecton');
  });

  it('changing the mode updates the attribute, the colour scheme and the context', async () => {
    const container = await mount(
      '<tct-theme mode="light"><tct-test-theme-probe></tct-test-theme-probe></tct-theme>',
    );
    const theme = themeIn(container);
    expect(probeIn(container).theme).toEqual({name: 'tecton', mode: 'light'});
    theme.mode = 'dark';
    await theme.updateComplete;
    expect(theme.getAttribute('data-theme')).toBe('dark');
    expect(getComputedStyle(theme).colorScheme).toBe('dark');
    expect(probeIn(container).theme).toEqual({name: 'tecton', mode: 'dark'});
    theme.mode = 'system';
    await theme.updateComplete;
    expect(theme.hasAttribute('data-theme')).toBe(false);
  });

  it('warns in dev mode about a mode that is not light, dark or system', async () => {
    globalThis.tctDevMode = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const container = await mount('<tct-theme mode="sepia"></tct-theme>');
      expect(getComputedStyle(themeIn(container)).colorScheme).toBe('light dark');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('tct-theme'));
    } finally {
      warn.mockRestore();
    }
  });
});

describe('tct-theme: theme island', () => {
  it('is a block that paints the page surface and text colour', async () => {
    const container = await mount('<tct-theme mode="light">Text</tct-theme>');
    const theme = themeIn(container);
    const style = getComputedStyle(theme);
    expect(style.display).toBe('block');
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'var(--color-background-body)';
    probe.style.color = 'var(--color-text-primary)';
    theme.append(probe);
    expect(style.backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
    expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(style.color).toBe(getComputedStyle(probe).color);
    probe.remove();
  });

  it('recolours descendants: a dark island differs from a light one', async () => {
    const container = await mount(
      '<tct-theme id="l" mode="light">A</tct-theme><tct-theme id="d" mode="dark">B</tct-theme>',
    );
    const light = getComputedStyle(themeIn(container, '#l'));
    const dark = getComputedStyle(themeIn(container, '#d'));
    expect(dark.backgroundColor).not.toBe(light.backgroundColor);
    expect(dark.color).not.toBe(light.color);
  });

  it('a dark island inside a light page recolours the tokens its children read', async () => {
    const container = await mount(
      '<tct-theme mode="light"><tct-theme mode="dark"><span id="in">x</span></tct-theme><span id="out">y</span></tct-theme>',
    );
    const read = (element: Element) =>
      getComputedStyle(element).getPropertyValue('--color-background-body').trim();
    // Custom properties holding light-dark() resolve per element, so compare what they paint.
    const paint = (element: Element): string => {
      const probe = document.createElement('i');
      probe.style.backgroundColor = 'var(--color-background-body)';
      element.append(probe);
      const colour = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return colour;
    };
    expect(read(container.querySelector('#in')!)).toBe(read(container.querySelector('#out')!));
    expect(paint(container.querySelector('#in')!)).not.toBe(
      paint(container.querySelector('#out')!),
    );
  });

  it('a system island inside a forced dark one follows the operating system, not the parent', async () => {
    const restore = await emulateMedia({colorScheme: 'light'});
    try {
      const container = await mount(
        '<tct-theme mode="dark"><tct-theme id="sys"><tct-test-theme-probe></tct-test-theme-probe></tct-theme></tct-theme>',
      );
      expect(getComputedStyle(themeIn(container, '#sys')).colorScheme).toBe('light dark');
      expect(probeIn(container).theme).toEqual({name: 'tecton', mode: 'light'});
    } finally {
      await restore();
    }
  });

  it('is hidden by the hidden attribute', async () => {
    const container = await mount('<tct-theme hidden>Text</tct-theme>');
    expect(getComputedStyle(themeIn(container)).display).toBe('none');
  });

  it.skipIf(!isChromium)('lays out and paints in forced colours with system colours', async () => {
    const restore = await emulateMedia({forcedColors: 'active'});
    try {
      const container = await mount('<tct-theme mode="dark">Text</tct-theme>');
      const style = getComputedStyle(themeIn(container));
      expect(style.display).toBe('block');
      expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    } finally {
      await restore();
    }
  });
});

describe('tct-theme: system mode follows the operating system', () => {
  it.skipIf(!isChromium)('resolves to the emulated preference and follows changes', async () => {
    const restoreLight = await emulateMedia({colorScheme: 'light'});
    const container = await mount(
      '<tct-theme><tct-test-theme-probe></tct-test-theme-probe></tct-theme>',
    );
    expect(probeIn(container).theme?.mode).toBe('light');
    await emulateMedia({colorScheme: 'dark'});
    await waitUntil(() => probeIn(container).theme?.mode === 'dark', 'dark preference');
    await emulateMedia({colorScheme: 'light'});
    await waitUntil(() => probeIn(container).theme?.mode === 'light', 'light preference again');
    await restoreLight();
  });

  it.skipIf(!isChromium)('a forced mode ignores the preference', async () => {
    const restore = await emulateMedia({colorScheme: 'dark'});
    try {
      const container = await mount(
        '<tct-theme mode="light"><tct-test-theme-probe></tct-test-theme-probe></tct-theme>',
      );
      expect(probeIn(container).theme?.mode).toBe('light');
    } finally {
      await restore();
    }
  });
});

describe('tct-theme: themeContext', () => {
  it('serves {name, mode} to consumers in the subtree only', async () => {
    const container = await mount(
      '<tct-theme mode="dark" theme="tecton"><tct-test-theme-probe id="in"></tct-test-theme-probe></tct-theme><tct-test-theme-probe id="out"></tct-test-theme-probe>',
    );
    expect(probeIn(container, '#in').theme).toEqual({name: 'tecton', mode: 'dark'});
    expect(probeIn(container, '#out').theme).toBeUndefined();
  });

  it('the nearest theme wins, and consumers in shadow roots are served', async () => {
    const container = await mount(
      '<tct-theme mode="light"><tct-theme mode="dark" theme="ocean"><tct-test-theme-host></tct-test-theme-host></tct-theme></tct-theme>',
    );
    const inner = container
      .querySelector('tct-test-theme-host')!
      .shadowRoot!.querySelector<TestThemeProbe>('tct-test-theme-probe')!;
    await inner.updateComplete;
    expect(inner.theme).toEqual({name: 'ocean', mode: 'dark'});
  });

  it('a new value object only when name or resolved mode changed', async () => {
    const container = await mount(
      '<tct-theme mode="dark"><tct-test-theme-probe></tct-test-theme-probe></tct-theme>',
    );
    const theme = themeIn(container);
    const before = probeIn(container).theme;
    theme.theme = 'tecton';
    theme.mode = 'dark';
    await theme.updateComplete;
    expect(probeIn(container).theme).toBe(before);
    theme.theme = 'other';
    await theme.updateComplete;
    expect(probeIn(container).theme).not.toBe(before);
  });
});

describe('tct-theme: <html> synchronisation', () => {
  it('the outermost theme sets data-theme and data-tct-theme on <html>', async () => {
    await mount('<tct-theme mode="dark"></tct-theme>');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.getAttribute('data-tct-theme')).toBe('tecton');
  });

  it('system mode leaves data-theme off <html>, and follows mode changes', async () => {
    const container = await mount('<tct-theme mode="light"></tct-theme>');
    const theme = themeIn(container);
    expect(root.getAttribute('data-theme')).toBe('light');
    theme.mode = 'system';
    await theme.updateComplete;
    expect(root.hasAttribute('data-theme')).toBe(false);
    theme.mode = 'dark';
    await theme.updateComplete;
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('a nested theme is an island: it does not touch <html>', async () => {
    await mount(
      '<tct-theme mode="light"><tct-theme mode="dark" theme="inner"></tct-theme></tct-theme>',
    );
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.getAttribute('data-tct-theme')).toBe('tecton');
  });

  it('puts back what was on <html> when the theme goes away', async () => {
    root.setAttribute('data-theme', 'light');
    root.setAttribute('data-tct-theme', 'previous');
    const container = await mount('<tct-theme mode="dark" theme="ocean"></tct-theme>');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(root.getAttribute('data-tct-theme')).toBe('ocean');
    container.remove();
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.getAttribute('data-tct-theme')).toBe('previous');
  });

  it('removes the attributes again when there was nothing before', async () => {
    const container = await mount('<tct-theme mode="dark"></tct-theme>');
    container.remove();
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(root.hasAttribute('data-tct-theme')).toBe(false);
  });

  it('with two sibling roots the first one owns <html>, and the next takes over when it leaves', async () => {
    const container = await mount(
      '<tct-theme id="a" mode="light"></tct-theme><tct-theme id="b" mode="dark"></tct-theme>',
    );
    expect(root.getAttribute('data-theme')).toBe('light');
    themeIn(container, '#a').remove();
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('a theme that upgrades inside another is not left as a root', async () => {
    const outer = document.createElement('tct-theme');
    outer.setAttribute('mode', 'light');
    const inner = document.createElement('tct-theme');
    inner.setAttribute('mode', 'dark');
    outer.append(inner);
    document.body.append(outer);
    try {
      await inner.updateComplete;
      expect(root.getAttribute('data-theme')).toBe('light');
    } finally {
      outer.remove();
    }
  });
});

describe('tct-theme: element contract', () => {
  it('has no shadow root, no role, and leaves its children untouched (no marker nodes)', async () => {
    const container = await mount('<tct-theme mode="dark"><tct-button>Go</tct-button></tct-theme>');
    const theme = themeIn(container);
    expect(theme.shadowRoot).toBeNull();
    expect(theme.hasAttribute('role')).toBe(false);
    expect([...theme.childNodes].map((node) => node.nodeName.toLowerCase())).toEqual([
      'tct-button',
    ]);
  });

  it('works under RTL', async () => {
    const container = await fixture<HTMLElement>(
      '<div><tct-theme mode="dark"><tct-button>Go</tct-button></tct-theme></div>',
      {dir: 'rtl'},
    );
    expect(getComputedStyle(themeIn(container)).direction).toBe('rtl');
  });

  it('passes axe in light and dark, with contrast on the painted surface', async () => {
    for (const mode of ['light', 'dark']) {
      const container = await mount(
        `<tct-theme mode="${mode}"><tct-button>Save</tct-button><tct-button variant="primary">Send</tct-button></tct-theme>`,
      );
      await expectAccessible(container);
    }
  });
});
