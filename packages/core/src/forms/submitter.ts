/**
 * Submission plumbing for form-associated custom elements (A§9.7 "Submitter" and "Implicit
 * submission" rows).
 *
 * A custom element cannot be a native submit button, so `tct-button type=submit`:
 *  1. marks a submission attempt (so required fields show their errors, see below),
 *  2. inserts a temporary hidden native `<button type=submit>` into the form carrying the button's
 *     `name`/`value`/`formaction`/`formmethod`/`formenctype`/`formtarget`/`formnovalidate`,
 *  3. calls `form.requestSubmit(temp)` and removes it.
 * `SubmitEvent.submitter` is therefore the temporary native button, not the `tct-button` host
 * (a platform limit, documented difference); `FormData` contains the submitter's entry.
 *
 * **Submission attempts.** Displayed invalidity (`:state(user-invalid)`, `aria-invalid`) must appear
 * on a real submission attempt but never on `form.checkValidity()` (upstream review M6: an "enable
 * Save when valid" listener must not turn untouched required fields red). The browser fires the same
 * `invalid` event for both and there is no `submit` event when validation fails, so attempts are
 * marked by their causes: a click on a submit button (native or ours), Enter implicit submission, and
 * `submitWithSubmitter`. The mark lasts one task, which covers the synchronous validation that follows.
 *
 * Implicit submission and the Enter/click bridge live in `implicit-submit.ts`.
 *
 * **Rule for every submitter.** An element that carries the {@link SUBMITTER} marker must call
 * `installFormBridge()` (idempotent) from its `connectedCallback`. `FormControlMixin` does it for
 * controls, but a submitter without the mixin (`tct-button`) is the only thing in a form of native fields;
 * without the bridge Enter in those fields runs the browser's implicit submission with no submitter
 * (the `name=value` entry is lost, and with two fields nothing happens at all).
 */
/** Marker property on elements that act as submit/reset buttons for their form (`tct-button`). */
export const SUBMITTER = Symbol.for('tct.submitter');

/** What a submit-capable custom element exposes to the bridge. */
export interface SubmitterElement extends HTMLElement {
  readonly [SUBMITTER]: true;
  /** `submit` makes it the form's default button candidate. */
  type: 'submit' | 'reset' | 'button';
  disabled: boolean;
}

export interface SubmitterInit {
  name?: string;
  value?: string;
  formAction?: string;
  formMethod?: string;
  formEnctype?: string;
  formTarget?: string;
  formNoValidate?: boolean;
}

// ------------------------------------------------------------------------- attempt marking

const attempts = new WeakSet<HTMLFormElement>();

/** Marks a submission attempt on `form` for the current task. */
export function markSubmitAttempt(form: HTMLFormElement): void {
  attempts.add(form);
  setTimeout(() => {
    attempts.delete(form);
  }, 0);
}

/** Whether a submission attempt is in flight on `form` (validation is running because of it). */
export function isSubmitAttempt(form: HTMLFormElement | null): boolean {
  return form !== null && attempts.has(form);
}

// ------------------------------------------------------------------------------ submitters

export function isTctSubmitter(element: unknown): element is SubmitterElement {
  return (
    element instanceof HTMLElement && (element as Partial<SubmitterElement>)[SUBMITTER] === true
  );
}

/** Native submit buttons: `<button>` without a type or with `type=submit`, `<input type=submit|image>`. */
export function isNativeSubmitButton(element: Element): boolean {
  if (element instanceof HTMLButtonElement) return element.type === 'submit';
  if (element instanceof HTMLInputElement)
    return element.type === 'submit' || element.type === 'image';
  return false;
}

/** The form's default button: the first submit button (native or library) in tree order. */
export function defaultSubmitButton(form: HTMLFormElement): HTMLElement | null {
  for (const element of form.elements) {
    if (isNativeSubmitButton(element)) return element as HTMLElement;
    if (isTctSubmitter(element) && element.type === 'submit') return element;
  }
  return null;
}

/**
 * Submits `form` as if a submit button with `init` had been clicked (see the file header). Runs the
 * form's constraint validation; a `formNoValidate` submitter skips it.
 */
export function submitWithSubmitter(form: HTMLFormElement, init: SubmitterInit = {}): void {
  const temp = form.ownerDocument.createElement('button');
  temp.type = 'submit';
  temp.hidden = true;
  temp.tabIndex = -1;
  temp.setAttribute('data-tct-temp-submitter', '');
  if (init.name) temp.name = init.name;
  if (init.value !== undefined) temp.value = init.value;
  if (init.formAction) temp.formAction = init.formAction;
  if (init.formMethod) temp.formMethod = init.formMethod;
  if (init.formEnctype) temp.formEnctype = init.formEnctype;
  if (init.formTarget) temp.formTarget = init.formTarget;
  if (init.formNoValidate) temp.formNoValidate = true;
  form.append(temp);
  markSubmitAttempt(form);
  try {
    form.requestSubmit(temp);
  } finally {
    temp.remove();
  }
}

/** Resets `form` (the `type=reset` behaviour of a library button). */
export function resetFormFromSubmitter(form: HTMLFormElement): void {
  form.reset();
}
