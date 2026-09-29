import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {repeat} from 'lit/directives/repeat.js';
import {styleMap} from 'lit/directives/style-map.js';
import {AriaDelegateController} from '@tecton-wc/core/controllers/aria-delegate.js';
import {INTERACTIVE_SELECTORS} from '@tecton-wc/core/controllers/clickable-container.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TreeFocusController} from '@tecton-wc/core/controllers/tree-focus.js';
import {TctTreeToggleEvent as TreeToggleEvent} from '@tecton-wc/core/events/tct-tree-toggle.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {IdController} from '@tecton-wc/core/utils/id.js';
import {safeUrl} from '@tecton-wc/core/utils/safe-url.js';
import defaults from '@tecton-wc/locales/en/treeList.js';
import {TctIcon} from '../icon/tct-icon.js';
import base from '../styles/base.styles.css';
import styles from './tct-tree-list.styles.css';
import {
  TREE_LIST_DENSITIES,
  TREE_LIST_VARIANTS,
  type TreeListDensity,
  type TreeListItemData,
  type TreeListVariant,
} from './tree-list.types.js';

/** What is known about an item outside the render walk: for focus recovery and expansion state. */
interface NodeInfo {
  readonly item: TreeListItemData;
  readonly parentId: string | undefined;
}

const BLANK_TARGET_REL_TOKENS = ['noopener', 'noreferrer'] as const;

function mergeRel(target: string | undefined): string | undefined {
  return target === '_blank' ? BLANK_TARGET_REL_TOKENS.join(' ') : undefined;
}

/**
 * An expandable tree for hierarchical data (file explorers, nested category browsers), with connector
 * guide lines, expand and collapse, and interactive rows. The data is the `items` array: each item has
 * an `id`, a `label`, and optional `children`, content for the start and end, and a click handler or
 * URL. Expansion is owned by the tree: `isExpanded` on an item is its initial state, and the user (or
 * `expand()` / `collapse()`) changes it from there; a collapsed branch is not rendered.
 *
 * The keyboard model is the WAI-ARIA tree pattern: the tree is one tab stop (the selected, or first
 * enabled, item); Up/Down move over the visible items, Right expands or steps into a branch, Left
 * collapses or steps to the parent (mirrored in RTL), Home/End jump, Enter and Space activate, and
 * typing jumps to the next item whose label starts with the typed text. When the focused item leaves
 * the tree (collapsed away, filtered out) focus moves to the nearest item that is still there instead
 * of dropping to the page.
 *
 * Interaction: a click on a row runs the item's `onClick` (or toggles a branch without one); a click on
 * nested interactive content in `startContent` or `endContent` belongs to that content. The row's own
 * button or link, and the toggle, are not tab stops: the treeitem is.
 *
 * @summary An expandable tree of items with guide lines and the WAI-ARIA tree keyboard model.
 * @tag tct-tree-list
 * @upstream TreeList
 * @slot header - Rich header content; names the tree. Overrides the `header` attribute.
 * @csspart tree-list - The wrapper of the header and the tree.
 * @csspart header - The header wrapper.
 * @csspart tree - The `role="tree"` list.
 * @csspart tree-list-item - A row; also carries `tree-list-item-selected`, `tree-list-item-disabled` and the item's own `part` tokens.
 * @csspart tree-list-chevron - The expand/collapse toggle; also `tree-list-chevron-expanded` or `-collapsed`.
 * @csspart tree-list-item-label - The label; also `tree-list-item-label-selected`.
 * @csspart tree-list-guide - A connector guide line.
 * @cssprop --tree-list-indent - Indent per nesting level. Default `var(--spacing-4)`. Rows and guides both read it, so they stay aligned.
 * @cssprop --tree-list-row-gap - Vertical gap between adjacent rows. Default `var(--spacing-0-5)`. The guide spans it, so the line stays continuous.
 * @fires tct-tree-toggle - The user expands or collapses a branch (cancelable); `id`, `expanded` (the requested state) and `reason`.
 * @cloakDisplay block
 * @cloakMinBlockSize 2rem
 */
export class TctTreeList extends TctElement {
  static override readonly tagName = 'tct-tree-list';
  static override readonly dependencies = [TctIcon];
  static override styles: CSSResultGroup = [base, styles];

  /** The tree as data: each item has an `id`, a `label` and optional `children` (see `TreeListItemData`). */
  @property({attribute: false}) items: TreeListItemData[] = [];

  /** Row spacing: `compact`, `balanced` (default) or `spacious`. */
  @property({reflect: true}) density: TreeListDensity = 'balanced';

  /** Guide lines: `lineGuides` (default) draws connectors between parent and child rows; `noGuides` draws none. */
  @property({reflect: true}) variant: TreeListVariant = 'lineGuides';

  /** Header text, associated with the tree as its accessible name. Rich content goes in `slot="header"`. */
  @property() header = '';

  /** Overrides the accessible name of the expand/collapse toggle ("Toggle children"). */
  @property({attribute: 'toggle-children-label'}) toggleChildrenLabel = '';

  readonly #slots = new SlotController(this, 'header');
  readonly #ids = new IdController(this, 'tct-tree-list');
  readonly #locale = new LocaleController(this, {namespace: 'treeList', defaults});
  readonly #focus: TreeFocusController = new TreeFocusController(this, {
    tree: () => this.renderRoot?.querySelector<HTMLElement>('.tree'),
    rovingTabindex: true,
    // The item's own label, not the text of its whole subtree.
    getLabel: (item) => item.querySelector(':scope > .row-wrapper .label')?.textContent ?? '',
    onToggleExpand: (id) => {
      this.#userToggle(id, 'keyboard');
    },
    onActivate: (item) => this.#activate(item),
    onActiveChange: (id) => {
      this.#tabId = id;
    },
  });

  /** User overrides of expansion, by id; persists across `items` replacements (upstream). */
  readonly #overrides = new Map<string, boolean>();
  #dataExpanded = new Set<string>();
  #nodes = new Map<string, NodeInfo>();
  #hasExpandable = false;
  /** The item that owns the roving tab stop. */
  #tabId: string | undefined;
  #visible: string[] = [];
  #recover: {id: string | undefined; previous: readonly string[]} | undefined;
  readonly #nids = new Map<string, number>();

  constructor() {
    super();
    // Mirrors host aria-label / aria-labelledby onto the inner tree.
    new AriaDelegateController(this, {
      target: () => this.renderRoot?.querySelector('.tree'),
      exclude: () => (this.#hasHeader ? ['aria-labelledby'] : []),
    });
  }

  // ----------------------------------------------------------------------------- public API

  /** Expands a branch (programmatic: no `tct-tree-toggle`). */
  expand(id: string): void {
    this.#setExpanded(id, true);
  }

  /** Collapses a branch (programmatic: no `tct-tree-toggle`). */
  collapse(id: string): void {
    this.#setExpanded(id, false);
  }

  /** Toggles a branch, or sets it with `force` (programmatic: no `tct-tree-toggle`). */
  toggle(id: string, force?: boolean): void {
    this.#setExpanded(id, force ?? !this.#isExpanded(id));
  }

  /** Whether the branch with this id is currently expanded. */
  isExpanded(id: string): boolean {
    return this.#isExpanded(id);
  }

  /** Moves focus to the visible item with this id; returns whether there was one to focus. */
  focusItem(id: string): boolean {
    const li = this.#treeitem(id);
    if (!li) return false;
    this.#focus.focusItem(li);
    return true;
  }

  // ------------------------------------------------------------------------------ internals

  get #hasHeader(): boolean {
    return this.header !== '' || this.#slots.has('header');
  }

  #isExpanded(id: string): boolean {
    return this.#overrides.get(id) ?? this.#dataExpanded.has(id);
  }

  #setExpanded(id: string, expanded: boolean): void {
    if (this.#isExpanded(id) === expanded) return;
    this.#overrides.set(id, expanded);
    this.requestUpdate();
  }

  /** A user-initiated toggle: an intent event first (A§7.6), the change if not prevented. */
  #userToggle(id: string, reason: 'keyboard' | 'pointer'): void {
    const node = this.#nodes.get(id);
    if (!node || !this.#isExpandable(node.item)) return;
    const next = !this.#isExpanded(id);
    if (!this.dispatch(new TreeToggleEvent(id, next, reason))) return;
    this.#setExpanded(id, next);
  }

  #isExpandable(item: TreeListItemData): boolean {
    return (item.children?.length ?? 0) > 0 || item.expandable === true;
  }

  #treeitem(id: string): HTMLElement | null {
    return this.#focus.items.find((item) => item.dataset.treeId === id) ?? null;
  }

  /** Numeric id of an item, for ids that are valid IDREF tokens whatever the item id contains. */
  #nid(id: string): number {
    let value = this.#nids.get(id);
    if (value === undefined) {
      value = this.#nids.size + 1;
      this.#nids.set(id, value);
    }
    return value;
  }

  /** Enter/Space: click the treeitem's own action (link or button), never a descendant treeitem's. */
  #activate(current: HTMLElement): boolean {
    const candidates = current.querySelectorAll<HTMLElement>(
      'a[href], button:not([data-tree-toggle])',
    );
    for (const candidate of candidates) {
      if (candidate.closest('[role="treeitem"]') === current) {
        candidate.click();
        return true;
      }
    }
    return false;
  }

  #buildIndex(): void {
    this.#nodes = new Map();
    this.#dataExpanded = new Set();
    this.#hasExpandable = false;
    const seen = new Set<string>();
    const walk = (items: readonly TreeListItemData[], parentId: string | undefined): void => {
      for (const item of items) {
        if (seen.has(item.id)) {
          devWarn(
            `tree-list:duplicate:${item.id}`,
            `<tct-tree-list> has more than one item with id "${item.id}"; ids must be unique.`,
          );
        }
        seen.add(item.id);
        this.#nodes.set(item.id, {item, parentId});
        const children = item.children ?? [];
        if (this.#isExpandable(item)) this.#hasExpandable = true;
        if (item.isExpanded === true && children.length > 0) this.#dataExpanded.add(item.id);
        walk(children, item.id);
      }
    };
    walk(this.items, undefined);
  }

  #visibleIds(): string[] {
    const out: string[] = [];
    const walk = (items: readonly TreeListItemData[]): void => {
      for (const item of items) {
        out.push(item.id);
        const children = item.children ?? [];
        if (children.length > 0 && this.#isExpanded(item.id)) walk(children);
      }
    };
    walk(this.items);
    return out;
  }

  /** The item that should own the tab stop: the selected enabled one, else the first enabled. */
  #initialTabId(visible: readonly string[]): string | undefined {
    const enabled = visible.filter((id) => this.#nodes.get(id)?.item.isDisabled !== true);
    return enabled.find((id) => this.#nodes.get(id)?.item.isSelected === true) ?? enabled[0];
  }

  #focusWithin(): boolean {
    const tree = this.renderRoot?.querySelector('.tree');
    const active = this.shadowRoot?.activeElement;
    return !!tree && !!active && tree.contains(active);
  }

  #focusedId(): string | undefined {
    const active = this.shadowRoot?.activeElement;
    return active?.closest<HTMLElement>('[role="treeitem"]')?.dataset.treeId;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('density') && !TREE_LIST_DENSITIES.includes(this.density)) {
      devWarn(
        `tree-list:density:${this.density}`,
        `<tct-tree-list density="${this.density}"> is not one of ${TREE_LIST_DENSITIES.join(', ')}.`,
      );
    }
    if (changed.has('variant') && !TREE_LIST_VARIANTS.includes(this.variant)) {
      devWarn(
        `tree-list:variant:${this.variant}`,
        `<tct-tree-list variant="${this.variant}"> is not one of ${TREE_LIST_VARIANTS.join(', ')}.`,
      );
    }

    // Remember where focus is before the DOM changes, so it can be put back if its item disappears.
    this.#recover = this.#focusWithin()
      ? {id: this.#focusedId(), previous: this.#visible}
      : undefined;

    // Rebuilt on every update (cheap next to the render), so an in-place edit of `items` plus
    // `requestUpdate()` works as well as assigning a new array.
    this.#buildIndex();
    const visible = this.#visibleIds();
    this.#visible = visible;

    // Keep the tab stop on a visible, enabled item (a collapsed or removed one hands it back).
    const tab = this.#tabId === undefined ? undefined : this.#nodes.get(this.#tabId);
    if (
      this.#tabId === undefined ||
      !tab ||
      !visible.includes(this.#tabId) ||
      tab.item.isDisabled === true
    ) {
      this.#tabId = this.#initialTabId(visible);
    }
  }

  protected override updated(): void {
    const recover = this.#recover;
    this.#recover = undefined;
    if (recover && !this.#focusWithin()) this.#recoverFocus(recover.id, recover.previous);
  }

  /**
   * The focused item left the tree (its branch collapsed, or a filtered `items` dropped it): focus the
   * nearest item that is still there (walking back through the old visible order, then forward), so
   * keyboard users are never dropped onto the page.
   */
  #recoverFocus(id: string | undefined, previous: readonly string[]): void {
    const visible = new Set(this.#visible);
    const usable = (candidate: string): boolean =>
      visible.has(candidate) && this.#nodes.get(candidate)?.item.isDisabled !== true;
    const from = id === undefined ? -1 : previous.indexOf(id);
    let target: string | undefined;
    if (id !== undefined && usable(id)) target = id;
    for (let i = from - 1; target === undefined && i >= 0; i--) {
      if (usable(previous[i]!)) target = previous[i];
    }
    for (let i = from + 1; target === undefined && i < previous.length; i++) {
      if (usable(previous[i]!)) target = previous[i];
    }
    target ??= this.#initialTabId(this.#visible);
    if (target !== undefined) this.focusItem(target);
  }

  /** A click on the row: the item's action, or a toggle for a branch without one. */
  #onRowClick(event: MouseEvent, item: TreeListItemData): void {
    if (item.isDisabled === true) return;
    const row = event.currentTarget as HTMLElement;
    for (const node of event.composedPath()) {
      if (node === row) break;
      if (node instanceof Element && node.matches(INTERACTIVE_SELECTORS)) return;
    }
    if (item.onClick) item.onClick(event);
    else if (this.#isExpandable(item)) this.#userToggle(item.id, 'pointer');
  }

  #onChevronClick(event: MouseEvent, item: TreeListItemData): void {
    event.stopPropagation();
    if (item.isDisabled === true) return;
    this.#userToggle(item.id, 'pointer');
  }

  // ------------------------------------------------------------------------------- render

  #renderGuides(
    level: number,
    ancestorsIsLast: readonly boolean[],
    isLast: boolean,
  ): TemplateResult {
    return html`<div class="branches">
      ${ancestorsIsLast.map((ancestorIsLast, index) =>
        // Skip the column the item's own connector occupies (level - 1): it is drawn below.
        !ancestorIsLast && index !== level - 1
          ? html`<div class="guide-box" style="--_guide-level: ${index}">
              <div class="guide" part="tree-list-guide"></div>
            </div>`
          : nothing,
      )}
      ${
        level > 0
          ? html`<div class="guide-box" style="--_guide-level: ${level - 1}">
              <div class="guide" part="tree-list-guide" ?data-last=${isLast}></div>
            </div>`
          : nothing
      }
    </div>`;
  }

  #renderItems(
    items: readonly TreeListItemData[],
    level: number,
    ancestorsIsLast: readonly boolean[],
    density: TreeListDensity,
    guides: boolean,
    toggleLabel: string,
  ): TemplateResult {
    return html`${repeat(
      items,
      (item) => item.id,
      (item, index) => {
        const isLast = index === items.length - 1;
        const children = item.children ?? [];
        const hasChildren = children.length > 0;
        const expandable = this.#isExpandable(item);
        const expanded = expandable && this.#isExpanded(item.id);
        const disabled = item.isDisabled === true;
        const selected = item.isSelected === true;
        const hasAction = item.onClick !== undefined || item.href !== undefined;
        const n = this.#nid(item.id);
        const labelId = this.#ids.id(`label-${n}`);
        const descriptionId = this.#ids.id(`description-${n}`);
        const hasDescription = item.description !== undefined && item.description !== null;

        const labelAndDescription = html`<span
            class="label"
            id=${labelId}
            part="tree-list-item-label${selected ? ' tree-list-item-label-selected' : ''}"
            >${item.label}</span
          >${
            hasDescription
              ? html`<span class="description" id=${descriptionId}>${item.description}</span>`
              : nothing
          }`;

        let content: TemplateResult;
        if (item.href !== undefined) {
          const href = safeUrl(item.href, {allowData: true});
          content = html`<a
            class="action"
            href=${ifDefined(href ?? undefined)}
            target=${ifDefined(item.target)}
            rel=${ifDefined(mergeRel(item.target))}
            aria-disabled=${disabled ? 'true' : nothing}
            aria-labelledby=${labelId}
            aria-describedby=${hasDescription ? descriptionId : nothing}
            tabindex="-1"
            >${labelAndDescription}</a
          >`;
        } else if (item.onClick !== undefined) {
          content = html`<button
            class="action"
            type="button"
            ?disabled=${disabled}
            aria-labelledby=${labelId}
            aria-describedby=${hasDescription ? descriptionId : nothing}
            tabindex="-1"
            @click=${item.onClick}
          >
            ${labelAndDescription}
          </button>`;
        } else {
          content = html`<span class="content">${labelAndDescription}</span>`;
        }

        const rowParts = [
          'tree-list-item',
          selected ? 'tree-list-item-selected' : '',
          disabled ? 'tree-list-item-disabled' : '',
          item.part ?? '',
        ]
          .filter(Boolean)
          .join(' ');

        return html`<li
          class="item"
          role="treeitem"
          data-tree-id=${item.id}
          data-tree-level=${level + 1}
          ?data-tree-disabled=${disabled}
          aria-expanded=${expandable ? (expanded ? 'true' : 'false') : nothing}
          aria-selected=${selected ? 'true' : nothing}
          aria-disabled=${disabled ? 'true' : nothing}
          aria-level=${level + 1}
          aria-posinset=${index + 1}
          aria-setsize=${items.length}
          aria-labelledby=${labelId}
          aria-describedby=${hasDescription ? descriptionId : nothing}
          tabindex=${!disabled && item.id === this.#tabId ? '0' : '-1'}
        >
          ${guides ? this.#renderGuides(level, ancestorsIsLast, isLast) : nothing}
          <div class="row-wrapper">
            <div
              class="row"
              part=${rowParts}
              data-density=${density}
              ?data-reserve=${!expandable && this.#hasExpandable}
              ?data-interactive=${hasAction || (expandable && item.onClick === undefined)}
              ?data-selected=${selected}
              ?data-disabled=${disabled}
              style=${styleMap({'--_level': String(level), ...item.style})}
              @click=${(event: MouseEvent) => {
                this.#onRowClick(event, item);
              }}
            >
              ${
                expandable
                  ? html`<button
                      class="chevron"
                      part="tree-list-chevron tree-list-chevron-${expanded ? 'expanded' : 'collapsed'}"
                      type="button"
                      data-tree-toggle
                      tabindex="-1"
                      aria-expanded=${expanded ? 'true' : 'false'}
                      aria-label=${toggleLabel}
                      ?disabled=${disabled}
                      ?data-expanded=${expanded}
                      @click=${(event: MouseEvent) => {
                        this.#onChevronClick(event, item);
                      }}
                    >
                      <span class="chevron-icon"><tct-icon name="chevronRight"></tct-icon></span>
                    </button>`
                  : nothing
              }
              ${
                item.startContent != null && item.startContent !== ''
                  ? html`<span class="start">${item.startContent}</span>`
                  : nothing
              }
              ${content}
              ${
                item.endContent != null && item.endContent !== ''
                  ? html`<span class="end">${item.endContent}</span>`
                  : nothing
              }
            </div>
          </div>
          ${
            expanded && hasChildren
              ? html`<ul class="group" role="group">
                  ${this.#renderItems(
                    children,
                    level + 1,
                    [...ancestorsIsLast, isLast],
                    density,
                    guides,
                    toggleLabel,
                  )}
                </ul>`
              : nothing
          }
        </li>`;
      },
    )}`;
  }

  protected override render(): TemplateResult {
    const density = TREE_LIST_DENSITIES.includes(this.density) ? this.density : 'balanced';
    const guides = this.variant !== 'noGuides';
    const hasHeader = this.#hasHeader;
    const headerId = this.#ids.id('header');
    const toggleLabel = this.toggleChildrenLabel || this.#locale.t('toggleChildren');

    return html`<div class="root" part="tree-list">
      ${
        hasHeader
          ? html`<div class="header" part="header" id=${headerId}>
              <slot name="header">${this.header}</slot>
            </div>`
          : nothing
      }
      <ul
        class="tree"
        part="tree"
        role="tree"
        aria-labelledby=${hasHeader ? headerId : nothing}
        @keydown=${this.#focus.handleKeyDown}
        @focusin=${this.#focus.handleFocusIn}
      >
        ${this.#renderItems(this.items, 0, [], density, guides, toggleLabel)}
      </ul>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-tree-list': TctTreeList;
  }
}
