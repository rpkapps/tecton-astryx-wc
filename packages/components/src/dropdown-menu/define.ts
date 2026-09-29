import {defineElement} from '@tecton-astryx/core/define.js';
import {TctDropdownMenu} from './tct-dropdown-menu.js';
import {TctDropdownMenuCheckboxItem} from './tct-dropdown-menu-checkbox-item.js';
import {TctDropdownMenuDivider} from './tct-dropdown-menu-divider.js';
import {TctDropdownMenuItem} from './tct-dropdown-menu-item.js';
import {TctDropdownMenuRadioGroup} from './tct-dropdown-menu-radio-group.js';
import {TctDropdownMenuRadioItem} from './tct-dropdown-menu-radio-item.js';
import {TctDropdownMenuSubMenu} from './tct-dropdown-menu-sub-menu.js';

defineElement(TctDropdownMenuItem);
defineElement(TctDropdownMenuCheckboxItem);
defineElement(TctDropdownMenuRadioGroup);
defineElement(TctDropdownMenuRadioItem);
defineElement(TctDropdownMenuDivider);
defineElement(TctDropdownMenuSubMenu);
defineElement(TctDropdownMenu);

export {
  TctDropdownMenu,
  TctDropdownMenuCheckboxItem,
  TctDropdownMenuDivider,
  TctDropdownMenuItem,
  TctDropdownMenuRadioGroup,
  TctDropdownMenuRadioItem,
  TctDropdownMenuSubMenu,
};
