/** Helpers shared by the field family (`tct-field`, `tct-field-label`, the value controls). */
import type {InputStatusType} from './field.types.js';

/** Icon names (default icon set) per status type, shared by every control that shows a status glyph. */
export const STATUS_ICON: Readonly<Record<InputStatusType, string>> = {
  error: 'error',
  warning: 'warning',
  success: 'success',
  info: 'info',
};

/** Reads an enumerated attribute value; anything outside `allowed` falls back (A§7.3). */
export function oneOf<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Input types that take focus (rather than a click) when their label or box is pressed. */
const FOCUS_INPUT_TYPES = new Set([
  'text',
  'password',
  'email',
  'number',
  'search',
  'tel',
  'url',
  'date',
  'datetime-local',
  'month',
  'time',
  'week',
]);

const HASPOPUP_VALUES = new Set(['true', 'menu', 'listbox', 'tree', 'grid', 'dialog']);

/**
 * What pressing a label, a description or the chrome around a control does to the control (upstream
 * `useInputContainer`): text-like controls take focus; a popup trigger (a combobox, anything with
 * `aria-haspopup`) and every other control are clicked, because they act on click and not on focus.
 */
export function activateControl(control: HTMLElement): void {
  const role = control.getAttribute('role');
  const haspopup = control.getAttribute('aria-haspopup');
  if (role === 'combobox' || (haspopup !== null && HASPOPUP_VALUES.has(haspopup))) {
    control.click();
  } else if (control instanceof HTMLInputElement) {
    if (FOCUS_INPUT_TYPES.has(control.type)) control.focus();
    else control.click();
  } else if (control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) {
    control.focus();
  } else {
    // A library control (`tct-*`) or a composite: focusing the host delegates into it.
    control.focus();
  }
}

/** Whether the user is selecting text, in which case a click on chrome must not steal focus. */
export function isSelectingText(): boolean {
  const selection = getSelection();
  return selection !== null && !selection.isCollapsed;
}

/** Selector for the interactive descendants a chrome click must leave alone (links, buttons, form controls). */
export const NESTED_INTERACTIVE =
  'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"]), [contenteditable]:not([contenteditable="false"])';

/** Number-or-string CSS length attribute (`width="320"` is px, `width="50%"` is used as is). */
export const lengthConverter = {
  fromAttribute(value: string | null): number | string | undefined {
    if (value === null || value.trim() === '') return undefined;
    const trimmed = value.trim();
    return /^-?\d*\.?\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
  },
  toAttribute(value: number | string | undefined): string | null {
    return value === undefined ? null : String(value);
  },
};

/** CSS value of a length prop: numbers are px, strings are used as they are. */
export function toCssLength(value: number | string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}
