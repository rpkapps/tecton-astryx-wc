import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import base from '../styles/base.styles.css';
import slottedIcon from '../styles/slotted-icon.styles.css';
import styles from './tct-typeahead-item.styles.css';
import type {SearchableItem} from './typeahead.types.js';

/**
 * The default content of a typeahead result row: the item's label, an optional icon before it and an
 * optional description under it. The typeahead renders one inside every option unless you supply
 * `renderItem`; use it in your own `renderItem` to keep the standard layout with your icon or
 * description. It is presentational: the option row around it owns the role, the highlight and the
 * selection.
 *
 * Pass the search result as `item` (its `label` is shown), or set `label` for markup-only use. An
 * `item.element` (a template or a node) replaces the layout entirely.
 *
 * @summary The default label, icon and description layout of a typeahead result.
 * @tag tct-typeahead-item
 * @upstream TypeaheadItem
 * @slot icon - An icon or avatar before the label.
 * @csspart item - The row: icon and text.
 * @csspart label - The label text.
 * @csspart description - The description text.
 * @cloakDisplay block
 */
export class TctTypeaheadItem extends TctElement {
  static override readonly tagName = 'tct-typeahead-item';
  static override styles: CSSResultGroup = [base, slottedIcon, styles];

  /** The search result to show. Its `label` is the text unless `label` is set; its `element` replaces the layout. */
  @property({attribute: false}) item: SearchableItem | undefined;

  /** The label, for markup-only use. Wins over `item.label`. */
  @property() label = '';

  /** Description text under the label. */
  @property() description = '';

  /** Dims the row: the result cannot be chosen. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /**
   * The group label of the result. Kept for API parity: the row draws nothing for it; groups are
   * built from `item.auxiliaryData.group` by the typeahead.
   */
  @property() group = '';

  readonly #slots: SlotController = new SlotController(this, 'icon');

  override render(): TemplateResult {
    const element = this.item?.element;
    if (element !== undefined) return html`${element}`;
    const label = this.label || this.item?.label || '';
    return html`<div class="item" part="item" ?data-disabled=${this.disabled}>
      ${
        this.#slots.has('icon')
          ? html`<span class="icon-slot"><slot name="icon"></slot></span>`
          : nothing
      }
      <div class="content">
        <span class="label" part="label">${label}</span>
        ${this.description ? html`<span class="description" part="description">${this.description}</span>` : nothing}
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-typeahead-item': TctTypeaheadItem;
  }
}
