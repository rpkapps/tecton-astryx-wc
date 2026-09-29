/**
 * Test-only tooltip (`tct-test-tooltip`): the smallest consumer of `TooltipController` in satellite
 * mode. The trigger is its first light child; the surface is an owned `<div>` satellite.
 *
 *   <tct-test-tooltip content="Save the file" delay="0"><button>Save</button></tct-test-tooltip>
 *
 * `controlled-open="true|false"` makes it controlled (hover/focus never toggle; the owner applies
 * the state through the attribute after listening to `tct-open-change`).
 */
import {css, html} from 'lit';
import {property} from 'lit/decorators.js';
import {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {TooltipController} from '@tecton-wc/core/controllers/tooltip.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';

export class TctTestTooltip extends TctElement {
  static override readonly tagName = 'tct-test-tooltip';
  static override styles = css`
    :host {
      display: inline-block;
    }
    ::slotted([popover]) {
      inset: auto;
      margin: 0;
      padding: 4px 8px;
      border: 1px solid;
      background: Canvas;
      color: CanvasText;
    }
  `;

  @property() content = '';
  @property({type: Number}) delay = 200;
  @property({type: Number, attribute: 'hide-delay'}) hideDelay = 0;
  @property({attribute: 'controlled-open'}) controlledOpen: 'true' | 'false' | undefined;
  @property({attribute: 'touch-trigger'}) touchTrigger: 'auto' | 'tap' | 'none' = 'auto';
  @property({type: Boolean}) disabledTip = false;
  @property() strategy: 'auto' | 'css' | 'js' = 'auto';

  readonly tooltip = new TooltipController(this, {
    mode: 'satellite',
    surfaceTag: 'div',
    trigger: () => this.querySelector<HTMLElement>(':scope > :not([data-tct-owned])'),
    content: () => this.content,
    delay: () => this.delay,
    hideDelay: () => this.hideDelay,
    touchTrigger: () => this.touchTrigger,
    enabled: () => !this.disabledTip,
    open: () => (this.controlledOpen === undefined ? undefined : this.controlledOpen === 'true'),
    onOpenChange: (open, reason) => this.dispatch(new TctOpenChangeEvent(open, reason)),
    onAfterOpenChange: (open) => {
      this.dispatch(new TctAfterOpenChangeEvent(open));
    },
  });

  override render() {
    return html`<slot></slot><slot name="surface"></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-test-tooltip': TctTestTooltip;
  }
}
