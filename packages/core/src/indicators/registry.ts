/**
 * Indicators (A§9.18, WP-5): port of upstream `Indicator/{types,indicatorRegistry,useIndicator,
 * indicator.markers.stylex}` (MIT, Meta Platforms).
 *
 * An **indicator** is a decorative visual that turns a piece of state into a picture: the box a
 * checkbox draws, the circle a radio draws, the mark on a chosen list option. The owning component
 * keeps the input, role, accessible name, focus and keyboard behaviour. Indicators are `aria-hidden`
 * and own no interaction; components render them **through this registry**, by name, so a theme can
 * replace one and every component that renders it follows (upstream `defineTheme({indicators})`).
 *
 * Web Components re-expression:
 *  - a "component" is a **tag name**: `defaultIndicators` maps `check | checkbox | radio` to
 *    `tct-check-indicator`, `tct-checkbox-indicator` and `tct-radio-indicator`;
 *  - `defineIndicators(overrides, theme?)` registers replacements per theme name (the name a
 *    `tct-theme` provides through `themeContext`); `getIndicator(name, theme?)` resolves one
 *    (`useIndicator` upstream is {@link IndicatorController}, which follows the nearest theme);
 *  - an override must be a tag whose element accepts the indicator contract: `state`, `size`,
 *    `disabled` attributes/properties and default-slot content that replaces the mark;
 *  - `indicatorScope` (upstream `stylex.defineMarker()`) is a CSS module: an owner puts the class
 *    `indicator-scope` on the element whose hover should tint its indicator. It publishes the
 *    inherited private property `--_indicator-hover: 1`, which the indicators read across the shadow
 *    boundary (custom properties inherit; ancestors cannot be matched across it). Owners that should
 *    not tint (decorative menu markers, listbox options) simply do not add the class, and add it only
 *    while enabled so disabled controls get no hover feedback.
 *
 * ```ts
 * import {indicatorScope, IndicatorController} from '@tecton-astryx/core/indicators/registry.js';
 * static override styles = [base, indicatorScope, styles];
 * #indicator = new IndicatorController(this, 'checkbox');   // .tag === 'tct-checkbox-indicator'
 * ```
 * Guides: [mwg:styling-web-components] (inherited custom properties cross the shadow boundary)
 */
import {css, type CSSResult, type ReactiveController, type ReactiveControllerHost} from 'lit';
import {themeContext} from '../context/keys.js';
import {ContextConsumer} from '../context/protocol.js';

/** The families of indicators, each mapped to the states it can express. */
export interface IndicatorFamilyMap {
  /** Is this one thing chosen? Radios, and the mark on a selected option. */
  singleSelection: 'unchecked' | 'checked';
  /** Which of these are chosen? Checkboxes, including the partial state. */
  multiSelection: 'unchecked' | 'checked' | 'indeterminate';
}

export type IndicatorFamily = Extract<keyof IndicatorFamilyMap, string>;

/** The states an indicator of family `F` can be asked to draw. */
export type IndicatorState<F extends IndicatorFamily = IndicatorFamily> = IndicatorFamilyMap[F];

/** Indicator size scale, matching the control sizes of the owning inputs. */
export type IndicatorSize = 'sm' | 'md';

/**
 * Which edge of its row an indicator sits on. Logical: `start` is the left edge in LTR. Owned by the
 * host component that lays out rows, not by the indicator.
 */
export type IndicatorPosition = 'start' | 'end';

/** The named indicators a theme can replace, each mapped to its family. Open to augmentation. */
export interface IndicatorMap {
  /** The mark on a chosen option: a checkmark by default. */
  check: 'singleSelection';
  /** The filled circle of a radio control. */
  radio: 'singleSelection';
  /** The box of a checkbox control, including its partial state. */
  checkbox: 'multiSelection';
}

export type IndicatorName = Extract<keyof IndicatorMap, string>;

/** The indicator names Astryx ships a default for; exactly the keys of {@link defaultIndicators}. */
export type CoreIndicatorName = 'check' | 'checkbox' | 'radio';

/** The indicators the library ships (name to tag). A theme's entries override these by name. */
export const defaultIndicators: Readonly<Record<CoreIndicatorName, string>> = {
  check: 'tct-check-indicator',
  checkbox: 'tct-checkbox-indicator',
  radio: 'tct-radio-indicator',
};

/** Theme-provided indicator overrides, keyed by indicator name. */
export type IndicatorOverrides = Partial<Record<IndicatorName, string>>;

/** The theme a `tct-theme` provides when nothing names one. */
export const DEFAULT_INDICATOR_THEME = 'tecton';

const TAG_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/;

const themeOverrides = new Map<string, IndicatorOverrides>();

/**
 * Registers indicator replacements for a theme (upstream `defineTheme({indicators})`). Later calls
 * for the same theme merge over earlier ones. Values must be custom element tag names.
 */
export function defineIndicators(
  overrides: IndicatorOverrides,
  theme: string = DEFAULT_INDICATOR_THEME,
): void {
  const next = {...themeOverrides.get(theme)};
  for (const [name, tag] of Object.entries(overrides) as [IndicatorName, string | undefined][]) {
    if (tag === undefined) continue;
    if (!TAG_NAME.test(tag)) {
      throw new TypeError(
        `defineIndicators: "${tag}" for "${name}" is not a custom element tag name.`,
      );
    }
    next[name] = tag;
  }
  themeOverrides.set(theme, next);
}

/** Forgets every registered override (tests, HMR). */
export function resetIndicators(): void {
  themeOverrides.clear();
}

/**
 * Resolves an indicator tag by name, preferring the theme's override and falling back to the built-in
 * indicator. A core name always resolves; a name contributed by augmentation resolves only when a
 * theme supplies it (the package that adds a name owns its default: `getIndicator('brand-star') ?? 'brand-star'`).
 */
export function getIndicator<N extends CoreIndicatorName>(name: N, theme?: string | null): string;
export function getIndicator(name: IndicatorName, theme?: string | null): string | undefined;
export function getIndicator(name: IndicatorName, theme?: string | null): string | undefined {
  const override = themeOverrides.get(theme ?? DEFAULT_INDICATOR_THEME)?.[name];
  return override ?? (defaultIndicators as Partial<Record<IndicatorName, string>>)[name];
}

/**
 * Resolves an indicator tag for the host from the nearest `tct-theme` (upstream `useIndicator`).
 * Re-renders the host when the theme changes.
 */
export class IndicatorController implements ReactiveController {
  readonly #name: IndicatorName;
  readonly #theme: ContextConsumer<typeof themeContext>;

  constructor(host: ReactiveControllerHost & HTMLElement, name: IndicatorName) {
    this.#name = name;
    this.#theme = new ContextConsumer(host, {context: themeContext, subscribe: true});
    host.addController(this);
  }

  /** The tag to render; `undefined` only for an augmented name no theme supplies. */
  get tag(): string | undefined {
    return getIndicator(this.#name, this.#theme.value?.name);
  }

  hostConnected(): void {
    // Nothing to do: the theme is read lazily through the context consumer.
  }
}

/**
 * The ancestor marker as CSS (upstream `indicatorScope`). Add it to the owner's `static styles` and put
 * `class="indicator-scope"` on the element whose hover tints the indicator. Layers follow the
 * component contract (`state`).
 */
export const indicatorScope: CSSResult = css`
  @layer state {
    @media (hover: hover) {
      .indicator-scope:hover {
        --_indicator-hover: 1;
      }
    }
  }
`;
