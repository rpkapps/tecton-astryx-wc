import {html, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {TooltipController} from '@tecton-astryx/core/controllers/tooltip.js';
import {TctAfterOpenChangeEvent} from '@tecton-astryx/core/events/tct-after-open-change.js';
import {TctOpenChangeEvent} from '@tecton-astryx/core/events/tct-open-change.js';
import {prefersReducedMotion} from '@tecton-astryx/core/features.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import base from '../styles/base.styles.css';
import {oneOf} from '../field/field-utils.js';
import {
  TOOLTIP_ALIGNMENTS,
  TOOLTIP_FOCUS_TRIGGERS,
  TOOLTIP_HOVER_INDICATIONS,
  TOOLTIP_SIDES,
  TOOLTIP_TOUCH_TRIGGERS,
  type TooltipAlignment,
  type TooltipFocusTrigger,
  type TooltipHoverIndication,
  type TooltipSide,
  type TooltipTouchTrigger,
} from './tooltip.types.js';
import {TctTooltipSurface} from './tct-tooltip-surface.js';
import styles from './tct-tooltip.styles.css';

/**
 * Short, non-interactive text that appears when a trigger is hovered, focused or tapped. It wraps its
 * trigger: the first element in the default slot is the trigger; a text-only body makes the element
 * itself the (focusable) trigger, marked with a dashed underline.
 *
 * The popup is a satellite in the same tree as the trigger, so the trigger's `aria-describedby`
 * resolves without crossing a shadow root, and its text is the trigger's accessible description. It is
 * hoverable and dismissible without moving the pointer or focus (WCAG 1.4.13): Escape closes the
 * tooltip first, and leaves a dialog it sits in open. It is positioned with CSS anchor positioning
 * (the trigger is the implicit anchor of the popover) and falls back to Floating UI where that is
 * unavailable. [mwg:interest-triggered-tooltips] [mwg:position-aware-tooltips]
 *
 * `open` is the state. Hover, focus and Escape ask to change it with a cancelable `tct-open-change`
 * and apply the change unless you prevent it; writing `open` never emits it. To control a tooltip,
 * listen, `preventDefault()` and set `open` yourself. Do not put interactive content in a tooltip and
 * do not wrap a disabled control (it swallows pointer events): the tooltip describes the trigger,
 * it is not a place for actions.
 *
 * @summary Hover, focus and tap hint that describes a trigger.
 * @tag tct-tooltip
 * @upstream Tooltip
 * @slot - The trigger element (its first element), or plain text.
 * @slot surface - The popup satellite the element creates. Do not fill it.
 * @csspart trigger - The trigger wrapper of a text-only tooltip (the element itself).
 * @csspart surface - The tooltip box (on `tct-tooltip-surface`, Astryx target `astryx-tooltip`).
 * @cssstate open - The tooltip is showing.
 * @fires tct-open-change - A user or Escape asks to show or hide it; cancelable, carries `open` and `reason`.
 * @fires tct-after-open-change - The change settled (after the entry or exit animation); carries `open`.
 * @cloakDisplay contents
 */
export class TctTooltip extends TctElement {
  static override readonly tagName = 'tct-tooltip';
  static override readonly dependencies = [TctTooltipSurface];
  static override styles: CSSResultGroup = [base, styles];

  /** The tooltip text. Empty disables the tooltip and removes the description. */
  @property() content = '';

  /** Side of the trigger the popup prefers; it flips when there is no room. */
  @property({reflect: true}) placement: TooltipSide = 'above';

  /** Alignment along the placement axis. */
  @property({reflect: true}) alignment: TooltipAlignment = 'center';

  /** Milliseconds before hovering opens the tooltip, so a pointer passing by does not flash it. */
  @property({type: Number}) delay = 200;

  /** Milliseconds before leaving closes it (0 keeps a short bridge so the pointer can reach the popup). */
  @property({type: Number, attribute: 'hide-delay'}) hideDelay = 0;

  /**
   * When keyboard focus opens it: `auto` only for a focusable trigger, `always`, or `never` (for
   * composite widgets that own their focus).
   */
  @property({attribute: 'focus-trigger'}) focusTrigger: TooltipFocusTrigger = 'auto';

  /**
   * What a tap does on a touch pointer: `auto` opens it unless the trigger performs an action of its
   * own, `tap` always opens (an info icon), `none` never.
   */
  @property({attribute: 'touch-trigger'}) touchTrigger: TooltipTouchTrigger = 'auto';

  /** Turns the tooltip off: hover and focus do nothing, and nothing describes the trigger. Upstream `isEnabled`, inverted. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** The dashed underline that marks a text-only trigger: `auto` (text-only bodies), `always` or `never`. */
  @property({attribute: 'hover-indication'}) hoverIndication: TooltipHoverIndication = 'auto';

  /** Whether the tooltip is showing. The attribute opens it initially (it stays dismissible). */
  @property({type: Boolean, reflect: true}) open = false;

  readonly #tooltip = new TooltipController(this, {
    mode: 'satellite',
    surfaceTag: 'tct-tooltip-surface',
    trigger: () => this.#trigger(),
    content: () => this.content,
    placement: () => ({
      placement: oneOf(this.placement, TOOLTIP_SIDES, 'above'),
      alignment: oneOf(this.alignment, TOOLTIP_ALIGNMENTS, 'center'),
      offset: 'var(--spacing-1)',
    }),
    delay: () => this.delay,
    hideDelay: () => this.hideDelay,
    focusTrigger: () => oneOf(this.focusTrigger, TOOLTIP_FOCUS_TRIGGERS, 'auto'),
    touchTrigger: () => oneOf(this.touchTrigger, TOOLTIP_TOUCH_TRIGGERS, 'auto'),
    enabled: () => !this.disabled,
    onOpenChange: (open, reason) => {
      // Hover, focus, Escape and outside presses ask; the owner may veto with preventDefault().
      const allowed = this.dispatch(new TctOpenChangeEvent(open, reason));
      if (allowed) this.open = open;
      return allowed;
    },
    onAfterOpenChange: (open) => {
      this.toggleState('open', open);
      this.dispatch(new TctAfterOpenChangeEvent(open));
    },
    exitAnimation: () => {
      const surface = this.#surface();
      // Movement never plays under reduced motion; a fade is fine but is skipped there too (it is short).
      if (!surface || prefersReducedMotion()) return [];
      const box = surface.shadowRoot?.querySelector<HTMLElement>('.surface') ?? surface;
      const raw = getComputedStyle(box).getPropertyValue('--duration-fast').trim();
      const ms = raw.endsWith('ms') ? Number.parseFloat(raw) : Number.parseFloat(raw) * 1000;
      return [
        box.animate([{opacity: 1}, {opacity: 0}], {
          duration: Number.isFinite(ms) && ms > 0 ? ms : 175,
        }),
      ];
    },
  });

  /** Whether the tooltip is showing right now (the layer is on the stack). */
  get isOpen(): boolean {
    return this.#tooltip.isOpen;
  }

  /** Shows the tooltip without a `tct-open-change` (programmatic; the commit event still fires). */
  show(): Promise<void> {
    this.open = true;
    return this.#tooltip.show();
  }

  /** Hides the tooltip without a `tct-open-change` (programmatic; the commit event still fires). */
  hide(): Promise<void> {
    this.open = false;
    return this.#tooltip.hide();
  }

  /** The first element that is not one of our own satellites, else `null`. */
  #firstTrigger(): HTMLElement | null {
    for (const child of this.children) {
      if (child instanceof HTMLElement && !child.hasAttribute('data-tct-owned')) return child;
    }
    return null;
  }

  /** The trigger: the first element child, or the element itself for a text-only body. */
  #trigger(): HTMLElement | null {
    return this.#firstTrigger() ?? (this.#hasText() ? this : null);
  }

  #hasText(): boolean {
    return [...this.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '',
    );
  }

  #surface(): HTMLElement | null {
    return this.querySelector<HTMLElement>(':scope > tct-tooltip-surface[data-tct-owned]');
  }

  protected override willUpdate(): void {
    // A text-only body makes the host the trigger: inline, focusable, marked (upstream text-only mode).
    const textOnly = this.#firstTrigger() === null && this.#hasText();
    this.toggleAttribute('data-text-trigger', textOnly);
    const mark = oneOf(this.hoverIndication, TOOLTIP_HOVER_INDICATIONS, 'auto');
    this.toggleAttribute(
      'data-hover-indication',
      mark === 'always' || (mark !== 'never' && textOnly),
    );
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (this.hasAttribute('data-text-trigger') && !this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
      this.setAttribute('data-tct-tabindex', '');
    } else if (!this.hasAttribute('data-text-trigger') && this.hasAttribute('data-tct-tabindex')) {
      this.removeAttribute('tabindex');
      this.removeAttribute('data-tct-tabindex');
    }
    if (changed.has('open') && (changed.get('open') !== undefined || this.open)) {
      // A state write (attribute, property, or the change we just applied) makes the layer follow it.
      if (this.open) void this.#tooltip.show();
      else void this.#tooltip.hide();
    }
  }

  override render() {
    return html`<slot @slotchange=${this.#onSlotChange}></slot><slot name="surface"></slot>`;
  }

  readonly #onSlotChange = (): void => {
    this.requestUpdate();
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-tooltip': TctTooltip;
  }
}
