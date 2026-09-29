/**
 * Text direction of a locale (A§9.15, port of upstream `getLocaleDirection`). Server-safe.
 *
 * Order: `Intl.Locale#getTextInfo()` (CLDR-backed; older engines expose the `textInfo` accessor),
 * then the maximised script, then the language list, then `ltr`.
 */

const RTL_SCRIPTS = new Set([
  'Arab',
  'Hebr',
  'Thaa',
  'Syrc',
  'Nkoo',
  'Adlm',
  'Rohg',
  'Mand',
  'Samr',
  'Mend',
  'Yezi',
]);

const RTL_LANGUAGES = new Set([
  'ar',
  'he',
  'iw',
  'fa',
  'ur',
  'ps',
  'sd',
  'ug',
  'yi',
  'dv',
  'ckb',
  'syr',
]);

type LocaleWithTextInfo = Intl.Locale & {
  getTextInfo?: () => {direction?: string};
  textInfo?: {direction?: string};
};

export function getLocaleDirection(locale: string): 'ltr' | 'rtl' {
  let parsed: LocaleWithTextInfo;
  try {
    parsed = new Intl.Locale(locale);
  } catch {
    return 'ltr';
  }
  try {
    const info = typeof parsed.getTextInfo === 'function' ? parsed.getTextInfo() : parsed.textInfo;
    if (info?.direction) return info.direction === 'rtl' ? 'rtl' : 'ltr';
  } catch {
    // Fall through to the script/language tables.
  }
  try {
    const script = parsed.script ?? parsed.maximize().script;
    if (script) return RTL_SCRIPTS.has(script) ? 'rtl' : 'ltr';
  } catch {
    // Fall through to the language table.
  }
  return RTL_LANGUAGES.has(parsed.language) ? 'rtl' : 'ltr';
}
