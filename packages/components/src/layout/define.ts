import {defineElement} from '@tecton-astryx/core/define.js';
import {TctLayout} from './tct-layout.js';
import {TctLayoutContent} from './tct-layout-content.js';
import {TctLayoutFooter} from './tct-layout-footer.js';
import {TctLayoutHeader} from './tct-layout-header.js';
import {TctLayoutPanel} from './tct-layout-panel.js';

defineElement(TctLayout);
defineElement(TctLayoutHeader);
defineElement(TctLayoutContent);
defineElement(TctLayoutFooter);
defineElement(TctLayoutPanel);

export {TctLayout, TctLayoutContent, TctLayoutFooter, TctLayoutHeader, TctLayoutPanel};
