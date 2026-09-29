import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {
  OverflowController,
  type OverflowMeasurement,
  type OverflowSettings,
} from '@tecton-wc/core/controllers/overflow.js';
import {
  TctOverflowChangeEvent as OverflowChangeEvent,
  type OverflowItem,
} from '@tecton-wc/core/events/tct-overflow-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import defaults from '@tecton-wc/locales/en/overflow-list.js';
import base from '../styles/base.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {
  OVERFLOW_LIST_BEHAVIORS,
  OVERFLOW_LIST_COLLAPSE_FROM,
  OVERFLOW_LIST_GAPS,
  parseGap,
  type OverflowListBehavior,
  type OverflowListCollapseFrom,
  type OverflowListGap,
  type OverflowRenderer,
} from './overflow-list.types.js';
import styles from './tct-overflow-list.styles.css';

// Identity of an item across re-measurements, so a membership change with the same count is reported.
let nextItemId = 0;
const itemIds = new WeakMap<Element, number>();
const itemId = (element: Element): number => {
  let id = itemIds.get(element);
  if (id === undefined) {
    id = ++nextItemId;
    itemIds.set(element, id);
  }
  return id;
};

/**
 * A horizontal list that hides the items that do not fit its width, collapsing them from the end (or
 * the start) into an indicator you render. Use it for breadcrumbs, toolbars, tag lists and any row that
 * must degrade gracefully as it narrows. Every child is an item; the visible ones stay where they are
 * in the DOM, and collapsed ones are hidden (`display: none`), so they leave the tab order and the
 * accessibility tree.
 *
 * `overflowRenderer` returns the indicator for the collapsed items (a "+N" chip, a menu). It is rendered
 * inside the list, and once more, hidden, for all items, so the list can reserve its widest width and
 * the row never oscillates. With no renderer nothing is drawn for the collapsed items, unless
 * `show-count` asks for the built-in "+N" indicator (named "N more" for assistive technology). When the
 * row already has its own menu, listen for `tct-overflow-change` and feed the collapsed items into it.
 *
 * @summary A row that collapses the items that do not fit into an indicator.
 * @tag tct-overflow-list
 * @upstream OverflowList
 * @slot - The items. Each child is one item.
 * @csspart overflow-list - The visible row.
 * @csspart indicator - The wrapper of the indicator returned by `overflowRenderer`.
 * @csspart count - The built-in "+N" indicator (`show-count`).
 * @fires tct-overflow-change - The set of collapsed items changed; `items` holds the collapsed items and their indices.
 * @cloakDisplay block
 */
export class TctOverflowList extends TctElement {
  static override readonly tagName = 'tct-overflow-list';
  static override styles: CSSResultGroup = [base, visuallyHidden, styles];

  /** Gap between items as a spacing step (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8 or 10). */
  @property({converter: {fromAttribute: parseGap, toAttribute: (value: number) => String(value)}})
  gap: OverflowListGap = 2;

  /** Minimum number of items to always show, even when they do not fit. */
  @property({type: Number, attribute: 'min-visible-items'}) minVisibleItems = 0;

  /**
   * Maximum number of items ever shown, even when they all fit. If it is less than `min-visible-items`,
   * the floor wins (and a warning is logged in dev mode). Unset: no cap.
   */
  @property({type: Number, attribute: 'max-visible-items'}) maxVisibleItems: number | undefined;

  /**
   * Wrap items across up to this many rows before collapsing the rest into the indicator. Unset (or 1)
   * keeps a single line. A number, not a boolean: unbounded wrapping is a plain flex-wrap layout.
   * Assumes uniform row height.
   */
  @property({type: Number, attribute: 'max-rows'}) maxRows: number | undefined;

  /** Which end to collapse items from. */
  @property({reflect: true, attribute: 'collapse-from'}) collapseFrom: OverflowListCollapseFrom =
    'end';

  /**
   * Which element's width decides how many items fit: `observe-self` (default) uses the list's own
   * width; `observe-parent` uses the parent's content width, so the list can stay content-sized while
   * still noticing room to grow back.
   */
  @property({reflect: true}) behavior: OverflowListBehavior = 'observe-self';

  /** Renders the built-in "+N" indicator, named "N more" for assistive technology, when there is no `overflowRenderer`. */
  @property({type: Boolean, attribute: 'show-count'}) showCount = false;

  /**
   * Renders the indicator for the collapsed items (upstream `overflowRenderer`): a template, a node or
   * text, never HTML. Called with the collapsed items (each with its element and original index) when
   * items overflow, and once more, hidden, with all items, to measure the widest indicator.
   */
  @property({attribute: false}) overflowRenderer: OverflowRenderer | undefined;

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'overflow-list',
    defaults,
  });
  readonly #overflow: OverflowController = new OverflowController(this, {
    targets: (): (Element | null | undefined)[] => [
      this.renderRoot?.querySelector('.list'),
      this.renderRoot?.querySelector('.measure'),
      this.behavior === 'observe-parent' ? this.#parent() : undefined,
    ],
    read: () => this.#read(),
    options: () => this.#settings(),
    onResult: () => {
      this.#sync();
    },
  });
  /** Items currently marked collapsed (restored after a measurement reveals everything). */
  #marked = new Set<HTMLElement>();
  #reportedKey = '[]';
  #dirty = true;

  #items(): HTMLElement[] {
    return [...this.children].filter((child): child is HTMLElement => child instanceof HTMLElement);
  }

  #parent(): HTMLElement | null {
    const root = this.getRootNode();
    return this.parentElement ?? (root instanceof ShadowRoot ? (root.host as HTMLElement) : null);
  }

  #settings(): OverflowSettings {
    const list = this.renderRoot?.querySelector('.list');
    const gap = list ? Number.parseFloat(getComputedStyle(list).columnGap) : 0;
    return {
      gap: Number.isFinite(gap) ? gap : 0,
      minVisibleItems: Number.isFinite(this.minVisibleItems)
        ? Math.max(0, this.minVisibleItems)
        : 0,
      maxVisibleItems:
        this.maxVisibleItems !== undefined && Number.isFinite(this.maxVisibleItems)
          ? Math.max(0, this.maxVisibleItems)
          : undefined,
      maxRows:
        this.maxRows !== undefined && Number.isFinite(this.maxRows) ? this.maxRows : undefined,
      collapseFrom: this.collapseFrom === 'start' ? 'start' : 'end',
    };
  }

  /**
   * Measures in one synchronous pass: reveal every item, read natural widths, restore the hidden ones.
   * No paint happens in between, so a re-measurement never flickers.
   */
  #read(): OverflowMeasurement | null {
    const list = this.renderRoot?.querySelector<HTMLElement>('.list');
    if (!list) return null;
    const items = this.#items();
    for (const item of items) item.removeAttribute('data-tct-overflow');
    try {
      const widths = items.map((item) => item.getBoundingClientRect().width);
      const rowHeight = items.reduce((max, item) => Math.max(max, item.offsetHeight), 0);
      const measure = this.renderRoot.querySelector<HTMLElement>('.measure .indicator');
      let availableWidth: number;
      if (this.behavior === 'observe-parent' && this.#parent()) {
        const parent = this.#parent()!;
        const style = getComputedStyle(parent);
        availableWidth =
          parent.clientWidth -
          Number.parseFloat(style.paddingLeft || '0') -
          Number.parseFloat(style.paddingRight || '0');
      } else {
        availableWidth = list.getBoundingClientRect().width;
      }
      return {
        availableWidth,
        widths,
        indicatorWidth: measure ? measure.getBoundingClientRect().width : 0,
        rowHeight,
      };
    } finally {
      for (const item of this.#marked) {
        if (item.isConnected) item.setAttribute('data-tct-overflow', '');
      }
    }
  }

  /** The visible count now, before the first measurement every item counts as visible. */
  get #visibleCount(): number {
    const count = this.#items().length;
    return this.#overflow.measured ? Math.min(this.#overflow.visibleCount, count) : count;
  }

  #overflowItems(): OverflowItem[] {
    const items = this.#items();
    const visible = this.#visibleCount;
    const collapsed =
      this.collapseFrom === 'start'
        ? items.slice(0, items.length - visible).map((element, index) => ({element, index}))
        : items.slice(visible).map((element, index) => ({element, index: visible + index}));
    return collapsed;
  }

  /** Applies the collapsed marks to the items, then reports the collapsed set when it changed. */
  #sync(): void {
    const collapsed = this.#overflowItems();
    const next = new Set(collapsed.map((item) => item.element));
    for (const item of this.#items()) {
      item.toggleAttribute('data-tct-overflow', next.has(item));
    }
    this.#marked = next;
    this.#report(collapsed);
  }

  /**
   * Reports the collapsed set: silent while nothing overflows (including on mount), and it fires again
   * with an empty set once everything fits. Keyed on the collapsed items' indices and identities, so a
   * membership or order change with the same count is reported and an unrelated update is not.
   */
  #report(collapsed: readonly OverflowItem[]): void {
    if (!this.#overflow.measured) return;
    const key = JSON.stringify(collapsed.map(({element, index}) => [index, itemId(element)]));
    if (key === this.#reportedKey) return;
    this.#reportedKey = key;
    this.dispatch(new OverflowChangeEvent(collapsed));
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.size > 0) this.#dirty = true;
    if (changed.has('collapseFrom') && !OVERFLOW_LIST_COLLAPSE_FROM.includes(this.collapseFrom)) {
      devWarn(
        `overflow-list:collapse-from:${this.collapseFrom}`,
        `<tct-overflow-list collapse-from="${this.collapseFrom}"> is not one of ${OVERFLOW_LIST_COLLAPSE_FROM.join(', ')}.`,
      );
    }
    if (changed.has('behavior') && !OVERFLOW_LIST_BEHAVIORS.includes(this.behavior)) {
      devWarn(
        `overflow-list:behavior:${this.behavior}`,
        `<tct-overflow-list behavior="${this.behavior}"> is not one of ${OVERFLOW_LIST_BEHAVIORS.join(', ')}.`,
      );
    }
    if (
      (changed.has('minVisibleItems') || changed.has('maxVisibleItems')) &&
      this.maxVisibleItems !== undefined &&
      this.maxVisibleItems < this.minVisibleItems
    ) {
      devWarn(
        'overflow-list:max-lt-min',
        `<tct-overflow-list max-visible-items="${this.maxVisibleItems}"> is less than ` +
          `min-visible-items="${this.minVisibleItems}"; the floor wins and ${this.minVisibleItems} items will be shown.`,
      );
    }
  }

  protected override updated(): void {
    // Re-measure after a settings or children change; the result of a measurement re-renders the list
    // without either, and must not measure again.
    if (!this.#dirty) return;
    this.#dirty = false;
    this.#overflow.measure();
    this.#sync();
  }

  readonly #onSlotChange = (): void => {
    this.#dirty = true;
    this.requestUpdate();
  };

  /** The indicator content for `items`; `undefined` when there is none (no renderer, no `show-count`). */
  #indicatorContent(items: readonly OverflowItem[]): TemplateResult | Node | string | undefined {
    if (this.overflowRenderer) return this.overflowRenderer(items) ?? undefined;
    if (!this.showCount) return undefined;
    return html`<span class="count" part="count"
      ><span aria-hidden="true">+${items.length}</span
      ><span class="visually-hidden"
        >${this.#locale.t('overflow', {count: items.length})}</span
      ></span
    >`;
  }

  protected override render(): TemplateResult {
    const items = this.#items();
    const collapsed = this.#overflowItems();
    const hasOverflow =
      this.#overflow.measured && this.#overflow.hasOverflow && collapsed.length > 0;
    const rows = this.maxRows !== undefined && this.maxRows > 1;
    const step = OVERFLOW_LIST_GAPS.includes(this.gap) ? this.gap : 2;
    const content = hasOverflow ? this.#indicatorContent(collapsed) : undefined;
    const indicator =
      content === undefined
        ? nothing
        : html`<div class="indicator" part="indicator">${content}</div>`;
    // The widest indicator, for every item, is measured from a hidden inert copy.
    const measured = this.#indicatorContent(items.map((element, index) => ({element, index})));

    return html`<div class="measure" aria-hidden="true" inert>
        ${measured === undefined ? nothing : html`<div class="indicator">${measured}</div>`}
      </div>
      <div
        class="list"
        part="overflow-list"
        ?data-rows=${rows}
        ?data-fill=${this.behavior === 'observe-parent' && hasOverflow}
        style=${styleMap({
          '--_gap': `var(--spacing-${String(step).replace('.', '-')})`,
          ...(rows && this.#overflow.rowHeight > 0
            ? {
                '--_max-block-size': `calc(${this.#overflow.rowHeight}px * ${this.maxRows} + var(--_gap) * ${(this.maxRows ?? 1) - 1})`,
              }
            : {}),
        })}
      >
        ${this.collapseFrom === 'start' ? indicator : nothing}<slot
          @slotchange=${this.#onSlotChange}
        ></slot
        >${this.collapseFrom === 'start' ? nothing : indicator}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-overflow-list': TctOverflowList;
  }
}
