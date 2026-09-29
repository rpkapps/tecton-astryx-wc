import {html, nothing, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {HoverIntentController} from '@tecton-wc/core/controllers/hover-intent.js';
import {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {LayerController} from '@tecton-wc/core/layer/layer-controller.js';
import {PositionController} from '@tecton-wc/core/layer/position.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {containsFlat, deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {uniqueId} from '@tecton-wc/core/utils/id.js';
import base from '../styles/base.styles.css';
import motion from '../styles/motion.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import layer from '../styles/layer.styles.css';
import styles from './tct-hover-card.styles.css';
import {
  HOVER_CARD_ALIGNMENTS,
  HOVER_CARD_FOCUS_TRIGGERS,
  HOVER_CARD_INDICATIONS,
  HOVER_CARD_PLACEMENTS,
  HOVER_CARD_TOUCH_TRIGGERS,
  type HoverCardAlignment,
  type HoverCardFocusTrigger,
  type HoverCardIndication,
  type HoverCardPlacement,
  type HoverCardTouchTrigger,
} from './hover-card.types.js';

/**
 * ARIA 1.2 roles that support `aria-expanded`: deliberately the narrow reading (upstream
 * `EXPANDABLE_ROLES`). Dropping the state where it might be legal costs a user little; emitting it
 * where it is illegal is an `aria-allowed-attr` defect.
 */
const EXPANDABLE_ROLES = new Set([
  'application',
  'button',
  'checkbox',
  'columnheader',
  'combobox',
  'gridcell',
  'link',
  'listbox',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'row',
  'rowheader',
  'switch',
  'tab',
  'treeitem',
]);
const BUTTON_INPUT_TYPES = new Set(['button', 'submit', 'reset', 'image']);

function supportsAriaExpanded(element: HTMLElement): boolean {
  const explicit = element.getAttribute('role')?.trim().split(/\s+/)[0];
  if (explicit) return EXPANDABLE_ROLES.has(explicit);
  switch (element.localName) {
    case 'button':
    case 'summary':
    case 'select':
      return true;
    case 'a':
    case 'area':
      return element.hasAttribute('href');
    case 'input':
      return BUTTON_INPUT_TYPES.has((element as HTMLInputElement).type.toLowerCase());
    default:
      // A library element that renders a button (tct-button, tct-link) exposes its role itself.
      return element.localName.includes('-') && element.shadowRoot?.delegatesFocus === true;
  }
}

const mergeTokens = (existing: string | null, token: string): string =>
  [...new Set([...(existing ?? '').split(/\s+/).filter(Boolean), token])].join(' ');

/**
 * A richer, larger overlay shown when the user hovers or focuses a trigger: profile cards, link
 * summaries, inline definitions. The default slot is the trigger (an element, or plain text, which
 * becomes a focusable, dashed-underlined inline trigger); the `content` slot is the card. The card
 * stays open while the pointer or focus is inside it (WCAG 1.4.13: dismissible, hoverable,
 * persistent), Escape closes it and returns focus to the trigger, and on touch a tap opens it unless
 * the trigger has an action of its own.
 *
 * A labelled card is a `role="dialog"` and the trigger advertises it with `aria-haspopup` and
 * `aria-expanded`; an unlabelled one is a `role="group"` and its text is exposed to the trigger as
 * `aria-description`. ID references cannot cross the shadow boundary (`[mwg:accessible-web-components]`),
 * so the trigger never gets `aria-controls` or `aria-describedby` for a slotted trigger.
 *
 * @summary A hover- and focus-triggered card of rich content anchored to a trigger.
 * @tag tct-hover-card
 * @upstream HoverCard
 * @slot - The trigger: an element (a button, link, avatar) or plain text.
 * @slot content - The content of the card.
 * @csspart trigger - The wrapper of the trigger; painted (focusable, underlined) only for a text trigger.
 * @csspart hover-card - The painted card.
 * @cssstate open - The card is open.
 * @fires {TctOpenChangeEvent} tct-open-change - Before hover, focus, a tap, Escape or an outside press opens or closes it; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After an open or close settled; every actual change.
 * @cloakDisplay inline
 */
export class TctHoverCard extends TctElement {
  static override readonly tagName = 'tct-hover-card';
  static override styles: CSSResultGroup = [base, focusRing, layer, motion, styles];

  /** Whether the card is open (also the default-open state). Property and attribute writes never emit events. */
  @property({type: Boolean, reflect: true}) open = false;
  /** Which side of the trigger the card opens on. Logical. */
  @property() placement: HoverCardPlacement = 'above';
  /** Alignment along the placement axis. Logical. */
  @property() alignment: HoverCardAlignment = 'center';
  /** Delay before showing on hover, in ms. */
  @property({type: Number}) delay = 300;
  /** Delay before hiding after the pointer or focus leaves, in ms. */
  @property({type: Number, attribute: 'hide-delay'}) hideDelay = 200;
  /** When keyboard focus on the trigger opens the card: `auto` (only if focusable), `always`, `never` (composite widgets). */
  @property({attribute: 'focus-trigger'}) focusTrigger: HoverCardFocusTrigger = 'auto';
  /** What a tap does where there is no hover: `auto` (opens unless the trigger acts), `tap` (always), `none`. */
  @property({attribute: 'touch-trigger'}) touchTrigger: HoverCardTouchTrigger = 'auto';
  /** Disables the hover and focus triggers (upstream `isEnabled=false`). */
  @property({type: Boolean, reflect: true}) disabled = false;
  /** Accessible name. With it the card is a named `role="dialog"`; without, a `role="group"`. */
  @property() label: string | undefined;
  /** Dashed underline on the trigger: `auto` (text triggers only), `always`, `never`. */
  @property({attribute: 'hover-indication'}) hoverIndication: HoverCardIndication = 'auto';

  /** Opens the card without an intent event (bypasses the hover delay); resolves once settled. */
  async show(): Promise<void> {
    this.open = true;
    await this.updateComplete;
    await this.#settled;
  }

  /** Closes the card without an intent event; resolves once hidden. */
  async hide(): Promise<void> {
    this.open = false;
    await this.updateComplete;
    await this.#settled;
  }

  /** Opens or closes it (`force` picks the state) without an intent event. */
  toggle(force?: boolean): Promise<void> {
    return (force ?? !this.open) ? this.show() : this.hide();
  }

  /** Asks to close as the user would: fires the cancelable `tct-open-change`. */
  requestClose(reason: ChangeReason = 'request'): void {
    if (this.open) this.#request(false, reason);
  }

  // -------------------------------------------------------------------------------- internals

  readonly #id = uniqueId('tct-hover-card');
  #settled: Promise<void> = Promise.resolve();
  #textOnly = false;
  /** After a dismissal returned focus to the trigger, that focus must not reopen the card. */
  #suppressFocus = false;
  #ariaElement: HTMLElement | null = null;
  #ariaMode: 'dialog' | 'group' | undefined;
  #ariaSaved = new Map<string, string | null>();

  readonly #position: PositionController = new PositionController(this, {
    surface: () => this.#layerElement,
    anchor: () => this.#trigger,
    placement: () => ({
      placement: HOVER_CARD_PLACEMENTS.includes(this.placement) ? this.placement : 'above',
      alignment: HOVER_CARD_ALIGNMENTS.includes(this.alignment) ? this.alignment : 'center',
      offset: 'var(--spacing-1)',
    }),
    trackPlacement: true,
  });

  // `hint` layers set no ARIA on the trigger (the card owns that, see `#syncAria`) and never take
  // part in the context chain; nesting still follows DOM containment.
  readonly #layer: LayerController = new LayerController(this, {
    kind: 'hint',
    surface: () => this.#layerElement,
    trigger: () => this.#trigger,
    escape: 'close',
    outsidePress: true,
    initialFocus: 'none',
    // Focus is returned by hand, and only when it was inside the card: a card that closes because
    // the pointer left must never pull focus onto the trigger.
    returnFocus: false,
    exitAnimation: () => this.#exitAnimation(),
    position: this.#position,
    onDismissRequest: (reason) => {
      this.#dismiss(reason);
    },
    onNativeClose: () => {
      this.open = false;
    },
    onHidden: () => {
      setTimeout(() => {
        this.#suppressFocus = false;
      }, 0);
    },
  });

  readonly #intent: HoverIntentController = new HoverIntentController(this, {
    trigger: () => this.#trigger,
    surface: () => this.#layerElement,
    openDelay: () => this.delay,
    closeDelay: () => this.hideDelay,
    touch: () =>
      HOVER_CARD_TOUCH_TRIGGERS.includes(this.touchTrigger) ? this.touchTrigger : 'auto',
    focus: () =>
      HOVER_CARD_FOCUS_TRIGGERS.includes(this.focusTrigger) ? this.focusTrigger : 'auto',
    enabled: () => !this.disabled && !this.#suppressFocus,
    isOpen: () => this.open,
    onOpen: (reason) => {
      this.#request(true, reason);
    },
    onClose: (reason) => {
      // Focus inside the card keeps it open (WCAG 1.4.13 persistent); leaving it closes it.
      if (containsFlat(this.#card, deepActiveElement())) return;
      this.#request(false, reason);
    },
  });

  get #layerElement(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.layer');
  }

  get #card(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.card');
  }

  /** The element the card is anchored to and hovered/focused: the first element child, or the text wrapper. */
  get #trigger(): HTMLElement | null {
    if (!this.#textOnly) {
      return (
        [...this.children].find(
          (child): child is HTMLElement =>
            child instanceof HTMLElement && !child.hasAttribute('slot'),
        ) ?? null
      );
    }
    return this.renderRoot.querySelector<HTMLElement>('.trigger');
  }

  #computeTextOnly(): boolean {
    return ![...this.children].some((child) => !child.hasAttribute('slot'));
  }

  #request(open: boolean, reason: ChangeReason): void {
    if (open && this.disabled) return;
    if (this.dispatch(new TctOpenChangeEvent(open, reason))) this.open = open;
  }

  #dismiss(reason: ChangeReason): void {
    const card = this.#card;
    const hadFocus = card !== null && containsFlat(card, deepActiveElement());
    this.#request(false, reason);
    if (hadFocus && !this.open) {
      this.#suppressFocus = true;
      this.#trigger?.focus();
    }
  }

  #exitAnimation(): Animation[] {
    const layer = this.#layerElement;
    if (!layer || matchMedia('(prefers-reduced-motion: reduce)').matches) return [];
    return [layer.animate([{opacity: 1}, {opacity: 0}], {duration: 100, easing: 'ease-in'})];
  }

  // ------------------------------------------------------------------------------------ ARIA

  #setAria(element: HTMLElement, name: string, value: string | null): void {
    if (!this.#ariaSaved.has(name)) this.#ariaSaved.set(name, element.getAttribute(name));
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  }

  #restoreAria(): void {
    const element = this.#ariaElement;
    if (element) {
      for (const [name, value] of this.#ariaSaved) {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      }
    }
    this.#ariaSaved.clear();
    this.#ariaElement = null;
    this.#ariaMode = undefined;
  }

  /**
   * Named: the trigger advertises a dialog (`aria-haspopup`, `aria-expanded` only where its role
   * allows it), merged with anything the author put there. Unnamed: the card is a group and the trigger
   * is described by its text.
   */
  #syncAria(): void {
    const trigger = this.#trigger;
    const mode = this.label ? 'dialog' : 'group';
    if (trigger !== this.#ariaElement || mode !== this.#ariaMode) this.#restoreAria();
    if (!trigger) return;
    this.#ariaElement = trigger;
    this.#ariaMode = mode;
    const sameRoot = trigger.getRootNode() === this.renderRoot;
    if (this.label) {
      this.#setAria(trigger, 'aria-haspopup', 'dialog');
      if (supportsAriaExpanded(trigger)) this.#setAria(trigger, 'aria-expanded', String(this.open));
      // aria-controls only where both ends share a tree: the text wrapper and the card do.
      if (sameRoot) this.#setAria(trigger, 'aria-controls', this.open ? this.#id : null);
      return;
    }
    if (sameRoot) {
      const saved =
        this.#ariaSaved.get('aria-describedby') ?? trigger.getAttribute('aria-describedby');
      this.#setAria(trigger, 'aria-describedby', mergeTokens(saved, this.#id));
    } else if (!trigger.hasAttribute('aria-describedby')) {
      // Cross-root: copy the card's text (the tier-2 fallback of A§8.2, used everywhere here).
      const text = [...this.children]
        .filter((child) => child.getAttribute('slot') === 'content')
        .map((child) => child.textContent.replace(/\s+/g, ' ').trim())
        .join(' ')
        .trim();
      this.#setAria(trigger, 'aria-description', text || null);
    }
  }

  // ------------------------------------------------------------------------------ lifecycle

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#restoreAria();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    this.#textOnly = this.#computeTextOnly();
    if (
      (changed.has('placement') && !HOVER_CARD_PLACEMENTS.includes(this.placement)) ||
      (changed.has('alignment') && !HOVER_CARD_ALIGNMENTS.includes(this.alignment)) ||
      (changed.has('hoverIndication') && !HOVER_CARD_INDICATIONS.includes(this.hoverIndication))
    ) {
      devWarn('tct-hover-card:enum', 'Invalid placement, alignment or hover-indication value.');
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    this.#syncAria();
    if (changed.has('open')) this.#syncOpen(changed.get('open'));
    else if (this.open && (changed.has('placement') || changed.has('alignment'))) {
      this.#position.update();
    }
    if (changed.has('disabled') && this.disabled && this.open) void this.hide();
  }

  #syncOpen(previous: boolean | undefined): void {
    this.toggleState('open', this.open);
    if (previous === undefined && !this.open) return;
    const settled = this.open ? this.#layer.show() : this.#layer.hide();
    this.#settled = settled.then(() => {
      if (this.open === this.#layer.isOpen) this.dispatch(new TctAfterOpenChangeEvent(this.open));
    });
  }

  // --------------------------------------------------------------------------------- render

  /** Focus moving out of the card to somewhere other than the trigger closes it. */
  readonly #onCardFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    if (
      next instanceof Node &&
      (containsFlat(this.#card, next) || containsFlat(this.#trigger, next))
    )
      return;
    // Focus moved to nothing (the end of the page, or a click on plain text inside the card): only
    // the second is a reason to stay, and the pointer is over the card then.
    if (next === null && this.#card?.matches(':hover')) return;
    this.#intent.close('keyboard', event);
  };

  #onTriggerSlotChange = (): void => {
    const textOnly = this.#computeTextOnly();
    if (textOnly !== this.#textOnly) this.requestUpdate();
    else this.#syncAria();
  };

  override render() {
    const indicate =
      this.hoverIndication === 'always' || (this.hoverIndication === 'auto' && this.#textOnly);
    const dialog = Boolean(this.label);
    return html`
      <span
        class="trigger focus-ring"
        part="trigger"
        ?data-text=${this.#textOnly}
        ?data-indicate=${indicate}
        tabindex=${this.#textOnly ? '0' : nothing}
        ><slot @slotchange=${this.#onTriggerSlotChange}></slot
      ></span>
      <div class="layer layer-surface" popover="manual" data-placement=${this.placement}>
        <div
          class="card"
          part="hover-card"
          id=${this.#id}
          role=${dialog ? 'dialog' : 'group'}
          aria-label=${this.label ?? nothing}
          @focusout=${this.#onCardFocusOut}
        >
          <slot name="content" @slotchange=${this.#onTriggerSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-hover-card': TctHoverCard;
  }
}
