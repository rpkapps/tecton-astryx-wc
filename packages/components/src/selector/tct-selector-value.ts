import {html, type CSSResultGroup} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import base from '../styles/base.styles.css';
import {selectorRowLayoutContext} from './selector.context.js';
import {SELECTOR_ROW_LAYOUTS, type SelectorRowLayout} from './selector.types.js';
import styles from './tct-selector-value.styles.css';

/**
 * The box a selector's closed trigger draws the selected value in. It publishes the row layout the
 * trigger imposes (`inline` inside an input group, whose height is pinned to one line) to the
 * `tct-selector-option` rows drawn inside it, and clips a value taller than the group's row.
 *
 * @internal
 * @summary Value box of the trigger of a selector.
 * @tag tct-selector-value
 * @slot - The selected value's content.
 * @cloakDisplay block
 */
export class TctSelectorValue extends TctElement {
  static override readonly tagName = 'tct-selector-value';
  static override styles: CSSResultGroup = [base, styles];

  /** `inline` when the trigger sits in an input group. */
  @property({reflect: true}) layout: SelectorRowLayout = 'stacked';

  readonly #layout: ContextProvider<typeof selectorRowLayoutContext> = new ContextProvider<
    typeof selectorRowLayoutContext
  >(this, {context: selectorRowLayoutContext, initialValue: 'stacked'});

  protected override willUpdate(): void {
    this.#layout.setValue(SELECTOR_ROW_LAYOUTS.includes(this.layout) ? this.layout : 'stacked');
  }

  protected override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-selector-value': TctSelectorValue;
  }
}
