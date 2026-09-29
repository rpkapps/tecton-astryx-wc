import {html, type CSSResultGroup} from 'lit';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import base from '../styles/base.styles.css';
import field from '../styles/field.styles.css';
import styles from './tct-field-description.styles.css';

/**
 * The helper text of a field, rendered by `tct-field` (or a control in slotted-input mode) as an owned
 * light-DOM satellite so a native control in the same tree can reference it with `aria-describedby`.
 * Its text stays in the light DOM. Pressing it forwards to the control (handled by the field).
 *
 * @internal
 * @summary Description satellite of a field.
 * @tag tct-field-description
 * @slot - The description text.
 * @csspart description - The description box.
 */
export class TctFieldDescription extends TctElement {
  static override readonly tagName = 'tct-field-description';
  static override styles: CSSResultGroup = [base, field, styles];

  override render() {
    return html`<div part="description"><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-field-description': TctFieldDescription;
  }
}
