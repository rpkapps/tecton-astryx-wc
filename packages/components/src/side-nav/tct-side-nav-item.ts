import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {ContextConsumer, ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {linkContext} from '@tecton-wc/core/context/keys.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TooltipController} from '@tecton-wc/core/controllers/tooltip.js';
import {TctCollapseChangeEvent} from '@tecton-wc/core/events/tct-collapse-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {LayerController} from '@tecton-wc/core/layer/layer-controller.js';
import {PositionController} from '@tecton-wc/core/layer/position.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {getTabbables} from '@tecton-wc/core/utils/focus.js';
import {IdController} from '@tecton-wc/core/utils/id.js';
import english from '@tecton-wc/locales/en/sideNavItem.js';
import {AppShellMobileController} from '../app-shell/app-shell-mobile.context.js';
import {TctIcon} from '../icon/tct-icon.js';
import {pick} from '../layout/layout.types.js';
import {TctSizeProvider} from '../size-provider/tct-size-provider.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import layer from '../styles/layer.styles.css';
import motion from '../styles/motion.styles.css';
import {NavHoverController} from './nav-hover.js';
import {renderOnConnect} from './nav-render.js';
import {routeNavClick, safeHref} from './nav-link.js';
import navItem from './nav-item.styles.css';
import {
  INERT_SIDE_NAV_COLLAPSE,
  SideNavCollapseController,
  SideNavRenderModeController,
  sideNavCollapseContext,
} from './side-nav.context.js';
import {SIDE_NAV_ITEM_SIZES, type SideNavItemSize} from './side-nav.types.js';
import styles from './tct-side-nav-item.styles.css';

/**
 * A navigation item of a side navigation: an icon, a label, a selected state, optional passive content
 * at the end (`end` slot), row-level controls (`actions` slot) and sub-items (the default slot, nested
 * `tct-side-nav-item`s). It is a link when it has an `href`, a button otherwise. The current page is
 * `selected` (the inner link carries `aria-current="page"`).
 *
 * An item with sub-items is collapsible: with no `href` and no `has-action` the whole row toggles them;
 * otherwise the row keeps its own action and a separate chevron button toggles the sub-items, so both
 * stay reachable. `collapsed` is the state of the sub-items (the attribute is the initial state); the
 * user's toggle asks with a cancelable `tct-collapse-change` first. `no-collapse` keeps sub-items always
 * shown. Collapsed sub-items are `inert`.
 *
 * In a collapsed side navigation (the icon rail) the item shows only its icon and is named by its label
 * (`aria-label`, or a host `aria-label` of your own). An item without an icon is hidden. An item without
 * sub-items shows its label in a tooltip on hover and keyboard focus; an item with sub-items is a button
 * that opens a flyout beside the rail with the sub-items in full: on hover (fine pointers), or with Enter,
 * Space and a click (focus moves into the flyout, and Escape closes it and returns focus to the button).
 *
 * Inside the mobile drawer of a `tct-app-shell` a click on a link or a button item closes the drawer.
 *
 * @summary A side navigation row with icon, label, selected state, sub-items and row actions.
 * @tag tct-side-nav-item
 * @upstream SideNavItem
 * @slot - Sub-items: nested `tct-side-nav-item`s.
 * @slot icon - A custom icon (an `<svg>` or `tct-icon`), instead of `icon`.
 * @slot selected-icon - A custom icon shown while selected, instead of `selected-icon`.
 * @slot end - Passive trailing content: a badge or a count. Interactive controls go in `actions`.
 * @slot actions - Row-level controls (icon buttons, menus) beside the row, after the toggle and before the sub-items. Hidden in the collapsed rail; they inherit the compact row control size.
 * @csspart base - The box around the row and its sub-items.
 * @csspart item - The primary link or button.
 * @csspart row - The painted row, when the item has a toggle or actions (it wraps them).
 * @csspart icon - The icon box.
 * @csspart label - The label.
 * @csspart end-content - The trailing content.
 * @csspart toggle - The chevron button that expands or collapses the sub-items.
 * @csspart actions - The actions box.
 * @csspart children - The group of sub-items.
 * @csspart flyout - The flyout of a collapsed item with sub-items.
 * @csspart tooltip - The tooltip of a collapsed item.
 * @cssstate open - The flyout is open.
 * @fires tct-collapse-change - The user asked to collapse or expand the sub-items; cancelable, carries `collapsed` and `reason`.
 * @fires click - Native click, retargeted from the link or the button.
 * @cloakDisplay block
 */
export class TctSideNavItem extends TctElement {
  static override readonly tagName = 'tct-side-nav-item';
  static override readonly dependencies = [TctIcon, TctSizeProvider];
  static override styles: CSSResultGroup = [base, focusRing, layer, motion, navItem, styles];

  /** The label of the row. It also names the item in the collapsed rail. */
  @property() label = '';

  /** Registered icon name (outline). Or slot your own into `icon`. An item without an icon is hidden in the collapsed rail. */
  @property() icon = '';

  /** Registered icon name shown while selected (the filled variant). Or slot your own into `selected-icon`. */
  @property({attribute: 'selected-icon'}) selectedIcon = '';

  /** Marks the item as the current page: `aria-current="page"` and the selected fill. */
  @property({type: Boolean, reflect: true}) selected = false;

  /** Disables the item: a disabled button, or a link without a destination. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** Destination. Without it the row is a button. A destination the URL policy refuses renders no `href`. */
  @property() href: string | undefined;

  /** Row size: `sm` (28px), `md` (32px, default) or `lg` (36px). */
  @property({reflect: true}) size: SideNavItemSize = 'md';

  /** Keeps the sub-items always shown: no toggle. By default an item with sub-items is collapsible. */
  @property({type: Boolean, attribute: 'no-collapse'}) noCollapse = false;

  /** The sub-items are collapsed. The attribute is the initial state; the user's toggle asks through `tct-collapse-change`. */
  @property({type: Boolean, reflect: true}) collapsed = false;

  /**
   * The row does something of its own besides expanding the sub-items (a click listener on a row without
   * an `href`): the chevron becomes a separate toggle button, as it does for a link.
   */
  @property({type: Boolean, attribute: 'has-action'}) hasAction = false;

  /** The host `aria-label`, tracked so a change re-renders the inner element. @internal */
  @property({attribute: 'aria-label'}) private _hostLabel: string | null = null;

  @state() private _flyout = false;

  readonly #slots: SlotController = new SlotController(
    this,
    'default',
    'icon',
    'selected-icon',
    'end',
    'actions',
  );
  readonly #collapse: SideNavCollapseController = new SideNavCollapseController(this);
  readonly #mode: SideNavRenderModeController = new SideNavRenderModeController(this);
  readonly #shell: AppShellMobileController = new AppShellMobileController(this);
  readonly #router: ContextConsumer<typeof linkContext> = new ContextConsumer<
    typeof linkContext
  >(this, {context: linkContext});
  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'sideNavItem',
    defaults: english,
  });
  readonly #ids: IdController = new IdController(this, 'tct-side-nav-item');
  #flyoutReason: 'hover' | 'trigger' = 'trigger';

  readonly #position: PositionController = new PositionController(this, {
    surface: () => this.#flyoutLayer,
    anchor: () => this.#railButton,
    placement: () => ({placement: 'end', alignment: 'start', offset: 'var(--spacing-1)'}),
    trackPlacement: true,
  });

  readonly #layer: LayerController = new LayerController(this, {
    kind: 'popover',
    surface: () => this.#flyoutLayer,
    trigger: () => this.#railButton,
    haspopup: 'dialog',
    escape: 'close',
    outsidePress: true,
    focusOut: true,
    // A hover-open leaves focus where it is; every other way in moves it into the flyout.
    initialFocus: () => {
      const box = this.#flyoutBox;
      if (!box || this.#flyoutReason === 'hover') return null;
      return getTabbables(box)[0] ?? box;
    },
    position: this.#position,
    onDismissRequest: () => {
      this._flyout = false;
    },
    onNativeClose: () => {
      this._flyout = false;
    },
  });

  readonly #hover: NavHoverController = new NavHoverController(this, {
    trigger: () => this.#railButton,
    surface: () => this.#flyoutLayer,
    isOpen: () => this._flyout,
    enabled: () => this.#isRailWithChildren,
    onOpen: () => {
      this.#flyoutReason = 'hover';
      this._flyout = true;
      this.#hover.markHoverOpened();
    },
    onClose: () => {
      this._flyout = false;
    },
  });

  constructor() {
    super();
    // The sub-items of a collapsed item show in full in its flyout, and inside an expanded row they
    // read the same: the rail's collapse never reaches them.
    new ContextProvider(this, {
      context: sideNavCollapseContext,
      initialValue: INERT_SIDE_NAV_COLLAPSE,
    });
    new TooltipController(this, {
      mode: 'shadow',
      trigger: () => this.#primary,
      surface: () => this.renderRoot.querySelector<HTMLElement>('.tooltip-surface'),
      content: () => (this.#isRailPlain ? this.label : ''),
      placement: () => ({placement: 'end', alignment: 'center', offset: 'var(--spacing-1)'}),
      focusTrigger: 'auto',
      touchTrigger: 'auto',
      enabled: () => this.#isRailPlain && this.label !== '',
    });
  }

  get #railButton(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.rail-trigger') ?? null;
  }

  get #primary(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.primary') ?? null;
  }

  get #flyoutLayer(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.flyout-layer') ?? null;
  }

  get #flyoutBox(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.flyout') ?? null;
  }

  get #hasIcon(): boolean {
    return this.icon !== '' || this.#slots.has('icon');
  }

  get #inRail(): boolean {
    return this.#collapse.value.isCollapsed;
  }

  get #isRailWithChildren(): boolean {
    return this.#inRail && this.#hasIcon && this.#slots.has('default');
  }

  get #isRailPlain(): boolean {
    return this.#inRail && this.#hasIcon && !this.#slots.has('default');
  }

  /** The item's link or button (the native control that takes focus). */
  get control(): HTMLElement | null {
    return this.#primary ?? this.#railButton;
  }

  override focus(options?: FocusOptions): void {
    this.control?.focus(options);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // The compact-size provider of the actions must exist before the actions connect (nav-render.ts).
    renderOnConnect(this);
  }

  protected override willUpdate(): void {
    // The flyout only exists in the collapsed rail.
    if (this._flyout && !this.#isRailWithChildren) this._flyout = false;
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('_flyout')) {
      this.toggleState('open', this._flyout);
      if (this._flyout) void this.#layer.show();
      else void this.#layer.hide();
    }
  }

  // ---------------------------------------------------------------------------- behaviour

  get #isCollapsible(): boolean {
    return this.#slots.has('default') && !this.noCollapse;
  }

  /** The row keeps its own action, so expanding the sub-items is a separate button. */
  get #independentToggle(): boolean {
    return this.#isCollapsible && (this.href !== undefined || this.hasAction);
  }

  get #inDrawer(): boolean {
    const mode = this.#mode.value;
    return mode === 'drawer' || mode === 'drawer-content';
  }

  #requestCollapsed(event: Event): void {
    const next = !this.collapsed;
    const reason = (event as MouseEvent).detail === 0 ? 'keyboard' : 'pointer';
    if (this.dispatch(new TctCollapseChangeEvent(next, reason))) this.collapsed = next;
  }

  readonly #onPrimaryClick = (event: MouseEvent): void => {
    if (this.disabled) {
      event.preventDefault();
      return;
    }
    if (this.#isCollapsible && !this.#independentToggle) {
      event.preventDefault();
      this.#requestCollapsed(event);
      return;
    }
    routeNavClick(event, this.#router.value, {href: this.href});
    // A destination or an action was chosen inside the drawer: the drawer's job is done.
    if (this.#inDrawer) this.#shell.value.closeMobileNav();
  };

  readonly #onToggleClick = (event: MouseEvent): void => {
    event.preventDefault();
    // The chevron is not the item: consumers listening for clicks on the item never hear it.
    event.stopPropagation();
    this.#requestCollapsed(event);
  };

  readonly #onRailTriggerClick = (event: MouseEvent): void => {
    if (this.disabled) return;
    if (this._flyout) {
      if (this.#hover.confirmsHover(0)) this.#hover.pin();
      else this._flyout = false;
      return;
    }
    this.#flyoutReason = 'trigger';
    this.#hover.pin();
    this._flyout = true;
    event.stopPropagation();
  };

  /** A link or button chosen inside the flyout closes it. */
  readonly #onFlyoutClick = (event: MouseEvent): void => {
    const path = event.composedPath();
    const chosen = path.some(
      (target) =>
        target instanceof HTMLElement &&
        (target.localName === 'a' || target.localName === 'button') &&
        target !== this.#railButton,
    );
    if (chosen) this._flyout = false;
  };

  // -------------------------------------------------------------------------------- render

  #iconTemplate(): TemplateResult | typeof nothing {
    if (!this.#hasIcon) return nothing;
    const selectedCustom = this.selected && this.#slots.has('selected-icon');
    const name = this.selected && this.selectedIcon ? this.selectedIcon : this.icon;
    return html`<span class="nav-row-icon" part="icon"
      ><tct-icon name=${name} size="sm" color="inherit"
        ><slot name=${selectedCustom ? 'selected-icon' : 'icon'}></slot></tct-icon
    ></span>`;
  }

  /** The element the row is: a link with a live destination, else a button. */
  #control(
    className: string,
    content: TemplateResult | typeof nothing,
    extra: {label?: string; expanded?: boolean; controls?: string} = {},
  ): TemplateResult {
    const isLink = this.href !== undefined && !this.disabled;
    const href = isLink ? safeHref(this.href) : null;
    const label = extra.label ?? (this._hostLabel?.trim() || undefined);
    const size = pick(SIDE_NAV_ITEM_SIZES, this.size, 'md', 'size');
    const current = this.selected ? 'page' : undefined;
    const expanded = extra.expanded === undefined ? undefined : String(extra.expanded);
    return isLink
      ? html`<a
          class=${className}
          part="item"
          href=${ifDefined(href ?? undefined)}
          data-size=${size}
          ?data-selected=${this.selected}
          aria-current=${ifDefined(current)}
          aria-label=${ifDefined(label)}
          aria-expanded=${ifDefined(expanded)}
          aria-controls=${ifDefined(extra.controls)}
          @click=${this.#onPrimaryClick}
          >${content}</a
        >`
      : html`<button
          type="button"
          class=${className}
          part="item"
          data-size=${size}
          ?data-selected=${this.selected}
          ?disabled=${this.disabled}
          aria-current=${ifDefined(current)}
          aria-label=${ifDefined(label)}
          aria-expanded=${ifDefined(expanded)}
          aria-controls=${ifDefined(extra.controls)}
          @click=${this.#onPrimaryClick}
        >
          ${content}
        </button>`;
  }

  #renderRail(): TemplateResult {
    const size = pick(SIDE_NAV_ITEM_SIZES, this.size, 'md', 'size');
    const name = this._hostLabel?.trim() || this.label;
    if (!this.#slots.has('default')) {
      // An icon-only link or button, named by its label and described by the tooltip.
      return html`<div class="root" part="base" data-rail>
        ${this.#control('nav-row primary rail focus-ring', this.#iconTemplate(), {label: name})}
        <div class="layer-surface tooltip-surface" part="tooltip" popover="manual">
          ${this.label}
        </div>
      </div>`;
    }
    const flyoutId = this.#ids.id('flyout');
    return html`<div class="root" part="base" data-rail>
      <button
        type="button"
        class="nav-row rail rail-trigger focus-ring"
        part="item"
        data-size=${size}
        ?data-selected=${this.selected}
        ?disabled=${this.disabled}
        aria-label=${name}
        aria-haspopup="dialog"
        aria-expanded=${String(this._flyout)}
        aria-controls=${ifDefined(this._flyout ? flyoutId : undefined)}
        @click=${this.#onRailTriggerClick}
      >
        ${this.#iconTemplate()}
      </button>
      <div class="flyout-layer layer-surface" popover="manual" data-placement="end">
        <div
          class="flyout"
          part="flyout"
          id=${flyoutId}
          role="dialog"
          aria-label=${this.#locale.t('submenuLabel', {label: this.label})}
          tabindex="-1"
          @click=${this.#onFlyoutClick}
        >
          <div class="flyout-title">${this.label}</div>
          <slot></slot>
        </div>
      </div>
    </div>`;
  }

  #renderRow(): TemplateResult {
    const collapsible = this.#isCollapsible;
    const independent = this.#independentToggle;
    const hasActions = this.#slots.has('actions');
    const wrapped = independent || hasActions;
    const childrenId = this.#ids.id('children');
    const size = pick(SIDE_NAV_ITEM_SIZES, this.size, 'md', 'size');
    const chevron = html`<tct-icon
      class="chevron"
      name="chevronDown"
      size="sm"
      color="inherit"
      ?data-expanded=${!this.collapsed}
    ></tct-icon>`;
    const content = html`${this.#iconTemplate()}<span class="nav-row-label" part="label"
        >${this.label}</span
      ><span class="nav-row-end" part="end-content"><slot name="end"></slot></span
      >${collapsible && !independent ? chevron : nothing}`;

    let row: TemplateResult;
    if (wrapped) {
      row = html`<div
        class="nav-row row-wrap"
        part="row"
        data-size=${size}
        ?data-selected=${this.selected}
        ?data-disabled=${this.disabled}
      >
        ${this.#control('primary focus-ring', content, {
          // The chevron button owns the disclosure state when it is separate.
          expanded: independent ? undefined : collapsible ? !this.collapsed : undefined,
          controls: independent ? undefined : collapsible ? childrenId : undefined,
        })}
        ${
          independent
            ? html`<button
                type="button"
                class="toggle focus-ring"
                part="toggle"
                aria-label=${this.#locale.t(this.collapsed ? 'expand' : 'collapse', {
                  label: this.label,
                })}
                aria-expanded=${String(!this.collapsed)}
                aria-controls=${childrenId}
                @click=${this.#onToggleClick}
              >
                ${chevron}
              </button>`
            : nothing
        }
        ${
          hasActions
            ? html`<span class="actions" part="actions"
                ><tct-size-provider size="sm"><slot name="actions"></slot></tct-size-provider
              ></span>`
            : nothing
        }
      </div>`;
    } else {
      row = this.#control('nav-row primary focus-ring', content, {
        expanded: collapsible ? !this.collapsed : undefined,
        controls: collapsible ? childrenId : undefined,
      });
    }

    return html`<div class="root" part="base">
      ${row}
      ${
        this.#slots.has('default')
          ? html`<div
              class="children"
              part="children"
              id=${childrenId}
              role="group"
              aria-label=${this.label}
              ?data-collapsed=${collapsible && this.collapsed}
              ?inert=${collapsible && this.collapsed}
            >
              <div class="children-inner"><slot></slot></div>
            </div>`
          : nothing
      }
    </div>`;
  }

  override render(): TemplateResult | typeof nothing {
    // In the collapsed rail an item without an icon has nothing to show.
    if (this.#inRail && !this.#hasIcon) return nothing;
    return this.#inRail ? this.#renderRail() : this.#renderRow();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-side-nav-item': TctSideNavItem;
  }
}
