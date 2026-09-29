/**
 * `CollapsibleController` (upstream `useCollapsible`): the disclosure state machine shared by
 * `tct-collapsible` and any element that hides content behind a toggle (Banner, Card, Section).
 *
 * Three modes, decided per host:
 *  1. **Group-controlled**: the host has a `value` and sits inside a `tct-collapsible-group`; the group
 *     owns the open state (`isOpen(value)`) and a toggle asks the group.
 *  2. **Own state**: the host's `open` property is the state. A user toggle first asks the host to
 *     `requestChange` (it fires the cancelable `tct-open-change`); unless prevented the change is applied
 *     with `setOpen`. Property writes never go through here, so they never emit an intent event.
 *
 * A collapsible below another one is not row-chromed by the same group: this controller re-provides
 * the group context to its subtree with the presentation (dividers, density, chevron) reset, while the
 * open/toggle state still reaches nested items that have a `value`.
 */
import type {ReactiveController} from 'lit';
import {ContextConsumer, ContextProvider} from '@tecton-wc/core/context/protocol.js';
import type {TctElement} from '@tecton-wc/core/tct-element.js';
import {collapsibleGroupContext, type CollapsibleGroupContextValue} from './collapsible.context.js';
import type {CollapsibleChevronPosition, CollapsibleDensity} from './collapsible.types.js';

export interface CollapsibleControllerOptions {
  /** The item's id within a group. Without one the host never defers to a group. */
  value?: () => string | undefined;
  /** The host's own open state. */
  open: () => boolean;
  /** Applies a user-initiated change to the host's own state (an uncontrolled toggle). */
  setOpen: (open: boolean) => void;
  /** Fires the cancelable intent event; return `false` when it was prevented. */
  requestChange: (open: boolean, event?: Event) => boolean;
}

export class CollapsibleController implements ReactiveController {
  readonly #options: CollapsibleControllerOptions;
  readonly #group: ContextConsumer<typeof collapsibleGroupContext>;
  readonly #reset: ContextProvider<typeof collapsibleGroupContext>;

  constructor(host: TctElement, options: CollapsibleControllerOptions) {
    this.#options = options;
    this.#group = new ContextConsumer(host, {context: collapsibleGroupContext, subscribe: true});
    this.#reset = new ContextProvider(host, {context: collapsibleGroupContext, initialValue: null});
    host.addController(this);
  }

  /** The enclosing group's value, whether or not this item takes part in it. */
  get group(): CollapsibleGroupContextValue | null {
    return this.#group.value ?? null;
  }

  /** Whether the group (not the host's own `open`) decides this item's state. */
  get isGroupControlled(): boolean {
    return (
      this.group !== null && this.#options.value?.() !== undefined && this.#options.value() !== ''
    );
  }

  /** The open state that applies now. */
  get isOpen(): boolean {
    const value = this.#options.value?.();
    return this.group && this.isGroupControlled && value !== undefined
      ? this.group.isOpen(value)
      : this.#options.open();
  }

  /** Dividers, density and chevron position from the group (all "off" outside one). */
  get presentation(): {
    hasDividers: boolean;
    density: CollapsibleDensity | null;
    chevronPosition: CollapsibleChevronPosition | null;
  } {
    const group = this.group;
    return {
      hasDividers: group?.hasDividers ?? false,
      density: group?.density ?? null,
      chevronPosition: group?.chevronPosition ?? null,
    };
  }

  /** A user toggle (click, Enter, Space). */
  toggle(event?: Event): void {
    const value = this.#options.value?.();
    if (this.group && this.isGroupControlled && value !== undefined) {
      this.group.toggle(value, event);
      return;
    }
    const next = !this.#options.open();
    if (this.#options.requestChange(next, event)) this.#options.setOpen(next);
  }

  #lastGroup: CollapsibleGroupContextValue | null | undefined;

  hostUpdate(): void {
    const group = this.group;
    // Only when the group's value changed: every change re-renders every nested item.
    if (group === this.#lastGroup) return;
    this.#lastGroup = group;
    // Nested items keep the group's state but not its row chrome.
    this.#reset.setValue(
      group ? {...group, hasDividers: false, density: null, chevronPosition: null} : null,
    );
  }
}
