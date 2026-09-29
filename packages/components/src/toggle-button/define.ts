import {defineElement} from '@tecton-astryx/core/define.js';
import {TctToggleButton} from './tct-toggle-button.js';
import {TctToggleButtonGroup} from './tct-toggle-button-group.js';

// The group is a provider: it is defined first so buttons never miss it.
defineElement(TctToggleButtonGroup);
defineElement(TctToggleButton);

export {TctToggleButton, TctToggleButtonGroup};
