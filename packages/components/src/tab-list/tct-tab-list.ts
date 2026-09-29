import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {html as staticHtml, literal} from 'lit/static-html.js';
import {ContextProvider} from '@tecton-wc/core/context/protocol.js';
import type {ElementSize} from '@tecton-wc/core/context/keys.js';
import {AriaDelegateController} from '@tecton-wc/core/controllers/aria-delegate.js';
import {
  KeyboardHintController,
  keyboardHintStyles,
} from '@tecton-wc/core/controllers/keyboard-hint.js';
import {observeResize} from '@tecton-wc/core/controllers/resize.js';
import {RovingTabindexController} from '@tecton-wc/core/controllers/roving-tabindex.js';
import {SizeController} from '@tecton-wc/core/controllers/size.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import {TctValueChangeEvent} from '@tecton-wc/core/events/tct-value-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {prefersReducedMotion} from '@tecton-wc/core/features.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {containsFlat, deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import defaultMessages from '@tecton-wc/locales/en/tabList.js';
import {TctIcon} from '../icon/tct-icon.js';
import base from '../styles/base.styles.css';
import {tabListContext, type TabListContextValue} from './tab-list.context.js';
import {
  TAB_LIST_ACTIVATIONS,
  TAB_LIST_EDGE_COMPENSATIONS,
  TAB_LIST_LAYOUTS,
  TAB_LIST_OVERFLOWS,
  TAB_LIST_PATTERNS,
  type TabListActivation,
  type TabListEdgeCompensation,
  type TabListLayout,
  type TabListOverflow,
  type TabListPattern,
} from './tab-list.types.js';
import styles from './tct-tab-list.styles.css';
import type {TctTab} from './tct-tab.js';
import type {TctTabMenu} from './tct-tab-menu.js';

/** Fraction of the visible strip an arrow press scrolls. */
const SCROLL_PAGE_RATIO = 0.8;

type Stop = TctTab | TctTabMenu;

/**
 * A strip of tabs that switches between related views. It has two patterns.
 *
 * **Navigation** (the default): a `<nav>` landmark of buttons or links; the current tab carries
 * `aria-current="true"`. Arrow keys move focus (both axes) and Enter, Space or a click select.
 *
 * **Tabs** (`pattern="tabs"`, or `role="tablist"` on the element): the WAI-ARIA tabs pattern. The
 * element is the `tablist`, each tab is `role="tab"` with `aria-selected` and `aria-controls` pointing
 * at its panel (`panel-id` on the tab), only tabs may live inside, and a tab never navigates. Left
 * and Right arrows move focus and, by default, select (`activation="automatic"`); with
 * `activation="manual"` they move focus only and Enter or Space select, for panels that are costly to
 * load. Up and Down are left to the page.
 *
 * In both patterns the strip is one Tab stop (the selected tab), Home and End jump to the ends,
 * disabled tabs are skipped, and a first keyboard entry shows the arrow-key hint. Tabs wider than the
 * strip scroll horizontally with edge fades and, for pointers that hover, arrow buttons; the selected
 * tab is always scrolled back into view. `tct-tab-menu` adds a menu of extra options.
 *
 * `value` (property) is the current tab; the `value` attribute is the initial one. Changing it from code
 * never fires events; a user selecting a tab fires the cancelable `tct-value-change` first.
 *
 * @summary A strip of tabs: a navigation landmark by default, the WAI-ARIA tabs pattern with `pattern="tabs"`.
 * @tag tct-tab-list
 * @upstream TabList
 * @slot - `tct-tab` and `tct-tab-menu` children (only `tct-tab` under the tabs pattern).
 * @csspart base - The outer box (`<nav>` in the navigation pattern); upstream theming target `tab-list`.
 * @csspart strip - The scrolling strip that holds the tabs (upstream theming target `tab-strip`).
 * @csspart scroll-button - A scroll arrow shown while tabs are out of view (upstream theming target `tab-scroll-button`).
 * @csspart keyboard-hint - The arrow-key hint shown once on first keyboard focus.
 * @fires {TctValueChangeEvent<string>} tct-value-change - Before a user selects a tab; cancelable. `value` is the requested tab.
 * @cssstate tabs - The strip speaks the tabs pattern.
 * @cloakDisplay block
 * @cloakMinBlockSize var(--size-element-md)
 */
export class TctTabList extends TctElement {
  static override readonly tagName = 'tct-tab-list';
  static override readonly dependencies = [TctIcon];
  static override styles: CSSResultGroup = [base, keyboardHintStyles, styles];

  static override get observedAttributes(): string[] {
    // `role="tablist"` on the host asks for the tabs pattern, like upstream `role="tablist"`.
    return [...super.observedAttributes, 'role'];
  }

  /** The current tab's `value`. As an attribute it is the initial selection; a property write is the current one. */
  @property() value = '';

  /** Size of the tab hover targets: `sm`, `md` or `lg`. Unset follows an enclosing size provider or toolbar, else `md`. */
  @property({reflect: true}) size: ElementSize | undefined;

  /** `hug` sizes each tab to its content; `fill` stretches the tabs equally across the strip. */
  @property({reflect: true}) layout: TabListLayout = 'hug';

  /** Draws a divider rule under the strip; the selected indicator sits on it. */
  @property({type: Boolean, attribute: 'has-divider', reflect: true}) hasDivider = false;

  /**
   * `inline` pulls the strip out through the padding of its Layout container so a divider spans the
   * container's content width, then pads the first and last label back onto the content edge. It reads
   * `--_container-padding-inline-start` and `--_container-padding-inline-end` published by padded
   * containers; outside one it changes nothing.
   */
  @property({reflect: true, attribute: 'edge-compensation'}) edgeCompensation:
    | TabListEdgeCompensation
    | undefined;

  /** Deprecated alias of `edge-compensation="inline"` (upstream `isFullBleed`); the explicit attribute wins. */
  @property({type: Boolean, attribute: 'full-bleed', reflect: true}) fullBleed = false;

  /**
   * `nav` (default): a navigation landmark, current tab marked with `aria-current`. `tabs`: the
   * WAI-ARIA tabs pattern. `role="tablist"` on the element is the same as `pattern="tabs"`.
   */
  @property({reflect: true}) pattern: TabListPattern = 'nav';

  /**
   * Tabs pattern only. `automatic` (default): arrow keys move focus and select. `manual`: arrows move
   * focus only; Enter or Space select. Use `manual` when a panel is costly to load.
   */
  @property({reflect: true}) activation: TabListActivation = 'automatic';

  /**
   * Tabs wider than the strip: `auto` and `scroll` scroll them (edge fades, arrow buttons for pointers
   * that hover, the selected tab always kept in view); `visible` turns overflow handling off.
   */
  @property({reflect: true}) overflow: TabListOverflow = 'auto';

  /** Accessible name of the strip. Default: the localized "Tabs". A host `aria-label` or `aria-labelledby` wins. */
  @property() label = '';

  @state() private _overflowStart = false;
  @state() private _overflowEnd = false;

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'tabList',
    defaults: defaultMessages,
  });
  readonly #size: SizeController = new SizeController(this, {
    explicit: () => this.size,
    fallback: 'md',
  });
  #lastContext: TabListContextValue | undefined;
  #revealedValue: string | null = null;
  #stopObserving: (() => void) | undefined;
  #observedStrip: Element | null = null;

  /**
   * A tab (or menu option) asks to become the value: the cancelable `tct-value-change` first, then the
   * value unless that was prevented. The value it already has is not a change.
   * (Declared before the provider: the provider's first value captures it.)
   */
  readonly #select = (value: string, reason: ChangeReason): void => {
    if (value === this.value) return;
    if (this.dispatch(new TctValueChangeEvent<string>(value, this.value, reason))) {
      this.value = value;
    }
  };

  /** A stop changed what it renders: place the tab stop again (after the current update batch). */
  readonly #refresh = (): void => {
    void this.#settle();
  };

  readonly #provider: ContextProvider<typeof tabListContext> = new ContextProvider<
    typeof tabListContext
  >(this, {
    context: tabListContext,
    initialValue: this.#contextValue(),
  });

  readonly #roving: RovingTabindexController<Stop> = new RovingTabindexController<Stop>(this, {
    items: () => this.#stops(),
    // The navigation pattern accepts both axes (APG allows it for tab strips); a tablist reports itself
    // horizontal, so the vertical arrows are left to scroll the page.
    orientation: () => (this.#isTabs ? 'horizontal' : 'both'),
    wrap: true,
    isDisabled: (stop) => this.#stopDisabled(stop),
    // The stop is the inner native control; the host must never take `tabindex` (it would hide its subtree).
    focusTarget: (stop) => stop.control,
    // APG automatic activation: focus and selection move together (tabs pattern only).
    activateOnFocus: () => this.#isTabs && this.activation !== 'manual',
    onActivate: (stop, event) => {
      if (stop.localName === 'tct-tab') {
        this.#select((stop as TctTab).value, 'keyboard');
        void event;
      }
    },
    // A menu's own keys (arrows inside its open surface) belong to the menu.
    boundary: (stop) => stop.localName === 'tct-tab-menu',
  });

  readonly #hint: KeyboardHintController = new KeyboardHintController(this, {
    orientation: 'horizontal',
  });

  constructor() {
    super();
    new AriaDelegateController(this, {
      // The navigation pattern names the inner `<nav>`; under the tabs pattern the host is the tablist.
      target: () => (this.#isTabs ? null : this.#nav),
      exclude: ['aria-orientation'],
    });
  }

  /** The `<nav>` landmark (navigation pattern only). */
  get #nav(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.root');
  }

  get #strip(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.strip');
  }

  /** Whether the strip speaks the tabs pattern (`pattern="tabs"` or `role="tablist"` on the host). */
  get #isTabs(): boolean {
    return this.pattern === 'tabs' || this.getAttribute('role') === 'tablist';
  }

  get #hasScroll(): boolean {
    return this.overflow !== 'visible';
  }

  get #edgeCompensated(): boolean {
    return this.edgeCompensation === 'inline' || (this.edgeCompensation === undefined && this.fullBleed);
  }

  /** Tabs and tab menus, in DOM order. */
  #stops(): Stop[] {
    return [...this.children].filter(
      (child): child is Stop => child.localName === 'tct-tab' || child.localName === 'tct-tab-menu',
    );
  }

  #tabs(): TctTab[] {
    return this.#stops().filter((stop): stop is TctTab => stop.localName === 'tct-tab');
  }

  #stopDisabled(stop: Stop): boolean {
    return (stop as TctTab).disabled === true;
  }

  /** The tab whose `value` is the strip's value. */
  #selectedTab(): TctTab | undefined {
    return this.value === '' ? undefined : this.#tabs().find((tab) => tab.value === this.value);
  }

  /** The stop that shows the selection: the selected tab, or the menu holding the selected option. */
  #selectedStop(): Stop | undefined {
    return (
      this.#selectedTab() ??
      this.#stops().find(
        (stop) => stop.localName === 'tct-tab-menu' && (stop as TctTabMenu).selectedOption !== undefined,
      )
    );
  }

  #contextValue(): TabListContextValue {
    const next: TabListContextValue = {
      value: this.value,
      size: this.#size.value,
      layout: TAB_LIST_LAYOUTS.includes(this.layout) ? this.layout : 'hug',
      pattern: this.#isTabs ? 'tabs' : 'nav',
      select: this.#select,
      refresh: this.#refresh,
    };
    const last = this.#lastContext;
    // Keep the identity while nothing changed: every change re-renders every tab.
    if (
      last?.value === next.value &&
      last.size === next.size &&
      last.layout === next.layout &&
      last.pattern === next.pattern
    ) {
      return last;
    }
    this.#lastContext = next;
    return next;
  }

  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'role') this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopObserving?.();
    this.#stopObserving = undefined;
    this.#observedStrip = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A moved element lost its observer on the way out.
    if (this.hasUpdated) this.#observeStrip();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    this.#warnInvalid(changed);
    this.#provider.setValue(this.#contextValue());
    // The host is the tablist under the tabs pattern (A§8.1); a host `aria-label`/`-labelledby` wins.
    const tabs = this.#isTabs;
    this.internals.role = tabs ? 'tablist' : null;
    this.internals.ariaLabel = tabs ? this.label || this.#locale.t('label', undefined, 'label') : null;
    this.toggleState('tabs', tabs);
  }

  #warnInvalid(changed: PropertyValues<this>): void {
    const check = (
      name: string,
      value: string,
      allowed: readonly string[],
      fallback: string,
    ): void => {
      if (changed.has(name as keyof TctTabList) && !allowed.includes(value)) {
        devWarn(
          `tab-list:${name}:${value}`,
          `<tct-tab-list ${name}="${value}"> is not one of ${allowed.join(', ')}; using "${fallback}".`,
        );
      }
    };
    check('layout', this.layout, TAB_LIST_LAYOUTS, 'hug');
    check('pattern', this.pattern, TAB_LIST_PATTERNS, 'nav');
    check('activation', this.activation, TAB_LIST_ACTIVATIONS, 'automatic');
    check('overflow', this.overflow, TAB_LIST_OVERFLOWS, 'auto');
    if (
      changed.has('edgeCompensation') &&
      this.edgeCompensation !== undefined &&
      !TAB_LIST_EDGE_COMPENSATIONS.includes(this.edgeCompensation)
    ) {
      devWarn(
        `tab-list:edge-compensation:${this.edgeCompensation}`,
        `<tct-tab-list edge-compensation="${this.edgeCompensation}"> only supports "inline".`,
      );
    }
  }

  protected override firstUpdated(): void {
    this.#observeStrip();
  }

  protected override updated(changed: PropertyValues<this>): void {
    this.#observeStrip();
    if (changed.has('value') || changed.has('overflow')) this.#revealOnce();
    void this.#settle();
  }

  /** Watches the strip's size and scroll position: fades, arrows and keeping the selected tab in view. */
  #observeStrip(): void {
    const strip = this.#strip;
    if (strip === this.#observedStrip) return;
    this.#stopObserving?.();
    this.#stopObserving = undefined;
    this.#observedStrip = strip;
    if (!strip) return;
    // Deferred a frame: measuring changes state that changes layout, and doing that inside the observer
    // callback ends the frame with "ResizeObserver loop completed with undelivered notifications".
    this.#stopObserving = observeResize(this, () => {
      requestAnimationFrame(() => {
        if (!this.isConnected) return;
        this.#measure();
        this.#reveal(this.#selectedStop());
      });
    });
    this.#measure();
  }

  #measure(): void {
    const strip = this.#strip;
    if (!strip || !this.#hasScroll) {
      this._overflowStart = false;
      this._overflowEnd = false;
      return;
    }
    // In right-to-left the scroll offset runs negative: the distance from the reading start is its magnitude.
    const scrolled = Math.abs(strip.scrollLeft);
    const max = strip.scrollWidth - strip.clientWidth;
    this._overflowStart = scrolled > 1;
    this._overflowEnd = scrolled < max - 1;
  }

  /** Tabs render after the strip does: then the tab stop is placed and the tabs learn about their panels. */
  async #settle(): Promise<void> {
    const stops = this.#stops();
    await Promise.all(stops.map((stop) => stop.updateComplete));
    if (!this.isConnected) return;
    const focusInside = containsFlat(this, deepActiveElement());
    const selected = this.#selectedStop();
    // A focused tab keeps the stop (arrowing focus without selecting); otherwise it is the selected one.
    if (!focusInside && selected && !this.#stopDisabled(selected)) this.#roving.setActive(selected);
    else this.#roving.update();
    for (const tab of this.#tabs()) tab.syncControls();
    this.#warnStrangers();
    this.#measure();
  }

  #warnStrangers(): void {
    if (!this.#isTabs) return;
    const stranger = [...this.children].find(
      (child) => child.localName !== 'tct-tab' && !child.hasAttribute('slot'),
    );
    if (stranger) {
      devWarn(
        'tab-list:stranger',
        `A tab list with pattern="tabs" owns only tabs, but it contains a <${stranger.localName}>. Render menus and other controls outside the strip, or use the navigation pattern.`,
      );
    }
  }

  /** The selected tab has to be visible: on load, and when the host sets `value` itself. */
  #revealOnce(): void {
    if (this.#revealedValue === this.value) return;
    this.#revealedValue = this.value;
    requestAnimationFrame(() => {
      this.#reveal(this.#selectedStop());
    });
  }

  /**
   * Scrolls `stop` clear of the edge fades. A stop wider than the space kept clear shows its reading
   * start. Instant: the strip has to arrive already showing the right tab.
   */
  #reveal(stop: Stop | undefined): void {
    const strip = this.#strip;
    const target = stop?.control;
    if (!strip || !target || !this.#hasScroll) return;
    const stripBox = strip.getBoundingClientRect();
    const stopBox = target.getBoundingClientRect();
    if (stripBox.width === 0) return;
    const inset = Number.parseFloat(getComputedStyle(strip).scrollPaddingLeft) || 0;
    const pastEnd = stopBox.right - (stripBox.right - inset);
    const pastStart = stopBox.left - (stripBox.left + inset);
    const rtl = getComputedStyle(strip).direction === 'rtl';
    const tooWide = stopBox.width > stripBox.width - 2 * inset;
    const delta = tooWide ? (rtl ? pastEnd : pastStart) : pastEnd > 0 ? pastEnd : pastStart < 0 ? pastStart : 0;
    if (delta !== 0) strip.scrollBy({left: delta, behavior: 'instant'});
  }

  #scrollByPage(direction: -1 | 1): void {
    const strip = this.#strip;
    if (!strip) return;
    const rtl = getComputedStyle(strip).direction === 'rtl' ? -1 : 1;
    strip.scrollBy({
      left: rtl * direction * strip.clientWidth * SCROLL_PAGE_RATIO,
      behavior: prefersReducedMotion() ? 'instant' : 'smooth',
    });
  }

  readonly #onScroll = (): void => {
    this.#measure();
  };

  readonly #onSlotChange = (): void => {
    void this.#settle();
  };

  /** The browser scrolls a focused element into view only when it is entirely outside: finish the job. */
  readonly #onFocusIn = (event: FocusEvent): void => {
    const target = event.composedPath()[0];
    const stop = this.#stops().find((candidate) => candidate === target || containsFlat(candidate, target as Node));
    if (stop) this.#reveal(stop);
  };

  readonly #preventFocus = (event: MouseEvent): void => {
    event.preventDefault();
  };

  #renderArrow(direction: 'start' | 'end'): TemplateResult {
    // Decorative and pointer-only: keyboard and assistive-technology users move with the arrow keys.
    return html`<button
      type="button"
      class="arrow"
      part="scroll-button"
      data-direction=${direction}
      aria-hidden="true"
      tabindex="-1"
      @mousedown=${this.#preventFocus}
      @click=${() => {
        this.#scrollByPage(direction === 'start' ? -1 : 1);
      }}
    >
      <tct-icon name=${direction === 'start' ? 'chevronLeft' : 'chevronRight'} size="sm" color="inherit"></tct-icon>
    </button>`;
  }

  override render(): TemplateResult {
    const tabs = this.#isTabs;
    const size = this.#size.value;
    const hasScroll = this.#hasScroll;
    const fade =
      hasScroll && this._overflowStart && this._overflowEnd
        ? 'both'
        : hasScroll && this._overflowStart
          ? 'start'
          : hasScroll && this._overflowEnd
            ? 'end'
            : undefined;
    // A tablist is not navigation: the landmark element is only right under the navigation pattern.
    const tag = tabs ? literal`div` : literal`nav`;
    const label = this.label || this.#locale.t('label', undefined, 'label');

    return staticHtml`<${tag}
      class="root"
      part="base"
      aria-label=${ifDefined(tabs ? undefined : label)}
      data-size=${size}
      data-layout=${TAB_LIST_LAYOUTS.includes(this.layout) ? this.layout : 'hug'}
      data-divider=${ifDefined(this.hasDivider ? '' : undefined)}
      data-edge=${ifDefined(this.#edgeCompensated ? 'inline' : undefined)}
    >
      <div
        class="strip"
        part="strip"
        data-scroll=${ifDefined(hasScroll ? '' : undefined)}
        data-fade=${ifDefined(fade)}
        @scroll=${this.#onScroll}
        @focusin=${this.#onFocusIn}
      >
        <slot @slotchange=${this.#onSlotChange}></slot>
      </div>
      ${hasScroll && this._overflowStart ? this.#renderArrow('start') : nothing}
      ${hasScroll && this._overflowEnd ? this.#renderArrow('end') : nothing}
      ${this.#hint.render()}
    </${tag}>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-tab-list': TctTabList;
  }
}
