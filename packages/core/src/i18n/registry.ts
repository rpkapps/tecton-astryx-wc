/**
 * Translation registry (A§9.15): what is registered by the application, what has been loaded from
 * `@tecton-astryx/locales`, how a requested locale maps onto a shipped catalog, and change
 * notification so `LocaleController` hosts re-render when a lazy catalog arrives.
 *
 * Resolution of a requested locale to catalogs: the canonical tag, then its base-language parents,
 * each expanded through the alias table (`fr` -> `fr-FR`, `zh-Hant` -> `zh-TW`, `nb` -> `no-NO`).
 * English is always the final fallback and is supplied by the component (`defaults`), never loaded.
 */
import {aliases, pseudoTag, tags} from '@tecton-astryx/locales/aliases.js';
import {loaders} from '@tecton-astryx/locales/loaders.js';
import {devWarn} from '../utils/dev.js';

export type MessageRecord = Readonly<Record<string, string>>;
export type LocaleLoader = (tag: string) => Promise<MessageRecord>;

const registered = new Map<string, Record<string, string>>();
const shipped = new Map<string, MessageRecord>();
const loading = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
let customLoader: LocaleLoader | null = null;

let shippedByLowercase: Map<string, string> | undefined;
let aliasesByLowercase: Map<string, string> | undefined;

function shippedTags(): Map<string, string> {
  return (shippedByLowercase ??= new Map(
    [...tags, pseudoTag].map((tag) => [tag.toLowerCase(), tag]),
  ));
}

function aliasTable(): Map<string, string> {
  return (aliasesByLowercase ??= new Map(
    Object.entries(aliases).map(([alias, target]) => [alias.toLowerCase(), target]),
  ));
}

function notify(): void {
  for (const listener of [...listeners]) listener();
}

/** Canonical BCP 47 spelling (`pt-br` -> `pt-BR`); the input unchanged when it is not a valid tag. */
export function canonicalLocale(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? locale;
  } catch {
    return locale;
  }
}

/** `zh-Hant-TW` -> `[zh-Hant-TW, zh-Hant, zh-TW, zh]` (most to least specific, deduplicated). */
function specificityChain(locale: string): string[] {
  const canonical = canonicalLocale(locale);
  let parsed: Intl.Locale;
  try {
    parsed = new Intl.Locale(canonical);
  } catch {
    return [canonical];
  }
  const {language, script, region} = parsed;
  const candidates = [
    canonical,
    script && region ? `${language}-${script}-${region}` : undefined,
    script ? `${language}-${script}` : undefined,
    region ? `${language}-${region}` : undefined,
    language,
  ];
  return [...new Set(candidates.filter((tag): tag is string => Boolean(tag)))];
}

/**
 * The shipped catalog tag for a requested locale (`fr-CA` -> `fr-FR`, `zh-Hant-HK` -> `zh-TW`), or
 * `undefined` when none applies (English is not a "catalog" a component needs loaded).
 */
export function resolveCatalogTag(locale: string): string | undefined {
  for (const candidate of specificityChain(locale)) {
    const lower = candidate.toLowerCase();
    const direct = shippedTags().get(lower);
    if (direct) return direct;
    const alias = aliasTable().get(lower);
    if (alias) return alias;
  }
  return undefined;
}

/**
 * Catalog tags to consult for `locale`, most specific first, without English. Registered
 * translations use the requested spelling (`fr-CA`), shipped ones the resolved tag (`fr-FR`).
 */
export function localeChain(locale: string): string[] {
  const chain: string[] = [];
  const add = (tag: string | undefined): void => {
    if (tag && !chain.includes(tag)) chain.push(tag);
  };
  for (const candidate of specificityChain(locale)) {
    add(candidate);
    add(shippedTags().get(candidate.toLowerCase()) ?? aliasTable().get(candidate.toLowerCase()));
  }
  return chain;
}

/**
 * Registers (merges) application translations for `locale`. They outrank shipped catalogs and are
 * available immediately.
 */
export function registerTranslation(locale: string, messages: Record<string, string>): void {
  const tag = canonicalLocale(locale);
  registered.set(tag, {...registered.get(tag), ...messages});
  notify();
}

/** Replaces how shipped catalogs are fetched (a CDN, a bundler chunk map). `null` restores the default. */
export function setLocaleLoader(loader: LocaleLoader | null): void {
  customLoader = loader;
}

/**
 * Loads the shipped catalog `locale` resolves to (once). Resolves when it is available, or when
 * nothing needs loading; a failed import warns and resolves, so a missing catalog degrades to
 * English instead of breaking rendering. The custom loader receives the resolved shipped tag when
 * there is one, otherwise the requested tag.
 */
export function loadLocale(locale: string): Promise<void> {
  const tag = resolveCatalogTag(locale) ?? canonicalLocale(locale);
  if (tag === 'en' || shipped.has(tag)) return Promise.resolve();
  const inFlight = loading.get(tag);
  if (inFlight) return inFlight;

  const custom = customLoader;
  const load: Promise<MessageRecord> = custom
    ? Promise.resolve().then(() => custom(tag))
    : (loaders[tag]?.().then((module) => module.default) ??
      Promise.reject(new Error(`no catalog for ${tag}`)));
  const promise = load
    .then((messages) => {
      shipped.set(tag, messages);
      notify();
    })
    .catch((error: unknown) => {
      devWarn(`i18n:load:${tag}`, `Could not load the "${tag}" catalog; using English.`, error);
    })
    .finally(() => {
      loading.delete(tag);
    });
  loading.set(tag, promise);
  return promise;
}

/** Whether the catalog for `locale` (or nothing, for English) is available now. */
export function isLocaleLoaded(locale: string): boolean {
  const tag = resolveCatalogTag(locale);
  return tag === undefined || tag === 'en' || shipped.has(tag);
}

/** First message for `id` in registered then shipped catalogs along the chain for `locale`. */
export function lookupMessage(id: string, locale: string): string | undefined {
  for (const tag of localeChain(locale)) {
    const message = registered.get(tag)?.[id] ?? shipped.get(tag)?.[id];
    if (message !== undefined) return message;
  }
  return undefined;
}

/** Subscribes to registrations and loads; returns the unsubscribe function. */
export function onLocaleData(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Clears registered, loaded and pending state and the custom loader. Test-only. */
export function resetI18n(): void {
  registered.clear();
  shipped.clear();
  loading.clear();
  listeners.clear();
  customLoader = null;
}
