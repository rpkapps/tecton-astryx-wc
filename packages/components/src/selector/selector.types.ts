/** Enumerations and option shapes shared by `tct-selector` and `tct-multi-selector`. */
import type {AdaptivePresentation} from '@tecton-wc/core/controllers/adaptive-presentation.js';
import type {IndicatorPosition} from '@tecton-wc/core/indicators/registry.js';
import type {Alignment, Placement} from '@tecton-wc/core/layer/position.js';

/** Trigger heights: `sm`, `md` and `lg`. */
export const SELECTOR_SIZES = ['sm', 'md', 'lg'] as const;
export type SelectorSize = (typeof SELECTOR_SIZES)[number];

/** `input` is the bordered form field; `ghost` is the borderless toolbar trigger. */
export const SELECTOR_VARIANTS = ['input', 'ghost'] as const;
export type SelectorVariant = (typeof SELECTOR_VARIANTS)[number];

/** How the option list appears: anchored to the trigger, as a bottom sheet, or by device (`adaptive`). */
export const SELECTOR_PRESENTATIONS = [
  'popover',
  'bottom-sheet',
  'adaptive',
] as const satisfies readonly AdaptivePresentation[];
export type SelectorPresentation = (typeof SELECTOR_PRESENTATIONS)[number];

/** Which edge of an option row carries the selection mark. */
export const SELECTOR_INDICATOR_POSITIONS = [
  'start',
  'end',
] as const satisfies readonly IndicatorPosition[];

/**
 * Where the popup sits relative to the trigger (logical: `start` and `end` follow the direction).
 * `overlay` (single selector without search) draws the popup over the trigger so the chosen option
 * lines up with it, clamped to the viewport.
 */
export const SELECTOR_PLACEMENTS = ['above', 'below', 'start', 'end', 'overlay'] as const;
export type SelectorPlacement = Placement | 'overlay';
export const SELECTOR_ALIGNMENTS = [
  'start',
  'center',
  'end',
] as const satisfies readonly Alignment[];

/**
 * The state of the option source, independent of `loading` (which is the value being resolved or saved):
 * `ready` (the options given are all there is), `loading` (still being fetched) or `error` (fetching
 * failed). Provided options stay selectable in every state; the state decides what an empty panel says.
 */
export const OPTIONS_STATES = ['ready', 'loading', 'error'] as const;
export type OptionsState = (typeof OPTIONS_STATES)[number];

/** How the label and description of an option sit together. */
export const SELECTOR_ROW_LAYOUTS = ['stacked', 'inline'] as const;
export type SelectorRowLayout = (typeof SELECTOR_ROW_LAYOUTS)[number];

/** One selectable option. */
export interface SelectorOptionData {
  /** The submitted value. */
  value: string;
  /** Text shown and matched by search and typeahead. Defaults to `value`. */
  label?: string;
  /** Secondary text under the label. */
  description?: string;
  disabled?: boolean;
  /** A registered icon name shown before the label. */
  icon?: string;
}

/** A divider between groups of options. */
export interface SelectorDivider {
  type: 'divider';
}

/** A titled group of options. */
export interface SelectorSection {
  type: 'section';
  title?: string;
  options: (string | SelectorOptionData)[];
}

/** What the `options` property accepts: a string, an option, a divider or a section. */
export type SelectorOptionType = string | SelectorOptionData | SelectorDivider | SelectorSection;

/** Renders an option's content for the list, or the closed trigger's value: a template, a node or text. */
export type SelectorRenderer = (option: SelectorOptionData) => unknown;
