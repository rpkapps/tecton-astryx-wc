/**
 * `TctElement`, the base class of every public element (A§9.1).
 *
 * ```ts
 * export class TctBadge extends TctElement {
 *   static override readonly tagName = 'tct-badge';
 *   static override styles: CSSResultGroup = [base, styles];
 *   @property({reflect: true}) variant: BadgeVariant = 'neutral';
 *   override render() { return html`<slot></slot>`; }
 * }
 * ```
 *
 * Rules: internals are attached in the constructor (exactly once, never call `attachInternals()`
 * yourself); set default semantics through `this.internals.role`/`aria*` (never a host `role`
 * attribute); no DOM reads in the constructor or `render()`.
 */
import {LitElement, type CSSResultGroup} from 'lit';
import {features} from './features.js';

export type TctElementConstructor = (new () => TctElement) & typeof TctElement;

/** A class constructor, for mixins (`Constructor<TctElement>`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the mixin constraint TypeScript requires
export type Constructor<T = object> = new (...args: any[]) => T;

// Replaced by the build (`define`); the dev/test fallback keeps duplicate-definition warnings useful.
declare const __TCT_VERSION__: string | undefined;

export abstract class TctElement extends LitElement {
  /** The tag this class is registered under by `defineElement()`. */
  static readonly tagName: string;
  /** Elements rendered in this class's shadow root; `defineElement` registers them first. */
  static readonly dependencies: readonly TctElementConstructor[] = [];
  /** Library version, injected at build; used in duplicate-definition warnings. */
  static readonly version: string =
    typeof __TCT_VERSION__ === 'string' ? __TCT_VERSION__ : '0.0.0-dev';

  static override shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    mode: 'open',
  };
  static override styles: CSSResultGroup = [];

  /** ElementInternals, attached in the constructor. Form-associated subclasses use the form APIs on it. */
  protected readonly internals: ElementInternals;

  constructor() {
    super();
    this.internals = this.attachInternals();
  }

  /** Dispatches a library event; returns `false` when a cancelable event was prevented. */
  protected dispatch(event: Event): boolean {
    return this.dispatchEvent(event);
  }

  /**
   * Feature-detected custom state toggle (`:state(name)`). A no-op without `CustomStateSet`, and
   * tolerant of engines that only accept dashed idents. Internal CSS never depends on it
   * (A§6.3), so a missing state degrades to "no consumer hook", never to a broken component.
   */
  protected toggleState(name: string, on: boolean): void {
    if (!features.customStates) return;
    try {
      const states = this.internals.states;
      if (on) states.add(name);
      else states.delete(name);
    } catch {
      // Chromium < 125 only accepts `--dashed` states; treat as unsupported.
    }
  }

  /** Whether the custom state is currently set (false without `CustomStateSet`). */
  protected hasState(name: string): boolean {
    if (!features.customStates) return false;
    try {
      return this.internals.states.has(name);
    } catch {
      return false;
    }
  }

  /**
   * `moveBefore()` calls this instead of disconnect + connect, so a moved element keeps its state,
   * focus and open layers. A no-op by default; override only if a move must re-measure something.
   */
  connectedMoveCallback(): void {
    // Intentionally empty: skipping teardown is the point (A§7.9).
  }
}
