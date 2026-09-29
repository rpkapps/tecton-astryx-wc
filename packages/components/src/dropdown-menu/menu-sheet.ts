import {html, nothing, type TemplateResult} from 'lit';
import {ifDefined} from 'lit/directives/if-defined.js';
import {repeat} from 'lit/directives/repeat.js';
import {
  isDividerOption,
  isSectionOption,
  type DropdownMenuItemData,
  type DropdownMenuOption,
} from './dropdown-menu.types.js';
import {labelText} from './menu-data.js';

/**
 * The touch presentation of a data-driven menu (upstream `MenuBottomSheetActionList` and the sheet
 * header): the same `items` as spacious pressable list rows inside a bottom sheet, with a heading that
 * names the current view and, after drilling into a submenu row, a Back button. Shared by
 * `tct-dropdown-menu` and `tct-context-menu`, which own the drill-in path and the open state.
 */

export interface SheetViewOptions {
  /** Title of the current view: the trigger label, or the submenu row that was drilled into. */
  title: string;
  /** The rows of the current view. */
  items: readonly DropdownMenuOption[];
  /** Whether a submenu was drilled into (shows the Back button). */
  canGoBack: boolean;
  backLabel: string;
  onBack: () => void;
  onSelect: (item: DropdownMenuItemData, event: Event) => void;
  onOpenSubmenu: (item: DropdownMenuItemData) => void;
}

function itemKey(item: DropdownMenuItemData, index: number): string {
  return `item-${item.id ?? index}`;
}

function renderRow(item: DropdownMenuItemData, options: SheetViewOptions): TemplateResult {
  const isSubmenu = item.items !== undefined && item.items.length > 0;
  const destructive = item.variant === 'destructive';
  const richLabel =
    typeof item.label === 'string' || typeof item.label === 'number'
      ? nothing
      : html`<span slot="label">${item.label}</span>`;
  const end = isSubmenu
    ? html`<tct-icon slot="end" name="chevronRight" size="sm" color="secondary"></tct-icon>`
    : item.endContent === undefined || item.endContent === null
      ? nothing
      : html`<span slot="end">${item.endContent}</span>`;
  return html`<tct-list-item
    class="sheet-row"
    pressable
    ?data-destructive=${destructive}
    label=${labelText(item.label)}
    description=${ifDefined(item.description)}
    ?disabled=${item.disabled === true}
    @click=${(event: Event) => {
      if (isSubmenu) options.onOpenSubmenu(item);
      else options.onSelect(item, event);
    }}
  >
    ${
      item.icon
        ? html`<tct-icon
            slot="start"
            name=${item.icon}
            size="sm"
            color=${destructive ? 'error' : 'secondary'}
          ></tct-icon>`
        : nothing
    }
    ${richLabel}${end}
  </tct-list-item>`;
}

function renderList(
  rows: readonly DropdownMenuOption[],
  options: SheetViewOptions,
): TemplateResult {
  return html`<tct-list density="spacious">
    ${repeat(
      rows.map((option, index) => ({option, index})),
      ({option, index}) =>
        isDividerOption(option)
          ? `divider-${index}`
          : isSectionOption(option)
            ? `section-${option.id ?? index}`
            : itemKey(option, index),
      ({option}) => {
        if (isDividerOption(option)) {
          return html`<div role="presentation" class="sheet-structure">
            <tct-divider class="sheet-divider"></tct-divider>
          </div>`;
        }
        if (isSectionOption(option)) {
          return html`<div role="presentation" class="sheet-structure">
            <div class="sheet-section" role="group" aria-label=${ifDefined(option.title)}>
              ${option.title ? html`<tct-heading level="4">${option.title}</tct-heading>` : nothing}
              ${renderList(option.items, options)}
            </div>
          </div>`;
        }
        return renderRow(option, options);
      },
    )}
  </tct-list>`;
}

/** The body of the sheet: heading row, then the list of the current view. */
export function renderSheetView(options: SheetViewOptions): TemplateResult {
  return html`<div class="sheet-content" part="sheet-content">
    <div class="sheet-header">
      ${
        options.canGoBack
          ? html`<tct-icon-button
              class="sheet-back"
              variant="ghost"
              size="sm"
              icon="chevronLeft"
              label=${options.backLabel}
              @click=${options.onBack}
            ></tct-icon-button>`
          : nothing
      }
      <tct-heading
        class="sheet-heading"
        level="3"
        tabindex="-1"
        data-root=${options.canGoBack ? nothing : ''}
        >${options.title}</tct-heading
      >
    </div>
    ${renderList(options.items, options)}
  </div>`;
}
