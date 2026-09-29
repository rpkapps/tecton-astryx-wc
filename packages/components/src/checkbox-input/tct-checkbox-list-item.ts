import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {live} from 'lit/directives/live.js';
import checkboxListMessages from '@tecton-astryx/locales/en/checkboxList.js';
import {ContextConsumer, ContextProvider} from '@tecton-astryx/core/context/protocol.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {IdController} from '@tecton-astryx/core/utils/id.js';
import {listContext} from '../list/list.context.js';
import type {ListContextValue} from '../list/list.types.js';
import {TctListItem} from '../list/tct-list-item.js';
import base from '../styles/base.styles.css';
import {checkboxListContext} from './checkbox-list.context.js';
import {TctCheckboxInput} from './tct-checkbox-input.js';
import styles from './tct-checkbox-list-item.styles.css';

/**
 * One option of a `tct-checkbox-list`, or a checkbox row of any `tct-list` (a "select all" row). It is a
 * list row with a checkbox in its start slot: the checkbox is the row's one tab stop and its action, and
 * a click anywhere on the row surface toggles it (a click on a link or button in the label or in `end`
 * keeps its own meaning). Density, dividers and the checkbox size (compact rows draw the small box) come
 * from the enclosing list.
 *
 * **Inside a `tct-checkbox-list`**, an item with a `value` is an option: its state comes from the list's
 * `values`, and `checked` and `indeterminate` are ignored. **On its own** (no `value`, or a plain
 * `tct-list`), `checked` follows the native model: the `checked` attribute is the default, the property is
 * the current state, and a user toggle fires the native `input` then `change`, once each.
 *
 * The label names the checkbox: a plain `label` directly, a rich label (`slot="label"`) through
 * `aria-labelledby` (name it with `aria-label` when it has no text). The description, plain or rich, is
 * the checkbox's accessible description.
 *
 * @summary A list row with a checkbox: an option of a checkbox list, or a standalone checkbox row.
 * @tag tct-checkbox-list-item
 * @upstream CheckboxListItem
 * @slot label - Rich label; overrides the `label` attribute. Links and buttons in it keep their own behaviour.
 * @slot description - Rich description; overrides the `description` attribute.
 * @slot end - Content after the label area: a badge, a timestamp or an action button.
 * @csspart item - The painted row.
 * @csspart list-item - The painted row (the list item's own name for it).
 * @cssstate checked - The option is checked (also standalone).
 * @cssstate busy - The item is loading or its `changeAction` is pending.
 * @cloakDisplay block
 */
export class TctCheckboxListItem extends TctElement {
  static override readonly tagName = 'tct-checkbox-list-item';
  static override readonly dependencies = [TctListItem, TctCheckboxInput];
  static override styles: CSSResultGroup = [base, styles];

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'aria-label'];
  }

  /** Primary text: the label of the row and the name of the checkbox. Rich content goes through `slot="label"`. */
  @property() label = '';

  /**
   * The option's identity inside a `tct-checkbox-list`: it is in the list's `values` while checked. An
   * item without a value is standalone.
   */
  @property() value = '';

  /** Secondary text under the label; also the checkbox's accessible description. Rich content goes through `slot="description"`. */
  @property() description = '';

  /** Disables this item only. The whole list can be disabled too. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** Shows a spinner in the checkbox and blocks toggling this item. Inside a list a pending `changeAction` does the same for the toggled item. */
  @property({type: Boolean, reflect: true}) loading = false;

  /** The `checked` attribute (standalone use): the state that form reset returns to. */
  @property({type: Boolean, attribute: 'checked'}) defaultChecked = false;

  #checked: boolean | undefined;

  /**
   * Whether the checkbox is on. Inside a checkbox list an item with a `value` reads the list's `values`
   * and ignores writes. Standalone, it follows the `checked` attribute until set or toggled. Writing it
   * fires no events.
   */
  @property({attribute: false})
  get checked(): boolean {
    const list = this.#collection;
    if (list) return list.values.includes(this.value);
    return this.#checked ?? this.defaultChecked;
  }
  set checked(value: boolean) {
    this.#checked = Boolean(value);
  }

  /** Shows the mixed state (standalone use); the user clicking it makes it checked. */
  @property({type: Boolean}) indeterminate = false;

  readonly #list = new ContextConsumer(this, {context: checkboxListContext, subscribe: true});
  /** The enclosing list's density and dividers (a checkbox list or any `tct-list`). */
  readonly #listStyle = new ContextConsumer(this, {context: listContext, subscribe: true});
  /**
   * What the row inside this item sees: the list's density, but no dividers. The divider belongs to the
   * item's own wrapper, because the inner row is always the last (and only) row of this shadow root and
   * would never draw one.
   */
  readonly #rowStyle = new ContextProvider(this, {context: listContext, initialValue: null});
  readonly #slots = new SlotController(this, 'label', 'description', 'end');
  readonly #ids = new IdController(this, 'tct-checkbox-list-item');
  readonly #locale = new LocaleController(this, {
    namespace: 'checkboxList',
    defaults: checkboxListMessages,
  });

  /** The checkbox's native `<input>`: the row's one focusable control (for focus and validation anchors). */
  get control(): HTMLInputElement | null {
    return this.#checkbox?.control ?? null;
  }

  get #checkbox(): TctCheckboxInput | null {
    return this.renderRoot?.querySelector<TctCheckboxInput>('tct-checkbox-input') ?? null;
  }

  /** The list's state, for an item that is one of its options (it has a value). */
  get #collection() {
    const list = this.#list.value;
    return list && this.value !== '' ? list : null;
  }

  /** Disabled by this item or by the whole list. */
  get isDisabled(): boolean {
    return this.disabled || (this.#list.value?.disabled ?? false);
  }

  /** `loading`, or the list's pending action is on this item. */
  get isBusy(): boolean {
    const list = this.#collection;
    return this.loading || (list?.loadingValue != null && list.loadingValue === this.value);
  }

  protected override willUpdate(_changed: PropertyValues<this>): void {
    this.internals.ariaBusy = this.isBusy ? 'true' : null;
    const outer = this.#listStyle.value;
    const current = this.#rowStyle.value;
    const density = outer?.density ?? 'balanced';
    if (
      current?.density !== density ||
      current.edgeCompensation !== outer?.edgeCompensation ||
      current.hasDividers
    ) {
      const next: ListContextValue = {
        density,
        hasDividers: false,
        listStyle: 'none',
        edgeCompensation: outer?.edgeCompensation,
      };
      this.#rowStyle.setValue(next);
    }
  }

  /** The description as text: the checkbox carries a hidden copy so it is described by it. */
  get #descriptionText(): string {
    const slotted = this.querySelector(':scope > [slot="description"]');
    return (slotted ? (slotted.textContent ?? '') : this.description).trim();
  }

  protected override updated(): void {
    this.toggleState('checked', this.checked);
    this.toggleState('busy', this.isBusy);
  }

  override render(): TemplateResult {
    const list = this.#list.value;
    const disabled = this.isDisabled;
    const readonly = list?.readonly ?? false;
    const density = this.#listStyle.value?.density ?? 'balanced';
    const richLabel = this.#slots.has('label');
    const richDescription = this.#slots.has('description');
    const ariaLabel = this.getAttribute('aria-label');
    const labelId = this.#ids.id('label');
    // A rich label names the checkbox from its visible text; the hidden label then only carries the
    // generic word, which `aria-labelledby` outranks. An explicit `aria-label` replaces both.
    const namesFromVisibleLabel = richLabel && !ariaLabel;
    const checkboxLabel =
      ariaLabel ?? (richLabel ? this.#locale.t('@astryx.checkboxList.item.checkbox') : this.label);
    const focusableDisabled = disabled && !this.disabled && (list?.hasDisabledMessage ?? false);
    const dividers = this.#listStyle.value?.hasDividers ?? false;
    return html`<div class="row" part="row" ?data-dividers=${dividers}>
      <tct-list-item
        exportparts="item, list-item"
        label=${this.label}
        description=${this.description}
        ?disabled=${disabled}
        interactive-selector=${ifDefined(readonly ? undefined : 'tct-checkbox-input')}
        data-checked=${ifDefined(this.checked && !disabled && !readonly ? '' : undefined)}
      >
        ${
          richLabel
            ? html`<span slot="label" id=${labelId}><slot name="label"></slot></span>`
            : nothing
        }
        ${
          richDescription
            ? html`<span slot="description"
                ><slot name="description" @slotchange=${this.#onDescriptionChange}></slot
              ></span>`
            : nothing
        }
        <tct-checkbox-input
          slot="start"
          label=${checkboxLabel}
          label-hidden
          aria-labelledby=${ifDefined(namesFromVisibleLabel ? labelId : undefined)}
          data-row-description=${ifDefined(this.#descriptionText || undefined)}
          size=${density === 'compact' ? 'sm' : 'md'}
          .checked=${live(this.checked)}
          .indeterminate=${this.#collection ? false : this.indeterminate}
          ?disabled=${disabled}
          ?readonly=${readonly}
          ?loading=${this.isBusy}
          ?data-focusable-disabled=${focusableDisabled}
          @input=${this.#onInput}
        ></tct-checkbox-input>
        ${this.#slots.has('end') ? html`<slot name="end" slot="end"></slot>` : nothing}
      </tct-list-item>
    </div>`;
  }

  readonly #onDescriptionChange = (): void => {
    this.requestUpdate();
  };

  /** Standalone: the item's state follows its checkbox. In a list the list reads the toggle and owns the state. */
  readonly #onInput = (event: Event): void => {
    if (this.#collection) return;
    const box = event.currentTarget as TctCheckboxInput;
    this.checked = box.checked;
    this.indeterminate = false;
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-checkbox-list-item': TctCheckboxListItem;
  }
}
