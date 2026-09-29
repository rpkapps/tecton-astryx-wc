/**
 * Which surface collects a date or time (upstream `utils/inputPresentation.ts`, MIT, adapted): the
 * anchored popover, the bottom sheet, the browser's own picker (`<input type="date|time">`), or, for a
 * time, the typed field alone. One vocabulary for `tct-date-input`, `tct-date-time-input` and
 * `tct-time-input`.
 *
 *  - `popover`, `bottom-sheet` and `native` are fixed on every device.
 *  - `adaptive-bottom-sheet` is the popover on a wide viewport and the bottom sheet on a compact touch
 *    device (the query the whole library uses for adaptive surfaces: a narrow viewport with a coarse
 *    primary pointer, so a desktop window narrowed to phone width is still a mouse and keeps its popover).
 *  - `adaptive-native` (the default) is the popover with a fine pointer and the browser's picker with a
 *    coarse one, keeping the library's own field where a native control cannot express the value.
 *  - `text-input` (time only) is the typed field with no picker.
 *
 * The deprecated `native-picker` maps to the same surfaces: `touch` is `adaptive-native`, `always` is
 * `native`, `never` is `adaptive-bottom-sheet` (`text-input` for a time). `presentation` wins when both
 * are set. The pointer is read live: a tablet docked to a mouse switches surface without a reload.
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import {COMPACT_TOUCH_PRESENTATION_QUERY} from '@tecton-wc/core/controllers/adaptive-presentation.js';
import {MediaQueryController} from '@tecton-wc/core/controllers/media-query.js';

/** Surface policies of a date or a date-time field. */
export const PICKER_PRESENTATIONS = [
  'popover',
  'bottom-sheet',
  'native',
  'adaptive-bottom-sheet',
  'adaptive-native',
] as const;
export type PickerPresentation = (typeof PICKER_PRESENTATIONS)[number];

/** Surface policies of a time field: the picker policies plus the typed field alone. */
export const TIME_PRESENTATIONS = ['text-input', ...PICKER_PRESENTATIONS] as const;
export type TimePresentation = (typeof TIME_PRESENTATIONS)[number];

/** The deprecated picker policy. */
export const LEGACY_NATIVE_PICKERS = ['touch', 'always', 'never'] as const;
export type LegacyNativePicker = (typeof LEGACY_NATIVE_PICKERS)[number];

/** What a policy resolves to right now. */
export type PickerSurface = 'popover' | 'sheet' | 'native' | 'text-input';

export const DEFAULT_PRESENTATION: PickerPresentation = 'adaptive-native';

/** A coarse primary pointer: a finger. A touchscreen laptop reports its trackpad, a fine pointer. */
export const COARSE_POINTER_QUERY = '(pointer: coarse)';

/** The deprecated `native-picker` as a `presentation` (a time's `never` is the typed field). */
export function presentationFromNativePicker(
  nativePicker: LegacyNativePicker,
  component: 'date' | 'time',
): TimePresentation {
  if (nativePicker === 'always') return 'native';
  if (nativePicker === 'never')
    return component === 'time' ? 'text-input' : 'adaptive-bottom-sheet';
  return 'adaptive-native';
}

/** The effective policy: an explicit `presentation` wins over the deprecated `native-picker`. */
export function effectivePresentation(
  presentation: string | undefined,
  nativePicker: string | undefined,
  component: 'date' | 'time',
): TimePresentation {
  const valid: readonly string[] = component === 'time' ? TIME_PRESENTATIONS : PICKER_PRESENTATIONS;
  if (presentation !== undefined && valid.includes(presentation))
    return presentation as TimePresentation;
  if (
    nativePicker !== undefined &&
    (LEGACY_NATIVE_PICKERS as readonly string[]).includes(nativePicker)
  ) {
    return presentationFromNativePicker(nativePicker as LegacyNativePicker, component);
  }
  return DEFAULT_PRESENTATION;
}

/** Resolves a policy against the device. `popover` on a time field is the typed field (no popover exists for a time). */
export function resolveSurface(
  presentation: TimePresentation,
  device: {coarsePointer: boolean; compactTouch: boolean},
  component: 'date' | 'time' = 'date',
): PickerSurface {
  switch (presentation) {
    case 'text-input':
      return 'text-input';
    case 'popover':
      return component === 'time' ? 'text-input' : 'popover';
    case 'bottom-sheet':
      return 'sheet';
    case 'native':
      return 'native';
    case 'adaptive-bottom-sheet':
      if (device.compactTouch) return 'sheet';
      return component === 'time' ? 'text-input' : 'popover';
    case 'adaptive-native':
      if (device.coarsePointer) return 'native';
      return component === 'time' ? 'text-input' : 'popover';
  }
}

/** Follows the pointer and the viewport, and re-renders the host when the surface changes. */
export class PickerPresentationController implements ReactiveController {
  readonly #policy: () => TimePresentation;
  readonly #component: () => 'date' | 'time';
  readonly #coarse: MediaQueryController;
  readonly #compact: MediaQueryController;

  constructor(
    host: ReactiveControllerHost,
    policy: () => TimePresentation,
    component: () => 'date' | 'time',
  ) {
    this.#policy = policy;
    this.#component = component;
    this.#coarse = new MediaQueryController(host, COARSE_POINTER_QUERY);
    this.#compact = new MediaQueryController(host, COMPACT_TOUCH_PRESENTATION_QUERY);
    host.addController(this);
  }

  hostConnected(): void {
    // The media query controllers subscribe on their own.
  }

  /** The surface to render now (the popover / typed field until the host connects: a server cannot know). */
  get surface(): PickerSurface {
    return resolveSurface(
      this.#policy(),
      {coarsePointer: this.#coarse.matches, compactTouch: this.#compact.matches},
      this.#component(),
    );
  }
}
