/**
 * ICU message formatting boundary (A§9.15, D-007). This is the only module that imports
 * `intl-messageformat`; formatters are cached per `(locale, pattern)` so a repeated render never
 * re-parses.
 */
import {IntlMessageFormat} from 'intl-messageformat';
import {devWarn} from '../utils/dev.js';

const MAX_CACHED = 500;
const cache = new Map<string, IntlMessageFormat>();

function formatterFor(pattern: string, locale: string): IntlMessageFormat {
  const key = `${locale}\u0000${pattern}`;
  const cached = cache.get(key);
  if (cached) {
    // Refresh recency so hot patterns survive eviction.
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }
  let formatter: IntlMessageFormat;
  try {
    formatter = new IntlMessageFormat(pattern, locale);
  } catch (error) {
    // An invalid locale tag must not break rendering; the pattern itself may still be valid.
    if (error instanceof RangeError) formatter = new IntlMessageFormat(pattern, 'en');
    else throw error;
  }
  cache.set(key, formatter);
  if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  return formatter;
}

/** Cheap check for patterns that need no ICU processing (no argument, quote or tag). */
const isPlain = (pattern: string): boolean => !/[{}'<]/.test(pattern);

/**
 * Formats `pattern` (ICU MessageFormat) for `locale`. Static strings skip the parser. A malformed
 * pattern or a missing argument never throws: the pattern is returned as written and a dev warning
 * names the problem, so a bad translation degrades instead of breaking the page.
 */
export function formatMessage(
  pattern: string,
  args: Record<string, unknown> | undefined,
  locale: string,
): string {
  if (isPlain(pattern)) return pattern;
  try {
    const result = formatterFor(pattern, locale).format(args as Record<string, string | number>);
    return Array.isArray(result) ? result.join('') : String(result);
  } catch (error) {
    devWarn(
      `i18n:format:${locale}:${pattern}`,
      `Could not format message "${pattern}" for ${locale}: ${(error as Error).message}`,
    );
    return pattern;
  }
}

/** Empties the formatter cache. Test-only. */
export function resetFormatCache(): void {
  cache.clear();
}
