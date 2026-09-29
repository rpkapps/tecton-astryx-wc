/**
 * `runFormControlSuite` (A§15.3): every row of the FACE contract (A§9.7) for a control built on
 * `FormControlMixin`. Call it from the control's test file after `runElementSuite`.
 *
 * ```ts
 * runFormControlSuite({
 *   tag: 'tct-text-input',
 *   validValue: 'hello',
 *   submitsOnEnter: true,
 *   userEdit: async (el) => { await userEvent.click(el); await userEvent.keyboard('hi'); await pressKeys('Tab'); },
 * });
 * ```
 *
 * Rows: opt-in, value/FormData, name and disabled, events, implicit submission (exactly once), reset,
 * restore, fieldset disabled, labels, validity, displayed-invalidity timing, blocked-submit focus
 * (validation anchor), custom validity, read-only, observers.
 */
import {userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {observeControl, unobserveControl} from '@tecton-wc/core/mixins/form-control.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode} from '../a11y.js';
import {recordEvents} from '../events.js';
import {formHarness, hasCustomState, type FormHarness} from '../forms.js';
import {pressKeys} from '../keyboard.js';
import {isChromium, isTier2} from '../tier.js';
import {nextFrame} from '../timing.js';

/** The surface of a form-associated `tct-*` element the suite uses. */
interface FormControlElement extends HTMLElement {
  name: string;
  disabled: boolean;
  required: boolean;
  readonly: boolean;
  invalid: boolean;
  value: string;
  readonly isDisabled: boolean;
  readonly showInvalid: boolean;
  readonly validity: ValidityState;
  readonly willValidate: boolean;
  readonly form: HTMLFormElement | null;
  readonly labels: NodeList;
  readonly displayedValidationMessage: string;
  readonly updateComplete: Promise<boolean>;
  checkValidity(): boolean;
  reportValidity(): boolean;
  setCustomValidity(message: string): void;
  formStateRestoreCallback(
    state: string | File | FormData | null,
    reason: 'restore' | 'autocomplete',
  ): void;
}

export interface FormControlSuiteOptions {
  /** The registered tag name. */
  tag: string;
  /** Markup for the control; `attributes` carries the attributes the suite needs (default: `<tag attributes></tag>`). */
  render?: (attributes: string) => string;
  /** The submitted value of the control once `setValid` ran. */
  validValue: string;
  /** Puts the control into its valid, non-empty state (default: `el.value = validValue`). */
  setValid?: (element: FormControlElement) => void | Promise<void>;
  /** Puts the control into its empty state (default: `el.value = ''`). */
  setEmpty?: (element: FormControlElement) => void | Promise<void>;
  /** What `formStateRestoreCallback` receives to restore the valid state (default: `validValue`). */
  restoreState?: string | File | FormData | null;
  /** Enter in the control runs implicit submission (single-line controls). */
  submitsOnEnter?: boolean;
  /** Performs a real user edit and commit (typing then Tab, clicking); must produce `change`. */
  userEdit?: (element: FormControlElement) => Promise<void>;
  /** Whether the control supports `required` (default true). */
  required?: boolean;
  /** Whether the control supports `readonly` (default false). */
  readonly?: boolean;
  /** How a label click reaches the control (default `'focus'`; `'click'` for checkbox-like; `false` skips). */
  labelActivation?: 'focus' | 'click' | false;
  /** Focus must land inside the control after a blocked submit (default true). */
  anchorFocus?: boolean;
  /** The element inside the control that must receive focus for `labelActivation: 'focus'` (default: any inside). */
  innerFocusable?: (element: FormControlElement) => HTMLElement | null;
}

/** aria-invalid="true" on the inner control (or on the composite's role element) in the shadow root. */
const ariaInvalidOf = (element: FormControlElement): boolean =>
  element.shadowRoot?.querySelector('[aria-invalid="true"]') != null;

const settleValidity = async (element: FormControlElement): Promise<void> => {
  await element.updateComplete;
  await nextFrame();
  await element.updateComplete;
};

export function runFormControlSuite(options: FormControlSuiteOptions): void {
  const {tag, validValue} = options;
  const render = options.render ?? ((attributes) => `<${tag} ${attributes}></${tag}>`);
  const setValid =
    options.setValid ??
    ((element: FormControlElement) => {
      element.value = validValue;
    });
  const setEmpty =
    options.setEmpty ??
    ((element: FormControlElement) => {
      element.value = '';
    });

  async function harness(
    attributes = 'name="field"',
    after = '',
  ): Promise<{form: FormHarness; control: FormControlElement}> {
    const form = await formHarness(`${render(attributes)}${after}`);
    const control = form.form.querySelector<FormControlElement>(tag)!;
    await control.updateComplete;
    return {form, control};
  }

  describe(`${tag}: form contract`, () => {
    describe('association and value', () => {
      it('is form-associated and reports its form, name and place in form.elements', async () => {
        const {form, control} = await harness();
        expect(
          (customElements.get(tag) as unknown as {formAssociated: boolean}).formAssociated,
        ).toBe(true);
        expect(control.form).toBe(form.form);
        expect([...form.form.elements]).toContain(control);
        expect(form.form.elements.namedItem('field')).toBe(control);
      });

      it('submits name=value, follows property writes, and never submits without a name', async () => {
        const {form, control} = await harness();
        await setValid(control);
        await control.updateComplete;
        expect(form.values('field')).toEqual([validValue]);

        const nameless = await harness('');
        await setValid(nameless.control);
        await nameless.control.updateComplete;
        expect(nameless.form.entries()).toEqual([]);
      });

      it('a disabled control submits nothing and takes no part in validation', async () => {
        const {form, control} = await harness('name="field" disabled');
        await setValid(control);
        await control.updateComplete;
        expect(form.entries()).toEqual([]);
        expect(control.isDisabled).toBe(true);
        expect(control.willValidate).toBe(false);
      });

      it('property writes emit no input or change event', async () => {
        const {control} = await harness();
        const events = recordEvents(control, ['input', 'change']);
        await setValid(control);
        control.disabled = true;
        control.disabled = false;
        await control.updateComplete;
        expect(events.events).toHaveLength(0);
      });

      it.skipIf(!options.userEdit)(
        'a user edit commits with exactly one composed, bubbling change',
        async () => {
          const {control} = await harness('name="field"', '<button type="button">after</button>');
          const events = recordEvents(control, 'change');
          await options.userEdit!(control);
          expect(events.events).toHaveLength(1);
          expect(events.events[0]!.composed).toBe(true);
          expect(events.events[0]!.bubbles).toBe(true);
        },
      );
    });

    describe('implicit submission', () => {
      it.skipIf(!options.submitsOnEnter)('Enter submits the form exactly once', async () => {
        const {form, control} = await harness();
        await setValid(control);
        await control.updateComplete;
        await userEvent.click(control);
        await pressKeys('Enter');
        expect(form.submitEvents).toHaveLength(1);
      });

      it.skipIf(!options.submitsOnEnter)(
        'does not submit for a modified or composing Enter',
        async () => {
          const {form, control} = await harness();
          await setValid(control);
          await control.updateComplete;
          await userEvent.click(control);
          await pressKeys('Shift+Enter');
          const target = deepActiveElement() ?? control;
          for (const init of [{isComposing: true}, {keyCode: 229}]) {
            target.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: 'Enter',
                bubbles: true,
                composed: true,
                cancelable: true,
                ...init,
              }),
            );
          }
          expect(form.submitEvents).toHaveLength(0);
        },
      );

      it.skipIf(!!options.submitsOnEnter)(
        'Enter does not submit a control that does not take single-line input',
        async () => {
          const {form, control} = await harness();
          await userEvent.click(control);
          await pressKeys('Enter');
          expect(form.submitEvents.length).toBeLessThanOrEqual(0);
        },
      );
    });

    describe('reset and restore', () => {
      it('form.reset() returns to the initial submission and clears the interaction state', async () => {
        const {form, control} = await harness();
        const initial = form.entries();
        await setValid(control);
        await control.updateComplete;
        expect(form.entries()).not.toEqual(initial);
        control.reportValidity();
        form.reset();
        await settleValidity(control);
        expect(form.entries()).toEqual(initial);
        expect(ariaInvalidOf(control)).toBe(false);
      });

      it('formStateRestoreCallback restores the saved state (restore and autocomplete)', async () => {
        for (const reason of ['restore', 'autocomplete'] as const) {
          const {form, control} = await harness();
          control.formStateRestoreCallback(options.restoreState ?? validValue, reason);
          await control.updateComplete;
          expect(form.values('field'), reason).toEqual([validValue]);
        }
      });
    });

    describe('disabled by a fieldset', () => {
      it('is disabled, not submitted and not validated inside <fieldset disabled>, and back again', async () => {
        const form = await formHarness(`<fieldset>${render('name="field"')}</fieldset>`);
        const control = form.form.querySelector<FormControlElement>(tag)!;
        await control.updateComplete;
        await setValid(control);
        await control.updateComplete;
        const fieldset = form.form.querySelector('fieldset')!;
        expect(form.values('field')).toEqual([validValue]);

        fieldset.disabled = true;
        await control.updateComplete;
        expect(control.isDisabled).toBe(true);
        expect(control.disabled, 'the control’s own disabled property is untouched').toBe(false);
        expect(form.entries()).toEqual([]);
        expect(control.willValidate).toBe(false);

        fieldset.disabled = false;
        await control.updateComplete;
        expect(control.isDisabled).toBe(false);
        expect(form.values('field')).toEqual([validValue]);
      });
    });

    describe('labels', () => {
      it.skipIf(options.labelActivation === false)(
        '<label for> names the control and activates it',
        async () => {
          const form = await formHarness(
            `<label for="ctl">Field label</label>${render('name="field" id="ctl"')}`,
          );
          const control = form.form.querySelector<FormControlElement>(tag)!;
          await control.updateComplete;
          expect(control.labels).toHaveLength(1);
          if (isChromium) {
            const inner =
              options.innerFocusable?.(control) ??
              control.shadowRoot?.querySelector<HTMLElement>(
                'input, button, select, textarea, [tabindex]',
              );
            if (inner) expect((await axNode(inner)).name).toContain('Field label');
          }
          const before = recordEvents(control, 'change');
          await userEvent.click(form.form.querySelector('label')!);
          if ((options.labelActivation ?? 'focus') === 'focus') {
            expect(deepActiveElement()).not.toBeNull();
            expect(
              control.matches(':focus-within') || control.shadowRoot?.activeElement != null,
            ).toBe(true);
          } else {
            expect(before.events.length).toBeGreaterThanOrEqual(1);
          }
        },
      );
    });

    describe('validity and the timing of displayed invalidity', () => {
      it.skipIf(options.required === false)(
        'required and empty is invalid, but shows nothing until the user acted',
        async () => {
          const {form, control} = await harness('name="field" required');
          await setEmpty(control);
          await settleValidity(control);
          expect(control.validity.valueMissing).toBe(true);
          expect(control.willValidate).toBe(true);
          expect(control.showInvalid).toBe(false);
          expect(control.displayedValidationMessage).toBe('');
          expect(ariaInvalidOf(control)).toBe(false);
          if (!isTier2) expect(hasCustomState(control, 'user-invalid')).toBe(false);

          // checkValidity() and form.checkValidity() never display the error (review M6).
          expect(control.checkValidity()).toBe(false);
          expect(form.form.checkValidity()).toBe(false);
          await settleValidity(control);
          expect(ariaInvalidOf(control)).toBe(false);
          if (!isTier2) expect(hasCustomState(control, 'user-invalid')).toBe(false);
        },
      );

      it.skipIf(options.required === false)(
        'reportValidity() displays the error: aria-invalid and :state(user-invalid) together',
        async () => {
          const {control} = await harness('name="field" required');
          await setEmpty(control);
          expect(control.reportValidity()).toBe(false);
          await settleValidity(control);
          expect(control.showInvalid).toBe(true);
          expect(ariaInvalidOf(control)).toBe(true);
          expect(control.displayedValidationMessage).not.toBe('');
          if (!isTier2) expect(hasCustomState(control, 'user-invalid')).toBe(true);
          await setValid(control);
          await settleValidity(control);
          expect(control.validity.valid).toBe(true);
          expect(ariaInvalidOf(control)).toBe(false);
        },
      );

      it.skipIf(options.required === false)(
        'a blocked submit displays the error and focuses the control (validation anchor)',
        async () => {
          const {form, control} = await harness(
            'name="field" required',
            '<button type="submit">Go</button>',
          );
          await setEmpty(control);
          await control.updateComplete;
          await userEvent.click(form.form.querySelector('button')!);
          await settleValidity(control);
          expect(form.submitEvents).toHaveLength(0);
          expect(ariaInvalidOf(control)).toBe(true);
          if (options.anchorFocus !== false) {
            const active = deepActiveElement();
            expect(
              active !== null &&
                (control === active ||
                  control.contains(active) ||
                  control.shadowRoot?.contains(active) === true),
            ).toBe(true);
          }
        },
      );

      it('setCustomValidity() and the invalid attribute are custom errors', async () => {
        const {control} = await harness('name="field"');
        await setValid(control);
        control.setCustomValidity('Taken');
        expect(control.validity.customError).toBe(true);
        expect(control.checkValidity()).toBe(false);
        control.setCustomValidity('');
        expect(control.validity.valid).toBe(true);

        control.invalid = true;
        await settleValidity(control);
        expect(control.validity.customError).toBe(true);
        expect(ariaInvalidOf(control)).toBe(true);
        control.invalid = false;
        await settleValidity(control);
        expect(control.validity.valid).toBe(true);
        expect(ariaInvalidOf(control)).toBe(false);
      });

      it.skipIf(!options.readonly)(
        'a read-only control is barred from constraint validation',
        async () => {
          const {control} = await harness('name="field" required readonly');
          await setEmpty(control);
          await settleValidity(control);
          expect(control.checkValidity()).toBe(true);
        },
      );
    });

    describe('observers', () => {
      it('observeControl receives the control after each sync and can drive displayed invalidity', async () => {
        const {control} = await harness();
        const seen: HTMLElement[] = [];
        const observer = {
          invalid: false,
          controlChanged: (target: HTMLElement) => {
            seen.push(target);
          },
        };
        observeControl(control, observer);
        await settleValidity(control);
        expect(seen.length).toBeGreaterThan(0);
        observer.invalid = true;
        (control as unknown as {requestUpdate(): void}).requestUpdate();
        await settleValidity(control);
        expect(control.showInvalid).toBe(true);
        unobserveControl(control, observer);
        await settleValidity(control);
        expect(control.showInvalid).toBe(false);
      });
    });
  });
}
