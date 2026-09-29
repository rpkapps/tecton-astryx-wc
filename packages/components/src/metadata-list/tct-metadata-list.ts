import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
// Aliased: `tct/no-create-tct-element` flags every `new Tct*()`, event classes included (see requests).
import {TctOpenChangeEvent as OpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {IdController} from '@tecton-wc/core/utils/id.js';
import defaults from '@tecton-wc/locales/en/metadataList.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {
  METADATA_LIST_LABEL_POSITIONS,
  METADATA_LIST_ORIENTATIONS,
  parseColumns,
  parseLabelWidth,
  type MetadataListColumns,
  type MetadataListLabelPosition,
  type MetadataListOrientation,
} from './metadata-list.types.js';
import styles from './tct-metadata-list.styles.css';

/**
 * Key-value pairs for the attributes of an object (quality, condition, status) in a structured layout:
 * one column, several, or a wrapping row, with labels beside or above the values, and a "Show more"
 * toggle that collapses a long list. Put `tct-metadata-list-item` children in it.
 *
 * Semantics: the list is a `list` and each pair a `listitem` containing a `term` (the label) and a
 * `definition` (the value), so a screen reader announces "list, N items" and each pair's label and value
 * (an item cannot be both a `<dt>` and a `<dd>`, and a `<dl>` cannot own custom-element children).
 * Collapsed items are hidden (`display: none`), so they are not read either.
 *
 * @summary Key-value pairs with column layout, label position, orientation and collapse.
 * @tag tct-metadata-list
 * @upstream MetadataList
 * @slot - The `tct-metadata-list-item` children.
 * @slot heading - Rich heading content; overrides the `heading` attribute.
 * @csspart metadata-list - The painted wrapper.
 * @csspart heading - The heading wrapper.
 * @csspart list - The grid of pairs.
 * @csspart toggle - The "Show more" / "Show less" button.
 * @fires tct-open-change - The user toggles "Show more" / "Show less"; `open` is the requested state (cancelable).
 * @cloakDisplay block
 */
export class TctMetadataList extends TctElement {
  static override readonly tagName = 'tct-metadata-list';
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /**
   * Column layout: `single` (default), `multi` (as many columns as fit) or a whole number of columns
   * (upstream `columns`). Ignored when `orientation="horizontal"`.
   */
  @property({
    converter: {
      fromAttribute: parseColumns,
      toAttribute: (value: MetadataListColumns) => String(value),
    },
  })
  columns: MetadataListColumns = 'single';

  /**
   * Where labels sit (upstream `label.position`): `start` beside the value, `top` above it. Defaults to
   * `start` for a single column and `top` for several columns.
   */
  @property({attribute: 'label-position'}) labelPosition: MetadataListLabelPosition | undefined;

  /**
   * Width of the label column with `start` labels (upstream `label.width`): a number is CSS pixels, a
   * string any CSS length.
   */
  @property({attribute: 'label-width', converter: {fromAttribute: parseLabelWidth}}) labelWidth:
    string | number | undefined;

  /**
   * Maximum number of items shown before the rest collapse behind a "Show more" toggle. Unset shows
   * everything. Ignored when `orientation="horizontal"`.
   */
  @property({type: Number, attribute: 'max-num-of-items'}) maxNumOfItems: number | undefined;

  /** `vertical` (default) stacks the pairs; `horizontal` flows them in a wrapping row, labels above. */
  @property({reflect: true}) orientation: MetadataListOrientation = 'vertical';

  /** Heading text (upstream `title`). Rich content goes in `slot="heading"`. */
  @property() heading = '';

  /** Whether the collapsed items are shown. The attribute is the initial state; the user toggles it. */
  @property({type: Boolean, reflect: true}) expanded = false;

  /** Overrides the "Show more" label. */
  @property({attribute: 'show-more-label'}) showMoreLabel = '';

  /** Overrides the "Show less" label. */
  @property({attribute: 'show-less-label'}) showLessLabel = '';

  readonly #slots: SlotController = new SlotController(this, 'heading');
  readonly #ids: IdController = new IdController(this, 'tct-metadata-list');
  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'metadataList',
    defaults,
  });

  /** The light-DOM pairs, in order (everything except the heading slot). */
  #items(): HTMLElement[] {
    return [...this.children].filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.getAttribute('slot') !== 'heading',
    );
  }

  get #isHorizontal(): boolean {
    return this.orientation === 'horizontal';
  }

  get #labelPosition(): MetadataListLabelPosition {
    if (this.#isHorizontal) return 'top';
    if (this.labelPosition && METADATA_LIST_LABEL_POSITIONS.includes(this.labelPosition)) {
      return this.labelPosition;
    }
    // Side labels do not work well when items sit in separate grid cells.
    const multiColumn =
      this.columns === 'multi' || (typeof this.columns === 'number' && this.columns > 1);
    return multiColumn ? 'top' : 'start';
  }

  /** The item cap in effect: none in horizontal mode, and only a positive whole number counts. */
  get #cap(): number | undefined {
    if (this.#isHorizontal) return undefined;
    const max = this.maxNumOfItems;
    return max !== undefined && Number.isFinite(max) && max >= 0 ? Math.floor(max) : undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('orientation') && !METADATA_LIST_ORIENTATIONS.includes(this.orientation)) {
      devWarn(
        `metadata-list:orientation:${this.orientation}`,
        `<tct-metadata-list orientation="${this.orientation}"> is not one of ${METADATA_LIST_ORIENTATIONS.join(', ')}.`,
      );
    }
  }

  protected override updated(): void {
    this.#collapse();
  }

  /** Marks the items past the cap; the shadow stylesheet hides them (`::slotted`). */
  #collapse(): void {
    const cap = this.#cap;
    const hide = cap !== undefined && !this.expanded;
    this.#items().forEach((item, index) => {
      item.toggleAttribute('data-tct-collapsed', hide && index >= cap);
    });
  }

  readonly #onToggle = (): void => {
    const next = !this.expanded;
    // Intent event: cancelable, dispatched before the change (A§7.6).
    if (!this.dispatch(new OpenChangeEvent(next, 'trigger'))) return;
    this.expanded = next;
  };

  protected override render(): TemplateResult {
    const orientation = METADATA_LIST_ORIENTATIONS.includes(this.orientation)
      ? this.orientation
      : 'vertical';
    const horizontal = orientation === 'horizontal';
    const mode = horizontal ? 'horizontal' : this.#labelPosition === 'top' ? 'stacked' : 'side';
    const columns = this.columns;
    const count = typeof columns === 'number' && columns > 1 ? columns : undefined;
    const numeric = !horizontal && count !== undefined;
    const width = this.labelWidth;
    // A custom label width applies to the label track of side labels only (numeric columns win).
    const labelWidth =
      !horizontal && mode === 'side' && !numeric && width !== undefined
        ? typeof width === 'number'
          ? `${width}px`
          : width
        : undefined;

    const cap = this.#cap;
    const itemCount = this.#items().length;
    const exceeds = cap !== undefined && itemCount > cap;
    const contentId = this.#ids.id('content');
    const hasHeading = this.heading !== '' || this.#slots.has('heading');

    const showMore = this.showMoreLabel || this.#locale.t('showMore');
    const showLess = this.showLessLabel || this.#locale.t('showLess');

    return html`<div class="root" part="metadata-list">
      ${
        hasHeading
          ? html`<div class="heading" part="heading">
              <slot name="heading">${this.heading}</slot>
            </div>`
          : nothing
      }
      <div
        class="list"
        part="list"
        id=${contentId}
        role="list"
        data-mode=${mode}
        data-columns=${horizontal ? nothing : typeof columns === 'number' ? String(columns) : columns}
        data-count=${numeric ? String(count) : nothing}
        style=${styleMap({
          ...(numeric ? {'--_count': String(count)} : {}),
          ...(labelWidth ? {'--_label-width': labelWidth} : {}),
        })}
      >
        <slot @slotchange=${this.#onSlotChange}></slot>
      </div>
      ${
        exceeds
          ? html`<button
              class="toggle focus-ring"
              part="toggle"
              type="button"
              aria-controls=${contentId}
              aria-expanded=${this.expanded ? 'true' : 'false'}
              @click=${this.#onToggle}
            >
              ${this.expanded ? showLess : showMore}
            </button>`
          : nothing
      }
    </div>`;
  }

  readonly #onSlotChange = (): void => {
    this.requestUpdate();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-metadata-list': TctMetadataList;
  }
}
