/** Height of a side navigation row (upstream `NavItemSize`): 28, 32 or 36 px. */
export const SIDE_NAV_ITEM_SIZES = ['sm', 'md', 'lg'] as const;
export type SideNavItemSize = (typeof SIDE_NAV_ITEM_SIZES)[number];

/**
 * How a side navigation is rendered right now (upstream `SideNavRenderMode`): `default` is the inline
 * panel, `drawer` the content of the mobile drawer, `topbar` a horizontal bar (heading and footer icons),
 * and `drawer-content` just the items, for a drawer that something else owns.
 */
export const SIDE_NAV_RENDER_MODES = ['default', 'topbar', 'drawer', 'drawer-content'] as const;
export type SideNavRenderMode = (typeof SIDE_NAV_RENDER_MODES)[number];

/** Width in px below which dragging the resize handle collapses a collapsible side navigation (upstream). */
export const SIDE_NAV_COLLAPSE_THRESHOLD = 160;
