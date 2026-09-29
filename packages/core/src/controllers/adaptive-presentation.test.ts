/**
 * `AdaptivePresentationController`: the pure policy table, and the live switch when the compact-touch
 * media query changes (stubbed `matchMedia`: CDP touch emulation cannot be undone inside a page).
 */
import {LitElement, html} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {
  ADAPTIVE_PRESENTATIONS,
  AdaptivePresentationController,
  COMPACT_TOUCH_PRESENTATION_QUERY,
  resolveAdaptivePresentation,
  type AdaptivePresentation,
} from './adaptive-presentation.js';

describe('resolveAdaptivePresentation', () => {
  it('keeps a fixed policy on every device', () => {
    for (const compact of [true, false]) {
      expect(resolveAdaptivePresentation('popover', compact)).toBe('popover');
      expect(resolveAdaptivePresentation('bottom-sheet', compact)).toBe('bottom-sheet');
    }
  });

  it('adaptive is a bottom sheet on compact touch and a popover elsewhere', () => {
    expect(resolveAdaptivePresentation('adaptive', true)).toBe('bottom-sheet');
    expect(resolveAdaptivePresentation('adaptive', false)).toBe('popover');
  });

  it('lists the three policies', () => {
    expect(ADAPTIVE_PRESENTATIONS).toEqual(['popover', 'bottom-sheet', 'adaptive']);
  });

  it('uses the width-and-pointer query', () => {
    expect(COMPACT_TOUCH_PRESENTATION_QUERY).toBe('(max-width: 768px) and (pointer: coarse)');
  });
});

class AdaptiveHost extends LitElement {
  static override properties = {presentation: {type: String}};
  presentation: AdaptivePresentation = 'adaptive';
  readonly adaptive = new AdaptivePresentationController(this, () => this.presentation);
  protected override render() {
    return html`${this.adaptive.resolved}`;
  }
}
customElements.define('tct-adaptive-test-host', AdaptiveHost);

interface FakeQuery extends EventTarget {
  matches: boolean;
  media: string;
}

/** Stubs `matchMedia` for the compact-touch query only; returns a setter that fires `change`. */
function stubCompactTouch(initial: boolean): {set: (value: boolean) => void; restore: () => void} {
  const original = window.matchMedia.bind(window);
  const lists = new Set<FakeQuery>();
  let current = initial;
  window.matchMedia = ((query: string): MediaQueryList => {
    if (query !== COMPACT_TOUCH_PRESENTATION_QUERY) return original(query);
    const list = Object.assign(new EventTarget(), {
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
    }) as unknown as FakeQuery;
    Object.defineProperty(list, 'matches', {get: () => current});
    lists.add(list);
    return list as unknown as MediaQueryList;
  });
  return {
    set(value) {
      current = value;
      for (const list of lists) {
        list.dispatchEvent(Object.assign(new Event('change'), {matches: value, media: list.media}));
      }
    },
    restore() {
      window.matchMedia = original;
    },
  };
}

describe('AdaptivePresentationController', () => {
  let stub: ReturnType<typeof stubCompactTouch> | undefined;
  afterEach(() => {
    stub?.restore();
    stub = undefined;
    document.body.replaceChildren();
  });

  async function mount(): Promise<AdaptiveHost> {
    const host = document.createElement('tct-adaptive-test-host') as AdaptiveHost;
    document.body.append(host);
    await host.updateComplete;
    return host;
  }

  it('resolves to a popover on a fine pointer', async () => {
    stub = stubCompactTouch(false);
    const host = await mount();
    expect(host.adaptive.resolved).toBe('popover');
    expect(host.adaptive.isCompactTouch).toBe(false);
    expect(host.shadowRoot!.textContent).toContain('popover');
  });

  it('resolves to a bottom sheet under an emulated coarse pointer and re-renders live', async () => {
    stub = stubCompactTouch(false);
    const host = await mount();
    stub.set(true);
    await host.updateComplete;
    expect(host.adaptive.resolved).toBe('bottom-sheet');
    expect(host.shadowRoot!.textContent).toContain('bottom-sheet');
    stub.set(false);
    await host.updateComplete;
    expect(host.adaptive.resolved).toBe('popover');
  });

  it('a fixed policy ignores the device', async () => {
    stub = stubCompactTouch(true);
    const host = await mount();
    host.presentation = 'popover';
    expect(host.adaptive.resolved).toBe('popover');
    host.presentation = 'bottom-sheet';
    expect(host.adaptive.resolved).toBe('bottom-sheet');
    expect(host.adaptive.presentation).toBe('bottom-sheet');
  });
});
