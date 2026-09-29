import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {
  ScrollableAreaController,
  type ScrollableAreaState,
} from '@tecton-wc/core/controllers/scrollable-area.js';
import {BoxPropsMixin} from '@tecton-wc/core/mixins/box-props.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {pick} from '../layout/layout.types.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import scrollbar from '../styles/scrollbar.styles.css';
import {
  SCROLL_AXES,
  SCROLL_KEYBOARD_OWNERS,
  SCROLL_OVERSCROLLS,
  SCROLL_STICKY_CONTAINMENTS,
  SCROLL_VIEWPORT_ROLES,
  type ScrollableAxis,
  type ScrollableKeyboardOwner,
  type ScrollableOverscroll,
  type ScrollableStickyContainment,
  type ScrollableViewportRole,
} from './scrollable-area.types.js';
import styles from './tct-scrollable-area.styles.css';

/**
 * A native scroll viewport with axis-aware accessibility: it becomes a tab stop only while a requested
 * axis really scrolls, so keyboard users can scroll it, and it never adds a stop when the content fits.
 *
 * The viewport (`part="viewport"`) is the one native scroller and has an accessible name (`label`,
 * required) and a role (`group`, or `region` to make it a landmark). Its single child is a real content
 * box with a 100% minimum size, observed together with the viewport, so children lay out in that box
 * rather than in the viewport itself. `axis` is logical: `inline` follows the text direction (it scrolls
 * sideways in horizontal text, even in RTL), `block` the flow, and both are mapped through the writing
 * mode. Inline and both-axis modes give the box `max-content` inline size, so wide content is
 * intentionally wider than the viewport.
 *
 * `overscroll="contain"` keeps scroll gestures on the effective axes from chaining to ancestors at an
 * edge (it never acts on a fitting axis, so no scroll zone goes dead). A fitting viewport clips without
 * capturing native `position: sticky`; `sticky-containment="always"` keeps it a sticky boundary anyway.
 * `padding` (default 0) pads the content box and publishes it as `--container-padding-*`, so nested
 * bleed components inset to match; `full-bleed` lets the viewport itself escape the padding of a
 * padded container. The native scrollbar stays authoritative (a token-coloured thumb on a transparent
 * track; the platform look in forced colours).
 *
 * The scroll state is readable as `scrollState` (per logical axis: `isScrollable`, `atStart`,
 * `atEnd`), mirrored as `data-*` attributes on the viewport and as the `scrollable` custom state.
 *
 * @summary Native scroll viewport with a real content box and keyboard access while it overflows.
 * @tag tct-scrollable-area
 * @upstream ScrollableArea
 * @slot - The content, laid out in the observed content box.
 * @csspart viewport - The native scroll container: accessible name, tab stop while scrollable, overflow.
 * @cssprop --container-padding-inline-start - Read (with `full-bleed`) from the enclosing padded container to escape it; published for the content: this area's inline-start content padding.
 * @cssprop --container-padding-inline-end - Read and published like the inline-start one, for the inline end.
 * @cssprop --container-padding-block-start - Read (first child, with `full-bleed`) and published: the block-start content padding.
 * @cssprop --container-padding-block-end - Read (last child, with `full-bleed`) and published: the block-end content padding.
 * @cssstate scrollable - At least one requested axis really scrolls.
 * @cloakDisplay flex
 */
export class TctScrollableArea extends BoxPropsMixin(TctElement) {
  static override readonly tagName = 'tct-scrollable-area';
  static override styles: CSSResultGroup = [base, focusRing, scrollbar, styles];

  /** Logical axis or axes where native scrolling is allowed: `block` (default), `inline` or `both`. */
  @property({reflect: true}) axis: ScrollableAxis = 'block';

  /**
   * Accessible name of the viewport, used while it is a tab stop. Required: name the content a keyboard
   * user scrolls ("Activity history").
   */
  @property() label = '';

  /**
   * Semantics of the named viewport (upstream `role`; renamed because a `role` attribute would shadow
   * the global one): `group` (default) or `region`.
   */
  @property({attribute: 'viewport-role'}) viewportRole: ScrollableViewportRole = 'group';

  /** Whether effective axes pass scroll gestures to ancestors at an edge: `allow` (default) or `contain`. */
  @property({reflect: true}) overscroll: ScrollableOverscroll = 'allow';

  /** Whether a fitting viewport stays a sticky containing boundary: `when-scrollable` (default) or `always`. */
  @property({attribute: 'sticky-containment'}) stickyContainment: ScrollableStickyContainment =
    'when-scrollable';

  /**
   * Lets the viewport escape the padding of an enclosing padded container (a card, a section) without
   * changing the content padding. Off by default: scrolling alone never escapes the parent container.
   */
  @property({type: Boolean, attribute: 'full-bleed'}) fullBleed = false;

  /**
   * Who owns keyboard access: `viewport` (default) makes the viewport a named tab stop while it
   * scrolls; `content-or-viewport` does the same but a forward Tab into it lands on the first link or
   * button inside (the viewport keeps the stop for reverse and for content it cannot delegate to);
   * `content` leaves tab stops and semantics to the content, which must bring its own. Not in upstream
   * (there it is a hook option); it exposes the shared behaviour.
   */
  @property({attribute: 'keyboard-owner'}) keyboardOwner: ScrollableKeyboardOwner = 'viewport';

  readonly #scroll: ScrollableAreaController = new ScrollableAreaController(this, {
    viewport: () => this.#viewport,
    content: () => this.renderRoot?.querySelector<HTMLElement>('.content'),
    slot: () => this.renderRoot?.querySelector('slot'),
    axis: () => pick(SCROLL_AXES, this.axis, 'block', 'axis'),
    keyboardAccess: () => {
      const owner = pick(SCROLL_KEYBOARD_OWNERS, this.keyboardOwner, 'viewport', 'keyboard-owner');
      return owner === 'content'
        ? {owner}
        : {
            owner,
            label: this.label,
            role: pick(SCROLL_VIEWPORT_ROLES, this.viewportRole, 'group', 'viewport-role'),
          };
    },
    overscroll: () => pick(SCROLL_OVERSCROLLS, this.overscroll, 'allow', 'overscroll'),
    stickyContainment: () =>
      pick(
        SCROLL_STICKY_CONTAINMENTS,
        this.stickyContainment,
        'when-scrollable',
        'sticky-containment',
      ),
  });

  get #viewport(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.viewport') ?? null;
  }

  /** The effective scroll state per logical axis: `isScrollable`, `atStart`, `atEnd`. */
  get scrollState(): ScrollableAreaState {
    return this.#scroll.state;
  }

  /** The native scroll container inside the shadow root (for scripts that scroll it: `scrollTo()`). */
  get viewport(): HTMLElement | null {
    return this.#viewport;
  }

  // Sizes go on the host so a percentage resolves against the parent; the padding vars are read by the content box.
  protected override get boxTarget(): HTMLElement {
    return this;
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.toggleState('scrollable', this.#scroll.isScrollable);
    if (!this.label && this.keyboardOwner !== 'content') {
      devWarn(
        'scrollable-area:label',
        '<tct-scrollable-area> needs a label: it names the viewport while it is a tab stop.',
      );
    }
  }

  override render(): TemplateResult {
    const axis = pick(SCROLL_AXES, this.axis, 'block', 'axis');
    return html`<div
      class="viewport focus-ring scrollbar"
      part="viewport"
      data-axis=${axis}
      ?data-full-bleed=${this.fullBleed}
    >
      <div class="content" data-scroll-content><slot></slot></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-scrollable-area': TctScrollableArea;
  }
}
