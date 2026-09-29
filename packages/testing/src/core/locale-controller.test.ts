/**
 * `LocaleController` (A§9.15): locale and direction resolution, the five-step message order, lazy
 * catalog loading with re-render, provider overrides, ICU arguments, and formatter caching.
 */
import {html} from 'lit';
import {property} from 'lit/decorators.js';
import {afterEach, beforeAll, describe, expect, it, vi} from 'vitest';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {localeContext, type LocaleContextValue} from '@tecton-wc/core/context/keys.js';
import {defineElement} from '@tecton-wc/core/define.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {registerTranslation, setLocaleLoader} from '@tecton-wc/core/i18n/registry.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {resetDevWarnings} from '@tecton-wc/core/utils/dev.js';
import {fixture} from '../fixture.js';
import {nextFrame, waitUntil} from '../timing.js';

const DEFAULTS = {
  '@tct.pagination.next': 'Go to next page',
  '@tct.pagination.count': '{from, number}–{to, number} of {total, number}',
  '@tct.pagination.pages': '{count, plural, one {# page} other {# pages}}',
};

class TctTestLocale extends TctElement {
  static override readonly tagName = 'tct-test-locale';
  @property({attribute: 'next-label'}) nextLabel: string | undefined;
  readonly locale: LocaleController = new LocaleController(this, {
    namespace: 'pagination',
    defaults: DEFAULTS,
  });
  renders = 0;
  override render() {
    this.renders++;
    return html`<span id="next">${this.locale.t('next', undefined, 'next-label')}</span>`;
  }
}

class TctTestLocaleProvider extends TctElement {
  static override readonly tagName = 'tct-test-locale-provider';
  readonly provider: ContextProvider<typeof localeContext> = new ContextProvider<
    typeof localeContext
  >(this, {
    context: localeContext,
    initialValue: null,
  });
  set value(value: LocaleContextValue | null) {
    this.provider.setValue(value);
  }
  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-test-locale': TctTestLocale;
    'tct-test-locale-provider': TctTestLocaleProvider;
  }
}

beforeAll(() => {
  defineElement(TctTestLocale);
  defineElement(TctTestLocaleProvider);
});

afterEach(() => {
  document.documentElement.removeAttribute('lang');
  document.documentElement.removeAttribute('dir');
  resetDevWarnings();
});

const text = (host: TctTestLocale): string => host.renderRoot.querySelector('#next')!.textContent;

async function locale(attributes = '', lang?: string): Promise<TctTestLocale> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div ${lang ? `lang="${lang}"` : ''}><tct-test-locale ${attributes}></tct-test-locale></div>`,
  );
  const host = wrapper.querySelector('tct-test-locale')!;
  await host.updateComplete;
  return host;
}

describe('locale and direction', () => {
  it('uses the nearest [lang], across shadow roots, else the document language', async () => {
    document.documentElement.lang = 'fr-CA';
    const inherited = await locale();
    expect(inherited.locale.locale).toBe('fr-CA');

    const own = await locale('', 'de-AT');
    expect(own.locale.locale).toBe('de-AT');

    const outer = await fixture<HTMLDivElement>(`<div lang="ja-JP"></div>`);
    const shadow = outer.attachShadow({mode: 'open'});
    const inner = document.createElement('tct-test-locale');
    shadow.append(inner);
    await inner.updateComplete;
    expect(inner.locale.locale).toBe('ja-JP');
  });

  it('follows <html lang> changes without a call', async () => {
    document.documentElement.lang = 'en';
    const host = await locale();
    document.documentElement.lang = 'es';
    await waitUntil(() => host.locale.locale === 'es', 'locale follows html lang');
  });

  it('refresh() re-reads an intermediate ancestor’s lang', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      `<div lang="en"><section><tct-test-locale></tct-test-locale></section></div>`,
    );
    const host = wrapper.querySelector('tct-test-locale')!;
    await host.updateComplete;
    wrapper.querySelector('section')!.lang = 'de';
    host.locale.refresh();
    expect(host.locale.locale).toBe('de');
  });

  it('direction comes from the computed style, else the locale', async () => {
    const rtl = await fixture<HTMLDivElement>(
      `<div dir="rtl"><tct-test-locale></tct-test-locale></div>`,
    );
    const host = rtl.querySelector('tct-test-locale')!;
    await host.updateComplete;
    expect(host.locale.dir).toBe('rtl');
    const ltr = await locale('', 'ar-SA');
    // A computed style wins: `lang="ar"` alone does not flip the layout direction.
    expect(ltr.locale.dir).toBe('ltr');
  });

  it('a provider overrides locale and direction', async () => {
    const provider = await fixture<TctTestLocaleProvider>(
      `<tct-test-locale-provider><tct-test-locale></tct-test-locale></tct-test-locale-provider>`,
    );
    const host = provider.querySelector('tct-test-locale')!;
    await host.updateComplete;
    provider.value = {locale: 'he-IL', dir: 'rtl'};
    await waitUntil(() => host.locale.locale === 'he-IL', 'provider locale');
    expect(host.locale.dir).toBe('rtl');
  });
});

describe('message resolution order', () => {
  it('falls back to the English defaults, then to the id with a dev warning', async () => {
    const host = await locale();
    expect(host.locale.t('next')).toBe('Go to next page');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.tctDevMode = true;
    try {
      expect(host.locale.t('doesNotExist')).toBe('@tct.pagination.doesNotExist');
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.tctDevMode = undefined;
      warn.mockRestore();
    }
  });

  it('accepts full ids and short keys in the namespace', async () => {
    const host = await locale();
    expect(host.locale.t('@tct.pagination.next')).toBe('Go to next page');
    expect(host.locale.t('next')).toBe('Go to next page');
  });

  it('loads the shipped catalog for the resolved locale and re-renders when it arrives', async () => {
    const host = await locale('', 'de-DE');
    await waitUntil(
      () => text(host) === 'Zur nächsten Seite wechseln',
      'German catalog loaded and rendered',
    );
    expect(host.renders).toBeGreaterThan(1);
  });

  it('resolves regional and alias tags to the shipped catalog (fr-CA -> fr-FR, zh-Hant -> zh-TW)', async () => {
    const french = await locale('', 'fr-CA');
    await waitUntil(() => text(french) !== 'Go to next page', 'French loaded');
    expect(text(french)).toMatch(/suivante/i);
    const traditional = await locale('', 'zh-Hant');
    await waitUntil(() => text(traditional) !== 'Go to next page', 'Traditional Chinese loaded');
  });

  it('registered translations outrank shipped ones and are available immediately', async () => {
    registerTranslation('de', {'@tct.pagination.next': 'Weiter (App)'});
    const host = await locale('', 'de-DE');
    expect(host.locale.t('next')).toBe('Weiter (App)');
    await nextFrame();
    expect(text(host)).toBe('Weiter (App)');
  });

  it('a registration made after render re-renders the host', async () => {
    const host = await locale('', 'sv-SE');
    const before = host.renders;
    registerTranslation('sv-SE', {'@tct.pagination.next': 'Nästa'});
    await waitUntil(() => text(host) === 'Nästa', 'late registration rendered');
    expect(host.renders).toBeGreaterThan(before);
  });

  it('provider messages and overrides slot in above registrations and shipped catalogs', async () => {
    const provider = await fixture<TctTestLocaleProvider>(
      `<tct-test-locale-provider><tct-test-locale></tct-test-locale></tct-test-locale-provider>`,
    );
    const host = provider.querySelector('tct-test-locale')!;
    await host.updateComplete;
    provider.value = {
      locale: 'de-DE',
      messages: {'de-DE': {'@tct.pagination.next': {defaultMessage: 'Provider weiter'}}},
    };
    await waitUntil(() => host.locale.t('next') === 'Provider weiter', 'provider messages');

    provider.value = {
      locale: 'de-DE',
      messages: {'de-DE': {'@tct.pagination.next': 'Provider weiter'}},
      overrides: {'de-DE': {'@tct.pagination.next': 'Override weiter'}},
    };
    await waitUntil(() => host.locale.t('next') === 'Override weiter', 'provider overrides');
  });

  it('the host attribute beats everything, and is formatted with the arguments when given', async () => {
    const host = await locale('next-label="Custom next"', 'de-DE');
    expect(host.locale.t('next', undefined, 'next-label')).toBe('Custom next');
    host.setAttribute('next-label', '{n, plural, one {# thing} other {# things}}');
    expect(host.locale.t('next', {n: 3}, 'next-label')).toBe('3 things');
    host.setAttribute('next-label', '');
    await waitUntil(
      () => host.locale.t('next', undefined, 'next-label') !== '',
      'empty attribute ignored',
    );
    expect(host.locale.t('next', undefined, 'next-label')).not.toBe('');
  });

  it('a custom loader replaces how catalogs are fetched', async () => {
    setLocaleLoader(() => Promise.resolve({'@tct.pagination.next': 'Loaded elsewhere'}));
    const host = await locale('', 'it-IT');
    await waitUntil(() => text(host) === 'Loaded elsewhere', 'custom loader used');
  });
});

describe('ICU arguments and formatting', () => {
  it('formats numbers and plurals for the locale, English defaults with English rules', async () => {
    const host = await locale('', 'de-DE');
    // Until the German catalog arrives the English default is formatted with English rules.
    expect(host.locale.t('count', {from: 1, to: 25, total: 1234})).toBe('1–25 of 1,234');
    await waitUntil(() => text(host) !== 'Go to next page', 'German catalog loaded');
    expect(host.locale.t('count', {from: 1, to: 25, total: 1234})).toContain('1.234');
    const english = await locale('', 'en');
    expect(english.locale.t('pages', {count: 1})).toBe('1 page');
    expect(english.locale.t('pages', {count: 2})).toBe('2 pages');
  });

  it('exposes cached Intl formatters for the resolved locale', async () => {
    const host = await locale('', 'de-DE');
    const first = host.locale.numberFormat({maximumFractionDigits: 1});
    expect(host.locale.numberFormat({maximumFractionDigits: 1})).toBe(first);
    expect(first.format(1234.56)).toBe('1.234,6');
    expect(host.locale.collator({sensitivity: 'base'}).compare('a', 'A')).toBe(0);
    expect(
      host.locale.dateTimeFormat({timeZone: 'UTC'}).format(new Date(Date.UTC(2020, 0, 2))),
    ).toBe('2.1.2020');
  });

  it('an invalid lang never throws from the formatters', async () => {
    const host = await locale('', 'not a locale!');
    expect(() => host.locale.collator()).not.toThrow();
    expect(() => host.locale.numberFormat()).not.toThrow();
    expect(host.locale.t('next')).toBe('Go to next page');
  });

  it('the pseudo locale renders accented, padded text from the shipped catalog', async () => {
    const host = await locale('', 'en-XA');
    await waitUntil(() => text(host).startsWith('['), 'pseudo loaded');
    expect(text(host)).toMatch(/^\[.*~+\]$/);
  });

  it('right-to-left catalogs load and render (ar-SA)', async () => {
    const host = await locale('', 'ar-SA');
    await waitUntil(() => /[؀-ۿ]/.test(text(host)), 'Arabic loaded');
  });
});
