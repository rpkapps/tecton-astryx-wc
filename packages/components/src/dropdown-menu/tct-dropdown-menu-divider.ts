import {html, type CSSResultGroup} from 'lit';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {TctDivider} from '../divider/tct-divider.js';
import base from '../styles/base.styles.css';
import styles from './tct-dropdown-menu-divider.styles.css';

/**
 * A horizontal rule between groups of rows in a compound menu. It is a `separator` for assistive
 * technology, is skipped by the arrow keys and typeahead, and takes the menu's vertical rhythm.
 * Serves every menu (`ContextMenuDivider`, `BreadcrumbMenuDivider` upstream).
 *
 * @summary A rule between groups of menu rows.
 * @tag tct-dropdown-menu-divider
 * @upstream DropdownMenuDivider
 * @csspart divider - The rule (upstream theming target `dropdown-menu-divider`).
 * @cloakDisplay block
 */
export class TctDropdownMenuDivider extends TctElement {
  static override readonly tagName = 'tct-dropdown-menu-divider';
  static override readonly dependencies = [TctDivider];
  static override styles: CSSResultGroup = [base, styles];

  constructor() {
    super();
    this.internals.role = 'separator';
    this.internals.ariaOrientation = 'horizontal';
  }

  protected override render() {
    // The row is the separator; the inner divider only draws the rule.
    return html`<tct-divider class="divider" part="divider" role="none"></tct-divider>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-dropdown-menu-divider': TctDropdownMenuDivider;
  }
}
