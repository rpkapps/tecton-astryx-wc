import {html, type CSSResultGroup} from 'lit';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import base from '../styles/base.styles.css';
import styles from './tct-input-group-text.styles.css';

/**
 * A prefix or suffix addon of a `tct-input-group`: a currency sign, a protocol, a unit. It is plain
 * content in a muted cell that shares the group's border, so it reads as part of the field. It is not
 * interactive and never focusable: put a button in the group for an action.
 *
 * @summary Prefix or suffix text of an input group.
 * @tag tct-input-group-text
 * @upstream InputGroupText
 * @slot - The addon content: text or an icon.
 * @csspart text - The addon cell.
 * @cloakDisplay flex
 */
export class TctInputGroupText extends TctElement {
  static override readonly tagName = 'tct-input-group-text';
  static override styles: CSSResultGroup = [base, styles];

  override render() {
    return html`<div class="text" part="text"><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-input-group-text': TctInputGroupText;
  }
}
