import {defineElement} from '@tecton-wc/core/define.js';
import {TctBottomSheet} from '../bottom-sheet/tct-bottom-sheet.js';

/**
 * Registers the element only the touch presentation renders. Loaded lazily by `loadPickerSheet()`; not a
 * family `define.ts`, so importing a date field never pulls the sheet stack in (it is a large share of the
 * size, and on a wide viewport it is never needed).
 */
defineElement(TctBottomSheet);
