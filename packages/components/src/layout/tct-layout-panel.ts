import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {styleMap} from 'lit/directives/style-map.js';
import {layoutAreaContext} from '@tecton-wc/core/context/keys.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {
  ResizableController,
  type ResizableOptions,
  type ResizableProps,
} from '@tecton-wc/core/controllers/resizable.js';
import {ScrollableAreaController} from '@tecton-wc/core/controllers/scrollable-area.js';
import {TctCollapseChangeEvent} from '@tecton-wc/core/events/tct-collapse-change.js';
import {TctSizeChangeEvent} from '@tecton-wc/core/events/tct-size-change.js';
import {BoxPropsMixin} from '@tecton-wc/core/mixins/box-props.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {layoutSlotsContext, NO_LAYOUT_SLOTS} from './layout.context.js';
import styles from './tct-layout-panel.styles.css';

/** `snaps="56 160 260"` to numbers; anything that is not a non-negative number is dropped. */
const snapsConverter = {
  fromAttribute: (value: string | null): number[] | undefined => {
    if (value === null) return undefined;
    const numbers = value
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number)
      .filter((number) => Number.isFinite(number) && number >= 0);
    return numbers.length > 0 ? numbers : undefined;
  },
};

/**
 * A side panel of a `tct-layout`: navigation, settings or an inspector. Put it in the `start` slot for
 * a panel at the inline start (left in LTR) or in `end` for one at the inline end
 * (`<tct-layout-panel slot="start" width="240">`). Which slot it is in decides where its divider goes.
 *
 * The panel provides its own padding and scroll, so children need neither; `padding="0"` makes the
 * content edge to edge. `has-divider` draws a themed rule on the edge that faces the content. Without
 * one the spacing on that side collapses so the panel and the content read as one surface. (With a
 * `tct-resize-handle` that draws its own divider, leave `has-divider` off to avoid a double line.)
 * `width` sizes it (a number is px); it scrolls (`overflow: auto`) unless `no-scroll` is set, and while
 * it overflows with nothing tabbable inside it takes a tab stop so it can be scrolled from the keyboard.
 *
 * With `resizable` the panel is a resizable region: put a `tct-resize-handle` right after it (before
 * it for an end panel, with `reversed`). Configure the region with `default-size`, `min-size`,
 * `max-size` (a number or `Npx` is pixels, `N%` a share of `container`, else of the viewport),
 * `collapsible`, `collapsed-size`, `snaps` and `auto-save-id`; the size is always resolved pixels.
 * A `collapsed` panel takes no space and its content is hidden. Drive a region of your own by setting
 * `region` to a `ResizableController`.
 *
 * `landmark` gives the panel's box an ARIA landmark role (`navigation` or `complementary`, only for a
 * top-level layout) and `label` an accessible name.
 *
 * @summary Side panel of a layout with divider, scrolling and an optional resizable width.
 * @tag tct-layout-panel
 * @upstream LayoutPanel
 * @slot - The panel content.
 * @csspart base - The panel box: width, padding, divider and scrolling.
 * @cssprop --layout-padding-outer-x - Read: the inline padding at the layout's outer edge.
 * @cssprop --layout-padding-outer-y - Read: the block padding at the layout's outer edge.
 * @cssprop --layout-padding-inner-x - Read: the inline padding towards the content.
 * @cssprop --layout-padding-inner-y - Read: the block padding towards the header or footer.
 * @cssprop --container-padding-inline-start - Published for descendants that bleed to the panel edge: its inline-start padding.
 * @cssprop --container-padding-inline-end - Published: the inline-end padding.
 * @cssprop --container-padding-block-start - Published: the block-start padding.
 * @cssprop --container-padding-block-end - Published: the block-end padding.
 * @cssstate collapsed - The resizable panel is collapsed.
 * @fires tct-size-change - The user resized the panel; carries `size` (px) and `reason`. Not cancelable; written properties and `resize()` never emit it.
 * @fires tct-collapse-change - The user asks to collapse or expand the panel (a drag past the threshold, Enter or a double click on its handle); cancelable, carries `collapsed` and `reason`. `preventDefault()` keeps the state.
 * @cloakDisplay flex
 */
export class TctLayoutPanel extends BoxPropsMixin(TctElement) {
  static override readonly tagName = 'tct-layout-panel';
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /**
   * Draws a themed rule on the edge that faces the content: the inline end of a start panel, the
   * inline start of an end panel. Without one the spacing on that side collapses.
   */
  @property({type: Boolean, attribute: 'has-divider'}) hasDivider = false;

  /**
   * Turns scrolling off (`overflow: clip`), for auto-height layouts where sticky positioning has to
   * work against a parent that scrolls. Upstream `isScrollable` is `true` by default.
   */
  @property({type: Boolean, attribute: 'no-scroll'}) noScroll = false;

  /** Accessible name of the landmark; needed when `landmark` is set and several of that kind exist. */
  @property() label: string | undefined;

  /**
   * ARIA landmark role of the panel box (upstream `role`; renamed because a `role` attribute would
   * shadow the global one): `navigation` or `complementary`, only for a top-level layout.
   */
  @property() landmark: string | undefined;

  /**
   * Makes the panel a resizable region: its size is the region's size, resolved pixels, and the
   * `width` attribute is ignored. Pair it with a `tct-resize-handle`.
   */
  @property({type: Boolean}) resizable = false;

  /** Initial size of a resizable panel: a number or `Npx` is pixels, `N%` a share of the basis. Resolved once. Default 250. */
  @property({attribute: 'default-size'}) defaultSize: string | undefined;

  /** Live minimum size: a number or `Npx`, or `N%`. Default 50 px. */
  @property({attribute: 'min-size'}) minSize: string | undefined;

  /** Live maximum size: a number or `Npx`, or `N%`. Default unbounded. */
  @property({attribute: 'max-size'}) maxSize: string | undefined;

  /** Whether dragging the handle below `collapsed-size` collapses the panel to zero. */
  @property({type: Boolean}) collapsible = false;

  /** Size in px below which a drag collapses a collapsible panel. Default 40. */
  @property({type: Number, attribute: 'collapsed-size'}) collapsedSize: number | undefined;

  /** Sizes (px) the panel snaps to, as a space separated list (`snaps="56 160 260"`); it only rests on them. */
  @property({converter: snapsConverter}) snaps: number[] | undefined;

  /** Key that remembers the size and collapse state in `localStorage`. */
  @property({attribute: 'auto-save-id'}) autoSaveId: string | undefined;

  /**
   * The `id` of the element percentage sizes are a share of (its content box). Without one,
   * percentages are a share of the viewport width.
   */
  @property() container: string | undefined;

  /**
   * Whether the resizable panel is collapsed: it takes no space and its content is hidden. The
   * attribute is the initial state (a remembered state wins); it follows the user's gestures.
   */
  @property({type: Boolean, reflect: true}) collapsed = false;

  /**
   * A region of your own (a `ResizableController`) that drives the panel instead of the one the
   * `resizable` attribute creates. Property only.
   */
  @property({attribute: false}) region: ResizableProps | undefined;

  readonly #area: ContextConsumer<typeof layoutAreaContext> = new ContextConsumer<
    typeof layoutAreaContext
  >(this, {
    context: layoutAreaContext,
    subscribe: true,
  });
  readonly #slots: ContextConsumer<typeof layoutSlotsContext> = new ContextConsumer<
    typeof layoutSlotsContext
  >(this, {
    context: layoutSlotsContext,
    subscribe: true,
  });
  #unsubscribe: (() => void) | undefined;
  #subscribed: ResizableProps | undefined;

  readonly #own: ResizableController = new ResizableController(this, () => this.#options());

  readonly #scroll: ScrollableAreaController = new ScrollableAreaController(this, {
    viewport: () => this.#box,
    content: () => this.#box,
    slot: () => this.renderRoot?.querySelector('slot'),
    keyboardAccess: () => ({owner: 'implicit'}),
  });

  get #box(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.base') ?? null;
  }

  /** The region that sizes this panel: `region`, else the panel's own when `resizable`, else `undefined`. */
  get activeRegion(): ResizableProps | undefined {
    return this.region ?? (this.resizable ? this.#own : undefined);
  }

  /** Resizes a resizable panel to a size in px, without an event (it expands a collapsed one). */
  resize(size: number): void {
    const region = this.activeRegion;
    if (region instanceof ResizableController) region.resize(size);
  }

  /** Whether the panel is a tab stop right now (it scrolls and has nothing tabbable inside). */
  get isScrollable(): boolean {
    return this.#scroll.isScrollable;
  }

  // The size and padding properties are written on the host and read by the box inside (see the styles).
  protected override get boxTarget(): HTMLElement {
    return this;
  }

  #options(): ResizableOptions {
    return {
      defaultSize: this.defaultSize,
      minSize: this.minSize,
      maxSize: this.maxSize,
      collapsible: this.collapsible,
      collapsedSize: this.collapsedSize,
      snaps: this.snaps,
      autoSaveId: this.autoSaveId,
      defaultCollapsed: this.collapsed,
      direction: 'horizontal',
      container: () => this.#containerElement(),
      // The page may own the collapse state: a prevented event keeps it.
      beforeCollapseChange: (collapsed, reason) =>
        this.dispatch(
          new TctCollapseChangeEvent(collapsed, reason === 'keyboard' ? 'keyboard' : 'pointer'),
        ),
      onCollapseChange: (collapsed) => {
        if (this.collapsed !== collapsed) this.collapsed = collapsed;
      },
      onSizeChange: (size, reason) => {
        if (reason !== 'request') this.dispatch(new TctSizeChangeEvent(size, reason));
      },
    };
  }

  #containerElement(): HTMLElement | null {
    if (!this.container) return null;
    const root = this.getRootNode() as Document | ShadowRoot;
    return root.getElementById?.(this.container) ?? null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#follow();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    this.#subscribed = undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('region')) this.#follow();
    // A `collapsed` written after the region started follows into it (without asking, like `collapse()`).
    if (changed.has('collapsed') && changed.get('collapsed') !== undefined) {
      const region = this.activeRegion;
      if (region instanceof ResizableController && region.collapsed !== this.collapsed) {
        if (this.collapsed) region.collapse();
        else region.expand();
      }
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    const region = this.activeRegion;
    // The region is the source of truth for the collapse state (it may come from storage).
    if (region && region.collapsed !== this.collapsed) this.collapsed = region.collapsed;
    this.toggleState('collapsed', region?.collapsed === true);
    if (this.resizable && this.width !== undefined) {
      devWarn(
        'layout-panel:width',
        '`width` is ignored on a resizable panel: the region sets the size.',
      );
    }
  }

  /** Re-renders when an external region changes (the panel's own region is a host controller). */
  #follow(): void {
    const region = this.region;
    if (region === this.#subscribed) return;
    this.#unsubscribe?.();
    this.#unsubscribe = region?.subscribe(() => {
      this.requestUpdate();
    });
    this.#subscribed = region;
  }

  override render(): TemplateResult {
    const slots = this.#slots.value ?? NO_LAYOUT_SLOTS;
    const area = this.#area.value;
    const side = area === 'start' || area === 'end' ? area : undefined;
    const region = this.activeRegion;
    const collapsed = region?.collapsed === true;
    // Without a divider the spacing on the side facing the content collapses, unless padding is set.
    const collapse = !this.hasDivider && this.padding === undefined;
    return html`<div
      class="base focus-ring"
      part="base"
      role=${ifDefined(this.landmark)}
      aria-label=${ifDefined(this.label)}
      data-area=${ifDefined(side)}
      ?data-divider=${this.hasDivider && side !== undefined}
      ?data-collapse=${collapse && side !== undefined}
      ?data-no-header=${!slots.hasHeader}
      ?data-no-footer=${!slots.hasFooter}
      ?data-scrollable=${!this.noScroll}
      ?data-resizable=${region !== undefined}
      ?data-collapsed=${collapsed}
      style=${styleMap({'--_size': region && !collapsed ? `${region.size}px` : undefined})}
    >
      <slot></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-layout-panel': TctLayoutPanel;
  }
}
