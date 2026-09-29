import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {styleMap} from 'lit/directives/style-map.js';
import {ContextConsumer, ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {TctAfterOpenChangeEvent} from '@tecton-astryx/core/events/tct-after-open-change.js';
import {TctOpenChangeEvent} from '@tecton-astryx/core/events/tct-open-change.js';
import type {ChangeReason} from '@tecton-astryx/core/events/tct-event.js';
import {TctSnapChangeEvent} from '@tecton-astryx/core/events/tct-snap-change.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import {
  LayerController,
  type EscapeBehavior,
  type LayerOptions,
} from '@tecton-astryx/core/layer/layer-controller.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {deepActiveElement, getTabbables} from '@tecton-astryx/core/utils/focus.js';
import defaultMessages from '@tecton-astryx/locales/en/resizable.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import motion from '../styles/motion.styles.css';
import {
  BOTTOM_SHEET_PURPOSES,
  heightBudget,
  isNamedHeight,
  parseSnapPoints,
  warnIgnoredSnapPoints,
  type BottomSheetPurpose,
} from './bottom-sheet.types.js';
import {SheetGestureController, whenTransitionSettled, type SheetMoveSource} from './sheet-gestures.js';
import {SheetKeyboardController} from './sheet-keyboard.js';
import {
  sheetSwitcherContext,
  type SheetMotion,
  type SheetPhase,
  type SheetSwitcherApi,
  type SwitcherSheet,
} from './sheet-switcher.context.js';
import {resolveSnapPoints, type BottomSheetSnapPoint} from './snap-offsets.js';
import dialogStyles from './sheet-dialog.styles.css';
import styles from './tct-bottom-sheet.styles.css';

/**
 * A mobile touch sheet that rises from the bottom edge: a grab handle, optional drag-to-resize snap
 * points, animated entrance and exit, and purpose-controlled dismissal. Standalone, it owns a native
 * `<dialog>` (modal with a scrim by default, non-modal with `no-scrim`). Inside a
 * `tct-bottom-sheet-switcher`, given a `sheet-id`, it is one panel of the switcher's shared dialog.
 *
 * **Resizing.** A sheet with snap points has a resizable handle (`role="slider"`): drag it, or use the
 * single-pointer and keyboard alternatives (WCAG 2.5.7): a tap on the handle moves to the next taller
 * stop (from the tallest back to the shortest), Arrow Up / Arrow Down / Page Up / Page Down step one
 * stop, End is the tallest and Home the shortest. A sheet without snap points has a decorative handle
 * that only drags it closed; Escape, the scrim and any close control of yours are the other ways.
 *
 * **Dismissal (`purpose`).** `info` allows Escape, a press on the scrim and swipe-to-dismiss; `form`
 * only Escape (it protects entered data); `required` none of them (and is an `alertdialog`).
 * Explicit controls of yours may still close it by setting `open` to false.
 *
 * @summary A mobile bottom sheet with a grab handle, snap points, mobile-keyboard handling and purpose-gated dismissal.
 * @tag tct-bottom-sheet
 * @upstream BottomSheet
 * @slot - The sheet content, in a scrolling area below the grab handle.
 * @csspart sheet - The painted panel (Astryx target `astryx-bottom-sheet`).
 * @csspart handle - The grab handle: a slider when the sheet has snap points.
 * @csspart body - The scrolling area.
 * @csspart dialog - The native dialog shell of a standalone sheet.
 * @cssstate open - The sheet is open.
 * @fires {TctOpenChangeEvent} tct-open-change - Before Escape, a scrim press, a swipe or `requestClose()` closes it; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After an open or close settled (entry done, or hidden).
 * @fires {TctSnapChangeEvent} tct-snap-change - After the user moved it to another stop (drag, tap or keys).
 * @cloakDisplay contents
 */
export class TctBottomSheet extends TctElement implements SwitcherSheet {
  static override readonly tagName = 'tct-bottom-sheet';
  static override styles: CSSResultGroup = [base, focusRing, motion, dialogStyles, styles];

  /** Whether a standalone sheet is open. Property and attribute writes never emit events. Ignored inside a switcher. */
  @property({type: Boolean, reflect: true}) open = false;
  /** Accessible label of the sheet. Required: the sheet has no built-in heading to derive a name from. */
  @property() label = '';
  /**
   * How tall the sheet opens. `hug` fits the content up to 92% of the viewport, `capped` (default) is a
   * scrolling mid-height panel (62%), `tall` a pinned near-full panel (92%) for forms and streaming
   * content; a bare number is px, anything else a CSS length. Only a fully expanded `tall` sheet is
   * keyboard-aware.
   */
  @property() height: string | number = 'capped';
  /**
   * Extra heights the sheet can rest at when dragged; its own height is always the tallest stop. Each is
   * the sheet's visible height: a number is a viewport fraction (`0.5` is half the screen), `'50%'` the
   * same in CSS, `'320px'` an absolute length. A stop of a quarter of the sheet or less is a peek: it
   * thins the scrim. The attribute `snap-points` takes the same values separated by spaces or commas.
   */
  @property({
    attribute: 'snap-points',
    converter: {fromAttribute: (value: string | null) => parseSnapPoints(value)},
  })
  snapPoints: ReadonlyArray<BottomSheetSnapPoint> = [];
  /** Implicit dismissal, as for `tct-dialog`: `info` (default), `form` or `required`. */
  @property({reflect: true}) purpose: BottomSheetPurpose = 'info';
  /** A standalone sheet without the scrim: non-modal, and the page behind stays interactive and scrollable. */
  @property({type: Boolean, attribute: 'no-scrim'}) noScrim = false;
  /** Id of the element that gets focus after a standalone sheet closes (default: what had it before). */
  @property({attribute: 'final-focus'}) finalFocus: string | undefined;
  /** The element that gets focus after a standalone sheet closes. Wins over `final-focus`. */
  @property({attribute: false}) finalFocusElement: HTMLElement | null = null;
  /** Unique id of this sheet inside a `tct-bottom-sheet-switcher`; the switcher opens it when `active-sheet` matches. */
  @property({attribute: 'sheet-id', reflect: true}) sheetId: string | undefined;
  /** Accessible name of the resize handle. Default: the localized "Resize handle". */
  @property({attribute: 'handle-label'}) handleLabel: string | undefined;

  /** Where the sheet is in a switcher flow. Set by the switcher; not for application use. @internal */
  @property({attribute: false}) phase: SheetPhase = 'hidden';
  /** Distance a retained sheet moves down to meet the entering sheet's top edge. Set by the switcher. @internal */
  @property({attribute: false}) alignmentOffset = 0;

  /** Opens the sheet without an intent event; resolves once the entry animation settled. */
  async show(): Promise<void> {
    this.open = true;
    await this.updateComplete;
    await this.#settled;
  }

  /** Closes the sheet without an intent event; resolves once it is hidden. */
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
    if (this.#switcher) {
      this.#switcher.requestDismiss(this, reason);
      return;
    }
    if (!this.open) return;
    this.#request(false, reason);
  }

  /** Moves to the stop at `index` (0 is the tallest; clamped) without an event. */
  snapTo(index: number): void {
    this.#gestures.snapToIndex(index, 'programmatic');
  }

  /** Index of the resting stop; 0 is the tallest. */
  get snapIndex(): number {
    return this.#gestures.index;
  }

  /** Number of stops the sheet can rest at (1 without snap points). */
  get snapCount(): number {
    return this.#gestures.count;
  }

  /** Visible height of the sheet at its resting stop, in px. */
  get visibleHeight(): number {
    return this.#gestures.visibleHeight;
  }

  /** Top edge of the sheet's positioner, where it rests when fully open. @internal */
  get restTop(): number {
    return this.#positioner?.getBoundingClientRect().top ?? 0;
  }

  /** Top edge of the sheet as drawn now. @internal */
  get drawnTop(): number {
    return this.#sheet?.getBoundingClientRect().top ?? 0;
  }

  // -------------------------------------------------------------------------------- internals

  readonly #locale = new LocaleController(this, {
    namespace: 'resizable',
    defaults: defaultMessages,
  });
  readonly #switcherContext = new ContextConsumer(this, {
    context: sheetSwitcherContext,
    subscribe: true,
  });
  #settled: Promise<void> = Promise.resolve();
  #exiting = false;
  #previousFocus: Element | null = null;
  #reportedIndex = 0;
  #bodyFrame = 0;
  #cancelMotion: (() => void) | undefined;
  #bodyObserver: ResizeObserver | undefined;
  #bodyObserved: HTMLElement | null = null;
  #announcedMissingLabel = false;
  #registeredWith: SheetSwitcherApi | null = null;
  #unregister: (() => void) | undefined;

  readonly #gestures: SheetGestureController = new SheetGestureController(this, {
    sheet: () => this.#sheet,
    body: () => this.#body,
    snapHeights: () => resolveSnapPoints(this.snapPoints, window.innerHeight),
    canDismiss: () => this.#purpose === 'info',
    onDismiss: () => this.#requestSwipeClose(),
    onSnap: ({index, visibleHeight, source}) => {
      this.#onSnap(index, visibleHeight, source);
    },
    onScrim: (opacity) => {
      this.#setScrim(opacity);
    },
    onTravel: () => {
      this.#keyboard.blurForTravel();
    },
  });

  readonly #keyboard: SheetKeyboardController = new SheetKeyboardController(this, {
    sheet: () => this.#sheet,
    body: () => this.#body,
    enabled: () =>
      this.#isPresented &&
      this.height === 'tall' &&
      this.#gestures.index === 0 &&
      !this.#gestures.isDragging,
  });

  // Mutable on purpose: the layer kind follows `no-scrim`, chosen when the sheet opens.
  readonly #layerOptions: LayerOptions = {
    kind: 'modal',
    surface: () => this.#dialog,
    escape: (): EscapeBehavior => (this.#purpose === 'required' ? 'block' : 'close'),
    outsidePress: () => this.#purpose === 'info' && !this.noScrim,
    initialFocus: () => this.#initialFocusTarget(),
    returnFocus: () => this.#finalFocusTarget(),
    exitAnimation: () => this.#exitAnimation(),
    onDismissRequest: (reason) => {
      this.#request(false, reason);
    },
    // The dialog closed without us (`form method="dialog"` inside the content, a browser close request).
    onNativeClose: () => {
      this.open = false;
    },
    onHidden: () => {
      this.#exiting = false;
      this.#gestures.deactivate();
      this.requestUpdate();
    },
  };

  readonly #layer: LayerController = new LayerController(this, this.#layerOptions);

  constructor() {
    super();
    // A sheet nested in this sheet's content is standalone unless it sits in a switcher of its own.
    new ContextProvider(this, {context: sheetSwitcherContext, initialValue: null});
    // A press on the handle that never moved is the single-pointer way to resize (WCAG 2.5.7).
    this.#gestures.onTap = () => {
      this.#gestures.cycle('pointer');
    };
  }

  get #switcher() {
    return this.#switcherContext.value ?? null;
  }

  get #purpose(): BottomSheetPurpose {
    return BOTTOM_SHEET_PURPOSES.includes(this.purpose) ? this.purpose : 'info';
  }

  get #dialog(): HTMLDialogElement | null {
    return this.renderRoot.querySelector<HTMLDialogElement>('.dialog');
  }

  get #positioner(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.positioner');
  }

  get #sheet(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.sheet');
  }

  get #body(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.body');
  }

  /** Whether the sheet is on screen and interactive (open standalone, or the active switcher sheet). */
  get #isPresented(): boolean {
    return this.#switcher
      ? this.phase === 'active' || this.phase === 'entering'
      : this.#layer.isOpen && !this.#exiting;
  }

  #setScrim(opacity: number): void {
    const switcher = this.#switcher;
    if (switcher) {
      switcher.scrim(this, opacity);
      return;
    }
    this.#dialog?.style.setProperty('--_sheet-scrim-opacity', String(opacity));
  }

  #request(open: boolean, reason: ChangeReason): boolean {
    if (this.#switcher) return this.#switcher.requestDismiss(this, reason);
    if (open === this.open) return true;
    const accepted = this.dispatch(new TctOpenChangeEvent(open, reason));
    if (accepted) this.open = open;
    return accepted;
  }

  /** A swipe wants to close the sheet; `true` when the request was accepted. */
  #requestSwipeClose(): boolean {
    if (this.#switcher) return this.#switcher.requestDismiss(this, 'pointer');
    return this.#request(false, 'pointer');
  }

  #onSnap(index: number, visibleHeight: number, source: SheetMoveSource): void {
    const changed = index !== this.#reportedIndex;
    this.#reportedIndex = index;
    if (source === 'programmatic' || !changed) return;
    this.dispatch(new TctSnapChangeEvent(index, visibleHeight, source));
  }

  // ------------------------------------------------------------------------------------ focus

  #initialFocusTarget(): HTMLElement | null {
    const autofocus = this.querySelector<HTMLElement>('[data-autofocus]');
    if (autofocus) return autofocus;
    if (this.#layerOptions.kind === 'modal') return this.#sheet;
    // A non-modal sheet takes focus only for an explicit target: undo the dialog focusing steps,
    // which would land on the resize handle.
    const previous = this.#previousFocus;
    const active = deepActiveElement();
    if (active && this.#sheet?.contains(active)) {
      if (previous instanceof HTMLElement && previous.isConnected) return previous;
      (active as HTMLElement).blur();
    }
    return null;
  }

  #finalFocusTarget(): HTMLElement | null {
    if (this.finalFocusElement?.isConnected) return this.finalFocusElement;
    if (!this.finalFocus) return null;
    const root = this.getRootNode() as Document | ShadowRoot;
    return root.getElementById?.(this.finalFocus) ?? null;
  }

  // -------------------------------------------------------------------------------- lifecycle

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unregister?.();
    this.#unregister = undefined;
    this.#registeredWith = null;
    cancelAnimationFrame(this.#bodyFrame);
    this.#bodyFrame = 0;
    this.#bodyObserver?.disconnect();
    this.#bodyObserver = undefined;
    this.#bodyObserved = null;
    this.#cancelMotion?.();
    this.#cancelMotion = undefined;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('snapPoints')) warnIgnoredSnapPoints(this.snapPoints);
    if (changed.has('purpose') && !BOTTOM_SHEET_PURPOSES.includes(this.purpose)) {
      devWarn('tct-bottom-sheet:purpose', `Invalid purpose "${this.purpose}"; use required, form or info.`);
    }
  }

  /** Joins (or leaves) the switcher that provides context; re-joins when the `sheet-id` changes. */
  #syncRegistration(changed: PropertyValues<this>): void {
    const switcher = this.#switcher;
    if (switcher === this.#registeredWith && !changed.has('sheetId')) return;
    this.#unregister?.();
    this.#unregister = switcher?.register(this);
    this.#registeredWith = switcher;
  }

  protected override updated(changed: PropertyValues<this>): void {
    this.#syncRegistration(changed);
    this.#observeBody();
    this.#gestures.attachBody(this.#body);
    this.#syncBodyAccess();
    if (changed.has('snapPoints') && this.#isPresented) this.#gestures.reanchor();
    if (changed.has('sheetId') || this.#switcher) this.#warnMisuse();
    if (this.#switcher) {
      if (changed.has('phase') || changed.has('alignmentOffset')) {
        this.#syncPhase(changed.get('phase') as SheetPhase | undefined);
      }
    } else if (changed.has('open')) {
      this.#syncOpen(changed.get('open') as boolean | undefined);
    }
  }

  #warnMisuse(): void {
    if (this.#switcher) {
      if (!this.sheetId) {
        devWarn(
          'tct-bottom-sheet:sheet-id',
          'A tct-bottom-sheet inside a tct-bottom-sheet-switcher needs a non-empty `sheet-id`.',
        );
      }
      if (this.open) {
        devWarn(
          'tct-bottom-sheet:open-in-switcher',
          '`open` is ignored on a sheet inside a tct-bottom-sheet-switcher; set `active-sheet` on the switcher.',
        );
      }
    } else if (this.sheetId) {
      devWarn(
        'tct-bottom-sheet:sheet-id-standalone',
        '`sheet-id` only works inside a tct-bottom-sheet-switcher. Use `open` for a standalone sheet.',
      );
    }
  }

  // ------------------------------------------------------------------- standalone open / close

  #syncOpen(previous: boolean | undefined): void {
    this.toggleState('open', this.open);
    // The first update of a closed sheet is not a change.
    if (previous === undefined && !this.open) return;
    if (this.open) {
      if (!this.label && !this.#announcedMissingLabel) {
        this.#announcedMissingLabel = true;
        devWarn(
          'tct-bottom-sheet:label',
          'tct-bottom-sheet requires a non-empty `label` for an accessible name; the open sheet has no built-in heading to derive one from.',
        );
      }
      this.#exiting = false;
      this.#layerOptions.kind = this.noScrim ? 'dialog' : 'modal';
      this.#previousFocus = deepActiveElement();
      this.#gestures.reset();
      this.#reportedIndex = 0;
      this.#dialog?.style.setProperty('--_sheet-scrim-opacity', '1');
    }
    const settled = this.open ? this.#layer.show() : this.#layer.hide();
    if (this.open) {
      this.#gestures.activate();
      this.requestUpdate();
    }
    this.#settled = settled.then(() => {
      if (this.open === this.#layer.isOpen) this.dispatch(new TctAfterOpenChangeEvent(this.open));
    });
  }

  /** The exit: the sheet slides away (CSS transition on `translate`) while the scrim fades. */
  #exitAnimation(): Animation[] {
    const sheet = this.#sheet;
    this.#exiting = true;
    this.#setScrim(0);
    this.requestUpdate();
    if (!sheet) return [];
    sheet.setAttribute('data-phase', 'exiting');
    // Flush the style so the transitions exist before they are collected.
    void getComputedStyle(sheet).translate;
    return sheet.getAnimations();
  }

  // ------------------------------------------------------------------- switcher participation

  #syncPhase(previous: SheetPhase | undefined): void {
    const phase = this.phase;
    const interactive = phase === 'entering' || phase === 'active';
    const wasInteractive = previous === 'entering' || previous === 'active';
    const switcher = this.#switcher;
    if (!switcher) return;
    if (interactive && !wasInteractive) {
      const reactivated = previous === 'covered' || previous === 'aligning' || previous === 'fading';
      if (!reactivated) this.#gestures.reset();
      this.#reportedIndex = this.#gestures.index;
      this.#gestures.activate();
      this.#focusPanel();
    } else if (!interactive && wasInteractive) {
      this.#gestures.deactivate();
    }
    if (phase === 'hidden') this.#gestures.reset();

    this.#cancelMotion?.();
    this.#cancelMotion = undefined;
    const motionOf: Partial<Record<SheetPhase, SheetMotion>> = {
      entering: 'entering',
      aligning: 'aligning',
      fading: 'fading',
      exiting: 'exiting',
    };
    const motion = motionOf[phase];
    if (!motion || previous === phase) return;
    switcher.motionStart(this, motion);
    if (motion === 'entering' && (previous === 'covered' || previous === 'aligning' || previous === 'fading')) {
      // Already on screen under the sheet that just left: there is nothing to slide in.
      queueMicrotask(() => {
        if (this.phase === 'entering') switcher.motionComplete(this, 'entering');
      });
      return;
    }
    const sheet = this.#sheet;
    if (!sheet) {
      switcher.motionComplete(this, motion);
      return;
    }
    this.#cancelMotion = whenTransitionSettled(
      sheet,
      motion === 'fading' ? 'opacity' : 'translate',
      () => {
        this.#cancelMotion = undefined;
        switcher.motionComplete(this, motion);
      },
    );
  }

  #focusPanel(): void {
    const active = deepActiveElement();
    if (active && this.contains(active)) return;
    const autofocus = this.querySelector<HTMLElement>('[data-autofocus]');
    if (autofocus) {
      autofocus.focus({preventScroll: true});
    } else if (this.#switcher?.hasScrim) {
      this.#sheet?.focus({preventScroll: true});
    }
  }

  // ---------------------------------------------------------------------------- scrolling body

  #observeBody(): void {
    const body = this.#body;
    if (!body || body === this.#bodyObserved || typeof ResizeObserver === 'undefined') return;
    this.#bodyObserver?.disconnect();
    this.#bodyObserved = body;
    this.#bodyObserver = new ResizeObserver(() => {
      this.#scheduleBodyAccess();
    });
    this.#bodyObserver.observe(body);
    const content = body.querySelector('.content');
    if (content) this.#bodyObserver.observe(content);
  }

  #scheduleBodyAccess(): void {
    if (this.#bodyFrame) return;
    this.#bodyFrame = requestAnimationFrame(() => {
      this.#bodyFrame = 0;
      this.#syncBodyAccess();
    });
  }

  /**
   * A body that scrolls and has nothing focusable to carry keyboard users into it is itself a tab stop
   * (WCAG 2.1.1), named after the sheet. Fitting content adds no stop. (The shared scroll-area
   * controller of WP-8 replaces this when it lands.)
   */
  #syncBodyAccess(): void {
    const body = this.#body;
    if (!body) return;
    const overflowing =
      body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1;
    const needsStop = overflowing && getTabbables(body).length === 0;
    if (needsStop) {
      body.setAttribute('tabindex', '0');
      body.setAttribute('role', 'region');
      if (this.label) body.setAttribute('aria-label', this.label);
    } else {
      body.removeAttribute('tabindex');
      body.removeAttribute('role');
      body.removeAttribute('aria-label');
    }
  }

  // ----------------------------------------------------------------------------------- handle

  readonly #onHandleKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const g = this.#gestures;
    switch (event.key) {
      case 'ArrowUp':
      case 'PageUp':
        g.step(-1, 'keyboard');
        break;
      case 'ArrowDown':
      case 'PageDown':
        g.step(1, 'keyboard');
        break;
      case 'End':
        g.first('keyboard');
        break;
      case 'Home':
        g.last('keyboard');
        break;
      case 'Enter':
      case ' ':
        g.cycle('keyboard');
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  #valueText(count: number): string {
    const viewport = window.innerHeight || 1;
    const share = Math.min(1, Math.max(0, this.#gestures.visibleHeight / viewport));
    return count > 0
      ? this.#locale.numberFormat({style: 'percent', maximumFractionDigits: 0}).format(share)
      : '';
  }

  #renderHandle(): TemplateResult {
    const g = this.#gestures;
    const count = this.#isPresented ? g.count : 1;
    const resizable = count > 1;
    const draggable = this.#isPresented;
    return html`<div
      class="handle focus-ring"
      part="handle"
      role=${resizable ? 'slider' : nothing}
      tabindex=${resizable ? '0' : nothing}
      aria-hidden=${resizable ? nothing : 'true'}
      aria-label=${resizable
        ? (this.handleLabel ?? this.#locale.t('handle.label', undefined, 'handle-label'))
        : nothing}
      aria-orientation=${resizable ? 'vertical' : nothing}
      aria-valuemin=${resizable ? '0' : nothing}
      aria-valuemax=${resizable ? String(count - 1) : nothing}
      aria-valuenow=${resizable ? String(count - 1 - g.index) : nothing}
      aria-valuetext=${resizable ? this.#valueText(count) : nothing}
      data-resizable=${resizable ? '' : nothing}
      @keydown=${resizable ? this.#onHandleKeyDown : nothing}
      @pointerdown=${draggable ? g.onHandlePointerDown : nothing}
      @pointermove=${draggable ? g.onHandlePointerMove : nothing}
      @pointerup=${draggable ? g.onHandlePointerUp : nothing}
      @pointercancel=${draggable ? g.onHandlePointerCancel : nothing}
      @lostpointercapture=${draggable ? g.onHandleLostCapture : nothing}
      @contextmenu=${g.onContextMenu}
    >
      <span class="pill"></span>
    </div>`;
  }

  // ----------------------------------------------------------------------------------- render

  override render(): TemplateResult {
    const switcher = this.#switcher;
    const phase: SheetPhase = switcher ? this.phase : this.#exiting ? 'exiting' : 'active';
    const retained = phase === 'covered' || phase === 'aligning' || phase === 'fading';
    const inactive = switcher
      ? retained || phase === 'exiting'
      : this.#exiting;
    const budget = heightBudget(this.height);
    const hug = this.height === 'hug';
    const sheetStyle = styleMap({
      '--_sheet-budget': budget,
      '--_sheet-align': retained && this.alignmentOffset > 0 ? `${this.alignmentOffset}px` : undefined,
    });
    const panel = html`<div
      class="positioner"
      ?hidden=${switcher ? phase === 'hidden' : false}
      ?inert=${inactive}
      aria-hidden=${inactive ? 'true' : nothing}
    >
      <div
        class="sheet"
        part="sheet"
        tabindex="-1"
        data-phase=${phase}
        data-height=${hug ? 'hug' : isNamedHeight(this.height) ? this.height : 'custom'}
        ?data-tall=${this.height === 'tall'}
        style=${sheetStyle}
        @focusin=${this.#keyboard.onFocusIn}
        @focusout=${this.#keyboard.onFocusOut}
      >
        ${this.#renderHandle()}
        <div
          class="body focus-ring"
          part="body"
          @pointerdown=${this.#gestures.onBodyPointerDown}
          @pointermove=${this.#gestures.onBodyPointerMove}
          @pointerup=${this.#gestures.onBodyPointerEnd}
          @pointercancel=${this.#gestures.onBodyPointerEnd}
          @contextmenu=${this.#gestures.onContextMenu}
        >
          <div class="content"><slot @slotchange=${() => this.#scheduleBodyAccess()}></slot></div>
        </div>
      </div>
    </div>`;
    if (switcher) return panel;
    const modal = !this.noScrim;
    const role = this.#purpose === 'required' ? 'alertdialog' : nothing;
    return html`<dialog
      class="dialog"
      part="dialog"
      aria-label=${this.label || nothing}
      aria-modal=${modal && this.open && !this.#exiting ? 'true' : nothing}
      role=${role}
      ?data-modal=${modal}
      ?inert=${this.#exiting}
    >
      ${panel}
      <div class="edge-tint" aria-hidden="true" data-sheet-edge-tint></div>
    </dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-bottom-sheet': TctBottomSheet;
  }
}
