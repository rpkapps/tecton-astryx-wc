import {defineElement} from '@tecton-wc/core/define.js';
import {TctTopNav} from './tct-top-nav.js';
import {TctTopNavDrawer} from './tct-top-nav-drawer.js';
import {TctTopNavHeading} from './tct-top-nav-heading.js';
import {TctTopNavItem} from './tct-top-nav-item.js';
import {TctTopNavMegaMenu} from './tct-top-nav-mega-menu.js';
import {TctTopNavMegaMenuFeaturedCard} from './tct-top-nav-mega-menu-featured-card.js';
import {TctTopNavMegaMenuItem} from './tct-top-nav-mega-menu-item.js';
import {TctTopNavMenu} from './tct-top-nav-menu.js';

defineElement(TctTopNavItem);
defineElement(TctTopNavMegaMenuItem);
defineElement(TctTopNavMegaMenuFeaturedCard);
defineElement(TctTopNavMenu);
defineElement(TctTopNavMegaMenu);
defineElement(TctTopNavHeading);
defineElement(TctTopNavDrawer);
defineElement(TctTopNav);

export {
  TctTopNav,
  TctTopNavDrawer,
  TctTopNavHeading,
  TctTopNavItem,
  TctTopNavMegaMenu,
  TctTopNavMegaMenuFeaturedCard,
  TctTopNavMegaMenuItem,
  TctTopNavMenu,
};
