import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {AriaDelegateController} from '@tecton-wc/core/controllers/aria-delegate.js';
import {observeResize} from '@tecton-wc/core/controllers/resize.js';
import {RovingTabindexController} from '@tecton-wc/core/controllers/roving-tabindex.js';
import {
  TctActiveChangeEvent,
  type ActiveChangeReason,
} from '@tecton-wc/core/events/tct-active-change.js';
import {TctNavigateEndEvent} from '@tecton-wc/core/events/tct-navigate-end.js';
import {TctNavigateStartEvent} from '@tecton-wc/core/events/tct-navigate-start.js';
import {prefersReducedMotion} from '@tecton-wc/core/features.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {containsFlat, deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import defaultMessages from '@tecton-wc/locales/en/outline.js';
import base from '../styles/base.styles.css';
import {watchOutlineItems} from './outline.api.js';
import {
  getScrollableAncestor,
  resolveActiveId,
  scrollToTarget,
  SCROLL_KEYS,
  SCROLL_SETTLE_TIMEOUT_MS,
} from './outline.scroll.js';
import {OUTLINE_DENSITIES, type OutlineDensity, type OutlineItem} from './outline.types.js';
import styles from './tct-outline.styles.css';

/** Levels 2 to 5 indent by one step each; level 1 and 2 share the first, deeper levels share the fourth. */
const indentStep = (level: number): number => Math.max(1, Math.min(4, level - 1 || 1));

/**
 * A table of contents for a document: a labelled `<nav>` of anchor links to the page's headings, indented by
 * heading level, with a sliding track indicator on the active one.
 *
 * Give it `items` (`{id, label, level}`, `id` matching the heading's `id`), or `source` (a selector of a
 * container) to read the `h1`..`h6` inside it and follow their changes. Unless `active-id` is set, it
 * tracks scrolling and marks the last heading whose top has passed its activation line: the line where
 * navigating to that heading lands it (the scroll root's top, plus `offset` for a fixed header, plus the
 * heading's `scroll-margin-top`). So the right section is active on load, while scrolling up, and for a
 * short last section: the first item at the top, the last at the bottom. The active link carries
 * `aria-current="location"`. With `active-id` set the outline only reports, and you own the state.
 *
 * The list is one Tab stop, seated on the active heading: arrows move focus, Home and End jump, Enter and
 * Space activate (a modified click is left to the browser). Activating pushes the hash, smooth-scrolls
 * (instantly under reduced motion) and fires `tct-navigate-start` then, once the scroll settles or the user
 * takes over, `tct-navigate-end`.
 *
 * @summary A table of contents that highlights the section you are reading and scrolls to a heading.
 * @tag tct-outline
 * @upstream Outline
 * @csspart base - The `<nav>` landmark (upstream theming target `outline`).
 * @csspart list - The list of items.
 * @csspart item - An item's link (upstream theming target `outline-item`).
 * @csspart indicator - The sliding bar on the active item (upstream theming target `outline-indicator`).
 * @fires {TctActiveChangeEvent} tct-active-change - After the active item changed because the page scrolled or the user chose one.
 * @fires {TctNavigateStartEvent} tct-navigate-start - When navigation to an item begins, before the scroll.
 * @fires {TctNavigateEndEvent} tct-navigate-end - Once per navigation, when the scroll settles or the user interrupts it.
 * @cssstate active - An item is active.
 * @cloakDisplay block
 */
export class TctOutline extends TctElement {
  static override readonly tagName = 'tct-outline';
  static override styles: CSSResultGroup = [base, styles];

  /** The entries: `{id, label, level}`. `id` is the target heading's `id`. Ignored while `source` is set. */
  @property({attribute: false}) items: OutlineItem[] = [];

  /**
   * A selector (resolved in the outline's own tree, then the document) of a container whose `h1`..`h6`
   * with an `id` become the items; the outline follows changes to them.
   */
  @property() source: string | undefined;

  /**
   * The id of the active item. When set, built-in scroll tracking is off and you own the state (listen to
   * `tct-active-change`); unset (default) it follows the scroll position.
   */
  @property({attribute: 'active-id'}) activeId: string | undefined;

  /** Accessible name of the landmark. Default: the localized "Table of contents". A host `aria-label` wins. */
  @property() label = '';

  /** `default` or `compact` (reduced item padding for dense UIs). */
  @property({reflect: true}) density: OutlineDensity = 'default';

  /**
   * Height in px of a fixed header overlaying the top of the scroll root. It shifts the activation line and
   * the scroll landing by the same amount, on top of each heading's own `scroll-margin-top`.
   */
  @property({type: Number}) offset = 0;

  /**
   * The scroll container to track, instead of the nearest scrollable ancestor: a split pane, a modal, a
   * dashboard panel. An element (property) or a selector (attribute `scroll-container`).
   */
  @property({attribute: false}) scrollContainer: HTMLElement | null = null;

  /** Selector form of `scrollContainer`, resolved in the outline's own tree, then the document. */
  @property({attribute: 'scroll-container'}) scrollContainerSelector: string | undefined;

  /**
   * Activating an item does not scroll: you own the scrolling (virtualised content, a router). The active
   * item, the hash and the navigate events still happen, and the anchor's default jump is suppressed.
   */
  @property({type: Boolean, attribute: 'no-scroll-on-click'}) noScrollOnClick = false;

  @state() private _active: string | undefined;
  @state() private _derived: OutlineItem[] = [];

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'outline',
    defaults: defaultMessages,
  });
  #frame = 0;
  #suppress = false;
  #navigation: {supersede: () => void; teardown: () => void} | null = null;
  #stopSpy: (() => void) | undefined;
  #spyKey = '';
  #stopSource: (() => void) | undefined;
  #sourceKey: string | undefined;

  readonly #roving: RovingTabindexController<HTMLAnchorElement> =
    new RovingTabindexController<HTMLAnchorElement>(this, {
      items: () => this.#links(),
      orientation: 'vertical',
      wrap: true,
      homeEnd: true,
    });

  constructor() {
    super();
    new AriaDelegateController(this, {target: () => this.renderRoot.querySelector('nav')});
  }

  /** The item that is active right now (built-in tracking, or `active-id`). */
  get currentId(): string | undefined {
    return this.activeId !== undefined ? this.activeId : this._active;
  }

  #effectiveItems(): OutlineItem[] {
    return this.source ? this._derived : this.items;
  }

  #links(): HTMLAnchorElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLAnchorElement>('a.link')];
  }

  /** Finds a heading by id in the outline's own tree, then the document. */
  #lookup = (id: string): HTMLElement | null => {
    const root = this.getRootNode();
    const scoped =
      root instanceof Document || root instanceof ShadowRoot ? root.getElementById(id) : null;
    return scoped ?? document.getElementById(id);
  };

  #resolveIn(selector: string): HTMLElement | null {
    const root = this.getRootNode();
    const scoped =
      root instanceof Document || root instanceof ShadowRoot
        ? root.querySelector<HTMLElement>(selector)
        : null;
    return scoped ?? document.querySelector<HTMLElement>(selector);
  }

  /** The scroll root: the explicit container, else the nearest scrollable ancestor, else the viewport (`null`). */
  #scrollRoot(): HTMLElement | null {
    if (this.scrollContainer) return this.scrollContainer;
    if (this.scrollContainerSelector) {
      const found = this.#resolveIn(this.scrollContainerSelector);
      if (found) return found;
    }
    return getScrollableAncestor(this);
  }

  // ---------------------------------------------------------------------------- lifecycle

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      this.#watchSource();
      this.#startSpy();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopSpy?.();
    this.#stopSpy = undefined;
    this.#spyKey = '';
    this.#stopSource?.();
    this.#stopSource = undefined;
    this.#sourceKey = undefined;
    // A navigation in flight is dropped without its end event: the element is gone.
    this.#navigation?.teardown();
    if (this.#frame) cancelAnimationFrame(this.#frame);
    this.#frame = 0;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // The first item is active until the scroll position says otherwise (no event: it is the initial state).
    const first = this.#effectiveItems()[0];
    if (this._active === undefined && first) this._active = first.id;
    if (changed.has('density') && !OUTLINE_DENSITIES.includes(this.density)) {
      devWarn(
        `outline:density:${this.density}`,
        `<tct-outline density="${this.density}"> is not one of ${OUTLINE_DENSITIES.join(', ')}; using "default".`,
      );
    }
  }

  protected override firstUpdated(): void {
    this.#watchSource();
  }

  protected override updated(changed: PropertyValues<this>): void {
    if (changed.has('source')) this.#watchSource();
    this.#startSpy();
    this.toggleState('active', this.currentId !== undefined);
    void this.#settle();
  }

  /** Follows the headings of `source` while it is set. */
  #watchSource(): void {
    const key = this.source;
    if (key === this.#sourceKey && this.#stopSource) return;
    this.#stopSource?.();
    this.#stopSource = undefined;
    this.#sourceKey = key;
    if (!key) {
      this._derived = [];
      return;
    }
    const container = this.#resolveIn(key);
    if (!container) {
      devWarn(`outline:source:${key}`, `<tct-outline source="${key}"> matched no element.`);
      this._derived = [];
      return;
    }
    this.#stopSource = watchOutlineItems(container, (items) => {
      const same =
        items.length === this._derived.length &&
        items.every((item, index) => {
          const other = this._derived[index]!;
          return item.id === other.id && item.label === other.label && item.level === other.level;
        });
      if (!same) this._derived = items;
    });
  }

  // ------------------------------------------------------------------------- scroll spy

  /** (Re)binds the scroll listeners when what they depend on changed. */
  #startSpy(): void {
    const controlled = this.activeId !== undefined;
    const ids = this.#effectiveItems()
      .map((item) => item.id)
      .join('\n');
    const root = controlled ? null : this.#scrollRoot();
    const key = `${controlled}|${ids}|${this.offset}|${this.scrollContainerSelector ?? ''}`;
    // A scroll root that changed identity (a container that scrolls later) is found again next update.
    if (key === this.#spyKey && this.#stopSpy) return;
    this.#stopSpy?.();
    this.#stopSpy = undefined;
    this.#spyKey = key;
    if (controlled) return;

    const scroller: HTMLElement | Window = root ?? window;
    const onScroll = (): void => {
      if (this.#frame === 0) {
        this.#frame = requestAnimationFrame(() => {
          this.#frame = 0;
          this.#syncFromScroll();
        });
      }
    };
    scroller.addEventListener('scroll', onScroll, {passive: true});
    window.addEventListener('resize', onScroll, {passive: true});
    // Content that grows after load (images, fonts, lazy sections) moves the headings without a scroll.
    const stopResize = observeResize(root ?? document.documentElement, onScroll);
    void document.fonts?.ready.then(onScroll);
    window.addEventListener('load', onScroll);
    this.#stopSpy = () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('load', onScroll);
      stopResize();
    };
    this.#syncFromScroll();
  }

  /** Reads live heading positions and adopts the resolved item (unless a navigation owns the indicator). */
  #syncFromScroll(): void {
    if (this.#suppress || this.activeId !== undefined || !this.isConnected) return;
    const next = resolveActiveId(
      this.#effectiveItems(),
      this.#lookup,
      this.#scrollRoot(),
      this.offset,
    );
    if (next !== undefined && next !== this._active) {
      this._active = next;
      this.dispatch(new TctActiveChangeEvent(next, 'scroll'));
    }
  }

  /**
   * Navigates to an item: the single path shared by click and keyboard activation. Fires
   * `tct-navigate-start`, scrolls (unless `no-scroll-on-click`) and fires `tct-navigate-end` exactly once
   * when the scroll settles or the user interrupts it. While uncontrolled the indicator does not chase the
   * scroll through intervening sections: it lands on the target once the scroll settles, or resumes
   * position tracking if the user scrolls away mid-flight. Returns `false`, doing nothing, when no
   * element has that id.
   */
  navigateTo(id: string, reason: ActiveChangeReason = 'click'): boolean {
    const target = this.#lookup(id);
    if (!target) return false;
    // A second navigation replaces the first: end the old one without resuming tracking.
    this.#navigation?.supersede();
    this.dispatch(new TctNavigateStartEvent(id));
    const controlled = this.activeId !== undefined;
    if (controlled) this.dispatch(new TctActiveChangeEvent(id, reason));
    else this.#suppress = true;

    const root = this.#scrollRoot();
    const scroller: HTMLElement | Window = root ?? window;
    let timer = 0;
    let settled = false;

    const cleanup = (): void => {
      scroller.removeEventListener('scrollend', onSettle);
      scroller.removeEventListener('wheel', onManual);
      scroller.removeEventListener('touchmove', onManual);
      window.removeEventListener('keydown', onKey);
      if (timer !== 0) window.clearTimeout(timer);
      timer = 0;
      this.#navigation = null;
    };

    // Exactly once: `arrived` is false when the user took over. `tct-navigate-end` fires either way, so
    // every start is balanced and a consumer's "navigating" state cannot leak.
    const finish = (arrived: boolean, resume = true): void => {
      if (settled) return;
      settled = true;
      cleanup();
      if (!controlled) {
        this.#suppress = false;
        if (arrived) {
          if (this._active !== id) {
            this._active = id;
            this.dispatch(new TctActiveChangeEvent(id, reason));
          }
        } else if (resume) this.#syncFromScroll();
      }
      this.dispatch(new TctNavigateEndEvent(id));
    };

    const onSettle = (): void => finish(true);
    const onManual = (): void => finish(false);
    const onKey = (event: KeyboardEvent): void => {
      // A key the outline consumed (arrow roving, Space activation) is prevented, so the browser will not
      // scroll: it is not a manual scroll intent and must not cancel the navigation it started.
      if (!event.defaultPrevented && SCROLL_KEYS.has(event.key)) finish(false);
    };

    if (!this.noScrollOnClick) {
      // Armed BEFORE scrolling so an instant jump (a target already in position, reduced motion) cannot
      // land before anyone listens.
      scroller.addEventListener('scrollend', onSettle, {once: true});
      scroller.addEventListener('wheel', onManual, {passive: true});
      scroller.addEventListener('touchmove', onManual, {passive: true});
      window.addEventListener('keydown', onKey);
      timer = window.setTimeout(onSettle, SCROLL_SETTLE_TIMEOUT_MS);
      this.#navigation = {supersede: () => finish(false, false), teardown: cleanup};
      scrollToTarget(target, root, scroller, this.offset, !prefersReducedMotion());
    } else {
      // The consumer owns scrolling: there is nothing to wait for.
      finish(true);
    }
    return true;
  }

  // ------------------------------------------------------------------------------ handlers

  #hasModifier(event: MouseEvent | KeyboardEvent): boolean {
    return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
  }

  readonly #onClick = (event: MouseEvent, id: string): void => {
    if (event.defaultPrevented || this.#hasModifier(event)) return;
    // A missing target is left to the browser (it may resolve after a router settles).
    if (!this.#lookup(id)) return;
    event.preventDefault();
    if (this.navigateTo(id, event.detail === 0 ? 'keyboard' : 'click')) {
      history.pushState(null, '', `#${id}`);
    }
  };

  readonly #onKeyDown = (event: KeyboardEvent, id: string): void => {
    // Enter activates the anchor natively; Space does not.
    if ((event.key !== ' ' && event.key !== 'Spacebar') || event.defaultPrevented) return;
    if (this.#hasModifier(event)) return;
    event.preventDefault();
    if (this.navigateTo(id, 'keyboard')) history.pushState(null, '', `#${id}`);
  };

  /** Seats the tab stop on the active heading, unless the user is arrowing through the list. */
  async #settle(): Promise<void> {
    await this.updateComplete;
    if (!this.isConnected) return;
    const links = this.#links();
    const active = links.find((link) => link.getAttribute('aria-current') === 'location');
    if (active && !containsFlat(this, deepActiveElement())) {
      this.#roving.setActive(active);
    } else this.#roving.update();
    this.#syncIndicator();
  }

  /** Moves the bar to the active link: measured, so it works without CSS anchor positioning. */
  #syncIndicator(): void {
    const indicator = this.renderRoot.querySelector<HTMLElement>('.indicator');
    const active = this.#links().find((link) => link.getAttribute('aria-current') === 'location');
    if (!indicator) return;
    if (!active) {
      indicator.style.setProperty('--_indicator-height', '0px');
      return;
    }
    indicator.style.setProperty('--_indicator-top', `${active.offsetTop}px`);
    indicator.style.setProperty('--_indicator-height', `${active.offsetHeight}px`);
  }

  // -------------------------------------------------------------------------------- render

  override render(): TemplateResult {
    const items = this.#effectiveItems();
    const current = this.currentId;
    const density = OUTLINE_DENSITIES.includes(this.density) ? this.density : 'default';
    return html`<nav
      class="root"
      part="base"
      aria-label=${this.label || this.#locale.t('label', undefined, 'label')}
      data-density=${density}
    >
      <ul class="list" part="list" role="list">
        ${items.map((item) => {
          const active = item.id === current;
          return html`<li class="item" role="listitem">
            <a
              class="link"
              part="item"
              href=${`#${item.id}`}
              aria-current=${ifDefined(active ? 'location' : undefined)}
              data-level=${indentStep(item.level)}
              ?data-active=${active}
              @click=${(event: MouseEvent) => {
                this.#onClick(event, item.id);
              }}
              @keydown=${(event: KeyboardEvent) => {
                this.#onKeyDown(event, item.id);
              }}
              ><span class="label">${item.label}</span></a
            >
          </li>`;
        })}
      </ul>
      <div class="track" aria-hidden="true"><span class="rule"></span></div>
      <span class="indicator" part="indicator" aria-hidden="true"></span>
    </nav>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-outline': TctOutline;
  }
}
