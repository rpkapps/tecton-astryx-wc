import {html, nothing, type CSSResultGroup, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {ContextConsumer} from '@tecton-wc/core/context/protocol.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {devWarn} from '@tecton-wc/core/utils/dev.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctItem} from '../item/tct-item.js';
import base from '../styles/base.styles.css';
import {selectorRowLayoutContext} from './selector.context.js';
import {SELECTOR_ROW_LAYOUTS, type SelectorRowLayout} from './selector.types.js';
import styles from './tct-selector-option.styles.css';

/**
 * The content of one option, for `renderOption` and `renderValue`: an optional icon, a label, a
 * description under it and trailing content. It is a `tct-item` without the row's own padding and
 * corners, so it sits inside the selector's option row (or the closed trigger) with the same rhythm as
 * the default rendering. Inside an input group the trigger's height is pinned to one line, so the
 * layout is `inline` there whatever `layout` says.
 *
 * The element is decorative structure: the selector's row keeps the `option` role, the selection state
 * and the keyboard behaviour.
 *
 * @summary An option's content: icon, label, description and trailing content.
 * @tag tct-selector-option
 * @upstream SelectorOption
 * @slot label - Rich label; overrides the `label` attribute.
 * @slot description - Rich description; overrides the `description` attribute.
 * @slot end - Trailing content: a badge, a shortcut or a status.
 * @csspart item - The painted content row (upstream theming target `selector-option`).
 * @csspart label - The label.
 * @csspart description - The description.
 * @csspart icon - The icon.
 * @cloakDisplay block
 */
export class TctSelectorOption extends TctElement {
  static override readonly tagName = 'tct-selector-option';
  static override readonly dependencies = [TctItem, TctIcon];
  static override styles: CSSResultGroup = [base, styles];

  /** Primary text. Rich content goes through `slot="label"`. */
  @property() label = '';

  /** Secondary text under the label. Rich content goes through `slot="description"`. */
  @property() description = '';

  /** Registered icon name shown before the label. */
  @property() icon = '';

  /**
   * How label and description sit together: `stacked` (the description on its own line) or `inline`
   * (one line, the description ellipsizes first). Forced to `inline` in the trigger of a selector in an
   * input group.
   */
  @property({reflect: true}) layout: SelectorRowLayout = 'stacked';

  readonly #enforced: ContextConsumer<typeof selectorRowLayoutContext> = new ContextConsumer<
    typeof selectorRowLayoutContext
  >(this, {context: selectorRowLayoutContext, subscribe: true});
  readonly #slots: SlotController = new SlotController(this, 'label', 'description', 'end');

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('layout') && !SELECTOR_ROW_LAYOUTS.includes(this.layout)) {
      devWarn(
        `tct-selector-option:layout:${this.layout}`,
        `layout "${this.layout}" is not one of ${SELECTOR_ROW_LAYOUTS.join(', ')}.`,
      );
    }
  }

  protected override render() {
    // A height-pinned host (the trigger inside an input group) overrides the author's choice: the row
    // physically cannot be two lines there.
    const layout = this.#enforced.value === 'inline' ? 'inline' : this.layout;
    return html`<tct-item
      class="row"
      part="item"
      exportparts="label, description"
      label=${this.label}
      description=${this.description}
      layout=${SELECTOR_ROW_LAYOUTS.includes(layout) ? layout : 'stacked'}
    >
      ${this.#slots.has('label') ? html`<slot name="label" slot="label"></slot>` : nothing}
      ${
        this.#slots.has('description')
          ? html`<slot name="description" slot="description"></slot>`
          : nothing
      }
      ${
        this.icon
          ? html`<tct-icon
              slot="start"
              part="icon"
              name=${this.icon}
              size="sm"
              color="secondary"
            ></tct-icon>`
          : nothing
      }
      ${this.#slots.has('end') ? html`<slot name="end" slot="end"></slot>` : nothing}
    </tct-item>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-selector-option': TctSelectorOption;
  }
}
