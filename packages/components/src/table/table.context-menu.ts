/**
 * Right-click actions of a table (upstream `tableContextMenu`): resolving the array-or-getter form and
 * turning the flat action list into menu rows with a divider between groups. The menu itself is one
 * shared `tct-context-menu` per table, opened at the pointer by `tct-table`; nothing is built per cell.
 */
import type {DropdownMenuOption} from '../dropdown-menu/dropdown-menu.types.js';
import type {TableContextAction, TableContextActions} from './table.types.js';

/**
 * Resolves a `contextMenuActions` value (array or getter) to a plain array. Use it to compose the
 * actions a previous plugin contributed, so you never branch on the two forms:
 *
 * ```ts
 * props.contextMenuActions = () => [...resolveContextActions(prior), ...mine];
 * ```
 */
export function resolveContextActions(
  actions: TableContextActions | undefined,
): TableContextAction[] {
  if (typeof actions === 'function') return actions();
  return actions ?? [];
}

/**
 * Converts the flat action list to menu rows: related actions cluster by `group` (first-seen order,
 * ungrouped actions last) with a divider between groups; a `checked` action shows a check icon in
 * place of its own.
 */
export function toMenuOptions(actions: readonly TableContextAction[]): DropdownMenuOption[] {
  const order: string[] = [];
  const buckets = new Map<string, TableContextAction[]>();
  for (const action of actions) {
    const key = action.group ?? '\u0000ungrouped';
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
      order.push(key);
    }
    bucket.push(action);
  }
  const options: DropdownMenuOption[] = [];
  order.forEach((key, index) => {
    if (index > 0) options.push({type: 'divider'});
    for (const action of buckets.get(key) ?? []) {
      options.push({
        id: action.id,
        label: action.label,
        icon: action.checked ? 'check' : action.icon,
        disabled: action.disabled,
        variant: action.variant,
        onClick: () => {
          action.onSelect();
        },
      });
    }
  });
  return options;
}
