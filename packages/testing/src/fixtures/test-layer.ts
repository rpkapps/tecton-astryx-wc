/**
 * Test-only overlay host (`tct-test-layer`): the smallest real consumer of `LayerController` and
 * `PositionController`. It follows the element contract (A§7.6): property writes never emit intent
 * events; user-driven dismissal raises a cancelable `tct-open-change` and applies it unless prevented;
 * `tct-after-open-change` fires once the change settled.
 *
 * Markup:
 *   <tct-test-layer kind="popover" placement="below">
 *     <button slot="trigger">Open</button>
 *     content…
 *   </tct-test-layer>
 */
import {css, html, nothing, type PropertyValues} from 'lit';
import {property} from 'lit/decorators.js';
import {TctAfterOpenChangeEvent} from '@tecton-wc/core/events/tct-after-open-change.js';
import {TctOpenChangeEvent} from '@tecton-wc/core/events/tct-open-change.js';
import {
  LayerController,
  type EscapeBehavior,
  type LayerKind,
} from '@tecton-wc/core/layer/layer-controller.js';
import {
  PositionController,
  type Alignment,
  type Placement,
} from '@tecton-wc/core/layer/position.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';

export class TctTestLayer extends TctElement {
  static override readonly tagName = 'tct-test-layer';
  static override styles = css`
    :host {
      display: inline-block;
    }
    :host([hidden]) {
      display: none;
    }
    [popover] {
      box-sizing: border-box;
      inset: auto;
      margin: 0;
      min-inline-size: 120px;
      min-block-size: 40px;
      padding: 8px;
      border: 1px solid;
      background: Canvas;
      color: CanvasText;
    }
    dialog {
      padding: 8px;
    }
  `;

  @property({type: Boolean, reflect: true}) open = false;
  @property({reflect: true}) kind: LayerKind = 'popover';
  /** What Escape does while top-most. */
  @property() escape: EscapeBehavior = 'close';
  /** `false` disables outside press (default: on, except for modal). */
  @property({attribute: 'outside-press'}) outsidePress: string | undefined;
  @property() placement: Placement = 'below';
  @property() alignment: Alignment = 'start';
  @property() offset: string | undefined;
  @property({attribute: 'initial-focus'}) initialFocus: 'auto' | 'surface' | 'first' | 'none' = 'auto';
  @property({attribute: 'return-focus'}) returnFocus = 'true';
  @property({type: Boolean, attribute: 'match-anchor-width'}) matchAnchorWidth = false;
  /** Runs a 120 ms exit animation, awaited before the native hide. */
  @property({type: Boolean}) animated = false;
  /** Tests only: force the positioning path. */
  @property() strategy: 'auto' | 'css' | 'js' = 'auto';
  /** A point anchor (virtual anchor) instead of the trigger. */
  @property({attribute: false}) point: {x: number; y: number} | undefined;
  @property({attribute: 'aria-haspopup-value'}) haspopup: 'dialog' | 'menu' | undefined;

  position!: PositionController;
  layer!: LayerController;

  /** Controllers are created on first connect so they can read the attributes that shape them. */
  override connectedCallback(): void {
    if (!this.layer) {
      this.position = new PositionController(this, {
        surface: () => this.surface,
        anchor: () => this.point ?? this.trigger,
        placement: () => ({placement: this.placement, alignment: this.alignment, offset: this.offset}),
        matchAnchorWidth: this.matchAnchorWidth,
        trackPlacement: true,
        strategy: this.strategy,
      });
      this.layer = new LayerController(this, {
        kind: this.kind,
        surface: () => this.surface,
        trigger: () => this.trigger,
        escape: () => this.escape,
        outsidePress: (): boolean =>
          this.outsidePress === undefined ? this.kind !== 'modal' : this.outsidePress !== 'false',
        initialFocus: this.initialFocus,
        returnFocus: this.returnFocus !== 'false',
        position: this.kind === 'popover' ? this.position : undefined,
        exitAnimation: () =>
          this.animated && this.surface ? [this.surface.animate([{opacity: 1}, {opacity: 0}], {duration: 120})] : [],
        haspopup: this.haspopup,
        onDismissRequest: (reason) => {
          if (this.dispatch(new TctOpenChangeEvent(false, reason))) this.open = false;
        },
        onOpenRequest: (reason) => {
          if (this.dispatch(new TctOpenChangeEvent(true, reason))) this.open = true;
        },
        onNativeClose: () => {
          this.open = false;
        },
      });
    }
    super.connectedCallback();
  }

  get surface(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('[part="surface"]');
  }

  get trigger(): HTMLElement | null {
    return this.querySelector<HTMLElement>(':scope > [slot="trigger"]');
  }

  protected override updated(changed: PropertyValues): void {
    if (!changed.has('open')) return;
    const settled = this.open ? this.layer.show() : this.layer.hide();
    void settled.then(() => {
      if (this.open === this.layer.isOpen) this.dispatch(new TctAfterOpenChangeEvent(this.open));
    });
  }

  override render() {
    const trigger = html`<slot
      name="trigger"
      @click=${(event: Event) => {
        this.layer.toggleFromTrigger(event);
      }}
    ></slot>`;
    if (this.kind === 'popover') {
      return html`${trigger}<div part="surface" popover="manual" role="dialog" aria-label="test layer"><slot></slot></div>`;
    }
    return html`${trigger}<dialog part="surface" aria-label="test layer"><slot></slot></dialog>${nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-test-layer': TctTestLayer;
  }
}
