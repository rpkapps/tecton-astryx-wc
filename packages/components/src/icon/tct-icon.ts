import {
  html,
  nothing,
  svg,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {defaultIcons} from '@tecton-wc/icons/default.js';
import {
  getIcon,
  hasDefaultIcons,
  onIconsChange,
  registerIcons,
  type IconDefinition,
  type IconLoader,
} from '@tecton-wc/core/icons/registry.js';
import {
  isSanitizerReady,
  preloadSanitizer,
  sanitizeHtmlSync,
} from '@tecton-wc/core/security/sanitize.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {ICON_COLORS, ICON_SIZES, type IconColor, type IconSize} from './icon.types.js';
import styles from './tct-icon.styles.css';

// Lazy icon loaders resolve once per loader for the whole document.
const loaded = new WeakMap<IconLoader, IconDefinition>();
const loading = new WeakMap<IconLoader, Promise<void>>();
// The sanitised body of a definition's raw `svg` markup, produced once and cloned per instance (A§12).
const sanitised = new WeakMap<IconDefinition, DocumentFragment>();

/**
 * Registers the built-in set into the lowest-priority layer the first time an icon connects (and
 * again after `resetIcons()`); consumer registrations always win (A§12).
 */
function ensureDefaultIcons(): void {
  if (!hasDefaultIcons()) registerIcons(defaultIcons, {priority: 'default'});
}

/**
 * A single glyph, resolved by `name` from the icon registry or slotted as your own `<svg>`.
 *
 * Decorative by default (hidden from assistive technology). Give a standalone, meaningful icon a
 * `label` and it becomes `role="img"` with that name. Do not label an icon inside a control that
 * already has a name (button, link): that announces twice.
 *
 * Sizing follows the icon's own `size`; without one it takes the size the owning component supplies
 * for its icon slot (a button sets it from its size), then `md`. `name` values are the semantic role
 * names (`close`, `chevronDown`, `search`, ...) and the Tecton domain glyphs (`well`, `fault`,
 * `seismic`, `strata`, and `<name>-filled`). Register more with `registerIcons()` from
 * `@tecton-wc/core/icons/registry.js`.
 *
 * @summary A single glyph from the icon registry, or your own slotted SVG.
 * @tag tct-icon
 * @upstream Icon
 * @slot - A custom `<svg>`, or the fallback shown when `name` is not registered.
 * @csspart icon - The rendered `<svg>`.
 * @cssprop --icon-stroke-width - Stroke width of stroke icons (the default set). Default: the definition's own (2).
 * @cloakDisplay inline-flex
 */
export class TctIcon extends TctElement {
  static override readonly tagName = 'tct-icon';
  static override styles: CSSResultGroup = [base, styles];

  /**
   * Registered icon name: a semantic role such as `close` or a Tecton glyph such as
   * `well-filled`. Namespaced keys (`richtext:bold`) work the same way. An unregistered name renders
   * the default slot instead (nothing when the slot is empty).
   */
  @property() name = '';

  /** Colour variant; `inherit` follows the surrounding text colour. */
  @property({reflect: true}) color: IconColor = 'inherit';

  /**
   * Size: `xsm` 12px, `sm` 16px, `md` 20px, `lg` 24px. Unset takes the size supplied by the owning
   * component's icon slot, then `md`.
   */
  @property({reflect: true}) size: IconSize | undefined;

  /**
   * Accessible name for a meaningful, standalone icon. Sets `role="img"` and drops the decorative
   * hiding. Empty (default) means decorative. Ignored when the host carries its own `aria-*`.
   */
  @property() label = '';

  #unsubscribe: (() => void) | undefined;
  #cloneOf: IconDefinition | undefined;
  #clone: DocumentFragment | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    ensureDefaultIcons();
    this.#unsubscribe ??= onIconsChange(() => {
      this.requestUpdate();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('color') && !ICON_COLORS.includes(this.color)) {
      devWarn(
        `icon:color:${this.color}`,
        `<tct-icon color="${this.color}"> is not one of ${ICON_COLORS.join(', ')}.`,
      );
    }
    if (changed.has('size') && this.size !== undefined && !ICON_SIZES.includes(this.size)) {
      devWarn(
        `icon:size:${this.size}`,
        `<tct-icon size="${this.size}"> is not one of ${ICON_SIZES.join(', ')}.`,
      );
    }
    // Default semantics live on ElementInternals so consumer attributes still override them
    // (upstream lets an explicit aria-hidden / role / aria-label win) [mwg:accessible-web-components].
    const labelled = this.label !== '';
    this.internals.role = labelled ? 'img' : null;
    this.internals.ariaLabel = labelled ? this.label : null;
    this.internals.ariaHidden = labelled ? null : 'true';
  }

  /** The registered definition for `name`, starting a lazy load when the entry is a loader. */
  #resolve(): IconDefinition | undefined {
    if (!this.name) return undefined;
    const entry = getIcon(this.name);
    if (entry === undefined || typeof entry !== 'function') return entry;
    const known = loaded.get(entry);
    if (known) return known;
    if (!loading.has(entry)) {
      loading.set(
        entry,
        entry().then(
          (definition) => {
            loaded.set(entry, definition);
          },
          (error: unknown) => {
            devWarn(`icon:load:${this.name}`, `Icon "${this.name}" failed to load.`, error);
          },
        ),
      );
    }
    void loading.get(entry)?.then(() => {
      this.requestUpdate();
    });
    return undefined;
  }

  /** A per-instance clone of the definition's sanitised raw SVG body, or `undefined` until it is ready. */
  #rawBody(definition: IconDefinition): DocumentFragment | undefined {
    if (definition.svg === undefined) return undefined;
    if (this.#cloneOf === definition && this.#clone) return this.#clone;
    let source = sanitised.get(definition);
    if (!source) {
      if (!isSanitizerReady()) {
        // The fallback sanitiser loads lazily; the single-colour `paths` outline shows meanwhile.
        void preloadSanitizer().then(() => {
          this.requestUpdate();
        });
        return undefined;
      }
      source = sanitizeHtmlSync(definition.svg, {svg: true}) ?? undefined;
      if (!source) return undefined;
      sanitised.set(definition, source);
    }
    this.#cloneOf = definition;
    this.#clone = source.cloneNode(true) as DocumentFragment;
    return this.#clone;
  }

  override render(): TemplateResult {
    const definition = this.#resolve();
    if (!definition) return html`<slot></slot>`;
    const body = this.#rawBody(definition);
    const stroke = definition.mode === 'stroke';
    return html`<svg
      part="icon"
      class="svg"
      viewBox=${definition.viewBox}
      aria-hidden="true"
      focusable="false"
      data-mode=${definition.mode}
      data-mirror=${definition.mirrorInRtl ? '' : nothing}
      style=${styleMap(stroke ? {'--_stroke-width': String(definition.strokeWidth ?? 2)} : {})}
    >
      ${
        body ??
        definition.paths.map(
          (path) =>
            svg`<path d=${path.d} fill-rule=${path.fillRule ?? nothing} clip-rule=${path.fillRule ?? nothing}></path>`,
        )
      }
    </svg>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-icon': TctIcon;
  }
}
