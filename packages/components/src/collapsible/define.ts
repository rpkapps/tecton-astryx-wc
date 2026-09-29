import {defineElement} from '@tecton-astryx/core/define.js';
import {TctCollapsibleGroup} from './tct-collapsible-group.js';
import {TctCollapsible} from './tct-collapsible.js';

// The group is a provider: it is defined first so items never miss it.
defineElement(TctCollapsibleGroup);
defineElement(TctCollapsible);

export {TctCollapsible, TctCollapsibleGroup};
