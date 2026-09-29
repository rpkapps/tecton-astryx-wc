import {defineElement} from '@tecton-wc/core/define.js';
import {TctNavHeadingMenu} from './tct-nav-heading-menu.js';
import {TctNavHeadingMenuItem} from './tct-nav-heading-menu-item.js';

// The menu only reads its children; the item asks for context, so either order works.
defineElement(TctNavHeadingMenuItem);
defineElement(TctNavHeadingMenu);

export {TctNavHeadingMenu, TctNavHeadingMenuItem};
