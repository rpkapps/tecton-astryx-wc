/**
 * Shared tooltip behaviour (A§9.18): `tct-tooltip` and every component with a built-in tooltip
 * (icon-only buttons, truncated text) use this one controller. It composes the layer stack, anchored
 * positioning and hover/focus/touch intent, and wires `aria-describedby` from the trigger to the
 * tooltip surface.
 *
 * Two placements of the surface, both keeping the trigger's `aria-describedby` inside one tree:
 *  - `shadow`: the component renders the `[popover]` surface in its own shadow root next to an inner
 *    trigger (an icon-only button's inner `<button>`); pass `surface`.
 *  - `satellite`: a wrapper (`tct-tooltip`) whose trigger is author light-DOM content; the surface is
 *    an owned light-DOM satellite (`OwnedPartsController`, A§8.2) so the author's trigger can name it.
 *
 * Escape closes the tip first and leaves the dialog under it open (WCAG 1.4.13 dismissible; one press
 * dismisses exactly one layer); the surface is hoverable; nothing here ever moves focus.
 */
import type {ReactiveController} from 'lit';
import type {ChangeReason} from '../events/tct-event.js';
import {LayerController} from '../layer/layer-controller.js';
import {PositionController, type PlacementRequest} from '../layer/position.js';
import type {TctElement} from '../tct-element.js';
import {uniqueId} from '../utils/id.js';
import {HoverIntentController, type FocusTrigger, type TouchTrigger} from './hover-intent.js';
import {OwnedPartsController} from './owned-parts.js';

export interface TooltipControllerOptions {
  /** The element the tooltip describes and anchors to. */
  trigger: () => HTMLElement | null;
  /** Tooltip text; empty or nullish disables the tooltip and removes the description. */
  content: () => string | null | undefined;
  /** Default: above, centred, `var(--spacing-1)` clearance. */
  placement?: () => PlacementRequest;
  mode: 'shadow' | 'satellite';
  /** `shadow` mode: the `[popover]` element rendered in the host's shadow root. */
  surface?: () => HTMLElement | null;
  /** `satellite` mode: the internal element to create (registered by the component's `dependencies`). */
  surfaceTag?: string;
  /** Slot of the satellite. Default `surface`. */
  surfaceSlot?: string;
  /** Delay before showing on hover (ms). Default 200. */
  delay?: number;
  /** Delay before hiding after leave (ms). Default 0 (hover bridge). */
  hideDelay?: number;
  focusTrigger?: FocusTrigger;
  touchTrigger?: TouchTrigger;
  /** When false the tooltip never opens (and any open one closes). */
  enabled?: () => boolean;
  /** Controlled: `true`/`false` forces the state and hover/focus never toggle; `undefined` = uncontrolled. */
  open?: () => boolean | undefined;
  /**
   * Called before a user-driven change (hover, focus, Escape, outside press). Return `false` to keep
   * the current state, typically because a cancelable `tct-open-change` was prevented. For a
   * controlled tooltip this is the only effect: the owner applies the new state.
   */
  onOpenChange?: (open: boolean, reason: ChangeReason, event?: Event) => boolean | void;
  /** Called after the change settled (entry animation done, or hidden), for every actual change. */
  onAfterOpenChange?: (open: boolean) => void;
  /** Exit animation awaited before hiding. */
  exitAnimation?: () => Animation[] | Promise<unknown>;
}

export class TooltipController implements ReactiveController {
  readonly #options: TooltipControllerOptions;
  readonly #parts: OwnedPartsController | undefined;
  readonly layer: LayerController;
  readonly position: PositionController;
  readonly hover: HoverIntentController;
  #describedId: string | undefined;
  #describedTrigger: HTMLElement | null = null;
  #surfaceId = uniqueId('tct-tooltip');
  #lastControlled: boolean | undefined;

  constructor(host: TctElement, options: TooltipControllerOptions) {
    this.#options = options;

    if (options.mode === 'satellite') {
      this.#parts = new OwnedPartsController(host, {
        parts: [
          {
            slot: options.surfaceSlot ?? 'surface',
            tag: options.surfaceTag ?? 'tct-tooltip-surface',
            when: () => this.#hasContent(),
            init: (element) => {
              element.id = this.#surfaceId;
              element.setAttribute('role', 'tooltip');
              element.setAttribute('popover', 'manual');
              const text = options.content() ?? '';
              if (element.textContent !== text) element.textContent = text;
            },
          },
        ],
      });
    }

    this.position = new PositionController(host, {
      surface: () => this.#surface(),
      anchor: () => options.trigger(),
      placement:
        options.placement ??
        (() => ({placement: 'above', alignment: 'center', offset: 'var(--spacing-1)'})),
      trackPlacement: true,
    });

    this.layer = new LayerController(host, {
      kind: 'hint',
      surface: () => this.#surface(),
      trigger: () => options.trigger(),
      escape: 'close',
      outsidePress: true,
      returnFocus: false,
      position: this.position,
      exitAnimation: options.exitAnimation,
      onDismissRequest: (reason, event) => {
        this.#request(false, reason, event);
      },
    });

    this.hover = new HoverIntentController(host, {
      trigger: options.trigger,
      surface: () => this.#surface(),
      openDelay: options.delay ?? 200,
      closeDelay: options.hideDelay ?? 0,
      touch: options.touchTrigger,
      focus: options.focusTrigger,
      enabled: () => this.#enabled(),
      controlled: () => this.#options.open?.() !== undefined,
      isOpen: () => this.layer.isOpen,
      onOpen: (reason, event) => {
        this.#request(true, reason, event);
      },
      onClose: (reason, event) => {
        this.#request(false, reason, event);
      },
    });

    host.addController(this);
  }

  /** Whether the tooltip is open. */
  get isOpen(): boolean {
    return this.layer.isOpen;
  }

  /** Id of the tooltip surface (what the trigger's `aria-describedby` points at). */
  get surfaceId(): string {
    return this.#surfaceId;
  }

  /** Shows the tooltip without an intent event (programmatic). */
  async show(): Promise<void> {
    if (!this.#enabled() || this.layer.isOpen) return;
    await this.layer.show();
    this.#options.onAfterOpenChange?.(true);
  }

  /** Hides the tooltip without an intent event (programmatic). */
  async hide(): Promise<void> {
    if (!this.layer.isOpen) return;
    await this.layer.hide();
    this.#options.onAfterOpenChange?.(false);
  }

  hostUpdated(): void {
    this.#wire();
    // Controlled state and `enabled` are applied after the host rendered.
    const controlled = this.#options.open?.();
    if (controlled !== undefined && controlled !== this.layer.isOpen) {
      void (controlled ? this.show() : this.hide());
    } else if (
      controlled === undefined &&
      this.#lastControlled !== undefined &&
      this.layer.isOpen
    ) {
      void this.hide(); // went from controlled to uncontrolled: hover/focus own the state again
    }
    this.#lastControlled = controlled;
    if (!this.#enabled() && this.layer.isOpen) void this.hide();
  }

  hostDisconnected(): void {
    this.#unwire();
  }

  // ---------------------------------------------------------------------------------- internals

  #hasContent(): boolean {
    return Boolean(this.#options.content());
  }

  #enabled(): boolean {
    return (
      this.#hasContent() && (this.#options.enabled?.() ?? true) && this.#options.open?.() !== false
    );
  }

  #surface(): HTMLElement | null {
    if (this.#options.mode === 'satellite')
      return this.#parts?.get(this.#options.surfaceSlot ?? 'surface') ?? null;
    return this.#options.surface?.() ?? null;
  }

  #request(open: boolean, reason: ChangeReason, event?: Event): void {
    if (open && !this.#enabled()) return;
    const allowed = this.#options.onOpenChange?.(open, reason, event) !== false;
    if (!allowed) return;
    // A controlled tooltip only reports; the owner applies the state through `open`.
    if (this.#options.open?.() !== undefined) return;
    void (open ? this.show() : this.hide());
  }

  /** Points the trigger at the surface with `aria-describedby`, keeping the author's own tokens. */
  #wire(): void {
    const trigger = this.#options.trigger();
    const surface = this.#surface();
    if (this.#describedTrigger && this.#describedTrigger !== trigger) this.#unwire();
    if (!trigger || !surface || !this.#hasContent()) {
      this.#unwire();
      return;
    }
    if (this.#options.mode === 'shadow') {
      surface.id ||= this.#surfaceId;
      if (!surface.hasAttribute('role')) surface.setAttribute('role', 'tooltip');
      this.#surfaceId = surface.id;
    }
    const id = surface.id || this.#surfaceId;
    const tokens = new Set(
      (trigger.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean),
    );
    if (!tokens.has(id)) {
      tokens.add(id);
      trigger.setAttribute('aria-describedby', [...tokens].join(' '));
    }
    this.#describedId = id;
    this.#describedTrigger = trigger;
  }

  #unwire(): void {
    const trigger = this.#describedTrigger;
    const id = this.#describedId;
    if (trigger && id) {
      const tokens = (trigger.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .filter((t) => t && t !== id);
      if (tokens.length > 0) trigger.setAttribute('aria-describedby', tokens.join(' '));
      else trigger.removeAttribute('aria-describedby');
    }
    this.#describedTrigger = null;
    this.#describedId = undefined;
  }
}
