import type {TemplateResult} from 'lit';
import type {AdaptivePresentation} from '@tecton-astryx/core/controllers/adaptive-presentation.js';
import type {ElementSize} from '@tecton-astryx/core/context/keys.js';

export {
  POPOVER_ALIGNMENTS as MENU_ALIGNMENTS,
  POPOVER_PLACEMENTS as MENU_PLACEMENTS,
  type PopoverAlignment as MenuAlignment,
  type PopoverPlacement as MenuPlacement,
} from '../popover/popover.types.js';

/** Item size, derived from the trigger button size (upstream `DropdownMenuSize`). */
export const MENU_SIZES = ['sm', 'md', 'lg'] as const satisfies readonly ElementSize[];
export type MenuSize = (typeof MENU_SIZES)[number];

/** How a data-driven menu is presented: anchored, as a bottom sheet, or by device. */
export const MENU_PRESENTATIONS = [
  'popover',
  'bottom-sheet',
  'adaptive',
] as const satisfies readonly AdaptivePresentation[];
export type MenuPresentation = (typeof MENU_PRESENTATIONS)[number];

/** `destructive` paints the row in the error colour for dangerous actions (Delete). */
export const MENU_ITEM_VARIANTS = ['default', 'destructive'] as const;
export type MenuItemVariant = (typeof MENU_ITEM_VARIANTS)[number];

/**
 * Content of a label or an end slot in data mode (upstream `ReactNode`): a Lit template, a DOM node
 * (which can be in one place only), or text. Strings render as text, never as HTML.
 */
export type MenuContent = TemplateResult | Node | string | number | null | undefined;

/** Data-mode shape of one menu row (upstream `DropdownMenuItemData`). */
export interface DropdownMenuItemData {
  /**
   * Stable identity of the row. Omit it and the row is keyed by position, which is right for a fixed
   * menu; set it when `items` can reorder, filter or grow, so a row keeps its element (and keyboard
   * focus) as the array changes around it.
   */
  id?: string;
  /** Primary label: text, or a template for rich content. */
  label: MenuContent;
  /** Registered icon name shown before the label. */
  icon?: string;
  /** Secondary text below the label. */
  description?: string;
  /** Trailing content: a keyboard-shortcut hint, a badge. */
  endContent?: MenuContent;
  /** `destructive` renders the row in the error colour. */
  variant?: MenuItemVariant;
  /** Disabled rows stay focusable (they are announced as unavailable) but cannot be activated. */
  disabled?: boolean;
  /** Set `false` to keep the menu open after activation (a row that reports its result on itself). Default `true`. */
  closeOnSelect?: boolean;
  /** Called when the row is activated (click, Enter or Space). */
  onClick?: (event: Event) => void;
  /** Nested entries. A row with `items` becomes a submenu: a flyout on a pointer, a drill-in view in a bottom sheet. */
  items?: DropdownMenuOption[];
  /** Shows a spinner in place of the caret of a submenu row (lazy submenu). */
  hasSpinner?: boolean;
}

/** Data-mode divider row. */
export interface DropdownMenuDividerData {
  type: 'divider';
}

/** Data-mode group: an optional heading and a set of action rows. */
export interface DropdownMenuSection {
  type: 'section';
  /** Stable identity of the group, see {@link DropdownMenuItemData.id}. */
  id?: string;
  title?: string;
  items: DropdownMenuItemData[];
}

export type DropdownMenuOption =
  DropdownMenuItemData | DropdownMenuDividerData | DropdownMenuSection;

export const isDividerOption = (option: DropdownMenuOption): option is DropdownMenuDividerData =>
  'type' in option && option.type === 'divider';
export const isSectionOption = (option: DropdownMenuOption): option is DropdownMenuSection =>
  'type' in option && option.type === 'section';
export const isItemOption = (option: DropdownMenuOption): option is DropdownMenuItemData =>
  !('type' in option);

const INTRINSIC_AND_CSS_WIDE_WIDTHS = new Set([
  'auto',
  'contain',
  'fit-content',
  'inherit',
  'initial',
  'max-content',
  'min-content',
  'revert',
  'revert-layer',
  'stretch',
  'unset',
]);

/** Where a `menu-width` value goes: the preferred inline size, or the minimum the menu may grow from. */
export type ResolvedMenuWidth =
  {property: 'inline-size'; value: string} | {property: 'min-inline-size'; value: string};

/**
 * Upstream `resolveMenuWidth`. CSS intrinsic and CSS-wide keywords cannot be arguments to `min()`, so
 * they become the preferred inline size and the viewport cap still limits them. A bare number is px.
 * Lengths keep the minimum-width growth contract, capped by `maximum`.
 */
export function resolveMenuWidth(
  menuWidth: number | string,
  maximum: string,
): ResolvedMenuWidth | null {
  const raw = typeof menuWidth === 'number' ? `${menuWidth}px` : menuWidth.trim();
  if (raw === '') return null;
  const width = /^\d+(\.\d+)?$/.test(raw) ? `${raw}px` : raw;
  const keyword = width.toLowerCase();
  if (INTRINSIC_AND_CSS_WIDE_WIDTHS.has(keyword) || keyword.startsWith('fit-content(')) {
    return {property: 'inline-size', value: width};
  }
  return {property: 'min-inline-size', value: `min(${width}, ${maximum})`};
}
