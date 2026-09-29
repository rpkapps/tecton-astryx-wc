import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {ifDefined} from 'lit/directives/if-defined.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {TctItem} from '../item/tct-item.js';
import type {ItemTarget} from '../item/item.types.js';
import base from '../styles/base.styles.css';
import {listContext} from './list.context.js';
import type {ListContextValue} from './list.types.js';
import styles from './tct-list-item.styles.css';

const DEFAULT_CONTEXT: ListContextValue = {
  density: 'balanced',
  hasDividers: false,
  listStyle: 'none',
  edgeCompensation: undefined,
};

/**
 * A row of a `tct-list`: label, optional description, start and end content, and the interactive
 * patterns of `tct-item` (a button, a link, or an enlarged target for a nested control). Density,
 * dividers, markers and edge compensation come from the enclosing list. The host is a `listitem`.
 *
 * Selection is exposed as `aria-current` on the row (a list item cannot be `aria-selected`); an
 * `aria-current` attribute you set wins. Listen for `click` on the row; a click on a nested button or
 * link in `start` or `end` bubbles as its own click, so check `event.target`.
 *
 * @summary A row of a list: label, description, start and end content.
 * @tag tct-list-item
 * @upstream ListItem
 * @slot label - Rich label; overrides the `label` attribute.
 * @slot description - Rich description; overrides the `description` attribute.
 * @slot start - Leading content: an icon, avatar or checkbox.
 * @slot end - Trailing content: a badge, an action button or a chevron.
 * @csspart list-item - The painted row (on the same element as the item's `item`).
 * @csspart item - The painted row.
 * @cloakDisplay block
 */
export class TctListItem extends TctElement {
  static override readonly tagName = 'tct-list-item';
  static override readonly dependencies = [TctItem];
  static override styles: CSSResultGroup = [base, styles];

  /** Primary text (required). Rich content goes through `slot="label"`. */
  @property() label = '';

  /** Secondary text below the label. Rich content goes through `slot="description"`. */
  @property() description = '';

  /** Makes the row a button. Listen for the native `click` event. */
  @property({type: Boolean, reflect: true}) pressable = false;

  /**
   * A nested control (a checkbox in `start`) that already provides the row's keyboard access and
   * action (upstream `interactiveRef`): the row forwards surface clicks to it and adds no second tab
   * stop. Mutually exclusive with `pressable` and `href`.
   */
  @property({attribute: false}) interactiveElement: HTMLElement | null = null;

  /** Declarative form of `interactiveElement`: a selector resolved in the row's light DOM. */
  @property({attribute: 'interactive-selector'}) interactiveSelector = '';

  /** Makes the row a link. */
  @property() href: string | undefined;

  /** Link target. `_blank` always adds `noopener noreferrer`. */
  @property() target: ItemTarget | undefined;

  /** Link relationship tokens. */
  @property() rel: string | undefined;

  /** Disabled state. */
  @property({type: Boolean, reflect: true}) disabled = false;

  /** Selected state, exposed as `aria-current`. */
  @property({type: Boolean, reflect: true}) selected = false;

  readonly #list = new ContextConsumer(this, {context: listContext, subscribe: true});
  readonly #slots = new SlotController(this, 'label', 'description', 'start', 'end');
  #delegate: HTMLElement | null = null;

  protected override willUpdate(): void {
    this.internals.role = 'listitem';
    this.internals.ariaDisabled = this.disabled ? 'true' : null;
    this.internals.ariaCurrent =
      this.selected && !this.hasAttribute('aria-current') ? 'true' : null;
    // The selector is resolved here, in the row's own light DOM: the inner item cannot see it.
    this.#delegate =
      this.interactiveElement ??
      (this.interactiveSelector === ''
        ? null
        : this.querySelector<HTMLElement>(this.interactiveSelector));
  }

  // `aria-current` is observed so an author value takes over from (and hands back to) the default.
  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'aria-current'];
  }

  /** @internal */
  override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'aria-current') this.requestUpdate();
  }

  /** A nested control that arrived after the first render (a slotted checkbox upgrading) is picked up. */
  readonly #onStartChange = (): void => {
    if (this.interactiveSelector !== '') this.requestUpdate();
  };

  #marker(listStyle: ListContextValue['listStyle']): TemplateResult | typeof nothing {
    switch (listStyle) {
      case 'disc':
        return html`<span slot="marker" class="marker" aria-hidden="true"
          ><span class="dot"></span
        ></span>`;
      case 'circle':
        return html`<span slot="marker" class="marker" aria-hidden="true"
          ><span class="ring"></span
        ></span>`;
      case 'decimal':
        return html`<span slot="marker" class="number" aria-hidden="true"></span>`;
      default:
        return nothing;
    }
  }

  protected override render(): TemplateResult {
    const context = this.#list.value ?? DEFAULT_CONTEXT;
    return html`<div
      class="row"
      data-density=${context.density}
      ?data-dividers=${context.hasDividers}
      data-edge-compensation=${ifDefined(context.edgeCompensation)}
    >
      <tct-item
        exportparts="item, item: list-item"
        density=${context.density}
        label=${this.label}
        description=${this.description}
        ?pressable=${this.pressable}
        ?disabled=${this.disabled}
        ?selected=${this.selected}
        href=${ifDefined(this.href)}
        target=${ifDefined(this.target)}
        rel=${ifDefined(this.rel)}
        .interactiveElement=${this.#delegate}
        >${this.#marker(context.listStyle)}${
          this.#slots.has('label') ? html`<slot name="label" slot="label"></slot>` : nothing
        }${
          this.#slots.has('description')
            ? html`<slot name="description" slot="description"></slot>`
            : nothing
        }${
          this.#slots.has('start')
            ? html`<slot name="start" slot="start" @slotchange=${this.#onStartChange}></slot>`
            : nothing
        }${this.#slots.has('end') ? html`<slot name="end" slot="end"></slot>` : nothing}</tct-item
      >
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-list-item': TctListItem;
  }
}
