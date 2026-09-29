import {defineElement} from '@tecton-wc/core/define.js';
import {TctList} from './tct-list.js';
import {TctListItem} from './tct-list-item.js';

// The provider before its consumer (A§4.1).
defineElement(TctList);
defineElement(TctListItem);

export {TctList, TctListItem};
