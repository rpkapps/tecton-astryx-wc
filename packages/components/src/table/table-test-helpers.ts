/**
 * Shared helpers for the table tests. Not shipped (only test files import it).
 */
import type {TableColumn} from './table.types.js';

export interface Person extends Record<string, unknown> {
  id: string;
  name: string;
  role: string;
  age: number;
}

export const PEOPLE: Person[] = [
  {id: 'p1', name: 'Alice Chen', role: 'Engineer', age: 31},
  {id: 'p2', name: 'Bob Smith', role: 'Designer', age: 27},
  {id: 'p3', name: 'Carol Wu', role: 'PM', age: 45},
  {id: 'p4', name: 'Dmitri Volkov', role: 'Engineer', age: 38},
];

export const PERSON_COLUMNS: TableColumn<Person>[] = [
  {key: 'name', header: 'Name'},
  {key: 'role', header: 'Role'},
  {key: 'age', header: 'Age', align: 'end'},
];

/**
 * The test document carries a Tailwind-preflight-style reset that is unlayered, and unlayered rules beat
 * every layer, including the table's `tecton.light-dom` sheet. Real applications put their reset in a
 * layer that comes before it (the documented layer order), so the tests do the same: the reset is
 * removed and re-added inside `@layer base`.
 */
export function useLayeredPreflight(): void {
  document.querySelector('style[data-test-preflight]')?.remove();
  if (document.querySelector('style[data-table-test-preflight]')) return;
  const style = document.createElement('style');
  style.dataset.tableTestPreflight = '';
  style.textContent =
    '@layer base, tecton.light-dom;\n' +
    '@layer base { *, ::after, ::before { box-sizing: border-box; margin: 0; padding: 0; border: 0 solid; } }';
  document.head.prepend(style);
}

/** Rows of the rendered body, as arrays of cell text. */
export function bodyText(table: Element): string[][] {
  return [...table.querySelectorAll<HTMLTableRowElement>('tbody > tr:not(.tct-table-spacer)')].map(
    (row) => [...row.cells].map((cell) => cell.textContent.trim()),
  );
}

/** Header texts of the rendered header row. */
export function headerText(table: Element): string[] {
  return [...table.querySelectorAll<HTMLTableCellElement>('thead th')].map((cell) =>
    cell.textContent.trim(),
  );
}
