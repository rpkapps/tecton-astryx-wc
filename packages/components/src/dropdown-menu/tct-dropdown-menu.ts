import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {styleMap} from 'lit/directives/style-map.js';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {
  AdaptivePresentationController,
  ADAPTIVE_PRESENTATIONS,
} from '@tecton-astryx/core/controllers/adaptive-presentation.js';
import {getModality} from '@tecton-astryx/core/controllers/interaction-modality.js';
import {SizeController} from '@tecton-astryx/core/controllers/size.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TctAfterOpenChangeEvent} from '@tecton-astryx/core/events/tct-after-open-change.js';
import type {ChangeReason} from '@tecton-astryx/core/events/tct-event.js';
import {TctOpenChangeEvent} from '@tecton-astryx/core/events/tct-open-change.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import {LayerController} from '@tecton-astryx/core/layer/layer-controller.js';
import {PositionController, type PositionOptions} from '@tecton-astryx/core/layer/position.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {getTabbables} from '@tecton-astryx/core/utils/focus.js';
import {uniqueId} from '@tecton-astryx/core/utils/id.js';
import defaultMessages from '@tecton-astryx/locales/en/dropdownMenu.js';
import {TctBottomSheet} from '../bottom-sheet/tct-bottom-sheet.js';
import {TctButton} from '../button/tct-button.js';
import type {ButtonSize, ButtonVariant} from '../button/button.types.js';
import {TctDivider} from '../divider/tct-divider.js';
import {TctHeading} from '../heading/tct-heading.js';
import {TctIconButton} from '../icon-button/tct-icon-button.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctList} from '../list/tct-list.js';
import {TctListItem} from '../list/tct-list-item.js';
import base from '../styles/base.styles.css';
import layer from '../styles/layer.styles.css';
import motion from '../styles/motion.styles.css';
import {
  dropdownMenuContext,
  type DropdownMenuContextValue,
} from './dropdown-menu.context.js';
import {
  MENU_ALIGNMENTS,
  MENU_PLACEMENTS,
  MENU_PRESENTATIONS,
  resolveMenuWidth,
  type DropdownMenuItemData,
  type DropdownMenuOption,
  type MenuAlignment,
  type MenuPlacement,
  type MenuPresentation,
} from './dropdown-menu.types.js';
import {renderMenuOptions, labelText} from './menu-data.js';
import {MenuKeyboardController} from './menu-keyboard.controller.js';
import {collectMenuItems} from './menu-items.js';
import {renderSheetView} from './menu-sheet.js';
import styles from './tct-dropdown-menu.styles.css';
import surfaceStyles from './tct-menu-surface.styles.css';
import sheetStyles from './tct-menu-sheet.styles.css';
import {TctDropdownMenuCheckboxItem} from './tct-dropdown-menu-checkbox-item.js';
import {TctDropdownMenuDivider} from './tct-dropdown-menu-divider.js';
import {TctDropdownMenuItem} from './tct-dropdown-menu-item.js';
import {TctDropdownMenuRadioGroup} from './tct-dropdown-menu-radio-group.js';
import {TctDropdownMenuRadioItem} from './tct-dropdown-menu-radio-item.js';
import {TctDropdownMenuSubMenu} from './tct-dropdown-menu-sub-menu.js';

/** Elements that already are a button, for the button + menu pattern. */
const BUTTON_SELECTOR = 'button, [role="button"]';

/** The menu never takes more than the viewport minus a 16px gutter on each side. */
const MENU_MAX_INLINE_SIZE = 'calc(100vi - var(--spacing-8))';

/**
 * A menu of actions opened from a trigger button. The trigger is a built-in `tct-button` (configured by
 * `label`, `variant`, `size`, `icon`, `icon-only`, `tooltip`, `disabled`) or your own button in
 * `slot="trigger"`. The menu is either **compound**, made of `tct-dropdown-menu-item`, checkbox, radio,
 * divider and submenu children, or **data-driven** through the `items` property (rows, dividers,
 * sections, nested `items` for submenus). Only data mode supports the bottom-sheet presentation.
 *
 * Implements the WAI-ARIA menu button pattern: the trigger has `aria-haspopup="menu"` and
 * `aria-expanded`; the surface is a `role="menu"` named from the trigger label; items are
 * `menuitem`, `menuitemcheckbox` or `menuitemradio`. Enter, Space or ArrowDown on the trigger opens it
 * and focuses the first enabled row (a pointer open focuses the surface itself, so no row reads as
 * pre-selected, and the first arrow key enters); arrows, Home and End rove (no wrap) and disabled rows
 * stay reachable; typing a character jumps to the next matching row; Escape closes the top-most menu
 * level and returns focus; Tab closes the menu. A row's activation closes the menu unless the row opts
 * out.
 *
 * The surface lives in this element's shadow root, so the trigger carries `aria-controls` only for the
 * built-in button; a custom trigger relies on `aria-expanded` and `aria-haspopup`
 * (`[mwg:accessible-web-components]`).
 *
 * @summary A menu of actions opened from a trigger button; compound or data-driven, popover or bottom sheet.
 * @tag tct-dropdown-menu
 * @upstream DropdownMenu
 * @slot - The menu rows (compound mode): `tct-dropdown-menu-item`, `-checkbox-item`, `-radio-group`, `-divider`, `-sub-menu`.
 * @slot trigger - Your own trigger button, replacing the built-in `tct-button`.
 * @slot icon - Custom icon of the built-in trigger; overrides the `icon` attribute.
 * @csspart anchor - The inline-flex wrapper the menu is anchored to.
 * @csspart trigger - The built-in trigger button.
 * @csspart menu - The painted menu surface (upstream theming target `dropdown-menu`).
 * @csspart section - A data-mode group of rows.
 * @csspart section-heading - The heading of a data-mode group (upstream theming target `dropdown-menu-section-heading`).
 * @csspart sheet - The bottom sheet of the touch presentation.
 * @csspart sheet-content - The content of the bottom sheet.
 * @cssstate open - The menu is open.
 * @fires {TctOpenChangeEvent} tct-open-change - Before the user (trigger, Escape, outside press, Tab, choosing a row) or `requestClose()` opens or closes it; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After an open or close settled; every actual change.
 * @cloakDisplay inline-flex
 */
export class TctDropdownMenu extends TctElement {
  static override readonly tagName: string = 'tct-dropdown-menu';
  static override readonly dependencies = [
    TctButton,
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

  /** Label of the built-in trigger, and the accessible name of the menu. Default: the localized "Menu". */
  @property() label = '';

  /** Trigger button variant. Default: the button's own (`secondary`). */
  @property() variant: ButtonVariant | undefined;

  /** Trigger button size; also sizes the rows. Unset: the nearest size provider, else `md`. */
  @property({reflect: true}) size: ButtonSize | undefined;

  /** Registered icon name shown before the trigger label. */
  @property() icon = '';

  /** Shows only the icon on the trigger; `label` is then its accessible name. Hides the chevron. */
  @property({type: Boolean, attribute: 'icon-only'}) iconOnly = false;

  /** Tooltip of the trigger; suppressed while the menu is open. */
  @property() tooltip = '';

  /** Disables the trigger. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** Removes the chevron from a labelled trigger (upstream `hasChevron=false`). */
  @property({type: Boolean, attribute: 'no-chevron'}) noChevron = false;

  /** Which side of the trigger the menu opens on. Logical: `start`/`end` follow the direction. */
  @property() placement: MenuPlacement = 'below';

  /** Alignment along the placement axis. Logical, like `placement`. */
  @property() alignment: MenuAlignment = 'start';

  /**
   * Minimum width of the popover menu: it may grow for its content and is capped to the viewport. A bare
   * number is px; intrinsic keywords (`max-content`, `fit-content`) set the preferred width. Default: the
   * trigger width. Ignored by the bottom sheet.
   */
  @property({attribute: 'menu-width'}) menuWidth: string | undefined;

  /**
   * How data-driven `items` are presented: an anchored `popover` (default), a modal `bottom-sheet`, or
   * `adaptive` (a sheet on a compact touch device, a popover elsewhere). Compound children are always a
   * popover.
   */
  @property({reflect: true}) presentation: MenuPresentation = 'popover';

  /**
   * The rows of a data-driven menu: actions `{label, onClick?, icon?, description?, endContent?,
   * variant?, disabled?, closeOnSelect?, id?, items?}`, dividers `{type: 'divider'}` and sections
   * `{type: 'section', title?, items}`. A row with `items` is a submenu. Leave unset for compound mode.
   */
  @property({attribute: false}) items: DropdownMenuOption[] | undefined;

  /** Label of the Back button in the bottom sheet's drill-in view. Default: the localized "Back". */
  @property({attribute: 'back-label'}) backLabel: string | undefined;

  /** Opens the menu without an intent event; resolves once it settled. */
  async show(): Promise<void> {
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

  readonly #id = uniqueId('tct-dropdown-menu');
  readonly #locale = new LocaleController(this, {
    namespace: 'dropdownMenu',
    defaults: defaultMessages,
  });
  readonly #slots = new SlotController(this, 'icon');
  readonly #size = new SizeController(this, {explicit: () => this.size, fallback: 'md'});
  readonly #presentation = new AdaptivePresentationController(this, () => this.#policy);
  readonly #context = new ContextProvider(this, {
    context: dropdownMenuContext,
    initialValue: this.#contextValue(),
  });
  #settled: Promise<void> = Promise.resolve();
  #boundButton: HTMLElement | null = null;
  /** Set for a menu that mounts open: not an open anyone asked for, so it must not steal focus. */
  #mountedOpen = false;
  #sheetFocus: 'keyboard' | 'pointer' = 'pointer';

  /** The submenu rows the sheet drilled into, root first. */
  #path: DropdownMenuItemData[] = [];

  readonly #keys = new MenuKeyboardController(this, {
    surface: () => this.#surface,
    items: () => collectMenuItems(this.#surface),
    onTab: () => {
      this.#request(false, 'keyboard');
    },
  });

  readonly #position = new PositionController(this, this.#positionOptions());

  readonly #layer: LayerController = new LayerController(this, {
    kind: 'popover',
    surface: () => this.#layerElement,
    trigger: () => this.#boundButton,
    haspopup: 'menu',
    // A pointer open focuses the surface, a keyboard (or programmatic) open the first enabled row.
    initialFocus: () => this.#initialFocusTarget(),
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
    onHidden: () => {
      this.#keys.reset();
    },
  });

  #positionOptions(): PositionOptions {
    const menuWidth = (): string | undefined => this.menuWidth;
    return {
      surface: () => this.#layerElement,
      anchor: () => this.#anchorElement,
      placement: () => ({
        placement: this.#placement,
        alignment: this.#alignment,
        offset: 'var(--spacing-1)',
      }),
      // At least as wide as the trigger, unless `menu-width` says otherwise.
      get matchAnchorWidth() {
        return menuWidth() ? false : 'min';
      },
      trackPlacement: true,
    };
  }

  get #policy(): MenuPresentation {
    return ADAPTIVE_PRESENTATIONS.includes(this.presentation) ? this.presentation : 'popover';
  }

  /** Whether the touch sheet is showing: data mode only, resolved by the presentation policy. */
  get #usesSheet(): boolean {
    return this.items !== undefined && this.#presentation.resolved === 'bottom-sheet';
  }

  get #layerElement(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.layer');
  }

  get #surface(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.surface');
  }

  get #placement(): MenuPlacement {
    return MENU_PLACEMENTS.includes(this.placement) ? this.placement : 'below';
  }

  get #alignment(): MenuAlignment {
    return MENU_ALIGNMENTS.includes(this.alignment) ? this.alignment : 'start';
  }

  get #anchorElement(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.anchor');
  }

  get #menuLabel(): string {
    return this.triggerLabel;
  }

  /**
   * The trigger's label and the menu's accessible name: `label`, else the localized default. Subclasses
   * (`tct-more-menu`) change the default.
   * @internal
   */
  protected get triggerLabel(): string {
    return this.label || this.#locale.t('label');
  }

  /**
   * The trigger's tooltip (suppressed while open). Subclasses whose trigger has no visible text
   * (`tct-more-menu`) default it to the label.
   * @internal
   */
  protected get triggerTooltip(): string {
    return this.tooltip;
  }

  #slottedTrigger(): HTMLElement | null {
    return (
      [...this.children].find(
        (child): child is HTMLElement =>
          child instanceof HTMLElement && child.getAttribute('slot') === 'trigger',
      ) ?? null
    );
  }

  #contextValue(): DropdownMenuContextValue {
    return {
      size: this.#size.value,
      open: this.open,
      close: (reason = 'selection') => {
        this.#request(false, reason);
      },
      returnFocusTarget: () => this.#boundButton,
    };
  }

  #request(open: boolean, reason: ChangeReason): void {
    if (open && this.disabled) return;
    if (this.dispatch(new TctOpenChangeEvent(open, reason))) this.open = open;
  }

  // -------------------------------------------------------------------------- focus on open

  #initialFocusTarget(): HTMLElement | null {
    if (this.#mountedOpen) return null;
    const surface = this.#surface;
    // A pointer open focuses the surface itself so no row reads as pre-selected (upstream #4477).
    if (getModality() === 'pointer') return surface;
    return this.#keys.firstEnabled() ?? surface;
  }

  #exitAnimation(): Animation[] {
    const layerElement = this.#layerElement;
    if (!layerElement || matchMedia('(prefers-reduced-motion: reduce)').matches) return [];
    return [
      layerElement.animate([{opacity: 1}, {opacity: 0}], {duration: 120, easing: 'ease-in'}),
    ];
  }

  // -------------------------------------------------------------------------- trigger wiring

  /** The control that gets the ARIA state and handlers: the trigger itself, or the button inside it. */
  #buttonOf(element: HTMLElement | null): HTMLElement | null {
    if (!element) return null;
    if (element.matches(BUTTON_SELECTOR)) return element;
    const inner = element.querySelector<HTMLElement>(BUTTON_SELECTOR);
    if (inner) return inner;
    // A library element that renders a button in its own shadow root (tct-button, tct-icon-button).
    return element.localName.includes('-') ? element : null;
  }

  #bindTrigger(): void {
    const slotted = this.#slottedTrigger();
    const anchor = slotted ?? this.renderRoot.querySelector<HTMLElement>('.trigger');
    const button = this.#buttonOf(anchor);
    if (slotted && !button) {
      devWarn(
        'tct-dropdown-menu:trigger',
        'The trigger must be, or contain, a <button> or [role="button"] element: the menu implements the menu button ARIA pattern.',
      );
    }
    if (button !== this.#boundButton) {
      this.#unbindTrigger();
      this.#boundButton = button;
      if (button) {
        button.addEventListener('click', this.#onTriggerClick);
        button.addEventListener('keydown', this.#onTriggerKeyDown);
        // Feeds the pointer/keyboard distinction: a click with `detail === 0` is assistive technology.
        button.addEventListener('pointerdown', this.#onTriggerPointerDown);
      }
    }
    this.#syncTriggerAria();
  }

  #unbindTrigger(): void {
    const button = this.#boundButton;
    if (button) {
      button.removeEventListener('click', this.#onTriggerClick);
      button.removeEventListener('keydown', this.#onTriggerKeyDown);
      button.removeEventListener('pointerdown', this.#onTriggerPointerDown);
      button.removeAttribute('aria-haspopup');
      button.removeAttribute('aria-expanded');
      button.removeAttribute('aria-controls');
    }
    this.#boundButton = null;
  }

  #syncTriggerAria(): void {
    const button = this.#boundButton;
    if (!button) return;
    button.setAttribute('aria-haspopup', this.#usesSheet ? 'dialog' : 'menu');
    button.setAttribute('aria-expanded', String(this.open));
    // The button and the surface share this shadow root only for the built-in trigger.
    const surface = this.#surface;
    if (this.open && !this.#usesSheet && surface?.getRootNode() === button.getRootNode()) {
      button.setAttribute('aria-controls', surface.id);
    } else {
      button.removeAttribute('aria-controls');
    }
  }

  readonly #onTriggerClick = (event: Event): void => {
    if (this.disabled) return;
    if (this.#usesSheet) {
      // The sheet is a separate layer: the trigger toggles it, and a click from assistive technology
      // (detail 0) is a keyboard open, so focus lands on the first action.
      this.#sheetFocus = (event as MouseEvent).detail === 0 ? 'keyboard' : getModality() === 'pointer' ? 'pointer' : 'keyboard';
      this.#request(!this.open, 'trigger');
      return;
    }
    this.#layer.toggleFromTrigger(event);
  };

  readonly #onTriggerPointerDown = (): void => {
    this.#sheetFocus = 'pointer';
  };

  readonly #onTriggerKeyDown = (event: KeyboardEvent): void => {
    if (event.isComposing || this.disabled || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.#sheetFocus = 'keyboard';
      if (!this.open) {
        this.#request(true, 'keyboard');
      } else if (!this.#usesSheet) {
        // Open with focus still on the trigger (a menu that mounted open, or a pointer open followed by
        // Shift+Tab): ArrowDown walks in the way a keyboard open would have landed.
        this.#keys.focusFirstOrSurface();
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      this.#sheetFocus = 'keyboard';
    }
  };

  // ------------------------------------------------------------------------------ lifecycle

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unbindTrigger();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (
      (changed.has('placement') && !MENU_PLACEMENTS.includes(this.placement)) ||
      (changed.has('alignment') && !MENU_ALIGNMENTS.includes(this.alignment))
    ) {
      devWarn(
        'tct-dropdown-menu:enum',
        `Invalid placement "${this.placement}" or alignment "${this.alignment}".`,
      );
    }
    if (changed.has('presentation') && !MENU_PRESENTATIONS.includes(this.presentation)) {
      devWarn(
        'tct-dropdown-menu:presentation',
        `presentation="${this.presentation}" is not one of ${MENU_PRESENTATIONS.join(', ')}.`,
      );
    }
    if (changed.has('presentation') && this.presentation !== 'popover' && this.items === undefined) {
      devWarn(
        'tct-dropdown-menu:presentation-compound',
        'Only data-driven menus (`items`) support the bottom sheet; compound children are always a popover.',
      );
    }
    const current = this.#context.value;
    if (current?.size !== this.#size.value || current.open !== this.open) {
      this.#context.setValue(this.#contextValue());
    }
    // Closing returns the sheet to the root view.
    if (!this.open && this.#path.length > 0) this.#path = [];
  }

  protected override firstUpdated(): void {
    // Markup that mounts open is not an open anyone asked for: keep focus where it is.
    this.#mountedOpen = this.open;
  }

  protected override updated(changed: PropertyValues<this>): void {
    this.#bindTrigger();
    this.toggleState('open', this.open);
    // Every update: the presentation can change with the device (a media query) while `open` stays.
    this.#syncLayer(changed.get('open'));
    if (this.open && (changed.has('placement') || changed.has('alignment'))) {
      this.#position.update();
    }
  }

  /** Brings the popover layer in line with `open` and the resolved presentation. */
  #syncLayer(previousOpen: boolean | undefined): void {
    const wantLayer = this.open && !this.#usesSheet;
    if (wantLayer === this.#layer.isOpen) {
      if (previousOpen !== undefined && previousOpen !== this.open) this.#settleSheet();
      return;
    }
    // The first update of a closed menu is not a change.
    if (previousOpen === undefined && !this.open) return;
    if (wantLayer) this.#keys.roving.update();
    const settled = wantLayer ? this.#layer.show() : this.#layer.hide();
    this.#settled = settled.then(() => {
      this.#mountedOpen = false;
      if (this.open === this.#layer.isOpen || this.#usesSheet) {
        this.dispatch(new TctAfterOpenChangeEvent(this.open));
      }
    });
  }

  /** The sheet settles on its own; `tct-after-open-change` follows the sheet's event. */
  #settleSheet(): void {
    this.#settled = Promise.resolve();
  }

  // -------------------------------------------------------------------------------- the sheet

  /** Drills into (or out of) a submenu of the sheet; the heading takes focus so the new view is announced. */
  #setPath(path: DropdownMenuItemData[]): void {
    this.#path = path;
    this.requestUpdate();
    if (path.length > 0) this.#focusSheetHeading();
  }

  #focusSheetHeading(): void {
    requestAnimationFrame(() => {
      this.renderRoot.querySelector<HTMLElement>('.sheet-heading')?.focus({preventScroll: true});
    });
  }

  #focusFirstSheetAction(): void {
    const content = this.renderRoot.querySelector<HTMLElement>('.sheet-content');
    if (!content) return;
    requestAnimationFrame(() => {
      const target = getTabbables(content).find((element) => element.localName !== 'tct-heading');
      target?.focus({preventScroll: true});
    });
  }

  #onSheetOpenChange = (event: TctOpenChangeEvent): void => {
    // The sheet asks to close (Escape, scrim, swipe): ask ours, and let the answer drive the sheet.
    event.stopPropagation();
    event.preventDefault();
    if (!event.open) this.#request(false, event.reason);
  };

  #onSheetAfterOpenChange = (event: Event): void => {
    event.stopPropagation();
    this.dispatch(new TctAfterOpenChangeEvent(this.open));
    if (this.open && this.#sheetFocus === 'keyboard') this.#focusFirstSheetAction();
  };

  #renderSheet(): TemplateResult {
    const items = this.items ?? [];
    const current = this.#path.at(-1);
    const rows = current?.items ?? items;
    const title = current ? labelText(current.label) : this.#menuLabel;
    return html`<tct-bottom-sheet
      class="sheet"
      part="sheet"
      height="hug"
      purpose="info"
      label=${title || this.#menuLabel}
      .open=${this.open}
      .finalFocusElement=${this.#boundButton}
      @tct-open-change=${this.#onSheetOpenChange}
      @tct-after-open-change=${this.#onSheetAfterOpenChange}
    >
      ${renderSheetView({
        title: title || this.#menuLabel,
        items: rows,
        canGoBack: this.#path.length > 0,
        backLabel: this.backLabel ?? this.#locale.t('back', undefined, 'back-label'),
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
      })}
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

  #renderTrigger(): TemplateResult {
    const chevron =
      this.noChevron || this.iconOnly
        ? nothing
        : html`<tct-icon slot="end" name="chevronDown" size="sm" color="inherit"></tct-icon>`;
    return html`<tct-button
      class="trigger"
      part="trigger"
      variant=${ifDefined(this.variant)}
      size=${ifDefined(this.size)}
      label=${this.#menuLabel}
      icon=${this.icon}
      ?icon-only=${this.iconOnly}
      ?disabled=${this.disabled}
      tooltip=${this.open ? '' : this.triggerTooltip}
      ?data-open=${this.open}
      >${this.#slots.has('icon') ? html`<slot name="icon" slot="icon"></slot>` : nothing}${chevron}</tct-button
    >`;
  }

  protected override render(): TemplateResult {
    return html`
      <span class="anchor" part="anchor">
        <slot name="trigger" @slotchange=${() => this.#bindTrigger()}>${this.#renderTrigger()}</slot>
      </span>
      <div class="layer layer-surface" popover="manual" data-placement=${this.#placement}>
        <div
          class="surface"
          part="menu"
          id=${this.#id}
          role="menu"
          tabindex="-1"
          aria-label=${this.#menuLabel}
          style=${styleMap(this.#widthStyles())}
        >
          ${this.items ? renderMenuOptions(this.items) : nothing}
          <slot @slotchange=${() => this.#keys.roving.update()}></slot>
        </div>
      </div>
      ${this.#usesSheet ? this.#renderSheet() : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-dropdown-menu': TctDropdownMenu;
  }
}
