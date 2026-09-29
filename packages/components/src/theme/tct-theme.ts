import {property} from 'lit/decorators.js';
import {ContextConsumer, ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {themeContext, type ThemeContextValue} from '@tecton-wc/core/context/keys.js';
import {TctProviderElement} from '@tecton-wc/core/provider-element.js';
import {warnInvalidValue} from '../text/text.types.js';
import lightStyles from './tct-theme.light.css?inline';
import {
  DEFAULT_THEME,
  THEME_MODES,
  themeName,
  type ThemeInput,
  type ThemeMode,
} from './theme.types.js';

const DARK_QUERY = '(prefers-color-scheme: dark)';

// ------------------------------------------------------------------ root: <html> synchronisation

interface RootState {
  mode: ThemeMode;
  name: string;
}

/** The outermost themes, in connection order. The first one owns the `<html>` attributes. */
const roots = new Set<object>();
const rootStates = new WeakMap<object, RootState>();
let savedRoot: {mode: string | null; name: string | null} | undefined;

/**
 * Applies the owner's mode and name to `<html>` (`data-theme` drives `color-scheme` and the token
 * blocks for the viewport, scrollbars and native controls; `data-tct-theme` names the theme), and
 * puts back what was there before when the last root theme goes away.
 */
function applyRoot(): void {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  const owner = roots.values().next().value;
  const state = owner ? rootStates.get(owner) : undefined;
  if (!state) {
    if (savedRoot) {
      restore(html, 'data-theme', savedRoot.mode);
      restore(html, 'data-tct-theme', savedRoot.name);
      savedRoot = undefined;
    }
    return;
  }
  savedRoot ??= {mode: html.getAttribute('data-theme'), name: html.getAttribute('data-tct-theme')};
  if (state.mode === 'light' || state.mode === 'dark') html.setAttribute('data-theme', state.mode);
  else html.removeAttribute('data-theme');
  html.setAttribute('data-tct-theme', state.name);
}

function restore(element: Element, attribute: string, value: string | null): void {
  if (value === null) element.removeAttribute(attribute);
  else element.setAttribute(attribute, value);
}

/**
 * Applies a theme and colour mode to everything inside it: a theme island that pins `color-scheme`,
 * paints the page surface and text colour, and tells descendants which theme and resolved mode they
 * are in (light or dark, never `system`).
 *
 * The outermost `tct-theme` on a page also sets `data-theme` and `data-tct-theme` on `<html>`, so the
 * viewport, scrollbars, native controls and portalled layers follow the mode; nested themes are
 * islands only. `mode="system"` follows the operating system and leaves `<html data-theme>` unset.
 *
 * It has no shadow root; its children stay in the page's own tree.
 *
 * @summary A theme island: colour mode and theme name for the subtree, and the page's `data-theme`.
 * @tag tct-theme
 * @upstream Theme
 * @slot - The subtree that takes the theme and mode.
 * @cloakDisplay block
 */
export class TctTheme extends TctProviderElement {
  static override readonly tagName = 'tct-theme';
  static override readonly lightStyles = lightStyles;

  /**
   * The theme, by name (`tecton`, the default) or as an object with a `name`. Runtime-defined themes
   * are wired to this property with the `core/theme` utilities; for now the name selects the token
   * set that `tokens.css` provides.
   */
  @property() theme: ThemeInput = DEFAULT_THEME;

  /** Colour mode: `light`, `dark`, or `system` (follows the operating system; the default). */
  @property({reflect: true}) mode: ThemeMode = 'system';

  readonly #provider: ContextProvider<typeof themeContext> = new ContextProvider<
    typeof themeContext
  >(this, {
    context: themeContext,
    initialValue: null,
  });
  readonly #parent: ContextConsumer<typeof themeContext> = new ContextConsumer<typeof themeContext>(
    this,
    {
      context: themeContext,
      subscribe: true,
      callback: () => {
        this.#syncRoot();
      },
    },
  );
  #preference: MediaQueryList | undefined;

  #resolvedMode(): 'light' | 'dark' {
    if (this.mode === 'light' || this.mode === 'dark') return this.mode;
    return typeof matchMedia === 'function' && matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
  }

  /** Re-publishes the resolved mode when the operating system preference flips (`system` only). */
  readonly #onPreferenceChange = (): void => {
    if (this.mode !== 'light' && this.mode !== 'dark') this.requestUpdate();
  };

  #publish(): void {
    const name = themeName(this.theme);
    const mode = this.#resolvedMode();

    // Attributes that token blocks (`[data-theme]`) and author CSS key off.
    if (this.mode === 'light' || this.mode === 'dark') {
      if (this.getAttribute('data-theme') !== this.mode) this.setAttribute('data-theme', this.mode);
    } else if (this.hasAttribute('data-theme')) {
      this.removeAttribute('data-theme');
    }
    if (this.getAttribute('data-tct-theme') !== name) this.setAttribute('data-tct-theme', name);

    const current = this.#provider.value;
    if (current?.name !== name || current.mode !== mode) {
      const value: ThemeContextValue = {name, mode};
      this.#provider.setValue(value);
    }
    rootStates.set(this, {mode: THEME_MODES.includes(this.mode) ? this.mode : 'system', name});
  }

  /** The outermost theme (no theme around it) owns `<html data-theme>`. */
  #syncRoot(): void {
    if (this.isConnected && !this.#parent.value) roots.add(this);
    else roots.delete(this);
    applyRoot();
  }

  override connectedCallback(): void {
    // Before the announcement, so the first consumers that ask already get the right value.
    this.#publish();
    super.connectedCallback();
    // After the first request went out: a theme inside another one is an island, not a root.
    this.#syncRoot();
    if (typeof matchMedia === 'function') {
      this.#preference = matchMedia(DARK_QUERY);
      this.#preference.addEventListener('change', this.#onPreferenceChange);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#preference?.removeEventListener('change', this.#onPreferenceChange);
    this.#preference = undefined;
    roots.delete(this);
    applyRoot();
  }

  protected override willUpdate(): void {
    warnInvalidValue('tct-theme', 'mode', this.mode, THEME_MODES);
    this.#publish();
    this.#syncRoot();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-theme': TctTheme;
  }
}
