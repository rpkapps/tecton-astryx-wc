import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {linkContext} from '@tecton-wc/core/context/keys.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {IdController} from '@tecton-wc/core/utils/id.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {AppShellMobileController} from '../app-shell/app-shell-mobile.context.js';
import {TctIcon} from '../icon/tct-icon.js';
import {computeTargetAndRel} from '../link/link.rel.js';
import {routeNavClick, safeHref} from '../side-nav/nav-link.js';
import navItem from '../side-nav/nav-item.styles.css';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {TopNavRenderModeController} from './top-nav.context.js';
import styles from './tct-top-nav-mega-menu-item.styles.css';

/**
 * A destination in a top navigation menu: an icon, a title and a description. It is a link when it has an
 * `href`, a button otherwise (so it is always keyboard operable). Put items in the default slot of a
 * `tct-top-nav-menu` or a `tct-top-nav-mega-menu`; in the panel they are cards, in the mobile drawer rows
 * indented under the menu's section. The title names the link and the description describes it.
 *
 * @summary A titled destination with an icon and a description, for the panel of a top navigation menu.
 * @tag tct-top-nav-mega-menu-item
 * @upstream TopNavMegaMenuItem
 * @slot icon - A custom icon (an `<svg>` or `tct-icon`), instead of `icon`.
 * @csspart item - The link or button.
 * @csspart icon - The icon box.
 * @csspart title - The title.
 * @csspart description - The description.
 * @fires click - Native click, retargeted from the link or the button.
 * @cloakDisplay block
 */
export class TctTopNavMegaMenuItem extends TctElement {
  static override readonly tagName = 'tct-top-nav-mega-menu-item';
  static override readonly dependencies = [TctIcon];
  static override styles: CSSResultGroup = [base, focusRing, navItem, styles];

  /** The title of the destination. */
  @property() heading = '';

  /** A line below the title. */
  @property() description = '';

  /** Registered icon name. Or slot your own into `icon`. */
  @property() icon = '';

  /** Destination. Without it the item is a button: listen for `click`. */
  @property() href: string | undefined;

  /** Where to open the destination. `_blank` adds `rel="noopener noreferrer"`. */
  @property() target: string | undefined;

  /** Link relationship. */
  @property() rel: string | undefined;

  readonly #slots: SlotController = new SlotController(this, 'icon');
  readonly #mode: TopNavRenderModeController = new TopNavRenderModeController(this);
  readonly #shell: AppShellMobileController = new AppShellMobileController(this);
  readonly #router: ContextConsumer<typeof linkContext> = new ContextConsumer<
    typeof linkContext
  >(this, {context: linkContext});
  readonly #ids: IdController = new IdController(this, 'tct-top-nav-mega-menu-item');

  /** The link or button inside the item. */
  get control(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.entry') ?? null;
  }

  override focus(options?: FocusOptions): void {
    this.control?.focus(options);
  }

  readonly #onClick = (event: MouseEvent): void => {
    const {target} = computeTargetAndRel(this.target || undefined, this.rel || undefined);
    routeNavClick(event, this.#router.value, {
      href: this.href,
      native: target !== undefined && target !== '_self',
    });
    if (this.#mode.value === 'drawer') this.#shell.value.closeMobileNav();
  };

  override render(): TemplateResult {
    const drawer = this.#mode.value === 'drawer';
    const hasIcon = this.icon !== '' || this.#slots.has('icon');
    const titleId = this.#ids.id('title');
    const descriptionId = this.#ids.id('description');
    const {target, rel} = computeTargetAndRel(this.target || undefined, this.rel || undefined);
    const href = this.href !== undefined ? safeHref(this.href) : null;
    const isLink = this.href !== undefined;
    const content = html`${hasIcon
        ? html`<span class="icon-box" part="icon"
            ><tct-icon name=${this.icon} size="sm" color="inherit"
              ><slot name="icon"></slot></tct-icon
          ></span>`
        : nothing}<span class="text"
        ><span class="title" part="title" id=${titleId}>${this.heading}</span
        >${this.description
          ? html`<span class="description" part="description" id=${descriptionId}
              >${this.description}</span
            >`
          : nothing}</span
      >`;
    const className = drawer ? 'entry nav-row focus-ring' : 'entry focus-ring';
    return isLink
      ? html`<a
          class=${className}
          part="item"
          href=${ifDefined(href ?? undefined)}
          target=${ifDefined(href !== null ? target : undefined)}
          rel=${ifDefined(href !== null ? rel : undefined)}
          aria-labelledby=${titleId}
          aria-describedby=${ifDefined(this.description ? descriptionId : undefined)}
          data-size="md"
          @click=${this.#onClick}
          >${content}</a
        >`
      : html`<button
          type="button"
          class=${className}
          part="item"
          aria-labelledby=${titleId}
          aria-describedby=${ifDefined(this.description ? descriptionId : undefined)}
          data-size="md"
          @click=${this.#onClick}
        >
          ${content}
        </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-top-nav-mega-menu-item': TctTopNavMegaMenuItem;
  }
}
