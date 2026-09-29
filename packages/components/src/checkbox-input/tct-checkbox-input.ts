import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {indicatorScope} from '@tecton-wc/core/indicators/registry.js';
import {TctToggleControl} from './tct-toggle-control.js';
import {TctCheckboxIndicator} from '../indicator/tct-checkbox-indicator.js';
import base from '../styles/base.styles.css';
import field from '../styles/field.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import motion from '../styles/motion.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import toggleStyles from './tct-toggle-control.styles.css';
import styles from './tct-checkbox-input.styles.css';

/**
 * A checkbox: one on/off value, or a partial ("mixed") state when it stands for a group. It is a
 * form-associated element, so it submits `name=value` (`value` is `on` unless you set it) only while
 * checked, resets, restores, validates (`required` means it must be checked) and joins a `<fieldset
 * disabled>` like a native `<input type="checkbox">`. Clicking the label or the description toggles it.
 *
 * `checked` follows the native model: the `checked` attribute is the default that reset returns to, the
 * property is the current state. A user toggle fires the native `input` then `change`, once each; writing
 * `checked` or `indeterminate` fires nothing. To make it controlled, set `checked` from your `change`
 * handler, or cancel the `click` to keep the old state.
 *
 * `indeterminate` shows the mixed state (a bar instead of a check); the user clicking it makes it
 * checked. `readonly` shows the state at full strength but bars changes; `disabled-message` explains a
 * disabled checkbox and keeps it focusable; `loading` (or a pending `changeAction`) shows a spinner in
 * the box and blocks toggling. Validation is displayed only after the user acted.
 * [mwg:form-associated-custom-elements] [mwg:brand-consistent-forms] [mwg:validate-input-after-interaction]
 *
 * @summary A checkbox with label, description, mixed state and detached status.
 * @tag tct-checkbox-input
 * @upstream CheckboxInput
 * @csspart field - The whole field: the row and the status message.
 * @csspart row - The row holding the checkbox and its label.
 * @csspart control - The box wrapper the native input sits over.
 * @csspart input - The native checkbox (invisible, over the box).
 * @csspart label - The label.
 * @csspart label-wrapper - The label and description block.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart checkbox-indicator - The painted box.
 * @csspart checkbox-indicator-check - The check mark.
 * @csspart checkbox-indicator-dash - The bar of the mixed state.
 * @csspart status - The status message box.
 * @cssstate user-invalid - Invalidity is displayed (after a user commit, a submit attempt or `reportValidity()`).
 * @cssstate invalid - The state does not satisfy its constraints (not displayed).
 * @cssstate busy - A `changeAction` is pending or `loading` is set.
 * @fires input - Native, on every toggle by the user; composed and retargeted from the inner input.
 * @fires change - Native, once per toggle by the user; dispatched once from the host.
 * @cloakDisplay block
 * @cloakMinBlockSize 1.5rem
 */
export class TctCheckboxInput extends TctToggleControl {
  static override readonly tagName = 'tct-checkbox-input';
  static override readonly dependencies = [...TctToggleControl.dependencies, TctCheckboxIndicator];
  static override styles: CSSResultGroup = [
    base,
    visuallyHidden,
    focusRing,
    motion,
    field,
    indicatorScope,
    toggleStyles,
    styles,
  ];

  /**
   * Shows the mixed state (a bar instead of a check) for a checkbox that stands for a group in which
   * some but not all items are on. The user clicking it turns it on. Like the native property, the
   * state is not reset by the form.
   */
  @property({type: Boolean}) indeterminate = false;

  protected override get mixed(): boolean {
    return this.indeterminate;
  }

  protected override userToggled(): void {
    this.indeterminate = false;
  }

  protected override renderIndicator(): TemplateResult {
    const state = this.mixed ? 'indeterminate' : this.checked ? 'checked' : 'unchecked';
    return html`<tct-checkbox-indicator
      exportparts="checkbox-indicator, checkbox-indicator-check, checkbox-indicator-dash"
      state=${state}
      size=${this.fieldSize}
      ?disabled=${this.isDisabled}
      >${this.busy ? html`<tct-spinner size="sm" shade="inherit"></tct-spinner>` : nothing}</tct-checkbox-indicator
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-checkbox-input': TctCheckboxInput;
  }
}
