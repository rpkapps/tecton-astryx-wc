/**
 * Resets every piece of module-level state in `@tecton-wc/core` between tests: the layer stack,
 * gesture counter, scroll lock, top-layer persistence, announcer regions, icon registry, i18n
 * registry, dev warnings, interaction modality and the shared resize observer. Called by `setup.ts`
 * after each test so tests never depend on order.
 */
import {resetAnnouncer} from '@tecton-wc/core/a11y/announcer.js';
import {resetModality} from '@tecton-wc/core/controllers/interaction-modality.js';
import {resetResizeObserver} from '@tecton-wc/core/controllers/resize.js';
import {resetDefineWarnings} from '@tecton-wc/core/define.js';
import {resetI18n} from '@tecton-wc/core/i18n/registry.js';
import {resetIcons} from '@tecton-wc/core/icons/registry.js';
import {resetGesture} from '@tecton-wc/core/layer/gesture.js';
import {resetScrollLock} from '@tecton-wc/core/layer/scroll-lock.js';
import {resetLayerStack} from '@tecton-wc/core/layer/stack.js';
import {resetTopLayerHost} from '@tecton-wc/core/layer/top-layer-host.js';
import {resetDevWarnings} from '@tecton-wc/core/utils/dev.js';

/** Resets all core singletons. Fixtures must already be removed (their controllers unregister first). */
export function resetCoreGlobals(): void {
  resetLayerStack();
  resetGesture();
  resetScrollLock();
  resetTopLayerHost();
  resetAnnouncer();
  resetIcons();
  resetI18n();
  resetDevWarnings();
  resetDefineWarnings();
  resetModality();
  resetResizeObserver();
}
