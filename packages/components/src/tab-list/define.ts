import {defineElement} from '@tecton-wc/core/define.js';
import {TctTab} from './tct-tab.js';
import {TctTabList} from './tct-tab-list.js';
import {TctTabMenu} from './tct-tab-menu.js';

// The tab list only reads its children through context, so registration order is free; the list is last.
defineElement(TctTab);
defineElement(TctTabMenu);
defineElement(TctTabList);

export {TctTab, TctTabList, TctTabMenu};
