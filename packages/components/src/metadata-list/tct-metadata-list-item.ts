import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import base from '../styles/base.styles.css';
import styles from './tct-metadata-list-item.styles.css';

/**
 * One labelled value of a `tct-metadata-list`: the label (with an optional icon) and the value in the
 * default slot. The host is a `listitem`; the label is a `term` and the value a `definition`. Layout
 * (side or top labels, columns, horizontal flow) comes from the enclosing list.
 *
 * @summary A single label and value in a metadata list.
 * @tag tct-metadata-list-item
 * @upstream MetadataListItem
 * @slot - The value.
 * @slot icon - An icon rendered before the label text.
 * @csspart label - The label (`term`), with its icon.
 * @csspart icon - The icon wrapper.
 * @csspart value - The value (`definition`).
 * @cloakDisplay grid
 */
export class TctMetadataListItem extends TctElement {
  static override readonly tagName = 'tct-metadata-list-item';
  static override styles: CSSResultGroup = [base, styles];

  /** The label text (required). */
  @property() label = '';

  readonly #slots = new SlotController(this, 'icon');

  protected override willUpdate(): void {
    this.internals.role = 'listitem';
  }

  protected override render(): TemplateResult {
    return html`<span class="label" part="label" role="term"
        >${
          this.#slots.has('icon')
            ? html`<span class="icon" part="icon"><slot name="icon"></slot></span>`
            : nothing
        }${this.label}</span
      ><span class="value" part="value" role="definition"><slot></slot></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-metadata-list-item': TctMetadataListItem;
  }
}
