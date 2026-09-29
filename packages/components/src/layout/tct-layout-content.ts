import {html, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {ScrollableAreaController} from '@tecton-wc/core/controllers/scrollable-area.js';
import {BoxPropsMixin} from '@tecton-wc/core/mixins/box-props.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {layoutSlotsContext, NO_LAYOUT_SLOTS} from './layout.context.js';
import styles from './tct-layout-content.styles.css';

/**
 * The main content area of a `tct-layout`: the primary body content, with scroll containment and
 * padding that knows which regions surround it. Put it in the layout's default slot.
 *
 * It provides its own padding and scroll, so children need neither; `padding="0"` makes the content
 * edge to edge (a table, a map). Padding is the outer padding on the edges that touch the layout
 * (no start panel, no end panel, no header, no footer) and the inner padding where another region
 * sits; a header or footer without a divider lets the content run into it. It scrolls
 * (`overflow: auto`) unless `no-scroll` is set, which is for `height="auto"` layouts where sticky
 * positioning needs a parent to scroll. While it really overflows and nothing inside is tabbable it
 * takes a tab stop, so the content can be scrolled from the keyboard.
 *
 * `landmark="main"` makes the box the page's main landmark (only for the primary content, not in
 * nested layouts); `label` names a landmark. `focusable` lets a script (or a skip link) focus the box
 * without adding a tab stop.
 *
 * @summary Scrollable main content area of a layout, with context-aware padding.
 * @tag tct-layout-content
 * @upstream LayoutContent
 * @slot - The content.
 * @csspart base - The content box: scrolling, padding and the landmark.
 * @cssprop --layout-padding-outer-x - Read: the inline padding at the layout's outer edge.
 * @cssprop --layout-padding-outer-y - Read: the block padding at the layout's outer edge.
 * @cssprop --layout-padding-inner-x - Read: the inline padding towards a panel.
 * @cssprop --layout-padding-inner-y - Read: the block padding towards the header or footer.
 * @cssprop --layout-alignment-width - Read: the content width the children align to (the layout's `content-width`).
 * @cssprop --container-padding-inline-start - Published for descendants that bleed to the content edge: its inline-start padding.
 * @cssprop --container-padding-inline-end - Published: the inline-end padding.
 * @cssprop --container-padding-block-start - Published: the block-start padding.
 * @cssprop --container-padding-block-end - Published: the block-end padding.
 * @cloakDisplay flex
 */
export class TctLayoutContent extends BoxPropsMixin(TctElement) {
  static override readonly tagName = 'tct-layout-content';
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /**
   * Turns scrolling off (`overflow: clip`). For auto-height layouts, where sticky positioning has to
   * work against a parent that scrolls. Upstream `isScrollable` is `true` by default.
   */
  @property({type: Boolean, attribute: 'no-scroll'}) noScroll = false;

  /** Accessible name of the landmark; needed when `landmark` is set and several of that kind exist. */
  @property() label: string | undefined;

  /**
   * ARIA landmark role of the content box (upstream `role`; renamed because a `role` attribute would
   * shadow the global one). `main` only for the primary content of the page, not in nested layouts.
   */
  @property() landmark: string | undefined;

  /**
   * Lets the box take focus from a script or a skip link (`focus()`), without making it a tab stop
   * (it becomes one only while it scrolls and has nothing tabbable inside).
   */
  @property({type: Boolean, reflect: true}) focusable = false;

  readonly #slots: ContextConsumer<typeof layoutSlotsContext> = new ContextConsumer(this, {
    context: layoutSlotsContext,
    subscribe: true,
  });

  // The scroller is the inner box: its own overflow decides when it becomes a tab stop.
  readonly #scroll: ScrollableAreaController = new ScrollableAreaController(this, {
    viewport: () => this.#box,
    content: () => this.#box,
    slot: () => this.renderRoot?.querySelector('slot'),
    keyboardAccess: () => ({owner: 'implicit', idleTabindex: this.focusable ? '-1' : undefined}),
  });

  get #box(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.base') ?? null;
  }

  /** Whether the content box is a tab stop right now (it scrolls and has no tabbable content). */
  get isScrollable(): boolean {
    return this.#scroll.isScrollable;
  }

  /** Focuses the content box when it is `focusable` (or a tab stop right now). */
  override focus(options?: FocusOptions): void {
    const box = this.#box;
    if (box?.hasAttribute('tabindex')) box.focus(options);
    else super.focus(options);
  }

  override render(): TemplateResult {
    const slots = this.#slots.value ?? NO_LAYOUT_SLOTS;
    // Padding 0 is the edge-to-edge mode: no outer padding, no alignment arithmetic.
    const zero = this.padding === 0;
    const constrain = zero
      ? 'none'
      : !slots.hasStart && !slots.hasEnd
        ? 'both'
        : slots.hasStart && !slots.hasEnd
          ? 'end'
          : !slots.hasStart && slots.hasEnd
            ? 'start'
            : 'none';
    return html`<div
      class="base focus-ring"
      part="base"
      role=${ifDefined(this.landmark)}
      aria-label=${ifDefined(this.label)}
      ?data-no-start=${!slots.hasStart}
      ?data-no-end=${!slots.hasEnd}
      ?data-no-header=${!slots.hasHeader}
      ?data-no-footer=${!slots.hasFooter}
      ?data-header-flush=${slots.headerFlush}
      ?data-footer-flush=${slots.footerFlush}
      ?data-scrollable=${!this.noScroll}
      data-constrain=${constrain}
    >
      <slot></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-layout-content': TctLayoutContent;
  }
}
