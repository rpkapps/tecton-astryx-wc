import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {ContextConsumer, ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {linkContext} from '@tecton-astryx/core/context/keys.js';
import {AriaDelegateController} from '@tecton-astryx/core/controllers/aria-delegate.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TooltipController} from '@tecton-astryx/core/controllers/tooltip.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {safeUrl} from '@tecton-astryx/core/utils/safe-url.js';
import defaults from '@tecton-astryx/locales/en/avatar.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import layer from '../styles/layer.styles.css';
import {avatarContext, avatarGroupContext} from './avatar.context.js';
import {getInitials} from './avatar.initials.js';
import {
  AVATAR_SHAPES,
  resolveSize,
  sizeConverter,
  type AvatarShape,
  type AvatarSize,
} from './avatar.types.js';
import styles from './tct-avatar.styles.css';

/** A string with content, or `undefined` for absent and blank: an empty accessible name is meaningless. */
function meaningful(value: string | null | undefined): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * `tooltip="false"` is `false`, `tooltip` / `tooltip="true"` is `true`, any other string is the text.
 * Absent means `true` (upstream default): the tooltip shows the avatar's name.
 */
const tooltipConverter = {
  fromAttribute(value: string | null): string | boolean {
    if (value === null || value === '' || value === 'true') return true;
    if (value === 'false') return false;
    return value;
  },
};

/**
 * Represents a person or a team: a photo, falling back to initials from the name, then to a default person
 * icon. A `tct-avatar-status-dot` in the `status` slot shows availability in the corner and names itself
 * into the avatar's accessible name ("Jane Doe, Online").
 *
 * The avatar is a `role="img"` named from `alt` or `name` (composed with the status label); without a
 * name it is decorative. With `href` it becomes a link, with `interactive` a `<button>`: an interactive
 * avatar needs a name from `alt` or `name`. A photo that fails to load falls back to `fallback-src`, then to
 * the initials. In an avatar group the group's size and shape win.
 *
 * Guides: [mwg:accessible-web-components] (name and role inside the shadow root, `delegatesFocus`)
 * [mwg:styling-web-components] (parts, private custom properties) [mwg:shadow-dom] (slots)
 * [mwg:security] (image and link URL policy).
 *
 * @summary A person or team as a photo, initials or a default icon, with an optional status dot.
 * @tag tct-avatar
 * @upstream Avatar
 * @slot status - Corner content, typically a `tct-avatar-status-dot`.
 * @csspart base - The avatar: a `<div>`, or the `<a>` / `<button>` when interactive.
 * @csspart content - The clipping container of the photo or fallback.
 * @csspart fallback - The initials or default icon surface.
 * @csspart status - The positioned wrapper of the status slot.
 * @csspart tooltip - The tooltip surface, when there is one.
 * @fires click - Native click, retargeted from the inner link or button (only when `href` or `interactive`).
 * @cloakDisplay inline-flex
 */
export class TctAvatar extends TctElement {
  static override readonly tagName = 'tct-avatar';
  static override shadowRootOptions: ShadowRootInit = {
    ...TctElement.shadowRootOptions,
    delegatesFocus: true,
  };
  static override styles: CSSResultGroup = [base, focusRing, layer, styles];

  /** `aria-label` overrides the derived name and is read in `render()`. */
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'aria-label'];
  }

  /** Primary image URL. */
  @property() src: string | undefined;

  /** Image shown when `src` fails to load; if this fails too, the initials show. */
  @property({attribute: 'fallback-src'}) fallbackSrc: string | undefined;

  /** The person's or team's name: the source of the initials and, without `alt`, of the accessible name. */
  @property() name: string | undefined;

  /** Accessible name; falls back to `name`. */
  @property() alt: string | undefined;

  /**
   * Size: `xsm` (20px), `sm` (24), `md` (36, default), `lg` (48), `xl` (128) or a number of pixels.
   * Inside an avatar group the group's size wins.
   */
  @property({converter: sizeConverter}) size: AvatarSize = 'md';

  /** `circle` (default), `rounded` (the element radius) or `square`. Inside a group the group's shape wins. */
  @property() shape: AvatarShape = 'circle';

  /**
   * Hover and keyboard-focus tooltip. Absent or `true` shows the name; a string shows that text;
   * `false` shows none. No tooltip appears when it would show the name and there is none. The avatar
   * owns this tooltip: set `tooltip="false"` when you wrap it in your own overlay.
   */
  @property({converter: tooltipConverter}) tooltip: string | boolean = true;

  /** Makes the avatar a link. It follows the link policy of `tct-link` (unsafe destinations render no link). */
  @property() href: string | undefined;

  /** Link `target`; only with `href`. */
  @property() target: string | undefined;

  /** Link `rel`; only with `href`. */
  @property() rel: string | undefined;

  /**
   * Makes the avatar a `<button type="button">` (without `href`); listen for `click`. Upstream renders a
   * button when given an `onClick`, which an element cannot observe, so the intent is an attribute.
   */
  @property({type: Boolean, reflect: true}) interactive = false;

  @state() private erroredSrc: string | undefined;
  @state() private erroredFallbackSrc: string | undefined;

  readonly #slots = new SlotController(this, 'status');
  readonly #locale = new LocaleController(this, {namespace: 'avatar', defaults});
  readonly #group = new ContextConsumer(this, {context: avatarGroupContext, subscribe: true});
  readonly #link = new ContextConsumer(this, {context: linkContext, subscribe: true});
  readonly #statusLabels = new Map<Element, string>();
  readonly #provider = new ContextProvider(this, {context: avatarContext, initialValue: null});
  #hadControl = false;
  readonly #aria = new AriaDelegateController(this, {
    target: () => this.control,
    // The name is composed here (a host aria-label is read in render()); with a tooltip the description
    // is the tooltip's, like `tct-button`.
    exclude: () => ['aria-label', ...(this.#tooltipText ? ['aria-describedby'] : [])],
  });

  constructor() {
    super();
    // The surface sits in this shadow root next to the avatar root (the trigger), so `aria-describedby`
    // stays inside one tree. [mwg:interest-triggered-tooltips]
    new TooltipController(this, {
      mode: 'shadow',
      trigger: () => this.renderRoot.querySelector<HTMLElement>('.root'),
      surface: () => this.renderRoot.querySelector<HTMLElement>('.tooltip-surface'),
      content: () => this.#tooltipText,
      focusTrigger: 'auto',
      touchTrigger: 'auto',
    });
  }

  /**
   * The tooltip text: nothing for `false`, the string itself for a string, else the `name` (not `alt`,
   * upstream). A blank result means no tooltip.
   */
  get #tooltipText(): string {
    if (this.tooltip === false) return '';
    const text = typeof this.tooltip === 'string' ? this.tooltip : (meaningful(this.name) ?? '');
    return text.trim();
  }

  /** The inner link or button when the avatar is interactive, else `null` (the group's roving stop). */
  get control(): HTMLElement | null {
    return this.#interactive
      ? this.renderRoot.querySelector<HTMLElement>('a[part~="base"], button[part~="base"]')
      : null;
  }

  get #interactive(): boolean {
    return this.href !== undefined || this.interactive;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#aria.sync();
    // Re-evaluate the group-owned tab stop after a move.
    this.requestUpdate();
  }

  /** @internal Re-renders when the host `aria-label` (an override of the derived name) changes. */
  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'aria-label') this.requestUpdate();
  }

  protected override updated(): void {
    this.#hideDefaultDescription();
    const control = this.control;
    if (this.#hadControl !== (control !== null)) {
      this.#hadControl = control !== null;
      this.#group.value?.refresh();
    }
    // A tab stop written by a group's roving controller must not outlive the group.
    if (control && !this.#group.value && control.hasAttribute('tabindex')) {
      control.removeAttribute('tabindex');
    }
  }

  /**
   * The default name tooltip is visual only: its text repeats the accessible name, so describing the root
   * with it would announce the name twice (upstream). A custom string does add information and stays
   * described. The tooltip controller wires the description; this takes it off again.
   */
  #hideDefaultDescription(): void {
    if (typeof this.tooltip === 'string') return;
    const root = this.renderRoot.querySelector<HTMLElement>('.root');
    const id = this.renderRoot.querySelector<HTMLElement>('.tooltip-surface')?.id;
    if (!root || !id) return;
    const tokens = (root.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((token) => token !== '' && token !== id);
    if (tokens.length > 0) root.setAttribute('aria-describedby', tokens.join(' '));
    else root.removeAttribute('aria-describedby');
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('shape') && !(AVATAR_SHAPES as readonly string[]).includes(this.shape)) {
      devWarn(
        `avatar:shape:${this.shape}`,
        `<tct-avatar shape="${this.shape}"> is not one of ${AVATAR_SHAPES.join(', ')}; using "circle".`,
      );
    }
    if (changed.has('src')) this.erroredSrc = undefined;
    if (changed.has('fallbackSrc')) this.erroredFallbackSrc = undefined;
    const size = resolveSize(this.#group.value?.size ?? this.size);
    const current = this.#provider.value;
    if (current?.size !== size) {
      this.#provider.setValue({
        size,
        reportStatusLabel: (source, label) => {
          if (label === undefined || label === '') this.#statusLabels.delete(source);
          else this.#statusLabels.set(source, label);
          this.requestUpdate();
        },
      });
    }
  }

  /** The label a status element reported: the first non-empty one. */
  get #statusLabel(): string | undefined {
    for (const label of this.#statusLabels.values()) return meaningful(label);
    return undefined;
  }

  override render(): TemplateResult {
    const group = this.#group.value;
    const size = group?.size ?? this.size;
    const shape = group?.shape ?? this.shape;
    const px = group?.numericSize ?? resolveSize(size);

    const src = this.src ? (safeUrl(this.src) ?? undefined) : undefined;
    const fallbackSrc = this.fallbackSrc ? (safeUrl(this.fallbackSrc) ?? undefined) : undefined;
    const showImage = src !== undefined && this.erroredSrc !== src;
    const showFallbackImage =
      !showImage && fallbackSrc !== undefined && this.erroredFallbackSrc !== fallbackSrc;
    // A blank name carries no identity: no initials, no name.
    const name = meaningful(this.name);
    const initials = name ? getInitials(name) : '';
    const showInitials = !showImage && !showFallbackImage && initials !== '';
    const showIcon = !showImage && !showFallbackImage && initials === '';

    const nameLabel = meaningful(this.alt) ?? name;
    const statusLabel = this.#statusLabel;
    const composed =
      nameLabel && statusLabel
        ? this.#locale.t('nameWithStatus', {name: nameLabel, status: statusLabel})
        : (nameLabel ?? statusLabel);
    // A host aria-label wins over the derived name.
    const accessibleName = meaningful(this.getAttribute('aria-label')) ?? composed;

    const interactive = this.#interactive;
    if (interactive && !accessibleName && !this.hasAttribute('aria-labelledby')) {
      devWarn(
        'avatar:interactive-name',
        'an interactive <tct-avatar> (with href or interactive) needs a meaningful accessible name; pass alt or name.',
      );
    }

    const tooltipText = this.#tooltipText;
    const tooltip = tooltipText
      ? html`<div class="layer-surface tooltip-surface" part="tooltip" popover="manual">
          ${tooltipText}
        </div>`
      : nothing;
    const inline = {
      '--_size': `${px}px`,
      '--_overlap': `${-(group?.overlap ?? 0)}px`,
    };
    const content = html`<div class="content" part="content">
        ${
          showImage
            ? html`<img class="image" src=${src} alt="" @error=${this.#onImageError} />`
            : nothing
        }
        ${
          showFallbackImage
            ? html`<img
                class="image"
                src=${fallbackSrc}
                alt=""
                @error=${this.#onFallbackImageError}
              />`
            : nothing
        }
        ${
          showInitials
            ? html`<div class="fallback" part="fallback" data-size=${String(size)}>
                ${initials}
              </div>`
            : nothing
        }
        ${
          showIcon
            ? html`<div class="fallback" part="fallback" data-size=${String(size)}>
                <svg class="person" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path
                    d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
                  ></path>
                </svg>
              </div>`
            : nothing
        }
      </div>
      ${
        this.#slots.has('status')
          ? html`<div class="status" part="status"><slot name="status"></slot></div>`
          : nothing
      }`;

    if (this.href !== undefined) {
      const href = safeUrl(this.href, {allowData: true}) ?? undefined;
      return html`<a
          class="root focus-ring"
          part="base"
          data-shape=${shape}
          data-size=${String(size)}
          ?data-in-group=${group !== null && group !== undefined}
          href=${href ?? nothing}
          target=${this.target ?? nothing}
          rel=${this.rel ?? nothing}
          aria-label=${accessibleName ?? nothing}
          style=${styleMap(inline)}
          @click=${this.#onLinkClick}
          >${content}</a
        >${tooltip}`;
    }
    if (this.interactive) {
      return html`<button
          type="button"
          class="root focus-ring"
          part="base"
          data-shape=${shape}
          data-size=${String(size)}
          ?data-in-group=${group !== null && group !== undefined}
          aria-label=${accessibleName ?? nothing}
          style=${styleMap(inline)}
        >
          ${content}</button
        >${tooltip}`;
    }
    // A static avatar is not natively focusable: with a tooltip it gets a tab stop so keyboard users can
    // reveal it (WCAG 1.4.13, 2.1.1). A group owns one roving tab stop for its members instead.
    return html`<div
        class="root focus-ring"
        part="base"
        data-shape=${shape}
        data-size=${String(size)}
        ?data-in-group=${group !== null && group !== undefined}
        tabindex=${tooltipText && !group ? '0' : nothing}
        role=${accessibleName ? 'img' : 'presentation'}
        aria-hidden=${accessibleName ? nothing : 'true'}
        aria-label=${accessibleName ?? nothing}
        style=${styleMap(inline)}
      >
        ${content}
      </div>
      ${tooltip}`;
  }

  /** Remembers which exact URL failed, so a changed `src` gets a fresh attempt. */
  #onImageError = (event: Event): void => {
    this.erroredSrc = (event.currentTarget as HTMLImageElement).getAttribute('src') ?? undefined;
  };

  #onFallbackImageError = (event: Event): void => {
    this.erroredFallbackSrc =
      (event.currentTarget as HTMLImageElement).getAttribute('src') ?? undefined;
  };

  /** Router navigation through `tct-link-provider`, like a link. Modified and middle clicks stay native. */
  #onLinkClick = (event: MouseEvent): void => {
    const link = this.#link.value;
    if (!link?.navigate || event.defaultPrevented || !this.href) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    if (this.target !== undefined && this.target !== '' && this.target !== '_self') return;
    // Only internal destinations are the router's: a cross-origin one stays a native navigation.
    const href = safeUrl(this.href, {allowData: true});
    if (href === null) return;
    try {
      if (new URL(href, location.href).origin !== location.origin) return;
    } catch {
      return;
    }
    if (link.navigate(href, event)) event.preventDefault();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-avatar': TctAvatar;
  }
}
