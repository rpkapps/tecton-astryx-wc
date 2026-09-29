import type {CSSResultGroup} from 'lit';
import {property} from 'lit/decorators.js';
import english from '@tecton-wc/locales/en/topNav.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctNavHeadingBase} from '../side-nav/nav-heading.base.js';

/**
 * The heading of a top navigation: the product, suite or account, with a logo (usually a `tct-nav-icon`), an
 * optional line above (`superheading`) and below (`subheading`), trailing content and an optional menu to
 * switch between products or accounts. It sits at the start edge of the bar.
 *
 * What is set decides what is interactive: a heading with only `heading-href` is one link; with several
 * hrefs each is its own link (and the logo links to the heading destination, named by `logo-label`, or by
 * the heading); with a menu and no hrefs the whole heading opens the menu; with a menu and hrefs the links
 * stay links and the chevron button opens the menu. A logo alone (no text) with an href is a link named by
 * `logo-label`. The menu is the `menu` slot, shown on a panel below the heading on click, Enter and Space
 * (focus moves into it), or on hover; Escape closes it and returns focus to the chevron button, and choosing
 * a link in it closes it. It is a disclosure, not an ARIA menu: slot a `tct-nav-heading-menu` (or plain
 * links) and it brings its own semantics.
 *
 * @summary The product, suite or account heading of a top navigation, with a logo, links and a menu.
 * @tag tct-top-nav-heading
 * @upstream TopNavHeading
 * @slot logo - The logo before the heading: a `tct-nav-icon`, an image.
 * @slot end - Content at the trailing edge of the heading row.
 * @slot menu - The menu shown in a panel below the heading: the switcher.
 * @csspart base - The heading box.
 * @csspart icon - The logo box.
 * @csspart heading - The heading text (or its link).
 * @csspart superheading - The text above the heading (or its link).
 * @csspart subheading - The text below the heading (or its link).
 * @csspart end-content - The trailing content.
 * @csspart menu-trigger - The chevron button that opens the menu.
 * @csspart menu - The menu panel.
 * @cloakDisplay block
 */
export class TctTopNavHeading extends TctNavHeadingBase {
  static override readonly tagName = 'tct-top-nav-heading';
  static override readonly dependencies = [TctIcon];
  static override styles: CSSResultGroup = TctNavHeadingBase.styles;

  /**
   * The accessible name of the logo when it links somewhere and no text names it (a logo-only heading).
   * Defaults to `heading`. Ignored when the logo is not a link.
   */
  @property({attribute: 'logo-label'}) logoLabel = '';

  constructor() {
    super('logo', 'topNav', english);
  }

  protected override get iconLabel(): string {
    return this.logoLabel || this.heading;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-top-nav-heading': TctTopNavHeading;
  }
}
