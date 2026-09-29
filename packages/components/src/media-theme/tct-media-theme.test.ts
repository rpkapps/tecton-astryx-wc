/**
 * tct-media-theme: modes (ported from upstream MediaTheme.dom.test.tsx), the measured `auto` mode in
 * a real browser (jsdom could not paint), recolouring of descendants including the D-005 focus ring,
 * the flat-tree surface, re-measuring, themeContext, light-DOM structure, forced colours.
 */
import {html, LitElement} from 'lit';
import {afterEach, beforeAll, describe, expect, it, onTestFinished, vi} from 'vitest';
import {themeContext} from '@tecton-astryx/core/context/keys.js';
import {ContextConsumer, ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {defineElement} from '@tecton-astryx/core/define.js';
import {features} from '@tecton-astryx/core/features.js';
import {resetDevWarnings} from '@tecton-astryx/core/utils/dev.js';
import {expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {waitUntil} from '@tecton-astryx/testing/timing.js';
import './define.js';
import type {TctMediaTheme} from './tct-media-theme.js';

const ATTRIBUTE = 'data-media-theme';
const DARK_SURFACE = 'rgb(10, 19, 23)';
const LIGHT_SURFACE = 'rgb(250, 250, 252)';

/** A stand-in for any element that reads the theme: shows the mode it received. */
class TestThemeReader extends LitElement {
  readonly consumer = new ContextConsumer(this, {context: themeContext, subscribe: true});
  protected override render() {
    const value = this.consumer.value;
    return html`<span data-name=${value?.name ?? 'none'} data-mode=${value?.mode ?? 'none'}
      >${value?.mode ?? 'none'}</span
    >`;
  }
}

/** A stand-in for tct-theme (WP-F): provides a named theme and a mode. */
class TestThemeProvider extends LitElement {
  readonly provider = new ContextProvider(this, {
    context: themeContext,
    initialValue: {name: 'acme', mode: 'dark'},
  });
  protected override render() {
    return html`<slot></slot>`;
  }
}

/** A card-like element: the painted surface lives in its shadow root, the content is slotted. */
class TestSurface extends LitElement {
  protected override render() {
    return html`<div style="background: rgb(10, 19, 23); padding: 8px"><slot></slot></div>`;
  }
}

beforeAll(() => {
  for (const [tag, ctor] of [
    ['test-theme-reader', TestThemeReader],
    ['test-theme-provider', TestThemeProvider],
    ['test-surface', TestSurface],
  ] as const) {
    if (!customElements.get(tag)) customElements.define(tag, ctor);
  }
});

afterEach(() => {
  globalThis.tctDevMode = undefined;
  resetDevWarnings();
});

const theme = (root: ParentNode, selector = 'tct-media-theme') =>
  root.querySelector<TctMediaTheme>(selector)!;
const media = (element: Element) => element.getAttribute(ATTRIBUTE);
const seen = (reader: Element) => {
  const span = reader.shadowRoot!.querySelector('span')!;
  return {name: span.dataset.name, mode: span.dataset.mode};
};

async function surface(
  mode: string,
  background: string,
  extra = '',
  content = '<span>content</span>',
) {
  const root = await fixture<HTMLElement>(
    `<div style="background: ${background}"><tct-media-theme mode="${mode}" ${extra}>${content}</tct-media-theme></div>`,
  );
  return {root, element: theme(root)};
}

/** The computed value of `property: var(token)` on a probe inside `context`. */
function paint(context: Element, token: string, property = 'color'): string {
  const probe = document.createElement('span');
  probe.style.setProperty(property, `var(${token})`);
  context.append(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
}

/** The value a token has inside a `data-theme` island: what the media context must equal. */
function island(scheme: 'light' | 'dark', token: string, property = 'color'): string {
  const host = document.createElement('div');
  host.dataset.theme = scheme;
  document.body.append(host);
  const value = paint(host, token, property);
  host.remove();
  return value;
}

/**
 * The shared `runElementSuite` asserts a shadow root after reconnecting, which a light-DOM provider
 * cannot have; this is its lifecycle contract without that assertion (request recorded in
 * parity.json: a `lightDom` option for the suite).
 */
describe('tct-media-theme: element lifecycle', () => {
  const properties = {mode: 'light', fallback: 'light'} as const;
  const mount = () =>
    fixture<HTMLElement>(
      '<div style="background: var(--color-background-inverted)"><tct-media-theme mode="dark"><span>content</span></tct-media-theme></div>',
    ).then((root) => theme(root));

  it('is registered under its tag, and registering again is a no-op without warnings', () => {
    const ctor = customElements.get('tct-media-theme')!;
    expect(ctor).toBeDefined();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      defineElement(ctor as Parameters<typeof defineElement>[0]);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('applies properties that were set before the element upgraded', async () => {
    const early = document.implementation.createHTMLDocument('').createElement('tct-media-theme');
    Object.assign(early, properties);
    const container = await fixture<HTMLElement>('<div></div>');
    const adopted = document.adoptNode(early);
    container.append(adopted);
    await adopted.updateComplete;
    expect(adopted.mode).toBe('light');
    expect(adopted.fallback).toBe('light');
    expect(media(adopted)).toBe('light');
  });

  it('keeps its state across disconnect and reconnect, without errors', async () => {
    const element = await mount();
    Object.assign(element, properties);
    await element.updateComplete;
    const parent = element.parentElement!;
    element.remove();
    parent.append(element);
    element.remove();
    parent.append(element);
    await element.updateComplete;
    expect(element.isConnected).toBe(true);
    expect(element.mode).toBe('light');
    expect(element.fallback).toBe('light');
    expect(media(element)).toBe('light');
  });

  it.skipIf(!features.moveBefore)('moveBefore() keeps state and does not disconnect', async () => {
    const element = await mount();
    const target = document.createElement('div');
    element.parentElement!.after(target);
    onTestFinished(() => target.remove());
    let disconnected = 0;
    const original = element.disconnectedCallback.bind(element);
    element.disconnectedCallback = () => {
      disconnected++;
      original();
    };
    (target as unknown as {moveBefore(node: Node, ref: Node | null): void}).moveBefore(
      element,
      null,
    );
    expect(element.parentElement).toBe(target);
    expect(disconnected).toBe(0);
    expect(media(element)).toBe('dark');
  });

  it('emits no events when properties or attributes are written', async () => {
    const element = await mount();
    const seen: string[] = [];
    for (const name of ['input', 'change']) {
      document.addEventListener(name, (event) => seen.push(event.type), true);
    }
    Object.assign(element, properties);
    element.setAttribute('mode', 'off');
    await element.updateComplete;
    expect(seen).toEqual([]);
  });

  it('the host draws no box: padding, border and background are initial', async () => {
    const element = await mount();
    const style = getComputedStyle(element);
    for (const side of ['Top', 'Right', 'Bottom', 'Left'] as const) {
      expect(style[`padding${side}`]).toBe('0px');
      expect(style[`border${side}Width`]).toBe('0px');
    }
    expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('the default render passes axe', async () => {
    await expectAccessible((await mount()).parentElement!);
  });
});

describe('tct-media-theme (MediaTheme.dom.test.tsx)', () => {
  it.each(['dark', 'light'] as const)('applies mode=%s verbatim', async (mode) => {
    const {element} = await surface(mode, DARK_SURFACE);
    expect(media(element)).toBe(mode);
  });

  it('renders no media attribute for mode="off"', async () => {
    const {element} = await surface('off', DARK_SURFACE);
    expect(element.hasAttribute(ATTRIBUTE)).toBe(false);
  });

  it('still renders its element for mode="off" so children never re-create', async () => {
    const {root, element} = await surface('off', DARK_SURFACE);
    const child = element.querySelector('span')!;
    element.mode = 'dark';
    await element.updateComplete;
    element.mode = 'off';
    await element.updateComplete;
    expect(element.isConnected).toBe(true);
    expect(theme(root)).toBe(element);
    expect(element.querySelector('span')).toBe(child);
    expect(element.localName).toBe('tct-media-theme');
  });

  it('falls back to dark for an unmeasurable auto surface', async () => {
    const {element} = await surface('auto', 'linear-gradient(black, black)');
    expect(media(element)).toBe('dark');
  });

  it('honors an explicit fallback', async () => {
    const {element} = await surface('auto', 'linear-gradient(black, black)', 'fallback="light"');
    expect(media(element)).toBe('light');
  });

  it('ignores fallback when the mode is explicit', async () => {
    const {element} = await surface('dark', DARK_SURFACE, 'fallback="light"');
    expect(media(element)).toBe('dark');
  });

  it('leaves no probe element behind', async () => {
    const {element} = await surface('auto', DARK_SURFACE);
    expect(element.parentElement!.querySelectorAll('span')).toHaveLength(1);
    expect(element.parentElement!.children).toHaveLength(1);
  });

  it('defaults to auto with a dark fallback, and reflects both', async () => {
    const element = await fixture<HTMLElement>('<tct-media-theme>x</tct-media-theme>').then(
      (root) => root as TctMediaTheme,
    );
    expect(element.mode).toBe('auto');
    expect(element.fallback).toBe('dark');
    expect(element.getAttribute('mode')).toBe('auto');
    expect(element.getAttribute('fallback')).toBe('dark');
  });
});

describe('tct-media-theme: mode="auto" measures the painted surface', () => {
  it('picks dark for a dark surface on a light page', async () => {
    const {element} = await surface('auto', DARK_SURFACE, 'fallback="light"');
    expect(media(element)).toBe('dark');
  });

  it('picks no media context when the ambient text already reads on the surface', async () => {
    const {element} = await surface('auto', LIGHT_SURFACE, 'fallback="dark"');
    expect(element.hasAttribute(ATTRIBUTE)).toBe(false);
  });

  it('picks light for a pale surface where the ambient text does not read (dark page)', async () => {
    const root = await fixture<HTMLElement>(
      `<div><div style="background: ${LIGHT_SURFACE}"><tct-media-theme mode="auto" fallback="dark">x</tct-media-theme></div></div>`,
      {theme: 'dark'},
    );
    expect(media(theme(root))).toBe('light');
  });

  it('measures the token surface --color-background-inverted, in both schemes', async () => {
    const markup =
      '<div style="background: var(--color-background-inverted)"><tct-media-theme mode="auto" fallback="dark">x</tct-media-theme></div>';
    const light = await fixture<HTMLElement>(markup);
    expect(media(theme(light))).toBe('dark');
    const dark = await fixture<HTMLElement>(markup, {theme: 'dark'});
    // The inverted surface is pale in dark mode: dark text on it, so the light side.
    expect(media(theme(dark))).toBe('light');
  });

  it('composites a translucent surface over its opaque ancestor', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="background: white"><div style="background: rgba(0, 0, 0, 0.9)"><tct-media-theme mode="auto" fallback="light">x</tct-media-theme></div></div>`,
    );
    expect(media(theme(root))).toBe('dark');
  });

  it('reads a colour the engine serialises as color(srgb …) (color-mix)', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="background: color-mix(in srgb, black 92%, white)"><tct-media-theme mode="auto" fallback="light">x</tct-media-theme></div>`,
    );
    expect(media(theme(root))).toBe('dark');
  });

  it('reads a colour in a space the parser does not know (oklch) through the canvas', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="background: oklch(0.2 0.02 300)"><tct-media-theme mode="auto" fallback="light">x</tct-media-theme></div>`,
    );
    expect(media(theme(root))).toBe('dark');
  });

  it('uses the fallback when there is no opaque layer at all', async () => {
    const root = await fixture<HTMLElement>(
      `<div><tct-media-theme mode="auto" fallback="light">x</tct-media-theme></div>`,
    );
    expect(media(theme(root))).toBe('light');
  });

  it('uses the fallback over a background-image anywhere in the chain', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="background-image: linear-gradient(white, white)"><div style="background: ${DARK_SURFACE}"><tct-media-theme mode="auto" fallback="light">x</tct-media-theme></div></div>`,
    );
    // The nearest layer is opaque and dark, so the walk stops before the image.
    expect(media(theme(root))).toBe('dark');
    const image = await fixture<HTMLElement>(
      `<div style="background: white"><div style="background: rgba(0, 0, 0, 0.5) linear-gradient(black, black)"><tct-media-theme mode="auto" fallback="light">x</tct-media-theme></div></div>`,
    );
    expect(media(theme(image))).toBe('light');
  });

  it('skips a display: contents ancestor, which paints nothing', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="background: ${DARK_SURFACE}"><div style="display: contents; background: white"><tct-media-theme mode="auto" fallback="light">x</tct-media-theme></div></div>`,
    );
    expect(media(theme(root))).toBe('dark');
  });

  it('measures through a slot: the painted base inside a shadow root is the surface', async () => {
    const root = await fixture<HTMLElement>(
      `<test-surface><tct-media-theme mode="auto" fallback="light">x</tct-media-theme></test-surface>`,
    );
    // The host is transparent; the base in its shadow root is dark.
    expect(getComputedStyle(root).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(media(theme(root))).toBe('dark');
  });

  it('measures the parent, never itself: its own attribute does not feed back', async () => {
    const {element} = await surface('auto', DARK_SURFACE);
    const first = media(element);
    element.mode = 'off';
    await element.updateComplete;
    element.mode = 'auto';
    await element.updateComplete;
    expect(media(element)).toBe(first);
  });
});

describe('tct-media-theme: re-measuring', () => {
  it('re-measures when the surface style changes', async () => {
    const {root, element} = await surface('auto', DARK_SURFACE);
    expect(media(element)).toBe('dark');
    root.style.background = LIGHT_SURFACE;
    await waitUntil(
      () => !element.hasAttribute(ATTRIBUTE),
      'light surface drops the media context',
    );
    root.style.background = DARK_SURFACE;
    await waitUntil(() => media(element) === 'dark', 'dark surface restores it');
  });

  it('re-measures when a class on the surface changes its paint', async () => {
    const style = document.createElement('style');
    style.textContent = '.tct-test-dark { background: rgb(10, 19, 23) }';
    document.head.append(style);
    try {
      const root = await fixture<HTMLElement>(
        '<div style="background: white" class="tct-test-plain"><tct-media-theme mode="auto">x</tct-media-theme></div>',
      );
      const element = theme(root);
      expect(element.hasAttribute(ATTRIBUTE)).toBe(false);
      root.style.background = '';
      root.classList.add('tct-test-dark');
      await waitUntil(() => media(element) === 'dark', 'class change re-measured');
    } finally {
      style.remove();
    }
  });

  it('re-measures when data-theme flips on an ancestor', async () => {
    const root = await fixture<HTMLElement>(
      `<div><div style="background: var(--color-background-inverted)"><tct-media-theme mode="auto">x</tct-media-theme></div></div>`,
    );
    const element = theme(root);
    expect(media(element)).toBe('dark');
    root.dataset.theme = 'dark';
    await waitUntil(() => media(element) === 'light', 'theme flip re-measured');
  });

  it('re-measures when the system colour scheme changes', async () => {
    const {element} = await surface('auto', 'var(--color-background-inverted)');
    expect(media(element)).toBe('dark');
    await emulateMedia({colorScheme: 'dark'});
    await waitUntil(() => media(element) === 'light', 'system scheme re-measured');
  });

  it('stops observing when disconnected and resumes when reconnected', async () => {
    const {root, element} = await surface('auto', DARK_SURFACE);
    element.remove();
    root.style.background = LIGHT_SURFACE;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(media(element)).toBe('dark');
    root.append(element);
    await waitUntil(() => !element.hasAttribute(ATTRIBUTE), 'reconnect measures again');
  });

  it('does not watch when the mode is explicit', async () => {
    const {root, element} = await surface('dark', DARK_SURFACE);
    root.style.background = LIGHT_SURFACE;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(media(element)).toBe('dark');
  });

  it('starts measuring when mode switches to auto, and stops when it leaves', async () => {
    const {root, element} = await surface('off', DARK_SURFACE);
    element.mode = 'auto';
    await element.updateComplete;
    expect(media(element)).toBe('dark');
    element.mode = 'off';
    await element.updateComplete;
    root.style.background = LIGHT_SURFACE;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(element.hasAttribute(ATTRIBUTE)).toBe(false);
  });

  it('re-applies the fallback side when fallback changes on an unmeasurable surface', async () => {
    const {element} = await surface('auto', 'linear-gradient(black, black)');
    expect(media(element)).toBe('dark');
    element.fallback = 'light';
    await element.updateComplete;
    expect(media(element)).toBe('light');
  });
});

describe('tct-media-theme: recolours descendants (the token pipeline blocks)', () => {
  it('flips the colour scheme and the text, surface and border roles for mode="dark"', async () => {
    const {element} = await surface('dark', DARK_SURFACE, '', '<p>content</p>');
    const child = element.querySelector('p')!;
    expect(getComputedStyle(element).colorScheme).toBe('dark');
    expect(getComputedStyle(child).colorScheme).toBe('dark');
    for (const token of [
      '--color-text-primary',
      '--color-text-secondary',
      '--color-background-surface',
      '--color-border',
    ]) {
      expect(paint(child, token), token).toBe(island('dark', token));
    }
    // The icon and accent inks are the on-media colour of the side.
    expect(paint(child, '--color-icon-primary')).toBe(paint(child, '--color-on-dark'));
    expect(paint(child, '--color-accent')).toBe(paint(child, '--color-on-dark'));
    // and it is a real change: the page is light
    expect(paint(child, '--color-text-primary')).not.toBe(island('light', '--color-text-primary'));
  });

  it('pins the light side for mode="light" on a dark page', async () => {
    const root = await fixture<HTMLElement>(
      `<div><tct-media-theme mode="light"><p>content</p></tct-media-theme></div>`,
      {theme: 'dark'},
    );
    const child = root.querySelector('p')!;
    expect(getComputedStyle(child).colorScheme).toBe('light');
    for (const token of ['--color-text-primary', '--color-background-surface', '--color-border']) {
      expect(paint(child, token), token).toBe(island('light', token));
    }
  });

  it('colours the content with the text role of its side (inherited colour)', async () => {
    const {element} = await surface('dark', DARK_SURFACE, '', '<p>content</p>');
    expect(getComputedStyle(element.querySelector('p')!).color).toBe(
      island('dark', '--color-text-primary'),
    );
  });

  it('re-points the focus ring and its inner ring (D-005) to the surface side', async () => {
    const {element} = await surface('dark', DARK_SURFACE, '', '<p>content</p>');
    const child = element.querySelector('p')!;
    const ring = paint(child, '--focus-outline-color', 'outline-color');
    expect(ring).toBe(island('dark', '--focus-outline-color', 'outline-color'));
    expect(ring).not.toBe(island('light', '--focus-outline-color', 'outline-color'));
    expect(paint(child, '--tecton-color-focus-inner', 'background-color')).toBe(
      island('dark', '--tecton-color-focus-inner', 'background-color'),
    );
    expect(paint(child, '--tecton-color-focus-inner', 'background-color')).not.toBe(
      island('light', '--tecton-color-focus-inner', 'background-color'),
    );
  });

  it('keeps the ambient theme for mode="off"', async () => {
    const {element} = await surface('off', DARK_SURFACE, '', '<p>content</p>');
    const child = element.querySelector('p')!;
    expect(paint(child, '--color-text-primary')).toBe(island('light', '--color-text-primary'));
  });

  it('nests: an inner context wins, and leaving it restores the outer one', async () => {
    const root = await fixture<HTMLElement>(
      `<tct-media-theme mode="dark" id="outer"><p id="a">a</p><tct-media-theme mode="light" id="inner"><p id="b">b</p></tct-media-theme><p id="c">c</p></tct-media-theme>`,
    );
    const token = '--color-text-primary';
    expect(paint(root.querySelector('#a')!, token)).toBe(island('dark', token));
    expect(paint(root.querySelector('#b')!, token)).toBe(island('light', token));
    expect(paint(root.querySelector('#c')!, token)).toBe(island('dark', token));
  });

  it('paints no background of its own (the parent owns the surface)', async () => {
    const {element} = await surface('dark', DARK_SURFACE);
    const style = getComputedStyle(element);
    expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
    expect(style.backgroundImage).toBe('none');
  });

  it('passes axe for text on the token surface, in both schemes (the pipeline reads on it)', async () => {
    const markup =
      '<div style="background: var(--color-background-inverted); padding: 16px"><tct-media-theme mode="auto"><p>Readable text on the surface.</p><p style="color: var(--color-text-secondary)">Secondary text.</p></tct-media-theme></div>';
    await expectAccessible(await fixture<HTMLElement>(markup));
    await expectAccessible(await fixture<HTMLElement>(markup, {theme: 'dark'}));
  });
});

describe('tct-media-theme: light DOM, no box', () => {
  it('has no shadow root and adds no nodes: only the authored children remain', async () => {
    const {element} = await surface('dark', DARK_SURFACE, '', '<span>a</span><b>b</b>');
    expect(element.shadowRoot).toBeNull();
    expect(element.childNodes).toHaveLength(2);
  });

  it('is display: contents, so its children are the flex items of the parent', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="display: flex; gap: 10px; inline-size: 300px"><tct-media-theme mode="dark"><span style="inline-size: 50px">a</span><span style="inline-size: 50px">b</span></tct-media-theme></div>`,
    );
    const [a, b] = Array.from(root.querySelectorAll('span'));
    expect(getComputedStyle(theme(root)).display).toBe('contents');
    expect(b!.getBoundingClientRect().left - a!.getBoundingClientRect().right).toBe(10);
  });

  it('renders nothing for the hidden attribute', async () => {
    const {element} = await surface('dark', DARK_SURFACE);
    element.hidden = true;
    expect(getComputedStyle(element).display).toBe('none');
  });

  it('carries no role and adds nothing to the accessibility semantics', async () => {
    const {element} = await surface('dark', DARK_SURFACE);
    expect(element.getAttribute('role')).toBeNull();
    expect(element.tabIndex).toBe(-1);
  });

  it('is styled once per root even with several instances', async () => {
    const root = await fixture<HTMLElement>(
      `<div><tct-media-theme mode="dark">a</tct-media-theme><tct-media-theme mode="light">b</tct-media-theme></div>`,
    );
    for (const element of root.querySelectorAll('tct-media-theme')) {
      expect(getComputedStyle(element).display).toBe('contents');
    }
  });

  it('warns in dev mode for a mode or fallback it does not know', async () => {
    globalThis.tctDevMode = true;
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message: string) => warnings.push(message);
    try {
      const {element} = await surface('sideways', DARK_SURFACE, 'fallback="middle"');
      expect(element.getAttribute(ATTRIBUTE)).toBeNull();
      expect(warnings.some((warning) => warning.includes('mode="sideways"'))).toBe(true);
      expect(warnings.some((warning) => warning.includes('fallback="middle"'))).toBe(true);
    } finally {
      console.warn = original;
    }
  });
});

describe('tct-media-theme: themeContext', () => {
  const READER = '<test-theme-reader></test-theme-reader>';

  it('publishes the resolved side to descendants', async () => {
    const {element} = await surface('dark', DARK_SURFACE, '', READER);
    const reader = element.querySelector<TestThemeReader>('test-theme-reader')!;
    await reader.updateComplete;
    expect(seen(reader)).toEqual({name: 'tecton', mode: 'dark'});
  });

  it('follows changes of the mode', async () => {
    const {element} = await surface('dark', DARK_SURFACE, '', READER);
    const reader = element.querySelector<TestThemeReader>('test-theme-reader')!;
    element.mode = 'light';
    await element.updateComplete;
    await reader.updateComplete;
    expect(seen(reader).mode).toBe('light');
  });

  it('keeps the name of the enclosing theme and, for off, its mode', async () => {
    const root = await fixture<HTMLElement>(
      `<test-theme-provider><tct-media-theme mode="off">${READER}</tct-media-theme><tct-media-theme mode="light">${READER}</tct-media-theme></test-theme-provider>`,
    );
    const [off, light] = Array.from(root.querySelectorAll<TestThemeReader>('test-theme-reader'));
    await off!.updateComplete;
    await light!.updateComplete;
    expect(seen(off!)).toEqual({name: 'acme', mode: 'dark'});
    expect(seen(light!)).toEqual({name: 'acme', mode: 'light'});
  });

  it('follows the enclosing theme when it changes while off', async () => {
    const root = await fixture<HTMLElement>(
      `<test-theme-provider><tct-media-theme mode="off">${READER}</tct-media-theme></test-theme-provider>`,
    );
    const reader = root.querySelector<TestThemeReader>('test-theme-reader')!;
    (root as TestThemeProvider).provider.setValue({name: 'acme', mode: 'light'});
    await waitUntil(() => seen(reader).mode === 'light', 'enclosing theme change delivered');
  });
});

describe('tct-media-theme: RTL and forced colours', () => {
  it('behaves the same under dir="rtl"', async () => {
    const root = await fixture<HTMLElement>(
      `<div style="background: ${DARK_SURFACE}"><tct-media-theme mode="auto" fallback="light">x</tct-media-theme></div>`,
      {dir: 'rtl'},
    );
    expect(media(theme(root))).toBe('dark');
  });

  it('smoke: keeps the context and passes axe under forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const {root, element} = await surface('dark', DARK_SURFACE, '', '<p>content</p>');
    expect(media(element)).toBe('dark');
    await expectAccessible(root);
  });
});
