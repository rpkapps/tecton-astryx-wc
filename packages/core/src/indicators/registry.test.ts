/**
 * Indicator registry (ported from upstream indicatorRegistry.test.tsx and useIndicator tests): default
 * names, per-theme overrides, augmented names, the theme-following controller and the scope marker.
 */
import {html, LitElement} from 'lit';
import {afterEach, describe, expect, it} from 'vitest';
import {themeContext} from '../context/keys.js';
import {ContextProvider} from '../context/protocol.js';
import {
  DEFAULT_INDICATOR_THEME,
  IndicatorController,
  defaultIndicators,
  defineIndicators,
  getIndicator,
  indicatorScope,
  resetIndicators,
} from './registry.js';

afterEach(() => {
  resetIndicators();
});

describe('defaultIndicators', () => {
  it('covers exactly the core indicator names, mapped to their tags', () => {
    expect(defaultIndicators).toEqual({
      check: 'tct-check-indicator',
      checkbox: 'tct-checkbox-indicator',
      radio: 'tct-radio-indicator',
    });
  });
});

describe('getIndicator', () => {
  it('resolves a core name to its built-in with no theme', () => {
    expect(getIndicator('check')).toBe('tct-check-indicator');
    expect(getIndicator('radio', null)).toBe('tct-radio-indicator');
    expect(getIndicator('checkbox', 'brand')).toBe('tct-checkbox-indicator');
  });

  it('prefers a theme override, by name, for every host that renders it', () => {
    defineIndicators({check: 'brand-check'}, 'brand');
    expect(getIndicator('check', 'brand')).toBe('brand-check');
    // Another theme, and the default theme, are unaffected.
    expect(getIndicator('check', 'other')).toBe('tct-check-indicator');
    expect(getIndicator('check')).toBe('tct-check-indicator');
    // Names the theme did not override keep their built-in.
    expect(getIndicator('radio', 'brand')).toBe('tct-radio-indicator');
  });

  it('a default-theme override applies when no theme is given', () => {
    defineIndicators({check: 'tct-radio-indicator'});
    expect(getIndicator('check')).toBe('tct-radio-indicator');
    expect(getIndicator('check', DEFAULT_INDICATOR_THEME)).toBe('tct-radio-indicator');
  });

  it('later definitions for a theme merge over earlier ones', () => {
    defineIndicators({check: 'a-check'}, 'brand');
    defineIndicators({radio: 'a-radio'}, 'brand');
    expect([getIndicator('check', 'brand'), getIndicator('radio', 'brand')]).toEqual([
      'a-check',
      'a-radio',
    ]);
  });

  it('returns undefined for an augmented name no theme supplies, and resolves one a theme does', () => {
    expect(getIndicator('brand-star' as never)).toBeUndefined();
    defineIndicators({'brand-star': 'brand-star-indicator'} as never, 'brand');
    expect(getIndicator('brand-star' as never, 'brand')).toBe('brand-star-indicator');
    expect(getIndicator('brand-star' as never)).toBeUndefined();
  });

  it('rejects an override that is not a custom element tag name', () => {
    expect(() => defineIndicators({check: 'div'})).toThrow(TypeError);
    expect(() => defineIndicators({check: 'Not A Tag'})).toThrow(TypeError);
  });
});

describe('IndicatorController (useIndicator)', () => {
  class Probe extends LitElement {
    readonly indicator = new IndicatorController(this, 'check');
    override render() {
      return html`${this.indicator.tag}`;
    }
  }
  customElements.define('tct-test-indicator-probe', Probe);

  it('resolves the built-in without a theme provider', async () => {
    const probe = document.createElement('tct-test-indicator-probe') as Probe;
    document.body.append(probe);
    await probe.updateComplete;
    expect(probe.indicator.tag).toBe('tct-check-indicator');
    probe.remove();
  });

  class ThemeHost extends LitElement {
    readonly theme = new ContextProvider(this, {
      context: themeContext,
      initialValue: {name: 'brand', mode: 'light'},
    });
    override render() {
      return html`<slot></slot>`;
    }
  }
  customElements.define('tct-test-indicator-theme', ThemeHost);

  it('follows the nearest theme and re-renders when the theme changes', async () => {
    defineIndicators({check: 'brand-check'}, 'brand');
    const host = document.createElement('tct-test-indicator-theme') as ThemeHost;
    const probe = document.createElement('tct-test-indicator-probe') as Probe;
    host.append(probe);
    document.body.append(host);
    await probe.updateComplete;
    expect(probe.indicator.tag).toBe('brand-check');
    host.theme.setValue({name: 'tecton', mode: 'dark'});
    await probe.updateComplete;
    expect(probe.indicator.tag).toBe('tct-check-indicator');
    host.remove();
  });
});

describe('indicatorScope', () => {
  it('is a stylesheet that publishes the hover marker inside the state layer', () => {
    expect(indicatorScope.cssText).toContain('@layer state');
    expect(indicatorScope.cssText).toContain('--_indicator-hover: 1');
    expect(indicatorScope.cssText).toContain('.indicator-scope:hover');
  });
});
