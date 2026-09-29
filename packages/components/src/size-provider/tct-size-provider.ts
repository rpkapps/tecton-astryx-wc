import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {sizeContext, type ElementSize} from '@tecton-wc/core/context/keys.js';
import {TctProviderElement} from '@tecton-wc/core/provider-element.js';
import {warnInvalidValue} from '../text/text.types.js';
import lightStyles from './tct-size-provider.light.css?inline';
import {ELEMENT_SIZES} from './size-provider.types.js';

/**
 * Cascades a default `size` to every control inside it (buttons, inputs, tabs, selectors, ...).
 * A control's own `size` attribute always wins; the provider is the fallback. Without a `size` the
 * provider answers "no container is providing one" and controls use their own default, which also
 * cancels a size provided further out.
 *
 * It has no shadow root, draws nothing (`display: contents`) and adds no semantics.
 *
 * @summary Provides a default size (sm, md or lg) to the controls inside it.
 * @tag tct-size-provider
 * @upstream SizeProvider
 * @slot - The subtree whose controls take the size.
 * @cloakDisplay contents
 */
export class TctSizeProvider extends TctProviderElement {
  static override readonly tagName = 'tct-size-provider';
  static override readonly lightStyles = lightStyles;

  /** Default size for the controls inside: `sm`, `md` or `lg`. Unset: controls use their own default. */
  @property({reflect: true}) size: ElementSize | undefined = undefined;

  readonly #provider: ContextProvider<typeof sizeContext> = new ContextProvider<typeof sizeContext>(
    this,
    {
      context: sizeContext,
      initialValue: null,
    },
  );

  #publish(): void {
    const size = this.size;
    // An unknown value provides nothing: components would mis-size themselves on it.
    this.#provider.setValue(size && ELEMENT_SIZES.includes(size) ? size : null);
  }

  override connectedCallback(): void {
    // Before the announcement, so the first consumers that ask already get the right value.
    this.#publish();
    super.connectedCallback();
  }

  protected override willUpdate(): void {
    warnInvalidValue('tct-size-provider', 'size', this.size || undefined, ELEMENT_SIZES);
    this.#publish();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-size-provider': TctSizeProvider;
  }
}
