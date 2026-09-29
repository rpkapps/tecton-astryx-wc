import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import mobileNavMessages from '@tecton-wc/locales/en/mobileNav.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {AppShellMobileController} from '../app-shell/app-shell-mobile.context.js';
import {TctButton} from '../button/tct-button.js';
import base from '../styles/base.styles.css';
import styles from './tct-mobile-nav-toggle.styles.css';

/**
 * The hamburger button that opens and closes the mobile navigation drawer of the `tct-app-shell` it is in.
 * It renders nothing above the mobile breakpoint, or when the shell has no mobile navigation, so it is
 * safe to include unconditionally: place it anywhere inside the shell (a top navigation, a toolbar in the
 * content). A shell with `no-mobile-toggle` does not place one of its own; put yours where you want it.
 *
 * The button reports the drawer state with `aria-expanded`. It asks before it acts: pressing it raises a
 * cancelable `tct-open-change` (`open` is the state it asks for, `reason` `trigger`), and toggles the
 * drawer unless the event is prevented. Focus returns to it when the drawer closes. Slot your own icon
 * to replace the default menu glyph; `label` is the accessible name (default "Open navigation").
 *
 * @summary Hamburger button that opens and closes the mobile navigation drawer.
 * @tag tct-mobile-nav-toggle
 * @upstream MobileNavToggle
 * @slot - A custom icon, instead of the default hamburger.
 * @csspart button - The ghost icon button.
 * @fires tct-open-change - The toggle asks to open or close the drawer; cancelable, carries `open` and `reason` (`trigger`).
 * @cloakDisplay contents
 */
export class TctMobileNavToggle extends TctElement {
  static override readonly tagName = 'tct-mobile-nav-toggle';
  static override readonly dependencies = [TctButton];
  static override styles: CSSResultGroup = [base, styles];

  /** Accessible name and tooltip of the button. Defaults to "Open navigation" in the language of the page. */
  @property() label = '';

  readonly #shell = new AppShellMobileController(this);
  readonly #slots = new SlotController(this, 'default');
  readonly #locale = new LocaleController(this, {
    namespace: 'mobileNav',
    defaults: mobileNavMessages,
  });

  /** Whether the toggle renders right now (below the breakpoint, with a mobile navigation to open). */
  get isRendered(): boolean {
    const shell = this.#shell.value;
    return shell.isMobile && shell.isMobileNavEnabled;
  }

  readonly #onClick = (): void => {
    const shell = this.#shell.value;
    const open = !shell.isMobileNavOpen;
    if (this.dispatch(new TctOpenChangeEvent(open, 'trigger'))) shell.toggleMobileNav();
  };

  override render(): TemplateResult | typeof nothing {
    // Above the breakpoint, or with mobile navigation off, there is nothing to open.
    if (!this.isRendered) return nothing;
    const expanded = this.#shell.value.isMobileNavOpen;
    const custom = this.#slots.has('default');
    return html`<tct-button
      part="button"
      variant="ghost"
      icon-only
      icon=${custom ? '' : 'menu'}
      label=${this.label || this.#locale.t('toggle.open')}
      aria-expanded=${String(expanded)}
      @click=${this.#onClick}
      >${custom ? html`<slot slot="icon"></slot>` : nothing}</tct-button
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-mobile-nav-toggle': TctMobileNavToggle;
  }
}
