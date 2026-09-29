/** Size of the tab hover targets (upstream `TabListSize`); the element-size tokens of Button and TextInput. */
export const TAB_LIST_SIZES = ['sm', 'md', 'lg'] as const;
export type TabListSize = (typeof TAB_LIST_SIZES)[number];

/** `hug`: each tab hugs its content. `fill`: tabs share the strip equally. */
export const TAB_LIST_LAYOUTS = ['hug', 'fill'] as const;
export type TabListLayout = (typeof TAB_LIST_LAYOUTS)[number];

/**
 * The ARIA pattern a strip speaks (upstream `TabListPattern`).
 * `nav`: a `<nav>` landmark; the current tab carries `aria-current`.
 * `tabs`: the WAI-ARIA tabs pattern (`tablist` / `tab` / `aria-selected` / `aria-controls`).
 */
export const TAB_LIST_PATTERNS = ['nav', 'tabs'] as const;
export type TabListPattern = (typeof TAB_LIST_PATTERNS)[number];

/**
 * What happens when the tabs are wider than the strip (upstream `TabListOverflow`).
 * `auto` lets the component choose (it scrolls); `scroll` scrolls with edge fades and, for pointers that
 * hover, arrow affordances; `visible` turns overflow handling off.
 */
export const TAB_LIST_OVERFLOWS = ['auto', 'scroll', 'visible'] as const;
export type TabListOverflow = (typeof TAB_LIST_OVERFLOWS)[number];

/** Only `inline` exists (upstream `edgeCompensation`). */
export const TAB_LIST_EDGE_COMPENSATIONS = ['inline'] as const;
export type TabListEdgeCompensation = (typeof TAB_LIST_EDGE_COMPENSATIONS)[number];

/**
 * How arrow keys select in the tabs pattern (APG). `automatic`: focus and selection move together.
 * `manual`: arrows move focus only; Enter or Space selects. The navigation pattern is always manual.
 */
export const TAB_LIST_ACTIVATIONS = ['automatic', 'manual'] as const;
export type TabListActivation = (typeof TAB_LIST_ACTIVATIONS)[number];

/** One option of a `tct-tab-menu` (upstream `TabMenuOption`). */
export interface TabMenuOption {
  /** The tab value this option selects. */
  value: string;
  /** Text of the option. */
  label: string;
  /** Registered icon name shown before the label. */
  icon?: string;
}
