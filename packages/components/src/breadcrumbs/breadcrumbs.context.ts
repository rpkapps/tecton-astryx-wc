/**
 * Family-private context (WORK-BREAKDOWN §1.6, A§9.4): what `tct-breadcrumbs` tells its items.
 * Upstream `BreadcrumbContext`, re-expressed for the Context Community Protocol.
 */
import {createContext} from '@tecton-wc/core/context/protocol.js';
import type {BreadcrumbsVariant} from './breadcrumbs.types.js';

/** What the trail knows about its items; an item reads it to render itself. */
export interface BreadcrumbsContextValue {
  readonly variant: BreadcrumbsVariant;
  /** Separator text between items (decorative, `aria-hidden`). */
  readonly separator: string;
  /** A registered icon name used as the separator instead of the text. */
  readonly separatorIcon: string;
  /** The item that is the current page by position: the last one, when none says so explicitly. */
  readonly autoCurrent: HTMLElement | null;
  /** Items collapsed into the overflow menu (`max-items`), in trail order. */
  readonly collapsed: readonly HTMLElement[];
  /**
   * An item changed something the trail derives from its children (`current`, its position): the trail
   * resolves the current page and the collapsed set again.
   */
  readonly refresh: () => void;
}

/** Upstream `BreadcrumbContext`. `null` outside a trail: an item still renders, with a `/` before it. */
export const breadcrumbsContext = createContext<BreadcrumbsContextValue | null, symbol>(
  Symbol.for('tct.breadcrumbs'),
);
