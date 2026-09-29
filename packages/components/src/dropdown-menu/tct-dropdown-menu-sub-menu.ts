import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {TctAfterOpenChangeEvent} from '@tecton-astryx/core/events/tct-after-open-change.js';
import type {ChangeReason} from '@tecton-astryx/core/events/tct-event.js';
import {TctOpenChangeEvent} from '@tecton-astryx/core/events/tct-open-change.js';
import {LayerController} from '@tecton-astryx/core/layer/layer-controller.js';
import {PositionController} from '@tecton-astryx/core/layer/position.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {containsFlat} from '@tecton-astryx/core/utils/focus.js';
import {isImeKeyEvent} from '@tecton-astryx/core/utils/ime.js';
import {uniqueId} from '@tecton-astryx/core/utils/id.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctItem} from '../item/tct-item.js';
import {TctSpinner} from '../spinner/tct-spinner.js';
import base from '../styles/base.styles.css';
import layer from '../styles/layer.styles.css';
import motion from '../styles/motion.styles.css';
import {dropdownMenuContext, type DropdownMenuContextValue} from './dropdown-menu.context.js';
import {resolveMenuWidth} from './dropdown-menu.types.js';
import {MenuItemController} from './menu-item.controller.js';
import {MenuKeyboardController} from './menu-keyboard.controller.js';
import {collectMenuItems} from './menu-items.js';
import styles from './tct-dropdown-menu-sub-menu.styles.css';
import surfaceStyles from './tct-menu-surface.styles.css';
import itemStyles from './tct-menu-item.styles.css';

/** Hover intent, ported from upstream `useMenuHover`: a pointer resting on the row opens the flyout. */
const HOVER_OPEN_MS = 150;
const HOVER_CLOSE_MS = 200;
/** A click this soon after a hover-open confirms the flyout instead of toggling it shut (upstream #3121). */
const CLICK_GUARD_MS = 500;
/** Where a menu never grows beyond the viewport minus a 16px gutter. */
const MENU_MAX_INLINE_SIZE = 'calc(100vi - var(--spacing-8))';

/**
 * A menu row that reveals a nested flyout menu of its own children (`tct-dropdown-menu-item`, checkbox and
 * radio items, more submenus). The row is a `menuitem` with `aria-haspopup="menu"` and `aria-expanded`;
 * its children are the flyout content (default slot). Serves every menu: `ContextMenuSubMenu` and
 * `BreadcrumbMenuSubMenu` upstream are this tag.
 *
 * ArrowRight (ArrowLeft in right-to-left text), Enter, Space or a click opens it and focuses the first
 * enabled row; a pointer resting on the row opens it after a short delay without taking focus. ArrowLeft
 * (ArrowRight in RTL) or Escape closes **only this flyout** and puts focus back on this row; a second
 * Escape then closes the whole menu. Choosing any row inside closes the whole menu. `has-spinner`
 * replaces the caret with a spinner while the children load; the flyout then holds focus itself until
 * rows arrive.
 *
 * @summary A menu row that opens a nested flyout menu.
 * @tag tct-dropdown-menu-sub-menu
 * @upstream DropdownMenuSubMenu
 * @slot - The flyout rows.
 * @slot label - Rich label; overrides the `label` attribute.
 * @slot description - Rich description; overrides the `description` attribute.
 * @slot icon - Custom leading icon; overrides the `icon` attribute.
 * @csspart item - The painted trigger row (Astryx target `astryx-dropdown-menu-item`).
 * @csspart dropdown-menu-item - The painted trigger row, under the upstream target name.
 * @csspart menu - The painted flyout surface (Astryx target `astryx-dropdown-menu`).
 * @csspart indicator-icon - The trailing caret (Astryx target `astryx-dropdown-menu-indicator-icon`).
 * @cssstate open - The flyout is open.
 * @cssstate disabled - The row cannot open its flyout.
 * @fires {TctOpenChangeEvent} tct-open-change - Before the user (click, keys, hover, Escape) opens or closes the flyout; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After the flyout opened or closed.
 * @cloakDisplay block
 */
export class TctDropdownMenuSubMenu extends TctElement {
  static override readonly tagName = 'tct-dropdown-menu-sub-menu';
  static override readonly dependencies = [TctItem, TctIcon, TctSpinner];
  static override styles: CSSResultGroup = [base, layer, motion, itemStyles, surfaceStyles, styles];

  /** Primary text of the trigger row. Rich content goes through `slot="label"`. */
  @property() label = '';

  /** Secondary text below the label. Rich content goes through `slot="description"`. */
  @property() description = '';

  /** Registered icon name shown before the label (or slot your own into `icon`). */
  @property() icon = '';

  /** Disables the row: it renders and stays focusable but never opens its flyout. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** Shows a spinner in place of the caret, for a lazy submenu whose rows are still loading. */
  @property({type: Boolean, attribute: 'has-spinner'}) hasSpinner = false;

  /** Whether the flyout is open. Property and attribute writes never emit events. */
  @property({type: Boolean, reflect: true}) open = false;

  /** Minimum flyout width (a bare number is px; intrinsic keywords set the preferred width). Default: intrinsic, at least 160px. */
  @property({attribute: 'menu-width'}) menuWidth: string | undefined;

  /** Opens the flyout without an intent event; resolves once it settled. */
  async show(): Promise<void> {
    this.open = true;
    await this.updateComplete;
    await this.#settled;
  }

  /** Closes the flyout without an intent event; resolves once it is hidden. */
  async hide(): Promise<void> {
    this.open = false;
    await this.updateComplete;
    await this.#settled;
  }

  /** The row's text, as typeahead sees it: never the text of the flyout's rows. */
  get menuLabel(): string {
    return this.#item.menuLabel;
  }

  // -------------------------------------------------------------------------------- internals

  readonly #id = uniqueId('tct-dropdown-menu-sub-menu');
  #settled: Promise<void> = Promise.resolve();
  /** Whether the next open moves focus into the flyout (click and keys do, hover does not). */
  #focusOnOpen = false;
  /** The whole menu is closing: focus goes to its trigger, not to this row. */
  #treeClosing = false;
  #hoverOpenedAt = 0;
  #hoverTimer: ReturnType<typeof setTimeout> | undefined;

  readonly #item: MenuItemController = new MenuItemController(this, {
    closeOnSelect: () => false,
    activate: () => {
      this.#onRowClick();
    },
    // Rows of the flyout bubble their clicks and pointer moves through this host.
    accepts: (event) => this.#isOwnRowEvent(event),
  });

  readonly #context = new ContextProvider(this, {
    context: dropdownMenuContext,
    initialValue: undefined as unknown as DropdownMenuContextValue | null,
  });

  readonly #keys = new MenuKeyboardController(this, {
    surface: () => this.#surface,
    items: () => collectMenuItems(this.#surface),
    onTab: () => {
      this.#item.menu?.close('keyboard');
    },
  });

  readonly #position = new PositionController(this, {
    surface: () => this.#layerElement,
    // The row is the anchor: the flyout opens on the inline end, aligned to the row's block start.
    anchor: () => this,
    placement: () => ({placement: 'end', alignment: 'start', offset: 'var(--spacing-1)'}),
    trackPlacement: true,
  });

  readonly #layer: LayerController = new LayerController(this, {
    kind: 'popover',
    surface: () => this.#layerElement,
    // Outside presses on the row itself belong to the row (it toggles the flyout).
    inside: () => [this],
    initialFocus: () => (this.#focusOnOpen ? (this.#keys.firstEnabled() ?? this.#surface) : null),
    // Escape and the close key put focus back on the row; a closing menu sends it to its trigger.
    returnFocus: () => (this.#treeClosing ? (this.#item.menu?.returnFocusTarget() ?? this) : this),
    exitAnimation: () => this.#exitAnimation(),
    position: this.#position,
    onDismissRequest: (reason) => {
      this.#request(false, reason);
    },
    onNativeClose: () => {
      this.open = false;
    },
    onHidden: () => {
      this.#keys.reset();
      this.#treeClosing = false;
    },
  });

  constructor() {
    super();
    this.internals.role = 'menuitem';
    this.internals.ariaHasPopup = 'menu';
    this.addEventListener('keydown', this.#onKeyDown);
    this.addEventListener('pointerenter', this.#onPointerEnter);
    this.addEventListener('pointerleave', this.#onPointerLeave);
  }

  get #layerElement(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.layer');
  }

  get #surface(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.surface');
  }

  get #rowElement(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.row');
  }

  get #isRtl(): boolean {
    return getComputedStyle(this).direction === 'rtl';
  }

  /** Whether an event started on this row (or the host itself), not inside the flyout. */
  #isOwnRowEvent(event: Event): boolean {
    const origin = event.composedPath()[0];
    return origin === this || containsFlat(this.#rowElement, origin as Node);
  }

  #request(open: boolean, reason: ChangeReason): void {
    if (open && this.disabled) return;
    if (this.dispatch(new TctOpenChangeEvent(open, reason))) this.open = open;
  }

  #exitAnimation(): Animation[] {
    const layerElement = this.#layerElement;
    if (!layerElement || matchMedia('(prefers-reduced-motion: reduce)').matches) return [];
    return [layerElement.animate([{opacity: 1}, {opacity: 0}], {duration: 120, easing: 'ease-in'})];
  }

  #clearHoverTimer(): void {
    clearTimeout(this.#hoverTimer);
    this.#hoverTimer = undefined;
  }

  // ------------------------------------------------------------------------------------ pointer

  /** A pointer resting on the row opens the flyout without taking focus; leaving both closes it. */
  readonly #onPointerEnter = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    this.#clearHoverTimer();
    if (this.open || this.disabled) return;
    this.#hoverTimer = setTimeout(() => {
      this.#hoverTimer = undefined;
      if (this.open || this.disabled) return;
      this.#focusOnOpen = false;
      this.#hoverOpenedAt = Date.now();
      this.#request(true, 'hover');
    }, HOVER_OPEN_MS);
  };

  readonly #onPointerLeave = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    this.#clearHoverTimer();
    // Only a hover-opened flyout closes on leave: a click, key or confirmed open stays until dismissed.
    if (!this.open || this.#hoverOpenedAt === 0) return;
    this.#hoverTimer = setTimeout(() => {
      this.#hoverTimer = undefined;
      if (this.open && this.#hoverOpenedAt !== 0) this.#request(false, 'hover');
    }, HOVER_CLOSE_MS);
  };

  #onRowClick(): void {
    if (this.disabled) return;
    if (this.open) {
      // The click that follows a hover-open confirms it (pins it) instead of closing it (#3121).
      if (this.#hoverOpenedAt > 0 && Date.now() - this.#hoverOpenedAt < CLICK_GUARD_MS) {
        this.#hoverOpenedAt = 0;
        this.#keys.focusFirstOrSurface();
        return;
      }
      this.#request(false, 'trigger');
      return;
    }
    this.#hoverOpenedAt = 0;
    this.#focusOnOpen = true;
    this.#request(true, 'trigger');
  }

  // ----------------------------------------------------------------------------------- keyboard

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || isImeKeyEvent(event)) return;
    const origin = event.composedPath()[0];

    if (origin === this) {
      // On the row itself: open keys enter the flyout. Handled here and stopped, so the parent menu
      // does not also activate the row (Enter and Space would otherwise click it).
      if (this.disabled) return;
      const openKey = this.#isRtl ? 'ArrowLeft' : 'ArrowRight';
      if (event.key === openKey || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        this.#hoverOpenedAt = 0;
        if (this.open) {
          this.#keys.focusFirstOrSurface();
        } else {
          this.#focusOnOpen = true;
          this.#request(true, 'keyboard');
        }
      }
      return;
    }

    // Inside the flyout, on this level's own surface or rows: the close key returns to the row.
    if (!this.#keys.owns(origin ?? null)) return;
    const closeKey = this.#isRtl ? 'ArrowRight' : 'ArrowLeft';
    if (event.key === closeKey) {
      event.preventDefault();
      event.stopPropagation();
      this.#request(false, 'keyboard');
    }
  };

  // ------------------------------------------------------------------------------ lifecycle

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#clearHoverTimer();
  }

  #contextValue(): DropdownMenuContextValue | null {
    const parent = this.#item.menu;
    if (!parent) return null;
    // Re-provided so the rows of this flyout end the whole menu, and so a flyout nested in this one
    // closes with it (`open` is only true while both are).
    return {
      size: parent.size,
      open: parent.open && this.open,
      close: parent.close,
      returnFocusTarget: parent.returnFocusTarget,
    };
  }

  protected override willUpdate(): void {
    this.internals.ariaDisabled = this.disabled ? 'true' : null;
    this.internals.ariaExpanded = this.open ? 'true' : 'false';
    // The whole menu closed (or this row's own menu did): the flyout goes with it, silently.
    const parent = this.#item.menu;
    if (this.open && parent && !parent.open) {
      this.#treeClosing = true;
      this.open = false;
    }
    if (this.disabled && this.open) this.open = false;
    const next = this.#contextValue();
    const current = this.#context.value;
    if (
      next?.open !== current?.open ||
      next?.size !== current?.size ||
      next?.close !== current?.close
    ) {
      this.#context.setValue(next as DropdownMenuContextValue);
    }
  }

  protected override updated(changed: PropertyValues<this>): void {
    this.toggleState('open', this.open);
    this.toggleState('disabled', this.disabled);
    if (!changed.has('open')) return;
    const previous = changed.get('open');
    // The first update of a closed flyout is not a change.
    if (previous === undefined && !this.open) return;
    if (this.open) {
      this.#keys.roving.update();
    } else {
      this.#clearHoverTimer();
      this.#hoverOpenedAt = 0;
    }
    const settled = this.open ? this.#layer.show() : this.#layer.hide();
    this.#settled = settled.then(() => {
      this.#focusOnOpen = false;
      if (this.open === this.#layer.isOpen) this.dispatch(new TctAfterOpenChangeEvent(this.open));
    });
  }

  // --------------------------------------------------------------------------------- render

  #renderEnd(): TemplateResult {
    return this.hasSpinner
      ? html`<span class="caret" slot="end"><tct-spinner size="sm"></tct-spinner></span>`
      : html`<span class="caret" slot="end"
          ><tct-icon
            class="indicator"
            part="indicator-icon"
            name="chevronRight"
            size="sm"
            color="secondary"
          ></tct-icon
        ></span>`;
  }

  #widthStyles(): Record<string, string | undefined> {
    const resolved = this.menuWidth ? resolveMenuWidth(this.menuWidth, MENU_MAX_INLINE_SIZE) : null;
    if (!resolved) return {};
    return resolved.property === 'inline-size'
      ? {'--_menu-inline-size': resolved.value}
      : {'--_menu-min-inline-size': resolved.value};
  }

  protected override render(): TemplateResult {
    return html`${this.#item.renderRow({end: this.#renderEnd()})}
      <div class="layer layer-surface" popover="manual" data-placement="end">
        <div
          class="surface"
          part="menu"
          id=${this.#id}
          role="menu"
          tabindex="-1"
          aria-label=${this.label || this.menuLabel || nothing}
          style=${styleMap(this.#widthStyles())}
        >
          <slot @slotchange=${() => this.#keys.roving.update()}></slot>
        </div>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-dropdown-menu-sub-menu': TctDropdownMenuSubMenu;
  }
}
