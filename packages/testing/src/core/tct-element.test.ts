/**
 * `TctElement`, `defineElement` and the feature probes (A§7, A§9.1, A§9.2, A§9.5): what every
 * component inherits. Includes upstream review M1 (moving an element must not reconnect it) and M7
 * (`:state()` must be guarded).
 */
import {html} from 'lit';
import {property} from 'lit/decorators.js';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {defineElement, resetDefineWarnings} from '@tecton-wc/core/define.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {features, overrideFeature, resetFeatures} from '@tecton-wc/core/features.js';
import {TctElement, type TctElementConstructor} from '@tecton-wc/core/tct-element.js';
import {devError, devWarn, isDevMode, resetDevWarnings} from '@tecton-wc/core/utils/dev.js';
import {IdController, uniqueId} from '@tecton-wc/core/utils/id.js';
import {ImeGuard, isImeKeyEvent} from '@tecton-wc/core/utils/ime.js';
import {emulateMedia} from '../emulate.js';
import {fixture} from '../fixture.js';
import {hasCustomState} from '../forms.js';
import {isChromium, isTier2, withFeature} from '../tier.js';

class TctTestBase extends TctElement {
  static override readonly tagName = 'tct-test-base';
  @property({type: Number}) count = 0;
  connects = 0;
  disconnects = 0;
  moves = 0;
  readonly ids = new IdController(this, 'tct-test');

  override connectedCallback(): void {
    super.connectedCallback();
    this.connects++;
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.disconnects++;
  }
  override connectedMoveCallback(): void {
    super.connectedMoveCallback();
    this.moves++;
  }

  emit(cancelable: boolean): boolean {
    return this.dispatch(cancelable ? new TctOpenChangeEvent(true, 'request') : new Event('x'));
  }
  setState(name: string, on: boolean): void {
    this.toggleState(name, on);
  }
  readState(name: string): boolean {
    return this.hasState(name);
  }
  get internalsRef(): ElementInternals {
    return this.internals;
  }

  override render() {
    return html`<input id=${this.ids.id('input')} /><slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-test-base': TctTestBase;
  }
}

beforeAll(() => {
  defineElement(TctTestBase);
});

afterEach(() => {
  resetDefineWarnings();
  resetDevWarnings();
  vi.restoreAllMocks();
});

describe('TctElement', () => {
  it('has an open shadow root and ElementInternals', async () => {
    const element = await fixture<TctTestBase>(html`<tct-test-base></tct-test-base>`);
    expect(element.shadowRoot?.mode).toBe('open');
    expect(element.internalsRef).toBeInstanceOf(ElementInternals);
  });

  it('dispatch() returns false when a cancelable event was prevented', async () => {
    const element = await fixture<TctTestBase>(html`<tct-test-base></tct-test-base>`);
    expect(element.emit(true)).toBe(true);
    element.addEventListener('tct-open-change', (event) => {
      event.preventDefault();
    });
    expect(element.emit(true)).toBe(false);
    expect(element.emit(false)).toBe(true);
  });

  it('property writes emit no events', async () => {
    const element = await fixture<TctTestBase>(html`<tct-test-base></tct-test-base>`);
    const seen: string[] = [];
    for (const name of ['input', 'change', 'tct-open-change', 'tct-value-change'])
      element.addEventListener(name, () => seen.push(name));
    element.count = 5;
    await element.updateComplete;
    expect(seen).toEqual([]);
  });

  describe.skipIf(isTier2)('custom states', () => {
    it('toggleState sets and clears :state()', async () => {
      const element = await fixture<TctTestBase>(html`<tct-test-base></tct-test-base>`);
      element.setState('open', true);
      expect(hasCustomState(element, 'open')).toBe(true);
      expect(element.readState('open')).toBe(true);
      element.setState('open', false);
      expect(hasCustomState(element, 'open')).toBe(false);
      expect(element.readState('open')).toBe(false);
    });
  });

  it('is a no-op, never a throw, without custom-state support (review M7)', async () => {
    await withFeature('customStates', false, async () => {
      const element = await fixture<TctTestBase>(html`<tct-test-base></tct-test-base>`);
      expect(() => {
        element.setState('open', true);
      }).not.toThrow();
      expect(element.readState('open')).toBe(false);
      expect(hasCustomState(element, 'open')).toBe(false);
    });
  });

  it('tolerates engines that reject a state name (dashed idents only)', async () => {
    const element = await fixture<TctTestBase>(html`<tct-test-base></tct-test-base>`);
    const states = element.internalsRef.states;
    vi.spyOn(states, 'add').mockImplementation(() => {
      throw new DOMException('bad state', 'SyntaxError');
    });
    expect(() => {
      element.setState('user-invalid', true);
    }).not.toThrow();
  });

  it('IdController hands out stable, document-unique ids', async () => {
    const one = await fixture<TctTestBase>(html`<tct-test-base></tct-test-base>`);
    const two = await fixture<TctTestBase>(html`<tct-test-base></tct-test-base>`);
    const first = one.ids.id('input');
    expect(one.ids.id('input')).toBe(first);
    expect(one.ids.id('other')).not.toBe(first);
    expect(two.ids.id('input')).not.toBe(first);
    expect(one.renderRoot.querySelector('input')!.id).toBe(first);
    expect(uniqueId('a')).not.toBe(uniqueId('a'));
  });
});

describe('moveBefore (review M1)', () => {
  it.skipIf(!features.moveBefore)(
    'moving an element with moveBefore keeps it connected and calls connectedMoveCallback only',
    async () => {
      const host = await fixture<HTMLDivElement>(
        html`<div>
          <section id="a">
            <tct-test-base><button>x</button></tct-test-base>
          </section>
          <section id="b"></section>
        </div>`,
      );
      const element = host.querySelector('tct-test-base')!;
      const button = element.querySelector('button')!;
      button.focus();
      const before = {connects: element.connects, disconnects: element.disconnects};
      host.querySelector('#b')!.moveBefore(element, null);
      expect(element.parentElement?.id).toBe('b');
      expect(element.connects).toBe(before.connects);
      expect(element.disconnects).toBe(before.disconnects);
      expect(element.moves).toBe(1);
      expect(document.activeElement).toBe(button);
    },
  );

  it('the ordinary insertion path reconnects (and the default move callback is harmless)', async () => {
    const host = await fixture<HTMLDivElement>(
      html`<div>
        <section id="a"><tct-test-base></tct-test-base></section>
        <section id="b"></section>
      </div>`,
    );
    const element = host.querySelector('tct-test-base')!;
    host.querySelector('#b')!.append(element);
    expect(element.disconnects).toBe(1);
    expect(element.connects).toBe(2);
    expect(() => {
      element.connectedMoveCallback();
    }).not.toThrow();
  });
});

describe('defineElement', () => {
  it('registers dependencies first, once, and is idempotent', () => {
    class Child extends TctElement {
      static override readonly tagName = 'tct-test-def-child';
    }
    class Parent extends TctElement {
      static override readonly tagName = 'tct-test-def-parent';
      static override readonly dependencies = [Child];
    }
    const order: string[] = [];
    const original = customElements.define.bind(customElements);
    vi.spyOn(customElements, 'define').mockImplementation((name, ctor, options) => {
      order.push(name);
      original(name, ctor, options);
    });
    defineElement(Parent);
    defineElement(Parent);
    defineElement(Child);
    expect(order).toEqual(['tct-test-def-child', 'tct-test-def-parent']);
    expect(customElements.get('tct-test-def-parent')).toBe(Parent);
  });

  it('survives dependency cycles', () => {
    class A extends TctElement {
      static override readonly tagName = 'tct-test-cycle-a';
      static override readonly dependencies: readonly TctElementConstructor[] = [];
    }
    class B extends TctElement {
      static override readonly tagName = 'tct-test-cycle-b';
      static override readonly dependencies = [A];
    }
    (A as unknown as {dependencies: unknown[]}).dependencies = [B];
    expect(() => {
      defineElement(A);
    }).not.toThrow();
    expect(customElements.get('tct-test-cycle-a')).toBe(A);
    expect(customElements.get('tct-test-cycle-b')).toBe(B);
  });

  it('keeps the first class when a different one claims the tag, and warns once per tag', () => {
    class First extends TctElement {
      static override readonly tagName = 'tct-test-dupe';
    }
    class Second extends TctElement {
      static override readonly tagName = 'tct-test-dupe';
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    defineElement(First);
    defineElement(Second);
    defineElement(Second);
    expect(customElements.get('tct-test-dupe')).toBe(First);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('tct-test-dupe');
  });

  it('rejects a missing or hyphen-less tagName with a clear error', () => {
    class NoTag extends TctElement {}
    class Bad extends TctElement {
      static override readonly tagName = 'nohyphen';
    }
    expect(() => {
      defineElement(NoTag);
    }).toThrow(/tagName/);
    expect(() => {
      defineElement(Bad);
    }).toThrow(/hyphen/);
  });

  it('honours a scoped registry when the engine has one', () => {
    if (
      typeof (globalThis as {CustomElementRegistry?: unknown}).CustomElementRegistry !== 'function'
    )
      return;
    class Scoped extends TctElement {
      static override readonly tagName = 'tct-test-scoped';
    }
    let registry: CustomElementRegistry;
    try {
      registry = new (CustomElementRegistry as unknown as new () => CustomElementRegistry)();
    } catch {
      return; // constructor not available: no scoped registries in this engine
    }
    defineElement(Scoped, registry);
    expect(registry.get('tct-test-scoped')).toBe(Scoped);
    expect(customElements.get('tct-test-scoped')).toBeUndefined();
  });
});

describe('features', () => {
  it('every probe answers a boolean and never throws', () => {
    for (const name of Object.keys(features) as (keyof typeof features)[]) {
      expect(typeof features[name], name).toBe('boolean');
    }
  });

  it('Chromium 141 has the Tier-1 baseline this suite relies on', () => {
    if (!isChromium || isTier2) return;
    expect(features.popover).toBe(true);
    expect(features.anchorPositioning).toBe(true);
    expect(features.implicitAnchor).toBe(true);
    expect(features.elementReflection).toBe(true);
    expect(features.customStates).toBe(true);
    expect(features.requestClose).toBe(true);
  });

  it('overrideFeature forces a value for every reader and restores in stack order', () => {
    const original = features.popover;
    const restoreA = overrideFeature('popover', !original);
    expect(features.popover).toBe(!original);
    const restoreB = overrideFeature('popover', original);
    expect(features.popover).toBe(original);
    restoreB();
    expect(features.popover).toBe(!original);
    restoreA();
    expect(features.popover).toBe(original);
  });

  it('resetFeatures drops every override', () => {
    overrideFeature('lightDark', false);
    overrideFeature('fieldSizing', true);
    resetFeatures();
    expect(features.lightDark).toBe(CSS.supports('color', 'light-dark(red, blue)'));
  });

  it('the implicit-anchor layout probe leaves nothing behind in the document', () => {
    const before = document.body.querySelectorAll('[popover]').length;
    void features.implicitAnchor;
    expect(document.body.querySelectorAll('[popover]')).toHaveLength(before);
  });

  it.skipIf(!isChromium)('prefersReducedMotion reads the live media query', async () => {
    const {prefersReducedMotion} = await import('@tecton-wc/core/features.js');
    const restore = await emulateMedia({reducedMotion: 'reduce'});
    expect(prefersReducedMotion()).toBe(true);
    await restore();
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('dev diagnostics and IME helpers', () => {
  it('devWarn is silent unless dev mode is on, and once per id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(isDevMode()).toBe(false);
    devWarn('quiet', 'x');
    expect(warn).not.toHaveBeenCalled();
    globalThis.tctDevMode = true;
    try {
      devWarn('loud', 'x');
      devWarn('loud', 'x');
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.tctDevMode = undefined;
    }
  });

  it('devError always reports, once per id', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    devError('boom', 'failed');
    devError('boom', 'failed');
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('isImeKeyEvent: isComposing or keyCode 229', () => {
    expect(isImeKeyEvent({isComposing: true})).toBe(true);
    expect(isImeKeyEvent({keyCode: 229})).toBe(true);
    expect(isImeKeyEvent({keyCode: 13, isComposing: false})).toBe(false);
    expect(isImeKeyEvent({})).toBe(false);
  });

  it('ImeGuard tracks composition on the target and clears on blur', async () => {
    class Host extends TctElement {
      static override readonly tagName = 'tct-test-ime';
      readonly guard = new ImeGuard(this, () => this.renderRoot.querySelector('input'));
      override render() {
        return html`<input />`;
      }
    }
    defineElement(Host);
    const host = await fixture<Host>(html`<tct-test-ime></tct-test-ime>`);
    const input = host.renderRoot.querySelector('input')!;
    expect(host.guard.composing).toBe(false);
    input.dispatchEvent(new CompositionEvent('compositionstart'));
    expect(host.guard.composing).toBe(true);
    input.dispatchEvent(new CompositionEvent('compositionend'));
    expect(host.guard.composing).toBe(false);
    input.dispatchEvent(new CompositionEvent('compositionstart'));
    input.dispatchEvent(new FocusEvent('blur'));
    expect(host.guard.composing).toBe(false);
    host.remove();
    expect(host.guard.composing).toBe(false);
  });
});
