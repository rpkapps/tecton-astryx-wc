import {html, type CSSResultGroup} from 'lit';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import base from '../styles/base.styles.css';
import slottedIcon from '../styles/slotted-icon.styles.css';
import styles from './tct-nav-icon.styles.css';

/**
 * A circular, accent-coloured container for one icon: the logo slot of a navigation header (top nav,
 * side nav and page headers). It only frames the glyph; it is display-only, never a button.
 *
 * Put a `tct-icon` (or your own `<svg>`) in the `icon` slot; unnamed content works too. The glyph is
 * sized to 16px inside the 32px circle. Fill and ink are the Tecton accent roles
 * (`--color-accent` / `--color-on-accent`).
 *
 * Guides: [mwg:shadow-dom] (slots) [mwg:styling-web-components] (`part`, `::slotted` sizing).
 *
 * @summary A circular accent container for a navigation header icon.
 * @tag tct-nav-icon
 * @upstream NavIcon
 * @slot icon - The icon inside the circle. Unnamed content is treated the same way.
 * @csspart base - The painted circle.
 * @cloakDisplay inline-flex
 */
export class TctNavIcon extends TctElement {
  static override readonly tagName = 'tct-nav-icon';
  static override styles: CSSResultGroup = [base, slottedIcon, styles];

  override render() {
    return html`<span class="base" part="base"><slot name="icon"></slot><slot></slot></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-nav-icon': TctNavIcon;
  }
}
