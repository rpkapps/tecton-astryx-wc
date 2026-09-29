/**
 * Adaptive presentation (A§9, upstream `useAdaptivePresentation` and the popover / bottom-sheet
 * policy of `utils/inputPresentation`). A component that can appear either anchored to its trigger
 * (`popover`) or as a bottom sheet asks this controller which one to mount.
 *
 * - `popover` and `bottom-sheet` are fixed.
 * - `adaptive` is a bottom sheet on a compact touch device and a popover everywhere else. "Compact
 *   touch" is `(max-width: 768px) and (pointer: coarse)`: the width keeps desktop-class tablets and
 *   large touch displays anchored, and the pointer capability (rather than `hover: none`) does not
 *   exclude touch browsers that also report hover. The query is evaluated live, so rotating a phone
 *   or attaching a mouse switches the presentation without reloading.
 *
 * `resolved` is `popover` until the host connects (a server cannot know), so first paint never
 * depends on it. Pure behaviour: the host re-renders when the answer changes.
 *
 * ```ts
 * readonly #presentation = new AdaptivePresentationController(this, () => this.presentation);
 * render() {
 *   return this.#presentation.resolved === 'bottom-sheet' ? html`<tct-bottom-sheet>` : html`<tct-popover>`;
 * }
 * ```
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {MediaQueryController} from './media-query.js';

/** The policy a component exposes. */
export type AdaptivePresentation = 'popover' | 'bottom-sheet' | 'adaptive';

/** What a policy resolves to for the current device. */
export type ResolvedAdaptivePresentation = Exclude<AdaptivePresentation, 'adaptive'>;

/** Compact touch: narrow viewport with a coarse primary pointer. */
export const COMPACT_TOUCH_PRESENTATION_QUERY = '(max-width: 768px) and (pointer: coarse)';

/** The valid policy values, for attribute validation. */
export const ADAPTIVE_PRESENTATIONS: readonly AdaptivePresentation[] = [
  'popover',
  'bottom-sheet',
  'adaptive',
];

/** Pure resolution of a policy against a media-query answer. */
export function resolveAdaptivePresentation(
  presentation: AdaptivePresentation,
  isCompactTouch: boolean,
): ResolvedAdaptivePresentation {
  if (presentation === 'adaptive') return isCompactTouch ? 'bottom-sheet' : 'popover';
  return presentation === 'bottom-sheet' ? 'bottom-sheet' : 'popover';
}

export class AdaptivePresentationController implements ReactiveController {
  readonly #policy: () => AdaptivePresentation;
  readonly #query: MediaQueryController;

  constructor(host: ReactiveControllerHost, policy: () => AdaptivePresentation) {
    this.#policy = policy;
    this.#query = new MediaQueryController(host, COMPACT_TOUCH_PRESENTATION_QUERY);
    host.addController(this);
  }

  /** The policy as the host currently states it. */
  get presentation(): AdaptivePresentation {
    return this.#policy();
  }

  /** The presentation to render right now. */
  get resolved(): ResolvedAdaptivePresentation {
    return resolveAdaptivePresentation(this.#policy(), this.#query.matches);
  }

  /** Whether the device is currently compact touch (regardless of the policy). */
  get isCompactTouch(): boolean {
    return this.#query.matches;
  }

  hostConnected(): void {
    // The MediaQueryController subscribes on its own; nothing else to do.
  }
}
