/** Vertical alignment of the start and end content against the label block (upstream `align`). */
export const ITEM_ALIGNMENTS = ['center', 'start'] as const;
export type ItemAlignment = (typeof ITEM_ALIGNMENTS)[number];

/** Row spacing: 4px, 8px or 12px of block padding (12px of inline padding too for `spacious`). */
export const ITEM_DENSITIES = ['compact', 'balanced', 'spacious'] as const;
export type ItemDensity = (typeof ITEM_DENSITIES)[number];

/** `stacked` puts the description on its own line; `inline` keeps both on one line. */
export const ITEM_LAYOUTS = ['stacked', 'inline'] as const;
export type ItemLayout = (typeof ITEM_LAYOUTS)[number];

/**
 * What the row is (upstream `as`). `li` gives the host the `listitem` role; `div` and `span` leave it
 * generic. There is no visual difference between the three.
 */
export const ITEM_ROOTS = ['div', 'li', 'span'] as const;
export type ItemRoot = (typeof ITEM_ROOTS)[number];

/** Link target allowed on an item. */
export type ItemTarget = '_blank' | '_self';

/**
 * What an item publishes to a control it renders in a slot (upstream `ItemDescriptionContext`). A
 * `for`/`aria-describedby` id cannot cross the item's shadow root, so the description is published as
 * its text, and as the element itself when the author slotted it (same tree as the slotted control).
 */
export interface ItemDescription {
  /** The description's text (attribute value, or the slotted description's text content). */
  readonly text: string;
  /** The slotted description element, when the description came from `slot="description"`. */
  readonly element: HTMLElement | null;
}
