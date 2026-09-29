import {html, type CSSResultGroup, type TemplateResult} from 'lit';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import base from '../styles/base.styles.css';
import visuallyHidden from '../styles/visually-hidden.styles.css';

/**
 * Renders its content in the accessibility tree while hiding it visually: accessible names for
 * icon-only controls, `aria-live` announcement text, supplementary screen-reader context.
 *
 * The clip block is fixed and cannot be overridden (styling a visually-hidden node is always a
 * mistake). The host is a plain generic wrapper: `aria-*`, `role`, `id`, `data-*` and `lang` set on it
 * work as on any element, which is what a live region needs.
 *
 * @summary Content for assistive technology that is not painted.
 * @tag tct-visually-hidden
 * @upstream VisuallyHidden
 * @slot - The content exposed to assistive technology.
 * @csspart base - The clipped box that holds the slot.
 * @cloakDisplay inline
 */
export class TctVisuallyHidden extends TctElement {
  static override readonly tagName = 'tct-visually-hidden';
  // `.visually-hidden` is the shared clip block (styles/visually-hidden.styles.css, [mwg:accessibility]);
  // its !important declarations sit in the `reset` layer, so no later layer can displace them.
  static override styles: CSSResultGroup = [base, visuallyHidden];

  override render(): TemplateResult {
    return html`<span part="base" class="visually-hidden"><slot></slot></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-visually-hidden': TctVisuallyHidden;
  }
}
