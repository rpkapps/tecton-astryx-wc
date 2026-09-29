import {defineElement} from '@tecton-wc/core/define.js';
import {TctBottomSheet} from '../bottom-sheet/tct-bottom-sheet.js';
import {TctHeading} from '../heading/tct-heading.js';
import {TctIconButton} from '../icon-button/tct-icon-button.js';
import {TctListItem} from '../list/tct-list-item.js';
import {TctList} from '../list/tct-list.js';

/**
 * Registers the elements of the touch presentation. Loaded lazily by `loadMenuSheetElements()`; not a
 * family `define.ts`, so importing the menus never pulls it in.
 */
defineElement(TctBottomSheet);
defineElement(TctHeading);
defineElement(TctIconButton);
defineElement(TctList);
defineElement(TctListItem);
