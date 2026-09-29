import type {PropertyValues} from 'lit';
import {LocaleController} from '@tecton-astryx/core/i18n/locale-controller.js';
import defaultMessages from '@tecton-astryx/locales/en/moreMenu.js';
import {TctDropdownMenu} from '../dropdown-menu/tct-dropdown-menu.js';

/**
 * An overflow menu with a three-dot, icon-only trigger: `tct-dropdown-menu` with the defaults of a
 * row-action button (`ghost` variant, `moreHorizontal` icon, no visible text, tooltip). Everything else is
 * the dropdown menu: give it `items`, or compound `tct-dropdown-menu-item` children; `open`,
 * `placement`, `alignment`, `presentation` (`adaptive` uses a bottom sheet on a compact touch device)
 * and the events work the same way.
 *
 * The `label` is the trigger's accessible name (always: the button is icon-only), its tooltip, and the
 * name of the menu. Keep a visible route to the same actions on touch: long-press is not one.
 *
 * @summary An overflow menu with a three-dot icon trigger.
 * @tag tct-more-menu
 * @upstream MoreMenu
 * @slot - The menu rows (compound mode).
 * @slot icon - A custom trigger icon, replacing the three dots.
 * @csspart trigger - The icon-only trigger button.
 * @csspart menu - The painted menu surface (Astryx target `astryx-more-menu` and `astryx-dropdown-menu`).
 * @fires {TctOpenChangeEvent} tct-open-change - Before the user opens or closes it; cancelable.
 * @fires {TctAfterOpenChangeEvent} tct-after-open-change - After an open or close settled.
 * @hideInherited iconOnly, noChevron - The trigger is always icon-only.
 * @cloakDisplay inline-flex
 */
export class TctMoreMenu extends TctDropdownMenu {
  static override readonly tagName: string = 'tct-more-menu';

  readonly #locale = new LocaleController(this, {namespace: 'moreMenu', defaults: defaultMessages});

  constructor() {
    super();
    // The defaults of a row-action button; every one can still be set.
    this.variant = 'ghost';
    this.icon = 'moreHorizontal';
    this.iconOnly = true;
  }

  protected override get triggerLabel(): string {
    return this.label || this.#locale.t('label');
  }

  protected override get triggerTooltip(): string {
    return this.tooltip || this.triggerLabel;
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    // The button is always icon-only: no attribute can bring visible text back.
    this.iconOnly = true;
    super.willUpdate(changed);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-more-menu': TctMoreMenu;
  }
}
