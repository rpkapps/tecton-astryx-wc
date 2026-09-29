/** Size of the menu: its minimum width (160, 200, 240) and the padding of its items (upstream `NavHeadingMenuSize`). */
export const NAV_HEADING_MENU_SIZES = ['sm', 'md', 'lg'] as const;
export type NavHeadingMenuSize = (typeof NAV_HEADING_MENU_SIZES)[number];
