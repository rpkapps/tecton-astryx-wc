import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {linkContext} from '@tecton-wc/core/context/keys.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {safeUrl} from '@tecton-wc/core/utils/safe-url.js';
import {AppShellMobileController} from '../app-shell/app-shell-mobile.context.js';
import {routeNavClick, safeHref} from '../side-nav/nav-link.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {TopNavRenderModeController} from './top-nav.context.js';
import styles from './tct-top-nav-mega-menu-featured-card.styles.css';

/**
 * The standard card for the `featured` slot of a `tct-top-nav-mega-menu`: an optional image, a title, a
 * description and a call-to-action link. For fully custom content slot your own element instead.
 *
 * The image is decorative unless you give it `image-alt`: the card already has a visible title, so an
 * image with no alt text is hidden from assistive technology. The default slot adds custom content below the
 * standard body.
 *
 * @summary A card with an optional image, a title, a description and a link for the featured slot of a mega menu.
 * @tag tct-top-nav-mega-menu-featured-card
 * @upstream TopNavMegaMenuFeaturedCard
 * @slot - Custom content below the standard body.
 * @csspart image - The image.
 * @csspart body - The text box.
 * @csspart heading - The title.
 * @csspart description - The description.
 * @csspart link - The call-to-action link.
 * @cloakDisplay block
 */
export class TctTopNavMegaMenuFeaturedCard extends TctElement {
  static override readonly tagName = 'tct-top-nav-mega-menu-featured-card';
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /** The title of the card. */
  @property() heading = '';

  /** A line below the title. */
  @property() description = '';

  /** URL of an image above the body. */
  @property() image = '';

  /** Alt text of the image. Without it the image is decorative (`alt=""`, hidden from assistive technology). */
  @property({attribute: 'image-alt'}) imageAlt = '';

  /** Text of the call-to-action link. It shows only with `link-href`. */
  @property({attribute: 'link-label'}) linkLabel = '';

  /** Destination of the call-to-action link. */
  @property({attribute: 'link-href'}) linkHref: string | undefined;

  readonly #mode: TopNavRenderModeController = new TopNavRenderModeController(this);
  readonly #shell: AppShellMobileController = new AppShellMobileController(this);
  readonly #router: ContextConsumer<typeof linkContext> = new ContextConsumer<typeof linkContext>(
    this,
    {context: linkContext},
  );

  readonly #onLinkClick = (event: MouseEvent): void => {
    routeNavClick(event, this.#router.value, {href: this.linkHref});
    if (this.#mode.value === 'drawer') this.#shell.value.closeMobileNav();
  };

  override render(): TemplateResult {
    const image = this.image ? safeUrl(this.image) : null;
    const href = this.linkHref !== undefined ? safeHref(this.linkHref) : null;
    return html`<div class="root" part="base">
      ${
        image
          ? html`<img
              class="image"
              part="image"
              src=${image}
              alt=${this.imageAlt}
              role=${ifDefined(this.imageAlt ? undefined : 'presentation')}
              aria-hidden=${this.imageAlt ? nothing : 'true'}
            />`
          : nothing
      }
      <div class="body" part="body">
        <span class="heading" part="heading">${this.heading}</span>
        ${
          this.description
            ? html`<span class="description" part="description">${this.description}</span>`
            : nothing
        }
        ${
          this.linkLabel && this.linkHref !== undefined
            ? html`<a
                class="link focus-ring"
                part="link"
                href=${ifDefined(href ?? undefined)}
                @click=${this.#onLinkClick}
                >${this.linkLabel}<span class="arrow" aria-hidden="true">&nbsp;→</span></a
              >`
            : nothing
        }
        <slot></slot>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-top-nav-mega-menu-featured-card': TctTopNavMegaMenuFeaturedCard;
  }
}
