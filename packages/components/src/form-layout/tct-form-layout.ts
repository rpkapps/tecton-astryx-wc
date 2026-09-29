import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {formLayoutContext, type FormLayoutContextValue} from '@tecton-astryx/core/context/keys.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {
  FORM_LAYOUT_DIRECTIONS,
  FORM_OPTIONALITIES,
  type FormLayoutDirection,
  type FormOptionality,
} from './form-layout.types.js';
import styles from './tct-form-layout.styles.css';

/**
 * Arranges form fields with consistent spacing and direction, and tells the fields inside it how to
 * lay themselves out. It handles where fields go, not state or submission: wrap it in a `<form>` for
 * that.
 *
 * It publishes its `direction` and `default-optionality` through `formLayoutContext` (nearest layout
 * wins, so a horizontal layout nested in a vertical one works). `tct-field`, `tct-text-input` and the
 * other form controls read it: with `horizontal-labels` each control puts its label in the first
 * column and itself in the second (the fields render with `display: contents` so their label and
 * control become the grid items); with `default-optionality` a control marks only the exception.
 *
 * @summary Lays out form fields vertically, side by side, or with labels beside their controls.
 * @tag tct-form-layout
 * @upstream FormLayout
 * @slot - The form fields to arrange.
 * @csspart base - The container that holds the fields (Astryx target `astryx-form-layout`).
 * @cloakDisplay block
 */
export class TctFormLayout extends TctElement {
  static override readonly tagName = 'tct-form-layout';
  static override styles: CSSResultGroup = [base, styles];

  /**
   * `vertical` (default) stacks the fields; `horizontal` arranges them left to right with equal
   * widths; `horizontal-labels` uses a grid with the labels left of the controls (it collapses to a
   * single column at 480px viewport width and below, and needs to be the outermost layout).
   */
  @property({reflect: true}) direction: FormLayoutDirection = 'vertical';

  /**
   * The state the form treats as its default, so only the exception is marked: `optional` means only
   * required fields show an indicator; `required` means only optional fields do, and unmarked
   * controls also expose `aria-required`. Unset, every control keeps its own indicator behaviour.
   */
  @property({attribute: 'default-optionality'}) defaultOptionality: FormOptionality | undefined;

  readonly #context = new ContextProvider(this, {
    context: formLayoutContext,
    initialValue: {direction: 'vertical'},
  });

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('direction') && !FORM_LAYOUT_DIRECTIONS.includes(this.direction)) {
      devWarn(
        `form-layout:direction:${String(this.direction)}`,
        `direction="${String(this.direction)}" is not one of ${FORM_LAYOUT_DIRECTIONS.join(', ')}.`,
      );
    }
    if (
      changed.has('defaultOptionality') &&
      this.defaultOptionality !== undefined &&
      !FORM_OPTIONALITIES.includes(this.defaultOptionality)
    ) {
      devWarn(
        `form-layout:optionality:${String(this.defaultOptionality)}`,
        `default-optionality="${String(this.defaultOptionality)}" is not one of ${FORM_OPTIONALITIES.join(', ')}.`,
      );
    }
    // A new object only when something changed, so subscribers re-render only for real changes.
    if (changed.has('direction') || changed.has('defaultOptionality') || !this.hasUpdated) {
      this.#context.setValue(this.#value());
    }
  }

  #value(): FormLayoutContextValue {
    const direction = FORM_LAYOUT_DIRECTIONS.includes(this.direction) ? this.direction : 'vertical';
    const optionality = FORM_OPTIONALITIES.find((item) => item === this.defaultOptionality);
    return optionality === undefined ? {direction} : {direction, optionality};
  }

  override render(): TemplateResult {
    const direction = FORM_LAYOUT_DIRECTIONS.includes(this.direction) ? this.direction : 'vertical';
    return html`<div part="base" class="base" data-direction=${direction}><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-form-layout': TctFormLayout;
  }
}
