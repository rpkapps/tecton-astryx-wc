import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import mobileNavMessages from '@tecton-wc/locales/en/mobileNav.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {prefersReducedMotion} from '@tecton-wc/core/features.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {LayerController} from '@tecton-wc/core/layer/layer-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {AppShellMobileController} from '../app-shell/app-shell-mobile.context.js';
import {TctButton} from '../button/tct-button.js';
import {TctHeading} from '../heading/tct-heading.js';
import {pick} from '../layout/layout.types.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import motion from '../styles/motion.styles.css';
import {MOBILE_NAV_SIDES, type MobileNavSide} from './mobile-nav.types.js';
import styles from './tct-mobile-nav.styles.css';

/** Fallback duration (ms) of the exit animation when the token cannot be read. */
const EXIT_MS = 410;

const cssDuration = (element: Element, token: string, fallback: number): number => {
  const raw = getComputedStyle(element).getPropertyValue(token).trim();
  const ms = raw.endsWith('ms') ? Number.parseFloat(raw) : Number.parseFloat(raw) * 1000;
  return Number.isFinite(ms) && ms > 0 ? ms : fallback;
};

/**
 * A slide-out drawer for mobile navigation: the mobile counterpart of a side navigation. It slides in
 * from the start or end edge over a dimmed page, on the native `<dialog>` element with `showModal()`, so
 * it sits in the top layer with no z-index, makes the page behind it inert, locks page scroll and traps
 * focus without any focus-trap code. It accepts the same content as a side navigation (any content).
 *
 * `open` is the state. Escape, a press on the dimmed area, the close button and `requestClose()` ask to
 * close it with a cancelable `tct-open-change` (`reason`: `escape`, `outside`, `close-button`,
 * `close-watcher`, `request`) and close it unless you prevent the event; writing `open` never emits it.
 * `tct-after-open-change` fires once the change settled, after the animation. Inside a `tct-app-shell`
 * the drawer follows the shell's mobile navigation state unless you give it an `open` of your own; used
 * on its own, control it with `open`. When it closes, focus returns to the element that opened it (the
 * toggle).
 *
 * `header` is a plain-text title (a `tct-heading`, level 2) shown next to the close button; slot a
 * `header` element for richer content. `label` names the dialog (default: the header text, then
 * "Navigation"). `width` is the drawer width in px (default 320, never wider than the viewport). `side`
 * is `start`, `end` or `auto` (the side of the trigger that opened it, else `end`); both edges are
 * logical, so `start` is the right edge in RTL.
 *
 * @summary Slide-out modal drawer for mobile navigation, with focus return.
 * @tag tct-mobile-nav
 * @upstream MobileNav
 * @slot - The navigation content.
 * @slot header - Header content next to the close button, instead of the `header` text.
 * @csspart dialog - The full-viewport `<dialog>` that carries the backdrop.
 * @csspart drawer - The sliding panel: background, border, width and the header and content inside.
 * @cssstate open - The drawer is open.
 * @fires tct-open-change - The user or a close request asks to open or close it; cancelable, carries `open` and `reason`.
 * @fires tct-after-open-change - The change settled (after the animation); carries `open`.
 * @cloakDisplay contents
 */
export class TctMobileNav extends TctElement {
  static override readonly tagName = 'tct-mobile-nav';
  static override readonly dependencies = [TctButton, TctHeading];
  static override styles: CSSResultGroup = [base, focusRing, motion, styles];

  /**
   * Whether the drawer is open. Unset (the default), a drawer inside an app shell follows the shell's
   * mobile navigation state; once written (`true` or `false`) it is yours. Setting the attribute opens it initially.
   */
  @property({type: Boolean, reflect: true}) open: boolean | undefined;

  /** A plain-text title next to the close button (a level 2 heading); slot `header` for richer content. */
  @property() header = '';

  /** Drawer width in px (the drawer is never wider than the viewport). Default 320. */
  @property({type: Number}) width = 320;

  /** The edge it slides in from: `start`, `end` or `auto` (default: the side of the trigger, else `end`). */
  @property({reflect: true}) side: MobileNavSide = 'auto';

  /** Accessible name of the dialog. Defaults to the header text, then "Navigation" in the language of the page. */
  @property() label = '';

  /** Accessible name and tooltip of the close button. Defaults to "Close navigation". */
  @property({attribute: 'close-label'}) closeLabel = '';

  readonly #slots = new SlotController(this, 'header');
  readonly #shell = new AppShellMobileController(this);
  readonly #locale = new LocaleController(this, {
    namespace: 'mobileNav',
    defaults: mobileNavMessages,
  });
  #resolvedSide: 'start' | 'end' = 'end';
  #transition: Promise<void> = Promise.resolve();
  #lastAfter: boolean | undefined;
  #opened = false;

  readonly #layer: LayerController = new LayerController(this, {
    kind: 'modal',
    surface: () => this.#dialog,
    // Focus returns to whatever had it when the drawer opened (the toggle).
    initialFocus: () => this.#drawer,
    exitAnimation: () => this.#exitAnimations(),
    onDismissRequest: (reason) => {
      this.#requestChange(false, reason);
    },
    onNativeClose: () => {
      // Closed from outside (a form with method=dialog, close()): the state follows the surface.
      this.#apply(false);
      this.#announce(false);
    },
  });

  get #dialog(): HTMLDialogElement | null {
    return this.renderRoot?.querySelector<HTMLDialogElement>('dialog.dialog') ?? null;
  }

  get #drawer(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.drawer') ?? null;
  }

  /** Whether the drawer is open: its own `open`, else the enclosing shell's state. */
  get isOpen(): boolean {
    return this.open ?? this.#shell.value.isMobileNavOpen;
  }

  /** Opens the drawer without a `tct-open-change` (programmatic). Resolves when the change settled. */
  async show(): Promise<void> {
    this.open = true;
    await this.updateComplete;
    await this.#transition;
  }

  /** Closes the drawer without a `tct-open-change` (programmatic). Resolves when the change settled. */
  async hide(): Promise<void> {
    this.open = false;
    await this.updateComplete;
    await this.#transition;
  }

  /** Asks to close as the user would: a cancelable `tct-open-change` (reason `request` unless given). */
  requestClose(reason: ChangeReason = 'request'): void {
    this.#requestChange(false, reason);
  }

  // ------------------------------------------------------------------------------ behaviour

  protected override updated(): void {
    this.toggleState('open', this.isOpen);
    this.#follow();
  }

  /** Follows the state: shows or hides the layer. */
  #follow(): void {
    const open = this.isOpen;
    if (open && !this.#layer.isOpen) {
      this.#opened = true;
      this.#resolveSide();
      this.#transition = this.#layer.show().then(() => {
        if (this.isOpen) this.#announce(true);
      });
    } else if (!open && this.#layer.isOpen) {
      this.#transition = this.#layer.hide().then(() => {
        if (!this.isOpen) this.#announce(false);
      });
    } else if (!open) {
      this.#announce(false);
    }
  }

  /**
   * The edge to slide from. `auto` reads the trigger that has focus right now (before the modal takes
   * it): the start half of the viewport slides from the start edge, the other half from the end edge.
   */
  #resolveSide(): void {
    const side = pick(MOBILE_NAV_SIDES, this.side, 'auto', 'side');
    let resolved: 'start' | 'end' = side === 'auto' ? 'end' : side;
    if (side === 'auto') {
      const trigger = deepActiveElement();
      if (trigger && trigger !== document.body && trigger !== this) {
        const rect = trigger.getBoundingClientRect();
        const centre = rect.left + rect.width / 2;
        const start = getComputedStyle(this).direction === 'rtl' ? innerWidth - centre : centre;
        resolved = start < innerWidth / 2 ? 'start' : 'end';
      }
    }
    this.#resolvedSide = resolved;
    // Before the show, so the entry animation runs from the right edge; the render agrees.
    this.#drawer?.setAttribute('data-side', resolved);
    this.#dialog?.setAttribute('data-side', resolved);
    this.requestUpdate();
  }

  /** The user (or a close request) asks for a change; the owner may veto with `preventDefault()`. */
  #requestChange(open: boolean, reason: ChangeReason): void {
    if (open === this.isOpen) return;
    if (this.dispatch(new TctOpenChangeEvent(open, reason))) this.#apply(open);
  }

  /** Applies a change: to the drawer's own state if it has one, else to the shell's. */
  #apply(open: boolean): void {
    if (this.open !== undefined) {
      this.open = open;
      return;
    }
    const shell = this.#shell.value;
    if (open) shell.openMobileNav();
    else shell.closeMobileNav();
  }

  /** `tct-after-open-change` once per actual settled change, programmatic ones included. */
  #announce(open: boolean): void {
    if (this.#lastAfter === undefined && !open && !this.#opened) {
      this.#lastAfter = false; // The initial closed state is not a change.
      return;
    }
    if (this.#lastAfter === open) return;
    this.#lastAfter = open;
    this.dispatch(new TctAfterOpenChangeEvent(open));
  }

  /** Exit: the drawer slides back out (a fade under reduced motion) and the backdrop fades. */
  #exitAnimations(): Animation[] {
    const drawer = this.#drawer;
    const dialog = this.#dialog;
    if (!drawer || !dialog) return [];
    const duration = cssDuration(drawer, '--duration-medium', EXIT_MS);
    const still = prefersReducedMotion();
    const sign =
      (this.#resolvedSide === 'start' ? -1 : 1) *
      (getComputedStyle(this).direction === 'rtl' ? -1 : 1);
    const animations = [
      drawer.animate(
        still
          ? [{opacity: 1}, {opacity: 0}]
          : [
              {translate: '0 0', opacity: 1},
              {translate: `${sign * 100}% 0`, opacity: 1},
            ],
        {duration: still ? duration / 2 : duration, easing: 'cubic-bezier(0.24, 1, 0.4, 1)'},
      ),
    ];
    try {
      animations.push(
        dialog.animate([{opacity: 1}, {opacity: 0}], {
          duration: still ? duration / 2 : duration,
          pseudoElement: '::backdrop',
        }),
      );
    } catch {
      // Engines that cannot animate the backdrop simply drop it when the dialog closes.
    }
    return animations;
  }

  // ---------------------------------------------------------------------------------- events

  /** A press on the dimmed area (the dialog itself, not the drawer or its content) closes the drawer. */
  readonly #onDialogClick = (event: MouseEvent): void => {
    if (event.target === event.currentTarget) this.#requestChange(false, 'outside');
  };

  readonly #onClose = (): void => {
    this.#requestChange(false, 'close-button');
  };

  // ----------------------------------------------------------------------------------- render

  override render(): TemplateResult {
    const label = this.label || this.header || this.#locale.t('navigation');
    const side = this.#resolvedSide;
    const closeLabel = this.closeLabel || this.#locale.t('closeNavigation');
    return html`<dialog
      class="dialog"
      part="dialog"
      aria-label=${label}
      data-side=${side}
      style=${`--_width: ${String(Number.isFinite(this.width) ? this.width : 320)}px`}
      @click=${this.#onDialogClick}
    >
      <div class="drawer" part="drawer" tabindex="-1" data-side=${side}>
        <div class="header" ?data-no-title=${!this.header && !this.#slots.has('header')}>
          ${
            this.#slots.has('header')
              ? html`<slot name="header"></slot>`
              : this.header
                ? html`<tct-heading class="title" level="2">${this.header}</tct-heading>`
                : nothing
          }
          <tct-button
            class="close"
            variant="ghost"
            icon="close"
            icon-only
            label=${closeLabel}
            @click=${this.#onClose}
          ></tct-button>
        </div>
        <div class="content"><slot></slot></div>
      </div>
    </dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-mobile-nav': TctMobileNav;
  }
}
