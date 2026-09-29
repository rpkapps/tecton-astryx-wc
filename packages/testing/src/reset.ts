/**
 * Resets every piece of module-level state in `@tecton-astryx/core` between tests: the layer stack,
 * gesture counter, scroll lock, top-layer persistence, announcer regions, icon registry, i18n
 * registry, dev warnings, interaction modality and the shared resize observer. Called by `setup.ts`
 * after each test so tests never depend on order.
 */
import {resetAnnouncer} from '@tecton-astryx/core/a11y/announcer.js';
import {resetModality} from '@tecton-astryx/core/controllers/interaction-modality.js';
import {resetResizeObserver} from '@tecton-astryx/core/controllers/resize.js';
import {resetDefineWarnings} from '@tecton-astryx/core/define.js';
import {resetI18n} from '@tecton-astryx/core/i18n/registry.js';
import {resetIcons} from '@tecton-astryx/core/icons/registry.js';
import {resetGesture} from '@tecton-astryx/core/layer/gesture.js';
import {resetScrollLock} from '@tecton-astryx/core/layer/scroll-lock.js';
import {resetLayerStack} from '@tecton-astryx/core/layer/stack.js';
import {resetTopLayerHost} from '@tecton-astryx/core/layer/top-layer-host.js';
import {resetDevWarnings} from '@tecton-astryx/core/utils/dev.js';

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
