import type {TemplateResult} from 'lit';

/** Row spacing: 4px, 8px or 12px of block padding. */
export const TREE_LIST_DENSITIES = ['compact', 'balanced', 'spacious'] as const;
export type TreeListDensity = (typeof TREE_LIST_DENSITIES)[number];

/**
 * Guide (connector) lines: `lineGuides` draws connectors between parent and child rows, `noGuides`
 * draws none and indentation alone conveys nesting. Orthogonal to `density`.
 */
export const TREE_LIST_VARIANTS = ['lineGuides', 'noGuides'] as const;
export type TreeListVariant = (typeof TREE_LIST_VARIANTS)[number];

/**
 * Content of a label or a start/end slot (upstream `ReactNode`): a Lit template, a DOM node (which can
 * be in one place only), or text. Strings render as text, never as HTML.
 */
export type TreeListContent = TemplateResult | Node | string | number | null | undefined;

/** One item of the tree, recursively (upstream `TreeListItemData`). */
export interface TreeListItemData {
  /** Unique identifier: keys the row, tracks expansion and focus, and is passed to `tct-tree-toggle`. */
  id: string;
  /** Primary text or content of the item. */
  label: TreeListContent;
  /** Secondary description text below the label. */
  description?: string;
  /** Content rendered before the label (an icon, an avatar, a colour tag). */
  startContent?: TreeListContent;
  /** Content rendered after the label (a badge, an action button). */
  endContent?: TreeListContent;
  /** Nested child items. When present the item renders an expand/collapse toggle. */
  children?: TreeListItemData[];
  /**
   * Shows the expand/collapse toggle although `children` is empty or absent, for children that load
   * lazily: listen for `tct-tree-toggle`, and assign `children` when `expanded` is `true`.
   */
  expandable?: boolean;
  /** Click handler: makes the row a button. Called for a click on the row and for Enter/Space. */
  onClick?: (event: MouseEvent) => void;
  /** URL: makes the row a link (an invisible anchor). Unsafe URLs render a destination-less anchor. */
  href?: string;
  /** Link target (for example `_blank`, which adds `noopener noreferrer`). Only used with `href`. */
  target?: string;
  /** Whether the item is disabled: skipped by arrow keys, `aria-disabled`. */
  isDisabled?: boolean;
  /** Whether the item is selected: `aria-selected` and the selected look. */
  isSelected?: boolean;
  /** Whether the item starts expanded. Only meaningful for an item with children. */
  isExpanded?: boolean;
  /** Inline styles applied to the item's row element (custom properties included), as a name-value map. */
  style?: Readonly<Record<string, string>>;
  /** Extra `part` tokens on the item's row element, so a consumer can target one row with `::part()`. */
  part?: string;
}
