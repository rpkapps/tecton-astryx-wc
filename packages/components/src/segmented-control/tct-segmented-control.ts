import {html, nothing, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import type {ElementSize} from '@tecton-astryx/core/context/keys.js';
import {RovingTabindexController} from '@tecton-astryx/core/controllers/roving-tabindex.js';
import {SizeController} from '@tecton-astryx/core/controllers/size.js';
import {TooltipController} from '@tecton-astryx/core/controllers/tooltip.js';
import {
  KeyboardHintController,
  keyboardHintStyles,
} from '@tecton-astryx/core/controllers/keyboard-hint.js';
import {requiredValidator} from '@tecton-astryx/core/forms/validators.js';
import {FormControlMixin, type Validator} from '@tecton-astryx/core/mixins/form-control.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import styles from './tct-segmented-control.styles.css';
import {
  segmentedControlContext,
  type SegmentedControlContextValue,
} from './segmented-control.context.js';
import {SEGMENTED_CONTROL_LAYOUTS, type SegmentedControlLayout} from './segmented-control.types.js';
import type {TctSegmentedControlItem} from './tct-segmented-control-item.js';

/**
 * A single choice from a small set of mutually exclusive options, all visible at once. It is a radio
 * group (`role="radiogroup"`, items are `role="radio"`) that selects on focus like the APG radio
 * pattern: one Tab stop, arrows move focus and selection together, Home and End jump to the ends.
 *
 * Give it a `name` and it takes part in a form (form-associated: submits, resets, restores, follows a
 * disabled fieldset). It controls a value, not a view: for page or panel navigation use tabs or links.
 *
 * `value` (property) is the current selection; the `value` attribute is the initial one. Changing it
 * from code never fires events; a user selecting a segment fires `input` then `change`.
 *
 * @summary Mutually exclusive choices shown as one connected strip; a radio group that selects on focus.
 * @tag tct-segmented-control
 * @upstream SegmentedControl
 * @slot - `tct-segmented-control-item` children.
 * @csspart control - The strip that holds the segments (Astryx target `astryx-segmented-control`).
 * @csspart keyboard-hint - The arrow-key hint shown once on first keyboard focus.
 * @csspart disabled-message - The tooltip that explains a disabled control (`disabled-message`).
 * @fires input - A user selected a segment (native event, composed).
 * @fires change - A user selected a segment; fired once after `input`.
 * @cssstate disabled - The control is disabled.
 * @cssstate user-invalid - Required and empty after the user tried to submit or left the control.
 * @cloakDisplay inline-flex
 */
export class TctSegmentedControl extends FormControlMixin(TctElement) {
  static override readonly tagName = 'tct-segmented-control';
  static override styles: CSSResultGroup = [base, keyboardHintStyles, styles];

  /** Accessible name of the radio group. It is never painted; set it, or give the element an `aria-label`. */
  @property({reflect: true}) label = '';

  /** Size of the strip and its segments. Unset follows an enclosing size provider or toolbar, else `md`. */
  @property({reflect: true}) size: ElementSize | undefined;

  /** `hug` sizes the strip and segments to their content; `fill` stretches segments equally across the container. */
  @property({reflect: true}) layout: SegmentedControlLayout = 'hug';

  /**
   * Why the control is disabled. With `disabled`, a tooltip shows this text on hover and keyboard
   * focus and the selected segment stays focusable (through `aria-disabled`) so the reason can be
   * found; selection stays blocked. Use it instead of wrapping a disabled control in a tooltip.
   */
  @property({attribute: 'disabled-message'}) disabledMessage = '';

  readonly #size = new SizeController(this, {explicit: () => this.size, fallback: 'md'});
  #lastContext: SegmentedControlContextValue | undefined;

  /**
   * A segment asks to become the value. Blocked while disabled or read-only; a segment that is already
   * the value is a no-op. Otherwise the value changes and `input` then `change` fire once.
   * (Declared before the provider: the provider's first value captures it.)
   */
  readonly #select = (item: HTMLElement, value: string): void => {
    if (this.isDisabled || this.readonly || (item as TctSegmentedControlItem).disabled) return;
    if (value === this.value) return;
    this.value = value;
    this.dispatchEvent(new Event('input', {bubbles: true, composed: true}));
    this.redispatchChange();
  };

  readonly #provider = new ContextProvider(this, {
    context: segmentedControlContext,
    initialValue: this.#contextValue(),
  });

  readonly #roving = new RovingTabindexController<TctSegmentedControlItem>(this, {
    items: () => this.#items(),
    orientation: 'horizontal',
    wrap: true,
    isDisabled: (item) => this.#itemDisabled(item),
    // APG radio group: selection follows focus. Tab into the group stays a pure focus move.
    activateOnFocus: true,
    onActivate: (item) => {
      this.#select(item, item.value);
    },
  });

  readonly #hint = new KeyboardHintController(this, {
    orientation: 'horizontal',
    enabled: () => !this.isDisabled,
  });

  /** Explains a disabled control (`disabled-message`); anchored to the strip, shown on hover and keyboard focus. */
  protected readonly disabledTooltip = new TooltipController(this, {
    mode: 'shadow',
    trigger: () => this.renderRoot.querySelector<HTMLElement>('.control'),
    surface: () => this.renderRoot.querySelector<HTMLElement>('.disabled-message'),
    content: () => (this.#showsDisabledMessage ? this.disabledMessage : ''),
    enabled: () => this.#showsDisabledMessage,
    // The control itself is not focusable: focus arrives from a segment and bubbles up to it.
    focusTrigger: 'always',
    touchTrigger: 'none',
  });

  constructor() {
    super();
    this.addEventListener('click', this.#onLabelClick);
  }

  /**
   * The radiogroup element. A form-associated composite keeps its role element in the shadow root:
   * the form mixin delegates the host's `aria-*` and its `<label for>` labels to it, sets `aria-invalid`
   * on it at the moment the error shows, and the reason tooltip's `aria-describedby` stays in one tree
   * [mwg:accessible-web-components]. The segments are its flat-tree children, through the slot.
   */
  protected override get formControl(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.control');
  }

  get #showsDisabledMessage(): boolean {
    return this.isDisabled && this.disabledMessage !== '';
  }

  /** The segments, in DOM order. */
  #items(): TctSegmentedControlItem[] {
    return [...this.children].filter(
      (child): child is TctSegmentedControlItem => child.localName === 'tct-segmented-control-item',
    );
  }

  /** Disabled for keyboard purposes; a disabled control keeps its selected segment focusable when it explains itself. */
  #itemDisabled(item: TctSegmentedControlItem): boolean {
    if (item.disabled) return true;
    if (!this.isDisabled) return false;
    return !(this.disabledMessage !== '' && item.selected);
  }

  #contextValue(): SegmentedControlContextValue {
    const next: SegmentedControlContextValue = {
      value: this.value,
      size: this.#size.value,
      layout: SEGMENTED_CONTROL_LAYOUTS.includes(this.layout) ? this.layout : 'hug',
      disabled: this.isDisabled,
      hasDisabledMessage: this.#showsDisabledMessage,
      select: this.#select,
    };
    const last = this.#lastContext;
    // Keep the identity while nothing changed: every change re-renders every segment.
    if (
      last?.value === next.value &&
      last.size === next.size &&
      last.layout === next.layout &&
      last.disabled === next.disabled &&
      last.hasDisabledMessage === next.hasDisabledMessage
    ) {
      return last;
    }
    this.#lastContext = next;
    return next;
  }

  protected override get validationAnchor(): HTMLElement | null {
    return this.#roving.active ?? this.#items()[0] ?? null;
  }

  protected override get validators(): Validator<this>[] {
    // The browser's own localized "select one of these options" message, like a native radio group.
    return [requiredValidator<this>((control) => control.value === '', 'radio')];
  }

  protected override formValue(): string | null {
    return this.value === '' ? null : this.value;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('layout') && !SEGMENTED_CONTROL_LAYOUTS.includes(this.layout)) {
      devWarn(
        'segmented-control:layout',
        `<tct-segmented-control layout="${this.layout}"> is not one of ${SEGMENTED_CONTROL_LAYOUTS.join(', ')}; using "hug".`,
      );
    }
    this.#provider.setValue(this.#contextValue());
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.toggleState('disabled', this.isDisabled);
    if (!this.label && !this.hasAttribute('aria-label') && !this.hasAttribute('aria-labelledby')) {
      devWarn(
        'segmented-control:label',
        '<tct-segmented-control> needs a `label` (or aria-label): it is the accessible name of the radio group.',
      );
    }
    void this.#settleItems();
  }

  /** Segments render (and can receive `tabindex`) after the control does: then the tab stop is placed. */
  async #settleItems(): Promise<void> {
    const pending: Promise<boolean>[] = [];
    for (const item of this.#items()) pending.push(item.updateComplete);
    await Promise.all(pending);
    const selected = this.#items().find((item) => item.selected && !this.#itemDisabled(item));
    if (selected) this.#roving.setActive(selected);
    else this.#roving.update();
    this.syncFormState();
  }

  readonly #onSlotChange = (): void => {
    void this.#settleItems();
  };

  /** `<label for>` reaches the host: focus the segment that holds the tab stop. */
  readonly #onLabelClick = (event: MouseEvent): void => {
    if (event.composedPath()[0] !== this || this.isDisabled) return;
    this.#roving.setActive(this.#roving.active, {focus: true});
  };

  override render() {
    return html`<div
        class="control"
        part="control"
        role="radiogroup"
        aria-label=${this.label || nothing}
        aria-disabled=${this.isDisabled ? 'true' : nothing}
        aria-required=${this.required ? 'true' : nothing}
        aria-readonly=${this.readonly ? 'true' : nothing}
        data-size=${this.#size.value}
        data-layout=${SEGMENTED_CONTROL_LAYOUTS.includes(this.layout) ? this.layout : 'hug'}
        data-disabled=${this.isDisabled ? '' : nothing}
        data-has-message=${this.#showsDisabledMessage ? '' : nothing}
      >
        <slot @slotchange=${this.#onSlotChange}></slot>
        ${this.#hint.render()}
      </div>
      <span class="disabled-message" part="disabled-message" popover="manual"
        >${this.#showsDisabledMessage ? this.disabledMessage : nothing}</span
      >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-segmented-control': TctSegmentedControl;
  }
}
