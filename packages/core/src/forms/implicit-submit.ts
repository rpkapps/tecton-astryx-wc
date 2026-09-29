/**
 * Implicit submission (A§9.7 "Implicit submission" row). The inner `<input>` of a control in a shadow
 * root has no form owner, so Enter never submits by itself (upstream review H1, verified: 0 submits).
 * `submitImplicitly` runs the HTML algorithm for such controls; the **bridge** covers what the
 * platform does not: Enter in a native text input of a form whose default submit button is a library
 * submitter (the platform only sees native buttons, so with two fields nothing would happen), and
 * marks submission attempts on native submit-button clicks (see `submitter.ts`).
 */
import {isImeKeyEvent} from '../utils/ime.js';
import {
  defaultSubmitButton,
  isNativeSubmitButton,
  isTctSubmitter,
  markSubmitAttempt,
} from './submitter.js';

/** Marker property (boolean getter) on form controls that block implicit submission (single-line text). */
export const BLOCKS_IMPLICIT_SUBMISSION = Symbol.for('tct.blocks-implicit-submission');

const TEXT_LIKE_INPUT_TYPES = new Set([
  'text',
  'search',
  'url',
  'tel',
  'email',
  'password',
  'date',
  'month',
  'week',
  'time',
  'datetime-local',
  'number',
]);

/** Whether `element` is a field that blocks implicit submission when the form has no submit button. */
export function blocksImplicitSubmission(element: Element): boolean {
  if (element instanceof HTMLInputElement) return TEXT_LIKE_INPUT_TYPES.has(element.type);
  return (
    (element as unknown as Partial<Record<symbol, unknown>>)[BLOCKS_IMPLICIT_SUBMISSION] === true
  );
}

function isDisabledButton(button: HTMLElement): boolean {
  return (
    (button as Partial<HTMLButtonElement>).disabled === true ||
    button.matches(':disabled') ||
    button.getAttribute('aria-disabled') === 'true'
  );
}

/**
 * The HTML implicit-submission algorithm for controls the platform cannot handle (the inner input in
 * a shadow root has no form owner, so Enter never submits by itself):
 *  - the form's default button is activated (a disabled default button does nothing),
 *  - with no submit button, `form.requestSubmit()` runs only when at most one field blocks implicit
 *    submission (the HTML rule, otherwise two text fields and Enter would do nothing natively too).
 * Returns whether a submission was attempted.
 */
export function submitImplicitly(form: HTMLFormElement): boolean {
  markSubmitAttempt(form);
  const button = defaultSubmitButton(form);
  if (button) {
    if (isDisabledButton(button)) return false;
    button.click();
    return true;
  }
  const blockers = [...form.elements].filter(blocksImplicitSubmission).length;
  if (blockers > 1) return false;
  form.requestSubmit();
  return true;
}

// ------------------------------------------------------------------------------------ bridge

let bridgeInstalled = false;

function onClickCapture(event: MouseEvent): void {
  for (const node of event.composedPath()) {
    if (node instanceof HTMLButtonElement || node instanceof HTMLInputElement) {
      if (isNativeSubmitButton(node) && node.form) markSubmitAttempt(node.form);
      return;
    }
  }
}

/**
 * Enter in a native text-like field: when the form's default button is a library submitter the
 * platform has none to activate, so activate it here. A native default button (or none) keeps the
 * platform's own behaviour.
 */
function onKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || event.defaultPrevented || isImeKeyEvent(event)) return;
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
  const target = event.composedPath()[0];
  if (
    !(target instanceof HTMLInputElement) ||
    !target.form ||
    !TEXT_LIKE_INPUT_TYPES.has(target.type)
  )
    return;
  const form = target.form;
  markSubmitAttempt(form);
  const button = defaultSubmitButton(form);
  if (button && isTctSubmitter(button)) {
    event.preventDefault();
    if (!isDisabledButton(button)) button.click();
  }
}

/** Installs the document listeners once (called when the first library form control connects). */
export function installFormBridge(): void {
  if (bridgeInstalled || typeof document === 'undefined') return;
  bridgeInstalled = true;
  document.addEventListener('click', onClickCapture, true);
  document.addEventListener('keydown', onKeyDown);
}

/** Removes the document listeners. Test-only. */
export function resetFormBridge(): void {
  if (!bridgeInstalled) return;
  bridgeInstalled = false;
  document.removeEventListener('click', onClickCapture, true);
  document.removeEventListener('keydown', onKeyDown);
}
