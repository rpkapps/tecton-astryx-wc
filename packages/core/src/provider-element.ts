/**
 * `TctProviderElement`: base class of the context providers (`tct-theme`, `tct-size-provider`,
 * `tct-internationalization-provider`, ...), A§8.1 (providers row).
 *
 * A provider has no shadow root and renders nothing: its children stay in the author's tree, so
 * selectors, `:lang()`, `dir` and `color-scheme` reach them exactly as they would through any other
 * element. Its only styling is a small light-DOM sheet (`display: contents`, or `display: block` for
 * `tct-theme`) delivered through `adoptLightDomStyles` (A§6.7), and its only job is answering
 * `context-request` events (A§9.4).
 *
 * ```ts
 * import lightStyles from './tct-size-provider.light.css?inline';
 * export class TctSizeProvider extends TctProviderElement {
 *   static override readonly tagName = 'tct-size-provider';
 *   static override readonly lightStyles = lightStyles;
 * }
 * ```
 *
 * Guides: [mwg:custom-elements] [mwg:styling-web-components]
 */
import {ReactiveElement, unsafeCSS, type CSSResult, type PropertyValues} from 'lit';
import {adoptLightDomStyles} from './styles/light-dom.js';
import {TctElement} from './tct-element.js';

export abstract class TctProviderElement extends TctElement {
  /** The light-DOM sheet (CSS text from `*.light.css?inline`, or a constructed sheet). */
  static readonly lightStyles: string | CSSResult | undefined;

  static #sheets = new WeakMap<object, CSSResult>();

  /** Providers render into themselves, and never draw anything of their own. */
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /**
   * Skips `LitElement.update()`: it would render into the host (an empty `render()` still appends a
   * marker comment to the author's children). Property reflection and lifecycle are unchanged.
   */
  protected override update(changed: PropertyValues): void {
    (ReactiveElement.prototype as unknown as {update(changed: PropertyValues): void}).update.call(
      this,
      changed,
    );
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const ctor = this.constructor as typeof TctProviderElement;
    const source = ctor.lightStyles;
    if (source === undefined) return;
    let sheet: CSSResult;
    if (typeof source === 'string') {
      const cached = TctProviderElement.#sheets.get(ctor);
      sheet = cached ?? unsafeCSS(source);
      if (!cached) TctProviderElement.#sheets.set(ctor, sheet);
    } else {
      sheet = source;
    }
    adoptLightDomStyles(this, sheet);
  }
}
