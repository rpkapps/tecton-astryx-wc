import {defineElement} from '@tecton-wc/core/define.js';
import {TctBottomSheet} from '../bottom-sheet/tct-bottom-sheet.js';
import {TctTimePanel} from './tct-time-panel.js';

/**
 * Registers the elements only the touch presentation renders (the bottom sheet, and the time columns of the time and date-time sheets). Loaded lazily by `loadPickerSheet()`; not a
 * family `define.ts`, so importing a date field never pulls the sheet stack in (it is a large share of the
 * size, and on a wide viewport it is never needed).
 */
defineElement(TctBottomSheet);
defineElement(TctTimePanel);
