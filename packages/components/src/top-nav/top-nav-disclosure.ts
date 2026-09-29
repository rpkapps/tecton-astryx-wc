import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {LayerController} from '@tecton-wc/core/layer/layer-controller.js';
import {PositionController, type PlacementRequest} from '@tecton-wc/core/layer/position.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {getTabbables} from '@tecton-wc/core/utils/focus.js';
import {IdController} from '@tecton-wc/core/utils/id.js';
import {NavHoverController} from '../side-nav/nav-hover.js';
import navItem from '../side-nav/nav-item.styles.css';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import layer from '../styles/layer.styles.css';
import motion from '../styles/motion.styles.css';
import {TopNavRenderModeController} from './top-nav.context.js';
import {topNavSlotOf} from './top-nav.types.js';
import disclosure from './top-nav-disclosure.styles.css';

/** A click on the trigger this soon after a hover-open confirms it (pins the panel) instead of closing it. */
const CLICK_GUARD_MS = 500;

/** The one open panel of the page: opening a sibling closes it (upstream relied on the auto popover stack). */
let openPanel: TctTopNavDisclosure | undefined;
const claimOpenPanel = (panel: TctTopNavDisclosure | undefined): void => {
  openPanel = panel;
};

/**
 * A top navigation item that reveals a panel of links: the base of `tct-top-nav-menu` and
 * `tct-top-nav-mega-menu`. It is disclosure navigation (the WAI-ARIA Authoring Practices "disclosure
 * navigation menu"), not an ARIA menu: a button with `aria-expanded` and `aria-controls` shows or hides a
 * group of ordinary links, so there is no `role="menu"`, no `aria-haspopup` and no roving `menuitem`s.
 *
 * Keyboard: Enter and Space toggle the panel (a keyboard open moves focus to its first link; a pointer open
 * leaves focus on the button); Tab and Shift+Tab move through the button and the links of an open panel
 * in order, and Tab out of the panel closes it; the Arrow keys, Home and End move between the links as an
 * enhancement (ArrowDown on the button opens the panel and enters it); Escape closes the panel and returns
 * focus to the button. The pointer opens it after a short hover delay (fine pointers only) and closes it when
 * the pointer leaves, unless a click pinned it; a click within 500 ms of a hover-open confirms it. Only one
 * panel is open at a time. Below the mobile breakpoint of an app shell the item is a collapsible section of
 * the drawer.
 *
 * @internal
 */
export abstract class TctTopNavDisclosure extends TctElement {
  static override styles: CSSResultGroup = [base, focusRing, layer, motion, navItem, disclosure];

  /** The label of the button. */
  @property() label = '';

  /** Delay before the panel opens on hover, in ms. Default 150. */
  @property({type: Number}) delay = 150;

  /** Delay before the panel closes after the pointer left, in ms. */
  @property({type: Number, attribute: 'hide-delay'}) hideDelay = 200;

  /** Whether the panel is open. The attribute is the initial state; the user's actions ask through `tct-open-change`. */
  @property({type: Boolean, reflect: true}) open = false;

  /** Whether the drawer section is expanded (the mobile drawer copy only). @internal */
  @property({type: Boolean, attribute: 'drawer-expanded'}) drawerExpanded = false;

  @state() private _drawerOpen = false;

  protected readonly mode: TopNavRenderModeController = new TopNavRenderModeController(this);
  readonly #ids: IdController = new IdController(this, 'tct-top-nav-disclosure');
  #openedBy: 'hover' | 'keyboard' | 'pointer' = 'pointer';
  #settled: Promise<void> = Promise.resolve();

  readonly #position: PositionController = new PositionController(this, {
    surface: () => this.#layerElement,
    anchor: () => this.panelAnchor(),
    placement: () => this.placementRequest(),
    trackPlacement: true,
  });

  readonly #layer: LayerController = new LayerController(this, {
    kind: 'popover',
    surface: () => this.#layerElement,
    trigger: () => this.trigger,
    escape: 'close',
    outsidePress: true,
    // Tab out of the panel (or the button) closes it: a disclosure has no other exit.
    focusOut: true,
    initialFocus: () =>
      this.#openedBy === 'keyboard' ? (getTabbables(this.#panel ?? this)[0] ?? null) : null,
    position: this.#position,
    onDismissRequest: (reason) => {
      this.#request(false, reason);
    },
    onNativeClose: () => {
      this.open = false;
    },
  });

  readonly #hover: NavHoverController = new NavHoverController(this, {
    trigger: () => this.trigger,
    surface: () => this.#layerElement,
    isOpen: () => this.open,
    enabled: () => this.mode.value === 'default',
    showDelay: () => this.delay,
    hideDelay: () => this.hideDelay,
    onOpen: () => {
      this.#openedBy = 'hover';
      this.#request(true, 'hover');
      if (this.open) this.#hover.markHoverOpened();
    },
    onClose: () => {
      this.#request(false, 'hover');
    },
  });

  // ------------------------------------------------------------------- subclass contract

  /** The content of the panel (the links). */
  protected abstract renderPanel(): TemplateResult;

  /** The content of the drawer section (the same links, as rows). */
  protected abstract renderDrawerItems(): TemplateResult;

  /** The element the panel is positioned against. Default: the button. */
  protected panelAnchor(): HTMLElement | null {
    return this.trigger;
  }

  /** Where the panel goes: below the anchor, aligned to the region of the bar this element sits in. */
  protected placementRequest(): PlacementRequest {
    return {placement: 'below', alignment: topNavSlotOf(this), offset: 'var(--spacing-1)'};
  }

  /** A class for the panel box, for the subclass's own styles. */
  protected get panelClass(): string {
    return '';
  }

  // ------------------------------------------------------------------------------ public

  /** The button that shows and hides the panel. */
  get trigger(): HTMLButtonElement | null {
    return this.renderRoot?.querySelector<HTMLButtonElement>('.trigger') ?? null;
  }

  /** Opens the panel without a `tct-open-change` (programmatic). Resolves once the entry animation settled. */
  async show(): Promise<void> {
    this.open = true;
    await this.updateComplete;
    await this.#settled;
  }

  /** Closes the panel without a `tct-open-change` (programmatic). Resolves once it is hidden. */
  async hide(): Promise<void> {
    this.open = false;
    await this.updateComplete;
    await this.#settled;
  }

  /** Opens or closes the panel (`force` picks the state) without a `tct-open-change`. */
  toggle(force?: boolean): Promise<void> {
    return (force ?? !this.open) ? this.show() : this.hide();
  }

  /** Asks to close as the user would: raises the cancelable `tct-open-change` and honours a cancel. */
  requestClose(reason: ChangeReason = 'request'): void {
    if (this.open) this.#request(false, reason);
  }

  // ---------------------------------------------------------------------------- internals

  get #layerElement(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.layer') ?? null;
  }

  get #panel(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.panel') ?? null;
  }

  #request(open: boolean, reason: ChangeReason): void {
    if (open === this.open) return;
    if (this.dispatch(new TctOpenChangeEvent(open, reason))) this.open = open;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('drawerExpanded')) this._drawerOpen = this.drawerExpanded;
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (!changed.has('open')) return;
    this.toggleState('open', this.open);
    if (this.open) {
      if (openPanel && openPanel !== this) openPanel.#yieldToSibling();
      claimOpenPanel(this);
    } else if (openPanel === this) {
      openPanel = undefined;
    }
    // The first update of a closed panel is not a change.
    if (changed.get('open') === undefined && !this.open) return;
    const settled = this.open ? this.#layer.show() : this.#layer.hide();
    this.#settled = settled.then(() => {
      if (this.open === this.#layer.isOpen) this.dispatch(new TctAfterOpenChangeEvent(this.open));
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (openPanel === this) openPanel = undefined;
  }

  /** A sibling opened: this panel closes (an outside action, so the page may veto it). */
  #yieldToSibling(): void {
    this.#request(false, 'outside');
  }

  // ---------------------------------------------------------------------------------- input

  readonly #onTriggerClick = (event: MouseEvent): void => {
    if (this.open) {
      if (this.#hover.confirmsHover(CLICK_GUARD_MS)) this.#hover.pin();
      else this.#request(false, 'trigger');
      return;
    }
    this.#openedBy = event.detail === 0 ? 'keyboard' : 'pointer';
    this.#hover.pin();
    this.#request(true, 'trigger');
  };

  readonly #onTriggerKeyDown = (event: KeyboardEvent): void => {
    if (event.isComposing || event.altKey || event.metaKey || event.ctrlKey) return;
    // Tab from the button of an open panel enters it (the panel is in the top layer).
    if (event.key === 'Tab' && !event.shiftKey && this.open) {
      const first = getTabbables(this.#panel ?? this)[0];
      if (first) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.key !== 'ArrowDown') return;
    // Optional in the pattern: ArrowDown opens the panel and enters it.
    event.preventDefault();
    if (this.open) {
      getTabbables(this.#panel ?? this)[0]?.focus();
      return;
    }
    this.#openedBy = 'keyboard';
    this.#hover.pin();
    this.#request(true, 'keyboard');
  };

  readonly #onPanelKeyDown = (event: KeyboardEvent): void => {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const stops = getTabbables(this.#panel ?? this);
    if (stops.length === 0) return;
    const target = event.composedPath()[0] as Node;
    const active = stops.findIndex((stop) => stop === target || stop.contains(target));
    const at = active === -1 ? 0 : active;

    // Tab moves through the links by hand: the panel is in the top layer, its links are slotted through
    // two shadow roots, and the engine's own order out of such a panel is not reliable (it can skip links).
    // Past the last link the default applies: focus leaves and the panel closes.
    if (event.key === 'Tab') {
      if (event.shiftKey) {
        event.preventDefault();
        if (at === 0) this.trigger?.focus();
        else stops[at - 1]?.focus();
      } else if (at < stops.length - 1) {
        event.preventDefault();
        stops[at + 1]?.focus();
      }
      return;
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    let next: number;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = stops.length - 1;
    else if (event.key === 'ArrowDown') next = Math.min(stops.length - 1, at + 1);
    else next = Math.max(0, at - 1);
    event.preventDefault();
    stops[next]?.focus();
  };

  /** A link or button chosen in the panel closes it. */
  readonly #onPanelClick = (event: MouseEvent): void => {
    const chosen = event
      .composedPath()
      .some(
        (target) =>
          target instanceof Element &&
          (target.localName === 'a' || target.localName === 'button') &&
          target !== this.trigger,
      );
    if (chosen) this.#request(false, 'selection');
  };

  readonly #onDrawerToggle = (): void => {
    this._drawerOpen = !this._drawerOpen;
    this.drawerExpanded = this._drawerOpen;
  };

  // ---------------------------------------------------------------------------------- render

  #chevron(open: boolean): TemplateResult {
    return html`<tct-icon
      class="chevron"
      name="chevronDown"
      size="sm"
      color="inherit"
      ?data-open=${open}
    ></tct-icon>`;
  }

  override render(): TemplateResult | typeof nothing {
    const mode = this.mode.value;
    const panelId = this.#ids.id('panel');

    if (mode === 'mobile-bar') return nothing;

    if (mode === 'drawer') {
      const itemsId = this.#ids.id('items');
      return html`<div class="drawer-section" part="base">
        <button
          type="button"
          class="nav-row drawer-header focus-ring"
          part="trigger"
          data-size="md"
          aria-expanded=${String(this._drawerOpen)}
          aria-controls=${itemsId}
          @click=${this.#onDrawerToggle}
        >
          <span class="nav-row-label">${this.label}</span>${this.#chevron(this._drawerOpen)}
        </button>
        <div class="drawer-items" id=${itemsId} ?data-expanded=${this._drawerOpen} ?inert=${!this._drawerOpen}>
          <div class="drawer-inner">${this.renderDrawerItems()}</div>
        </div>
      </div>`;
    }

    return html`<button
        type="button"
        class="trigger focus-ring"
        part="trigger"
        aria-expanded=${String(this.open)}
        aria-controls=${panelId}
        ?data-open=${this.open}
        @click=${this.#onTriggerClick}
        @keydown=${this.#onTriggerKeyDown}
      >
        ${this.label}${this.#chevron(this.open)}
      </button>
      <div class="layer layer-surface" popover="manual" data-placement="below">
        <div
          class="panel ${this.panelClass}"
          part="panel"
          id=${panelId}
          role="group"
          aria-label=${this.label}
          tabindex="-1"
          @click=${this.#onPanelClick}
          @keydown=${this.#onPanelKeyDown}
        >
          ${this.renderPanel()}
        </div>
      </div>`;
  }
}
