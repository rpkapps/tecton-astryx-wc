import {
  html,
  nothing,
  unsafeCSS,
  type CSSResult,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import {property} from 'lit/decorators.js';
import english from '@tecton-wc/locales/en/banner.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctDismissEvent} from '@tecton-wc/core/events/tct-dismiss.js';
import {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {adoptLightDomStyles} from '@tecton-wc/core/styles/light-dom.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {IdController} from '@tecton-wc/core/utils/id.js';
import {TctButton} from '../button/tct-button.js';
import {CollapsibleController} from '../collapsible/collapsible.controller.js';
import {TctIcon} from '../icon/tct-icon.js';
import base from '../styles/base.styles.css';
import motion from '../styles/motion.styles.css';
import styles from './tct-banner.styles.css';
import lightStyles from './tct-banner.light.css?inline';
import {
  BANNER_CONTAINERS,
  BANNER_ELEVATIONS,
  BANNER_STATUSES,
  type BannerContainer,
  type BannerElevation,
  type BannerStatus,
} from './banner.types.js';

/** The registered icon behind each status (`tct-icon name`). */
const STATUS_ICONS: Record<BannerStatus, string> = {
  info: 'info',
  warning: 'warning',
  error: 'error',
  success: 'success',
  neutral: 'info',
};

/** Warnings and errors interrupt (`alert`); the rest are announced politely (`status`). */
const ASSERTIVE = new Set<BannerStatus>(['warning', 'error']);

/**
 * A persistent status message for info, warning, error, success or neutral news, with an optional
 * description, actions, a dismiss control and supplementary content behind an expand toggle.
 *
 * The header carries the message on a status-coloured fill (icon, `heading`, `description`, the `end`
 * actions, the toggle and the dismiss button). Child content sits in a card-coloured area below, collapsed
 * behind a toggle unless `no-collapse` is set. Errors and warnings are `role="alert"`, the others
 * `role="status"`. Dismissing hides the banner and, if focus was inside it, returns focus to where it came
 * from, so a keyboard user never loses their place.
 *
 * @summary A persistent status banner with icon, message, actions, dismiss and collapsible content.
 * @tag tct-banner
 * @upstream Banner
 * @slot - Supplementary content shown in the card area (behind the toggle unless `no-collapse`).
 * @slot heading - The heading as rich content (replaces the `heading` text).
 * @slot description - The description as rich content (replaces the `description` text).
 * @slot icon - A custom icon replacing the status icon.
 * @slot end - Actions at the inline end of the header (typically ghost buttons).
 * @csspart frame - The outer box that carries the elevation.
 * @csspart header - The status-coloured header.
 * @csspart icon - The status icon.
 * @csspart description - The description.
 * @csspart content - The card-coloured content area.
 * @fires tct-dismiss - The user pressed dismiss; cancelable. The banner hides unless prevented.
 * @fires tct-open-change - A user expanded or collapsed the content; cancelable.
 * @fires tct-after-open-change - The content state changed, for any reason.
 * @cssstate open - The content is showing.
 * @cloakDisplay block
 */
export class TctBanner extends TctElement {
  static override readonly tagName = 'tct-banner';
  static override readonly dependencies = [TctButton, TctIcon];
  static override styles: CSSResultGroup = [base, motion, styles];

  /** Status: `info`, `warning`, `error`, `success` or `neutral`. Sets the fill, the icon and the announcement role. */
  @property({reflect: true}) status: BannerStatus = 'info';

  /** Heading text. Use `slot="heading"` for rich content. */
  @property() heading = '';

  /** Optional description under the heading. Use `slot="description"` for rich content. */
  @property() description = '';

  /** Registered icon name replacing the status icon (or slot your own into `icon`). */
  @property() icon = '';

  /** Shows a dismiss button. Dismissing hides the banner even without a listener. */
  @property({type: Boolean, reflect: true}) dismissable = false;

  /** Accessible name and tooltip of the dismiss button, replacing the default ("Dismiss {heading}"). */
  @property({attribute: 'dismiss-label'}) dismissLabel = '';

  /** `card` is a standalone rounded card; `section` is a full-width band with square corners. */
  @property({reflect: true}) container: BannerContainer = 'card';

  /** Resting shadow depth for a banner that floats above content. */
  @property({reflect: true}) elevation: BannerElevation = 'none';

  /**
   * Pins the content open: no toggle, no `aria-expanded`. Without it a banner with content starts
   * collapsed behind a toggle in the header.
   */
  @property({type: Boolean, attribute: 'no-collapse', reflect: true}) noCollapse = false;

  /** Whether the content is showing (initial and current state). Ignored with `no-collapse`. */
  @property({type: Boolean, reflect: true}) open = false;

  readonly #ids: IdController = new IdController(this, 'tct-banner');
  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'banner',
    defaults: english,
  });
  readonly #slots: SlotController = new SlotController(
    this,
    'default',
    'heading',
    'description',
    'icon',
    'end',
  );
  readonly #disclosure: CollapsibleController = new CollapsibleController(this, {
    open: () => this.open,
    setOpen: (open) => {
      this.open = open;
    },
    requestChange: (open) => this.dispatch(new TctOpenChangeEvent(open, 'trigger')),
  });
  static #lightSheet: CSSResult | undefined;
  #focusOrigin: HTMLElement | null = null;
  #lastOpen: boolean | undefined;

  constructor() {
    super();
    // Focus came from somewhere before it entered the banner: remember it for the dismiss hand-off.
    this.addEventListener('focusin', (event) => {
      this.#remember(event.relatedTarget);
    });
    this.addEventListener(
      'pointerdown',
      () => {
        this.#remember(document.activeElement);
      },
      {capture: true},
    );
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Slotted links are light DOM: their sheet goes to the root that contains the banner (A§6.7).
    adoptLightDomStyles(this, (TctBanner.#lightSheet ??= unsafeCSS(lightStyles)));
  }

  #remember(candidate: EventTarget | null): void {
    if (
      candidate instanceof HTMLElement &&
      candidate !== document.body &&
      !this.contains(candidate)
    ) {
      this.#focusOrigin = candidate;
    }
  }

  get #hasContent(): boolean {
    return this.#slots.has('default');
  }

  get #isCollapsible(): boolean {
    return !this.noCollapse && this.#hasContent;
  }

  get #expanded(): boolean {
    return this.#disclosure.isOpen;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('status')) {
      if (!BANNER_STATUSES.includes(this.status)) {
        devWarn(
          'banner:status',
          `<tct-banner status="${this.status}"> is not one of ${BANNER_STATUSES.join(', ')}; using "info".`,
        );
      }
    }
    const status = BANNER_STATUSES.includes(this.status) ? this.status : 'info';
    // The announcement role is a default on ElementInternals, so a host `role` attribute can still win.
    this.internals.role = ASSERTIVE.has(status) ? 'alert' : 'status';
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    const open = this.#isCollapsible ? this.#expanded : this.#hasContent;
    this.toggleState('open', open);
    if (this.#lastOpen !== undefined && this.#lastOpen !== open && this.#isCollapsible) {
      this.dispatch(new TctAfterOpenChangeEvent(open));
    }
    this.#lastOpen = open;
  }

  #toggle = (event: Event): void => {
    this.#disclosure.toggle(event);
  };

  #dismiss = (event: Event): void => {
    if (!this.dispatch(new TctDismissEvent('close-button'))) return;
    const origin = this.#focusOrigin;
    const hadFocus = this.matches(':focus-within') || event.composedPath().includes(this);
    // Move focus before the banner disappears, so the browser never has a frame with a vanished node.
    if (hadFocus && origin?.isConnected) origin.focus();
    this.hidden = true;
  };

  #dismissName(): string {
    if (this.dismissLabel) return this.dismissLabel;
    const dismiss = this.#locale.t('dismiss');
    return this.heading ? this.#locale.t('dismissTitled', {dismiss, title: this.heading}) : dismiss;
  }

  #icon(status: BannerStatus): TemplateResult {
    if (this.#slots.has('icon')) return html`<slot name="icon"></slot>`;
    return html`<tct-icon
      class="status-icon"
      part="icon"
      name=${this.icon || STATUS_ICONS[status]}
      size="md"
    ></tct-icon>`;
  }

  override render() {
    const status = BANNER_STATUSES.includes(this.status) ? this.status : 'info';
    const container = BANNER_CONTAINERS.includes(this.container) ? this.container : 'card';
    const elevation = BANNER_ELEVATIONS.includes(this.elevation) ? this.elevation : 'none';
    const hasToggle = this.#isCollapsible;
    const expanded = this.#expanded;
    const showContent = this.#hasContent && (!hasToggle || expanded);
    const hasHeading = this.heading !== '' || this.#slots.has('heading');
    const hasDescription = this.description !== '' || this.#slots.has('description');
    const hasEnd = this.#slots.has('end');
    const hasActions = hasEnd || this.dismissable;
    const showEnd = hasActions || hasToggle;
    const contentId = this.#ids.id('content');
    const expandLabel = this.#locale.t(expanded ? 'collapse' : 'expand');
    const dismissName = this.#dismissName();
    return html`<div
      class="frame"
      part="frame"
      data-container=${container}
      data-elevation=${elevation}
    >
      <div
        class="header"
        part="header"
        data-status=${status}
        data-container=${container}
        data-with-content=${showContent ? '' : nothing}
        data-centered=${!hasDescription && hasActions ? '' : nothing}
      >
        <div class="icon-wrapper" aria-hidden="true">${this.#icon(status)}</div>
        <div class="text" data-with-end=${hasEnd ? '' : nothing}>
          ${
            hasHeading
              ? html`<div class="heading"><slot name="heading">${this.heading}</slot></div>`
              : nothing
          }
          ${
            hasDescription
              ? html`<div class="description" part="description">
                  <slot name="description">${this.description}</slot>
                </div>`
              : nothing
          }
        </div>
        ${
          showEnd
            ? html`<div class="end">
                <slot name="end"></slot>
                ${
                  hasToggle
                    ? html`<tct-button
                        variant="ghost"
                        size="sm"
                        icon-only
                        icon="chevronDown"
                        label=${expandLabel}
                        tooltip=${expandLabel}
                        aria-expanded=${expanded ? 'true' : 'false'}
                        aria-controls=${showContent ? contentId : nothing}
                        data-expanded=${expanded ? '' : nothing}
                        class="toggle"
                        @click=${this.#toggle}
                      ></tct-button>`
                    : nothing
                }
                ${
                  this.dismissable
                    ? html`<tct-button
                        variant="ghost"
                        size="sm"
                        icon-only
                        icon="close"
                        label=${dismissName}
                        tooltip=${this.dismissLabel || this.#locale.t('dismiss')}
                        @click=${this.#dismiss}
                      ></tct-button>`
                    : nothing
                }
              </div>`
            : nothing
        }
      </div>
      ${
        showContent
          ? html`<div
              class="content"
              part="content"
              id=${hasToggle ? contentId : nothing}
              data-container=${container}
            >
              <slot></slot>
            </div>`
          : nothing
      }
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-banner': TctBanner;
  }
}
