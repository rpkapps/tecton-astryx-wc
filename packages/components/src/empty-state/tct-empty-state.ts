import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {EMPTY_STATE_HEADING_LEVELS, type EmptyStateHeadingLevel} from './empty-state.types.js';
import styles from './tct-empty-state.styles.css';

/**
 * A placeholder for a content area that has nothing to show: an optional icon or illustration, a
 * title, supporting text and next-step actions. Always say what is empty and what the user can do.
 *
 * The host is a `status` region (`ElementInternals`, so a host `role` attribute still overrides it);
 * the title is a real heading whose `heading-level` only changes the document outline, never its size.
 * The icon is decorative (`aria-hidden`).
 *
 * Guides: [mwg:shadow-dom] (slots, slot presence) [mwg:accessible-web-components] (role through
 * `ElementInternals`) [mwg:styling-web-components].
 *
 * @summary A placeholder for an area with no data, with a title, a description and next steps.
 * @tag tct-empty-state
 * @upstream EmptyState
 * @slot icon - Icon or illustration above the title; decorative.
 * @slot heading - Rich title content (used when the `heading` attribute is not set).
 * @slot description - Rich supporting text (used when the `description` attribute is not set).
 * @slot actions - One or two buttons that give the user a next step.
 * @csspart base - The centred column.
 * @csspart icon - The wrapper of the icon slot.
 * @csspart title - The heading element.
 * @csspart description - The supporting text.
 * @csspart actions - The row of actions.
 * @cloakDisplay block
 */
export class TctEmptyState extends TctElement {
  static override readonly tagName = 'tct-empty-state';
  static override styles: CSSResultGroup = [base, styles];

  /** The primary message, rendered as a heading. Use the `heading` slot for rich content. */
  @property() heading: string | undefined;

  /** Secondary text with more context. Use the `description` slot for rich content. */
  @property() description: string | undefined;

  /**
   * Semantic level of the title heading (1 to 6), so the title fits the document outline. It does
   * not change the title's visual size.
   */
  @property({type: Number, attribute: 'heading-level'}) headingLevel: EmptyStateHeadingLevel = 3;

  /** Reduced spacing and type size for constrained areas such as cards and sidebars. */
  @property({type: Boolean, reflect: true}) compact = false;

  readonly #slots = new SlotController(this, 'icon', 'heading', 'description', 'actions');

  constructor() {
    super();
    this.internals.role = 'status';
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (
      changed.has('headingLevel') &&
      !(EMPTY_STATE_HEADING_LEVELS as readonly number[]).includes(this.headingLevel)
    ) {
      devWarn(
        `empty-state:heading-level:${String(this.headingLevel)}`,
        `<tct-empty-state heading-level="${String(this.headingLevel)}"> is not 1 to 6; using 3.`,
      );
    }
  }

  override render(): TemplateResult {
    const hasDescription = this.description || this.#slots.has('description');
    return html`<div class="base" part="base">
      ${
        this.#slots.has('icon')
          ? html`<div class="icon" part="icon" aria-hidden="true"><slot name="icon"></slot></div>`
          : nothing
      }
      <div class="text">
        ${this.#renderTitle()}
        ${
          hasDescription
            ? html`<div class="description" part="description">
                ${this.description ? this.description : html`<slot name="description"></slot>`}
              </div>`
            : nothing
        }
      </div>
      ${
        this.#slots.has('actions')
          ? html`<div class="actions" part="actions"><slot name="actions"></slot></div>`
          : nothing
      }
    </div>`;
  }

  /** The title in the heading element for `headingLevel` (no dynamic tag names: A§13, lint). */
  #renderTitle(): TemplateResult | typeof nothing {
    if (!this.heading && !this.#slots.has('heading')) return nothing;
    const title = this.heading ? this.heading : html`<slot name="heading"></slot>`;
    switch (this.headingLevel) {
      case 1:
        return html`<h1 class="title" part="title">${title}</h1>`;
      case 2:
        return html`<h2 class="title" part="title">${title}</h2>`;
      case 4:
        return html`<h4 class="title" part="title">${title}</h4>`;
      case 5:
        return html`<h5 class="title" part="title">${title}</h5>`;
      case 6:
        return html`<h6 class="title" part="title">${title}</h6>`;
      default:
        return html`<h3 class="title" part="title">${title}</h3>`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-empty-state': TctEmptyState;
  }
}
