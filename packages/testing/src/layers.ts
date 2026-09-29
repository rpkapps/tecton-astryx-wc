/**
 * Overlay assertions (A§15.2): open a layer element the way its API allows, and read the layer stack.
 */
import {getLayerStack, type LayerSnapshot} from '@tecton-wc/core/layer/stack.js';
import {settle} from './fixture.js';
import {animationsFinished} from './timing.js';

interface Openable extends Element {
  open?: boolean;
  show?(): unknown;
}

/**
 * Opens `element` (its `show()` method when it has one, else `open = true`) and waits until it and
 * its entry animation settled.
 */
export async function openLayer(element: Openable): Promise<void> {
  if (typeof element.show === 'function') await element.show();
  else element.open = true;
  await settle(element);
  await animationsFinished(element);
}

/** The present layers, bottom to top, straight from the shared stack. */
export function layerStack(): LayerSnapshot[] {
  return getLayerStack();
}

/** Host elements of the present layers, bottom to top (readable in assertions). */
export function layerHosts(): (Element | null)[] {
  return getLayerStack().map((layer) => layer.host);
}
