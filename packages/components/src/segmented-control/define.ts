import {defineElement} from '@tecton-wc/core/define.js';
import {TctSegmentedControlItem} from './tct-segmented-control-item.js';
import {TctSegmentedControl} from './tct-segmented-control.js';

// The item does not depend on the control at registration time (it only asks for context), so either
// order works; the control is listed last.
defineElement(TctSegmentedControlItem);
defineElement(TctSegmentedControl);

export {TctSegmentedControl, TctSegmentedControlItem};
