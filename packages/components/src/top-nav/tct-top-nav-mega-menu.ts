import {html, type CSSResultGroup, type TemplateResult} from 'lit';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import type {PlacementRequest} from '@tecton-wc/core/layer/position.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctTopNavDisclosure} from './tct-top-nav-disclosure.js';
import {topNavSlotOf} from './top-nav.types.js';
import styles from './tct-top-nav-mega-menu.styles.css';

/** The element of a top navigation a mega menu is anchored to (its `nav`). */
interface AnchorHost extends HTMLElement {
  readonly anchorElement?: HTMLElement | null;
}

/**
 * A top navigation item that reveals a wide panel of destinations: a grid of `tct-top-nav-mega-menu-item`s
 * (the default slot) beside an optional featured area (the `featured` slot, typically a
 * `tct-top-nav-mega-menu-featured-card`). The panel is anchored to the whole bar, not to the button: it
 * opens below the navigation, at most 960px wide, aligned to the start, the centre or the end of the bar by
 * the region the item sits in, and it mirrors in RTL. It scrolls inside when it is taller than the space
 * below the bar.
 *
 * Like `tct-top-nav-menu` it is disclosure navigation, not an ARIA menu: the button has `aria-expanded`
 * and `aria-controls`, and the panel is a labelled group (a browsing grid of links is the documented
 * anti-case for `role="menu"`). Enter and Space toggle it, Tab and the Arrow keys move through the links,
 * Escape closes it and returns focus to the button, and it opens on hover on fine pointers (a click within
 * 500 ms confirms and pins it). In the mobile drawer of an app shell it is a collapsible section with the
 * items and the featured area under its header.
 *
 * @summary A top navigation item that discloses a wide panel of destinations and a featured area, anchored to the bar.
 * @tag tct-top-nav-mega-menu
 * @upstream TopNavMegaMenu
 * @slot - The destinations: `tct-top-nav-mega-menu-item`s, laid out in two columns.
 * @slot featured - The featured area beside the items: a `tct-top-nav-mega-menu-featured-card` or your own content.
 * @csspart trigger - The button.
 * @csspart panel - The panel box.
 * @csspart items - The grid of destinations.
 * @csspart featured - The featured area.
 * @cssstate open - The panel is open.
 * @fires tct-open-change - The user (the button, hover, Escape, an outside press, Tab out, a choice) asks to open or close the panel; cancelable, carries `open` and `reason`.
 * @fires tct-after-open-change - The change settled (the entry animation is done, or the panel is hidden); carries `open`.
 * @cloakDisplay inline-flex
 */
export class TctTopNavMegaMenu extends TctTopNavDisclosure {
  static override readonly tagName = 'tct-top-nav-mega-menu';
  static override readonly dependencies = [TctIcon];
  static override styles: CSSResultGroup = [TctTopNavDisclosure.styles, styles];

  readonly #slots: SlotController = new SlotController(this, 'featured');

  constructor() {
    super();
    this.hideDelay = 250;
  }

  protected override get panelClass(): string {
    return 'mega';
  }

  /** The panel hangs below the whole bar. */
  protected override panelAnchor(): HTMLElement | null {
    const bar = this.closest<AnchorHost>('tct-top-nav');
    return bar?.anchorElement ?? this.trigger;
  }

  protected override placementRequest(): PlacementRequest {
    return {placement: 'below', alignment: topNavSlotOf(this)};
  }

  protected override renderPanel(): TemplateResult {
    return html`<div class="content" part="content">
      <div class="items" part="items"><slot></slot></div>
      ${this.#slots.has('featured')
        ? html`<div class="featured" part="featured"><slot name="featured"></slot></div>`
        : html``}
    </div>`;
  }

  protected override renderDrawerItems(): TemplateResult {
    return html`<slot></slot>${this.#slots.has('featured')
      ? html`<div class="drawer-featured"><slot name="featured"></slot></div>`
      : html``}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-top-nav-mega-menu': TctTopNavMegaMenu;
  }
}
