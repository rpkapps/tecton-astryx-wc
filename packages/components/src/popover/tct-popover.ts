import {html, nothing, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {interactiveRoleContext} from '@tecton-astryx/core/context/keys.js';
import {FocusTrapController} from '@tecton-astryx/core/controllers/focus-trap.js';
import {ResizeController} from '@tecton-astryx/core/controllers/resize.js';
import {TctAfterOpenChangeEvent} from '@tecton-astryx/core/events/tct-after-open-change.js';
import {TctOpenChangeEvent} from '@tecton-astryx/core/events/tct-open-change.js';
import type {ChangeReason} from '@tecton-astryx/core/events/tct-event.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import {LayerController, type EscapeBehavior} from '@tecton-astryx/core/layer/layer-controller.js';
import {PositionController} from '@tecton-astryx/core/layer/position.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {getTabbables} from '@tecton-astryx/core/utils/focus.js';
import {uniqueId} from '@tecton-astryx/core/utils/id.js';
import defaultMessages from '@tecton-astryx/locales/en/popover.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import motion from '../styles/motion.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import styles from './tct-popover.styles.css';
import {
  POPOVER_ALIGNMENTS,
  POPOVER_PLACEMENTS,
  POPOVER_ROLES,
  type PopoverAlignment,
  type PopoverPlacement,
  type PopoverRole,
} from './popover.types.js';

/** Elements that already are a button for the button + dialog pattern. */
const BUTTON_SELECTOR = 'button, [role="button"]';

/** `command` events (invoker commands, progressive enhancement) as far as this element reads them. */
interface InvokerCommandEvent extends Event {
  readonly command: string;
  readonly source: Element | null;
}

/**
 * A click-triggered popover: interactive content in an anchored top-layer surface. The default slot
 * holds the trigger (it must be, or contain, a button); the `content` slot holds what the surface
 * shows. Implements the button + dialog ARIA pattern: the trigger gets `aria-haspopup` and
 * `aria-expanded`, the surface is a labelled `role="dialog"`, Tab is contained while it is open,
 * Escape and outside presses dismiss it (one layer per press, through the shared layer stack), and
 * focus returns to the trigger. For hover previews use `tct-hover-card`; for brief helper text use
 * `tct-tooltip`.
 *
 * The surface is rendered in this element's shadow root (top layer, `popover="manual"`), so an ID
 * relationship from the trigger cannot cross into it: the trigger carries no `aria-controls`
 * (`[mwg:accessible-web-components]`).
 *
 * @summary A click-triggered popover for interactive content anchored to a trigger.
 * @tag tct-popover
 * @upstream Popover
 * @slot - The trigger: a button, a `role="button"` element, or a library element that renders one.
 * @slot content - The content shown in the popover surface.
 * @csspart anchor - The inline-flex wrapper the surface is anchored to (stable under pressed-state transforms).
 * @csspart popover - The painted surface (Astryx target `astryx-popover`).
 * @csspart close-button - The fallback close button, revealed only when keyboard focus reaches it.
 * @cssstate open - The popover is open.
 * @fires {TctOpenChangeEvent} tct-open-change - Before the user (trigger, Escape, outside press, focus-out) or `requestClose()` opens or closes it; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After an open or close settled (entry animation done, or hidden); every actual change.
 * @cloakDisplay inline-flex
 */
export class TctPopover extends TctElement {
  static override readonly tagName = 'tct-popover';
  static override styles: CSSResultGroup = [base, focusRing, motion, visuallyHidden, styles];

  /** Whether the popover is open. Property and attribute writes never emit events. */
  @property({type: Boolean, reflect: true}) open = false;
  /** Which side of the trigger the popover opens on. Logical: `start`/`end` follow the direction. */
  @property() placement: PopoverPlacement = 'below';
  /** Alignment along the placement axis. Logical, like `placement`. */
  @property() alignment: PopoverAlignment = 'start';
  /** When set, trigger interactions are ignored (upstream `isEnabled=false`). */
  @property({type: Boolean, reflect: true}) disabled = false;
  /** Width of the surface. A bare number is px, anything else is a CSS length. Default `auto` (at least the trigger's width). */
  @property() width: string | undefined;
  /** Accessible name of the dialog surface. Recommended when `popup-role` is `dialog`. */
  @property() label: string | undefined;
  /** `dialog` (default) makes the surface a `role="dialog"`; `none` lets slotted menu/listbox content own the role. */
  @property({attribute: 'popup-role'}) popupRole: PopoverRole = 'dialog';
  /** Drops `aria-modal` from a dialog surface (upstream `isModal=false`). */
  @property({type: Boolean, attribute: 'non-modal'}) nonModal = false;
  /** Removes the fallback close button (upstream `hasCloseButton=false`). */
  @property({type: Boolean, attribute: 'no-close-button'}) noCloseButton = false;
  /** Label of the fallback close button. Default: the localized "Close popover". */
  @property({attribute: 'close-label'}) closeLabel: string | undefined;
  /** Does not move focus into the popover when it opens (upstream `hasAutoFocus=false`). */
  @property({type: Boolean, attribute: 'no-auto-focus'}) noAutoFocus = false;
  /** Outside presses no longer dismiss it (upstream `hasLightDismiss=false`). */
  @property({type: Boolean, attribute: 'no-light-dismiss'}) noLightDismiss = false;
  /** Escape no longer dismisses it, and falls through to the layer below (upstream `hasEscapeDismiss=false`). */
  @property({type: Boolean, attribute: 'no-escape-dismiss'}) noEscapeDismiss = false;
  /** Id of an element in the same tree to anchor to instead of wrapping a trigger (upstream `anchorRef`); it must be, or contain, a button. */
  @property() anchor: string | undefined;
  /** The element to anchor to instead of wrapping a trigger. Wins over `anchor`. */
  @property({attribute: false}) anchorElement: HTMLElement | null = null;

  /** Opens the popover without an intent event; resolves once the entry animation settled. */
  async show(): Promise<void> {
    this.open = true;
    await this.updateComplete;
    await this.#settled;
  }

  /** Closes the popover without an intent event; resolves once it is hidden. */
  async hide(): Promise<void> {
    this.open = false;
    await this.updateComplete;
    await this.#settled;
  }

  /** Opens or closes it (`force` picks the state) without an intent event. */
  toggle(force?: boolean): Promise<void> {
    return (force ?? !this.open) ? this.show() : this.hide();
  }

  /** Asks to close as the user would: fires the cancelable `tct-open-change` and honours a cancel. */
  requestClose(reason: ChangeReason = 'request'): void {
    if (!this.open) return;
    this.#request(false, reason);
  }

  // -------------------------------------------------------------------------------- internals

  readonly #id = uniqueId('tct-popover');
  readonly #locale = new LocaleController(this, {namespace: 'popover', defaults: defaultMessages});
  #settled: Promise<void> = Promise.resolve();
  #boundButton: HTMLElement | null = null;
  #commandSource: Element | null = null;
  #measure = 0;

  constructor() {
    super();
    // Optionally interactive children (a token, a chip) render as buttons inside a popover trigger.
    new ContextProvider(this, {context: interactiveRoleContext, initialValue: true});
    // Tab stays inside the open popover: the fallback close button is the last stop before it wraps.
    new FocusTrapController(this, {
      container: () => this.#surface,
      active: () => this.open,
    });
    // Only while open: an overflow measurement of a closed popover is meaningless and costs frames.
    new ResizeController(this, {
      target: () => (this.open ? [this.#surface, ...this.#contentElements()] : []),
      callback: () => {
        this.#scheduleMeasure();
      },
    });
    this.addEventListener('command', this.#onCommand as EventListener);
  }

  readonly #position = new PositionController(this, {
    surface: () => this.#layerElement,
    anchor: () => this.#anchorTarget,
    placement: () => ({
      placement: this.#placement,
      alignment: this.#alignment,
      offset: 'var(--spacing-1)',
    }),
    // The surface is at least as wide as its trigger unless `width` says otherwise.
    matchAnchorWidth: 'min',
    trackPlacement: true,
  });

  readonly #layer: LayerController = new LayerController(this, {
    kind: 'popover',
    surface: () => this.#layerElement,
    trigger: () => this.#boundButton,
    haspopup: 'dialog',
    // Ignoring Escape: the press falls through to an enclosing layer, or to nothing.
    escape: (): EscapeBehavior => (this.noEscapeDismiss ? 'none' : 'close'),
    outsidePress: () => !this.noLightDismiss,
    initialFocus: () => (this.noAutoFocus ? null : this.#initialFocusTarget()),
    exitAnimation: () => this.#exitAnimation(),
    position: this.#position,
    onDismissRequest: (reason) => {
      this.#request(false, reason);
    },
    onOpenRequest: (reason) => {
      this.#request(true, reason);
    },
    // `hidePopover()` or a browser close request ended it without us.
    onNativeClose: () => {
      this.open = false;
    },
  });

  get #layerElement(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.layer');
  }

  get #surface(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.surface');
  }

  get #placement(): PopoverPlacement {
    return POPOVER_PLACEMENTS.includes(this.placement) ? this.placement : 'below';
  }

  get #alignment(): PopoverAlignment {
    return POPOVER_ALIGNMENTS.includes(this.alignment) ? this.alignment : 'start';
  }

  get #role(): PopoverRole {
    return POPOVER_ROLES.includes(this.popupRole) ? this.popupRole : 'dialog';
  }

  /** The element the surface is anchored to: the external anchor, else the stable wrapper. */
  get #anchorTarget(): HTMLElement | null {
    return this.#externalAnchor() ?? this.renderRoot.querySelector<HTMLElement>('.anchor');
  }

  #externalAnchor(): HTMLElement | null {
    if (this.anchorElement) return this.anchorElement;
    if (!this.anchor) return null;
    const root = this.getRootNode() as Document | ShadowRoot;
    return root.getElementById?.(this.anchor) ?? null;
  }

  #contentElements(): Element[] {
    return [...this.children].filter((child) => child.getAttribute('slot') === 'content');
  }

  #triggerElement(): HTMLElement | null {
    return (
      [...this.children].find(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && !child.hasAttribute('slot'),
      ) ?? null
    );
  }

  /** The control that gets the ARIA state and handlers: the trigger itself, or the button inside it. */
  #buttonOf(element: HTMLElement | null): HTMLElement | null {
    if (!element) return null;
    if (element.matches(BUTTON_SELECTOR)) return element;
    const inner = element.querySelector<HTMLElement>(BUTTON_SELECTOR);
    if (inner) return inner;
    // A library element that renders a button in its own shadow root (tct-button, tct-icon-button).
    return element.localName.includes('-') ? element : null;
  }

  #request(open: boolean, reason: ChangeReason): void {
    if (open && this.disabled) return;
    if (this.dispatch(new TctOpenChangeEvent(open, reason))) this.open = open;
  }

  #initialFocusTarget(): HTMLElement | null {
    const surface = this.#surface;
    if (!surface) return null;
    const close = surface.querySelector('.close');
    // The generated close button is never an initial focus candidate (`[mwg:accessible-web-components]`).
    const control = getTabbables(surface).find((element) => !close?.contains(element));
    if (control) return control;
    return this.#role === 'dialog' ? surface : (getTabbables(surface)[0] ?? null);
  }

  #exitAnimation(): Animation[] {
    const layer = this.#layerElement;
    if (!layer || matchMedia('(prefers-reduced-motion: reduce)').matches) return [];
    const move = this.#placement === 'below' ? '-4px' : this.#placement === 'above' ? '4px' : '0px';
    return [
      layer.animate(
        [
          {opacity: 1, translate: '0 0'},
          {opacity: 0, translate: `0 ${move}`},
        ],
        {duration: 120, easing: 'ease-in'},
      ),
    ];
  }

  // -------------------------------------------------------------------------- trigger wiring

  #bindTrigger(): void {
    const anchor = this.#externalAnchor() ?? this.#triggerElement();
    const button = this.#buttonOf(anchor);
    if (anchor && !button) {
      devWarn(
        'tct-popover:trigger',
        'The trigger must be, or contain, a <button> or [role="button"] element: the popover implements the button + dialog ARIA pattern.',
      );
    }
    if (button === this.#boundButton) return;
    this.#unbindTrigger();
    this.#boundButton = button;
    if (!button) return;
    button.addEventListener('click', this.#onTriggerClick);
    button.addEventListener('keydown', this.#onTriggerKeyDown);
    button.setAttribute('aria-haspopup', this.#role === 'dialog' ? 'dialog' : 'true');
    button.setAttribute('aria-expanded', String(this.open));
  }

  #unbindTrigger(): void {
    const button = this.#boundButton;
    if (button) {
      button.removeEventListener('click', this.#onTriggerClick);
      button.removeEventListener('keydown', this.#onTriggerKeyDown);
      button.removeAttribute('aria-haspopup');
      button.removeAttribute('aria-expanded');
      button.removeAttribute('aria-controls');
    }
    this.#boundButton = null;
  }

  readonly #onTriggerClick = (event: Event): void => {
    if (this.disabled) return;
    this.#layer.toggleFromTrigger(event);
  };

  /** A native <button> turns Enter/Space into a click; `role="button"` elements do not. */
  readonly #onTriggerKeyDown = (event: KeyboardEvent): void => {
    const button = this.#boundButton;
    if (!button || button.localName === 'button' || button.getAttribute('role') !== 'button')
      return;
    if (event.isComposing || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    if (this.disabled) return;
    this.#layer.toggleFromTrigger(event);
  };

  /** Invoker commands (`commandfor`/`command="--toggle"`), a progressive enhancement. */
  readonly #onCommand = (event: InvokerCommandEvent): void => {
    if (!['--show', '--hide', '--toggle'].includes(event.command) || this.disabled) return;
    this.#commandSource = event.source;
    const open = event.command === '--toggle' ? !this.open : event.command === '--show';
    if (open !== this.open) this.#request(open, 'trigger');
  };

  // ------------------------------------------------------------------------ overflow scroll

  #scheduleMeasure(): void {
    if (this.#measure) return;
    this.#measure = requestAnimationFrame(() => {
      this.#measure = 0;
      const surface = this.#surface;
      if (!surface || !this.open) return;
      // Scrolls only when the content does not fit: an always-scrolling surface would clip the
      // focus rings of its content.
      const overflow =
        surface.scrollHeight > surface.clientHeight + 1 ||
        surface.scrollWidth > surface.clientWidth + 1;
      surface.toggleAttribute('data-overflow', overflow);
    });
  }

  readonly #onWindowResize = (): void => {
    this.#scheduleMeasure();
  };

  // ------------------------------------------------------------------------------ lifecycle

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('resize', this.#onWindowResize);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.#onWindowResize);
    cancelAnimationFrame(this.#measure);
    this.#measure = 0;
    this.#unbindTrigger();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (
      (changed.has('placement') && !POPOVER_PLACEMENTS.includes(this.placement)) ||
      (changed.has('alignment') && !POPOVER_ALIGNMENTS.includes(this.alignment))
    ) {
      devWarn(
        'tct-popover:enum',
        `Invalid placement "${this.placement}" or alignment "${this.alignment}".`,
      );
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    this.#bindTrigger();
    if (changed.has('popupRole') && this.#boundButton) {
      this.#boundButton.setAttribute('aria-haspopup', this.#role === 'dialog' ? 'dialog' : 'true');
    }
    if (changed.has('open')) this.#syncOpen(changed.get('open'));
    else if (this.open && (changed.has('placement') || changed.has('alignment'))) {
      this.#position.update();
    }
  }

  #syncOpen(previous: boolean | undefined): void {
    this.toggleState('open', this.open);
    if (this.#commandSource) this.#commandSource.setAttribute('aria-expanded', String(this.open));
    // The first update of a closed popover is not a change.
    if (previous === undefined && !this.open) return;
    if (this.open && this.#role === 'dialog' && !this.label) {
      devWarn(
        'tct-popover:label',
        'A dialog popover needs a `label` (its accessible name), or `popup-role="none"` when the content owns its role.',
      );
    }
    const settled = this.open ? this.#layer.show() : this.#layer.hide();
    this.#settled = settled.then(() => {
      if (this.open === this.#layer.isOpen) this.dispatch(new TctAfterOpenChangeEvent(this.open));
      if (this.open) this.#scheduleMeasure();
    });
  }

  // --------------------------------------------------------------------------------- render

  #cssWidth(): string | undefined {
    const width = this.width?.trim();
    if (!width) return undefined;
    return /^\d+(\.\d+)?$/.test(width) ? `${width}px` : width;
  }

  override render() {
    const dialog = this.#role === 'dialog';
    const width = this.#cssWidth();
    return html`
      <span class="anchor" part="anchor">
        <slot @slotchange=${() => this.#bindTrigger()}></slot>
      </span>
      <div class="layer" popover="manual" data-placement=${this.#placement}>
        <div
          class="surface focus-ring"
          part="popover"
          id=${this.#id}
          role=${dialog ? 'dialog' : nothing}
          aria-modal=${dialog && !this.nonModal ? 'true' : nothing}
          aria-label=${dialog && this.label ? this.label : nothing}
          tabindex=${dialog ? '-1' : nothing}
          style=${styleMap({'--_popover-width': width})}
        >
          <slot name="content" @slotchange=${() => this.#scheduleMeasure()}></slot>
          ${
            this.noCloseButton
              ? nothing
              : html`<div class="close visually-hidden-focusable">
                  <button
                    class="close-button focus-ring"
                    part="close-button"
                    type="button"
                    @click=${() => this.#request(false, 'close-button')}
                  >
                    ${this.closeLabel ?? this.#locale.t('close', undefined, 'close-label')}
                  </button>
                </div>`
          }
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-popover': TctPopover;
  }
}
