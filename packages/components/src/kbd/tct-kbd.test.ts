/**
 * tct-kbd: key parsing, platform-aware mod, spoken accessible name (ported from upstream
 * Kbd.test.tsx), RTL, forced colours.
 */
import {html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {axNode, expectAccessible} from '@tecton-astryx/testing/a11y.js';
import {emulateMedia} from '@tecton-astryx/testing/emulate.js';
import {fixture} from '@tecton-astryx/testing/fixture.js';
import {runElementSuite} from '@tecton-astryx/testing/suites/element.js';
import {isChromium} from '@tecton-astryx/testing/tier.js';
import {isApplePlatform, keyDisplay, keyLabel, parseKeys} from './kbd.keys.js';
import './define.js';
import type {TctKbd} from './tct-kbd.js';

const baseOf = (element: Element): HTMLElement =>
  element.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
const keysOf = (element: Element): HTMLElement[] => [
  ...element.shadowRoot!.querySelectorAll<HTMLElement>('kbd'),
];
const texts = (element: Element): string[] =>
  keysOf(element).map((key) => (key.textContent ?? '').trim());

async function kbd(keys: string, extra = '') {
  const root = await fixture<HTMLElement>(`<div><tct-kbd keys="${keys}" ${extra}></tct-kbd></div>`);
  return root.querySelector<TctKbd>('tct-kbd')!;
}

/** Pretends to be (or not to be) an Apple platform, through client hints and the legacy platform string. */
function spoofPlatform(platform: string, hint: string | undefined): void {
  Object.defineProperty(navigator, 'platform', {value: platform, configurable: true});
  Object.defineProperty(navigator, 'userAgentData', {
    value: hint === undefined ? undefined : {platform: hint},
    configurable: true,
  });
}

afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).platform;
  delete (navigator as unknown as Record<string, unknown>).userAgentData;
});

runElementSuite({
  tag: 'tct-kbd',
  render: () => html`<tct-kbd keys="mod+k"></tct-kbd>`,
  properties: {keys: 'shift+enter'},
  attributes: {keys: 'keys'},
});

describe('tct-kbd (Kbd.test.tsx)', () => {
  it('renders a single key as a <kbd>', async () => {
    const element = await kbd('k');
    expect(keysOf(element)).toHaveLength(1);
    expect(keysOf(element)[0]!.localName).toBe('kbd');
    expect(texts(element)).toEqual(['K']);
  });

  it('renders multiple keys, one badge each', async () => {
    const element = await kbd('mod+k');
    expect(keysOf(element)).toHaveLength(2);
    expect(texts(element)[1]).toBe('K');
  });

  it('renders mod as Ctrl on non-Mac platforms', async () => {
    spoofPlatform('Linux x86_64', 'Linux');
    expect(texts(await kbd('mod'))).toEqual(['Ctrl']);
  });

  it('renders mod as ⌘ on Mac platforms', async () => {
    spoofPlatform('MacIntel', 'macOS');
    expect(texts(await kbd('mod'))).toEqual(['⌘']);
  });

  it('falls back to navigator.platform when client hints name nothing', () => {
    spoofPlatform('MacIntel', '');
    expect(isApplePlatform()).toBe(true);
    spoofPlatform('MacIntel', 'Unknown');
    expect(isApplePlatform()).toBe(true);
    spoofPlatform('Win32', undefined);
    expect(isApplePlatform()).toBe(false);
    spoofPlatform('iPhone', undefined);
    expect(isApplePlatform()).toBe(true);
  });

  it('maps modifier keys to symbols', async () => {
    const element = await kbd('ctrl+alt+shift+k');
    expect(texts(element)).toEqual(['⌃', '⌥', '⇧', 'K']);
  });

  it('maps special keys', async () => {
    expect(texts(await kbd('enter'))).toEqual(['↵']);
    expect(texts(await kbd('backspace'))).toEqual(['⌫']);
    expect(texts(await kbd('tab'))).toEqual(['⇥']);
    expect(texts(await kbd('up+down+left+right'))).toEqual(['↑', '↓', '←', '→']);
  });

  it('renders escape as text', async () => {
    expect(texts(await kbd('escape'))).toEqual(['Esc']);
  });

  it.each([
    {alias: 'esc', display: 'Esc', label: 'Escape'},
    {alias: 'return', display: '↵', label: 'Enter'},
  ])('normalizes the $alias key alias', async ({alias, display, label}) => {
    const element = await kbd(alias);
    expect(texts(element)).toEqual([display]);
    expect(baseOf(element).getAttribute('aria-label')).toBe(label);
  });

  it.each([
    {alias: 'esc', canonical: 'escape'},
    {alias: 'return', canonical: 'enter'},
  ])('$alias renders identically to $canonical', async ({alias, canonical}) => {
    const a = await kbd(canonical);
    const b = await kbd(alias);
    expect(texts(b)).toEqual(texts(a));
    expect(baseOf(b).getAttribute('aria-label')).toBe(baseOf(a).getAttribute('aria-label'));
  });

  it.each([
    {keys: 'ctrl + ESC', display: 'Esc', label: 'Control + Escape'},
    {keys: 'shift + RETURN', display: '↵', label: 'Shift + Enter'},
  ])('normalizes aliases inside the $keys combo', async ({keys, display, label}) => {
    const element = await kbd(keys);
    expect(texts(element)).toContain(display);
    expect(baseOf(element).getAttribute('aria-label')).toBe(label);
  });

  it('keeps every key when aliases repeat', async () => {
    const element = await kbd('escape+esc+ESC+enter+return+return');
    expect(texts(element)).toEqual(['Esc', 'Esc', 'Esc', '↵', '↵', '↵']);
  });

  it.each(['constructor', '__proto__'])(
    'renders the unknown %s key without consulting object prototypes',
    async (key) => {
      const element = await kbd(key);
      expect(texts(element)).toEqual([key.toUpperCase()]);
      expect(baseOf(element).getAttribute('aria-label')).toBe(key.toUpperCase());
    },
  );

  it('exposes a spoken accessible name and hides the glyphs (obs-1)', async () => {
    spoofPlatform('Linux x86_64', 'Linux');
    const element = await kbd('mod+shift+k');
    const group = baseOf(element);
    expect(group.getAttribute('role')).toBe('img');
    expect(group.getAttribute('aria-label')).toBe('Control + Shift + K');
    for (const key of keysOf(element)) expect(key.getAttribute('aria-hidden')).toBe('true');
    expect(group.hasAttribute('aria-hidden')).toBe(false);
    if (isChromium) {
      expect(await axNode(group)).toMatchObject({role: 'image', name: 'Control + Shift + K'});
    }
  });

  it('uses "Command" in the accessible name for mod on Mac', async () => {
    spoofPlatform('MacIntel', 'macOS');
    const element = await kbd('mod+k');
    expect(baseOf(element).getAttribute('aria-label')).toBe('Command + K');
  });

  it('uppercases unknown keys', async () => {
    expect(texts(await kbd('f1'))).toEqual(['F1']);
  });

  it('handles whitespace around keys', async () => {
    spoofPlatform('Linux x86_64', 'Linux');
    expect(texts(await kbd('mod + k'))).toEqual(['Ctrl', 'K']);
  });

  it('renders "plus" as a literal + key', async () => {
    const element = await kbd('shift+plus');
    expect(texts(element)).toEqual(['⇧', '+']);
    expect(baseOf(element).getAttribute('aria-label')).toBe('Shift + Plus');
  });

  it('keeps the computed role and aria-label when unrelated attributes are on the host', async () => {
    const element = await kbd('mod+k', 'data-testid="kbd" id="shortcut"');
    expect(element.id).toBe('shortcut');
    expect(baseOf(element).getAttribute('role')).toBe('img');
    expect(baseOf(element).getAttribute('aria-label')).toMatch(/K$/);
  });

  it('the computed role and aria-label win over host overrides', async () => {
    const element = await kbd('mod+k', 'role="presentation" aria-label="custom"');
    expect(baseOf(element).getAttribute('role')).toBe('img');
    expect(baseOf(element).getAttribute('aria-label')).not.toBe('custom');
    if (isChromium) expect((await axNode(baseOf(element))).name).not.toBe('custom');
  });

  it('follows changes to keys, and renders nothing for an empty shortcut', async () => {
    const element = await kbd('k');
    element.keys = 'shift+enter';
    await element.updateComplete;
    expect(texts(element)).toEqual(['⇧', '↵']);
    element.keys = '';
    await element.updateComplete;
    expect(keysOf(element)).toHaveLength(0);
    expect(element.shadowRoot!.querySelector('[part~="base"]')).toBeNull();
  });

  it('corrects to the platform when it connects (no error on the server-style first render)', async () => {
    spoofPlatform('MacIntel', 'macOS');
    const element = document.createElement('tct-kbd');
    element.keys = 'mod';
    document.body.append(element);
    await element.updateComplete;
    try {
      expect(texts(element)).toEqual(['⌘']);
    } finally {
      element.remove();
    }
  });
});

describe('tct-kbd: key parsing helpers', () => {
  it('parseKeys trims, lower-cases and resolves aliases', () => {
    expect(parseKeys(' Mod + K ')).toEqual(['mod', 'k']);
    expect(parseKeys('esc+return')).toEqual(['escape', 'enter']);
  });

  it('keyDisplay and keyLabel resolve mod per platform', () => {
    expect(keyDisplay('mod', true)).toBe('⌘');
    expect(keyDisplay('mod', false)).toBe('Ctrl');
    expect(keyLabel('mod', true)).toBe('Command');
    expect(keyLabel('mod', false)).toBe('Control');
    expect(keyLabel('up', false)).toBe('Up arrow');
  });
});

describe('tct-kbd: accessibility, RTL, forced colours', () => {
  it('passes axe', async () => {
    await expectAccessible(await kbd('mod+shift+p'));
    await expectAccessible(await kbd('esc'));
  });

  it('badges flow with the direction: the first key is at the inline start', async () => {
    const root = await fixture<HTMLElement>('<div><tct-kbd keys="ctrl+k"></tct-kbd></div>', {
      dir: 'rtl',
    });
    const [first, second] = keysOf(root.querySelector('tct-kbd')!) as [HTMLElement, HTMLElement];
    expect(second.getBoundingClientRect().left).toBeLessThan(first.getBoundingClientRect().left);
  });

  it('is a fixed-height badge: spacing-5 tall with the supporting type', async () => {
    const element = await kbd('k');
    const key = keysOf(element)[0]!;
    expect(key.getBoundingClientRect().height).toBe(20);
    expect(key.getBoundingClientRect().width).toBeGreaterThanOrEqual(20);
    expect(getComputedStyle(key).userSelect).toBe('none');
  });

  it.skipIf(!isChromium)('keeps a visible edge on each key in forced-colors mode', async () => {
    await emulateMedia({forcedColors: 'active'});
    const element = await kbd('mod+k');
    for (const key of keysOf(element)) {
      expect(getComputedStyle(key).borderTopWidth).toBe('1px');
      expect(getComputedStyle(key).borderBottomWidth).toBe('2px');
    }
    await expectAccessible(element);
  });
});
