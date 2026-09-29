/**
 * The i18n runtime without a DOM host: ICU formatting through the boundary module, direction,
 * locale resolution (aliases, chains), registration precedence, lazy loading, and the pseudo locale
 * (A§9.15). `LocaleController` (the host-facing part) is tested in `packages/testing`.
 */
import {afterEach, describe, expect, it, vi} from 'vitest';
import enMessages from '@tecton-wc/locales/en.js';
import pseudoMessages from '@tecton-wc/locales/pseudo.js';
import {devWarn, resetDevWarnings} from '../utils/dev.js';
import {getLocaleDirection} from './direction.js';
import {formatMessage, resetFormatCache} from './format.js';
import {
  isLocaleLoaded,
  loadLocale,
  localeChain,
  lookupMessage,
  onLocaleData,
  registerTranslation,
  resetI18n,
  resolveCatalogTag,
  setLocaleLoader,
} from './registry.js';

afterEach(() => {
  resetI18n();
  resetFormatCache();
  resetDevWarnings();
  vi.restoreAllMocks();
});

describe('formatMessage', () => {
  it('returns static strings untouched', () => {
    expect(formatMessage('Cancel', undefined, 'en')).toBe('Cancel');
  });

  it('substitutes arguments and formats plurals for the locale', () => {
    const pattern = '{count, plural, one {# item} other {# items}}';
    expect(formatMessage(pattern, {count: 1}, 'en')).toBe('1 item');
    expect(formatMessage(pattern, {count: 5}, 'en')).toBe('5 items');
    expect(formatMessage('{n, number}', {n: 1234.5}, 'de-DE')).toBe('1.234,5');
  });

  it('handles select, apostrophe quoting and rich-text-free tags', () => {
    expect(formatMessage('{g, select, f {She} other {They}} left', {g: 'f'}, 'en')).toBe(
      'She left',
    );
    expect(formatMessage("It''s {name}", {name: 'A'}, 'en')).toBe("It's A");
    expect(formatMessage("'{'literal'}'", undefined, 'en')).toBe('{literal}');
  });

  it('degrades instead of throwing: malformed pattern, missing argument, invalid locale', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.tctDevMode = true;
    try {
      expect(formatMessage('{unclosed', {}, 'en')).toBe('{unclosed');
      expect(formatMessage('Hi {name}', {}, 'en')).toBe('Hi {name}');
      expect(formatMessage('Hi {name}', {name: 'A'}, 'not a locale')).toBe('Hi A');
      expect(warn).toHaveBeenCalled();
    } finally {
      globalThis.tctDevMode = undefined;
    }
  });

  it('formats every message of the English catalog with plausible arguments', () => {
    const args = {name: 'N', status: 'S', count: 2, total: 9, value: 'V', label: 'L', index: 1};
    for (const [id, pattern] of Object.entries(enMessages)) {
      expect(() => formatMessage(pattern, args, 'en'), id).not.toThrow();
      expect(formatMessage(pattern, args, 'en'), id).not.toBe('');
    }
  });
});

describe('pseudo locale', () => {
  it('has exactly the English keys', () => {
    expect(Object.keys(pseudoMessages).sort()).toEqual(Object.keys(enMessages).sort());
  });

  it('every pseudo message is a valid ICU pattern that keeps its arguments and grows', () => {
    const args = {name: 'N', status: 'S', count: 2, total: 9, value: 'V', label: 'L', index: 1};
    for (const [id, pattern] of Object.entries(pseudoMessages)) {
      expect(pattern.startsWith('['), id).toBe(true);
      expect(pattern.endsWith(']'), id).toBe(true);
      expect(() => formatMessage(pattern, args, 'en'), id).not.toThrow();
      const english = (enMessages as Record<string, string>)[id] ?? '';
      expect(pattern.length, id).toBeGreaterThan(english.length);
    }
  });
});

describe('getLocaleDirection', () => {
  it.each(['ar', 'ar-SA', 'he', 'he-IL', 'fa-IR', 'ur', 'ps', 'az-Arab', 'ku-Arab'])(
    '%s is rtl',
    (tag) => {
      expect(getLocaleDirection(tag)).toBe('rtl');
    },
  );

  it.each(['en', 'en-US', 'de-DE', 'ja-JP', 'zh-Hant', 'sr-Cyrl', 'pseudo'])('%s is ltr', (tag) => {
    expect(getLocaleDirection(tag)).toBe('ltr');
  });

  it('never throws on garbage', () => {
    expect(getLocaleDirection('')).toBe('ltr');
    expect(getLocaleDirection('!!')).toBe('ltr');
  });
});

describe('locale resolution', () => {
  it.each([
    ['de', 'de-DE'],
    ['de-AT', 'de-DE'],
    ['fr-CA', 'fr-FR'],
    ['pt', 'pt-BR'],
    ['pt-PT', 'pt-PT'],
    ['pt-AO', 'pt-BR'],
    ['zh', 'zh-CN'],
    ['zh-Hans', 'zh-CN'],
    ['zh-Hant', 'zh-TW'],
    ['zh-HK', 'zh-TW'],
    ['zh-Hant-HK', 'zh-TW'],
    ['nb', 'no-NO'],
    ['nb-NO', 'no-NO'],
    ['nn', 'no-NO'],
    ['iw', 'he-IL'],
    ['sr-Cyrl-RS', 'sr-SP'],
    ['de-de', 'de-DE'],
    ['EN-XA', 'pseudo'],
    ['en-XA', 'pseudo'],
    ['pseudo', 'pseudo'],
  ])('%s resolves to %s', (requested, expected) => {
    expect(resolveCatalogTag(requested)).toBe(expected);
  });

  it('English and unknown languages resolve to no catalog', () => {
    expect(resolveCatalogTag('en-GB')).toBe('en');
    expect(resolveCatalogTag('xx')).toBeUndefined();
    expect(resolveCatalogTag('')).toBeUndefined();
  });

  it('builds the lookup chain most specific first, deduplicated', () => {
    expect(localeChain('fr-CA')).toEqual(['fr-CA', 'fr', 'fr-FR']);
    expect(localeChain('zh-Hant-HK')).toEqual([
      'zh-Hant-HK',
      'zh-TW',
      'zh-Hant',
      'zh-HK',
      'zh',
      'zh-CN',
    ]);
  });
});

describe('registration and lookup', () => {
  it('registered translations are available at once and win over shipped ones', async () => {
    registerTranslation('de', {'@tct.alertDialog.cancel': 'Abbrechen (App)'});
    expect(lookupMessage('@tct.alertDialog.cancel', 'de-DE')).toBe('Abbrechen (App)');
    await loadLocale('de-DE');
    expect(lookupMessage('@tct.alertDialog.cancel', 'de-DE')).toBe('Abbrechen (App)');
    // A different id still comes from the shipped catalog.
    expect(lookupMessage('@tct.appShell.skipToContent', 'de-DE')).toMatch(/\S/);
  });

  it('shipped ids are @tct.*; the upstream id form is not an accepted alias (D-015)', async () => {
    await loadLocale('de-DE');
    const upstreamForm = ['@', 'astryx.alertDialog.cancel'].join('');
    expect(lookupMessage('@tct.alertDialog.cancel', 'de-DE')).toBe('Abbrechen');
    expect(lookupMessage(upstreamForm, 'de-DE')).toBeUndefined();
    registerTranslation('de', {[upstreamForm]: 'ignored'});
    expect(lookupMessage('@tct.alertDialog.cancel', 'de-DE')).toBe('Abbrechen');
  });

  it('a regional registration outranks the language one', () => {
    registerTranslation('fr', {greeting: 'Bonjour'});
    registerTranslation('fr-CA', {greeting: 'Allo'});
    expect(lookupMessage('greeting', 'fr-CA')).toBe('Allo');
    expect(lookupMessage('greeting', 'fr-FR')).toBe('Bonjour');
  });

  it('registrations merge and notify subscribers', () => {
    const listener = vi.fn();
    const off = onLocaleData(listener);
    registerTranslation('de', {a: '1'});
    registerTranslation('de', {b: '2'});
    expect(lookupMessage('a', 'de')).toBe('1');
    expect(lookupMessage('b', 'de')).toBe('2');
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    registerTranslation('de', {c: '3'});
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('an unknown id is undefined (the controller then falls back to English defaults)', () => {
    expect(lookupMessage('nope', 'de-DE')).toBeUndefined();
  });
});

describe('lazy loading', () => {
  it('imports the catalog once, notifies, and then serves it', async () => {
    const listener = vi.fn();
    onLocaleData(listener);
    expect(isLocaleLoaded('de-DE')).toBe(false);
    expect(lookupMessage('@tct.alertDialog.cancel', 'de-DE')).toBeUndefined();

    const first = loadLocale('de-AT');
    const second = loadLocale('de-DE');
    expect(second).toBe(first);
    await first;
    expect(isLocaleLoaded('de')).toBe(true);
    expect(lookupMessage('@tct.alertDialog.cancel', 'de-AT')).toBe('Abbrechen');
    expect(listener).toHaveBeenCalledTimes(1);

    await loadLocale('de-DE');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('English and unknown locales need nothing loaded', async () => {
    expect(isLocaleLoaded('en')).toBe(true);
    await expect(loadLocale('en-US')).resolves.toBeUndefined();
    await expect(loadLocale('xx')).resolves.toBeUndefined();
  });

  it('loads the pseudo locale', async () => {
    await loadLocale('en-XA');
    expect(lookupMessage('@tct.alertDialog.cancel', 'en-XA')).toBe('[Çàñçéļ ~~]');
  });

  it('a custom loader receives the resolved shipped tag', async () => {
    const loader = vi.fn(() => Promise.resolve({'@tct.alertDialog.cancel': 'Custom'}));
    setLocaleLoader(loader);
    await loadLocale('fr-CA');
    expect(loader).toHaveBeenCalledWith('fr-FR');
    expect(lookupMessage('@tct.alertDialog.cancel', 'fr-CA')).toBe('Custom');
  });

  it('a failing loader warns and resolves, leaving English in place', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.tctDevMode = true;
    try {
      setLocaleLoader(() => Promise.reject(new Error('offline')));
      await expect(loadLocale('de-DE')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
      expect(lookupMessage('@tct.alertDialog.cancel', 'de-DE')).toBeUndefined();
      // Not cached as loaded: a later attempt can succeed.
      setLocaleLoader(null);
      await loadLocale('de-DE');
      expect(lookupMessage('@tct.alertDialog.cancel', 'de-DE')).toBe('Abbrechen');
    } finally {
      globalThis.tctDevMode = undefined;
    }
  });
});

describe('dev warnings', () => {
  it('print only in dev mode and only once per id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    devWarn('a', 'quiet');
    expect(warn).not.toHaveBeenCalled();
    globalThis.tctDevMode = true;
    try {
      devWarn('a', 'loud');
      devWarn('a', 'loud');
      devWarn('b', 'loud');
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.tctDevMode = undefined;
    }
  });
});
