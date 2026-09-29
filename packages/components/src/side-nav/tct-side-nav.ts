import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {ResizableController, type ResizableReason} from '@tecton-wc/core/controllers/resizable.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctCollapseChangeEvent} from '@tecton-wc/core/events/tct-collapse-change.js';
import {TctSizeChangeEvent} from '@tecton-wc/core/events/tct-size-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import english from '@tecton-wc/locales/en/sideNav.js';
import {TctResizeHandle} from '../resize-handle/tct-resize-handle.js';
import {TctSizeProvider} from '../size-provider/tct-size-provider.js';
import base from '../styles/base.styles.css';
import motion from '../styles/motion.styles.css';
import {
  SideNavRenderModeController,
  sideNavCollapseContext,
  sideNavRenderContext,
  INERT_SIDE_NAV_COLLAPSE,
  type SideNavCollapseState,
} from './side-nav.context.js';
import {SIDE_NAV_COLLAPSE_THRESHOLD} from './side-nav.types.js';
import {renderOnConnect} from './nav-render.js';
import {TctSideNavCollapseButton} from './tct-side-nav-collapse-button.js';
import styles from './tct-side-nav.styles.css';

/** Default and bounds of the width when resizable (upstream: 260, 180 to 480). */
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 180;
const MAX_WIDTH = 480;

/**
 * The sidebar navigation of an application page: five zones, top to bottom. The `header` (a
 * `tct-side-nav-heading`) and `top-content` (a create button, top-level items) stay pinned at the top; the
 * default slot (`tct-side-nav-section`s and `tct-side-nav-item`s) scrolls; the `footer` (a promo card) and the
 * `footer-icons` row (help, notifications, an avatar) stay pinned at the bottom. It is a `nav` landmark.
 *
 * `collapsible` adds a button (and a state, `collapsed`) that shrinks the navigation to a narrow rail of
 * icon buttons: items are named by their labels and show a tooltip, items with sub-items open a flyout, and
 * items without an icon are hidden. Place a `tct-side-nav-collapse-button` in the header, the footer or the
 * `footer-icons` slot, or outside the navigation (name it with `for`), and turn the built-in one off with
 * `no-collapse-button`. `resizable` adds a drag handle at the inline-end edge (a keyboard-operable
 * separator); dragging below 160px collapses a collapsible navigation. `auto-save-id` remembers the width
 * and the collapse state in `localStorage`.
 *
 * The user's collapse (the button, a drag) asks with a cancelable `tct-collapse-change` first: prevent it
 * and set `collapsed` yourself to own the state. Writing `collapsed`, `collapse()` and `expand()` never
 * emit it. `tct-size-change` reports every step of a resize.
 *
 * Inside a `tct-app-shell`, below the mobile breakpoint the navigation is the content of the mobile
 * drawer (a vertical layout, no collapse, no resize): the heading, the top content, the items and the
 * footer, one under the other; choosing an item closes the drawer. The render mode is shared with the
 * shell through `sideNavRenderContext`; provide it around a navigation to render one in a top bar
 * (`topbar`) or in a drawer of your own (`drawer-content`).
 *
 * @summary Application sidebar navigation with pinned header and footer, an icon rail and a resize handle.
 * @tag tct-side-nav
 * @upstream SideNav
 * @slot - The navigation: `tct-side-nav-section`s and `tct-side-nav-item`s. Scrolls.
 * @slot header - The heading, typically a `tct-side-nav-heading`. Pinned at the top.
 * @slot top-content - Content pinned below the header: a create button, top-level items.
 * @slot footer - Content above the footer icon row: a promo card.
 * @slot footer-icons - The footer icon row: help, notifications, an avatar. Its buttons take the compact size.
 * @csspart base - The `nav` box.
 * @csspart header - The pinned top zone (the header and the top content).
 * @csspart content - The scrolling zone.
 * @csspart footer - The pinned bottom zone.
 * @csspart resize-handle - The resize handle.
 * @cssprop --side-nav-width - Width of the navigation while it is not resizable. Default 260px.
 * @cssstate collapsed - The navigation is collapsed to the icon rail.
 * @fires tct-collapse-change - The user asked to collapse or expand the navigation (the button, or a drag past the threshold); cancelable, carries `collapsed` and `reason`.
 * @fires tct-size-change - The user resized the navigation (a drag or the keyboard on the handle); carries `size`.
 * @cloakDisplay block
 */
export class TctSideNav extends TctElement {
  static override readonly tagName = 'tct-side-nav';
  static override readonly dependencies = [
    TctSideNavCollapseButton,
    TctResizeHandle,
    TctSizeProvider,
  ];
  static override styles: CSSResultGroup = [base, motion, styles];

  /** Enables the collapse to the icon rail, with the built-in button (unless `no-collapse-button`). */
  @property({type: Boolean, reflect: true}) collapsible = false;

  /**
   * The navigation is collapsed to the icon rail (needs `collapsible`). The attribute is the initial
   * state; the user's collapse asks through `tct-collapse-change`, and writes never emit it.
   */
  @property({type: Boolean, reflect: true}) collapsed = false;

  /** Leaves out the built-in collapse button: place a `tct-side-nav-collapse-button` where you want it. */
  @property({type: Boolean, attribute: 'no-collapse-button'}) noCollapseButton = false;

  /** Accessible name and tooltip of the built-in collapse button, replacing "Collapse sidebar" and "Expand sidebar". */
  @property({attribute: 'collapse-button-label'}) collapseButtonLabel = '';

  /** Adds a drag handle at the inline-end edge to resize the navigation (hidden while collapsed). */
  @property({type: Boolean, reflect: true}) resizable = false;

  /** Initial width in px when resizable. Default 260. */
  @property({type: Number, attribute: 'default-width'}) defaultWidth = DEFAULT_WIDTH;

  /** Minimum width in px when resizable. Default 180. */
  @property({type: Number, attribute: 'min-width'}) minWidth = MIN_WIDTH;

  /** Maximum width in px when resizable. Default 480. */
  @property({type: Number, attribute: 'max-width'}) maxWidth = MAX_WIDTH;

  /** Remembers the width and the collapse state in `localStorage` under this key. */
  @property({attribute: 'auto-save-id'}) autoSaveId: string | undefined;

  /** Accessible name of the `nav` landmark. Default "Side navigation". */
  @property() label = '';

  /** Accessible name of the resize handle. Default "Resize sidebar". */
  @property({attribute: 'resize-label'}) resizeLabel = '';

  readonly #slots: SlotController = new SlotController(
    this,
    'header',
    'top-content',
    'footer',
    'footer-icons',
  );
  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'sideNav',
    defaults: english,
  });
  readonly #mode: SideNavRenderModeController = new SideNavRenderModeController(this, {
    derive: true,
  });
  readonly #collapseProvider: ContextProvider<typeof sideNavCollapseContext> = new ContextProvider<
    typeof sideNavCollapseContext
  >(this, {context: sideNavCollapseContext, initialValue: INERT_SIDE_NAV_COLLAPSE});
  readonly #modeProvider: ContextProvider<typeof sideNavRenderContext> = new ContextProvider<
    typeof sideNavRenderContext
  >(this, {context: sideNavRenderContext, initialValue: 'default'});
  readonly #listeners = new Set<() => void>();
  #published: SideNavCollapseState | undefined;
  #lastNotified = '';

  /** The size, collapse and persistence state of the navigation, shared with its resize handle. */
  readonly #region: ResizableController = new ResizableController(this, () => ({
    defaultSize: this.defaultWidth,
    minSize: this.minWidth,
    maxSize: this.maxWidth,
    collapsible: this.collapsible,
    collapsedSize: SIDE_NAV_COLLAPSE_THRESHOLD,
    autoSaveId: this.autoSaveId,
    defaultCollapsed: this.collapsed,
    beforeCollapseChange: (collapsed, reason) => this.#ask(collapsed, reason),
    onSizeChange: (size, reason) => {
      if (reason !== 'request') this.dispatch(new TctSizeChangeEvent(size, reason));
    },
    onCollapseChange: (collapsed) => {
      // A drag, the button or a method changed it: the attribute follows.
      if (this.collapsed !== collapsed) this.collapsed = collapsed;
    },
  }));

  /** The current width in px, `0` while collapsed to the rail (the rail has its own fixed width). */
  get width(): number {
    return this.#region.size;
  }

  /** Whether the navigation is rendered as the collapsed rail right now (collapsible, collapsed, and inline). */
  get isCollapsed(): boolean {
    return this.#mode.value === 'default' && this.collapsible && this.#region.collapsed;
  }

  /** Collapses to the icon rail without a `tct-collapse-change` (programmatic); nothing happens unless `collapsible`. */
  collapse(): void {
    this.collapsed = true;
    this.#region.collapse();
  }

  /** Expands from the icon rail without a `tct-collapse-change` (programmatic), to the width it had. */
  expand(): void {
    this.collapsed = false;
    this.#region.expand();
  }

  /**
   * Asks to collapse or expand as the user would: raises the cancelable `tct-collapse-change` and applies
   * the change unless it is prevented. This is what the collapse button calls.
   */
  requestCollapseToggle(reason: 'pointer' | 'keyboard' = 'pointer'): void {
    if (!this.collapsible) return;
    const next = !this.#region.collapsed;
    if (!this.#ask(next, reason)) return;
    if (next) this.#region.collapse();
    else this.#region.expand();
  }

  /**
   * Runs `listener` whenever the collapse state changes; returns the function that stops it. A
   * `tct-side-nav-collapse-button` outside the navigation follows it this way. @internal
   */
  subscribeCollapse(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Raises `tct-collapse-change`; `false` when the page prevented it. */
  #ask(collapsed: boolean, reason: ResizableReason): boolean {
    return this.dispatch(
      new TctCollapseChangeEvent(collapsed, reason === 'keyboard' ? 'keyboard' : 'pointer'),
    );
  }

  // ------------------------------------------------------------------------------ lifecycle

  override connectedCallback(): void {
    super.connectedCallback();
    // The compact-size provider of the footer must exist before the footer icons connect (nav-render.ts).
    renderOnConnect(this);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (!this.hasUpdated) {
      // The region already resolved its first state from the attribute and from what was saved (a saved
      // state wins): the attribute adopts it.
      if (this.collapsible && this.collapsed !== this.#region.collapsed)
        this.collapsed = this.#region.collapsed;
    } else if ((changed.has('collapsed') || changed.has('collapsible')) && this.collapsible) {
      // The attribute or property drives the region (the region drives the attribute back).
      if (this.collapsed && !this.#region.collapsed) this.#region.collapse();
      else if (!this.collapsed && this.#region.collapsed) this.#region.expand();
    }
    this.#publish();
  }

  protected override updated(): void {
    this.toggleState('collapsed', this.isCollapsed);
    const snapshot = `${String(this.isCollapsed)}|${String(this.collapsible)}`;
    if (snapshot !== this.#lastNotified) {
      this.#lastNotified = snapshot;
      for (const listener of [...this.#listeners]) listener();
    }
  }

  /** Publishes the collapse state and the render mode to the parts. */
  #publish(): void {
    const mode = this.#mode.value;
    this.#modeProvider.setValue(mode);
    const inline = mode === 'default';
    const isCollapsed = inline && this.collapsible && this.#region.collapsed;
    const isCollapsible = inline && this.collapsible;
    const previous = this.#published;
    if (previous?.isCollapsed === isCollapsed && previous.isCollapsible === isCollapsible) return;
    this.#published = {
      isCollapsed,
      isCollapsible,
      toggle: (reason) => {
        this.requestCollapseToggle(reason);
      },
    };
    this.#collapseProvider.setValue(this.#published);
  }

  // -------------------------------------------------------------------------------- render

  #footerRow(collapsed: boolean, builtIn: boolean): TemplateResult | typeof nothing {
    const hasIcons = this.#slots.has('footer-icons');
    if (!hasIcons && !builtIn) return nothing;
    return html`<div class="footer-row" ?data-collapsed=${collapsed}>
      <tct-size-provider size="sm">
        ${
          builtIn
            ? html`<tct-side-nav-collapse-button
                label=${ifDefined(this.collapseButtonLabel || undefined)}
              ></tct-side-nav-collapse-button>`
            : nothing
        }
        <slot name="footer-icons"></slot>
      </tct-size-provider>
    </div>`;
  }

  override render(): TemplateResult {
    const mode = this.#mode.value;
    const label = this.label || this.#locale.t('label');

    // A horizontal bar: the heading and the footer icons (a top bar of your own).
    if (mode === 'topbar') {
      return html`<div class="topbar" part="base">
        <slot name="header"></slot>
        <div class="topbar-icons">
          <tct-size-provider size="sm"><slot name="footer-icons"></slot></tct-size-provider>
        </div>
      </div>`;
    }

    // The mobile drawer (or one of your own): the zones one under the other, nothing to collapse.
    if (mode === 'drawer' || mode === 'drawer-content') {
      const footer = this.#slots.has('footer') || this.#slots.has('footer-icons');
      const content = html`${mode === 'drawer' ? html`<slot name="header"></slot>` : nothing}
        <slot name="top-content"></slot>
        <slot></slot>
        ${
          footer
            ? html`<div class="drawer-footer">
                <slot name="footer"></slot>
                <div class="drawer-icons">
                  <tct-size-provider size="sm"><slot name="footer-icons"></slot></tct-size-provider>
                </div>
              </div>`
            : nothing
        }`;
      return mode === 'drawer'
        ? html`<nav class="drawer" part="base" aria-label=${label}>${content}</nav>`
        : html`<div class="drawer" part="base">${content}</div>`;
    }

    const collapsed = this.isCollapsed;
    const hasTop = this.#slots.has('header') || this.#slots.has('top-content');
    const hasBottom =
      this.#slots.has('footer') || this.#slots.has('footer-icons') || this.#showsButton;
    const resizable = this.resizable && !collapsed;
    const width = resizable ? `${String(this.#region.size)}px` : undefined;
    return html`<div class="frame" ?data-resizable=${resizable}>
      <nav
        class="root"
        part="base"
        aria-label=${label}
        ?data-collapsed=${collapsed}
        style=${ifDefined(width ? `--_width: ${width}` : undefined)}
      >
        ${
          hasTop
            ? html`<div class="top" part="header" ?data-collapsed=${collapsed}>
                <slot name="header"></slot>
                ${
                  this.#slots.has('top-content')
                    ? html`<div class="top-content"><slot name="top-content"></slot></div>`
                    : nothing
                }
              </div>`
            : nothing
        }
        <div
          class="content"
          part="content"
          ?data-collapsed=${collapsed}
          ?data-top=${hasTop}
          ?data-bottom=${hasBottom}
        >
          <slot></slot>
        </div>
        ${
          hasBottom
            ? html`<div class="bottom" part="footer" ?data-collapsed=${collapsed}>
                <slot name="footer"></slot>
                ${this.#footerRow(collapsed, this.#showsButton)}
              </div>`
            : nothing
        }
      </nav>
      ${
        resizable
          ? html`<tct-resize-handle
              class="handle"
              part="resize-handle"
              direction="horizontal"
              position="overlay"
              pill-placement="end"
              no-always-visible
              label=${this.resizeLabel || this.#locale.t('resizeSidebar')}
              .resizable=${this.#region.props}
            ></tct-resize-handle>`
          : nothing
      }
    </div>`;
  }

  get #showsButton(): boolean {
    return this.collapsible && !this.noCollapseButton;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-side-nav': TctSideNav;
  }
}
