import type {BoxSize} from '@tecton-astryx/core/mixins/box-props.js';
import {devWarn} from '@tecton-astryx/core/utils/dev.js';

/**
 * Height behaviour of a layout: `fill` takes the height of its container and scrolls the content
 * inside; `auto` grows with its content and lets the page scroll.
 */
export const LAYOUT_HEIGHTS = ['fill', 'auto'] as const;
export type LayoutHeight = (typeof LAYOUT_HEIGHTS)[number];

/**
 * The attribute an edge-compensatable component (a ghost button, a tab) puts on its host so the
 * container it sits flush in can pull its own padding in by the component's transparent padding
 * (upstream `EDGE_COMP_ATTR`). A container opts in with `::slotted([data-tct-edge-comp]:first-child)`.
 */
export const EDGE_COMP_ATTR = 'data-tct-edge-comp';

/** `value` when it is one of `allowed`, otherwise `fallback` (with a once-only dev warning). */
export function pick<const T extends readonly string[]>(
  allowed: T,
  value: unknown,
  fallback: T[number],
  what: string,
): T[number] {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) return value;
  if (value !== undefined && value !== null && value !== '') {
    const shown =
      typeof value === 'string' || typeof value === 'number' ? String(value) : typeof value;
    devWarn(`layout:${what}:${shown}`, `${what}="${shown}" is not one of ${allowed.join(', ')}.`);
  }
  return fallback;
}

/** A number is px; anything else is a CSS length used as written. */
export function cssLength(value: BoxSize | null | undefined): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return `${value}px`;
  return /^-?\d+(\.\d+)?$/.test(value.trim()) ? `${value.trim()}px` : value;
}

/**
 * Whether `contentWidth` can take part in the internal alignment arithmetic (it is subtracted from
 * the query container's width in CSS). Percentages, intrinsic sizes and bare variables cannot, so
 * they keep the constrained composition instead.
 */
export function supportsInternalContentWidth(width: BoxSize | undefined): boolean {
  if (width === undefined || width === null || width === '') return false;
  if (typeof width === 'number') return true;
  const value = width.trim().toLowerCase();
  if (value === '') return false;
  // A bare number is px (an attribute value).
  if (/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) return true;
  if (value.includes('%')) return false;
  return (
    value === '0' ||
    /^-?(?:\d+(?:\.\d+)?|\.\d+)[a-z]+$/.test(value) ||
    /^(?:calc|min|max|clamp)\(/.test(value)
  );
}
