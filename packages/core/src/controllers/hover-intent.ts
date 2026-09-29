/**
 * Hover/focus/touch intent for hover layers (A§9.18): tooltips and hover cards. Ports upstream
 * `useTooltip` timing and `useTouchTrigger` policy.
 *
 *  - hover opens after `openDelay` (a pointer passing across the trigger must not flash a tip) and
 *    closes after `closeDelay`; a 100 ms bridge is used when `closeDelay` is 0 so the pointer can
 *    travel onto the surface, which must stay open while hovered (WCAG 1.4.13 hoverable);
 *  - keyboard focus opens immediately, but only for `:focus-visible` focus (not a dialog's
 *    programmatic autofocus, not a tap);
 *  - pressing the trigger with a mouse dismisses (the hint served its purpose);
 *  - touch has no hover: a tap on a trigger that performs no action opens the layer (`auto`), one that
 *    does keeps its tap and the layer stays shut; `tap`/`none` state the choice outright. The layer
 *    stack (outside press) closes a tap-opened layer.
 *
 * The owner keeps the state: `onOpen`/`onClose` are requests with a reason.
 * Guides: [mwg:interest-triggered-tooltips]
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import type {ChangeReason} from '../events/tct-event.js';
import {focusTargetOf} from '../utils/focus.js';
import {getModality, trackInteractionModality} from './interaction-modality.js';

/** How a hover layer behaves on a touch pointer. */
export type TouchTrigger = 'auto' | 'tap' | 'none';
export type FocusTrigger = 'auto' | 'always' | 'never';

/** Pointer types whose press is a tap rather than a click. A pen hovers until it lands. */
const TOUCH_POINTER_TYPES = new Set(['touch', 'pen']);

/** Roles that make an element do something when activated (an explicit role beats the tag). */
const ACTION_ROLES = new Set([
  'button',
  'checkbox',
  'combobox',
  'link',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'radio',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'textbox',
]);

/**
 * Whether activating `element` does something other than reveal a layer: a button, link, form
 * control or editor. Deliberately narrower than "focusable": a text-only trigger wrapper carries
 * `tabindex=0` so keyboard users reach the hint and still performs no action.
 */
export function isActionTrigger(element: HTMLElement): boolean {
  const role = element.getAttribute('role');
  if (role) return ACTION_ROLES.has(role);
  switch (element.localName) {
    case 'button':
    case 'input':
    case 'label':
    case 'select':
    case 'summary':
    case 'textarea':
      return true;
    case 'a':
    case 'area':
      return element.hasAttribute('href');
    default: {
      if (element.isContentEditable) return true;
      const editable = element.getAttribute('contenteditable');
      if (editable !== null && editable !== 'false') return true;
      // Library elements that wrap a native control (tct-button) are actions too.
      const inner = element.shadowRoot?.delegatesFocus ? focusTargetOf(element) : null;
      return inner ? isActionTrigger(inner) : false;
    }
  }
}

export interface HoverIntentOptions {
  trigger: () => HTMLElement | null;
  /** The layer surface: hovering it keeps the layer open. */
  surface?: () => HTMLElement | null;
  /** Default 200 ms. */
  openDelay?: number | (() => number);
  /** Default 0, meaning a 100 ms hover bridge. */
  closeDelay?: number | (() => number);
  /** Default `auto`. */
  touch?: TouchTrigger | (() => TouchTrigger | undefined);
  /** `auto` (default): only when the trigger is focusable. */
  focus?: FocusTrigger | (() => FocusTrigger | undefined);
  /** Listeners stay attached but do nothing while this returns false. */
  enabled?: () => boolean;
  /** Controlled layers are never toggled by hover, focus or a tap. */
  controlled?: () => boolean;
  isOpen: () => boolean;
  onOpen(reason: ChangeReason, event?: Event): void;
  onClose(reason: ChangeReason, event?: Event): void;
}

const HOVER_BRIDGE_MS = 100;

export class HoverIntentController implements ReactiveController {
  readonly #options: HoverIntentOptions;
  #trigger: HTMLElement | null = null;
  #surface: HTMLElement | null = null;
  #openTimer: ReturnType<typeof setTimeout> | undefined;
  #closeTimer: ReturnType<typeof setTimeout> | undefined;
  #touchPointer = false;

  constructor(host: ReactiveControllerHost & HTMLElement, options: HoverIntentOptions) {
    this.#options = options;
    host.addController(this);
  }

  /** Whether the interaction in flight is a touch one (goes false again once the user reaches for the keyboard). */
  isTouchInteraction(): boolean {
    return this.#touchPointer && getModality() === 'pointer';
  }

  /** Requests open now, cancelling timers. */
  open(reason: ChangeReason = 'request', event?: Event): void {
    this.cancel();
    if (!this.#options.isOpen()) this.#options.onOpen(reason, event);
  }

  /** Requests close now, cancelling timers. */
  close(reason: ChangeReason = 'request', event?: Event): void {
    this.cancel();
    if (this.#options.isOpen()) this.#options.onClose(reason, event);
  }

  /** Cancels pending open/close timers. */
  cancel(): void {
    clearTimeout(this.#openTimer);
    clearTimeout(this.#closeTimer);
    this.#openTimer = undefined;
    this.#closeTimer = undefined;
  }

  hostConnected(): void {
    trackInteractionModality();
    this.#attach();
  }

  hostUpdated(): void {
    this.#attach();
  }

  hostDisconnected(): void {
    this.cancel();
    this.#detach();
  }

  // ---------------------------------------------------------------------------------- internals

  #read<V>(value: V | (() => V | undefined) | undefined, fallback: V): V {
    const resolved = typeof value === 'function' ? (value as () => V | undefined)() : value;
    return resolved ?? fallback;
  }

  #live(): boolean {
    return this.#options.enabled?.() ?? true;
  }

  #controlled(): boolean {
    return this.#options.controlled?.() ?? false;
  }

  #attach(): void {
    const trigger = this.#options.trigger();
    const surface = this.#options.surface?.() ?? null;
    if (trigger === this.#trigger && surface === this.#surface) return;
    this.#detach();
    this.#trigger = trigger;
    this.#surface = surface;
    if (trigger) {
      trigger.addEventListener('pointerenter', this.#onPointerEnter);
      trigger.addEventListener('pointerdown', this.#onPointerDown);
      trigger.addEventListener('mouseenter', this.#onMouseEnter);
      trigger.addEventListener('mouseleave', this.#onMouseLeave);
      trigger.addEventListener('focusin', this.#onFocusIn);
      trigger.addEventListener('focusout', this.#onFocusOut);
    }
    if (surface) {
      surface.addEventListener('mouseenter', this.#onSurfaceEnter);
      surface.addEventListener('mouseleave', this.#onMouseLeave);
    }
  }

  #detach(): void {
    const trigger = this.#trigger;
    if (trigger) {
      trigger.removeEventListener('pointerenter', this.#onPointerEnter);
      trigger.removeEventListener('pointerdown', this.#onPointerDown);
      trigger.removeEventListener('mouseenter', this.#onMouseEnter);
      trigger.removeEventListener('mouseleave', this.#onMouseLeave);
      trigger.removeEventListener('focusin', this.#onFocusIn);
      trigger.removeEventListener('focusout', this.#onFocusOut);
    }
    const surface = this.#surface;
    if (surface) {
      surface.removeEventListener('mouseenter', this.#onSurfaceEnter);
      surface.removeEventListener('mouseleave', this.#onMouseLeave);
    }
    this.#trigger = null;
    this.#surface = null;
  }

  #scheduleOpen(reason: ChangeReason, event: Event): void {
    if (!this.#live() || this.#controlled()) return;
    this.cancel();
    this.#openTimer = setTimeout(
      () => {
        this.#openTimer = undefined;
        if (!this.#options.isOpen()) this.#options.onOpen(reason, event);
      },
      this.#read(this.#options.openDelay, 200),
    );
  }

  #scheduleClose(reason: ChangeReason, event: Event): void {
    if (this.#controlled()) return;
    this.cancel();
    const configured = this.#read(this.#options.closeDelay, 0);
    const delay = configured > 0 ? configured : HOVER_BRIDGE_MS;
    this.#closeTimer = setTimeout(() => {
      this.#closeTimer = undefined;
      if (this.#options.isOpen()) this.#options.onClose(reason, event);
    }, delay);
  }

  readonly #onPointerEnter = (event: PointerEvent): void => {
    // Only a finger is hoverless on arrival; a pen in range hovers like a mouse.
    this.#touchPointer = event.pointerType === 'touch';
  };

  readonly #onMouseEnter = (event: MouseEvent): void => {
    // A tap synthesises mouseenter; on touch the tap path owns the decision.
    if (this.#touchPointer) return;
    this.#scheduleOpen('hover', event);
  };

  readonly #onMouseLeave = (event: MouseEvent): void => {
    // The synthesised mouseleave arrives with the next tap elsewhere, which the stack handles.
    if (this.#touchPointer) return;
    this.#scheduleClose('hover', event);
  };

  readonly #onSurfaceEnter = (): void => {
    // Hoverable surface (WCAG 1.4.13): the pointer reached it, so a pending close is cancelled.
    clearTimeout(this.#closeTimer);
    this.#closeTimer = undefined;
  };

  #focusEnabled(trigger: HTMLElement): boolean {
    const mode = this.#read(this.#options.focus, 'auto');
    if (mode === 'never') return false;
    return mode === 'always' || focusTargetOf(trigger) !== null;
  }

  readonly #onFocusIn = (event: FocusEvent): void => {
    const trigger = this.#trigger;
    if (!trigger || !this.#live() || this.#controlled() || !this.#focusEnabled(trigger)) return;
    // A tap focuses the control it activates; only keyboard-style focus shows the hint.
    if (this.isTouchInteraction()) return;
    const target = event.composedPath()[0];
    if (!(target instanceof Element) || !target.matches(':focus-visible')) return;
    this.open('keyboard', event);
  };

  readonly #onFocusOut = (event: FocusEvent): void => {
    const trigger = this.#trigger;
    if (!trigger || this.#controlled() || !this.#focusEnabled(trigger)) return;
    const next = event.relatedTarget;
    if (next instanceof Node && trigger.contains(next)) return;
    this.#scheduleClose('keyboard', event);
  };

  readonly #onPointerDown = (event: PointerEvent): void => {
    const isTouch = TOUCH_POINTER_TYPES.has(event.pointerType);
    this.#touchPointer = isTouch;
    if (this.#controlled()) return;
    const trigger = this.#trigger;
    if (!isTouch) {
      // Pressing the trigger with a mouse dismisses its own hint.
      this.close('pointer', event);
      return;
    }
    if (!trigger) return;
    const configured = this.#read(this.#options.touch, 'auto');
    const mode = configured === 'auto' ? (isActionTrigger(trigger) ? 'none' : 'tap') : configured;
    if (mode === 'none' || !this.#live()) {
      this.close('pointer', event);
      return;
    }
    if (this.#options.isOpen()) {
      this.close('trigger', event);
      return;
    }
    this.cancel();
    this.#options.onOpen('trigger', event);
  };
}
