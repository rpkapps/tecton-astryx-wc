import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import appShellMessages from '@tecton-wc/locales/en/appShell.js';
import {themeContext} from '@tecton-wc/core/context/keys.js';
import {ContextConsumer, ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {ResizeController} from '@tecton-wc/core/controllers/resize.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {SPACING_STEPS, type SpacingStep} from '@tecton-wc/core/mixins/box-props.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {DEFAULT_WIDTH_BREAKPOINTS} from '@tecton-wc/core/theme/theme-adaptations.js';
import {getRegisteredTheme} from '@tecton-wc/core/theme/theme-registry.js';
import {TctLayout} from '../layout/tct-layout.js';
import {TctLayoutContent} from '../layout/tct-layout-content.js';
import {TctLayoutHeader} from '../layout/tct-layout-header.js';
import {TctLayoutPanel} from '../layout/tct-layout-panel.js';
import {LAYOUT_HEIGHTS, pick, type LayoutHeight} from '../layout/layout.types.js';
import {TctMobileNav} from '../mobile-nav/tct-mobile-nav.js';
import {TctMobileNavToggle} from '../mobile-nav/tct-mobile-nav-toggle.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {
  appShellMobileContext,
  INERT_APP_SHELL_MOBILE,
  type AppShellMobileContextValue,
  type SideNavPlacement,
} from './app-shell-mobile.context.js';
import {
  APP_SHELL_BREAKPOINTS,
  APP_SHELL_MAIN_ID,
  APP_SHELL_VARIANTS,
  type AppShellBreakpoint,
  type AppShellVariant,
} from './app-shell.types.js';
import styles from './tct-app-shell.styles.css';

/**
 * The page shell of an application: the structural frame for a top navigation, a side navigation, a
 * banner and the main content, with a skip link, the landmarks, two height modes and the mobile
 * navigation. It composes a `tct-layout` (header, start panel, main content) and, below the mobile
 * breakpoint, a `tct-mobile-nav` drawer.
 *
 * Fill the slots: `top-nav`, `side-nav`, `banner` (system-wide announcements, above the top navigation)
 * and the default slot (the main content, rendered as the page's `main` landmark). The first Tab stop is a
 * skip link ("Skip to content") that moves focus to the main region. The header (banner and top
 * navigation) is a `banner` landmark. `content-padding` pads the main region (default 0: edge to edge;
 * use `4` for forms and text pages).
 *
 * `height="fill"` (default) makes the shell as tall as the viewport with the main region scrolling inside;
 * `height="auto"` grows with the content and the page scrolls, with the header and the side navigation
 * sticky. `variant` chooses how the navigation contrasts with the content (see `variant`).
 *
 * Below the mobile breakpoint (`mobile-nav-breakpoint`, default `md` = 768 px; the shell is not mobile at
 * exactly the breakpoint) the inline side navigation moves into a modal drawer that opens from a toggle
 * and returns focus to it when it closes. A side-navigation-only shell gets a top bar with the toggle; a
 * shell with a top navigation expects the top navigation to place the toggle. A `tct-mobile-nav` in the
 * `mobile-nav` slot replaces the automatic drawer; `no-mobile-nav` switches mobile navigation off.
 * Everything inside the shell reads the mobile state through `AppShellMobileContext`, which is how
 * `tct-mobile-nav-toggle`, `tct-mobile-nav`, `tct-side-nav` and `tct-top-nav` adapt.
 *
 * The drawer state is `mobile-nav-open`. The user's actions raise a cancelable `tct-open-change` (from
 * the toggle or from the drawer) that bubbles through the shell; prevent it and set the state yourself
 * to control the drawer.
 *
 * @summary Application page shell with top and side navigation, skip link, main landmark and mobile drawer.
 * @tag tct-app-shell
 * @upstream AppShell
 * @slot - The main content (the `main` landmark).
 * @slot top-nav - The top navigation, in the header.
 * @slot side-nav - The side navigation: an inline panel above the breakpoint, the drawer content below it.
 * @slot banner - A system-wide announcement above the top navigation; it scrolls away with the page in auto mode.
 * @slot mobile-nav - A `tct-mobile-nav` of your own, replacing the automatic drawer.
 * @slot drawer - Extra content at the top of the automatic drawer, above the side navigation.
 * @slot mobile-bar - Content of the mobile top bar next to the toggle (a side-navigation-only shell, below the breakpoint).
 * @csspart base - The shell box: the background of the variant and the height.
 * @csspart header - The header region: banner and top navigation.
 * @csspart sidenav - The side navigation panel box.
 * @csspart skip-link - The skip link while it is visible (focused).
 * @cssprop --app-shell-height - Height of the shell in place of the viewport height (default 100dvh): for a shell inside a bounded frame, such as a preview or a docs example.
 * @cssprop --layout-padding-outer-x - Reset to zero for the layout inside the shell: the regions manage their own padding.
 * @cssstate mobile - The viewport is below the mobile breakpoint.
 * @cssstate mobile-nav-open - The mobile drawer is open.
 * @fires tct-open-change - Raised by the toggle or the drawer when the user asks to open or close the mobile drawer; cancelable, carries `open` and `reason`.
 * @cloakDisplay block
 */
export class TctAppShell extends TctElement {
  static override readonly tagName = 'tct-app-shell';
  static override readonly dependencies = [
    TctLayout,
    TctLayoutHeader,
    TctLayoutPanel,
    TctLayoutContent,
    TctMobileNav,
    TctMobileNavToggle,
  ];
  static override styles: CSSResultGroup = [base, focusRing, visuallyHidden, styles];

  /**
   * How the navigation areas contrast with the content: `elevated` (default: a wash frame around an
   * elevated content surface with a rounded corner), `wash`, `surface`, or `section` (dividers).
   */
  @property({reflect: true}) variant: AppShellVariant = 'elevated';

  /**
   * `fill` (default): the shell is as tall as the viewport and the main region scrolls inside. `auto`:
   * it grows with its content, the page scrolls as a whole, and the header and side navigation are sticky.
   */
  @property({reflect: true}) height: LayoutHeight = 'fill';

  /**
   * Padding of the main region, a spacing-scale step (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10). Default 0:
   * edge to edge (dashboards, maps, tables); use 4 for forms and text pages.
   */
  @property({type: Number, attribute: 'content-padding'}) contentPadding: SpacingStep = 0;

  /** Switches mobile navigation off: no drawer, no toggle, and the side navigation is hidden below the breakpoint. */
  @property({type: Boolean, attribute: 'no-mobile-nav'}) noMobileNav = false;

  /** Whether the shell places no toggle of its own: put a `tct-mobile-nav-toggle` where you want it. */
  @property({type: Boolean, attribute: 'no-mobile-toggle'}) noMobileToggle = false;

  /**
   * The named width below which the mobile navigation activates: `sm`, `md` (default), `lg`, `xl` or
   * `2xl` (the values of the nearest theme, else 640, 768, 1024, 1280, 1536 px), or `none` to never
   * switch. The edge belongs to the wider layout.
   */
  @property({attribute: 'mobile-nav-breakpoint'}) mobileNavBreakpoint: AppShellBreakpoint = 'md';

  /** Whether the mobile drawer is open. The attribute is the initial state; user actions ask through `tct-open-change`. */
  @property({type: Boolean, reflect: true, attribute: 'mobile-nav-open'}) mobileNavOpen = false;

  /**
   * A hint that the first render should assume the mobile layout, for a server-rendered or prerendered
   * page where the viewport is unknown. In a browser the shell reads the real viewport before it renders
   * and the hint has no effect. Ignored when the breakpoint is `none`.
   */
  @property({type: Boolean, attribute: 'default-is-mobile'}) defaultIsMobile = false;

  /**
   * For a shell inside a page that already has a `banner` and a `main` landmark (a preview, an embedded
   * app, a documentation example): the header and the main region get no landmark role, so the page does
   * not end up with two of each. The skip link and the layout are unchanged.
   */
  @property({type: Boolean, attribute: 'no-landmarks'}) noLandmarks = false;

  readonly #slots = new SlotController(
    this,
    'top-nav',
    'side-nav',
    'banner',
    'mobile-nav',
    'drawer',
    'mobile-bar',
  );
  readonly #provider = new ContextProvider(this, {
    context: appShellMobileContext,
    initialValue: INERT_APP_SHELL_MOBILE,
  });
  readonly #theme = new ContextConsumer(this, {
    context: themeContext,
    subscribe: true,
    callback: () => {
      this.#watchViewport();
    },
  });
  readonly #locale = new LocaleController(this, {
    namespace: 'appShell',
    defaults: appShellMessages,
  });
  #query: MediaQueryList | undefined;
  #watching: string | undefined;
  #mobile = false;
  #value: AppShellMobileContextValue | undefined;

  constructor() {
    super();
    // In auto mode the sticky side navigation sits below the header: follow the header's height.
    new ResizeController(this, {
      target: () =>
        this.height === 'auto' ? this.renderRoot.querySelector<HTMLElement>('.header') : null,
      callback: () => {
        this.#measureHeader();
      },
    });
  }

  /** Whether the viewport is below the mobile breakpoint right now. */
  get isMobile(): boolean {
    return this.#mobile;
  }

  /** The pixel width below which the shell is mobile, or `undefined` for `none`. */
  get mobileBreakpointPx(): number | undefined {
    const name = pick(
      APP_SHELL_BREAKPOINTS,
      this.mobileNavBreakpoint,
      'md',
      'mobile-nav-breakpoint',
    );
    if (name === 'none') return undefined;
    const theme = getRegisteredTheme(this.#theme.value?.name);
    return theme?.__adaptations?.widthBreakpoints[name] ?? DEFAULT_WIDTH_BREAKPOINTS[name];
  }

  /** Opens the mobile drawer without an event (programmatic); nothing happens without mobile navigation. */
  openMobileNav(): void {
    if (this.#value?.isMobileNavEnabled) this.mobileNavOpen = true;
  }

  /** Closes the mobile drawer without an event (programmatic). */
  closeMobileNav(): void {
    this.mobileNavOpen = false;
  }

  /** Focuses the main region, as the skip link does. */
  focusMain(options?: FocusOptions): void {
    this.renderRoot.querySelector<TctLayoutContent>(`#${APP_SHELL_MAIN_ID}`)?.focus(options);
  }

  // ------------------------------------------------------------------------------- lifecycle

  override connectedCallback(): void {
    super.connectedCallback();
    // Read the viewport before the first render, so a mobile page never flashes the desktop layout.
    this.#watchViewport();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#query?.removeEventListener('change', this.#onViewportChange);
    this.#query = undefined;
    this.#watching = undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('mobileNavBreakpoint')) this.#watchViewport();
    this.#publish();
  }

  protected override updated(): void {
    this.toggleState('mobile', this.#mobile);
    this.toggleState('mobile-nav-open', this.mobileNavOpen);
    this.#measureHeader();
  }

  // ---------------------------------------------------------------------------- viewport state

  readonly #onViewportChange = (): void => {
    this.#syncMobile();
  };

  /** (Re)binds the media query for the current breakpoint. */
  #watchViewport(): void {
    const px = this.mobileBreakpointPx;
    const query = px === undefined ? undefined : `(width < ${String(px)}px)`;
    if (query === this.#watching && this.#query) {
      this.#syncMobile();
      return;
    }
    this.#query?.removeEventListener('change', this.#onViewportChange);
    this.#query = undefined;
    this.#watching = query;
    if (query && typeof matchMedia === 'function') {
      this.#query = matchMedia(query);
      this.#query.addEventListener('change', this.#onViewportChange);
    }
    this.#syncMobile();
  }

  #syncMobile(): void {
    // Without a window (a server), the hint stands in; `none` is never mobile.
    const next =
      this.#watching === undefined
        ? false
        : this.#query
          ? this.#query.matches
          : this.defaultIsMobile;
    if (next === this.#mobile) return;
    this.#mobile = next;
    this.requestUpdate();
  }

  /** Publishes the mobile state to everything inside the shell. */
  #publish(): void {
    const hasSideNav = this.#slots.has('side-nav');
    const hasTopNav = this.#slots.has('top-nav');
    const customDrawer = this.#slots.has('mobile-nav');
    const enabled =
      !this.noMobileNav && (hasSideNav || hasTopNav || customDrawer || this.#slots.has('drawer'));
    const placement: SideNavPlacement = !hasSideNav
      ? 'none'
      : !this.#mobile
        ? 'inline'
        : enabled && !customDrawer
          ? 'drawer'
          : 'none';
    const previous = this.#value;
    const open = this.mobileNavOpen;
    const unchanged =
      previous?.isMobile === this.#mobile &&
      previous.isMobileNavOpen === open &&
      previous.isMobileNavEnabled === enabled &&
      previous.hasAutoToggle === !this.noMobileToggle &&
      previous.hasTopNav === hasTopNav &&
      previous.hasSideNav === hasSideNav &&
      previous.sideNavPlacement === placement;
    if (unchanged) return;
    const value: AppShellMobileContextValue = {
      isMobile: this.#mobile,
      isMobileNavOpen: open,
      mobileNavId: undefined,
      toggleMobileNav: () => {
        if (this.#value?.isMobileNavEnabled) this.mobileNavOpen = !this.mobileNavOpen;
      },
      openMobileNav: () => {
        this.openMobileNav();
      },
      closeMobileNav: () => {
        this.closeMobileNav();
      },
      isMobileNavEnabled: enabled,
      hasAutoToggle: !this.noMobileToggle,
      hasTopNav,
      hasSideNav,
      sideNavPlacement: placement,
    };
    this.#value = value;
    this.#provider.setValue(value);
  }

  /** The sticky side navigation of auto mode sits below the header: publish the header's height. */
  #measureHeader(): void {
    const shell = this.renderRoot?.querySelector<HTMLElement>('.shell');
    if (!shell) return;
    const header = this.renderRoot.querySelector<HTMLElement>('.header');
    if (this.height === 'auto' && header) {
      shell.style.setProperty('--_header-height', `${header.getBoundingClientRect().height}px`);
    } else {
      shell.style.removeProperty('--_header-height');
    }
  }

  // -------------------------------------------------------------------------------------- input

  /**
   * The skip link's target lives in the shadow root, where fragment navigation cannot reach (and axe
   * cannot resolve a `#id`), so its `href` is a bare `#` and the shell moves focus itself: the main
   * region is focusable by script, never a tab stop.
   */
  readonly #onSkip = (event: MouseEvent): void => {
    event.preventDefault();
    this.focusMain();
  };

  // ------------------------------------------------------------------------------------- render

  override render(): TemplateResult {
    const variant = pick(APP_SHELL_VARIANTS, this.variant, 'elevated', 'variant');
    const height = pick(LAYOUT_HEIGHTS, this.height, 'fill', 'height');
    const auto = height === 'auto';
    const mobile = this.#mobile;
    const hasBanner = this.#slots.has('banner');
    const hasTopNav = this.#slots.has('top-nav');
    const hasSideNav = this.#slots.has('side-nav');
    const customDrawer = this.#slots.has('mobile-nav');
    const value = this.#value;
    const enabled = value?.isMobileNavEnabled === true;
    const dividers = variant === 'section';
    // Nav areas: a wash frame (wash, elevated), a surface, or the shell's own surface (section).
    const navBackground: 'wash' | 'surface' | undefined =
      variant === 'wash' || variant === 'elevated'
        ? 'wash'
        : variant === 'surface'
          ? 'surface'
          : undefined;
    const headerBackground =
      navBackground ?? (auto && variant === 'section' ? 'surface' : undefined);
    const stickyBackground = navBackground ?? 'surface';
    const inlineSideNav = hasSideNav && !mobile;
    const contentBackground =
      variant === 'wash'
        ? 'wash'
        : variant === 'elevated' && hasTopNav && hasSideNav && !mobile
          ? 'transparent'
          : variant === 'surface' || variant === 'elevated'
            ? 'surface'
            : undefined;
    const elevate = variant === 'elevated' && hasTopNav && inlineSideNav;
    const padding = SPACING_STEPS.includes(this.contentPadding) ? this.contentPadding : 0;

    const hasHeaderContent = hasTopNav || hasBanner;
    const showAutoToggle = !this.noMobileNav && !this.noMobileToggle && mobile && enabled;
    // A side-navigation-only shell gets a mobile top bar with the toggle (a top navigation places its own).
    const mobileBar = showAutoToggle && !hasTopNav && hasSideNav && !customDrawer;
    const drawer = mobile && enabled && !customDrawer;

    const header = hasHeaderContent
      ? html`<div
          slot="header"
          class="header"
          part="header"
          role=${ifDefined(this.noLandmarks ? undefined : 'banner')}
          data-variant=${variant}
          data-bg=${headerBackground ?? 'none'}
          ?data-sticky=${auto}
        >
          <tct-layout-header padding="0" ?has-divider=${dividers && hasTopNav}>
            ${
              hasBanner
                ? html`<div class="banner" data-bg=${navBackground ?? 'none'}>
                    <slot name="banner"></slot>
                  </div>`
                : nothing
            }
            ${hasTopNav ? html`<slot name="top-nav"></slot>` : nothing}
          </tct-layout-header>
        </div>`
      : nothing;

    const bar = mobileBar
      ? html`<div
          slot="header"
          class="header"
          part="header"
          role=${ifDefined(hasHeaderContent || this.noLandmarks ? undefined : 'banner')}
          data-variant=${variant}
          data-bg=${headerBackground ?? 'none'}
          ?data-sticky=${auto}
        >
          <tct-layout-header padding="0" ?has-divider=${dividers}>
            <div
              class="mobile-bar"
              role="navigation"
              aria-label=${this.#locale.t('mobileNavigation')}
            >
              <slot name="mobile-bar"></slot>
              <tct-mobile-nav-toggle></tct-mobile-nav-toggle>
            </div>
          </tct-layout-header>
        </div>`
      : nothing;

    const panel = inlineSideNav
      ? html`<tct-layout-panel
          class="sidenav"
          exportparts="base: sidenav"
          padding="0"
          ?has-divider=${dividers}
          data-variant=${variant}
          data-bg=${navBackground ?? 'none'}
        >
          <slot name="side-nav"></slot>
        </tct-layout-panel>`
      : nothing;
    const sideNav = inlineSideNav
      ? html`<div
          slot="start"
          class="sidenav-frame"
          ?data-sticky=${auto}
          data-bg=${stickyBackground}
        >
          ${panel}
        </div>`
      : nothing;

    const main = html`<tct-layout-content
      id=${APP_SHELL_MAIN_ID}
      class="main"
      exportparts="base: main"
      landmark=${ifDefined(this.noLandmarks ? undefined : 'main')}
      padding=${padding}
      focusable
      ?no-scroll=${auto}
      data-bg=${contentBackground ?? 'none'}
    >
      <slot></slot>
    </tct-layout-content>`;

    return html`<div
      class="shell"
      part="base"
      data-variant=${variant}
      data-height=${height}
      ?data-mobile=${mobile}
    >
      <a
        class="skip-link visually-hidden-focusable focus-ring"
        part="skip-link"
        href="#"
        @click=${this.#onSkip}
        >${this.#locale.t('skipToContent')}</a
      >
      <tct-layout height=${height} padding="0">
        ${header} ${bar} ${sideNav}
        ${
          elevate
            ? html`<div class="elevated">
                <div class="elevated-backdrop"></div>
                ${main}
              </div>`
            : main
        }
      </tct-layout>
      ${
        customDrawer
          ? html`<slot name="mobile-nav"></slot>`
          : drawer
            ? html`<tct-mobile-nav exportparts="dialog: mobile-nav">
                <slot name="drawer"></slot>
                <slot name="side-nav"></slot>
              </tct-mobile-nav>`
            : nothing
      }
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-app-shell': TctAppShell;
  }
}
