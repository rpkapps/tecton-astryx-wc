/** `default`: standard text. `supporting`: smaller, secondary text for dense UIs (upstream `BreadcrumbsVariant`). */
export const BREADCRUMBS_VARIANTS = ['default', 'supporting'] as const;
export type BreadcrumbsVariant = (typeof BREADCRUMBS_VARIANTS)[number];

/** Size of the menu rows of a crumb menu (upstream `menuSize`); follows the variant when unset. */
export const BREADCRUMB_MENU_SIZES = ['sm', 'md', 'lg'] as const;
export type BreadcrumbMenuSize = (typeof BREADCRUMB_MENU_SIZES)[number];
