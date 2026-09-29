import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {linkContext} from '@tecton-wc/core/context/keys.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TooltipController} from '@tecton-wc/core/controllers/tooltip.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {LayerController} from '@tecton-wc/core/layer/layer-controller.js';
import {PositionController} from '@tecton-wc/core/layer/position.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {getTabbables} from '@tecton-wc/core/utils/focus.js';
import {IdController} from '@tecton-wc/core/utils/id.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import layer from '../styles/layer.styles.css';
import motion from '../styles/motion.styles.css';
import {NavHoverController} from './nav-hover.js';
import {routeNavClick, safeHref} from './nav-link.js';
import navHeading from './nav-heading.styles.css';
import navItem from './nav-item.styles.css';

/** Guard after a hover-open within which a click on the heading confirms it (upstream #3121). */
const CLICK_GUARD_MS = 500;

/**
 * The heading of a navigation: an icon or logo, a product or account name with an optional line above
 * and below, trailing content, and an optional menu (a switcher). Shared by `tct-side-nav-heading` and
 * `tct-top-nav-heading`.
 *
 * The interaction boundary follows what is set (upstream contract): a heading with only `heading-href` is
 * one link; with several hrefs each is its own link; with a menu and no hrefs the whole heading opens the
 * menu (a chevron button carries the keyboard and the name); with a menu and hrefs the links stay links
 * and the chevron button opens the menu. The menu is a disclosure, not an ARIA menu: the trigger has
 * `aria-expanded`, the panel is the slotted content, and whatever you slot brings its own semantics.
 *
 * @internal
 */
export abstract class TctNavHeadingBase extends TctElement {
  static override styles: CSSResultGroup = [base, focusRing, layer, motion, navItem, navHeading];

  /** The product or account name. */
  @property() heading = '';

  /** Link of the heading (the product home). */
  @property({attribute: 'heading-href'}) headingHref: string | undefined;

  /** Text above the heading (the suite name). */
  @property() superheading = '';

  /** Link of the superheading (the suite home). */
  @property({attribute: 'superheading-href'}) superheadingHref: string | undefined;

  /** Text below the heading (the account context). */
  @property() subheading = '';

  /** Link of the subheading. */
  @property({attribute: 'subheading-href'}) subheadingHref: string | undefined;

  @state() protected _menuOpen = false;

  protected readonly iconSlot: string;
  protected readonly slots: SlotController;
  protected readonly router: ContextConsumer<typeof linkContext> = new ContextConsumer<
    typeof linkContext
  >(this, {context: linkContext});
  protected readonly ids: IdController = new IdController(this, 'tct-nav-heading');
  readonly #locale: LocaleController;
  #menuReason: 'hover' | 'trigger' = 'trigger';

  protected constructor(
    iconSlot: string,
    namespace: string,
    defaults: Readonly<Record<string, string>>,
  ) {
    super();
    this.iconSlot = iconSlot;
    this.#locale = new LocaleController(this, {namespace, defaults});
    this.slots = new SlotController(this, iconSlot, 'menu', 'end');
    new TooltipController(this, {
      mode: 'shadow',
      trigger: () => this.renderRoot.querySelector<HTMLElement>('.rail-row'),
      surface: () => this.renderRoot.querySelector<HTMLElement>('.tooltip-surface'),
      content: () => (this.isRail ? this.heading : ''),
      placement: () => ({placement: 'end', alignment: 'center', offset: 'var(--spacing-1)'}),
      focusTrigger: 'auto',
      touchTrigger: 'auto',
      enabled: () => this.isRail && this.heading !== '',
    });
  }

  /** Whether the heading renders as the collapsed icon rail (a side navigation only). */
  protected get isRail(): boolean {
    return false;
  }

  /** The accessible name of a link that is only the icon (the logo). */
  protected get iconLabel(): string {
    return this.heading;
  }

  /** Message of the concrete heading's namespace. */
  protected t(id: string): string {
    return this.#locale.t(id);
  }

  readonly #position: PositionController = new PositionController(this, {
    surface: () => this.#menuLayer,
    anchor: () => this.#anchor,
    placement: () => ({placement: 'below', alignment: 'start', offset: 'var(--spacing-1)'}),
    matchAnchorWidth: 'min',
    trackPlacement: true,
  });

  readonly #layer: LayerController = new LayerController(this, {
    kind: 'popover',
    surface: () => this.#menuLayer,
    trigger: () => this.#trigger,
    escape: 'close',
    outsidePress: true,
    focusOut: true,
    initialFocus: () =>
      this.#menuReason === 'hover' ? null : (getTabbables(this.#menuBox)[0] ?? this.#menuBox),
    position: this.#position,
    onDismissRequest: () => {
      this._menuOpen = false;
    },
    onNativeClose: () => {
      this._menuOpen = false;
    },
  });

  readonly #hover: NavHoverController = new NavHoverController(this, {
    trigger: () => this.#anchor,
    surface: () => this.#menuLayer,
    isOpen: () => this._menuOpen,
    enabled: () => this.slots.has('menu') && !this.isRail,
    showDelay: () => 80,
    onOpen: () => {
      this.#menuReason = 'hover';
      this._menuOpen = true;
      this.#hover.markHoverOpened();
    },
    onClose: () => {
      this._menuOpen = false;
    },
  });

  get #menuLayer(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.menu-layer') ?? null;
  }

  get #menuBox(): HTMLElement {
    return this.renderRoot?.querySelector<HTMLElement>('.menu') ?? this;
  }

  /** The control that opens the menu: the chevron button, or the whole rail icon when collapsed. */
  get #trigger(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.chevron-btn, .rail-trigger') ?? null;
  }

  /** The element the panel is anchored to: the whole heading. */
  get #anchor(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.root, .rail-row') ?? null;
  }

  protected override willUpdate(): void {
    if (this._menuOpen && !this.slots.has('menu')) this._menuOpen = false;
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('_menuOpen')) {
      if (this._menuOpen) void this.#layer.show();
      else void this.#layer.hide();
    }
  }

  // ---------------------------------------------------------------------------------- input

  #toggleMenu(reason: 'hover' | 'trigger'): void {
    if (this._menuOpen) {
      if (this.#hover.confirmsHover(CLICK_GUARD_MS)) this.#hover.pin();
      else this._menuOpen = false;
      return;
    }
    this.#menuReason = reason;
    this.#hover.pin();
    this._menuOpen = true;
  }

  readonly #onChevronClick = (event: MouseEvent): void => {
    // The chevron is the trigger; the surrounding region must not toggle it a second time.
    event.stopPropagation();
    this.#toggleMenu('trigger');
  };

  readonly #onRegionClick = (event: MouseEvent): void => {
    // A press on the heading text (not on a link inside it) opens the menu, like the chevron.
    const target = event.composedPath()[0];
    if (target instanceof Element && target.closest('a, button')) return;
    this.#toggleMenu('trigger');
  };

  readonly #onLinkClick = (event: MouseEvent): void => {
    const anchor = event.currentTarget as HTMLAnchorElement;
    routeNavClick(event, this.router.value, {href: anchor.getAttribute('href') ?? undefined});
  };

  /** A link, button or menu item chosen inside the menu closes it. */
  readonly #onMenuClick = (event: MouseEvent): void => {
    const chosen = event
      .composedPath()
      .some(
        (target) =>
          target instanceof Element &&
          (target.localName === 'a' ||
            target.localName === 'button' ||
            target.getAttribute('role')?.startsWith('menuitem') === true),
      );
    if (chosen) this._menuOpen = false;
  };

  // ---------------------------------------------------------------------------------- render

  #icon(): TemplateResult | typeof nothing {
    if (!this.slots.has(this.iconSlot)) return nothing;
    return html`<span class="icon" part="icon"><slot name=${this.iconSlot}></slot></span>`;
  }

  #hasNavIcon(): boolean {
    const assigned = [...this.children].find(
      (child) => child.getAttribute('slot') === this.iconSlot,
    );
    return assigned?.localName === 'tct-nav-icon';
  }

  /** A text line that is its own link when it has a destination (only used where links are independent). */
  #line(
    className: string,
    part: string,
    text: string,
    href: string | undefined,
    independent: boolean,
  ): TemplateResult {
    return independent && href
      ? html`<a
          class="${className} text-link focus-ring"
          part=${part}
          href=${ifDefined(safeHref(href) ?? undefined)}
          @click=${this.#onLinkClick}
          >${text}</a
        >`
      : html`<span class=${className} part=${part}>${text}</span>`;
  }

  #text(independent: boolean, inlineChevron?: TemplateResult): TemplateResult {
    return html`<span class="text">
      ${
        this.superheading
          ? this.#line(
              'superheading',
              'superheading',
              this.superheading,
              this.superheadingHref,
              independent,
            )
          : nothing
      }
      <span class="heading-row"
        >${this.#line('heading', 'heading', this.heading, this.headingHref, independent)}${inlineChevron ?? nothing}</span
      >
      ${
        this.subheading
          ? this.#line(
              'subheading',
              'subheading',
              this.subheading,
              this.subheadingHref,
              independent,
            )
          : nothing
      }
    </span>`;
  }

  #end(): TemplateResult | typeof nothing {
    return this.slots.has('end')
      ? html`<span class="end" part="end-content"><slot name="end"></slot></span>`
      : nothing;
  }

  #chevronButton(): TemplateResult {
    return html`<button
      type="button"
      class="chevron-btn focus-ring"
      part="menu-trigger"
      aria-label=${this.t('heading.openMenu')}
      aria-expanded=${String(this._menuOpen)}
      aria-controls=${ifDefined(this._menuOpen ? this.ids.id('menu') : undefined)}
      @click=${this.#onChevronClick}
    >
      <tct-icon name="chevronDown" size="sm" color="inherit"></tct-icon>
    </button>`;
  }

  #menuPanel(): TemplateResult {
    return html`<div class="menu-layer layer-surface" popover="manual" data-placement="below">
      <div
        class="menu"
        part="menu"
        id=${this.ids.id('menu')}
        tabindex="-1"
        @click=${this.#onMenuClick}
      >
        <slot name="menu"></slot>
      </div>
    </div>`;
  }

  #renderRail(): TemplateResult | typeof nothing {
    if (!this.slots.has(this.iconSlot)) return nothing;
    const icon = html`<span class="icon" part="icon"><slot name=${this.iconSlot}></slot></span>`;
    const tooltip = html`<div class="layer-surface tooltip-surface" part="tooltip" popover="manual">
      ${this.heading}
    </div>`;
    if (this.headingHref) {
      return html`<a
          class="nav-row rail rail-row focus-ring"
          part="item"
          data-size="md"
          href=${ifDefined(safeHref(this.headingHref) ?? undefined)}
          aria-label=${this.heading}
          @click=${this.#onLinkClick}
          >${icon}</a
        >${tooltip}`;
    }
    if (this.slots.has('menu')) {
      return html`<button
          type="button"
          class="nav-row rail rail-row rail-trigger focus-ring"
          part="item"
          data-size="md"
          aria-label=${this.heading}
          aria-expanded=${String(this._menuOpen)}
          aria-controls=${ifDefined(this._menuOpen ? this.ids.id('menu') : undefined)}
          @click=${this.#onChevronClick}
        >
          ${icon}</button
        >${tooltip}${this.#menuPanel()}`;
    }
    return html`<div class="nav-row rail rail-row" part="item" data-size="md">${icon}</div>
      ${tooltip}`;
  }

  protected override render(): TemplateResult | typeof nothing {
    if (this.isRail) return this.#renderRail();
    const hasMenu = this.slots.has('menu');
    const anyHref = Boolean(this.headingHref || this.superheadingHref || this.subheadingHref);
    const wholeTrigger = hasMenu && !anyHref;
    const wholeLink =
      Boolean(this.headingHref) && !hasMenu && !this.superheadingHref && !this.subheadingHref;
    const navIcon = this.#hasNavIcon();
    const noText = !this.heading && !this.superheading && !this.subheading;

    // A logo alone: a link to the destination (named by the logo label), or a plain box.
    if (noText && !hasMenu) {
      return this.headingHref
        ? html`<a
            class="root link-root focus-ring"
            part="base"
            href=${ifDefined(safeHref(this.headingHref) ?? undefined)}
            aria-label=${ifDefined(this.iconLabel || undefined)}
            ?data-nav-icon=${navIcon}
            @click=${this.#onLinkClick}
            >${this.#icon()}</a
          >`
        : html`<div class="root" part="base" ?data-nav-icon=${navIcon}>${this.#icon()}</div>`;
    }

    if (wholeLink) {
      return html`<a
        class="root link-root focus-ring"
        part="base"
        href=${ifDefined(safeHref(this.headingHref) ?? undefined)}
        ?data-nav-icon=${navIcon}
        @click=${this.#onLinkClick}
        >${this.#icon()}${this.#text(false)}${this.#end()}</a
      >`;
    }

    if (wholeTrigger) {
      return html`<div
          class="root trigger-root"
          part="base"
          ?data-nav-icon=${navIcon}
          ?data-open=${this._menuOpen}
          @click=${this.#onRegionClick}
        >
          ${this.#icon()}${this.#text(false, this.#chevronButton())}${this.#end()}
        </div>
        ${this.#menuPanel()}`;
    }

    // Links are independent: the icon links to the heading destination, each line to its own.
    const iconContent = this.#icon();
    const icon =
      this.headingHref && iconContent !== nothing
        ? html`<a
            class="icon-link focus-ring"
            href=${ifDefined(safeHref(this.headingHref) ?? undefined)}
            aria-label=${ifDefined(this.iconLabel || undefined)}
            @click=${this.#onLinkClick}
            >${iconContent}</a
          >`
        : iconContent;
    return html`<div
        class="root"
        part="base"
        ?data-nav-icon=${navIcon}
        ?data-open=${this._menuOpen}
      >
        ${icon}${this.#text(true, hasMenu ? this.#chevronButton() : undefined)}${this.#end()}
      </div>
      ${hasMenu ? this.#menuPanel() : nothing}`;
  }
}
