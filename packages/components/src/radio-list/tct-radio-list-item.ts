import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {ContextConsumer} from '@tecton-astryx/core/context/protocol.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {indicatorScope} from '@tecton-astryx/core/indicators/registry.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {IdController} from '@tecton-astryx/core/utils/id.js';
import {TctRadioIndicator} from '../indicator/tct-radio-indicator.js';
import {TctItem} from '../item/tct-item.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {radioListContext} from './radio-list.context.js';
import styles from './tct-radio-list-item.styles.css';

/**
 * One option of a `tct-radio-list`: a radio with a label, an optional description, and content before
 * and after. The radio (a `role="radio"` element with `aria-checked`) is the row's one focusable control
 * and its action: a click anywhere on the row selects it (a click on a link or button in the label,
 * `start` or `end` keeps its own meaning), and its visual is the shared radio indicator. The radio is
 * named by the label (or your `aria-label`) and described by the description.
 *
 * The list owns the state: an item is checked while its `value` is the list's `value`. Arrow keys, Space
 * and the tab stop belong to the list (one tab stop for the whole group).
 *
 * @summary An option of a radio list: a radio with label, description, and start and end content.
 * @tag tct-radio-list-item
 * @upstream RadioListItem
 * @slot label - Rich label; overrides the `label` attribute.
 * @slot description - Rich description; overrides the `description` attribute.
 * @slot start - Content after the radio, before the label (an icon or an avatar).
 * @slot end - Content after the label area: a badge or an action button.
 * @csspart item - The painted row.
 * @csspart radio - The `role="radio"` element that takes focus.
 * @csspart radio-indicator - The painted circle.
 * @csspart radio-indicator-dot - The dot of a selected radio.
 * @cssstate checked - The option is the list's value.
 * @cssstate disabled - The option, or the whole list, is disabled.
 * @cloakDisplay block
 */
export class TctRadioListItem extends TctElement {
  static override readonly tagName = 'tct-radio-list-item';
  static override readonly dependencies = [TctItem, TctRadioIndicator];
  static override styles: CSSResultGroup = [base, focusRing, indicatorScope, styles];

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'aria-label'];
  }

  /** Primary text: the label of the row and the name of the radio. Rich content goes through `slot="label"`. */
  @property() label = '';

  /** The option's identity: it is the list's `value` while checked. Required, and unique in the list. */
  @property() value = '';

  /** Secondary text under the label; also the radio's accessible description. Rich content goes through `slot="description"`. */
  @property() description = '';

  /** Disables this option only. The whole list can be disabled too. */
  @property({type: Boolean, reflect: true}) disabled = false;

  readonly #list = new ContextConsumer(this, {context: radioListContext, subscribe: true});
  readonly #slots = new SlotController(this, 'label', 'description', 'start', 'end');
  readonly #ids = new IdController(this, 'tct-radio-list-item');

  /** Whether this option is the list's value (false outside a list, and for an option without a value). */
  get checked(): boolean {
    const list = this.#list.value;
    return list !== undefined && list !== null && this.value !== '' && list.value === this.value;
  }

  /** Whether this option cannot be chosen: its own `disabled`, or the whole list's. */
  get isDisabled(): boolean {
    return this.disabled || (this.#list.value?.disabled ?? false);
  }

  /** The `role="radio"` element: the option's one focusable control, for roving focus and validation anchors. */
  get focusTarget(): HTMLElement | null {
    return this.renderRoot?.querySelector<HTMLElement>('.radio') ?? null;
  }

  // The host carries no role: the radio is a real element inside, so links in `end` stay tabbable.
  protected override updated(): void {
    this.toggleState('checked', this.checked);
    this.toggleState('disabled', this.isDisabled);
  }

  override render(): TemplateResult {
    const list = this.#list.value;
    const size = list?.size ?? 'md';
    const disabled = this.isDisabled;
    const readonly = list?.readonly ?? false;
    const ariaLabel = this.getAttribute('aria-label');
    const richLabel = this.#slots.has('label');
    const richDescription = this.#slots.has('description');
    const hasDescription = this.description !== '' || richDescription;
    const labelId = this.#ids.id('label');
    const descriptionId = this.#ids.id('description');
    const checked = this.checked;
    // An option that stays focusable while disabled explains itself: only the group's reason applies.
    return html`<tct-item
      class="item indicator-scope"
      exportparts="item"
      density="compact"
      ?disabled=${disabled}
      interactive-selector=${ifDefined(readonly ? undefined : '.radio')}
      ?data-checked=${checked}
    >
      <span slot="label" id=${labelId}
        >${richLabel ? html`<slot name="label"></slot>` : this.label}</span
      >
      ${
        hasDescription
          ? html`<span slot="description" id=${descriptionId}
              >${richDescription ? html`<slot name="description"></slot>` : this.description}</span
            >`
          : nothing
      }
      <div slot="start" class="start">
        <div
          class="radio focus-ring"
          part="radio"
          role="radio"
          data-size=${size}
          aria-checked=${checked ? 'true' : 'false'}
          aria-disabled=${ifDefined(disabled ? 'true' : undefined)}
          ?data-readonly=${readonly}
          aria-label=${ifDefined(ariaLabel ?? undefined)}
          aria-labelledby=${ifDefined(ariaLabel === null ? labelId : undefined)}
          aria-describedby=${ifDefined(hasDescription ? descriptionId : undefined)}
          @click=${this.#onClick}
        >
          <tct-radio-indicator
            exportparts="radio-indicator, radio-indicator-dot"
            state=${checked ? 'checked' : 'unchecked'}
            size=${size}
            ?disabled=${disabled}
          ></tct-radio-indicator>
        </div>
        ${this.#slots.has('start') ? html`<slot name="start"></slot>` : nothing}
      </div>
      ${this.#slots.has('end') ? html`<slot name="end" slot="end"></slot>` : nothing}
    </tct-item>`;
  }

  /** A click on the radio (or a row click the item forwards to it) asks the list to select this option. */
  readonly #onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented) return;
    this.#list.value?.select(this);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-radio-list-item': TctRadioListItem;
  }
}
