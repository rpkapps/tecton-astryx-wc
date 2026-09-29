import {html, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {INTERACTIVE_SELECTORS} from '@tecton-astryx/core/controllers/clickable-container.js';
import {MediaQueryController} from '@tecton-astryx/core/controllers/media-query.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import styles from './tct-overlay.styles.css';
import {
  OVERLAY_ALIGNMENTS,
  OVERLAY_POSITIONS,
  OVERLAY_SCRIMS,
  OVERLAY_SHOW_ON,
  type OverlayAlignment,
  type OverlayPosition,
  type OverlayScrim,
  type OverlayShowOn,
} from './overlay.types.js';

/**
 * Layers action or supporting content over media, a card or another bounded surface, with an
 * optional scrim and a reveal behaviour. The default slot is the base content (an image, a video,
 * a card); the `content` slot is what appears on top. It is not a floating layer: the overlay stays
 * inside its container and is clipped to it (use `tct-popover`, `tct-tooltip` or `tct-dialog` for
 * content anchored outside a surface).
 *
 * The content is inverted to stay legible on the scrim: the element sets `data-media-theme` on each
 * `slot="content"` child (`dark` scrim: light ink, `light` scrim: dark ink), and removes it again
 * for `scrim="none"`. Hidden overlay content is only transparent and click-through, never
 * `display: none` or `visibility: hidden`: it stays in the accessibility tree and the tab order and
 * reveals itself when focus reaches it, so keyboard and screen-reader users are never locked out. On touch devices in `hover` mode a tap on the surface toggles the overlay.
 *
 * @summary Layers content over media with an optional scrim and reveal behaviour.
 * @tag tct-overlay
 * @upstream Overlay
 * @slot - The base content (image, video, card).
 * @slot content - The content shown on top of the base content, inside the scrim.
 * @csspart overlay - The clipping container (Astryx target `astryx-overlay`).
 * @csspart scrim - The scrim that carries the content (Astryx target `astryx-overlay-scrim`).
 * @cssstate open - The scrim content is currently shown.
 * @cloakDisplay block
 */
export class TctOverlay extends TctElement {
  static override readonly tagName = 'tct-overlay';
  static override styles: CSSResultGroup = [base, styles];

  /** When the content shows: `always` (default), `hover` (hover and focus), `focus`. `hover-or-focus` is an alias of `hover`. */
  @property({attribute: 'show-on', reflect: true}) showOn: OverlayShowOn = 'always';
  /**
   * Overrides `show-on`: `true` shows the content, `false` hides it (and makes it inert), `undefined`
   * leaves it to `show-on`. The attribute is present for `true` only.
   */
  @property({
    reflect: true,
    converter: {
      fromAttribute: (value: string | null) => (value === null ? undefined : true),
      toAttribute: (value: boolean | undefined) => (value === true ? '' : null),
    },
  })
  open: boolean | undefined = undefined;
  /** Scrim behind the content: `dark` (default), `light`, or `none`. */
  @property({reflect: true}) scrim: OverlayScrim = 'dark';
  /** Where the scrim sits: filling the base content (default), or a strip at the block end (`bottom`) or start (`top`). */
  @property({reflect: true}) position: OverlayPosition = 'fill';
  /** Alignment of the content inside the scrim: `start`, `center`, or `end` (default). */
  @property({reflect: true}) alignment: OverlayAlignment = 'end';

  // -------------------------------------------------------------------------------- internals

  readonly #touch = new MediaQueryController(this, '(hover: none)');
  #touchOpen = false;
  /** Content elements this component put `data-media-theme` on (so `scrim="none"` can take it off again). */
  readonly #themed = new WeakSet<Element>();

  constructor() {
    super();
    this.addEventListener('click', this.#onClick);
  }

  get #hoverMode(): boolean {
    return this.#showOn === 'hover';
  }

  get #showOn(): 'always' | 'hover' | 'focus' {
    const value = OVERLAY_SHOW_ON.includes(this.showOn) ? this.showOn : 'always';
    return value === 'hover-or-focus' ? 'hover' : value;
  }

  /** Touch has no hover: in hover mode a tap toggles the scrim, and that beats the CSS reveal. */
  get #effectiveOpen(): boolean | undefined {
    if (this.open !== undefined) return this.open;
    return this.#touch.matches && this.#hoverMode ? this.#touchOpen : undefined;
  }

  /** A tap on the surface toggles the overlay on touch devices, unless it lands on something interactive. */
  readonly #onClick = (event: MouseEvent): void => {
    if (!this.#touch.matches || !this.#hoverMode || this.open !== undefined) return;
    if (event.defaultPrevented) return;
    for (const node of event.composedPath()) {
      if (node === this) break;
      if (node instanceof Element && node.matches(INTERACTIVE_SELECTORS)) return;
    }
    const selection = this.ownerDocument.getSelection();
    if (selection && !selection.isCollapsed && this.contains(selection.anchorNode)) return;
    this.#touchOpen = !this.#touchOpen;
    this.requestUpdate();
  };

  #syncMediaTheme(): void {
    const mode = OVERLAY_SCRIMS.includes(this.scrim) ? this.scrim : 'dark';
    for (const child of this.children) {
      if (child.getAttribute('slot') !== 'content') continue;
      if (mode === 'none') {
        if (this.#themed.has(child)) {
          child.removeAttribute('data-media-theme');
          this.#themed.delete(child);
        }
      } else if (child.getAttribute('data-media-theme') !== mode) {
        child.setAttribute('data-media-theme', mode);
        this.#themed.add(child);
      }
    }
  }

  /** The container takes the base content's corner radius, so the scrim never squares its corners off. */
  #syncRadius(): void {
    const root = this.renderRoot.querySelector<HTMLElement>('.root');
    const first = [...this.children].find((child) => !child.hasAttribute('slot'));
    if (!root) return;
    const radius = first ? getComputedStyle(first).borderRadius : '';
    if (radius && radius !== '0px') root.style.setProperty('--_overlay-radius', radius);
    else root.style.removeProperty('--_overlay-radius');
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (
      (changed.has('showOn') && !OVERLAY_SHOW_ON.includes(this.showOn)) ||
      (changed.has('scrim') && !OVERLAY_SCRIMS.includes(this.scrim)) ||
      (changed.has('position') && !OVERLAY_POSITIONS.includes(this.position)) ||
      (changed.has('alignment') && !OVERLAY_ALIGNMENTS.includes(this.alignment))
    ) {
      devWarn('tct-overlay:enum', 'Invalid show-on, scrim, position or alignment value.');
    }
  }

  protected override firstUpdated(): void {
    this.#syncRadius();
  }

  protected override updated(): void {
    this.#syncMediaTheme();
    this.toggleState('open', this.#state === 'open');
  }

  /** `open`/`closed` when JS (or touch) decides, `auto` when `show-on` does. */
  get #state(): 'open' | 'closed' | 'auto' {
    const effective = this.#effectiveOpen;
    if (effective === undefined) return this.#showOn === 'always' ? 'open' : 'auto';
    return effective ? 'open' : 'closed';
  }

  override render() {
    const position = OVERLAY_POSITIONS.includes(this.position) ? this.position : 'fill';
    const alignment = OVERLAY_ALIGNMENTS.includes(this.alignment) ? this.alignment : 'end';
    const scrim = OVERLAY_SCRIMS.includes(this.scrim) ? this.scrim : 'dark';
    const state = this.#state;
    return html`
      <div class="root" part="overlay">
        <slot @slotchange=${() => this.#syncRadius()}></slot>
        <div
          class="scrim"
          part="scrim"
          data-position=${position}
          data-alignment=${alignment}
          data-scrim=${scrim}
          data-show-on=${this.#showOn}
          data-state=${state}
          ?inert=${this.#effectiveOpen === false}
        >
          <slot name="content" @slotchange=${() => this.#syncMediaTheme()}></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-overlay': TctOverlay;
  }
}
