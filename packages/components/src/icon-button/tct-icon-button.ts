import type {PropertyValues} from 'lit';
import {TctButton} from '../button/tct-button.js';

/**
 * An icon-only button: `tct-button` with `icon-only` always on. The `label` is the accessible name and
 * the built-in tooltip; there is no visible text. Use it in toolbars, table rows and compact UI where
 * the icon is universally understood, instead of writing `<tct-button icon-only>` (explicit, greppable).
 *
 * Everything else is inherited from `tct-button`: `variant`, `size`, `elevation`, `loading`, `disabled`,
 * `tooltip`, `clickAction`, links and form submission. Slot your own icon into `icon`, or set the
 * registered `icon` name.
 *
 * @summary An icon-only button; `tct-button` with `icon-only` fixed on.
 * @tag tct-icon-button
 * @upstream IconButton
 * @slot icon - The icon (or use the `icon` attribute for a registered icon name).
 * @hideInherited iconOnly - Always on for an icon button.
 * @cloakDisplay inline-flex
 * @cloakMinBlockSize var(--size-element-md)
 */
export class TctIconButton extends TctButton {
  // TctButton declares its `tagName` as the literal type 'tct-button'; the cast keeps this subclass
  // assignable (a request to widen it to `string` is in parity.json).
  static override readonly tagName = 'tct-icon-button' as unknown as 'tct-button';

  constructor() {
    super();
    this.iconOnly = true;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // Removing the attribute or writing `false` cannot turn the label into visible text.
    this.iconOnly = true;
    super.willUpdate(changed);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-icon-button': TctIconButton;
  }
}
