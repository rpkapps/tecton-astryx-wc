import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {styleMap} from 'lit/directives/style-map.js';
import type {ElementSize} from '@tecton-astryx/core/context/keys.js';
import {SizeController} from '@tecton-astryx/core/controllers/size.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import {
  FIELD_STATUS_VARIANTS,
  INPUT_STATUS_TYPES,
  type FieldStatusVariant,
  type InputStatus,
} from '../field/field.types.js';
import {
  activateControl,
  isSelectingText,
  NESTED_INTERACTIVE,
  oneOf,
  STATUS_ICON,
} from '../field/field-utils.js';
import base from '../styles/base.styles.css';
import field from '../styles/field.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import motion from '../styles/motion.styles.css';
import slottedIcon from '../styles/slotted-icon.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {TctFieldControl} from './tct-field-control.js';
import styles from './tct-box-control.styles.css';

/** Field heights (`--size-element-sm/md/lg`). */
export const FIELD_SIZES = ['sm', 'md', 'lg'] as const;
export type FieldSize = (typeof FIELD_SIZES)[number];

/**
 * The shared body of the controls that draw the Tecton outlined field box around a native control
 * (text area, number input, file input): the box with its status border, the status glyph (and, for the
 * `tooltip` variant, its focusable button), the busy spinner, the field layout with the label and
 * description cells, the horizontal-labels layout of a form, and the input-group hand-off (inside a
 * group the group owns the label, description and status). Subclasses put their own control inside the
 * box (`renderBoxWrapper`) and lay it out with `renderFieldLayout`.
 *
 * @internal
 * @summary Base of the form controls that draw the outlined field box.
 */
export abstract class TctBoxControl extends TctFieldControl {
  static override styles: CSSResultGroup = [
    base,
    visuallyHidden,
    focusRing,
    motion,
    slottedIcon,
    field,
    styles,
  ];

  /** Hint shown while the control is empty. Not a substitute for the label. */
  @property() placeholder = '';

  /** Name of an icon shown before the label text (a registered icon such as `info`). */
  @property({attribute: 'label-icon'}) labelIcon = '';

  /**
   * How the status message is placed: `attached` below the field, `detached` as a separate message with
   * an icon, `tooltip` with no message box (the status icon becomes a focusable button that reveals it).
   */
  @property({attribute: 'status-variant'}) statusVariant: FieldStatusVariant = 'attached';

  /** Field height: `sm`, `md` or `lg`. Explicit, then the enclosing size provider, then `md`. */
  @property({reflect: true}) size: FieldSize | undefined;

  readonly #size = new SizeController<FieldSize>(this, {
    explicit: () => (this.size ? oneOf(this.size, FIELD_SIZES, 'md') : undefined),
    fallback: 'md',
  });

  // ------------------------------------------------------------------------------ mixin hooks

  protected override get fieldSize(): ElementSize {
    return this.#size.value;
  }

  protected override get effectiveStatusVariant(): FieldStatusVariant {
    return oneOf(this.statusVariant, FIELD_STATUS_VARIANTS, 'attached');
  }

  /** Whether the control is inside an input group (the group owns label, description and status). */
  protected get inGroup(): boolean {
    return this.groupContext.value !== null && this.groupContext.value !== undefined;
  }

  /** Id of the visually hidden label a control inside an input group is named by. */
  protected get groupLabelId(): string | undefined {
    return this.inGroup ? this.ids.id('group-label') : undefined;
  }

  // ---------------------------------------------------------------------------------- lifecycle

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed);
    if (changed.has('statusVariant') && !FIELD_STATUS_VARIANTS.includes(this.statusVariant)) {
      devWarn(
        `${this.localName}:status-variant:${this.statusVariant}`,
        `status-variant "${this.statusVariant}" is not one of ${FIELD_STATUS_VARIANTS.join(', ')}.`,
      );
    }
    if (changed.has('size') && this.size && !FIELD_SIZES.includes(this.size)) {
      devWarn(
        `${this.localName}:size:${this.size}`,
        `size "${this.size}" is not one of ${FIELD_SIZES.join(', ')}.`,
      );
    }
    // The host disappears as a box so a parent grid places the label and the field in its columns.
    this.toggleAttribute('data-horizontal-labels', this.horizontalLabels);
  }

  /** The enclosing form lays labels beside the fields (and this is not inside an input group). */
  protected get horizontalLabels(): boolean {
    return this.layoutContext.value?.direction === 'horizontal-labels' && !this.inGroup;
  }

  // -------------------------------------------------------------------------------- rendering

  /** The label row, with the label icon before the text. */
  protected override renderLabelRow(): TemplateResult {
    return html`${
      this.labelIcon && !this.labelHidden
        ? html`<tct-icon
            class="label-icon"
            part="label-icon"
            name=${this.labelIcon}
            size="sm"
            color="inherit"
            @click=${this.#onDescriptionClick}
          ></tct-icon>`
        : nothing
    }${super.renderLabelRow()}`;
  }

  /**
   * The field: label and description in one cell, the box and status in the other. Inside an input group
   * the group owns the label, description and status, so only the box (and the hidden helper text) stays.
   */
  protected renderFieldLayout(box: TemplateResult): TemplateResult {
    if (this.inGroup) return html`${box}${this.renderHelpers()}`;
    const horizontal = this.horizontalLabels;
    const slotted = this.slottedControl !== null;
    return html`<div
        class="field"
        part="field"
        data-layout=${ifDefined(horizontal ? 'horizontal-labels' : undefined)}
        ?data-label-hidden=${this.labelHidden}
        style=${styleMap({'--_field-width': this.cssWidth})}
      >
        <div class="label-cell">
          <div class="label-row">${this.renderLabelRow()}</div>
          ${horizontal ? nothing : this.#renderDescription(slotted)}
        </div>
        <div class="control-cell">
          ${horizontal ? this.#renderDescription(slotted) : nothing} ${box}
          ${this.renderStatusMessage()}
        </div>
      </div>
      ${this.renderHelpers()}`;
  }

  #renderDescription(slotted: boolean): TemplateResult {
    return slotted
      ? html`<slot name="description"></slot>`
      : html`<div class="description-click" @click=${this.#onDescriptionClick}>
          ${this.renderDescriptionText()}
        </div>`;
  }

  /**
   * The painted box around the control (part `input`): border, status colour and the ring on
   * `:has(:focus-visible)`, wrapped in the tooltip that explains a disabled control. `content` is the
   * control and its adornments.
   */
  protected renderBoxWrapper(content: TemplateResult): TemplateResult {
    const status = this.effectiveStatus;
    const box = html`<div
      class="input-wrapper focus-within-ring"
      part="input"
      data-size=${this.#size.value}
      data-status=${ifDefined(status?.type)}
      ?data-disabled=${this.isDisabled}
      ?data-readonly=${this.readonly}
      ?data-in-group=${this.inGroup}
      @click=${this.#onBoxClick}
    >
      ${
        this.inGroup
          ? html`<span class="visually-hidden" id=${this.ids.id('group-label')}
              >${this.label}</span
            >`
          : nothing
      }
      ${content}
    </div>`;
    return html`<tct-tooltip
      content=${this.showsDisabledMessage ? this.disabledMessage : ''}
      placement="above"
      focus-trigger="always"
      >${box}</tct-tooltip
    >`;
  }

  /** The spinner of a busy control (`loading` or a pending change action). Decorative: `aria-busy` says it. */
  protected renderBusy(): TemplateResult | typeof nothing {
    if (!this.busy) return nothing;
    return html`<span class="busy" part="busy" aria-hidden="true"
      ><tct-spinner size="sm" shade="subtle"></tct-spinner
    ></span>`;
  }

  /**
   * The status glyph inside the box: plain for `attached`, none for `detached` (its message has its own
   * icon) and none inside a group, and for `tooltip` a real focusable button that reveals the message
   * (keyboard users reach it, touch taps it, assistive technology reads its status as the name).
   */
  protected renderStatusIcon(): TemplateResult | typeof nothing {
    const status: InputStatus | undefined = this.effectiveStatus;
    if (!status || this.inGroup) return nothing;
    const variant = this.effectiveStatusVariant;
    if (variant === 'detached') return nothing;
    const type = oneOf(status.type, INPUT_STATUS_TYPES, 'error');
    const icon = html`<tct-icon
      class="status-icon"
      part="status-icon"
      name=${STATUS_ICON[type]}
      color="inherit"
      data-status-type=${type}
    ></tct-icon>`;
    if (variant !== 'tooltip' || !status.message) return icon;
    return html`<tct-tooltip content=${status.message} placement="above" touch-trigger="tap"
      ><button
        type="button"
        class="status-button focus-ring"
        part="status-button"
        data-status-type=${type}
        aria-label=${this.fieldLocale.t(
          type === 'info' ? '@tct.field.infoDetails' : `@astryx.input.statusButton.${type}`,
        )}
      >
        ${icon}
      </button></tct-tooltip
    >`;
  }

  // ---------------------------------------------------------------------------------- events

  /** Pressing chrome (the icon, the padding) focuses the control, except over nested controls or a selection. */
  readonly #onBoxClick = (event: MouseEvent): void => {
    if (this.isDisabled && !this.showsDisabledMessage) return;
    if (isSelectingText()) return;
    const origin = event.composedPath()[0];
    const control = this.formControl;
    if (origin instanceof Element && origin.closest(NESTED_INTERACTIVE) && origin !== control)
      return;
    if (control && origin !== control) activateControl(control);
  };

  /** The description reads as part of the label's hit target. */
  readonly #onDescriptionClick = (event: MouseEvent): void => {
    if (this.isDisabled || isSelectingText()) return;
    const origin = event.composedPath()[0];
    if (origin instanceof Element && origin.closest(NESTED_INTERACTIVE)) return;
    const control = this.formControl;
    if (control) activateControl(control);
  };
}
