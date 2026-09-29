/**
 * How a top navigation is rendered right now (upstream `TopNavRenderMode`): `default` is the full bar,
 * `mobile-bar` a simplified bar (heading, end content, the drawer toggle) below the mobile breakpoint of
 * an app shell, and `drawer` the items as a vertical list in the mobile drawer.
 */
export const TOP_NAV_RENDER_MODES = ['default', 'mobile-bar', 'drawer'] as const;
export type TopNavRenderMode = (typeof TOP_NAV_RENDER_MODES)[number];

/** The region of the bar an element sits in: where the panel of a menu aligns to. */
export type TopNavSlot = 'start' | 'center' | 'end';

/** One item of a `tct-top-nav-menu` given as data (upstream `TopNavMenuItemData`). */
export interface TopNavMenuItemData {
  /** Display title. */
  title: string;
  /** Description below the title. */
  description?: string;
  /** Registered icon name. */
  icon?: string;
  /** Destination. Without it the item is a button. */
  href?: string;
  /** Called when the item is chosen. */
  onClick?: () => void;
}

/**
 * The region of the bar `element` sits in (`start`, `center` or `end`): the `slot` of its ancestor that
 * is a child of the top navigation. The default slot is the start region.
 */
export function topNavSlotOf(element: Element): TopNavSlot {
  let current: Element | null = element;
  while (current?.parentElement && current.parentElement.localName !== 'tct-top-nav') {
    current = current.parentElement;
  }
  const slot = current?.parentElement ? current.getAttribute('slot') : null;
  return slot === 'center' || slot === 'end' ? slot : 'start';
}
