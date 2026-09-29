import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {html as staticHtml, literal} from 'lit/static-html.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {interactiveRoleContext, linkContext} from '@tecton-wc/core/context/keys.js';
import {AriaDelegateController} from '@tecton-wc/core/controllers/aria-delegate.js';
import {TooltipController} from '@tecton-wc/core/controllers/tooltip.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {safeUrl} from '@tecton-wc/core/utils/safe-url.js';
import english from '@tecton-wc/locales/en/link.js';
import {TctIcon} from '../icon/tct-icon.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import layer from '../styles/layer.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {TctText} from '../text/tct-text.js';
import {
  TEXT_COLORS,
  TEXT_DISPLAYS,
  warnInvalidValue,
  type TextColor,
  type TextDisplay,
  type TextSize,
  type TextType,
  type TextWeight,
} from '../text/text.types.js';
import {computeTargetAndRel} from './link.rel.js';
import {downloadConverter, type LinkDownload} from './link.types.js';
import styles from './tct-link.styles.css';

/**
 * A link: a native `<a href>` in the shadow root, or a `<button type="button">` dressed as one when there is
 * no destination (an action that reads as a link). The text takes its typography from `tct-text`
 * (`type`, `size`, `weight`, `max-lines`), so an inline link inside a `large` paragraph uses `type="inherit"`.
 *
 * The destination goes through the URL policy: a `javascript:`-style value renders an anchor without an
 * `href`. `external` opens a new tab (`target="_blank"`, `rel="noopener noreferrer"`), adds the external
 * icon and a visually hidden "opens in new tab" hint to the accessible name. A `disabled` link is a plain
 * anchor without `href`, so it cannot be focused or activated by any route. An unmodified primary click
 * on an internal link is offered to an enclosing `tct-link-provider` (client-side routing); modified
 * clicks, other targets and downloads stay native.
 *
 * Guides: [mwg:accessible-web-components] (native `<a>` and `<button>` in the shadow root, `delegatesFocus`,
 * names through `aria-label`) [mwg:security] (URL policy, `noopener`) [mwg:styling-web-components]
 * [mwg:interest-triggered-tooltips].
 *
 * @summary A text link (or a button that looks like one) with external-link, tooltip and router support.
 * @tag tct-link
 * @upstream Link
 * @slot - The link content (text, or an icon with a `label`).
 * @csspart base - The `<a>` or `<button>`; carries `data-color`.
 * @csspart text - The `tct-text` around the content.
 * @csspart external-icon - The external-link icon.
 * @csspart tooltip - The tooltip surface, when `tooltip` is set.
 * @fires click - Native click, retargeted from the inner anchor or button (never fired by a disabled link).
 * @cloakDisplay inline
 */
export class TctLink extends TctElement {
  static override readonly tagName = 'tct-link';
  static override readonly dependencies = [TctText, TctIcon];
  static override shadowRootOptions: ShadowRootInit = {
    ...TctElement.shadowRootOptions,
    delegatesFocus: true,
  };
  static override styles: CSSResultGroup = [base, focusRing, layer, visuallyHidden, styles];

  /**
   * Accessible label. Use it when the content is not self-descriptive (an icon-only link); with text
   * content the text is the name. A host `aria-label` wins.
   */
  @property() label = '';

  /**
   * Destination. Without it the element renders a `<button>` with link styling. A destination the URL
   * policy refuses renders an anchor without `href`.
   */
  @property() href: string | undefined;

  /** Always underline. Without it the underline appears on hover (Tecton: the underline is the affordance). */
  @property({type: Boolean, reflect: true, attribute: 'has-underline'}) hasUnderline = false;

  /**
   * Disabled: a plain anchor without `href` (or a disabled button), not focusable and never navigating
   * or firing `click`, however it is activated.
   */
  @property({type: Boolean, reflect: true}) disabled = false;

  /**
   * Opens the destination in a new tab: `target="_blank"`, `rel` gets `noopener noreferrer`, an external
   * icon shows and the hint {@link newTabLabel} joins the accessible name.
   */
  @property({type: Boolean, reflect: true}) external = false;

  /** Screen-reader text of an external link ("opens in new tab"). Default: the localised message. */
  @property({attribute: 'new-tab-label'}) newTabLabel: string | undefined;

  /** Where to open the destination (`_blank`, `_parent`, ...). `external` forces `_blank`. */
  @property() target: string | undefined;

  /** Link relationship. `target="_blank"` adds `noopener noreferrer`. */
  @property() rel: string | undefined;

  /**
   * Downloads the destination instead of navigating: the attribute alone, or with a suggested file name.
   * As a property: `true` or the file name.
   */
  @property({converter: downloadConverter}) download: LinkDownload = false;

  /** Referrer policy of the request. */
  @property({attribute: 'referrer-policy'}) referrerPolicy: ReferrerPolicy | undefined;

  /** Text of a tooltip shown on hover and keyboard focus. */
  @property() tooltip = '';

  /** A standalone link (not inline in a sentence): applies the body font size and leading to the link box. */
  @property({type: Boolean, reflect: true}) standalone = false;

  /**
   * Text type of the content, as `tct-text`. Default `body`; use `inherit` for an inline link inside a
   * paragraph so it adopts that paragraph's size.
   */
  @property({reflect: true}) type: TextType = 'body';

  /** Font size override, as `tct-text`. */
  @property({reflect: true}) size: TextSize | undefined;

  /** Font weight override, as `tct-text`. */
  @property({reflect: true}) weight: TextWeight | undefined;

  /**
   * Colour: `accent` (default; Tecton renders it as the primary text colour, the underline being the
   * affordance), `primary`, `secondary`, `disabled`, `placeholder` or `inherit`.
   */
  @property({reflect: true}) color: TextColor = 'accent';

  /** `inline` (default) or `block`, as `tct-text`. */
  @property({reflect: true}) display: TextDisplay = 'inline';

  /** Maximum lines of the text before truncation (with a tooltip of the full text); 0 means no limit. */
  @property({type: Number, attribute: 'max-lines'}) maxLines = 0;

  /** The host `aria-label`, tracked so a change re-renders the inner element. @internal */
  @property({attribute: 'aria-label'}) private _hostLabel: string | null = null;

  readonly #locale = new LocaleController(this, {namespace: 'link', defaults: english});
  readonly #interactive = new ContextConsumer(this, {
    context: interactiveRoleContext,
    subscribe: true,
  });
  readonly #router = new ContextConsumer(this, {context: linkContext});

  constructor() {
    super();
    new AriaDelegateController(this, {
      target: () => this.control,
      // The name is composed here; with a tooltip the description is the tooltip's (like `tct-button`).
      exclude: () => ['aria-label', ...(this.tooltip ? ['aria-describedby'] : [])],
    });
    // The surface sits in this shadow root next to the link (the trigger), so `aria-describedby` stays
    // inside one tree. [mwg:interest-triggered-tooltips]
    new TooltipController(this, {
      mode: 'shadow',
      trigger: () => this.control,
      surface: () => this.renderRoot.querySelector<HTMLElement>('.tooltip-surface'),
      content: () => this.tooltip,
      focusTrigger: 'auto',
      touchTrigger: 'auto',
    });
  }

  /** The inner `<a>` or `<button>`. */
  get control(): HTMLAnchorElement | HTMLButtonElement | null {
    return this.renderRoot.querySelector<HTMLAnchorElement | HTMLButtonElement>('.root');
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('color')) warnInvalidValue('tct-link', 'color', this.color, TEXT_COLORS);
    if (changed.has('display'))
      warnInvalidValue('tct-link', 'display', this.display, TEXT_DISPLAYS);
  }

  /**
   * What the element renders as (upstream `useInteractiveRole`): a link when there is a live destination;
   * otherwise a button when there is none, or when an enclosing trigger asked for a button; otherwise (a
   * disabled destination) a plain anchor without `href`.
   */
  get #form(): 'link' | 'button' | 'disabled-anchor' {
    const hasHref = this.href !== undefined && this.href !== null;
    if (hasHref && !this.disabled) return 'link';
    if (this.#interactive.value === true || !hasHref) return 'button';
    return 'disabled-anchor';
  }

  override render(): TemplateResult {
    const form = this.#form;
    const isLink = form === 'link';
    const asButton = form === 'button';
    const {target, rel} = computeTargetAndRel(
      this.external ? '_blank' : this.target || undefined,
      this.rel || undefined,
    );
    const href = isLink && this.href ? safeUrl(this.href, {allowData: true}) : null;
    const ariaLabel = this._hostLabel ?? (this.label || null);
    const tag = asButton ? literal`button` : literal`a`;

    const content = html`<tct-text
        part="text"
        type=${this.type}
        size=${ifDefined(this.size)}
        weight=${ifDefined(this.weight)}
        color="inherit"
        display=${this.display}
        .maxLines=${this.maxLines}
        ><slot></slot></tct-text
      >${
        this.external && !asButton
          ? html`<tct-icon
                class="external"
                part="external-icon"
                name="externalLink"
                size="xsm"
                color="inherit"
              ></tct-icon
              ><span class="visually-hidden">${this.newTabLabel ?? this.#locale.t('newTab')}</span>`
          : nothing
      }`;

    return staticHtml`<${tag}
        class="root focus-ring"
        part="base"
        type=${ifDefined(asButton ? 'button' : undefined)}
        href=${ifDefined(href ?? undefined)}
        target=${ifDefined(isLink ? target : undefined)}
        rel=${ifDefined(isLink ? rel : undefined)}
        download=${ifDefined(isLink && this.download !== false ? (this.download === true ? '' : this.download) : undefined)}
        referrerpolicy=${ifDefined(isLink ? this.referrerPolicy : undefined)}
        ?disabled=${asButton && this.disabled}
        aria-label=${ifDefined(ariaLabel ?? undefined)}
        aria-disabled=${this.disabled ? 'true' : nothing}
        tabindex=${this.disabled ? '-1' : nothing}
        data-color=${this.color}
        @click=${this.#onClick}
      >${content}</${tag}>${
        this.tooltip
          ? html`<div class="layer-surface tooltip-surface" part="tooltip" popover="manual">
              ${this.tooltip}
            </div>`
          : nothing
      }`;
  }

  #onClick = (event: MouseEvent): void => {
    if (this.disabled) {
      // A disabled link is inert however it is activated (assistive technology, script): no navigation,
      // and the click never reaches the host's listeners.
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (this.#form === 'link') this.#route(event);
  };

  /** Hands an unmodified primary click on an internal link to the router (`linkContext`). */
  #route(event: MouseEvent): void {
    const router = this.#router.value;
    const href = this.href ? safeUrl(this.href, {allowData: true}) : null;
    if (!router?.navigate || href === null) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (this.external || this.download !== false) return;
    if (this.target && this.target !== '_self') return;
    try {
      if (new URL(href, location.href).origin !== location.origin) return;
    } catch {
      return;
    }
    if (router.navigate(href, event)) event.preventDefault();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-link': TctLink;
  }
}
