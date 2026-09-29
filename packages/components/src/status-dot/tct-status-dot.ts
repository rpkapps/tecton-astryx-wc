import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {SlotController} from '@tecton-astryx/core/controllers/slot.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import motion from '../styles/motion.styles.css';
import slottedIcon from '../styles/slotted-icon.styles.css';
import {STATUS_DOT_VARIANTS, type StatusDotVariant} from './status-dot.types.js';
import styles from './tct-status-dot.styles.css';

/**
 * A small coloured dot that signals a status such as presence or severity. Fixed 8px, never focusable.
 *
 * By default the dot is a colour-only signal, which is not accessible on its own (WCAG 1.4.1): pair it
 * with a visible text label, give it an icon (a different one per status) in the `icon` slot, or convey the
 * status accessibly elsewhere. The dot is a `role="img"` named by `label`, so the status reaches assistive
 * technology without hovering. `pulsing` animates it and stops under `prefers-reduced-motion`.
 *
 * Guides: [mwg:accessible-web-components] (role and name on the inner element, in the tree that also
 * holds the tooltip) [mwg:css] (forced colours, reduced motion) [mwg:styling-web-components].
 *
 * @summary A small status dot with an accessible label, optional pulse, icon and tooltip.
 * @tag tct-status-dot
 * @upstream StatusDot
 * @slot icon - Optional icon centred in the dot, painted in the variant's ink. Use a different icon per status.
 * @csspart base - The dot (Astryx target `astryx-status-dot`), the `img` that carries the label.
 * @csspart icon - The wrapper of the slotted icon.
 * @cloakDisplay inline-flex
 */
export class TctStatusDot extends TctElement {
  static override readonly tagName = 'tct-status-dot';
  static override styles: CSSResultGroup = [base, motion, slottedIcon, styles];

  /** Colour role: `success` (default), `warning`, `error`, `accent` or `neutral`. */
  @property({reflect: true}) variant: StatusDotVariant = 'success';

  /** Accessible name of the status (required): the dot's `aria-label`, so it does not depend on hover. */
  @property() label = '';

  /** Pulses the dot to signal activity; respects `prefers-reduced-motion`. */
  @property({type: Boolean, reflect: true}) pulsing = false;

  readonly #slots = new SlotController(this, 'icon');

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (
      changed.has('variant') &&
      !(STATUS_DOT_VARIANTS as readonly string[]).includes(this.variant)
    ) {
      devWarn(
        `status-dot:variant:${this.variant}`,
        `<tct-status-dot variant="${this.variant}"> is not one of ${STATUS_DOT_VARIANTS.join(', ')}; using "success".`,
      );
    }
  }

  override render(): TemplateResult {
    return html`<span class="dot" part="base" role="img" aria-label=${this.label || nothing}
      >${
        this.#slots.has('icon')
          ? html`<span class="icon-slot" part="icon" aria-hidden="true"
              ><slot name="icon"></slot
            ></span>`
          : nothing
      }</span
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-status-dot': TctStatusDot;
  }
}
