import {ReactiveElement, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {themeContext, type ThemeContextValue} from '@tecton-astryx/core/context/keys.js';
import {ContextConsumer, ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {adoptLightDomStyles} from '@tecton-astryx/core/styles/light-dom.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {
  flatTreeParent,
  measureMediaMode,
  type DetectedMediaMode,
} from '@tecton-astryx/core/theme/auto-media-mode.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {mediaThemeLightStyles} from './media-theme.light.js';
import {
  MEDIA_THEME_ATTRIBUTE,
  MEDIA_THEME_FALLBACKS,
  MEDIA_THEME_MODES,
  type MediaThemeFallback,
  type MediaThemeMode,
} from './media-theme.types.js';

/** Attributes whose change can move a surface's painted colour or its theme. */
const WATCHED_ATTRIBUTES = ['style', 'class', 'data-theme', MEDIA_THEME_ATTRIBUTE, 'hidden'];

/**
 * Gives its content the token context of a surface whose luminance differs from the page: media
 * overlays, scrims, toasts, tooltips and dark cards. It sets `data-media-theme="dark|light"`, which
 * the token pipeline (and a theme's generated CSS) targets: the colour scheme flips, so every
 * `light-dark()` token resolves to the right side, the text, surface, border, icon and accent roles
 * are pinned, and the focus ring (with its D-005 inner ring) follows. Structural styling of the
 * parent theme is untouched: only tokens change.
 *
 * It does not paint a background. Set the background on the parent element and let the provider
 * decide what to put on it: `mode="auto"` measures the painted surface (the parent in the flat tree,
 * crossing slots and shadow roots), then picks whichever side reads better, or no media context when
 * the ambient text already reads at 3:1. `mode="off"` keeps the element and removes the attribute,
 * so a surface can switch contexts without re-creating its children.
 *
 * It has no shadow root and no box (`display: contents`), publishes the resolved side through
 * `themeContext`, and is not for page-wide dark mode: use `tct-theme` for that.
 *
 * @summary Token context for content on an inverted surface (dark, light or measured).
 * @tag tct-media-theme
 * @upstream MediaTheme
 * @slot - Content rendered in the media context.
 * @cloakDisplay contents
 */
export class TctMediaTheme extends TctElement {
  static override readonly tagName = 'tct-media-theme';

  /**
   * The surface luminance context. `dark`: content is on a dark surface (light text, light-tinted
   * interactions). `light`: content is on a light surface. `auto` (default): decide from the painted
   * surface. `off`: no media context, the ambient theme applies.
   */
  @property({reflect: true}) mode: MediaThemeMode = 'auto';

  /**
   * The side `mode="auto"` uses while the surface cannot be measured: before the first measurement,
   * and whenever the backdrop is not knowable from CSS (a `background-image`, whose pixels need
   * sampling, or no opaque layer). Ignored unless `mode="auto"`.
   */
  @property({reflect: true}) fallback: MediaThemeFallback = 'dark';

  readonly #context = new ContextProvider(this, {
    context: themeContext,
    initialValue: {name: 'tecton', mode: 'light'},
  });
  readonly #parentTheme = new ContextConsumer(this, {
    context: themeContext,
    subscribe: true,
    callback: () => this.#apply(),
  });

  /** The last `auto` answer; `null` while unmeasured or unmeasurable (the fallback applies). */
  #detected: DetectedMediaMode | null = null;
  #observer: MutationObserver | undefined;
  #systemDark: MediaQueryList | undefined;
  #scheduled = false;
  #value: ThemeContextValue | undefined;

  /** No shadow root: the provider renders nothing and its children stay in the light DOM. */
  protected override createRenderRoot(): this {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    adoptLightDomStyles(this, mediaThemeLightStyles);
    this.#apply();
    if (this.mode === 'auto') {
      this.#watch();
      // A reconnected element sits on a new surface; the first connection measures in `updated`.
      if (this.hasUpdated) this.#measure();
    }
  }

  /** A `moveBefore()` move keeps the state but changes the surface and the trees to observe. */
  override connectedMoveCallback(): void {
    if (this.mode !== 'auto') return;
    this.#watch();
    this.#schedule();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('mode') && !MEDIA_THEME_MODES.includes(this.mode)) {
      devWarn(
        `media-theme:mode:${String(this.mode)}`,
        `mode="${String(this.mode)}" is not one of ${MEDIA_THEME_MODES.join(', ')}.`,
      );
    }
    if (changed.has('fallback') && !MEDIA_THEME_FALLBACKS.includes(this.fallback)) {
      devWarn(
        `media-theme:fallback:${String(this.fallback)}`,
        `fallback="${String(this.fallback)}" is not one of ${MEDIA_THEME_FALLBACKS.join(', ')}.`,
      );
    }
    if (changed.has('mode')) {
      if (this.mode === 'auto') {
        if (this.isConnected && this.#observer === undefined) this.#watch();
      } else {
        this.#unwatch();
        this.#detected = null;
      }
    }
    // The attribute is set before the first paint, with the fallback for an unmeasured `auto`.
    this.#apply();
  }

  /** Nothing to render: skip Lit's template commit, which would leave a marker comment behind. */
  protected override update(changed: PropertyValues): void {
    (ReactiveElement.prototype as unknown as {update(changed: PropertyValues): void}).update.call(
      this,
      changed,
    );
  }

  protected override updated(): void {
    if (this.mode === 'auto') this.#measure();
  }

  /** The side the children get: an explicit mode, the measured side, or the fallback. */
  #resolved(): 'dark' | 'light' | 'off' {
    if (this.mode === 'dark' || this.mode === 'light') return this.mode;
    if (this.mode === 'auto')
      return this.#detected ?? (this.fallback === 'light' ? 'light' : 'dark');
    return 'off';
  }

  /** Writes the attribute and the published theme for the current resolution. */
  #apply(): void {
    const resolved = this.#resolved();
    if (resolved === 'off') this.removeAttribute(MEDIA_THEME_ATTRIBUTE);
    else if (this.getAttribute(MEDIA_THEME_ATTRIBUTE) !== resolved) {
      this.setAttribute(MEDIA_THEME_ATTRIBUTE, resolved);
    }
    const parent = this.#parentTheme.value;
    const next: ThemeContextValue = {
      name: parent?.name ?? 'tecton',
      mode: resolved === 'off' ? (parent?.mode ?? this.#systemMode()) : resolved,
    };
    if (this.#value?.name !== next.name || this.#value.mode !== next.mode) {
      this.#value = next;
      this.#context.setValue(next);
    }
  }

  #systemMode(): 'dark' | 'light' {
    return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  /** Measures the parent surface (never this element: its own attribute would feed back). */
  #measure(): void {
    if (!this.isConnected) return;
    const {mode} = measureMediaMode(this);
    if (mode !== this.#detected) {
      this.#detected = mode;
      this.#apply();
    }
  }

  /** Re-measures on changes that can move the surface: ancestor attributes and the system scheme. */
  #watch(): void {
    this.#unwatch();
    if (typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver((records) => {
      const ancestors = new Set<Node>();
      for (let node = flatTreeParent(this); node; node = flatTreeParent(node)) ancestors.add(node);
      if (records.some((record) => ancestors.has(record.target))) this.#schedule();
    });
    // One observer over every tree the host sits in: its own root, then each shadow host's root.
    for (let root: Node = this.getRootNode(); ;) {
      observer.observe(root, {
        attributes: true,
        subtree: true,
        attributeFilter: WATCHED_ATTRIBUTES,
      });
      if (!(root instanceof ShadowRoot)) break;
      root = root.host.getRootNode();
    }
    this.#observer = observer;
    if (typeof matchMedia === 'function') {
      this.#systemDark = matchMedia('(prefers-color-scheme: dark)');
      this.#systemDark.addEventListener('change', this.#onSystemChange);
    }
  }

  #unwatch(): void {
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#systemDark?.removeEventListener('change', this.#onSystemChange);
    this.#systemDark = undefined;
  }

  readonly #onSystemChange = (): void => this.#schedule();

  #schedule(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      if (this.mode === 'auto') this.#measure();
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-media-theme': TctMediaTheme;
  }
}
