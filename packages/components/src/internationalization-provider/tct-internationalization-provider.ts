import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {localeContext, type LocaleContextValue} from '@tecton-wc/core/context/keys.js';
import {TctProviderElement} from '@tecton-wc/core/provider-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import lightStyles from './tct-internationalization-provider.light.css?inline';

type Messages = NonNullable<LocaleContextValue['messages']>;
type Overrides = NonNullable<LocaleContextValue['overrides']>;

/**
 * Sets the locale, extra message catalogs, message overrides and text direction for every component
 * inside it. Components resolve their strings through this context first (overrides, then the provider
 * catalogs, then the shipped catalog for the locale, then English); a component's own attribute
 * (for example `close-label`) still beats all of them. Without a provider, components read the nearest
 * `lang` (crossing shadow roots), else `<html lang>`.
 *
 * The provider reflects the locale onto itself as `lang`, so CSS `:lang()`, assistive technology and
 * `Intl` agree with what the components show. `dir` is the native attribute: set it yourself (it lays the
 * subtree out right-to-left, and components read it through the computed direction); the provider never
 * derives it from the locale. It has no shadow root and draws nothing (`display: contents`).
 *
 * @summary Provides locale, messages, overrides and direction to the components inside it.
 * @tag tct-internationalization-provider
 * @upstream InternationalizationProvider
 * @attr {'ltr' | 'rtl'} dir - Native text direction of the subtree; also what components read as their direction.
 * @slot - The subtree that takes the locale.
 * @cloakDisplay contents
 */
export class TctInternationalizationProvider extends TctProviderElement {
  static override readonly tagName = 'tct-internationalization-provider';
  static override readonly lightStyles = lightStyles;

  /** `dir` is a native attribute: observe it so a change reaches the components inside. */
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'dir'];
  }

  /**
   * BCP 47 language tag, for example `fr`, `pt-BR`, `zh-Hans`. Regional tags are respected: a message is
   * looked up from the most specific tag to the least specific (`pt-BR`, then `pt`), then English.
   */
  @property() locale = '';

  /**
   * Additional catalogs by locale tag, for locales that are not loaded from `@tecton-wc/locales`.
   * Values are ICU strings or `{defaultMessage}` entries keyed by message id.
   */
  @property({attribute: false}) messages: Messages | undefined = undefined;

  /**
   * Sparse per-locale overrides applied on top of every catalog: only the ids you list change. Message
   * ids look like `@tct.pagination.next`.
   */
  @property({attribute: false}) overrides: Overrides | undefined = undefined;

  readonly #provider = new ContextProvider(this, {context: localeContext, initialValue: null});
  #reflectedLang = false;

  override attributeChangedCallback(
    name: string,
    previous: string | null,
    value: string | null,
  ): void {
    super.attributeChangedCallback(name, previous, value);
    if (name === 'dir') this.#publish();
  }

  #direction(): 'ltr' | 'rtl' | undefined {
    const dir = this.getAttribute('dir')?.toLowerCase();
    return dir === 'ltr' || dir === 'rtl' ? dir : undefined;
  }

  /** Reflects `lang` and publishes the context value. */
  #publish(): void {
    const locale = this.locale.trim();
    if (locale) {
      if (this.getAttribute('lang') !== locale) this.setAttribute('lang', locale);
      this.#reflectedLang = true;
    } else if (this.#reflectedLang) {
      this.removeAttribute('lang');
      this.#reflectedLang = false;
    }

    const dir = this.#direction();
    const current = this.#provider.value;
    if (
      current &&
      current.locale === (locale || undefined) &&
      current.dir === dir &&
      current.messages === this.messages &&
      current.overrides === this.overrides
    ) {
      return;
    }
    this.#provider.setValue({
      locale: locale || undefined,
      dir,
      messages: this.messages,
      overrides: this.overrides,
    });
  }

  override connectedCallback(): void {
    // Before the announcement, so the first consumers that ask already get the right value.
    this.#publish();
    super.connectedCallback();
  }

  protected override willUpdate(): void {
    const locale = this.locale.trim();
    if (locale) {
      try {
        Intl.getCanonicalLocales(locale);
      } catch {
        devWarn(
          `tct-internationalization-provider:locale:${locale}`,
          `<tct-internationalization-provider locale="${locale}"> is not a valid BCP 47 language tag.`,
        );
      }
    }
    this.#publish();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-internationalization-provider': TctInternationalizationProvider;
  }
}
