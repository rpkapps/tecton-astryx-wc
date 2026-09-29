import {containsFlat} from '@tecton-astryx/core/utils/focus.js';

/**
 * What the menu machinery needs from a row: every menu item tag (`tct-dropdown-menu-item`, the
 * checkbox and radio items, the submenu row) implements it.
 */
export interface MenuItemElement extends HTMLElement {
  /** Disabled rows stay in the roving order (APG menus) but cannot be activated. */
  readonly disabled: boolean;
  /** The row's text for typeahead: the label, never the text of a nested flyout. */
  readonly menuLabel: string;
}

export const MENU_ITEM_TAG = 'tct-dropdown-menu-item';
export const MENU_CHECKBOX_ITEM_TAG = 'tct-dropdown-menu-checkbox-item';
export const MENU_RADIO_ITEM_TAG = 'tct-dropdown-menu-radio-item';
export const MENU_SUB_MENU_TAG = 'tct-dropdown-menu-sub-menu';
export const MENU_RADIO_GROUP_TAG = 'tct-dropdown-menu-radio-group';

/** Roles of an item, as upstream `MENU_ITEM_ROLES`. */
export const MENU_ITEM_ROLES: ReadonlySet<string> = new Set([
  'menuitem',
  'menuitemradio',
  'menuitemcheckbox',
]);

const ITEM_TAGS: ReadonlySet<string> = new Set([
  MENU_ITEM_TAG,
  MENU_CHECKBOX_ITEM_TAG,
  MENU_RADIO_ITEM_TAG,
  MENU_SUB_MENU_TAG,
]);

/** Elements that only group rows: their children are rows of the same level (data-mode sections, radio groups). */
const isGroup = (element: Element): boolean =>
  element.localName === MENU_RADIO_GROUP_TAG || element.hasAttribute('data-menu-group');

export const isMenuItem = (element: Element | null | undefined): element is MenuItemElement =>
  element !== null && element !== undefined && ITEM_TAGS.has(element.localName);

export const isSubMenu = (element: Element | null | undefined): boolean =>
  element?.localName === MENU_SUB_MENU_TAG;

/**
 * The rows of ONE menu level, in DOM order: the surface's children, looking through slots (compound
 * mode) and through row groups, never into a submenu (its rows belong to its own flyout). Works for
 * both content modes because it reads the flat tree: data-mode rows are shadow children of the surface,
 * compound rows are slotted light-DOM children.
 */
export function collectMenuItems(root: ParentNode | null | undefined): MenuItemElement[] {
  const found: MenuItemElement[] = [];
  const visit = (elements: Iterable<Element>): void => {
    for (const element of elements) {
      if (isMenuItem(element)) {
        found.push(element);
      } else if (element.localName === 'slot') {
        visit((element as HTMLSlotElement).assignedElements({flatten: true}));
      } else if (isGroup(element)) {
        visit(element.children);
      }
    }
  };
  if (root) visit(root.children);
  return found;
}

/** The row of `items` that `target` is, or is inside (flat tree). */
export function itemContaining(
  items: readonly MenuItemElement[],
  target: EventTarget | null,
): MenuItemElement | undefined {
  if (!(target instanceof Node)) return undefined;
  return items.find((item) => item === target || containsFlat(item, target));
}

/** Plain text of a `slot="label"` child, for typeahead and names. */
export function slottedLabelText(host: Element): string {
  const slotted = host.querySelector(':scope > [slot="label"]');
  return (slotted?.textContent ?? '').trim();
}
