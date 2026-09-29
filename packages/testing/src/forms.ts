/**
 * Form harness (A§15.2): renders a `<form>` around a template and records what the form contract
 * checks need: how many times it submitted (implicit submission must run exactly once), the
 * submitter, and the submitted `FormData`.
 *
 * Navigation is always prevented: the harness listens for `submit` on the form and calls
 * `preventDefault()` after recording.
 */
import {html, type TemplateResult} from 'lit';
import {fixture} from './fixture.js';

export interface FormHarness {
  readonly form: HTMLFormElement;
  /** Every `submit` event the form fired, in order. */
  readonly submitEvents: SubmitEvent[];
  /** Form data as the browser would submit it right now. */
  formData(): FormData;
  /** `[name, value]` pairs of {@link FormHarness.formData}. */
  entries(): [string, FormDataEntryValue][];
  /** Value(s) submitted for `name`. */
  values(name: string): FormDataEntryValue[];
  /** `form.requestSubmit(submitter?)`. */
  submit(submitter?: HTMLElement): void;
  /** `form.reset()`. */
  reset(): void;
}

/** Renders `<form>${content}</form>` and returns the harness. */
export async function formHarness(
  content: TemplateResult | string,
  options: {attributes?: Record<string, string>} = {},
): Promise<FormHarness> {
  const form = await fixture<HTMLFormElement>(
    typeof content === 'string' ? `<form>${content}</form>` : html`<form>${content}</form>`,
  );
  for (const [name, value] of Object.entries(options.attributes ?? {}))
    form.setAttribute(name, value);
  const submitEvents: SubmitEvent[] = [];
  form.addEventListener('submit', (event) => {
    submitEvents.push(event);
    event.preventDefault();
  });
  return {
    form,
    submitEvents,
    formData: () => new FormData(form),
    entries: () => [...new FormData(form).entries()],
    values: (name) => new FormData(form).getAll(name),
    submit: (submitter) => {
      form.requestSubmit(submitter);
    },
    reset: () => {
      form.reset();
    },
  };
}
