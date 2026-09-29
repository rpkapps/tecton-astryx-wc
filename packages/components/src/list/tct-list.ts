import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {AriaDelegateController} from '@tecton-wc/core/controllers/aria-delegate.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {IdController} from '@tecton-wc/core/utils/id.js';
import base from '../styles/base.styles.css';
import {listContext} from './list.context.js';
import {
  LIST_DENSITIES,
  LIST_EDGE_COMPENSATIONS,
  LIST_STYLES,
  type ListContextValue,
  type ListDensity,
  type ListEdgeCompensation,
  type ListStyle,
} from './list.types.js';
import styles from './tct-list.styles.css';

/**
 * A vertical collection of items with consistent spacing, dividers and optional markers. Put
 * `tct-list-item` children in it. The list exposes the semantic list (`role="list"`, an `<ol>` for
 * `list-style="decimal"`), names it from its header, and provides density, dividers, marker style and
 * edge compensation to every item.
 *
 * `aria-label`, `aria-labelledby` and other ARIA attributes on the host are delegated to the inner list.
 * A visible header always names the list; without one, an `aria-labelledby` you set (which may point
 * outside the component) or an `aria-label` names it.
 *
 * @summary A vertical collection of items with density, dividers, markers and a header.
 * @tag tct-list
 * @upstream List
 * @slot - The list items (`tct-list-item`).
 * @slot header - Rich header content; overrides the `header` attribute.
 * @csspart list - The list element.
 * @csspart header - The header wrapper.
 * @cloakDisplay block
 */
export class TctList extends TctElement {
  static override readonly tagName = 'tct-list';
  static override styles: CSSResultGroup = [base, styles];

  /** Row spacing of every item: `compact`, `balanced` (default) or `spacious`. */
  @property({reflect: true}) density: ListDensity = 'balanced';

  /** Show dividers between items. */
  @property({type: Boolean, reflect: true, attribute: 'has-dividers'}) hasDividers = false;

  /**
   * Cancels each item's own inline inset, up to the container padding available on each edge, to bring
   * row content toward sibling content such as a section heading. Omit to leave item positions
   * unchanged. The header never moves. The container publishes its padding as
   * `--_container-padding-inline-start` and `--_container-padding-inline-end`.
   */
  @property({reflect: true, attribute: 'edge-compensation'}) edgeCompensation:
    ListEdgeCompensation | undefined;

  /** Header text, associated with the list as its accessible name. Rich content goes in `slot="header"`. */
  @property() header = '';

  /** Marker style. `decimal` numbers the rows and renders an ordered list. */
  @property({reflect: true, attribute: 'list-style'}) listStyle: ListStyle = 'none';

  /** First number of a numbered list (`list-style="decimal"`). */
  @property({type: Number}) start = 1;

  readonly #slots: SlotController = new SlotController(this, 'header');
  readonly #ids: IdController = new IdController(this, 'tct-list');
  readonly #context: ContextProvider<typeof listContext> = new ContextProvider<typeof listContext>(
    this,
    {
      context: listContext,
      initialValue: null,
    },
  );
  constructor() {
    super();
    // Mirrors host aria-* onto the inner list; it syncs on connect and after every host update.
    new AriaDelegateController(this, {
      target: () => this.renderRoot?.querySelector('.list'),
      // A visible header names the list; the list's own association wins over a delegated one.
      exclude: () => (this.#hasHeader ? ['aria-labelledby'] : []),
    });
  }

  get #hasHeader(): boolean {
    return this.header !== '' || this.#slots.has('header');
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('density') && !LIST_DENSITIES.includes(this.density)) {
      devWarn(
        `list:density:${this.density}`,
        `<tct-list density="${this.density}"> is not one of ${LIST_DENSITIES.join(', ')}.`,
      );
    }
    if (changed.has('listStyle') && !LIST_STYLES.includes(this.listStyle)) {
      devWarn(
        `list:list-style:${this.listStyle}`,
        `<tct-list list-style="${this.listStyle}"> is not one of ${LIST_STYLES.join(', ')}.`,
      );
    }
    if (
      changed.has('edgeCompensation') &&
      this.edgeCompensation !== undefined &&
      !LIST_EDGE_COMPENSATIONS.includes(this.edgeCompensation)
    ) {
      devWarn(
        `list:edge-compensation:${this.edgeCompensation}`,
        `<tct-list edge-compensation="${this.edgeCompensation}"> only supports "inline".`,
      );
    }
    const value: ListContextValue = {
      density: LIST_DENSITIES.includes(this.density) ? this.density : 'balanced',
      hasDividers: this.hasDividers,
      listStyle: LIST_STYLES.includes(this.listStyle) ? this.listStyle : 'none',
      edgeCompensation: this.edgeCompensation === 'inline' ? 'inline' : undefined,
    };
    const current = this.#context.value;
    if (
      current?.density !== value.density ||
      current.hasDividers !== value.hasDividers ||
      current.listStyle !== value.listStyle ||
      current.edgeCompensation !== value.edgeCompensation
    ) {
      this.#context.setValue(value);
    }
  }

  protected override render(): TemplateResult {
    const listStyle = LIST_STYLES.includes(this.listStyle) ? this.listStyle : 'none';
    const hasHeader = this.#hasHeader;
    const headerId = this.#ids.id('header');
    const ordered = listStyle === 'decimal';
    const hasMarkers = listStyle !== 'none';
    const start = Number.isFinite(this.start) ? Math.trunc(this.start) : 1;
    const counterStart = styleMap(hasMarkers ? {'--_counter-start': String(start - 1)} : {});

    // The explicit role restores "list, N items" for `list-style: none` in Safari/VoiceOver.
    const list = ordered
      ? html`<ol
          class="list"
          part="list"
          role="list"
          start=${start !== 1 ? start : nothing}
          aria-labelledby=${hasHeader ? headerId : nothing}
          ?data-dividers=${this.hasDividers}
          ?data-markers=${hasMarkers}
          style=${counterStart}
        >
          <slot></slot>
        </ol>`
      : html`<ul
          class="list"
          part="list"
          role="list"
          aria-labelledby=${hasHeader ? headerId : nothing}
          ?data-dividers=${this.hasDividers}
          ?data-markers=${hasMarkers}
          style=${counterStart}
        >
          <slot></slot>
        </ul>`;

    return html`${
      hasHeader
        ? html`<div class="header" part="header" id=${headerId}>
            <slot name="header">${this.header}</slot>
          </div>`
        : nothing
    }${list}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-list': TctList;
  }
}
