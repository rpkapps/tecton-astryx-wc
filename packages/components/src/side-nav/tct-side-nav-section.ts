import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {SlotController} from '@tecton-wc/core/controllers/slot.js';
import {IdController} from '@tecton-wc/core/utils/id.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import base from '../styles/base.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';
import {SideNavCollapseController} from './side-nav.context.js';
import styles from './tct-side-nav-section.styles.css';

/**
 * A titled group of side navigation items. The group is a `group` named by its heading, so a screen
 * reader announces "Main, group" as the items are entered. In the collapsed rail, and with
 * `header-hidden`, the heading stays in the accessibility tree but is not drawn.
 *
 * @summary A labelled group of side navigation items with an optional subheading and end content.
 * @tag tct-side-nav-section
 * @upstream SideNavSection
 * @slot - The items of the section: `tct-side-nav-item`s.
 * @slot end - Content at the end of the section header: an icon button, a count.
 * @csspart base - The group box.
 * @csspart header - The section header (the heading, the subheading and the end content).
 * @csspart heading - The heading text.
 * @csspart subheading - The subheading text.
 * @csspart end-content - The end content.
 * @csspart items - The box around the items.
 * @cloakDisplay block
 */
export class TctSideNavSection extends TctElement {
  static override readonly tagName = 'tct-side-nav-section';
  static override styles: CSSResultGroup = [base, visuallyHidden, styles];

  /** The section heading. It names the group, even when it is not drawn. */
  @property() heading = '';

  /** A line below the heading. */
  @property() subheading = '';

  /** Draws no header (the heading still names the group for assistive technology). */
  @property({type: Boolean, attribute: 'header-hidden'}) headerHidden = false;

  readonly #slots: SlotController = new SlotController(this, 'end');
  readonly #collapse: SideNavCollapseController = new SideNavCollapseController(this);
  readonly #ids: IdController = new IdController(this, 'tct-side-nav-section');

  override render(): TemplateResult {
    const titleId = this.#ids.id('title');
    const hidden = this.headerHidden || this.#collapse.value.isCollapsed;
    const header = html`<span class="titles"
        ><span class="title" part="heading" id=${titleId}>${this.heading}</span>${
          this.subheading
            ? html`<span class="subtitle" part="subheading">${this.subheading}</span>`
            : nothing
        }</span
      >${
        this.#slots.has('end')
          ? html`<span class="end" part="end-content"><slot name="end"></slot></span>`
          : nothing
      }`;
    return html`<div class="root" part="base" role="group" aria-labelledby=${titleId}>
      ${
        hidden
          ? html`<div class="visually-hidden">${header}</div>`
          : html`<div class="header" part="header">${header}</div>`
      }
      <div class="items" part="items"><slot></slot></div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-side-nav-section': TctSideNavSection;
  }
}
