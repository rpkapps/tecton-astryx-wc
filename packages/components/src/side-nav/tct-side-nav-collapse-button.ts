import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import english from '@tecton-wc/locales/en/sideNavCollapseButton.js';
import {AppShellMobileController} from '../app-shell/app-shell-mobile.context.js';
import {TctButton} from '../button/tct-button.js';
import type {ButtonSize} from '../button/button.types.js';
import {TctIcon} from '../icon/tct-icon.js';
import base from '../styles/base.styles.css';
import {SideNavCollapseController, type SideNavCollapseState} from './side-nav.context.js';
import styles from './tct-side-nav-collapse-button.styles.css';

/** What the button needs from a side navigation it is bound to from outside (`for` or `sideNav`). */
export interface SideNavCollapseHandle extends HTMLElement {
  readonly collapsible: boolean;
  readonly collapsed: boolean;
  /** Asks to toggle as the user would (a cancelable `tct-collapse-change` first). */
  requestCollapseToggle(reason: 'pointer' | 'keyboard'): void;
  /** Runs `listener` whenever the collapse state changes; returns the unsubscribe function. */
  subscribeCollapse(listener: () => void): () => void;
}

const isHandle = (element: Element | null | undefined): element is SideNavCollapseHandle =>
  element !== null &&
  element !== undefined &&
  typeof (element as Partial<SideNavCollapseHandle>).subscribeCollapse === 'function';

/**
 * The button that collapses a side navigation to its icon rail and expands it again: a ghost icon
 * button with a chevron that turns over with the state. Its name and tooltip are "Collapse sidebar" and
 * "Expand sidebar" (`label` replaces both).
 *
 * Inside a side navigation (its header, top content, footer, or `footer-icons`) it reads the state from
 * the navigation by itself. Anywhere else (a top navigation, the page) name the navigation with `for` (the
 * id of a `tct-side-nav` in the same tree) or set `sideNav` to the element. It renders nothing while
 * the navigation is not collapsible, and in the mobile drawer, where there is nothing to collapse to.
 *
 * Its click asks the navigation to toggle through the cancelable `tct-collapse-change` the navigation
 * raises, like the built-in button; the button itself raises no event of its own.
 *
 * @summary A ghost icon button that collapses and expands a side navigation.
 * @tag tct-side-nav-collapse-button
 * @upstream SideNavCollapseButton
 * @slot - A custom icon, replacing the chevron.
 * @csspart button - The `tct-button`.
 * @csspart icon - The chevron.
 * @cloakDisplay inline-flex
 */
export class TctSideNavCollapseButton extends TctElement {
  static override readonly tagName = 'tct-side-nav-collapse-button';
  static override readonly dependencies = [TctButton, TctIcon];
  static override styles: CSSResultGroup = [base, styles];

  /** The id of the `tct-side-nav` to control, in the same tree. Not needed inside the navigation. */
  @property() for: string | undefined;

  /** The side navigation to control, instead of `for`. Not needed inside the navigation. */
  @property({attribute: false}) sideNav: SideNavCollapseHandle | null = null;

  /** Accessible name and tooltip. Default: "Collapse sidebar" or "Expand sidebar", by the state. */
  @property() label = '';

  /** Button size: `sm`, `md` or `lg`. Default: the size the container cascades (`sm` in a side navigation footer), else `md`. */
  @property({reflect: true}) size: ButtonSize | undefined;

  readonly #inside: SideNavCollapseController = new SideNavCollapseController(this);
  readonly #shell: AppShellMobileController = new AppShellMobileController(this);
  readonly #slots: SlotController = new SlotController(this, 'default');
  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'sideNavCollapseButton',
    defaults: english,
  });
  #bound: SideNavCollapseHandle | null = null;
  #unsubscribe: (() => void) | undefined;

  /** The navigation the button controls: the named one, else the enclosing one. */
  get #external(): SideNavCollapseHandle | null {
    if (this.sideNav) return this.sideNav;
    if (!this.for) return null;
    const root = this.getRootNode() as Document | ShadowRoot;
    const element = root.getElementById?.(this.for) ?? null;
    return isHandle(element) ? element : null;
  }

  #state(): SideNavCollapseState {
    const external = this.#external;
    if (external) {
      return {
        isCollapsed: external.collapsed,
        isCollapsible: external.collapsible,
        toggle: (reason) => {
          external.requestCollapseToggle(reason ?? 'pointer');
        },
      };
    }
    return this.#inside.value;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#bind();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unbind();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('for') || changed.has('sideNav')) this.#bind();
  }

  /** Follows the named navigation (it may be defined after this button). */
  #bind(): void {
    const external = this.#external;
    if (external === this.#bound) return;
    this.#unbind();
    this.#bound = external;
    if (external) {
      this.#unsubscribe = external.subscribeCollapse(() => {
        this.requestUpdate();
      });
    } else if (this.for && this.isConnected) {
      // The id may not resolve yet (the navigation comes later in the document): try again next frame.
      requestAnimationFrame(() => {
        if (this.isConnected && this.#external) this.#bind();
        else if (this.isConnected)
          devWarn(
            'tct-side-nav-collapse-button:for',
            `No tct-side-nav with the id "${this.for ?? ''}" in this tree.`,
          );
      });
    }
  }

  #unbind(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#bound = null;
  }

  readonly #onClick = (event: MouseEvent): void => {
    this.#state().toggle(event.detail === 0 ? 'keyboard' : 'pointer');
  };

  override render(): TemplateResult | typeof nothing {
    const state = this.#state();
    // Nothing to collapse to when the navigation is not collapsible, or it is the drawer.
    if (!state.isCollapsible || this.#shell.value.isMobile) return nothing;
    const label =
      this.label || this.#locale.t(state.isCollapsed ? 'expandSidebar' : 'collapseSidebar');
    const custom = this.#slots.has('default');
    return html`<tct-button
      part="button"
      variant="ghost"
      icon-only
      label=${label}
      size=${ifDefined(this.size)}
      ?data-collapsed=${state.isCollapsed}
      @click=${this.#onClick}
    >
      <span slot="icon" class="glyph" part="icon"
        >${
          custom
            ? html`<slot></slot>`
            : html`<tct-icon name="chevronLeft" color="inherit"></tct-icon>`
        }</span
      >
    </tct-button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-side-nav-collapse-button': TctSideNavCollapseButton;
  }
}
