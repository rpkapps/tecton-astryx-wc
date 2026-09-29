/**
 * `LocaleController` (A§9.15): the one place a component asks "which locale, which direction, what
 * string". Locale comes from a provider override, else the nearest `[lang]` (crossing shadow roots),
 * else `<html lang>` / `navigator.language`; direction from the host's computed style (or the
 * provider); strings from a five-step resolution order.
 *
 * Message resolution, first hit wins:
 *  1. the host attribute named by `overrideAttribute` (author override, e.g. `close-label`)
 *  2. `tct-internationalization-provider` overrides (context)
 *  3. provider `messages`, then registered translations, then the loaded shipped catalog, along the
 *     chain for the resolved locale (exact, base language, alias such as `fr` -> `fr-FR`)
 *  4. the English default the component passes as `defaults`
 *  5. the id itself, with a dev warning
 *
 * ```ts
 * import defaults from '@tecton-astryx/locales/en/dialog.js';
 * #locale = new LocaleController(this, {namespace: 'dialog', defaults});
 * render() { return html`<button aria-label=${this.#locale.t('close', undefined, 'close-label')}>`; }
 * ```
 */
import type {ReactiveController} from 'lit';
import {ContextConsumer} from '../context/protocol.js';
import {localeContext, type LocaleContextValue, type MessageValue} from '../context/keys.js';
import type {TctElement} from '../tct-element.js';
import {devWarn} from '../utils/dev.js';
import {getLocaleDirection} from './direction.js';
import {formatMessage} from './format.js';
import {canonicalLocale, loadLocale, localeChain, lookupMessage, onLocaleData} from './registry.js';

export interface LocaleControllerOptions {
  /**
   * Message namespace: `t('next')` resolves `@astryx.<namespace>.next`, then `@tct.<namespace>.next`
   * (kebab-case folder names and upstream camelCase namespaces are both accepted).
   */
  namespace?: string;
  /** English messages by full id (`@tecton-astryx/locales/en/<namespace>.js`); the last catalog step. */
  defaults?: Readonly<Record<string, string>>;
}

// ------------------------------------------------------------- <html lang dir> shared observer

const documentListeners = new Set<() => void>();
let documentObserver: MutationObserver | undefined;

function watchDocument(listener: () => void): () => void {
  documentListeners.add(listener);
  if (!documentObserver && typeof MutationObserver !== 'undefined') {
    documentObserver = new MutationObserver(() => {
      for (const notify of [...documentListeners]) notify();
    });
    documentObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang', 'dir'],
    });
  }
  return () => {
    documentListeners.delete(listener);
    if (documentListeners.size === 0) {
      documentObserver?.disconnect();
      documentObserver = undefined;
    }
  };
}

/** Nearest `lang` on the host or an ancestor, crossing shadow roots; `undefined` when none. */
function nearestLang(element: Element): string | undefined {
  for (let node: Node | null = element; node; node = node.parentNode ?? (node as ShadowRoot).host) {
    if (node instanceof Element) {
      const lang = node.getAttribute('lang');
      if (lang) return lang;
    }
  }
  return undefined;
}

function documentLocale(): string {
  return document.documentElement.lang || navigator.language || 'en';
}

// -------------------------------------------------------------------------- Intl formatter cache

const formatters = new Map<string, Intl.Collator | Intl.NumberFormat | Intl.DateTimeFormat>();

function cached<T extends Intl.Collator | Intl.NumberFormat | Intl.DateTimeFormat>(
  kind: 'collator' | 'number' | 'date',
  locale: string,
  options: object | undefined,
  create: () => T,
): T {
  const key = `${kind}|${locale}|${options ? JSON.stringify(options) : ''}`;
  let formatter = formatters.get(key) as T | undefined;
  if (!formatter) {
    formatter = create();
    formatters.set(key, formatter);
  }
  return formatter;
}

const camelCase = (name: string): string =>
  name.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
const kebabCase = (name: string): string =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const providerMessageCache = new WeakMap<
  object,
  Map<string, Readonly<Record<string, MessageValue>>>
>();

function providerCatalog(
  messages: NonNullable<LocaleContextValue['messages']>,
  tag: string,
): Readonly<Record<string, MessageValue>> | undefined {
  let byTag = providerMessageCache.get(messages);
  if (!byTag) {
    byTag = new Map(Object.entries(messages).map(([key, value]) => [canonicalLocale(key), value]));
    providerMessageCache.set(messages, byTag);
  }
  return byTag.get(tag);
}

function providerOverride(
  overrides: NonNullable<LocaleContextValue['overrides']>,
  tag: string,
): Readonly<Record<string, string>> | undefined {
  for (const [key, value] of Object.entries(overrides)) {
    if (canonicalLocale(key) === tag) return value;
  }
  return undefined;
}

const messageText = (value: MessageValue | undefined): string | undefined =>
  typeof value === 'string' ? value : value?.defaultMessage;

export class LocaleController implements ReactiveController {
  readonly #host: TctElement;
  readonly #namespace: string | undefined;
  readonly #defaults: Readonly<Record<string, string>> | undefined;
  readonly #provider: ContextConsumer<typeof localeContext>;
  #lang: string | undefined;
  #stops: (() => void)[] = [];
  #loadedFor: string | undefined;

  constructor(host: TctElement, options: LocaleControllerOptions = {}) {
    this.#host = host;
    this.#namespace = options.namespace;
    this.#defaults = options.defaults;
    this.#provider = new ContextConsumer(host, {
      context: localeContext,
      subscribe: true,
      callback: () => {
        this.#ensureLoaded();
      },
    });
    host.addController(this);
  }

  /** Resolved BCP 47 locale: provider override, else the nearest `[lang]`, else the document's. */
  get locale(): string {
    const override = this.#provider.value?.locale;
    if (override) return override;
    return this.#lang ?? (typeof document === 'undefined' ? 'en' : documentLocale());
  }

  /** Text direction: provider override, else the host's computed `direction`. */
  get dir(): 'ltr' | 'rtl' {
    const override = this.#provider.value?.dir;
    if (override) return override;
    if (this.#host.isConnected) {
      const computed = getComputedStyle(this.#host).direction;
      if (computed === 'rtl' || computed === 'ltr') return computed;
    }
    return getLocaleDirection(this.locale);
  }

  /**
   * Formats a message. `key` is a short key resolved in this controller's namespace, or a full id
   * (`@astryx.pagination.next`). `overrideAttribute` names a host attribute whose non-empty value
   * wins over every catalog.
   */
  t(key: string, args?: Record<string, unknown>, overrideAttribute?: string): string {
    const locale = canonicalLocale(this.locale);

    if (overrideAttribute) {
      const override = this.#host.getAttribute(overrideAttribute);
      if (override) return args ? formatMessage(override, args, locale) : override;
    }

    const ids = this.#candidateIds(key);
    const chain = localeChain(locale);
    const context = this.#provider.value;

    for (const id of ids) {
      if (context?.overrides) {
        for (const tag of chain) {
          const message = providerOverride(context.overrides, tag)?.[id];
          if (message !== undefined) return formatMessage(message, args, locale);
        }
      }
    }
    for (const id of ids) {
      if (context?.messages) {
        for (const tag of chain) {
          const message = messageText(providerCatalog(context.messages, tag)?.[id]);
          if (message !== undefined) return formatMessage(message, args, locale);
        }
      }
      const catalog = lookupMessage(id, locale);
      if (catalog !== undefined) return formatMessage(catalog, args, locale);
    }
    for (const id of ids) {
      const fallback = this.#defaults?.[id];
      // English defaults follow English plural rules, whatever locale is being displayed.
      if (fallback !== undefined) return formatMessage(fallback, args, 'en');
    }

    const id = ids[0] ?? key;
    devWarn(`i18n:missing:${id}`, `Missing message "${id}" (locale ${locale}).`);
    return id;
  }

  collator(options?: Intl.CollatorOptions): Intl.Collator {
    const locale = this.#formattingLocale();
    return cached('collator', locale, options, () => new Intl.Collator(locale, options));
  }

  numberFormat(options?: Intl.NumberFormatOptions): Intl.NumberFormat {
    const locale = this.#formattingLocale();
    return cached('number', locale, options, () => new Intl.NumberFormat(locale, options));
  }

  dateTimeFormat(options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const locale = this.#formattingLocale();
    return cached('date', locale, options, () => new Intl.DateTimeFormat(locale, options));
  }

  /**
   * Re-reads the ancestor `lang` and asks for the catalog. Provider and `<html lang dir>` changes
   * refresh automatically; call this after changing an intermediate ancestor's `lang`.
   */
  refresh(): void {
    this.#lang = nearestLang(this.#host) ?? documentLocale();
    this.#ensureLoaded();
    this.#host.requestUpdate();
  }

  hostConnected(): void {
    this.#stops.push(
      watchDocument(() => {
        this.refresh();
      }),
      onLocaleData(() => {
        this.#host.requestUpdate();
      }),
    );
    this.refresh();
  }

  hostDisconnected(): void {
    for (const stop of this.#stops.splice(0)) stop();
  }

  // ---------------------------------------------------------------------------------- internals

  #ensureLoaded(): void {
    const locale = canonicalLocale(this.locale);
    if (locale === this.#loadedFor) return;
    this.#loadedFor = locale;
    void loadLocale(locale);
  }

  /** A tag `Intl` accepts (an invalid `lang` must not throw from `collator()`). */
  #formattingLocale(): string {
    const locale = canonicalLocale(this.locale);
    try {
      return Intl.getCanonicalLocales(locale)[0] ?? 'en';
    } catch {
      return 'en';
    }
  }

  #candidateIds(key: string): string[] {
    if (key.startsWith('@')) return [key];
    const namespace = this.#namespace;
    if (!namespace) return [key];
    const camel = camelCase(namespace);
    const kebab = kebabCase(namespace);
    return [
      ...new Set([
        `@astryx.${camel}.${key}`,
        `@tct.${kebab}.${key}`,
        `@tct.${camel}.${key}`,
        `@astryx.${namespace}.${key}`,
      ]),
    ];
  }
}
