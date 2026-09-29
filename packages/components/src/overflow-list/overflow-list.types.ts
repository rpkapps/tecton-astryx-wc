import type {TemplateResult} from 'lit';
import type {OverflowItem} from '@tecton-wc/core/events/tct-overflow-change.js';

export type {OverflowItem};

/** The gap steps (upstream `SpacingStep`); the value names the `--spacing-*` token. */
export const OVERFLOW_LIST_GAPS = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10] as const;
export type OverflowListGap = (typeof OVERFLOW_LIST_GAPS)[number];

/** Which end collapses first. */
export const OVERFLOW_LIST_COLLAPSE_FROM = ['start', 'end'] as const;
export type OverflowListCollapseFrom = (typeof OVERFLOW_LIST_COLLAPSE_FROM)[number];

/**
 * Which element's width decides how many items fit: the list itself, or its parent's content box (so
 * the list can stay content-sized while still noticing room to grow back).
 */
export const OVERFLOW_LIST_BEHAVIORS = ['observe-self', 'observe-parent'] as const;
export type OverflowListBehavior = (typeof OVERFLOW_LIST_BEHAVIORS)[number];

/** What an overflow renderer returns: a template, a node, or text (never HTML). */
export type OverflowRendererResult = TemplateResult | Node | string | null | undefined;

/** Renders the indicator for the collapsed items (upstream `overflowRenderer`). */
export type OverflowRenderer = (overflowItems: readonly OverflowItem[]) => OverflowRendererResult;

/** Parses the `gap` attribute: one of the spacing steps, else the default. */
export function parseGap(value: string | null): OverflowListGap {
  const step = Number(value);
  return (OVERFLOW_LIST_GAPS as readonly number[]).includes(step) ? (step as OverflowListGap) : 2;
}
