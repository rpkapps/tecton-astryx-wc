import {html, nothing, type CSSResultGroup} from 'lit';
import {property} from 'lit/decorators.js';
import fieldMessages from '@tecton-wc/locales/en/field.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {formLayoutContext} from '@tecton-wc/core/context/keys.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctTooltip} from '../tooltip/tct-tooltip.js';
import base from '../styles/base.styles.css';
import field from '../styles/field.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {activateControl, isSelectingText, NESTED_INTERACTIVE} from './field-utils.js';
import {renderLabelTip} from './field-label-tip.js';
import styles from './tct-field-label.styles.css';

/**
 * The label of a field: text, an optional icon, the "Required" or "Optional" indicator, an optional
 * info tip, and an optional description. It is what `tct-field` (and a control's slotted-input mode)
 * renders as an owned light-DOM satellite, so a native control in the same tree can name itself with
 * `aria-labelledby` (ids never cross a shadow boundary); it can also be used on its own.
 *
 * The label text is the default slot (or the `label` attribute). Pressing the label focuses the control
 * `input-id` names, as a real `<label for>` does. A form-level default optionality (a `tct-form-layout`
 * that says "required by default") suppresses the indicator that only restates it, so only the
 * exception is marked. The indicator is text ("∙ Optional"), never colour alone.
 *
 * @summary Field label with required/optional indicator, icon and info tip.
 * @tag tct-field-label
 * @upstream FieldLabel
 * @slot - The label text; alternative to the `label` attribute.
 * @csspart label - The label box.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart description - The description under the label.
 * @csspart label-tip - The info-tip button.
 * @cloakDisplay block
 */
export class TctFieldLabel extends TctElement {
  static override readonly tagName = 'tct-field-label';
  static override readonly dependencies = [TctIcon, TctTooltip];
  static override styles: CSSResultGroup = [base, visuallyHidden, focusRing, field, styles];

  /** The label text (always rendered for accessibility). Alternative to the default slot. */
  @property() label = '';

  /** Id of the control this label names; pressing the label focuses (or clicks) it. Resolved in the label's own tree. */
  @property({attribute: 'input-id'}) inputId = '';

  /**
   * Hides the label and its description visually while keeping them for assistive technology; the
   * hidden group takes no place in the layout.
   */
  @property({type: Boolean, reflect: true, attribute: 'label-hidden'}) labelHidden = false;

  /** The control is disabled: the label is dimmed and no longer forwards presses. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** Marks the field optional (an "Optional" indicator). Wins over `required`. */
  @property({type: Boolean}) optional = false;

  /** Marks the field required (a "Required" indicator), unless the form's default optionality already says so. */
  @property({type: Boolean}) required = false;

  /** Name of an icon shown before the label text (upstream `labelIcon`). */
  @property({attribute: 'label-icon'}) labelIcon = '';

  /** Text of an info tip shown as a small icon button after the label. */
  @property({attribute: 'label-tooltip'}) labelTooltip = '';

  /**
   * The field wraps a group of controls (a radio group), so the label names the group and forwards
   * nothing when pressed. The group takes the label as its name with `aria-labelledby`.
   */
  @property({type: Boolean, attribute: 'group-label'}) groupLabel = false;

  /** Description shown under the label; hidden with it. Pressing it forwards to the control. */
  @property() description = '';

  /**
   * Indicator text written by the field that owns this satellite, which knows the form's default
   * optionality. Empty: the label works it out from `optional` and `required` itself.
   * @internal
   */
  @property() indicator = '';

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'field',
    defaults: fieldMessages,
  });
  readonly #layout: ContextConsumer<typeof formLayoutContext> = new ContextConsumer<
    typeof formLayoutContext
  >(this, {
    context: formLayoutContext,
    subscribe: true,
  });

  /** The text of the indicator: the owner's, else "Optional" or "Required" (only when it differs from the form default). */
  #indicatorText(): string {
    if (this.indicator) return this.indicator;
    const defaults = this.#layout.value?.optionality;
    if (this.optional && defaults !== 'optional') return this.#locale.t('optional');
    if (this.required && !this.optional && defaults !== 'required')
      return this.#locale.t('required');
    return '';
  }

  /** The control the label points at, resolved in the label's own tree. */
  #control(): HTMLElement | null {
    if (!this.inputId || this.groupLabel) return null;
    const root = this.getRootNode() as Document | ShadowRoot;
    return root.getElementById?.(this.inputId) ?? null;
  }

  override render() {
    const indicator = this.#indicatorText();
    const hidden = this.labelHidden;
    return html`<div class="label-group ${hidden ? 'visually-hidden' : ''}">
      <div class="label-row">
        <span
          part="label"
          class="label"
          ?data-disabled=${this.disabled}
          ?data-hidden=${hidden}
          @click=${this.#onLabelClick}
          >${
            this.labelIcon
              ? html`<tct-icon name=${this.labelIcon} size="sm" color="inherit"></tct-icon>`
              : nothing
          }<slot>${this.label}</slot>${
            indicator
              ? html`<span part="label-indicator"
                  ><span aria-hidden="true"> ∙ </span>${indicator}</span
                >`
              : nothing
          }</span
        >
        ${hidden ? nothing : renderLabelTip(this.labelTooltip, this.#locale.t('moreInfo'))}
      </div>
      ${
        this.description
          ? html`<span part="description" class="description" @click=${this.#onDescriptionClick}
              >${this.description}</span
            >`
          : nothing
      }
    </div>`;
  }

  readonly #onLabelClick = (): void => {
    if (this.disabled) return;
    const control = this.#control();
    if (control) activateControl(control);
  };

  /** The description reads as part of the label's hit target, except over nested controls or a text selection. */
  readonly #onDescriptionClick = (event: MouseEvent): void => {
    if (this.disabled || isSelectingText()) return;
    const origin = event.composedPath()[0];
    if (origin instanceof Element && origin.closest(NESTED_INTERACTIVE)) return;
    const control = this.#control();
    if (control) activateControl(control);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-field-label': TctFieldLabel;
  }
}
