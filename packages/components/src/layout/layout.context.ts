import {createContext, ContextProviderEvent} from '@tecton-wc/core/context/protocol.js';
import {layoutAreaContext} from '@tecton-wc/core/context/keys.js';

/**
 * Which slots of the enclosing `tct-layout` are filled, so the regions inside can collapse the
 * padding where two of them meet (upstream `LayoutSlotsContext`). `headerFlush` and `footerFlush` say
 * that the header or footer is filled and draws no divider: the content then runs into it without a
 * gap.
 */
export interface LayoutSlotsValue {
  readonly hasHeader: boolean;
  readonly hasFooter: boolean;
  readonly hasStart: boolean;
  readonly hasEnd: boolean;
  readonly headerFlush: boolean;
  readonly footerFlush: boolean;
}

export const NO_LAYOUT_SLOTS: LayoutSlotsValue = {
  hasHeader: false,
  hasFooter: false,
  hasStart: false,
  hasEnd: false,
  headerFlush: false,
  footerFlush: false,
};

export const layoutSlotsContext = createContext<LayoutSlotsValue, symbol>(
  Symbol.for('tct.layout-slots'),
);

/**
 * The divider default a layout states for its headers and footers (upstream `LayoutDividerContext`).
 * A layout that states none passes its parent's on.
 */
export interface LayoutDividerValue {
  readonly defaultHasDividers: boolean;
}

export const layoutDividerContext = createContext<LayoutDividerValue | null, symbol>(
  Symbol.for('tct.layout-divider'),
);

/**
 * Tells the regions inside a layout that it answers `layoutAreaContext` now, so the ones that asked
 * before it could answer ask again. A plain function, not a class member, so it does not show up as an
 * event of the layout.
 */
export function announceLayoutAreaProvider(layout: HTMLElement): void {
  layout.dispatchEvent(new ContextProviderEvent(layoutAreaContext, layout));
}
