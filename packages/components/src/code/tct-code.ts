import {html, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';
import base from '../styles/base.styles.css';
import {CODE_COLORS, CODE_SIZES, type CodeColor, type CodeSize} from './code.types.js';
import styles from './tct-code.styles.css';

/**
 * Inline code: a real `<code>` in the monospace family on the muted surface, sized for the
 * surrounding text. Use it for a function name, a value or a path in a sentence; use a code block for
 * multi-line code.
 *
 * The `<code>` element lives in the shadow root, so it exposes the `code` role; the host is inline
 * and the text you slot flows and wraps like ordinary inline text.
 *
 * @summary Inline code with monospace type on the muted surface.
 * @tag tct-code
 * @upstream Code
 * @slot - The code text.
 * @csspart base - The `<code>` element that carries the background, padding and monospace type (Astryx target `astryx-code`).
 * @cloakDisplay inline
 */
export class TctCode extends TctElement {
  static override readonly tagName = 'tct-code';
  static override styles: CSSResultGroup = [base, styles];

  /** Text colour: `primary` (default), `secondary`, or `inherit` to follow the surrounding text. */
  @property({reflect: true}) color: CodeColor = 'primary';

  /**
   * `inherit` adopts the surrounding text's font size and line height, for inline code inside larger
   * or smaller text. Unset, the code size is the Tecton code text size.
   */
  @property({reflect: true}) size: CodeSize | undefined;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('color') && !CODE_COLORS.includes(this.color)) {
      devWarn(
        `code:color:${String(this.color)}`,
        `color="${String(this.color)}" is not one of ${CODE_COLORS.join(', ')}.`,
      );
    }
    if (changed.has('size') && this.size !== undefined && !CODE_SIZES.includes(this.size)) {
      devWarn(
        `code:size:${String(this.size)}`,
        `size="${String(this.size)}" is not one of ${CODE_SIZES.join(', ')}.`,
      );
    }
  }

  override render(): TemplateResult {
    // The template is one line so no whitespace text node leaks into the inline flow.
    return html`<code part="base" class="base"><slot></slot></code>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-code': TctCode;
  }
}
