import {html, nothing, render, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import english from '@tecton-wc/locales/en/topNav.js';
import {AppShellMobileController} from '../app-shell/app-shell-mobile.context.js';
import {TctMobileNavToggle} from '../mobile-nav/tct-mobile-nav-toggle.js';
import base from '../styles/base.styles.css';
import {topNavRenderContext, TopNavRenderModeController} from './top-nav.context.js';
import type {TopNavRenderMode} from './top-nav.types.js';
import {TctTopNavDrawer} from './tct-top-nav-drawer.js';
import styles from './tct-top-nav.styles.css';

/** The slots whose children go to the mobile drawer: the navigation items, not the heading or the end content. */
const DRAWER_SLOTS = new Set(['start', 'center']);

/**
 * The top navigation bar of an application header: a `nav` landmark with a heading at the start, the
 * navigation items after it, an optional centre region and the end content (search, icons, a profile) at the
 * end. Fill the slots: `heading` (a `tct-top-nav-heading`), `start` or the default slot (`tct-top-nav-item`s,
 * `tct-top-nav-menu`s, `tct-top-nav-mega-menu`s), `center` (tabs, a search field: with it the bar becomes a
 * three-column grid so the centre stays centred), and `end`.
 *
 * Inside a `tct-app-shell`, below the mobile breakpoint the bar collapses to the heading, the end content
 * and a `tct-mobile-nav-toggle` (unless the shell has `no-mobile-toggle`: place your own), and the start and
 * centre items move into the shell's mobile drawer as vertical rows, above the side navigation with a rule
 * between (`tct-top-nav-drawer` shows copies of them; a click on a copy is forwarded to the original as a
 * click). A shell with a `tct-mobile-nav` of your own in the `mobile-nav` slot keeps the full bar. The
 * render mode is shared with the shell through `topNavRenderContext`.
 *
 * The band is the Tecton top-nav surface: the top-nav role for the background and, in the resting state, for
 * the ink of the items, in light and dark. Each interaction state switches to the primary text role.
 *
 * @summary Application top navigation bar with heading, start, center and end regions, collapsing into the mobile drawer.
 * @tag tct-top-nav
 * @upstream TopNav
 * @slot heading - The heading, typically a `tct-top-nav-heading`. At the start edge.
 * @slot start - Navigation items after the heading. The default slot is the same region.
 * @slot - Navigation items after the heading (the same region as `start`).
 * @slot center - Tabs, a search field, or the primary navigation. With it the bar is a three-column grid.
 * @slot end - Search, icons, a profile, utility menus. At the end edge.
 * @csspart base - The `nav` band.
 * @csspart heading - The box around the heading.
 * @cssstate mobile-bar - The bar is collapsed to the mobile bar.
 * @cloakDisplay block
 */
export class TctTopNav extends TctElement {
  static override readonly tagName = 'tct-top-nav';
  static override readonly dependencies = [TctMobileNavToggle, TctTopNavDrawer];
  static override styles: CSSResultGroup = [base, styles];

  /** Accessible name of the `nav` landmark. Default "Top navigation". */
  @property() label = '';

  readonly #slots: SlotController = new SlotController(this, 'heading', 'center', 'end');
  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'topNav',
    defaults: english,
  });
  readonly #mode: TopNavRenderModeController = new TopNavRenderModeController(this, {
    derive: true,
  });
  readonly #shell: AppShellMobileController = new AppShellMobileController(this);
  readonly #modeProvider: ContextProvider<typeof topNavRenderContext> = new ContextProvider<
    typeof topNavRenderContext
  >(this, {context: topNavRenderContext, initialValue: 'default'});
  #observer: MutationObserver | undefined;
  #drawer: TctTopNavDrawer | undefined;
  #refreshQueued = false;

  /** The `nav` box: what a mega menu is anchored to. */
  get anchorElement(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('nav') ?? null;
  }

  /** How the bar is rendered right now: `default`, or `mobile-bar` below the mobile breakpoint of an app shell. */
  get renderMode(): TopNavRenderMode {
    const derived = this.#mode.value;
    // A `tct-mobile-nav` of your own replaces the automatic drawer, and the full bar stays.
    if (derived === 'mobile-bar' && !this.#mode.isExplicit && this.#hasCustomDrawer)
      return 'default';
    return derived;
  }

  /** The shell this bar is the header of, when it is one of its slotted children. */
  get #shellElement(): HTMLElement | null {
    const parent = this.parentElement;
    return parent?.localName === 'tct-app-shell' && this.getAttribute('slot') === 'top-nav'
      ? parent
      : null;
  }

  get #hasCustomDrawer(): boolean {
    return this.#shellElement?.querySelector(':scope > [slot="mobile-nav"]') != null;
  }

  /** The items that go to the drawer: the start and centre regions, in document order. */
  #drawerSources(): Element[] {
    return [...this.children].filter((child) => {
      if (child.localName === 'template') return false;
      const slot = child.getAttribute('slot');
      return slot === null || slot === '' || DRAWER_SLOTS.has(slot);
    });
  }

  // ------------------------------------------------------------------------------ lifecycle

  override connectedCallback(): void {
    super.connectedCallback();
    this.#observer ??= new MutationObserver(() => {
      this.#queueRefresh();
    });
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#observer?.disconnect();
    this.#removeDrawer();
  }

  protected override willUpdate(): void {
    this.#modeProvider.setValue(this.renderMode);
  }

  protected override updated(): void {
    this.toggleState('mobile-bar', this.renderMode === 'mobile-bar');
    this.#syncDrawer();
  }

  // -------------------------------------------------------------------------- mobile drawer

  /** Items or their attributes changed: refresh the copies in the drawer (once per task). */
  #queueRefresh(): void {
    if (this.renderMode !== 'mobile-bar' || this.#refreshQueued) return;
    this.#refreshQueued = true;
    queueMicrotask(() => {
      this.#refreshQueued = false;
      this.#syncDrawer(true);
      this.requestUpdate();
    });
  }

  #syncDrawer(refresh = false): void {
    const shell = this.#shellElement;
    const sources = this.#drawerSources();
    const wanted =
      this.renderMode === 'mobile-bar' &&
      !this.#mode.isExplicit &&
      shell !== null &&
      sources.length > 0;
    if (!wanted || !shell) {
      this.#removeDrawer();
      return;
    }
    let drawer = this.#drawer;
    if (drawer?.parentElement !== shell) {
      // Rendered from a template like every element, then handed to the shell as its `drawer` slot content.
      const holder = document.createElement('div');
      render(html`<tct-top-nav-drawer slot="drawer" data-tct-owned></tct-top-nav-drawer>`, holder);
      drawer = holder.firstElementChild as TctTopNavDrawer;
      this.#drawer = drawer;
      shell.append(drawer);
    }
    drawer.label = this.label || this.#locale.t('landmarkLabel');
    const same =
      drawer.sources.length === sources.length &&
      drawer.sources.every((source, index) => source === sources[index]);
    if (!same) drawer.sources = sources;
    else if (refresh) drawer.refresh();
  }

  #removeDrawer(): void {
    this.#drawer?.remove();
    this.#drawer = undefined;
  }

  // -------------------------------------------------------------------------------- render

  override render(): TemplateResult {
    const label = this.label || this.#locale.t('landmarkLabel');
    const mode = this.renderMode;
    const hasHeading = this.#slots.has('heading');
    const hasEnd = this.#slots.has('end');

    // The mobile bar: the heading, the end content and the toggle. The items are in the drawer.
    if (mode === 'mobile-bar') {
      const shell = this.#shell.value;
      const hasDrawerContent = this.#drawerSources().length > 0 || shell.hasSideNav;
      return html`<nav class="root bar" part="base" aria-label=${label}>
        ${
          hasHeading
            ? html`<div class="heading" part="heading"><slot name="heading"></slot></div>`
            : nothing
        }
        <div class="bar-end">
          <slot name="end"></slot>
          ${
            hasDrawerContent && shell.hasAutoToggle
              ? html`<tct-mobile-nav-toggle></tct-mobile-nav-toggle>`
              : nothing
          }
        </div>
      </nav>`;
    }

    const hasCenter = this.#slots.has('center');
    return html`<nav class="root ${hasCenter ? 'grid' : 'flex'}" part="base" aria-label=${label}>
      <div class="left">
        ${
          hasHeading
            ? html`<div class="heading" part="heading"><slot name="heading"></slot></div>`
            : nothing
        }
        <div class="start"><slot name="start"></slot><slot></slot></div>
      </div>
      ${hasCenter ? html`<div class="center"><slot name="center"></slot></div>` : nothing}
      ${
        hasCenter
          ? html`<div class="right"><slot name="end"></slot></div>`
          : hasEnd
            ? html`<div class="end"><slot name="end"></slot></div>`
            : nothing
      }
    </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-top-nav': TctTopNav;
  }
}
