import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {
  ContextConsumer,
  createContext,
  type ContextType,
  type UnknownContext,
} from '@tecton-astryx/core/context/protocol.js';
import type {AvatarShape, AvatarSize} from './avatar.types.js';

/**
 * Provided by `tct-avatar` to its status content (family-private coupling, like upstream's
 * `AvatarSizeContext` and `AvatarStatusLabelContext` in one): the resolved pixel size, and the way a
 * status element hands its accessible label to the avatar, which composes it into its own name
 * ("Jane Doe, Online"). Reporting goes through context, so it works at any depth in the status slot.
 */
export interface AvatarContextValue {
  /** Resolved avatar size in CSS px. */
  size: number;
  /** A status element reports (or, with `undefined`, withdraws) its label. */
  reportStatusLabel(source: Element, label: string | undefined): void;
}

export const avatarContext = createContext<AvatarContextValue | null, symbol>(
  Symbol.for('tct.avatar'),
);

/** Provided by `tct-avatar-group` to its avatars and overflow indicator (upstream `AvatarGroupContext`). */
export interface AvatarGroupContextValue {
  size: AvatarSize;
  shape: AvatarShape;
  /** Overlap between neighbours in px (a quarter of the avatar size). */
  overlap: number;
  numericSize: number;
  /**
   * Members call this after they render so the group re-reads which of them are interactive (its single
   * tab stop and the screen-reader hint depend on it).
   */
  refresh(): void;
}

export const avatarGroupContext = createContext<AvatarGroupContextValue | null, symbol>(
  Symbol.for('tct.avatar-group'),
);

/**
 * A context consumer that forgets its value when the host disconnects. `ContextConsumer` keeps the last
 * value it received, so an element moved out of its provider (an avatar taken out of a group) would keep
 * acting on the old one; on reconnect a provider, if there is one, answers again.
 */
export class TrackedContext<C extends UnknownContext> implements ReactiveController {
  #value: ContextType<C> | undefined;

  constructor(host: ReactiveControllerHost & HTMLElement, context: C) {
    new ContextConsumer(host, {
      context,
      subscribe: true,
      callback: (value) => {
        this.#value = value;
      },
    });
    host.addController(this);
  }

  /** The latest value from the nearest provider, or `undefined` when there is none. */
  get value(): ContextType<C> | undefined {
    return this.#value;
  }

  hostDisconnected(): void {
    this.#value = undefined;
  }
}
