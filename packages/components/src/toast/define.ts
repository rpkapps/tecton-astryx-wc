import {defineElement} from '@tecton-wc/core/define.js';
import {TctLayerProvider} from './tct-layer-provider.js';
import {TctToast} from './tct-toast.js';
import {TctToastViewport} from './tct-toast-viewport.js';

// The provider first (it registers the viewport and the toast as dependencies), then the toast itself.
defineElement(TctLayerProvider);
defineElement(TctToast);

export {TctLayerProvider, TctToast, TctToastViewport};
