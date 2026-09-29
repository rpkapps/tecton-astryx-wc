/**
 * Family-private context (WORK-BREAKDOWN §1.6, A§9.4): what `tct-segmented-control` tells its items.
 * Upstream `SegmentedControlContext`, re-expressed for the Context Community Protocol.
 */
import {createContext} from '@tecton-astryx/core/context/protocol.js';
import type {ElementSize} from '@tecton-astryx/core/context/keys.js';
import type {SegmentedControlLayout} from './segmented-control.types.js';

export interface SegmentedControlContextValue {
  /** The selected value ('' when nothing is selected). */
  value: string;
  size: ElementSize;
  layout: SegmentedControlLayout;
  /** The whole control is disabled (its own `disabled`, or a disabled fieldset). */
  disabled: boolean;
  /** Disabled *and* explained: the selected segment stays focusable so the reason is discoverable. */
  hasDisabledMessage: boolean;
  /**
   * A segment asks to become the value. The control decides (disabled, read-only, unchanged), updates
   * `value` and fires `input` then `change` once.
   */
  select(item: HTMLElement, value: string, event?: Event): void;
}

export const segmentedControlContext = createContext<SegmentedControlContextValue | null, symbol>(
  Symbol.for('tct.segmented-control'),
);
