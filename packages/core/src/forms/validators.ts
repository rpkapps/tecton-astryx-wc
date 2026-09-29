/**
 * Validators for controls without a native inner control (select, combobox, radio group, file
 * input): the mixin mirrors a native control's `validity` when there is one, and runs `validators`
 * otherwise. Messages are the browser's own, so they follow the user's UI language for free
 * (`nativeMessage`), which is why there are no English strings here (upstream review, low findings).
 */
import type {FormControl, Validator} from '../mixins/form-control.js';

export type NativeMessageKind = 'text' | 'checkbox' | 'radio' | 'select' | 'file' | 'invalid';

const messageCache = new Map<NativeMessageKind, string>();

/**
 * The browser's localized validation message for a kind of control, e.g. "Please check this box if
 * you want to proceed." for `checkbox`. `invalid` is the generic "Please match the requested
 * format." (used for the `invalid` attribute with no custom message).
 */
export function nativeMessage(kind: NativeMessageKind = 'text'): string {
  let message = messageCache.get(kind);
  if (message === undefined) {
    let probe: HTMLInputElement | HTMLSelectElement;
    if (kind === 'select') {
      probe = document.createElement('select');
      probe.required = true;
    } else if (kind === 'invalid') {
      probe = document.createElement('input');
      probe.pattern = '(?!)'; // never matches
      probe.value = 'x';
    } else {
      probe = document.createElement('input');
      probe.type = kind;
      probe.required = true;
    }
    message = probe.validationMessage || 'Please fill out this field.';
    messageCache.set(kind, message);
  }
  return message;
}

/**
 * `valueMissing` with the browser's localized message when the control is `required` and empty.
 *
 * ```ts
 * protected override get validators() { return [requiredValidator((el) => el.values.length === 0, 'select')]; }
 * ```
 */
export function requiredValidator<E extends FormControl>(
  isEmpty: (element: E) => boolean = (element) => !element.value,
  kind: NativeMessageKind = 'text',
): Validator<E> {
  return (element) =>
    element.required && isEmpty(element)
      ? {flags: {valueMissing: true}, message: nativeMessage(kind)}
      : null;
}

/** Empties the message cache. Test-only. */
export function resetNativeMessages(): void {
  messageCache.clear();
}
