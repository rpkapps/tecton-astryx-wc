import {defineElement} from '@tecton-wc/core/define.js';
import {TctBottomSheet} from '../bottom-sheet/tct-bottom-sheet.js';
import {TctHeading} from '../heading/tct-heading.js';

/**
 * Registers the elements only the touch presentation renders (`tct-bottom-sheet` and the heading).
 * Loaded lazily by `loadSelectorSheetElements()`; not a family `define.ts`, so importing the selectors
 * never pulls the sheet stack in.
 */
defineElement(TctBottomSheet);
defineElement(TctHeading);
