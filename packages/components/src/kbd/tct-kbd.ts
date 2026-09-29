import {html, nothing, type CSSResultGroup, type TemplateResult} from 'lit';
import {property} from 'lit/decorators.js';
import {TctElement} from '@tecton-astryx/core/tct-element.js';
import base from '../styles/base.styles.css';
import {isApplePlatform, keyDisplay, parseKeys, shortcutName} from './kbd.keys.js';
import styles from './tct-kbd.styles.css';

/**
 * Shows a keyboard shortcut as styled key badges, for tooltips, menus and help text. Write the keys
 * joined with `+`: `mod+k`, `shift+enter`. `mod` is Command (⌘) on Apple platforms and Control
 * elsewhere, so a shortcut adapts to the user's platform.
 *
 * The shortcut is one image to assistive technology (`role="img"`) named with spoken key names
 * ("Command + K"), because the glyphs (⌘ ⇧ ↵) are announced meaninglessly; the badges themselves are
 * hidden from it. The role and the name are set on the inner box, so `role` and `aria-label` written
 * on the host cannot replace the computed name.
 *
 * @summary Keyboard shortcut rendered as key badges, with a spoken accessible name.
 * @tag tct-kbd
 * @upstream Kbd
 * @csspart base - The group that holds the badges and carries the accessible name (Astryx target `astryx-kbd`).
 * @csspart key - One key badge (a `<kbd>`).
 * @cloakDisplay inline-flex
 */
export class TctKbd extends TctElement {
  static override readonly tagName = 'tct-kbd';
  static override styles: CSSResultGroup = [base, styles];

  /**
   * The shortcut: keys separated by `+`. Special keys: `mod` (Command on Apple platforms, Control
   * elsewhere), `ctrl`, `alt`, `shift`, `enter`, `backspace`, `escape`, `tab`, `up`, `down`, `left`,
   * `right`. Aliases: `esc` for `escape`, `return` for `enter`. Write `plus` for a literal `+` key
   * (`shift+plus`). Other keys are upper-cased (`k` shows K).
   */
  @property() keys = '';

  // Apple platform detection is client-only, so the server and the first paint of a static page
  // show the non-Apple form and connect corrects it (upstream defers it the same way).
  #isMac = false;

  override connectedCallback(): void {
    super.connectedCallback();
    const isMac = isApplePlatform();
    if (isMac !== this.#isMac) {
      this.#isMac = isMac;
      this.requestUpdate();
    }
  }

  override render(): TemplateResult | typeof nothing {
    const parts = parseKeys(this.keys);
    if (this.keys.trim() === '') return nothing;
    return html`<span
      part="base"
      class="base"
      role="img"
      aria-label=${shortcutName(parts, this.#isMac)}
      >${parts.map(
        (key) =>
          html`<kbd part="key" class="key" aria-hidden="true"
            >${keyDisplay(key, this.#isMac)}</kbd
          >`,
      )}</span
    >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-kbd': TctKbd;
  }
}
