import {html, nothing, type TemplateResult} from 'lit';
import {ifDefined} from 'lit/directives/if-defined.js';
import {repeat} from 'lit/directives/repeat.js';
import {
  isDividerOption,
  isSectionOption,
  type DropdownMenuItemData,
  type DropdownMenuOption,
  type MenuContent,
} from './dropdown-menu.types.js';

/**
 * Data mode (upstream `renderDropdownItems`): the `items` property becomes the same row elements
 * compound mode uses, so both modes share one keyboard path and one look. Rows are keyed by `id` when
 * given, else by position; a row that declares nested `items` becomes a submenu (the recursion lives
 * here so `tct-dropdown-menu-sub-menu` never renders data itself).
 */

const isPlainText = (content: MenuContent): content is string | number =>
  typeof content === 'string' || typeof content === 'number';

/** The text of a label for names and the touch list (`''` for rich content). */
export const labelText = (label: MenuContent): string => (isPlainText(label) ? String(label) : '');

function itemKey(item: DropdownMenuItemData, index: number): string {
  return `item-${item.id ?? index}`;
}

/** A leaf row, or (with nested `items`) a submenu row. */
function renderItem(item: DropdownMenuItemData): TemplateResult {
  const richLabel = isPlainText(item.label)
    ? nothing
    : html`<span slot="label">${item.label}</span>`;
  const end =
    item.endContent === undefined || item.endContent === null
      ? nothing
      : html`<span slot="end">${item.endContent}</span>`;
  if (item.items && item.items.length > 0) {
    return html`<tct-dropdown-menu-sub-menu
      label=${labelText(item.label)}
      icon=${ifDefined(item.icon)}
      description=${ifDefined(item.description)}
      ?disabled=${item.disabled === true}
      ?has-spinner=${item.hasSpinner === true}
      >${richLabel}${renderMenuOptions(item.items)}</tct-dropdown-menu-sub-menu
    >`;
  }
  return html`<tct-dropdown-menu-item
    label=${labelText(item.label)}
    icon=${ifDefined(item.icon)}
    description=${ifDefined(item.description)}
    variant=${item.variant ?? 'default'}
    ?disabled=${item.disabled === true}
    ?no-close-on-select=${item.closeOnSelect === false}
    @click=${(event: Event) => item.onClick?.(event)}
    >${richLabel}${end}</tct-dropdown-menu-item
  >`;
}

function renderSection(
  section: Extract<DropdownMenuOption, {type: 'section'}>,
  index: number,
): TemplateResult {
  return html`<div
    class="section"
    part="section"
    data-menu-group
    role="group"
    aria-label=${ifDefined(section.title)}
    data-key=${section.id ?? index}
  >
    ${
      section.title
        ? html`<div class="section-heading" part="section-heading" aria-hidden="true">
            ${section.title}
          </div>`
        : nothing
    }
    ${repeat(section.items, itemKey, (item) => renderItem(item))}
  </div>`;
}

/** The rows of a data-mode menu. */
export function renderMenuOptions(options: readonly DropdownMenuOption[]): TemplateResult {
  return html`${repeat(
    options.map((option, index) => ({option, index})),
    ({option, index}) =>
      isDividerOption(option)
        ? `divider-${index}`
        : isSectionOption(option)
          ? `section-${option.id ?? index}`
          : itemKey(option, index),
    ({option, index}) =>
      isDividerOption(option)
        ? html`<tct-dropdown-menu-divider></tct-dropdown-menu-divider>`
        : isSectionOption(option)
          ? renderSection(option, index)
          : renderItem(option),
  )}`;
}
