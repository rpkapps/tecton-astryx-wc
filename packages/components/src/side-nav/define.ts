import {defineElement} from '@tecton-wc/core/define.js';
import {TctSideNav} from './tct-side-nav.js';
import {TctSideNavCollapseButton} from './tct-side-nav-collapse-button.js';
import {TctSideNavHeading} from './tct-side-nav-heading.js';
import {TctSideNavItem} from './tct-side-nav-item.js';
import {TctSideNavSection} from './tct-side-nav-section.js';

defineElement(TctSideNavItem);
defineElement(TctSideNavSection);
defineElement(TctSideNavHeading);
defineElement(TctSideNavCollapseButton);
defineElement(TctSideNav);

export {TctSideNav, TctSideNavCollapseButton, TctSideNavHeading, TctSideNavItem, TctSideNavSection};
