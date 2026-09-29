/**
 * Family-private context (WORK-BREAKDOWN §1.6, A§9.4): what `tct-collapsible-group` tells the
 * collapsibles below it. Upstream `CollapsibleGroupContext` (state) and
 * `CollapsibleGroupPresentationContext` (dividers, density, chevron) in one value: the group cannot
 * draw row chrome from outside a collapsible's shadow root, so each collapsible reads how to look.
 */
import {createContext} from '@tecton-astryx/core/context/protocol.js';
import type {CollapsibleChevronPosition, CollapsibleDensity} from './collapsible.types.js';

export interface CollapsibleGroupContextValue {
  /** Whether the item with this `value` is open. */
  isOpen(value: string): boolean;
  /** A user asked to toggle the item; the group decides, updates and fires `tct-value-change`. */
  toggle(value: string, event?: Event): void;
  /** Dividers between items: the accordion row chrome. */
  hasDividers: boolean;
  /** Resolved row density, or `null` for the default (unpadded) look. */
  density: CollapsibleDensity | null;
  /** Chevron position for the group's direct items (an item's own value wins), or `null`. */
  chevronPosition: CollapsibleChevronPosition | null;
}

export const collapsibleGroupContext = createContext<CollapsibleGroupContextValue | null, symbol>(
  Symbol.for('tct.collapsible-group'),
);
