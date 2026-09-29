/** Logical axis (or both) where native scrolling is allowed: `inline` follows the text direction, `block` the flow. */
export const SCROLL_AXES = ['inline', 'block', 'both'] as const;
export type ScrollableAxis = (typeof SCROLL_AXES)[number];

/** Whether effective axes pass scroll gestures to ancestors at an edge (`allow`) or keep them (`contain`). */
export const SCROLL_OVERSCROLLS = ['allow', 'contain'] as const;
export type ScrollableOverscroll = (typeof SCROLL_OVERSCROLLS)[number];

/** Whether a fitting viewport remains a sticky boundary: `when-scrollable` (default) or `always`. */
export const SCROLL_STICKY_CONTAINMENTS = ['when-scrollable', 'always'] as const;
export type ScrollableStickyContainment = (typeof SCROLL_STICKY_CONTAINMENTS)[number];

/** Semantics of the named viewport. */
export const SCROLL_VIEWPORT_ROLES = ['group', 'region'] as const;
export type ScrollableViewportRole = (typeof SCROLL_VIEWPORT_ROLES)[number];

/**
 * Who owns keyboard access to the scroller: the `viewport` (default: a named tab stop while it scrolls),
 * the `content` (it brings its own tab stops) or `content-or-viewport` (a named tab stop, but a forward
 * Tab lands on the first link or button inside).
 */
export const SCROLL_KEYBOARD_OWNERS = ['viewport', 'content', 'content-or-viewport'] as const;
export type ScrollableKeyboardOwner = (typeof SCROLL_KEYBOARD_OWNERS)[number];
