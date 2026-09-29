import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {linkContext} from '@tecton-wc/core/context/keys.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {AppShellMobileController} from '../app-shell/app-shell-mobile.context.js';
import {TctIcon} from '../icon/tct-icon.js';
import {pick} from '../layout/layout.types.js';
import {computeTargetAndRel} from '../link/link.rel.js';
import {downloadConverter, type LinkDownload} from '../link/link.types.js';
import {routeNavClick, safeHref} from '../side-nav/nav-link.js';
import navItem from '../side-nav/nav-item.styles.css';
import {SIDE_NAV_ITEM_SIZES, type SideNavItemSize} from '../side-nav/side-nav.types.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {TopNavRenderModeController} from './top-nav.context.js';
import styles from './tct-top-nav-item.styles.css';

/**
 * A navigation link of a top navigation: a pill in the bar, with an optional icon, and a row in the mobile
 * drawer. It is a link (`<a href>`); the current page is `selected` (`aria-current="page"`). `icon-only`
 * shows just the icon and names the link by `label`. A `disabled` item is an anchor without a destination:
 * it takes no focus and cannot navigate. The default slot replaces the label with your own content.
 *
 * Put items in the default slot (or `start`) of a `tct-top-nav`, or in a `center` or `end` region. Inside
 * the mobile drawer of a `tct-app-shell` the item renders as a vertical row and closes the drawer when it
 * is chosen. An unmodified click on an internal destination is offered to the router of a
 * `tct-link-provider`.
 *
 * @summary A link of the top navigation, with icon, selected and disabled states.
 * @tag tct-top-nav-item
 * @upstream TopNavItem
 * @slot - Content shown instead of the label.
 * @slot icon - A custom icon (an `<svg>` or `tct-icon`), instead of `icon`.
 * @csspart item - The link.
 * @csspart icon - The icon box.
 * @fires click - Native click, retargeted from the link.
 * @cloakDisplay inline-flex
 */
export class TctTopNavItem extends TctElement {
  static override readonly tagName = 'tct-top-nav-item';
  static override readonly dependencies = [TctIcon];
  static override styles: CSSResultGroup = [base, focusRing, navItem, styles];

  /** The label. With `icon-only` it is the accessible name instead. */
  @property() label = '';

  /** Destination. A destination the URL policy refuses renders no `href`. */
  @property() href: string | undefined;

  /** Where to open the destination (`_blank`, ...). Ignored when disabled. `_blank` adds `rel="noopener noreferrer"`. */
  @property() target: string | undefined;

  /** Link relationship. */
  @property() rel: string | undefined;

  /** Downloads the destination instead of navigating: the attribute alone, or with a file name. */
  @property({converter: downloadConverter}) download: LinkDownload = false;

  /** Referrer policy of the request. */
  @property({attribute: 'referrer-policy'}) referrerPolicy: ReferrerPolicy | undefined;

  /** Marks the item as the current page: `aria-current="page"` and the selected fill. */
  @property({type: Boolean, reflect: true}) selected = false;

  /** Disables the item: an anchor without a destination, out of the tab order. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** A square icon-only item: the label is the accessible name and is not shown. Needs an icon. */
  @property({type: Boolean, attribute: 'icon-only', reflect: true}) iconOnly = false;

  /** Registered icon name shown before the label. Or slot your own into `icon`. */
  @property() icon = '';

  /** Row size in the mobile drawer: `sm`, `md` (default) or `lg`. The bar ignores it. */
  @property({reflect: true}) size: SideNavItemSize = 'md';

  readonly #slots: SlotController = new SlotController(this, 'default', 'icon');
  readonly #mode: TopNavRenderModeController = new TopNavRenderModeController(this);
  readonly #shell: AppShellMobileController = new AppShellMobileController(this);
  readonly #router: ContextConsumer<typeof linkContext> = new ContextConsumer<
    typeof linkContext
  >(this, {context: linkContext});

  /** The link inside the item. */
  get control(): HTMLAnchorElement | null {
    return this.renderRoot?.querySelector<HTMLAnchorElement>('.item') ?? null;
  }

  override focus(options?: FocusOptions): void {
    this.control?.focus(options);
  }

  readonly #onClick = (event: MouseEvent): void => {
    if (this.disabled) {
      // The anchor has no href, so there is nothing to block in practice; this guards synthetic clicks.
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const {target} = this.#target();
    routeNavClick(event, this.#router.value, {
      href: this.href,
      native: (target !== undefined && target !== '_self') || this.download !== false,
    });
    if (this.#mode.value === 'drawer') this.#shell.value.closeMobileNav();
  };

  #target(): {target: string | undefined; rel: string | undefined} {
    return computeTargetAndRel(this.target || undefined, this.rel || undefined);
  }

  override render(): TemplateResult {
    const drawer = this.#mode.value === 'drawer';
    const {target, rel} = this.#target();
    const live = !this.disabled;
    const href = live && this.href !== undefined ? safeHref(this.href) : null;
    const hasIcon = this.icon !== '' || this.#slots.has('icon');
    const custom = this.#slots.has('default');
    const size = pick(SIDE_NAV_ITEM_SIZES, this.size, 'md', 'size');
    return html`<a
      class=${drawer ? 'item nav-row focus-ring' : 'item focus-ring'}
      part="item"
      href=${ifDefined(href ?? undefined)}
      target=${ifDefined(live && href !== null ? target : undefined)}
      rel=${ifDefined(live && href !== null ? rel : undefined)}
      download=${ifDefined(
        live && href !== null && this.download !== false
          ? this.download === true
            ? ''
            : this.download
          : undefined,
      )}
      referrerpolicy=${ifDefined(live && href !== null ? this.referrerPolicy : undefined)}
      aria-label=${ifDefined(this.iconOnly && this.label ? this.label : undefined)}
      aria-current=${ifDefined(this.selected ? 'page' : undefined)}
      aria-disabled=${this.disabled ? 'true' : nothing}
      tabindex=${this.disabled ? '-1' : nothing}
      data-size=${size}
      ?data-selected=${this.selected}
      ?data-icon-only=${this.iconOnly}
      @click=${this.#onClick}
      >${hasIcon
        ? html`<span class="nav-row-icon" part="icon"
            ><tct-icon name=${this.icon} size="sm" color="inherit"
              ><slot name="icon"></slot></tct-icon
          ></span>`
        : nothing}${this.iconOnly
        ? nothing
        : custom
          ? html`<slot></slot>`
          : html`<span class="nav-row-label">${this.label}</span>`}</a
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-top-nav-item': TctTopNavItem;
  }
}
