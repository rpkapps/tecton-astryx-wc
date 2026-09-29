import type {CSSResultGroup} from 'lit';
import english from '@tecton-wc/locales/en/sideNav.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctNavHeadingBase} from './tct-nav-heading-base.js';
import {SideNavCollapseController} from './side-nav.context.js';

/**
 * The heading of a side navigation: the product, suite or account, with an icon (usually a
 * `tct-nav-icon`), an optional line above (`superheading`) and below (`subheading`), trailing content
 * and an optional menu to switch between products or accounts.
 *
 * What is set decides what is interactive: a heading with only `heading-href` is one link; with several
 * hrefs each is its own link; with a menu and no hrefs the whole heading opens the menu; with a menu and
 * hrefs the links stay links and the chevron button opens the menu. The menu is the `menu` slot, shown on a
 * panel below the heading on click, Enter and Space (focus moves into it), or on hover. Escape closes it and
 * returns focus to the chevron button; choosing a link in it closes it. It is a disclosure, not an ARIA
 * menu: slot a `tct-nav-heading-menu` (or plain links) and it brings its own semantics.
 *
 * In the collapsed rail the heading is its icon alone: named by `heading`, with the name in a tooltip; a
 * heading without an icon is hidden there. The trailing content is hidden.
 *
 * @summary The product, suite or account heading of a side navigation, with links and a menu.
 * @tag tct-side-nav-heading
 * @upstream SideNavHeading
 * @slot icon - The product or app icon, usually a `tct-nav-icon`.
 * @slot end - Content at the trailing edge of the heading row. Hidden in the collapsed rail.
 * @slot menu - The menu shown in a panel below the heading: the switcher.
 * @csspart base - The heading box.
 * @csspart icon - The icon box.
 * @csspart heading - The heading text (or its link).
 * @csspart superheading - The text above the heading (or its link).
 * @csspart subheading - The text below the heading (or its link).
 * @csspart end-content - The trailing content.
 * @csspart menu-trigger - The chevron button that opens the menu.
 * @csspart menu - The menu panel.
 * @csspart item - The collapsed heading control.
 * @csspart tooltip - The tooltip of the collapsed heading.
 * @cloakDisplay block
 */
export class TctSideNavHeading extends TctNavHeadingBase {
  static override readonly tagName = 'tct-side-nav-heading';
  static override readonly dependencies = [TctIcon];
  static override styles: CSSResultGroup = TctNavHeadingBase.styles;

  readonly #collapse: SideNavCollapseController = new SideNavCollapseController(this);

  constructor() {
    super('icon', 'sideNav', english);
  }

  protected override get isRail(): boolean {
    return this.#collapse.value.isCollapsed;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-side-nav-heading': TctSideNavHeading;
  }
}
