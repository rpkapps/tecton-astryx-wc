import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {
  ContextConsumer,
  ContextProvider,
  type ContextRequestEvent,
  type UnknownContext,
} from '@tecton-wc/core/context/protocol.js';
import {layoutAreaContext, type LayoutArea} from '@tecton-wc/core/context/keys.js';
import {SPACING_STEPS, type BoxSize, type SpacingStep} from '@tecton-wc/core/mixins/box-props.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {
  announceLayoutAreaProvider,
  layoutDividerContext,
  layoutSlotsContext,
  NO_LAYOUT_SLOTS,
} from './layout.context.js';
import type {LayoutSlotsValue} from './layout.context.js';
import {
  cssLength,
  LAYOUT_HEIGHTS,
  pick,
  supportsInternalContentWidth,
  type LayoutHeight,
} from './layout.types.js';
import styles from './tct-layout.styles.css';

/** Layout regions the layout looks for among its children. */
const REGION = {
  header: 'tct-layout-header',
  footer: 'tct-layout-footer',
  content: 'tct-layout-content',
} as const;

/**
 * A general layout primitive with five optional named slots: `header`, `start`, the default (content)
 * slot, `end` and `footer`. It arranges regions inside a page or a bounded container. Use
 * `tct-app-shell` for the page shell (app-wide navigation, skip link, main landmark) and `tct-hstack`
 * or `tct-vstack` for plain stacking.
 *
 * ```text
 * ┌─────────────────────────────────────────┐
 * │                 header                  │
 * ├──────┬─────────────────────────┬────────┤
 * │start │       content           │  end   │
 * ├──────┴─────────────────────────┴────────┤
 * │                 footer                  │
 * └─────────────────────────────────────────┘
 * ```
 *
 * Put `tct-layout-header`, `tct-layout-panel` (`slot="start"` or `"end"`), `tct-layout-content` and
 * `tct-layout-footer` in the slots. Region elements do not need to be used: any element can fill a
 * slot, but the regions handle the padding that collapses where two regions meet, the dividers, the
 * scrolling and the landmarks. `start` and `end` are logical: they swap in RTL.
 *
 * With `height="fill"` (default) the layout takes the height of its container, which must have one,
 * and the content scrolls inside. A layout inside a padded container (a card, a section) cancels that
 * container's padding with negative margins, so it runs edge to edge.
 *
 * `content-width` limits the aligned content of every region to a maximum width (number = px), centred
 * when narrower than the space. Dividers stay full-bleed, and a scrolling content region keeps its
 * scrollbar at the outer edge while its children align to the width.
 *
 * @summary Five-slot layout: header, start, content, end and footer regions.
 * @tag tct-layout
 * @upstream Layout
 * @slot - The content region (a `tct-layout-content`), or any content.
 * @slot header - The header region (a `tct-layout-header`).
 * @slot start - The panel at the inline start (a `tct-layout-panel`, optionally followed by a `tct-resize-handle`).
 * @slot end - The panel at the inline end.
 * @slot footer - The footer region (a `tct-layout-footer`).
 * @csspart base - The layout box: it fills (or grows with) its container.
 * @cssprop --layout-padding-outer-x - Inline padding of regions at the outer edges of the layout; the `padding` attribute sets it (also read from an enclosing card or section).
 * @cssprop --layout-padding-outer-y - Block padding of regions at the outer edges of the layout.
 * @cssprop --layout-padding-inner-x - Inline padding between regions (read from an enclosing card or section).
 * @cssprop --layout-padding-inner-y - Block padding between regions.
 * @cssprop --layout-content-width - Published: the content width the regions align to (`content-width`).
 * @cssprop --layout-alignment-width - Published: the width `tct-layout-content` subtracts to centre its children.
 * @cssprop --container-padding-inline-start - Read from the enclosing padded container to run edge to edge; reset to zero for the regions inside.
 * @cssprop --container-padding-inline-end - Read like the inline-start one, for the inline end.
 * @cssprop --container-padding-block-start - Read from the enclosing padded container to run edge to edge.
 * @cssprop --container-padding-block-end - Read like the block-start one, for the block end.
 * @cssprop --container-max-height - Read: an enclosing container's maximum height for a filling layout.
 * @cloakDisplay flex
 */
export class TctLayout extends TctElement {
  static override readonly tagName = 'tct-layout';
  static override styles: CSSResultGroup = [base, styles];

  /**
   * `fill` (default): the layout takes the height of its container and the content scrolls inside.
   * `auto`: it grows with its content and the page scrolls.
   */
  @property({reflect: true}) height: LayoutHeight = 'fill';

  /**
   * Padding at the layout's outer edges, a spacing-scale step (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10).
   * `0` makes every region touch the container edges. It sets `--layout-padding-outer-x` and `-y`.
   */
  @property({type: Number}) padding: SpacingStep | undefined;

  /**
   * Maximum width of the aligned content in each region (header, content, footer, panels); a number
   * is px, a string a CSS length (`60ch`). Common page widths: 640 for forms and settings, 960 for
   * content pages. Percentages and intrinsic widths keep a constrained composition instead of the
   * scroll-at-the-edge alignment.
   */
  @property({attribute: 'content-width'}) contentWidth: BoxSize | undefined;

  /**
   * Divider default for the headers and footers inside: those that state no `has-divider` of their own
   * use it. Unset, nested layouts inherit the value of the layout they are in. Set the property to
   * `false` to switch dividers off under a layout that switches them on.
   */
  @property({type: Boolean, attribute: 'default-has-dividers'}) defaultHasDividers:
    boolean | undefined;

  readonly #slots = new ContextProvider(this, {
    context: layoutSlotsContext,
    initialValue: NO_LAYOUT_SLOTS,
  });
  readonly #dividers = new ContextProvider(this, {
    context: layoutDividerContext,
    initialValue: null,
  });
  readonly #parentDividers = new ContextConsumer(this, {
    context: layoutDividerContext,
    subscribe: true,
    callback: () => {
      this.#syncDividers();
    },
  });
  #children: MutationObserver | undefined;
  #attributes: MutationObserver | undefined;
  #contentRegion = false;

  /** The `context-request` handlers that answer `layoutAreaContext` for each slot. */
  readonly #answer: Record<NonNullable<LayoutArea>, (event: Event) => void> = {
    header: this.#answerArea('header'),
    start: this.#answerArea('start'),
    content: this.#answerArea('content'),
    end: this.#answerArea('end'),
    footer: this.#answerArea('footer'),
  };

  #answerArea(area: NonNullable<LayoutArea>): (event: Event) => void {
    return (event) => {
      const request = event as ContextRequestEvent<UnknownContext>;
      if (request.context !== layoutAreaContext) return;
      // The value never changes for a slot: a subscription is answered once.
      request.stopPropagation();
      request.callback(area, request.subscribe ? () => undefined : undefined);
    };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#syncSlots();
    this.#children ??= new MutationObserver(() => {
      this.#syncSlots();
    });
    this.#attributes ??= new MutationObserver(() => {
      this.#syncSlots();
    });
    // Which regions are filled follows the direct children and their `slot`; whether a header or
    // footer draws a divider follows their `data-divider` (deeper edits cannot change either).
    this.#children.observe(this, {childList: true});
    this.#attributes.observe(this, {
      attributes: true,
      subtree: true,
      attributeFilter: ['slot', 'data-divider'],
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#children?.disconnect();
    this.#attributes?.disconnect();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (
      changed.has('padding') &&
      this.padding !== undefined &&
      !SPACING_STEPS.includes(this.padding)
    ) {
      devWarn(
        `layout:padding:${String(this.padding)}`,
        `padding="${String(this.padding)}" is not a spacing step.`,
      );
    }
    if (changed.has('defaultHasDividers')) this.#syncDividers();
  }

  protected override firstUpdated(): void {
    // Regions that connected before the slot wrappers rendered asked for their area unanswered:
    // announce, so they ask again.
    announceLayoutAreaProvider(this);
  }

  override render(): TemplateResult {
    const height = pick(LAYOUT_HEIGHTS, this.height, 'fill', 'height');
    const padding =
      this.padding !== undefined && SPACING_STEPS.includes(this.padding)
        ? `var(--spacing-${String(this.padding).replace('.', '-')})`
        : undefined;
    const width = cssLength(this.contentWidth);
    const internal = supportsInternalContentWidth(this.contentWidth);
    const slots = this.#slots.value;
    const panels =
      slots.hasStart && slots.hasEnd
        ? 'both'
        : slots.hasStart
          ? 'start'
          : slots.hasEnd
            ? 'end'
            : 'none';
    // Without a width, or with panels on both sides, the whole start + content + end composition is
    // limited; with one width-arithmetic capable, the content region aligns itself instead.
    const mode =
      width === undefined ? 'none' : !internal || panels === 'both' ? 'constrained' : 'internal';
    const box = styleMap({
      '--layout-padding-outer-x': padding,
      '--layout-padding-outer-y': padding,
      '--layout-content-width': width,
      '--layout-alignment-width': internal ? width : undefined,
    });
    return html`<div class="outer" part="base" data-height=${height}>
      <div class="inner" style=${box}>
        <div class="area" @context-request=${this.#answer.header}>
          <slot name="header"></slot>
        </div>
        <div
          class="middle"
          data-width-mode=${mode}
          data-panels=${panels}
          ?data-container=${mode === 'internal' && panels !== 'both' && this.#contentRegion}
          ?data-content-region=${this.#contentRegion}
        >
          <div class="area" @context-request=${this.#answer.start}>
            <slot name="start"></slot>
          </div>
          <div class="body" ?data-single-column=${mode === 'internal' && panels === 'none'}>
            <div class="area" @context-request=${this.#answer.content}><slot></slot></div>
          </div>
          <div class="area" @context-request=${this.#answer.end}>
            <slot name="end"></slot>
          </div>
        </div>
        <div class="area" @context-request=${this.#answer.footer}>
          <slot name="footer"></slot>
        </div>
      </div>
    </div>`;
  }

  // -------------------------------------------------------------------------------- slot state

  /** The direct children that fill `slot` (`''` is the default slot). */
  #inSlot(slot: string): Element[] {
    return [...this.children].filter((child) => (child.getAttribute('slot') ?? '') === slot);
  }

  #syncSlots(): void {
    const header = this.#inSlot('header');
    const footer = this.#inSlot('footer');
    const content = this.#inSlot('');
    const next: LayoutSlotsValue = {
      hasHeader: header.length > 0,
      hasFooter: footer.length > 0,
      hasStart: this.#inSlot('start').length > 0,
      hasEnd: this.#inSlot('end').length > 0,
      // A header without a divider of its own lets the content run into it.
      headerFlush: header.some(
        (element) => element.localName === REGION.header && !element.hasAttribute('data-divider'),
      ),
      footerFlush: footer.some(
        (element) => element.localName === REGION.footer && !element.hasAttribute('data-divider'),
      ),
    };
    const current = this.#slots.value;
    const changed = (Object.keys(next) as (keyof LayoutSlotsValue)[]).some(
      (key) => next[key] !== current[key],
    );
    if (changed) this.#slots.setValue(next);
    const region = content.some((element) => element.localName === REGION.content);
    if (changed || region !== this.#contentRegion) {
      this.#contentRegion = region;
      this.requestUpdate();
    }
  }

  /** The value regions see: this layout's own default, else the enclosing layout's. */
  #syncDividers(): void {
    const own = this.defaultHasDividers;
    const inherited = this.#parentDividers.value?.defaultHasDividers;
    const value = own ?? inherited;
    this.#dividers.setValue(value === undefined ? null : {defaultHasDividers: value});
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-layout': TctLayout;
  }
}
