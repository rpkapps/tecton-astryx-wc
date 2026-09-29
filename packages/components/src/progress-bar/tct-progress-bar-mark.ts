import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {TooltipController} from '@tecton-astryx/core/controllers/tooltip.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import layer from '../styles/layer.styles.css';
import styles from './tct-progress-bar-mark.styles.css';

/**
 * The target tick of a `tct-progress-bar`: an image named by its label that reveals the label in a tooltip
 * on hover and on keyboard focus (upstream `ProgressBarMarkTooltip`: above, focus trigger always). The bar
 * positions and paints the tick (this host); the focusable target and the tooltip surface live in this
 * shadow root so the target's `aria-describedby` stays inside one tree.
 *
 * Guides: [mwg:interest-triggered-tooltips] [mwg:position-aware-tooltips] [mwg:accessible-web-components].
 *
 * @internal
 * @summary A labelled target tick with a tooltip, rendered by tct-progress-bar.
 * @tag tct-progress-bar-mark
 * @csspart target - The focusable element that carries the name (a larger hit area than the tick).
 * @csspart tooltip - The tooltip surface.
 */
export class TctProgressBarMark extends TctElement {
  static override readonly tagName = 'tct-progress-bar-mark';
  static override styles: CSSResultGroup = [base, focusRing, layer, styles];

  /** Names the mark: its accessible name and the tooltip text. */
  @property() label = '';

  constructor() {
    super();
    new TooltipController(this, {
      mode: 'shadow',
      trigger: () => this.renderRoot.querySelector<HTMLElement>('.target'),
      surface: () => this.renderRoot.querySelector<HTMLElement>('.tooltip-surface'),
      content: () => this.label,
      focusTrigger: 'always',
      touchTrigger: 'auto',
    });
  }

  override render(): TemplateResult {
    return html`<span
        class="target focus-ring"
        part="target"
        role="img"
        tabindex="0"
        aria-label=${this.label}
      ></span
      >${
        this.label
          ? html`<div class="layer-surface tooltip-surface" part="tooltip" popover="manual">
              ${this.label}
            </div>`
          : nothing
      }`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-progress-bar-mark': TctProgressBarMark;
  }
}
