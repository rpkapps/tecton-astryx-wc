import {html, nothing, unsafeCSS, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import fieldMessages from '@tecton-wc/locales/en/field.js';
import {formLayoutContext, inputGroupContext, sizeContext} from '@tecton-wc/core/context/keys.js';
import type {InputGroupContextValue} from '@tecton-wc/core/context/keys.js';
import {ContextConsumer, ContextProvider} from '@tecton-wc/core/context/protocol.js';
import {FieldChromeController} from '@tecton-wc/core/controllers/field-chrome.js';
import {SizeController} from '@tecton-wc/core/controllers/size.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {
  observeControl,
  unobserveControl,
  type ControlObserver,
} from '@tecton-wc/core/mixins/form-control.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {adoptLightDomStyles} from '@tecton-wc/core/styles/light-dom.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {INPUT_STATUS_TYPES, type InputStatus, type InputStatusType} from '../field/field.types.js';
import {renderLabelTip} from '../field/field-label-tip.js';
import {oneOf} from '../field/field-utils.js';
import {TctFieldStatus} from '../field-status/tct-field-status.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctTooltip} from '../tooltip/tct-tooltip.js';
import base from '../styles/base.styles.css';
import field from '../styles/field.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {INPUT_GROUP_SIZES, type InputGroupSize} from './input-group.types.js';
import lightStyles from './tct-input-group.light.css?inline';
import styles from './tct-input-group.styles.css';

/**
 * Joins one input with prefix or suffix addons into a single connected field: shared border, shared
 * height and **one** focus ring drawn around the whole group, addons included. It also owns the label,
 * description and status of the field, so the controls inside (`tct-text-input`, `tct-number-input`, a
 * selector, ...) are labelled by their own `label` (kept for assistive technology, never shown) and show
 * no chrome of their own.
 *
 * The group is a `role="group"` named by its label. It provides its `size` to the controls inside
 * (they follow it unless they set their own) and mirrors their displayed invalidity onto the addon
 * borders. It has no value and does not take part in the form: the controls inside submit themselves.
 * `disabled` dims the group and its label; it does not disable the controls, so set `disabled` on them
 * (or wrap the form in a `<fieldset disabled>`).
 *
 * Inside the group, a control draws its box with square inner corners, overlapping borders and no ring
 * of its own: the group's stylesheet reaches each child's `part="input"` (a light-DOM sheet adopted into
 * the tree the group lives in), so any control that names its painted box `input` joins the group.
 *
 * @summary Connects an input with prefix and suffix addons under one label, border and focus ring.
 * @tag tct-input-group
 * @upstream InputGroup
 * @slot - The controls and addons: `tct-input-group-text`, `tct-text-input`, `tct-number-input`, a button.
 * @csspart field - The whole field: label, group and status.
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart label-indicator - The "Required" or "Optional" text.
 * @csspart label-tip - The info-tip button.
 * @csspart group - The connected box around the controls; carries the one focus ring.
 * @csspart status - The status message box.
 * @cssstate disabled - The group is disabled.
 * @cssstate invalid - A control inside displays invalidity, or the status is an error.
 * @cloakDisplay block
 * @cloakMinBlockSize 2rem
 */
export class TctInputGroup extends TctElement {
  static override readonly tagName = 'tct-input-group';
  static override readonly dependencies = [TctFieldStatus, TctIcon, TctTooltip];
  static override styles: CSSResultGroup = [base, visuallyHidden, focusRing, field, styles];

  /** The label of the group (required for accessibility; hide it visually with `label-hidden`). */
  @property() label = '';

  /** Hides the label and description visually while keeping them for assistive technology. */
  @property({type: Boolean, reflect: true, attribute: 'label-hidden'}) labelHidden = false;

  /** Helper text between the label and the group. */
  @property() description = '';

  /** Dims the group and its label. It does not disable the controls inside. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** Optional field: an "Optional" indicator. Wins over `required`. */
  @property({type: Boolean}) optional = false;

  /** Required field: a "Required" indicator (an announcement only; the controls carry the constraint). */
  @property({type: Boolean}) required = false;

  /** Height of the group and default size of the controls inside: `sm`, `md` or `lg`. Unset: an enclosing size provider, else `md`. */
  @property({reflect: true}) size: InputGroupSize | undefined;

  /** The kind of status: colours the addon borders and shows the message under the group. */
  @property({attribute: 'status-type'}) statusType: InputStatusType | undefined;

  /** The status message. Without it the status only colours the borders. */
  @property({attribute: 'status-message'}) statusMessage = '';

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

  /** Text of an info tip shown as a small icon button after the label. */
  @property({attribute: 'label-tooltip'}) labelTooltip = '';

  readonly #size: SizeController<InputGroupSize> = new SizeController<InputGroupSize>(this, {
    explicit: () => (this.size ? oneOf(this.size, INPUT_GROUP_SIZES, 'md') : undefined),
    fallback: 'md',
  });
  readonly #layout: ContextConsumer<typeof formLayoutContext> = new ContextConsumer<
    typeof formLayoutContext
  >(this, {context: formLayoutContext, subscribe: true});
  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'field',
    defaults: fieldMessages,
  });
  readonly #sizeProvider: ContextProvider<typeof sizeContext> = new ContextProvider<
    typeof sizeContext
  >(this, {context: sizeContext, initialValue: null});
  readonly #groupProvider: ContextProvider<typeof inputGroupContext> = new ContextProvider<
    typeof inputGroupContext
  >(this, {
    context: inputGroupContext,
    initialValue: null,
  });
  readonly #chrome: FieldChromeController = new FieldChromeController(this, {
    mode: () => 'shadow',
    control: () => this.renderRoot.querySelector<HTMLElement>('.group'),
    state: () => ({
      label: this.label,
      labelHidden: this.labelHidden,
      description: this.description || undefined,
      status: this.statusType
        ? {type: this.statusType, message: this.statusMessage || undefined}
        : undefined,
      statusVariant: 'detached',
      required: this.required,
      optional: this.optional,
      disabled: this.disabled,
      size: this.#size.value,
      groupLabel: true,
    }),
  });

  /** Controls that displayed invalidity is followed on (`observeControl`). */
  readonly #observed = new Set<Element>();
  readonly #observer: ControlObserver = {
    controlChanged: () => {
      const invalid = this.#anyControlInvalid();
      if (invalid !== this.#invalid) {
        this.#invalid = invalid;
        this.requestUpdate();
      }
    },
  };
  #invalid = false;
  /** Whether keyboard focus (`:focus-visible`) is inside the group: the group draws the one ring. */
  #focusVisible = false;

  constructor() {
    super();
    this.addEventListener('focusin', this.#onFocusIn);
    this.addEventListener('focusout', this.#onFocusOut);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // The controls reach their painted box through `::part(input)`, which only a sheet in the tree that
    // contains the group can address (A§6.7).
    adoptLightDomStyles(this, unsafeCSS(lightStyles));
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const control of this.#observed) unobserveControl(control, this.#observer);
    this.#observed.clear();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('size') && this.size && !INPUT_GROUP_SIZES.includes(this.size)) {
      devWarn(
        `input-group:size:${this.size}`,
        `<tct-input-group size="${this.size}"> is not one of ${INPUT_GROUP_SIZES.join(', ')}.`,
      );
    }
    if (
      changed.has('statusType') &&
      this.statusType &&
      !INPUT_STATUS_TYPES.includes(this.statusType)
    ) {
      devWarn(
        `input-group:status:${this.statusType}`,
        `status-type "${this.statusType}" is not one of ${INPUT_STATUS_TYPES.join(', ')}.`,
      );
    }
    if (!this.label && !this.hasAttribute('aria-label') && !this.hasAttribute('aria-labelledby')) {
      devWarn(
        'input-group:label',
        '<tct-input-group> needs a `label`: it is the accessible name of the group.',
      );
    }
    this.#sizeProvider.setValue(this.#size.value);
    const describedByIds =
      [
        this.description ? this.#chrome.descriptionId : undefined,
        this.statusMessage && this.statusType ? this.#chrome.statusId : undefined,
      ]
        .filter(Boolean)
        .join(' ') || undefined;
    const current = this.#groupProvider.value;
    if (current?.labelId !== this.#chrome.labelId || current.describedByIds !== describedByIds) {
      const value: InputGroupContextValue = {
        isInGroup: true,
        labelId: this.#chrome.labelId,
        describedByIds,
      };
      this.#groupProvider.setValue(value);
    }
    // The host disappears as a box so a parent grid places the label and the group in its columns.
    this.toggleAttribute(
      'data-horizontal-labels',
      this.#layout.value?.direction === 'horizontal-labels',
    );
  }

  protected override updated(): void {
    this.toggleState('disabled', this.disabled);
    this.toggleState('invalid', this.#invalid || this.statusType === 'error');
  }

  #anyControlInvalid(): boolean {
    for (const control of this.#observed) {
      if ((control as {showInvalid?: boolean}).showInvalid) return true;
    }
    return false;
  }

  /** Follows the displayed invalidity of every form control among the slotted children. */
  readonly #onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    const controls = new Set<Element>(
      slot
        .assignedElements({flatten: true})
        .filter((element) => 'showInvalid' in element && 'checkValidity' in element),
    );
    for (const control of this.#observed) {
      if (controls.has(control)) continue;
      unobserveControl(control, this.#observer);
      this.#observed.delete(control);
    }
    for (const control of controls) {
      if (this.#observed.has(control)) continue;
      this.#observed.add(control);
      observeControl(control, this.#observer);
    }
    this.#observer.controlChanged(this);
  };

  readonly #onFocusIn = (event: FocusEvent): void => {
    const origin = event.composedPath()[0];
    let visible = false;
    try {
      visible = origin instanceof Element && origin.matches(':focus-visible');
    } catch {
      visible = true;
    }
    if (visible !== this.#focusVisible) {
      this.#focusVisible = visible;
      this.requestUpdate();
    }
  };

  readonly #onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    if (next instanceof Node && this.contains(next)) return;
    if (this.#focusVisible) {
      this.#focusVisible = false;
      this.requestUpdate();
    }
  };

  override render() {
    const size = this.#size.value;
    const status = this.statusType
      ? {type: oneOf(this.statusType, INPUT_STATUS_TYPES, 'error'), message: this.statusMessage}
      : undefined;
    const horizontal = this.#layout.value?.direction === 'horizontal-labels';
    const invalid = this.#invalid || status?.type === 'error';
    return html`<div
      class="field"
      part="field"
      data-layout=${ifDefined(horizontal ? 'horizontal-labels' : undefined)}
      ?data-label-hidden=${this.labelHidden}
    >
      <div class="label-cell">
        <div class="label-row">
          ${this.#chrome.renderLabel()}
          ${this.labelHidden ? nothing : renderLabelTip(this.labelTooltip, this.#locale.t('moreInfo'))}
        </div>
        ${this.#chrome.renderDescription()}
      </div>
      <div class="control-cell">
        <div
          class="group"
          part="group"
          role="group"
          aria-disabled=${this.disabled ? 'true' : nothing}
          data-size=${size}
          data-status=${ifDefined(invalid ? 'error' : status?.type)}
          ?data-disabled=${this.disabled}
          ?data-focus-visible=${this.#focusVisible}
        >
          <slot @slotchange=${this.#onSlotChange}></slot>
        </div>
        ${
          status?.message
            ? html`<tct-field-status
                id=${this.#chrome.statusId}
                data-tct-owned
                type=${status.type}
                variant="detached"
                >${status.message}</tct-field-status
              >`
            : nothing
        }
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-input-group': TctInputGroup;
  }
}
