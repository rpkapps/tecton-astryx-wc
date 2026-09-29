/**
 * Family-private context (WORK-BREAKDOWN §1.6, A§9.4): what `tct-tab-list` tells its tabs and menus.
 * Upstream `TabListContext` / `useTabListContext`, re-expressed for the Context Community Protocol.
 */
import {createContext} from '@tecton-wc/core/context/protocol.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import type {TabListLayout, TabListPattern, TabListSize} from './tab-list.types.js';

export interface TabListContextValue {
  /** The selected value ('' when nothing is selected). */
  readonly value: string;
  readonly size: TabListSize;
  readonly layout: TabListLayout;
  /** The pattern the strip resolved to. */
  readonly pattern: TabListPattern;
  /**
   * A tab or menu option asks to become the value. The strip decides: it asks first through the
   * cancelable `tct-value-change`, then applies the value unless that was prevented.
   */
  readonly select: (value: string, reason: ChangeReason) => void;
  /**
   * A stop (tab or menu) rendered something the strip must react to: a new native control (the tab
   * became a link) or new options. The strip re-places its roving tab stop.
   */
  readonly refresh: () => void;
}

/** Upstream `TabListContext`. `null` outside a tab list: a tab still renders, and selects nothing. */
export const tabListContext = createContext<TabListContextValue | null, symbol>(
  Symbol.for('tct.tab-list'),
);
