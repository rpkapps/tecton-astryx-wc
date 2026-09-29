import {html, type CSSResultGroup} from 'lit';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import base from '../styles/base.styles.css';
import motion from '../styles/motion.styles.css';
import styles from './tct-tooltip-surface.styles.css';

/**
 * The tooltip's popup: an owned light-DOM satellite of `tct-tooltip` (A§8.2, A-18). It has to live in
 * the same tree as the trigger the author wrote, because `aria-describedby` ids never cross a shadow
 * boundary, and its text stays in the light DOM so it takes part in description computation. The
 * `tct-tooltip` host gives it `popover="manual"` and `role="tooltip"`; the box is painted by the inner
 * part, so an application reset that touches the host cannot erase it.
 *
 * @internal
 * @summary Popup surface of a tooltip.
 * @tag tct-tooltip-surface
 * @slot - The tooltip text.
 * @csspart surface - The painted box (Astryx target `astryx-tooltip`).
 */
export class TctTooltipSurface extends TctElement {
  static override readonly tagName = 'tct-tooltip-surface';
  static override styles: CSSResultGroup = [base, motion, styles];

  override render() {
    return html`<div class="surface" part="surface"><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-tooltip-surface': TctTooltipSurface;
  }
}
