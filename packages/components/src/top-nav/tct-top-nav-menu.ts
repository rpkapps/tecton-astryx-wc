import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {TctTopNavMegaMenuItem} from './tct-top-nav-mega-menu-item.js';
import type {TopNavMenuItemData} from './top-nav.types.js';
import {TctTopNavDisclosure} from './tct-top-nav-disclosure.js';
import {TctIcon} from '../icon/tct-icon.js';
import styles from './tct-top-nav-menu.styles.css';

/**
 * A top navigation item that reveals a small panel of destinations: a button that shows a list of links
 * with an icon, a title and a description each. Give the destinations as `tct-top-nav-mega-menu-item`s in the
 * default slot, or as data in `items`. It is disclosure navigation, not an ARIA menu: the button has
 * `aria-expanded` and `aria-controls`, the panel is a labelled group of ordinary links, and there are no
 * `menuitem`s. Enter and Space toggle it (a keyboard open moves focus to the first link), Tab moves through the
 * links in order (and out of the panel, which closes it), the Arrow keys, Home and End move between links,
 * and Escape closes it and returns focus to the button. It opens on hover after a short delay on fine
 * pointers; a click confirms and pins a hover-open.
 *
 * The panel aligns to the region of the bar the item sits in (start, center or end) and mirrors in RTL.
 * `open` is the state (the attribute is the initial state); the user's actions ask with a cancelable
 * `tct-open-change` and `tct-after-open-change` reports when the change settled. In the mobile drawer of an
 * app shell it is a collapsible section of rows.
 *
 * @summary A top navigation item that discloses a panel of links.
 * @tag tct-top-nav-menu
 * @upstream TopNavMenu
 * @slot - The destinations: `tct-top-nav-mega-menu-item`s.
 * @csspart trigger - The button.
 * @csspart panel - The panel box.
 * @csspart items - The list of destinations.
 * @cssstate open - The panel is open.
 * @fires tct-open-change - The user (the button, hover, Escape, an outside press, Tab out, a choice) asks to open or close the panel; cancelable, carries `open` and `reason`.
 * @fires tct-after-open-change - The change settled (the entry animation is done, or the panel is hidden); carries `open`.
 * @cloakDisplay inline-flex
 */
export class TctTopNavMenu extends TctTopNavDisclosure {
  static override readonly tagName = 'tct-top-nav-menu';
  static override readonly dependencies = [TctIcon, TctTopNavMegaMenuItem];
  static override styles: CSSResultGroup = [TctTopNavDisclosure.styles, styles];

  /** The destinations as data (title, description, icon, href, onClick), in addition to the slotted items. Property only. */
  @property({attribute: false}) items: readonly TopNavMenuItemData[] = [];

  protected override renderPanel(): TemplateResult {
    return html`<div class="items" part="items"><slot></slot>${this.#dataItems()}</div>`;
  }

  protected override renderDrawerItems(): TemplateResult {
    return html`<slot></slot>${this.#dataItems()}`;
  }

  #dataItems(): TemplateResult | typeof nothing {
    if (this.items.length === 0) return nothing;
    return html`${this.items.map(
      (item) =>
        html`<tct-top-nav-mega-menu-item
          heading=${item.title}
          description=${item.description ?? ''}
          icon=${item.icon ?? ''}
          .href=${item.href}
          @click=${() => {
            item.onClick?.();
          }}
        ></tct-top-nav-mega-menu-item>`,
    )}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-top-nav-menu': TctTopNavMenu;
  }
}
