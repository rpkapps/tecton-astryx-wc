import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {interactiveRoleContext, linkContext} from '@tecton-wc/core/context/keys.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {ClickableContainerController} from '@tecton-wc/core/controllers/clickable-container.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {SizeController} from '@tecton-wc/core/controllers/size.js';
import {TctRemoveEvent} from '@tecton-wc/core/events/tct-remove.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {IdController} from '@tecton-wc/core/utils/id.js';
import {safeUrl} from '@tecton-wc/core/utils/safe-url.js';
import tokenMessages from '@tecton-wc/locales/en/token.js';
import {oneOf} from '../field/field-utils.js';
import {TctIcon} from '../icon/tct-icon.js';
import {computeTargetAndRel} from '../link/link.rel.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import slottedIcon from '../styles/slotted-icon.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {TOKEN_COLORS, TOKEN_SIZES, type TokenColor, type TokenSize} from './token.types.js';
import styles from './tct-token.styles.css';

/**
 * A chip that represents a discrete piece of data inline: a tag, a category, a filter, a selected
 * recipient. It is read-only text by default, and can be made interactive in three ways that compose:
 *
 * - `clickable`: the label becomes a real `<button>` (the pill shows one focus ring around it), so the
 *   token is pressed like a button and the host fires the native `click`;
 * - `href`: the token is a link (`<a>`), with the same URL policy, `target` and `rel` rules and router
 *   hand-off (`tct-link-provider`) as `tct-link`;
 * - `removable`: a separate remove button with the name "Remove {label}". It is a second tab stop, never
 *   nested in the label's button or link (a `<button>` inside an `<a>` is invalid). Pressing it fires
 *   `tct-remove` (and no `click`); the token does not remove itself: the handler removes the element or
 *   the item it stands for. With `href` and `removable` the whole pill activates the link, including
 *   middle-click and Ctrl/Cmd-click for a new tab, except over the remove button.
 *
 * Inside a popover trigger a token with neither `href` nor `clickable` renders as a button, so the popover
 * can bind to it. `disabled` dims the token and blocks every interaction (a disabled link loses its
 * `href`). `description` is exposed as the accessible description; `label-hidden` hides the text visually
 * and keeps it as the name. [mwg:accessible-web-components] [mwg:styling-web-components]
 *
 * @summary A compact chip for tags, filters and selected values, optionally clickable, linked or removable.
 * @tag tct-token
 * @upstream Token
 * @slot icon - An icon before the label.
 * @slot end - Content after the label and before the remove button (a count, a chevron).
 * @csspart base - The pill: the container that carries `data-color` and `data-size`.
 * @csspart label - The label text.
 * @csspart remove-button - The remove button.
 * @fires click - Native, retargeted from the label's button or link, or from the pill of a plain token.
 * @fires {TctRemoveEvent} tct-remove - The user pressed the remove button; cancelable, with the token's `value`.
 * @cloakDisplay inline-flex
 */
export class TctToken extends TctElement {
  static override readonly tagName = 'tct-token';
  static override readonly dependencies = [TctIcon];
  static override shadowRootOptions = {...TctElement.shadowRootOptions, delegatesFocus: true};
  static override styles: CSSResultGroup = [base, focusRing, slottedIcon, visuallyHidden, styles];

  /** The text of the token. */
  @property() label = '';

  /** Height: `sm`, `md` or `lg`. Unset takes the nearest size provider, else `md`. */
  @property({reflect: true}) size: TokenSize | undefined;

  /** Colour: `default` (the neutral chip) or one of ten tinted hues. */
  @property({reflect: true}) color: TokenColor = 'default';

  /** Dims the token and blocks every interaction. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** Makes the label a button: the token is pressed like one and the host fires `click`. */
  @property({type: Boolean, reflect: true}) clickable = false;

  /** Adds a remove button; pressing it fires `tct-remove`. */
  @property({type: Boolean, reflect: true}) removable = false;

  /** Makes the token a link to this destination. Blocked URL schemes render an anchor without `href`. */
  @property() href: string | undefined;

  /** Where to open the link (`_blank`, ...). `_blank` adds `rel="noopener noreferrer"`. */
  @property() target: string | undefined;

  /** Link relationship. */
  @property() rel: string | undefined;

  /** Accessible description of the token (`aria-describedby` on its interactive element). */
  @property() description = '';

  /** Hides the label visually; it stays the accessible name. */
  @property({type: Boolean, reflect: true, attribute: 'label-hidden'}) labelHidden = false;

  /** What the `tct-remove` event carries as `value`; default: the label. */
  @property() value = '';

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'token',
    defaults: tokenMessages,
  });
  readonly #size: SizeController<TokenSize> = new SizeController<TokenSize>(this, {
    explicit: () => (this.size ? oneOf(this.size, TOKEN_SIZES, 'md') : undefined),
    fallback: 'md',
  });
  readonly #ids: IdController = new IdController(this, 'tct-token');
  readonly #slots: SlotController = new SlotController(this, 'icon', 'end');
  readonly #interactive: ContextConsumer<typeof interactiveRoleContext> = new ContextConsumer<
    typeof interactiveRoleContext
  >(this, {context: interactiveRoleContext, subscribe: true});
  readonly #router: ContextConsumer<typeof linkContext> = new ContextConsumer<typeof linkContext>(
    this,
    {context: linkContext},
  );

  constructor() {
    super();
    // A linked, removable token is a container: a press anywhere but on the remove button follows the link
    // (modifier keys and middle-click included), like a card.
    new ClickableContainerController(this, {
      action: () => this.renderRoot.querySelector<HTMLAnchorElement>('a.action'),
      disabled: () => this.#form !== 'link-removable' || this.disabled,
    });
  }

  /** The inner element that takes focus and presses: the button or link inside the pill (or the link root). */
  get control(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.action') ?? null;
  }

  // ---------------------------------------------------------------------------------- derived

  get #hasHref(): boolean {
    return this.href !== undefined && this.href !== null && this.href !== '';
  }

  /**
   * What the token renders as (upstream `useInteractiveRole`): a link (alone, or beside its remove button),
   * a button (`clickable`, or asked for by an enclosing popover trigger), or plain text.
   */
  get #form(): 'plain' | 'button' | 'link' | 'link-removable' {
    if (this.#hasHref) return this.removable ? 'link-removable' : 'link';
    if (this.clickable || this.#interactive.value === true) return 'button';
    return 'plain';
  }

  get #resolvedSize(): TokenSize {
    return this.#size.value;
  }

  // ---------------------------------------------------------------------------------- lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('color') && !TOKEN_COLORS.includes(this.color)) {
      devWarn(
        `token:color:${this.color}`,
        `<tct-token color="${this.color}"> is not one of ${TOKEN_COLORS.join(', ')}; using "default".`,
      );
    }
    if (changed.has('size') && this.size && !TOKEN_SIZES.includes(this.size)) {
      devWarn(
        `token:size:${this.size}`,
        `<tct-token size="${this.size}"> is not one of ${TOKEN_SIZES.join(', ')}; using "md".`,
      );
    }
  }

  protected override updated(): void {
    // Only a linked, removable token is a pressable container for an enclosing clickable card.
    this.toggleAttribute(
      'data-pressable-container',
      this.#form === 'link-removable' && !this.disabled,
    );
  }

  // -------------------------------------------------------------------------------- rendering

  override render(): TemplateResult {
    const form = this.#form;
    const describedBy = this.description ? this.#ids.id('description') : undefined;
    const common = {
      'data-color': oneOf(this.color, TOKEN_COLORS, 'default'),
      'data-size': this.#resolvedSize,
    };
    const icon = this.#slots.has('icon')
      ? html`<span class="icon-slot"><slot name="icon"></slot></span>`
      : nothing;
    const end = this.#slots.has('end')
      ? html`<span class="end"><slot name="end"></slot></span>`
      : nothing;
    const label = html`<span class="label${this.labelHidden ? ' visually-hidden' : ''}" part="label"
      >${this.label}</span
    >`;
    const description = this.description
      ? html`<span class="visually-hidden" id=${describedBy!}>${this.description}</span>`
      : nothing;

    if (form === 'link') {
      const {href, target, rel} = this.#linkAttributes();
      return html`<a
          class="base action focus-ring interactive"
          part="base"
          data-color=${common['data-color']}
          data-size=${common['data-size']}
          ?data-disabled=${this.disabled}
          href=${ifDefined(this.disabled ? undefined : href)}
          target=${ifDefined(target)}
          rel=${ifDefined(rel)}
          aria-disabled=${ifDefined(this.disabled ? 'true' : undefined)}
          aria-describedby=${ifDefined(describedBy)}
          @click=${this.#onLinkClick}
          >${icon}${label}${end}</a
        >${description}`;
    }

    const remove = this.removable
      ? html`<button
          type="button"
          class="remove focus-ring"
          part="remove-button"
          aria-label=${this.#locale.t('remove', {label: this.label})}
          ?disabled=${this.disabled}
          @click=${this.#onRemove}
        >
          <tct-icon name="close" size="xsm" color="inherit"></tct-icon>
        </button>`
      : nothing;

    if (form === 'plain') {
      return html`<span
          class="base"
          part="base"
          data-color=${common['data-color']}
          data-size=${common['data-size']}
          ?data-disabled=${this.disabled}
          aria-describedby=${ifDefined(describedBy)}
          >${icon}${label}${end}${remove}</span
        >${description}`;
    }

    // A pressed container: the label is the real button (or link), the remove button its sibling.
    const action =
      form === 'button'
        ? html`<button
            type="button"
            class="action label-button"
            ?disabled=${this.disabled}
            aria-describedby=${ifDefined(describedBy)}
          >
            ${label}
          </button>`
        : (() => {
            const {href, target, rel} = this.#linkAttributes();
            return html`<a
              class="action label-button"
              href=${ifDefined(this.disabled ? undefined : href)}
              target=${ifDefined(target)}
              rel=${ifDefined(rel)}
              aria-disabled=${ifDefined(this.disabled ? 'true' : undefined)}
              aria-describedby=${ifDefined(describedBy)}
              @click=${this.#onLinkClick}
              >${label}</a
            >`;
          })();
    return html`<span
        class="base focus-within-ring interactive"
        part="base"
        data-color=${common['data-color']}
        data-size=${common['data-size']}
        ?data-disabled=${this.disabled}
        @click=${this.#onContainerClick}
        >${icon}${action}${end}${remove}</span
      >${description}`;
  }

  #linkAttributes(): {
    href: string | undefined;
    target: string | undefined;
    rel: string | undefined;
  } {
    const href = this.href ? (safeUrl(this.href, {allowData: true}) ?? undefined) : undefined;
    const {target, rel} = computeTargetAndRel(this.target || undefined, this.rel || undefined);
    return {href, target, rel};
  }

  // ---------------------------------------------------------------------------------- events

  /** A press on the container outside the label and the remove button presses the label. */
  readonly #onContainerClick = (event: MouseEvent): void => {
    if (this.disabled || this.#form !== 'button') return;
    const origin = event.composedPath()[0];
    if (origin instanceof Element && origin.closest('button, a')) return;
    // One click reaches the host: the one from the button (the container's own is swallowed).
    event.stopPropagation();
    this.renderRoot.querySelector<HTMLButtonElement>('button.action')?.click();
  };

  /** Hands an unmodified primary click on an internal link to the router (`linkContext`). */
  readonly #onLinkClick = (event: MouseEvent): void => {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const router = this.#router.value;
    const {href, target} = this.#linkAttributes();
    if (!router?.navigate || href === undefined) return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (target && target !== '_self') return;
    try {
      if (new URL(href, location.href).origin !== location.origin) return;
    } catch {
      return;
    }
    if (router.navigate(href, event)) event.preventDefault();
  };

  /** The remove button: no `click` reaches the host (it is not a press on the token), `tct-remove` fires. */
  readonly #onRemove = (event: MouseEvent): void => {
    event.stopPropagation();
    if (this.disabled) return;
    this.dispatch(new TctRemoveEvent(this.value || this.label));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-token': TctToken;
  }
}
