import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {
  AdaptivePresentationController,
  ADAPTIVE_PRESENTATIONS,
} from '@tecton-astryx/core/controllers/adaptive-presentation.js';
import {LongPressController} from '@tecton-astryx/core/controllers/long-press.js';
import {SizeController} from '@tecton-astryx/core/controllers/size.js';
import {TctAfterOpenChangeEvent} from '@tecton-astryx/core/events/tct-after-open-change.js';
import type {ChangeReason} from '@tecton-astryx/core/events/tct-event.js';
import {TctOpenChangeEvent} from '@tecton-astryx/core/events/tct-open-change.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import {LayerController} from '@tecton-astryx/core/layer/layer-controller.js';
import {PositionController} from '@tecton-astryx/core/layer/position.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {containsFlat, deepActiveElement, getTabbables} from '@tecton-astryx/core/utils/focus.js';
import defaultMessages from '@tecton-astryx/locales/en/contextMenu.js';
import backMessages from '@tecton-astryx/locales/en/dropdownMenu.js';
import {TctBottomSheet} from '../bottom-sheet/tct-bottom-sheet.js';
import {TctDivider} from '../divider/tct-divider.js';
import {
  dropdownMenuContext,
  type DropdownMenuContextValue,
} from '../dropdown-menu/dropdown-menu.context.js';
import {
  MENU_PRESENTATIONS,
  resolveMenuWidth,
  type DropdownMenuItemData,
  type DropdownMenuOption,
  type MenuPresentation,
  type MenuSize,
} from '../dropdown-menu/dropdown-menu.types.js';
import {labelText, renderMenuOptions} from '../dropdown-menu/menu-data.js';
import {collectMenuItems} from '../dropdown-menu/menu-items.js';
import {MenuKeyboardController} from '../dropdown-menu/menu-keyboard.controller.js';
import {renderSheetView} from '../dropdown-menu/menu-sheet.js';
import {TctDropdownMenuCheckboxItem} from '../dropdown-menu/tct-dropdown-menu-checkbox-item.js';
import {TctDropdownMenuDivider} from '../dropdown-menu/tct-dropdown-menu-divider.js';
import {TctDropdownMenuItem} from '../dropdown-menu/tct-dropdown-menu-item.js';
import {TctDropdownMenuRadioGroup} from '../dropdown-menu/tct-dropdown-menu-radio-group.js';
import {TctDropdownMenuRadioItem} from '../dropdown-menu/tct-dropdown-menu-radio-item.js';
import {TctDropdownMenuSubMenu} from '../dropdown-menu/tct-dropdown-menu-sub-menu.js';
import surfaceStyles from '../dropdown-menu/tct-menu-surface.styles.css';
import sheetStyles from '../dropdown-menu/tct-menu-sheet.styles.css';
import {TctHeading} from '../heading/tct-heading.js';
import {TctIconButton} from '../icon-button/tct-icon-button.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctListItem} from '../list/tct-list-item.js';
import {TctList} from '../list/tct-list.js';
import base from '../styles/base.styles.css';
import layer from '../styles/layer.styles.css';
import motion from '../styles/motion.styles.css';
import styles from './tct-context-menu.styles.css';

/** The menu never takes more than the viewport minus a 16px gutter on each side. */
const MENU_MAX_INLINE_SIZE = 'calc(100vi - var(--spacing-8))';

/** Where the menu opens: a viewport point (pointer, touch) or the bottom-start corner of an element. */
type OpenAt = {x: number; y: number};

/**
 * A menu of actions for a region: it opens where the user right-clicks (at the pointer), on the
 * ContextMenu key or Shift+F10 (at the focused element, or at the bottom-start of the region), and on a
 * touch long press (at the finger). The default slot is the trigger area; the menu is data-driven
 * (`items`) or compound (`tct-dropdown-menu-item`, checkbox, radio, divider and submenu children in
 * `slot="menu"`). The rows are the ones `tct-dropdown-menu` uses, and so is the keyboard contract:
 * roving arrows without wrapping, Home/End, typeahead, Enter/Space activate, Escape closes the top-most
 * level and Tab closes the menu; focus returns to the element that had it before the menu opened.
 *
 * `presentation` chooses the surface: a popover at the pointer (default), a bottom action sheet, or
 * `adaptive` (a sheet on a compact touch device, a popover elsewhere). Long press is invisible: keep a
 * visible trigger (`tct-more-menu`) for anything important, and never make the context menu the only
 * route to an action.
 *
 * The popover is positioned on a 0x0 anchor at the pointer with CSS anchor positioning: the Floating UI
 * fallback is never loaded where that works.
 *
 * @summary A menu that opens at the pointer on right-click, the context-menu keys or a touch long press.
 * @tag tct-context-menu
 * @upstream ContextMenu
 * @slot - The trigger area: right-click, long-press or press ContextMenu on this content.
 * @slot menu - The menu rows (compound mode).
 * @csspart trigger - The wrapper of the trigger area.
 * @csspart menu - The painted menu surface (upstream theming target `context-menu`).
 * @csspart section - A data-mode group of rows.
 * @csspart section-heading - The heading of a data-mode group.
 * @csspart sheet - The bottom sheet of the touch presentation.
 * @csspart sheet-content - The content of the bottom sheet.
 * @cssstate open - The menu is open.
 * @fires {TctOpenChangeEvent} tct-open-change - Before the user opens (right-click, keys, long press) or closes (Escape, outside press, Tab, choosing a row) it, or `requestClose()`; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After an open or close settled; every actual change.
 * @cloakDisplay block
 */
export class TctContextMenu extends TctElement {
  static override readonly tagName = 'tct-context-menu';
  static override readonly dependencies = [
    TctIcon,
    TctIconButton,
    TctBottomSheet,
    TctList,
    TctListItem,
    TctHeading,
    TctDivider,
    TctDropdownMenuItem,
    TctDropdownMenuCheckboxItem,
    TctDropdownMenuRadioGroup,
    TctDropdownMenuRadioItem,
    TctDropdownMenuDivider,
    TctDropdownMenuSubMenu,
  ];
  static override styles: CSSResultGroup = [base, layer, motion, surfaceStyles, sheetStyles, styles];

  /** Whether the menu is open. Property and attribute writes never emit events. */
  @property({type: Boolean, reflect: true}) open = false;

  /** Accessible name of the menu, announced when it opens. Default: the localized "Context menu". */
  @property() label = '';

  /** Row size. Unset: the nearest size provider, else `md`. */
  @property() size: MenuSize | undefined;

  /** The browser's own context menu shows instead, and long press does nothing. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** Minimum menu width; a bare number is px, intrinsic keywords set the preferred width. Default 160px. */
  @property({attribute: 'menu-width'}) menuWidth: string | undefined;

  /**
   * `popover` opens at the pointer (default), `bottom-sheet` always uses an action sheet, `adaptive` uses
   * the sheet on a compact touch device (768px or narrower with a coarse pointer).
   */
  @property({reflect: true}) presentation: MenuPresentation = 'popover';

  /**
   * The rows of a data-driven menu: actions `{label, onClick?, icon?, variant?, disabled?, items?}`,
   * dividers `{type: 'divider'}` and sections `{type: 'section', title?, items}`; nested `items` open a
   * flyout in a popover and drill into a new view in a sheet. Leave unset for compound mode.
   */
  @property({attribute: false}) items: DropdownMenuOption[] | undefined;

  /** Label of the Back button in the sheet's drill-in view. Default: the localized "Back". */
  @property({attribute: 'back-label'}) backLabel: string | undefined;

  /** Opens the menu without an intent event, at the bottom-start of the trigger area; resolves once settled. */
  async show(): Promise<void> {
    this.#at ??= this.#defaultPoint();
    this.#restoreFocus = this.#focusedInside();
    this.open = true;
    await this.updateComplete;
    await this.#settled;
  }

  /** Opens the menu at a viewport point (`clientX`, `clientY`) without an intent event. */
  async showAt(x: number, y: number): Promise<void> {
    this.#at = {x, y};
    this.#restoreFocus = this.#focusedInside();
    this.open = true;
    await this.updateComplete;
    await this.#settled;
  }

  /** Closes the menu without an intent event; resolves once it is hidden. */
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

  readonly #locale = new LocaleController(this, {
    namespace: 'contextMenu',
    defaults: defaultMessages,
  });
  readonly #backLocale = new LocaleController(this, {
    namespace: 'dropdownMenu',
    defaults: backMessages,
  });
  readonly #size = new SizeController(this, {explicit: () => this.size, fallback: 'md'});
  readonly #presentation = new AdaptivePresentationController(this, () => this.#policy);
  readonly #context = new ContextProvider(this, {
    context: dropdownMenuContext,
    initialValue: this.#contextValue(),
  });
  #settled: Promise<void> = Promise.resolve();
  #at: OpenAt | null = null;
  /** What had focus before the menu opened; focus returns there on close. */
  #restoreFocus: HTMLElement | null = null;
  #path: DropdownMenuItemData[] = [];

  readonly #keys = new MenuKeyboardController(this, {
    surface: () => this.#surface,
    items: () => collectMenuItems(this.#surface),
    onTab: () => {
      this.#request(false, 'keyboard');
    },
  });

  constructor() {
    super();
    // iOS Safari never fires `contextmenu` on a long press, so the touch route is ours.
    new LongPressController(this, {
      target: () => this.renderRoot.querySelector('.trigger'),
      disabled: () => this.disabled,
      onLongPress: (point) => {
        this.#openAt(point.x, point.y, 'pointer');
      },
    });
  }

  readonly #position = new PositionController(this, {
    surface: () => this.#layerElement,
    // A point: the controller owns a 0x0 fixed anchor there, so the CSS path still applies.
    anchor: () => this.#at,
    placement: () => ({placement: 'below', alignment: 'start'}),
    trackPlacement: true,
  });

  readonly #layer: LayerController = new LayerController(this, {
    kind: 'popover',
    surface: () => this.#layerElement,
    // Focus returns to what had it before the menu opened, not to a trigger.
    trigger: () => null,
    returnFocus: () => this.#restoreFocus,
    // Opening a context menu focuses its first row (upstream), for pointer and keyboard alike.
    initialFocus: () => this.#keys.firstEnabled() ?? this.#surface,
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
    },
  });

  get #policy(): MenuPresentation {
    return ADAPTIVE_PRESENTATIONS.includes(this.presentation) ? this.presentation : 'popover';
  }

  /** Whether the action sheet is showing: resolved by the presentation policy. */
  get #usesSheet(): boolean {
    return this.#presentation.resolved === 'bottom-sheet';
  }

  get #layerElement(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.layer');
  }

  /** The `role="menu"` element that owns the rows: the popover surface, or the sheet's menu (compound mode). */
  get #surface(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.surface, .sheet-menu');
  }

  get #menuLabel(): string {
    return this.label || this.#locale.t('label');
  }

  #focusedInside(): HTMLElement | null {
    const active = deepActiveElement();
    return active instanceof HTMLElement && containsFlat(this, active) ? active : null;
  }

  /** The bottom-start corner of the trigger area, for an open with no pointer. */
  #defaultPoint(): OpenAt {
    return this.#cornerOf(this);
  }

  #cornerOf(element: Element): OpenAt {
    const rect = element.getBoundingClientRect();
    const rtl = getComputedStyle(this).direction === 'rtl';
    return {x: rtl ? rect.right : rect.left, y: rect.bottom};
  }

  #contextValue(): DropdownMenuContextValue {
    return {
      size: this.#size.value,
      open: this.open,
      close: (reason = 'selection') => {
        this.#request(false, reason);
      },
      returnFocusTarget: () => this.#restoreFocus,
    };
  }

  #request(open: boolean, reason: ChangeReason): void {
    if (open && this.disabled) return;
    if (this.dispatch(new TctOpenChangeEvent(open, reason))) this.open = open;
  }

  /** The user asks to open at a point: remember what had focus and where, then ask. */
  #openAt(x: number, y: number, reason: ChangeReason, restore = this.#focusedInside()): void {
    if (this.disabled || this.open) return;
    this.#at = {x, y};
    this.#restoreFocus = restore;
    this.#request(true, reason);
  }

  #exitAnimation(): Animation[] {
    const layerElement = this.#layerElement;
    if (!layerElement || matchMedia('(prefers-reduced-motion: reduce)').matches) return [];
    return [layerElement.animate([{opacity: 1}, {opacity: 0}], {duration: 120, easing: 'ease-in'})];
  }

  // ------------------------------------------------------------------------------ invocation

  readonly #onContextMenu = (event: MouseEvent): void => {
    if (this.disabled) return; // the browser's own menu
    event.preventDefault();
    // A keyboard-invoked `contextmenu` (Shift+F10, the Menu key) reports (0, 0) in several engines:
    // anchor at the focused element so the menu is reachable without a pointer.
    const keyboardInvoked = event.clientX === 0 && event.clientY === 0 && event.detail === 0;
    if (keyboardInvoked) {
      this.#openFromKeyboard();
      return;
    }
    this.#openAt(event.clientX, event.clientY, 'pointer');
  };

  /** ContextMenu key and Shift+F10 open the menu at the focused element (`contextmenu` may not fire for synthetic keys). */
  readonly #onTriggerKeyDown = (event: KeyboardEvent): void => {
    if (this.disabled || event.isComposing) return;
    const isMenuKey = event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey);
    if (!isMenuKey) return;
    event.preventDefault();
    this.#openFromKeyboard();
  };

  #openFromKeyboard(): void {
    const focused = this.#focusedInside();
    const corner = this.#cornerOf(focused ?? this);
    this.#openAt(corner.x, corner.y, 'keyboard', focused);
  }

  /** A right-click inside the open menu must not open the browser's menu, nor move this one. */
  readonly #onSurfaceContextMenu = (event: Event): void => {
    event.preventDefault();
    event.stopPropagation();
  };

  // ------------------------------------------------------------------------------ lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('presentation') && !MENU_PRESENTATIONS.includes(this.presentation)) {
      devWarn(
        'tct-context-menu:presentation',
        `presentation="${this.presentation}" is not one of ${MENU_PRESENTATIONS.join(', ')}.`,
      );
    }
    const current = this.#context.value;
    if (current?.size !== this.#size.value || current.open !== this.open) {
      this.#context.setValue(this.#contextValue());
    }
    if (!this.open && this.#path.length > 0) this.#path = [];
  }

  protected override firstUpdated(): void {
    // Markup that mounts open has no pointer to open at: default to the trigger area.
    if (this.open) this.#at ??= this.#defaultPoint();
  }

  protected override updated(changed: PropertyValues<this>): void {
    this.toggleState('open', this.open);
    // Every update: the presentation can change with the device (a media query) while `open` stays.
    this.#syncLayer(changed.get('open'));
  }

  /** Brings the popover layer in line with `open` and the resolved presentation. */
  #syncLayer(previousOpen: boolean | undefined): void {
    const wantLayer = this.open && !this.#usesSheet;
    if (wantLayer === this.#layer.isOpen) return;
    // The first update of a closed menu is not a change.
    if (previousOpen === undefined && !this.open) return;
    if (wantLayer) {
      this.#at ??= this.#defaultPoint();
      this.#keys.roving.update();
    }
    const settled = wantLayer ? this.#layer.show() : this.#layer.hide();
    this.#settled = settled.then(() => {
      if (this.open === this.#layer.isOpen) this.dispatch(new TctAfterOpenChangeEvent(this.open));
    });
  }

  // -------------------------------------------------------------------------------- the sheet

  #setPath(path: DropdownMenuItemData[]): void {
    this.#path = path;
    this.requestUpdate();
    if (path.length > 0) {
      requestAnimationFrame(() => {
        this.renderRoot.querySelector<HTMLElement>('.sheet-heading')?.focus({preventScroll: true});
      });
    }
  }

  readonly #onSheetOpenChange = (event: TctOpenChangeEvent): void => {
    event.stopPropagation();
    event.preventDefault();
    if (!event.open) this.#request(false, event.reason);
  };

  readonly #onSheetAfterOpenChange = (event: Event): void => {
    event.stopPropagation();
    this.dispatch(new TctAfterOpenChangeEvent(this.open));
    if (!this.open) return;
    // A sheet opens with its first action focused; the menu itself when it holds compound rows.
    const content = this.renderRoot.querySelector<HTMLElement>('.sheet-content, .sheet-menu');
    if (!content) return;
    const target = getTabbables(content).find((element) => element.localName !== 'tct-heading');
    (target ?? content).focus({preventScroll: true});
  };

  #renderSheet(): TemplateResult {
    const items = this.items;
    const current = this.#path.at(-1);
    const title = current ? labelText(current.label) : this.#menuLabel;
    return html`<tct-bottom-sheet
      class="sheet"
      part="sheet"
      height="hug"
      purpose="info"
      label=${title || this.#menuLabel}
      .open=${this.open}
      .finalFocusElement=${this.#restoreFocus}
      @tct-open-change=${this.#onSheetOpenChange}
      @tct-after-open-change=${this.#onSheetAfterOpenChange}
    >
      ${
        items
          ? renderSheetView({
              title: title || this.#menuLabel,
              items: current?.items ?? items,
              canGoBack: this.#path.length > 0,
              backLabel: this.backLabel ?? this.#backLocale.t('back', undefined, 'back-label'),
              onBack: () => {
                this.#setPath(this.#path.slice(0, -1));
              },
              onSelect: (item, event) => {
                if (item.disabled) return;
                item.onClick?.(event);
                if (item.closeOnSelect !== false) this.#request(false, 'selection');
              },
              onOpenSubmenu: (item) => {
                this.#setPath([...this.#path, item]);
              },
            })
          : html`<div
              class="sheet-menu"
              part="menu"
              role="menu"
              tabindex="0"
              aria-label=${this.#menuLabel}
              @contextmenu=${this.#onSurfaceContextMenu}
            >
              <slot name="menu" @slotchange=${() => this.#keys.roving.update()}></slot>
            </div>`
      }
    </tct-bottom-sheet>`;
  }

  // --------------------------------------------------------------------------------- render

  #widthStyles(): Record<string, string | undefined> {
    const resolved = this.menuWidth ? resolveMenuWidth(this.menuWidth, MENU_MAX_INLINE_SIZE) : null;
    if (!resolved) return {};
    return resolved.property === 'inline-size'
      ? {'--_menu-inline-size': resolved.value}
      : {'--_menu-min-inline-size': resolved.value};
  }

  protected override render(): TemplateResult {
    const sheet = this.#usesSheet;
    return html`
      <div
        class="trigger"
        part="trigger"
        ?data-disabled=${this.disabled}
        @contextmenu=${this.#onContextMenu}
        @keydown=${this.#onTriggerKeyDown}
      >
        <slot></slot>
      </div>
      <div class="layer layer-surface" popover="manual" data-placement="below">
        <div
          class="surface"
          part="menu"
          role="menu"
          tabindex="-1"
          aria-label=${this.#menuLabel}
          style=${styleMap(this.#widthStyles())}
          @contextmenu=${this.#onSurfaceContextMenu}
        >
          ${!sheet && this.items ? renderMenuOptions(this.items) : nothing}
          ${
            sheet
              ? nothing
              : html`<slot name="menu" @slotchange=${() => this.#keys.roving.update()}></slot>`
          }
        </div>
      </div>
      ${sheet ? this.#renderSheet() : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-context-menu': TctContextMenu;
  }
}
