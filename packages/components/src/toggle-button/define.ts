import {defineElement} from '@tecton-astryx/core/define.js';
import {TctToggleButtonGroup} from './tct-toggle-button-group.js';

// The group is a provider: it is defined first so buttons never miss it.
// TODO(WP-F Button): register TctToggleButton here once tct-button has landed.
defineElement(TctToggleButtonGroup);

export {TctToggleButtonGroup};
