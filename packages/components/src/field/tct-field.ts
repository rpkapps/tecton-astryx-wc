import {html, nothing, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {styleMap} from 'lit/directives/style-map.js';
import fieldMessages from '@tecton-astryx/locales/en/field.js';
import {ContextConsumer, ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {fieldContext, formLayoutContext} from '@tecton-astryx/core/context/keys.js';
import {FieldChromeController} from '@tecton-astryx/core/controllers/field-chrome.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import {
  observeControl,
  unobserveControl,
  type ControlObserver,
} from '@tecton-astryx/core/mixins/form-control.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {TctFieldStatus} from '../field-status/tct-field-status.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctTooltip} from '../tooltip/tct-tooltip.js';
import base from '../styles/base.styles.css';
import field from '../styles/field.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {
  FIELD_STATUS_VARIANTS,
  INPUT_STATUS_TYPES,
  type FieldStatusVariant,
  type InputStatus,
  type InputStatusType,
} from './field.types.js';
import {renderLabelTip} from './field-label-tip.js';
import {
  activateControl,
  isSelectingText,
  lengthConverter,
  NESTED_INTERACTIVE,
  oneOf,
  toCssLength,
} from './field-utils.js';
import {TctFieldDescription} from './tct-field-description.js';
import {TctFieldLabel} from './tct-field-label.js';
import styles from './tct-field.styles.css';

const NATIVE_CONTROL =
  'input:not([type="hidden"]), select, textarea, [contenteditable]:not([contenteditable="false"])';

/**
 * A low-level wrapper that gives any control a label, a description and a status: a native `<input>`,
 * a custom or third-party control, a group of controls. Use it for a control that does not already
 * provide field chrome; `tct-text-input` and the other value controls render their own.
 *
 * The label, description and status are owned light-DOM satellites (`tct-field-label`,
 * `tct-field-description`, `tct-field-status`) in the same tree as your control, so the field can wire
 * `aria-labelledby` and `aria-describedby` on it (ids never cross a shadow boundary). The control is
 * the element `input-id` names, or else the first form control inside the field. For a group of
 * controls (a radio group) set `group-label`: the label becomes a caption for the group instead of a
 * `<label>` for one control, and the group takes it as its name. Pressing the label or the description
 * focuses the control, as a real `<label for>` does. The status message is announced once, politely,
 * when it appears or changes.
 *
 * @summary Wraps any control with a label, description and status.
 * @tag tct-field
 * @upstream Field
 * @slot - The control (or group of controls).
 * @slot label - The label satellite the field creates. Do not fill it.
 * @slot description - The description satellite the field creates. Do not fill it.
 * @slot status - The status satellite the field creates. Do not fill it.
 * @csspart field - The field box: label, control and status (Astryx target `astryx-field`).
 * @csspart label-tip - The info-tip button after the label.
 * @cloakDisplay block
 */
export class TctField extends TctElement implements ControlObserver {
  static override readonly tagName = 'tct-field';
  static override readonly dependencies = [
    TctFieldLabel,
    TctFieldDescription,
    TctFieldStatus,
    TctIcon,
    TctTooltip,
  ];
  static override styles: CSSResultGroup = [base, focusRing, field, styles];

  /** The label text. Always rendered for accessibility (visually hide it with `label-hidden`). */
  @property() label = '';

  /**
   * Hides the label and the description visually while keeping them for assistive technology; the
   * hidden group takes no place in the layout.
   */
  @property({type: Boolean, reflect: true, attribute: 'label-hidden'}) labelHidden = false;

  /** Description between the label and the control. Hidden with the label. */
  @property() description = '';

  /**
   * Id of the control the label points at (upstream `inputID`). Resolved in the field's own tree; when
   * omitted, the first form control inside the field is used.
   */
  @property({attribute: 'input-id'}) inputId = '';

  /** Id for the label element (upstream `labelID`), e.g. for a group's own `aria-labelledby`. */
  @property({attribute: 'label-id'}) labelId = '';

  /** Id for the description element (upstream `descriptionID`), for `aria-describedby` on the control. */
  @property({attribute: 'description-id'}) descriptionId = '';

  /** Id for the status message element (upstream `status.messageID`). */
  @property({attribute: 'status-id'}) statusId = '';

  /**
   * The field wraps a group of controls (a radio group): the label is a caption, not a `<label>`, and
   * the group takes it as its name.
   */
  @property({type: Boolean, attribute: 'group-label'}) groupLabel = false;

  /** Optional field: an "Optional" indicator. Wins over `required`. */
  @property({type: Boolean}) optional = false;

  /** Required field: a "Required" indicator, unless the form's default optionality already says so. */
  @property({type: Boolean}) required = false;

  /** The control is disabled: the label is dimmed. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** Name of an icon shown before the label text (upstream `labelIcon`). */
  @property({attribute: 'label-icon'}) labelIcon = '';

  /** Text of an info tip shown as a small icon button after the label (upstream `labelTooltip`). */
  @property({attribute: 'label-tooltip'}) labelTooltip = '';

  /** The kind of status: error, warning, success or info. Shown when there is a `status-message`. */
  @property({attribute: 'status-type'}) statusType: InputStatusType | undefined;

  /** The status message shown with the control. */
  @property({attribute: 'status-message'}) statusMessage = '';

  /**
   * `attached` (default) sits directly below the control, `detached` is a separate message with an icon,
   * `tooltip` renders no message box (a control that surfaces status itself, such as `tct-text-input`).
   */
  @property({attribute: 'status-variant'}) statusVariant: FieldStatusVariant = 'attached';

  /**
   * Width of the whole field, label, control and status alike, so they stay aligned. A number is px, a
   * string is a CSS length (`"100%"`). Prefer this over sizing the control alone.
   */
  @property({converter: lengthConverter}) width: number | string | undefined;

  /**
   * The status as an object (upstream `status`): `{type, message}`. Reading gives the current
   * `status-type` and `status-message`; writing sets both.
   */
  @property({attribute: false})
  get status(): InputStatus | undefined {
    return this.statusType ? {type: this.statusType, message: this.statusMessage} : undefined;
  }
  set status(value: InputStatus | undefined) {
    this.statusType = value?.type;
    this.statusMessage = value?.message ?? '';
  }

  readonly #provider = new ContextProvider(this, {context: fieldContext, initialValue: null});
  readonly #layout = new ContextConsumer(this, {context: formLayoutContext, subscribe: true});
  readonly #locale = new LocaleController(this, {namespace: 'field', defaults: fieldMessages});
  readonly #chrome: FieldChromeController = new FieldChromeController(this, {
    mode: () => 'light',
    control: () => this.#control(),
    state: () => ({
      label: this.label,
      labelHidden: this.labelHidden,
      description: this.description || undefined,
      status:
        this.statusType && this.statusMessage
          ? {type: this.statusType, message: this.statusMessage}
          : undefined,
      statusVariant: oneOf(this.statusVariant, FIELD_STATUS_VARIANTS, 'attached'),
      required: this.required,
      optional: this.optional,
      disabled: this.disabled,
      size: 'md',
      groupLabel: this.groupLabel,
    }),
    ids: {
      label: () => this.labelId,
      description: () => this.descriptionId,
      status: () => this.statusId,
    },
  });

  /**
   * While the field's status is an error, a wrapped library control displays invalidity too
   * (`aria-invalid`, `:state(user-invalid)`), as `ControlObserver` describes.
   * @internal
   */
  get invalid(): boolean {
    return this.statusType === 'error';
  }

  /** @internal */
  controlChanged(): void {
    // The field only pushes state to the control; it has nothing to read back.
  }

  #observed: Element | null = null;

  /** The control the field labels: the `input-id` element, else the first form control, else the first child. */
  #control(): HTMLElement | null {
    if (this.inputId) {
      const root = this.getRootNode() as Document | ShadowRoot;
      return root.getElementById?.(this.inputId) ?? null;
    }
    const owned = ':not([data-tct-owned])';
    // A group label names the group itself: its container, not one control inside it.
    if (this.groupLabel) return this.querySelector<HTMLElement>(`:scope > ${owned}`);
    return (
      this.querySelector<HTMLElement>(`:scope > ${NATIVE_CONTROL}`) ??
      this.querySelector<HTMLElement>(NATIVE_CONTROL) ??
      this.querySelector<HTMLElement>(`:scope > ${owned}`)
    );
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('statusType') && this.statusType !== undefined) {
      if (!INPUT_STATUS_TYPES.includes(this.statusType)) {
        devWarn(
          `field:status:${this.statusType}`,
          `status-type "${this.statusType}" is not one of ${INPUT_STATUS_TYPES.join(', ')}.`,
        );
      }
    }
    if (this.optional && this.required) {
      devWarn(
        'field:optional-required',
        'optional and required are mutually exclusive; optional takes precedence.',
      );
    }
    const horizontal = this.#layout.value?.direction === 'horizontal-labels';
    // The host disappears as a box so a parent grid places the label and the control in its columns.
    this.toggleAttribute('data-horizontal-labels', horizontal);
    this.#provider.setValue({
      inputId: this.#control()?.id || undefined,
      labelId: this.#chrome.labelId,
      descriptionId: this.description ? this.#chrome.descriptionId : undefined,
      statusId: this.statusMessage ? this.#chrome.statusId : undefined,
      statusVariant: oneOf(this.statusVariant, FIELD_STATUS_VARIANTS, 'attached'),
      disabled: this.disabled,
      required: this.required,
      invalid: this.statusType === 'error',
    });
  }

  protected override updated(changed: PropertyValues<this>): void {
    // The satellites are created by the chrome controller; the rest of their state is ours to set.
    const label = this.#chrome.satellite('label') as TctFieldLabel | undefined;
    if (label) {
      label.disabled = this.disabled;
      label.labelIcon = this.labelIcon;
    }
    const status = this.#chrome.satellite('status') as TctFieldStatus | undefined;
    if (status) {
      status.type = oneOf(this.statusType, INPUT_STATUS_TYPES, 'error');
      status.variant = this.statusVariant === 'detached' ? 'detached' : 'attached';
    }
    // A wrapped library control follows the field's error state.
    const control = this.#control();
    if (control !== this.#observed) {
      if (this.#observed) unobserveControl(this.#observed, this);
      this.#observed = control?.localName.startsWith('tct-') ? control : null;
      if (this.#observed) observeControl(this.#observed, this);
    } else if (this.#observed && changed.has('statusType')) {
      (this.#observed as Partial<{requestUpdate(): void}>).requestUpdate?.();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.#observed) unobserveControl(this.#observed, this);
    this.#observed = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('click', this.#onClick);
  }

  override render() {
    const width = toCssLength(this.width);
    return html`<div
      class="field"
      part="field"
      data-layout=${ifDefined(this.#layout.value?.direction === 'horizontal-labels' ? 'horizontal-labels' : undefined)}
      ?data-label-hidden=${this.labelHidden}
      style=${styleMap({'--_field-width': width})}
    >
      <div class="label-cell">
        <div class="label-row">
          <slot name="label"></slot>
          ${this.labelHidden ? nothing : renderLabelTip(this.labelTooltip, this.#locale.t('moreInfo'))}
        </div>
        ${
          this.#layout.value?.direction === 'horizontal-labels'
            ? nothing
            : html`<slot name="description"></slot>`
        }
      </div>
      <div class="control-cell">
        ${
          this.#layout.value?.direction === 'horizontal-labels'
            ? html`<slot name="description"></slot>`
            : nothing
        }
        <slot></slot>
        <slot name="status"></slot>
      </div>
    </div>`;
  }

  /** The description reads as part of the label's hit target, except over nested controls or a text selection. */
  readonly #onClick = (event: MouseEvent): void => {
    const description = this.#chrome.satellite('description');
    if (!description || !event.composedPath().includes(description)) return;
    if (this.disabled || isSelectingText()) return;
    const origin = event.composedPath()[0];
    if (origin instanceof Element && origin !== description && origin.closest(NESTED_INTERACTIVE))
      return;
    const control = this.#control();
    if (control) activateControl(control);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-field': TctField;
  }
}
