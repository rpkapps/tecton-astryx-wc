---
title: Table
folder: table
category: Table & List
entries: [Table, TableHeader, TableBody, TableFooter, TableRow, TableCell, TableHeaderCell]
summary: A data table that renders a native table from columns and data, with sorting, selection, pagination, resizable and pinned columns, grouped rows, row expansion, tree data and windowing for very large datasets, all as plugins.
examples: [basic, variants, declarative, sortable, multi-sort, selection, pagination, column-settings, column-resize, sticky-columns, row-expansion, grouped-rows, tree-data, row-status-and-index, context-menu, large-data, empty-state, rtl]
keywords: [table, data, grid, rows, columns, sort, sortable, select, selection, pagination, paginate, resize, sticky, pinned, group, expand, tree, treegrid, virtual, windowing, plugin, spreadsheet, list]
dense:
  description: data table from columns and data with plugins for sort, selection, pagination, column settings, resize, sticky columns, grouped rows, expansion, tree data, row index and status; windowed above 200 rows
  usage: Give tct-table columns ({key, header, sortable, width, align, renderCell}) and data (an array of objects) as properties, plus idKey (a property name or function that identifies a row). It renders a native table into its own light DOM, so cells can hold any markup. Behaviour comes from plugins, a record you assign to plugins; each plugin is a controller you create with new (for example new TableSortableController(host, config)), usually with a state controller that owns the state and hands the table its rows. Without data and columns the table styles authored markup (a native table, or tct-table-header, -body, -footer, -row, -cell and -header-cell). For static content prefer native table markup. Above 200 rows only the rows near the viewport render.
  bestPractices:
    - {do: true, text: 'Give every table a label and every row a stable idKey, so rows keep their elements and focus as data reorders.'}
    - {do: true, text: 'Use a state controller (TableSortableStateController and friends) for the state and give the table its derived rows; it sorts large data in slices so header clicks stay responsive.'}
    - {do: true, text: 'Pass row-index-start and row-count with pagination so aria-rowindex follows the whole dataset.'}
    - {do: true, text: 'Give columns pixel or proportional widths when you use resizing, pinned columns or windowing; rows of similar height keep the window accurate (text-overflow="truncate" helps).'}
    - {do: true, text: 'Keep every context-menu action reachable another way.'}
    - {do: false, text: 'Use a table for layout; it is for tabular data.'}
    - {do: false, text: 'Expect arrow-key navigation between cells; the table is not a grid, every control in it is a normal tab stop.'}
    - {do: false, text: 'Mutate the data array in place; assign a new array so the table re-renders.'}
  properties:
    density: row density (compact, balanced, spacious); reflects
    dividers: where dividers show (rows, columns, grid, none); reflects
    striped: alternate row fill; reflects
    hasHover: attribute has-hover; highlights the row under the pointer; reflects
    verticalAlign: attribute vertical-align; body cell alignment (middle, top, bottom); reflects
    textOverflow: attribute text-overflow; wrap (default) or truncate with an ellipsis and a tooltip; reflects
    windowing: auto (default) renders only the rows near the viewport above 200 rows; off renders every row; reflects
    label: accessible name of the scroll region; default the localized "Table"
    rowIndexStart: attribute row-index-start; aria-rowindex of the first rendered row; opts into aria-rowindex and aria-rowcount
    rowCount: attribute row-count; total rows across all pages for aria-rowcount
    emptyLabel: attribute empty-label; text of the default empty state
    noEmptyState: attribute no-empty-state; an empty data array renders an empty body
    emptyState: content of the empty-state row (template, node or text); false disables it
    data: the rows (property only); assign a new array to update
    columns: the column definitions (property only); omitted with data set, generated from the first row's keys
    idKey: attribute id-key; stable identity of a row, a property name or a function
    plugins: record of named plugin controllers (property only); canonical order columnSettings, sort, tree, selection, pagination, then record order
    tableElement: the rendered table element
    scrollRegion: the element that scrolls sideways
    scrollable: whether the columns overflow and the scroll region is a tab stop
    renderedRowCount: data rows currently in the DOM; fewer than data.length while windowed
    pluginHost: the plugin-facing view of the table (translate, direction, announce)
    direction: ltr or rtl, from the provider or the computed direction
    t: localized message by id from the table's catalogs
    scope: on a cell part, col or row sets the ARIA role (columnheader or rowheader)
    headers: on a cell part, kept for native-table parity
    colSpan: attribute col-span; aria-colspan of a cell part
    rowSpan: attribute row-span; aria-rowspan of a cell part
    contextMenuActions: right-click actions of a cell, header cell or row part; opens the table's shared menu
    headerRow: attribute header-row; marks a row part as the header row
    default: slot of the authored table content in children mode (light DOM: the content stays where it is written)
    --container-padding-inline-start: read from an enclosing padded container so the table bleeds to its edge (also inline-end, block-start and block-end)
    --table-sticky-background: opaque fill of pinned body cells; default the card background
related: [pagination, checkbox-input, context-menu, empty-state, text, icon]
---

## Purpose

`tct-table` shows structured data in rows and columns. Data-driven, it renders a native `<table>` into
its own light DOM from `columns` and `data`, so screen readers meet an ordinary table (`table`,
`rowgroup`, `row`, `columnheader`, `cell`, never `grid`) and cells can hold any markup. Everything
beyond that is a plugin: sorting, selection, pagination, column settings, resizing, pinned columns,
grouped rows, row expansion, tree data, a row-number column, a status gutter, and right-click actions.

## When to use

- Comparing values across records: people, orders, deployments, files.
- Data people sort, select, page through or expand.
- Static tabular content: write native `<table>` markup inside `tct-table` and let it style it.

## Alternatives

- A short list of items with one main line each: `tct-item` or a list component.
- A hierarchy with no columns: `tct-tree-list`.
- Data whose cells are edited like a spreadsheet: this table is read-mostly and adds no arrow-key cell
  navigation, so it is not the right base for an editable grid.
- Layout: use the layout components, never a table.

## Anatomy

- The **scroll region** (`.tct-table-scroll`) is a `role="group"` named by `label`; it becomes a tab stop
  only while the columns overflow, so keyboard users can scroll it, and it contains overscroll.
- The **table** is a native `<table>` with a `<thead>` of `<th scope="col">` and a `<tbody>` of `<tr>` and
  `<td>`. Plugins decorate cells with real controls: a sort button, a checkbox, a chevron button, a
  separator handle.
- **Spacer rows** (`.tct-table-spacer`, `aria-hidden`) stand in for the rows outside the window of a
  windowed table.
- **Plugin chrome** sits around the table: pagination controls, the shared context menu.
- The subcomponents map to native elements. `tct-table-header`, `-body`, `-footer`, `-row`, `-cell` and
  `-header-cell` are for declarative children mode, where they carry ARIA table roles; the data-driven
  renderer emits `<thead>`, `<tbody>`, `<tfoot>`, `<tr>`, `<td>` and `<th>`.

## Variants and states

- `density` (compact, balanced, spacious), `dividers` (rows, columns, grid, none), `striped`, `has-hover`,
  `vertical-align` and `text-overflow` (`truncate` clips default cell text with an ellipsis and a tooltip).
- Rows can be selected (filled), expandable, grouped, indented (tree), or carry a status marker.
- An empty `data` array shows a compact empty state row; `empty-label`, `emptyState` and `no-empty-state`
  change it.
- Columns take `width: {type: 'pixel', value}` or `{type: 'proportional', value, minWidth}`; `align: 'end'`
  right-aligns numbers.

## Plugins

Plugins are controllers assigned to `plugins`. Each one implements a small transform protocol (columns,
table, header row, header cell, body row, body cell, scroll wrapper, whole output) and Lit's
`ReactiveController`, and reads its config live. State controllers own the state, derive the data and
implement the config a plugin needs, so the usual pair is a state controller and a plugin:

```js
const sort = new TableSortableStateController(host, {data: rows});
sort.subscribe(() => { table.data = sort.sortedData; });
table.plugins = {sort: new TableSortableController(host, sort.sortConfig)};
table.data = sort.sortedData;
```

Known names apply in a canonical order (`columnSettings`, `sort`, `tree`, `selection`, `pagination`);
other names follow in record order. A plugin can also be a plain object with transform methods.

| Plugin | State controller | What it adds |
| --- | --- | --- |
| `TableSortableController` | `TableSortableStateController` | Header sort buttons, `aria-sort`, an announcement, header context-menu actions, optional multi-sort. |
| `TableSelectionController` | `TableSelectionStateController` | Checkbox column, select-all with an indeterminate state, `aria-selected`, selected fill. |
| `TablePaginationController` | (none; use `paginateData`) | Page controls above or below the table. |
| `TableColumnSettingsController` | `TableColumnSettingsStateController` | Which columns show, and in what order. |
| `TableColumnResizeController` | (none) | A separator handle per header, pointer and keyboard. |
| `TableStickyColumnsController` | (none) | Columns pinned to either edge, with logical offsets. |
| `TableGroupedRowsController` | (itself) | Collapsible group headings with counts. |
| `TableRowExpansionController` | (none) | A chevron column and a full-width detail row. |
| `TableTreeDataController` | `TableTreeStateController` | Indentation, chevrons, optional expand-all and row-click expansion. |
| `TableRowIndexController` | (none) | A row-number column. |
| `TableRowStatusController` | (none) | A status gutter with a named marker per row. |

## Large datasets

Above 200 rows (`windowing="auto"`) the table renders only the rows near the viewport, between two spacer
rows that keep the scroll height, and sets `aria-rowcount` and `aria-rowindex` so assistive technology
still knows the whole set. Sorting or selecting in ten thousand rows costs the same as in fifty: a
sort, selection and scroll each stay well under the 200 ms interaction budget. `TableSortableStateController`
sorts datasets of more than 2,000 rows in slices of a few milliseconds and yields to the main thread
between them; while it runs `sortedData` keeps the previous order and `sorting` is true, and
`settled()` resolves when the sorted rows are ready.

Windowing assumes rows of similar height. Text columns that wrap make the spacers approximate, so use
`text-overflow="truncate"` or fixed content; `windowing="off"` renders every row. Rows outside the window
are not in the DOM, so the browser's find-in-page does not see them; offer a search control for large
tables. Windowed tables use the fixed column layout, which the table already uses, so give columns widths.

## Responsive behaviour

The table scrolls sideways inside its own region when the columns are wider than the space; the region
becomes keyboard focusable only then. Inside a card or padded container the table bleeds to the edges and
its first column lines up with the container's content. Pin the identifying column with the sticky
plugin so it stays visible while the rest scrolls, and prefer `proportional` column widths with a
`minWidth` over fixed ones so columns share the space.

## Form semantics

Not a form control. The selection plugin's checkboxes are `tct-checkbox-input` elements named
"Select row" (or "Select" plus the row label from `getRowLabel`); they take part in a form like any other
checkbox only if you give them a name yourself.

## Screen-reader expectations

- A data-driven table is a real `table` with column headers; it is not a grid and needs no application
  role. Give it a `label`.
- Sortable headers are buttons named "Sort by Name" (with the current direction), and the header cell has
  `aria-sort`. A change is announced ("Sorted by Name, ascending", "Sort cleared") through a polite live
  region, because a label change on a focused button is not spoken by most screen readers.
- Row selection is a checkbox per row; the header checkbox is `mixed` for a partial selection; selected
  rows carry `aria-selected`.
- Expanders (row expansion, tree data, group headings) are buttons with `aria-expanded` and a name such as
  "Expand row" or "Collapse group Engineer". Rows themselves do not carry `aria-level` or `aria-expanded`:
  those are valid only on a treegrid row, and a treegrid promises arrow-key navigation. The tree level is
  visible in the indentation and exposed as `data-tree-level` for styling.
- The resize handle is a `separator` named "Resize column Name" with `aria-valuenow`, `aria-valuemin` and a
  spoken width ("160 pixels wide").
- A windowed table exposes `aria-rowcount` and `aria-rowindex`; a paginated one takes them from
  `row-index-start` and `row-count`.
- Status markers are images named by their label ("Failed"), and the status column has a visually hidden
  header ("Row status").

## Localisation

Every string the table adds (the sort and selection names, the expander names, the resize handle, the
status column header, the empty state, the pagination controls) comes from the shipped catalogs in all
30 locales. Layout uses logical properties, so columns, pinned columns, the sort control, chevrons and the
resize handles mirror in right-to-left text; the resize arrow keys follow the visual direction. Text is
sorted with an `Intl.Collator` for the element's language with numeric collation, and missing values sort
last.

## Consumer responsibilities

- Give the table a `label`, and columns readable header text.
- Provide `idKey` and assign new arrays: the table compares rows by identity.
- Keep filtering and paging in your data layer: give the table the rows it should render (`paginateData`,
  a server page, a state controller's output).
- Give context-menu actions another visible route; right-click is a shortcut.
- Persist column widths, active columns and the sort yourself, from the plugin callbacks.
- For very large tables offer a search or filter control, because rows outside the window are not in the
  page for find-in-page.
