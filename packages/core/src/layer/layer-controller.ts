/**
 * `LayerController` (A§9.9, A-08): everything a modal or floating surface needs, on one document-wide
 * stack. `<dialog>` for modals and `popover="manual"` for everything floating, so the browser owns
 * the top layer (no portals, no z-index, no focus-trap code) and this controller owns the rules:
 * one Escape closes one layer, outside presses close the layers above the pressed one, focus
 * returns where it came from, scroll is locked under modals, exit animations finish before the
 * native hide, and an open layer survives being moved.
 *
 * The owner keeps the `open` state and the events: `show()`/`hide()` emit nothing and
 * `onDismissRequest` is where an intent event is raised (`TctOpenChangeEvent`), after which the owner
 * calls `hide()` unless the event was prevented.
 *
 * ```ts
 * #layer = new LayerController(this, {
 *   kind: 'modal',
 *   surface: () => this.renderRoot.querySelector('dialog'),
 *   trigger: () => this.#trigger,
 *   escape: () => (this.purpose === 'required' ? 'block' : 'close'),
 *   onDismissRequest: (reason) => {
 *     if (this.dispatch(new TctOpenChangeEvent(false, reason))) void this.#layer.hide();
 *   },
 * });
 * ```
 */
import type {ReactiveController} from 'lit';
import {ContextConsumer, ContextProvider} from '../context/protocol.js';
import {layerContext} from '../context/keys.js';
import {trackInteractionModality, getModality} from '../controllers/interaction-modality.js';
import type {ChangeReason} from '../events/tct-event.js';
import {features} from '../features.js';
import type {TctElement} from '../tct-element.js';
import {containsFlat, deepActiveElement, getTabbables, isFocusDetached} from '../utils/focus.js';
import {currentGesture} from './gesture.js';
import type {PositionController} from './position.js';
import {lockScroll} from './scroll-lock.js';
import {registerLayer, shouldDismissOnCloseRequest, isTopmostLayer} from './stack.js';
import {noteModalHidden, noteModalShown} from './top-layer-host.js';

export type LayerKind = 'modal' | 'dialog' | 'popover' | 'hint' | 'toast';
export type EscapeBehavior = 'close' | 'block' | 'none';

export interface LayerOptions {
  kind: LayerKind;
  /** The `<dialog>` (modal, dialog) or `[popover=manual]` element (popover, hint, toast). */
  surface: () => HTMLDialogElement | HTMLElement | null;
  /** The invoker: gets `aria-expanded`, counts as inside for outside presses, receives returned focus. */
  trigger?: () => HTMLElement | null;
  /** Extra elements that count as inside the layer for outside presses and focus-out. */
  inside?: () => (EventTarget | null | undefined)[];
  /** What Escape does when this layer is top-most. Default `'close'`. */
  escape?: EscapeBehavior | (() => EscapeBehavior);
  /** Whether presses outside dismiss the layer. Default `true` except for `'modal'`. */
  outsidePress?: boolean | ((event: PointerEvent) => boolean);
  /** Dismiss when focus moves outside (non-modal, non-trapping surfaces). Default `false`. */
  focusOut?: boolean;
  /**
   * Where focus goes on show. `'auto'` (default): the browser's own focusing steps. `'surface'`
   * focuses the surface, `'first'` its first tabbable, `'none'` leaves focus alone (modals fall back
   * to the surface, since `showModal()` always moves focus), a function picks an element.
   */
  initialFocus?: 'auto' | 'surface' | 'first' | 'none' | (() => HTMLElement | null);
  /** Return focus on hide: `true` (default; the trigger, else the previously focused element), `false`, or a chooser. */
  returnFocus?: boolean | (() => HTMLElement | null);
  /** Lock page scroll while open. Default: `kind === 'modal'`. */
  scrollLock?: boolean;
  /** Awaited before the native hide (WAAPI; never the `overlay` property). */
  exitAnimation?: () => Animation[] | Promise<unknown>;
  /** `aria-haspopup` value put on the trigger (default `dialog` for dialogs, none otherwise). */
  haspopup?: 'dialog' | 'menu' | 'listbox' | 'tree' | 'grid' | 'true';
  /** Anchored positioning; the controller calls `prepare()`, `activate()` and `deactivate()`. */
  position?: PositionController;
  /** Owner decides: typically dispatch `TctOpenChangeEvent(false, reason)` and `hide()` unless prevented. */
  onDismissRequest(reason: ChangeReason, event?: Event): void;
  /** A trigger click while closed (see `toggleFromTrigger`). */
  onOpenRequest?(reason: ChangeReason, event?: Event): void;
  /** The surface was closed by something other than `hide()` (`form method=dialog`, `hidePopover()`). */
  onNativeClose?(event?: Event): void;
  onShown?(): void;
  onHidden?(): void;
}

/** Longest time an entry or exit animation may delay `show()`/`hide()` (a stuck animation must not wedge a layer). */
const ANIMATION_TIMEOUT_MS = 1500;

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

async function animationsSettled(surface: HTMLElement): Promise<void> {
  await nextFrame();
  const running = surface.getAnimations({subtree: true}).filter((animation) => {
    const iterations = animation.effect?.getComputedTiming().iterations;
    return iterations !== Infinity;
  });
  if (running.length === 0) return;
  await Promise.race([
    Promise.allSettled(running.map((animation) => animation.finished)),
    new Promise((resolve) => setTimeout(resolve, ANIMATION_TIMEOUT_MS)),
  ]);
}

const isDialog = (surface: HTMLElement): surface is HTMLDialogElement =>
  surface.localName === 'dialog';

export class LayerController implements ReactiveController {
  readonly #host: TctElement;
  readonly #options: LayerOptions;
  readonly #parent: ContextConsumer<typeof layerContext>;

  #open = false;
  #suspended = false;
  #hiding = false;
  #generation = 0;
  #showing: Promise<void> | undefined;
  #shownSurface: HTMLElement | null = null;
  #unregister: (() => void) | undefined;
  #unlock: (() => void) | undefined;
  #closeWatcher: {destroy(): void} | undefined;
  #previouslyFocused: Element | null = null;
  #dismissedGesture: number | undefined;
  /** Why the owner was last asked to dismiss (an outside press moves focus after we hear of it). */
  #dismissReason: ChangeReason | undefined;

  constructor(host: TctElement, options: LayerOptions) {
    this.#host = host;
    this.#options = options;
    // Nested layers find their parent through context; this host provides itself to its subtree.
    // A provider never answers its own host, so the consumer below still reaches the enclosing layer.
    // Hints and toasts never contain nested layers, so several layer controllers on one host (a
    // menu with a tooltip) do not compete to answer the same context.
    if (options.kind !== 'hint' && options.kind !== 'toast') {
      new ContextProvider(host, {context: layerContext, initialValue: this});
    }
    this.#parent = new ContextConsumer(host, {context: layerContext, subscribe: true});
    host.addController(this);
  }

  /** Logical open state: true from the moment `show()` starts the native show until `hide()` starts. */
  get isOpen(): boolean {
    return this.#open;
  }

  /** Whether this layer is the top-most present layer on the stack. */
  get isTopmost(): boolean {
    return this.#open && isTopmostLayer(this);
  }

  /** The enclosing layer (from context), or `null`. */
  get parent(): LayerController | null {
    return this.#parent.value ?? null;
  }

  /** Native show, register on the stack, focus, entry animation. Emits nothing. */
  show(): Promise<void> {
    if (this.#open) return this.#showing ?? Promise.resolve();
    const surface = this.#options.surface();
    if (!surface || !this.#host.isConnected) return Promise.resolve();
    this.#generation++;
    this.#open = true;
    this.#suspended = false;
    this.#previouslyFocused = containsFlat(surface, deepActiveElement())
      ? null
      : deepActiveElement();
    this.#activate(surface);
    this.#showing = animationsSettled(surface).finally(() => {
      this.#showing = undefined;
    });
    return this.#showing;
  }

  /** Exit animation, native hide, unregister, return focus. Emits nothing. */
  async hide(): Promise<void> {
    if (!this.#open) return;
    const surface = this.#shownSurface ?? this.#options.surface();
    const generation = ++this.#generation;
    this.#open = false;
    this.#hiding = true;
    // Off the stack immediately: while the exit animation runs, the next Escape belongs to the
    // layer below, and this one no longer takes presses.
    this.#unregister?.();
    this.#unregister = undefined;
    this.#closeWatcher?.destroy();
    this.#closeWatcher = undefined;
    try {
      if (surface && surface.isConnected && this.#isNativelyShown(surface)) await this.#exit();
      // A show() during the exit animation cancels the hide.
      if (generation !== this.#generation) return;
      if (surface) this.#nativeHide(surface);
      this.#release(surface);
      // The stack hears of an outside press at pointerdown, before the browser moves focus to what
      // was pressed (or to the body, for empty space). Decide about returning focus after that.
      if (this.#dismissReason === 'outside') await new Promise((resolve) => setTimeout(resolve, 0));
      this.#dismissReason = undefined;
      if (generation !== this.#generation) return;
      this.#returnFocus(surface);
      this.#options.onHidden?.();
    } finally {
      this.#hiding = false;
    }
  }

  /**
   * For trigger clicks: a click belonging to the gesture that just dismissed this layer is ignored
   * (the press that closed it must not reopen it); otherwise a click while open asks the owner to
   * dismiss with reason `trigger`, and while closed asks it to open.
   */
  toggleFromTrigger(event: Event): void {
    if (this.wasJustDismissed()) return;
    if (this.#open) this.#options.onDismissRequest('trigger', event);
    else this.#options.onOpenRequest?.('trigger', event);
  }

  /** Whether the current user gesture is the one that last dismissed this layer. */
  wasJustDismissed(): boolean {
    return this.#dismissedGesture !== undefined && this.#dismissedGesture === currentGesture();
  }

  hostConnected(): void {
    trackInteractionModality();
    // Moved without moveBefore(): the browser closed the surface; put it back.
    if (this.#open && this.#suspended) {
      const surface = this.#options.surface();
      if (surface) {
        this.#suspended = false;
        this.#activate(surface);
      }
    }
  }

  hostDisconnected(): void {
    if (!this.#open || this.#suspended) return;
    this.#suspended = true;
    this.#unregister?.();
    this.#unregister = undefined;
    this.#closeWatcher?.destroy();
    this.#closeWatcher = undefined;
    this.#unlock?.();
    this.#unlock = undefined;
    this.#options.position?.deactivate();
    const surface = this.#shownSurface;
    if (surface && this.#options.kind === 'modal') noteModalHidden(surface);
    if (surface) this.#detachSurfaceListeners(surface);
  }

  // ---------------------------------------------------------------------------------- internals

  #isNativelyShown(surface: HTMLElement): boolean {
    if (isDialog(surface)) return surface.open;
    return features.popover ? surface.matches(':popover-open') : surface.style.display === 'block';
  }

  /** Native show + everything that hangs off it. Shared by `show()` and the re-show after a move. */
  #activate(surface: HTMLElement): void {
    const {kind, position} = this.#options;
    this.#shownSurface = surface;
    position?.prepare();

    if (
      !this.#isNativelyShown(surface) ||
      (kind === 'modal' && isDialog(surface) && !surface.matches(':modal'))
    ) {
      this.#nativeShow(surface);
    }
    position?.activate();

    this.#attachSurfaceListeners(surface);
    // A show() that interrupted a hide re-enters here with the previous registration and lock alive.
    this.#unregister?.();
    this.#unlock?.();
    this.#unlock = undefined;
    this.#unregister = registerLayer({
      token: this,
      kind,
      host: () => this.#host,
      surface: () => this.#shownSurface,
      trigger: () => this.#options.trigger?.() ?? null,
      inside: () => this.#options.inside?.() ?? [],
      escape: () => {
        const escape = this.#options.escape ?? 'close';
        return typeof escape === 'function' ? escape() : escape;
      },
      outsidePress: (event) => {
        const policy = this.#options.outsidePress ?? kind !== 'modal';
        return typeof policy === 'function' ? policy(event) : policy;
      },
      focusOut: this.#options.focusOut ?? false,
      parent: () => this.parent,
      isPresent: () =>
        this.#open && this.#shownSurface !== null && this.#isNativelyShown(this.#shownSurface),
      dismiss: (reason, event) => {
        this.#dismiss(reason, event);
      },
    });
    if (kind === 'modal') noteModalShown(surface);
    if (this.#options.scrollLock ?? kind === 'modal') this.#unlock = lockScroll();
    this.#syncTrigger(true, surface);
    this.#createCloseWatcher();
    this.#applyInitialFocus(surface);
    this.#options.onShown?.();
  }

  #nativeShow(surface: HTMLElement): void {
    const {kind, position} = this.#options;
    if (isDialog(surface)) {
      if (kind === 'modal') {
        // showModal() throws for a dialog that is already open non-modally (markup `open`).
        if (surface.open) surface.close();
        surface.showModal();
      } else if (!surface.open) {
        surface.show();
      }
      return;
    }
    if (!features.popover) {
      surface.style.display = 'block';
      return;
    }
    if (!surface.hasAttribute('popover')) surface.setAttribute('popover', 'manual');
    surface.showPopover(position?.showOptions);
  }

  #nativeHide(surface: HTMLElement): void {
    if (isDialog(surface)) {
      if (surface.open) surface.close();
    } else if (!features.popover) {
      surface.style.display = 'none';
    } else if (surface.matches(':popover-open')) {
      surface.hidePopover();
    }
  }

  async #exit(): Promise<void> {
    const exit = this.#options.exitAnimation?.();
    if (!exit) return;
    const settled = Array.isArray(exit)
      ? Promise.allSettled(exit.map((animation) => animation.finished))
      : exit.catch(() => undefined);
    await Promise.race([
      settled,
      new Promise((resolve) => setTimeout(resolve, ANIMATION_TIMEOUT_MS)),
    ]);
  }

  /** Everything that undoes {@link #activate}, after the native hide. */
  #release(surface: HTMLElement | null): void {
    this.#unlock?.();
    this.#unlock = undefined;
    this.#options.position?.deactivate();
    if (surface) {
      this.#detachSurfaceListeners(surface);
      if (this.#options.kind === 'modal') noteModalHidden(surface);
    }
    this.#syncTrigger(false, surface);
    this.#shownSurface = null;
  }

  #syncTrigger(open: boolean, surface: HTMLElement | null): void {
    const {kind, haspopup} = this.#options;
    if (kind === 'hint' || kind === 'toast') return;
    const trigger = this.#options.trigger?.();
    if (!trigger) return;
    trigger.setAttribute('aria-expanded', String(open));
    const popup = haspopup ?? (kind === 'popover' ? undefined : 'dialog');
    if (popup && !trigger.hasAttribute('aria-haspopup'))
      trigger.setAttribute('aria-haspopup', popup);
    // aria-controls only when both ends are in one tree (ids never cross a shadow boundary).
    if (open && surface?.id && trigger.getRootNode() === surface.getRootNode()) {
      trigger.setAttribute('aria-controls', surface.id);
    }
  }

  #createCloseWatcher(): void {
    // Modal <dialog>s route the platform close request through `cancel`; popovers need a watcher.
    if (this.#options.kind === 'modal' || this.#options.kind === 'dialog') return;
    if (!features.closeWatcher) return;
    try {
      const watcher = new CloseWatcher();
      watcher.oncancel = (event) => {
        if (!shouldDismissOnCloseRequest(this)) event.preventDefault();
      };
      watcher.onclose = (event) => {
        if (shouldDismissOnCloseRequest(this)) this.#dismiss('close-watcher', event);
      };
      this.#closeWatcher = watcher;
    } catch {
      // No history entry available (e.g. not user-activated in some engines): Escape still works.
    }
  }

  #dismiss(reason: ChangeReason, event?: Event): void {
    this.#dismissedGesture = currentGesture();
    this.#dismissReason = reason;
    this.#options.onDismissRequest(reason, event);
  }

  // ------------------------------------------------------------- native events on the surface

  #attachSurfaceListeners(surface: HTMLElement): void {
    surface.addEventListener('cancel', this.#onCancel);
    surface.addEventListener('close', this.#onNativeClose);
    surface.addEventListener('toggle', this.#onToggle);
  }

  #detachSurfaceListeners(surface: HTMLElement): void {
    surface.removeEventListener('cancel', this.#onCancel);
    surface.removeEventListener('close', this.#onNativeClose);
    surface.removeEventListener('toggle', this.#onToggle);
  }

  /** The platform asked to close a dialog (Escape not claimed, Android back): the stack decides. */
  readonly #onCancel = (event: Event): void => {
    event.preventDefault();
    if (shouldDismissOnCloseRequest(this)) this.#dismiss('close-watcher', event);
  };

  readonly #onToggle = (event: Event): void => {
    if ((event as ToggleEvent).newState === 'closed') this.#nativelyClosed(event);
  };

  readonly #onNativeClose = (event: Event): void => {
    this.#nativelyClosed(event);
  };

  /** The surface closed without `hide()`: sync everything and tell the owner. */
  #nativelyClosed(event: Event): void {
    if (!this.#open || this.#hiding || this.#suspended || !this.#host.isConnected) return;
    const surface = this.#shownSurface;
    if (surface && this.#isNativelyShown(surface)) return;
    this.#open = false;
    this.#generation++;
    this.#unregister?.();
    this.#unregister = undefined;
    this.#closeWatcher?.destroy();
    this.#closeWatcher = undefined;
    this.#release(surface);
    this.#returnFocus(surface);
    this.#options.onNativeClose?.(event);
    this.#options.onHidden?.();
  }

  // ------------------------------------------------------------------------------------ focus

  #applyInitialFocus(surface: HTMLElement): void {
    const option = this.#options.initialFocus ?? 'auto';
    if (option === 'auto') return;
    let target: HTMLElement | null;
    if (typeof option === 'function') {
      target = option();
    } else if (option === 'first') {
      target = getTabbables(surface)[0] ?? surface;
    } else if (option === 'surface' || this.#options.kind === 'modal') {
      target = surface;
    } else {
      return; // 'none'
    }
    if (!target) return;
    if (target === surface && !surface.hasAttribute('tabindex'))
      surface.setAttribute('tabindex', '-1');
    this.#focus(target);
  }

  /** `focus()` with `focusVisible` set from the last input device when the engine supports it. */
  #focus(target: HTMLElement): void {
    const options: FocusOptions & {focusVisible?: boolean} = {preventScroll: true};
    if (features.focusVisibleOption) options.focusVisible = getModality() !== 'pointer';
    target.focus(options);
  }

  /**
   * Returns focus after the native hide, but only when it is not somewhere the user chose: on nothing
   * (`<body>`), or still on an element inside the now hidden layer (the engine moves focus off a
   * hidden element only at the next rendering update, so right after the hide it is still there).
   * A dismissing click on another control has already moved focus and must never be fought.
   */
  #returnFocus(surface: HTMLElement | null): void {
    const {returnFocus} = this.#options;
    if (returnFocus === false) return;
    const stale = surface !== null && containsFlat(surface, deepActiveElement());
    if (!isFocusDetached() && !stale) return;
    const chosen = typeof returnFocus === 'function' ? returnFocus() : null;
    const target =
      chosen ?? this.#options.trigger?.() ?? (this.#previouslyFocused as HTMLElement | null);
    if (target?.isConnected && typeof target.focus === 'function') this.#focus(target);
  }
}
