import {html, nothing, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {createRef, ref} from 'lit/directives/ref.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {adoptLightDomStyles} from '@tecton-astryx/core/styles/light-dom.js';
import {TctToastViewport} from './tct-toast-viewport.js';
import {registerToastProvider} from './toaster.js';
import {
  TOAST_POSITIONS,
  type LayerToastConfig,
  type ToastInset,
  type ToastPosition,
} from './toast.types.js';

/**
 * The runtime twin of `tct-layer-provider.light.css` (which the generated `light-dom.css` carries for
 * pages without JavaScript): the element is transparent to layout.
 */
const LIGHT_DOM_SHEET =
  '@layer tecton.light-dom { :where(tct-layer-provider) { display: contents; } }';
let lightSheet: CSSStyleSheet | undefined;

/**
 * App-level provider for layer systems: it hosts the toast viewport that `toast()` raises toasts in
 * and carries the toast configuration (position, how many are visible, inset). It is optional:
 * without one `toast()` creates a fallback viewport on `document.body`. A provider nested in another
 * one does nothing (the outermost wins). The provider has no shadow root and no box; put it around
 * your application (or inside a theme island so the toasts inherit the island's tokens).
 *
 * @summary App-level provider that hosts the toast viewport and its configuration.
 * @tag tct-layer-provider
 * @upstream LayerProvider
 * @slot - Your application.
 * @cloakDisplay contents
 */
export class TctLayerProvider extends TctElement {
  static override readonly tagName = 'tct-layer-provider';
  static override readonly dependencies = [TctToastViewport];

  /** Position of the toast stack: `bottom-end` (default), `bottom-start`, `top-end`, `top-start`. `start` and `end` are logical. */
  @property({attribute: 'toast-position'}) toastPosition: ToastPosition | undefined;
  /** Maximum visible toasts (default 5). */
  @property({type: Number, attribute: 'toast-max-visible'}) toastMaxVisible: number | undefined;
  /** Inset of the toast stack from the screen edges, in px. */
  @property({attribute: false}) toastInset: ToastInset | undefined;
  /** The whole toast configuration as one object (upstream `toast`); the attributes and `toastInset` win over its fields. */
  @property({attribute: false}) toast: LayerToastConfig | undefined;

  /** The toast viewport this provider hosts, or `null` when it is nested in another provider or not rendered yet. */
  get viewport(): TctToastViewport | null {
    // A reference, not a query: a modal dialog takes the viewport in (and gives it back) while it is open.
    return this.#viewport.value ?? null;
  }

  /** A provider inside another provider does nothing: the outermost one owns the viewport. */
  get nested(): boolean {
    return this.parentElement?.closest('tct-layer-provider') != null;
  }

  // -------------------------------------------------------------------------------- internals

  #unregister: (() => void) | undefined;
  readonly #viewport = createRef<TctToastViewport>();

  /** No shadow root: the provider is transparent (A§8.1). */
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    lightSheet ??= (() => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(LIGHT_DOM_SHEET);
      return sheet;
    })();
    adoptLightDomStyles(this, lightSheet);
    super.connectedCallback();
    if (!this.nested) this.#unregister = registerToastProvider(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unregister?.();
    this.#unregister = undefined;
  }

  protected override updated(_changed: PropertyValues<this>): void {
    const viewport = this.viewport;
    if (!viewport) return;
    const config = this.toast;
    const position = this.toastPosition ?? config?.position ?? 'bottom-end';
    viewport.position = TOAST_POSITIONS.includes(position) ? position : 'bottom-end';
    viewport.maxVisible = this.toastMaxVisible ?? config?.maxVisible ?? 5;
    viewport.inset = this.toastInset ?? config?.inset;
  }

  override render() {
    return this.nested
      ? nothing
      : html`<tct-toast-viewport ${ref(this.#viewport)}></tct-toast-viewport>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-layer-provider': TctLayerProvider;
  }
}
