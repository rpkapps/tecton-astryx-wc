/**
 * tct-internationalization-provider: locale, messages, overrides and direction for the components
 * inside it (ported from upstream InternationalizationProvider tests), with de-DE, ar-SA and the
 * pseudo locale as real consumers.
 */
import {html} from 'lit';
import {afterEach, describe, expect, it, vi} from 'vitest';
import english from '@tecton-wc/locales/en/spinner.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {getLocaleDirection} from '@tecton-wc/core/i18n/direction.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {aTimeout, waitUntil} from '@tecton-wc/testing/timing.js';
import '../spinner/define.js';
import './define.js';
import type {TctSpinner} from '../spinner/tct-spinner.js';
import type {TctInternationalizationProvider} from './tct-internationalization-provider.js';

/** Reads locale, direction, strings and formatters the way every family does, via LocaleController. */
class TestLocaleProbe extends TctElement {
  static override readonly tagName = 'tct-test-locale-probe';
  readonly i18n: LocaleController = new LocaleController(this, {
    namespace: 'spinner',
    defaults: english,
  });
  override render() {
    return html`<span id="text">${this.i18n.t('loading', undefined, 'loading-label')}</span>`;
  }
  get text(): string {
    return this.shadowRoot?.querySelector('#text')?.textContent ?? '';
  }
}
defineElement(TestLocaleProbe);

/** Renders a probe in its own shadow root: the request must cross the boundary. */
class TestLocaleHost extends TctElement {
  static override readonly tagName = 'tct-test-locale-host';
  override render() {
    return html`<tct-test-locale-probe></tct-test-locale-probe>`;
  }
}
defineElement(TestLocaleHost);

async function mount(markup: string, options: {lang?: string; dir?: 'ltr' | 'rtl'} = {}) {
  return fixture<HTMLElement>(`<div>${markup}</div>`, options);
}

const probeOf = (root: ParentNode, selector = 'tct-test-locale-probe'): TestLocaleProbe =>
  root.querySelector<TestLocaleProbe>(selector)!;

const LOADING_ID = '@tct.spinner.loading';

afterEach(() => {
  globalThis.tctDevMode = undefined;
});

runElementSuite({
  tag: 'tct-internationalization-provider',
  render: () =>
    html`<tct-internationalization-provider locale="fr-FR"
      ><tct-spinner></tct-spinner
    ></tct-internationalization-provider>`,
  properties: {locale: 'de-DE'},
  attributes: {locale: 'locale'},
  // display: contents on the host is the point of a provider, and it draws no box.
  hostBox: false,
  shadow: false,
});

describe('tct-internationalization-provider: locale', () => {
  it('reflects the locale onto itself as lang, and removes it again', async () => {
    const root = await mount(
      '<tct-internationalization-provider locale="de-DE"></tct-internationalization-provider>',
    );
    const provider = root.querySelector<TctInternationalizationProvider>(
      'tct-internationalization-provider',
    )!;
    expect(provider.getAttribute('lang')).toBe('de-DE');
    expect(provider.matches(':lang(de)')).toBe(true);

    provider.locale = 'fr-CA';
    await provider.updateComplete;
    expect(provider.getAttribute('lang')).toBe('fr-CA');

    provider.locale = '';
    await provider.updateComplete;
    expect(provider.hasAttribute('lang')).toBe(false);
  });

  it('leaves an author lang alone while it has no locale', async () => {
    const root = await mount(
      '<tct-internationalization-provider lang="es"></tct-internationalization-provider>',
    );
    const provider = root.querySelector('tct-internationalization-provider')!;
    expect(provider.getAttribute('lang')).toBe('es');
  });

  it('components inside read the provider locale, not the document one', async () => {
    const root = await mount(
      '<tct-internationalization-provider locale="sv-SE"><tct-test-locale-probe></tct-test-locale-probe></tct-internationalization-provider><tct-test-locale-probe id="outside"></tct-test-locale-probe>',
    );
    expect(probeOf(root).i18n.locale).toBe('sv-SE');
    expect(probeOf(root, '#outside').i18n.locale).toBe(document.documentElement.lang || 'en');
  });

  it('lang="de-DE" loads the German catalog lazily and re-renders the string', async () => {
    const root = await mount(
      '<tct-internationalization-provider locale="de-DE"><tct-test-locale-probe></tct-test-locale-probe></tct-internationalization-provider>',
    );
    const probe = probeOf(root);
    await waitUntil(() => probe.text === 'Wird geladen', 'German catalog', 5000);
  });

  it('changing the locale re-renders the components inside', async () => {
    const root = await mount(
      '<tct-internationalization-provider locale="de-DE"><tct-test-locale-probe></tct-test-locale-probe></tct-internationalization-provider>',
    );
    const provider = root.querySelector<TctInternationalizationProvider>(
      'tct-internationalization-provider',
    )!;
    const probe = probeOf(root);
    await waitUntil(() => probe.text === 'Wird geladen', 'German catalog', 5000);
    provider.locale = 'en';
    await provider.updateComplete;
    await waitUntil(() => probe.text === 'Loading', 'English again');
  });

  it('the pseudo locale renders bracketed, expanded text', async () => {
    const root = await mount(
      '<tct-internationalization-provider locale="pseudo"><tct-test-locale-probe></tct-test-locale-probe></tct-internationalization-provider>',
    );
    const probe = probeOf(root);
    await waitUntil(() => probe.text.startsWith('['), 'pseudo catalog', 5000);
    expect(probe.text.endsWith(']')).toBe(true);
    expect(probe.text.length).toBeGreaterThan('Loading'.length);
  });

  it('the nearest provider wins', async () => {
    const root = await mount(
      '<tct-internationalization-provider locale="de-DE"><tct-internationalization-provider locale="sv-SE"><tct-test-locale-probe id="inner"></tct-test-locale-probe></tct-internationalization-provider><tct-test-locale-probe id="outer"></tct-test-locale-probe></tct-internationalization-provider>',
    );
    expect(probeOf(root, '#inner').i18n.locale).toBe('sv-SE');
    expect(probeOf(root, '#outer').i18n.locale).toBe('de-DE');
  });

  it('reaches components inside other elements shadow roots', async () => {
    const root = await mount(
      '<tct-internationalization-provider locale="ja-JP"><tct-test-locale-host></tct-test-locale-host></tct-internationalization-provider>',
    );
    const probe = root
      .querySelector('tct-test-locale-host')!
      .shadowRoot!.querySelector<TestLocaleProbe>('tct-test-locale-probe')!;
    await probe.updateComplete;
    expect(probe.i18n.locale).toBe('ja-JP');
  });

  it('a component moved into a provider picks its locale up', async () => {
    const root = await mount(
      '<tct-test-locale-probe></tct-test-locale-probe><tct-internationalization-provider locale="fi-FI"></tct-internationalization-provider>',
    );
    const probe = probeOf(root);
    root.querySelector('tct-internationalization-provider')!.append(probe);
    expect(probe.i18n.locale).toBe('fi-FI');
  });

  it('warns in dev mode about a tag that is not BCP 47, and still reflects it', async () => {
    globalThis.tctDevMode = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const root = await mount(
        '<tct-internationalization-provider locale="not a tag"></tct-internationalization-provider>',
      );
      expect(root.querySelector('tct-internationalization-provider')!.getAttribute('lang')).toBe(
        'not a tag',
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('BCP 47'));
    } finally {
      warn.mockRestore();
    }
  });
});

describe('tct-internationalization-provider: messages and overrides', () => {
  const provide = async (
    props: {
      locale?: string;
      messages?: TctInternationalizationProvider['messages'];
      overrides?: TctInternationalizationProvider['overrides'];
    },
    inner = '<tct-test-locale-probe></tct-test-locale-probe>',
  ) => {
    const root = await mount(
      `<tct-internationalization-provider>${inner}</tct-internationalization-provider>`,
    );
    const provider = root.querySelector<TctInternationalizationProvider>(
      'tct-internationalization-provider',
    )!;
    Object.assign(provider, props);
    await provider.updateComplete;
    return {root, provider, probe: probeOf(root)};
  };

  it('overrides win over the shipped catalog', async () => {
    const {probe} = await provide({
      locale: 'de-DE',
      overrides: {'de-DE': {[LOADING_ID]: 'Bitte warten'}},
    });
    await waitUntil(() => probe.text === 'Bitte warten', 'override');
  });

  it('overrides for a base tag apply to a regional locale', async () => {
    const {probe} = await provide({locale: 'de-DE', overrides: {de: {[LOADING_ID]: 'Moment'}}});
    await waitUntil(() => probe.text === 'Moment', 'base-tag override');
  });

  it('provider messages win over the shipped catalog, and overrides win over messages', async () => {
    const {probe, provider} = await provide({
      locale: 'de-DE',
      messages: {'de-DE': {[LOADING_ID]: 'Arbeite'}},
    });
    await waitUntil(() => probe.text === 'Arbeite', 'provider messages');
    provider.overrides = {'de-DE': {[LOADING_ID]: 'Override'}};
    await provider.updateComplete;
    await waitUntil(() => probe.text === 'Override', 'override over messages');
  });

  it('accepts upstream-style {defaultMessage} entries', async () => {
    const {probe} = await provide({
      locale: 'fr-FR',
      messages: {'fr-FR': {[LOADING_ID]: {defaultMessage: 'Un instant'}}},
    });
    await waitUntil(() => probe.text === 'Un instant', 'defaultMessage entry');
  });

  it('serves a locale the library does not ship', async () => {
    const {probe} = await provide({
      locale: 'tlh',
      messages: {tlh: {[LOADING_ID]: 'Qaparbe'}},
    });
    await waitUntil(() => probe.text === 'Qaparbe', 'custom locale');
  });

  it('the component own attribute beats overrides', async () => {
    const {probe} = await provide(
      {locale: 'de-DE', overrides: {'de-DE': {[LOADING_ID]: 'Bitte warten'}}},
      '<tct-test-locale-probe loading-label="Mein Text"></tct-test-locale-probe>',
    );
    expect(probe.text).toBe('Mein Text');
  });

  it('new messages and overrides objects re-render, the same ones do not', async () => {
    const overrides = {'de-DE': {[LOADING_ID]: 'Eins'}};
    const {probe, provider} = await provide({locale: 'de-DE', overrides});
    await waitUntil(() => probe.text === 'Eins', 'first override');
    const renders = vi.spyOn(probe, 'requestUpdate');
    provider.overrides = overrides;
    provider.locale = 'de-DE';
    await provider.updateComplete;
    expect(renders).not.toHaveBeenCalled();
    provider.overrides = {'de-DE': {[LOADING_ID]: 'Zwei'}};
    await provider.updateComplete;
    await waitUntil(() => probe.text === 'Zwei', 'second override');
  });

  it('formats numbers and sorts with the provider locale', async () => {
    const {probe, provider} = await provide({locale: 'de-DE'});
    expect(probe.i18n.numberFormat().format(1234.5)).toBe('1.234,5');
    expect(probe.i18n.collator().compare('ä', 'z')).toBeLessThan(0);
    provider.locale = 'sv-SE';
    await provider.updateComplete;
    expect(probe.i18n.collator().compare('ä', 'z')).toBeGreaterThan(0);
  });

  it.skipIf(!isChromium)('names a real spinner from the provider catalog', async () => {
    const {root} = await provide(
      {locale: 'de-DE', overrides: {'de-DE': {[LOADING_ID]: 'Bitte warten'}}},
      '<tct-spinner></tct-spinner>',
    );
    const spinner = root.querySelector<TctSpinner>('tct-spinner')!;
    await spinner.updateComplete;
    // The override is in the context already; the accessible name follows the next render.
    for (
      let attempt = 0;
      attempt < 60 && (await axNode(spinner)).name !== 'Bitte warten';
      attempt++
    ) {
      await aTimeout(50);
    }
    expect((await axNode(spinner)).name).toBe('Bitte warten');
  });
});

describe('tct-internationalization-provider: direction', () => {
  it('ar-SA with dir="rtl" lays the subtree out right-to-left and components read rtl', async () => {
    const root = await mount(
      '<tct-internationalization-provider locale="ar-SA" dir="rtl"><tct-test-locale-probe></tct-test-locale-probe></tct-internationalization-provider>',
    );
    const provider = root.querySelector('tct-internationalization-provider')!;
    expect(getComputedStyle(provider).direction).toBe('rtl');
    expect(probeOf(root).i18n.dir).toBe('rtl');
    expect(provider.getAttribute('lang')).toBe('ar-SA');
  });

  it('dir="ltr" wins for an RTL locale (forcing a direction under any catalog)', async () => {
    const root = await mount(
      '<tct-internationalization-provider locale="ar-SA" dir="ltr"><tct-test-locale-probe></tct-test-locale-probe></tct-internationalization-provider>',
      {dir: 'rtl'},
    );
    expect(probeOf(root).i18n.dir).toBe('ltr');
  });

  it('a dir given without a locale is still provided', async () => {
    const root = await mount(
      '<tct-internationalization-provider dir="rtl"><tct-test-locale-probe></tct-test-locale-probe></tct-internationalization-provider>',
    );
    expect(probeOf(root).i18n.dir).toBe('rtl');
  });

  it('follows a dir change', async () => {
    const root = await mount(
      '<tct-internationalization-provider locale="ar-SA" dir="rtl"><tct-test-locale-probe></tct-test-locale-probe></tct-internationalization-provider>',
    );
    const provider = root.querySelector('tct-internationalization-provider')!;
    provider.setAttribute('dir', 'ltr');
    expect(probeOf(root).i18n.dir).toBe('ltr');
    provider.removeAttribute('dir');
    expect(probeOf(root).i18n.dir).toBe('ltr');
  });

  it('never derives the DOM direction from the locale: set dir yourself', async () => {
    const root = await mount(
      '<tct-internationalization-provider locale="ar-SA"><tct-test-locale-probe></tct-test-locale-probe></tct-internationalization-provider>',
    );
    const provider = root.querySelector('tct-internationalization-provider')!;
    expect(provider.hasAttribute('dir')).toBe(false);
    // Components and layout agree: both say ltr until dir is set.
    expect(probeOf(root).i18n.dir).toBe(getComputedStyle(provider).direction);
    expect(getLocaleDirection('ar-SA')).toBe('rtl');
  });
});

describe('tct-internationalization-provider: element contract', () => {
  it('has no shadow root, no role, and leaves its children untouched (no marker nodes)', async () => {
    const root = await mount(
      '<tct-internationalization-provider locale="fr-FR"><tct-spinner></tct-spinner></tct-internationalization-provider>',
    );
    const provider = root.querySelector('tct-internationalization-provider')!;
    expect(provider.shadowRoot).toBeNull();
    expect(provider.hasAttribute('role')).toBe(false);
    expect([...provider.childNodes].map((node) => node.nodeName.toLowerCase())).toEqual([
      'tct-spinner',
    ]);
  });

  it('is display: contents, so it adds no box and no layout', async () => {
    const root = await mount(
      '<div style="display: flex; gap: 8px"><tct-internationalization-provider locale="en"><span id="a">A</span><span id="b">B</span></tct-internationalization-provider></div>',
    );
    expect(getComputedStyle(root.querySelector('tct-internationalization-provider')!).display).toBe(
      'contents',
    );
    const a = root.querySelector('#a')!.getBoundingClientRect();
    const b = root.querySelector('#b')!.getBoundingClientRect();
    expect(b.left - a.right).toBeCloseTo(8, 0);
  });

  it('passes axe with localised components inside', async () => {
    const root = await mount(
      '<tct-internationalization-provider locale="fr-FR"><tct-spinner label="Chargement"></tct-spinner></tct-internationalization-provider>',
    );
    await expectAccessible(root);
  });
});
