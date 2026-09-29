import {devWarn} from '@tecton-wc/core/utils/dev.js';

/** Stack direction (upstream `StackDirection`): `horizontal` flows in the inline axis. */
export const STACK_DIRECTIONS = ['horizontal', 'vertical'] as const;
export type StackDirection = (typeof STACK_DIRECTIONS)[number];

/** Main-axis alignment values (`justify-content`). */
export const STACK_MAIN_ALIGNMENTS = [
  'start',
  'center',
  'end',
  'between',
  'around',
  'evenly',
] as const;
export type StackMainAlignment = (typeof STACK_MAIN_ALIGNMENTS)[number];

/** Cross-axis alignment values (`align-items`). */
export const STACK_CROSS_ALIGNMENTS = ['start', 'center', 'end', 'stretch'] as const;
export type StackCrossAlignment = (typeof STACK_CROSS_ALIGNMENTS)[number];

/** Everything `h-align` and `v-align` accept: which subset is valid depends on the axis (upstream `StackAlignment`). */
export const STACK_ALIGNMENTS = [...STACK_MAIN_ALIGNMENTS, 'stretch'] as const;
export type StackAlignment = (typeof STACK_ALIGNMENTS)[number];

/** Flex wrap behaviour. */
export const STACK_WRAPS = ['nowrap', 'wrap', 'wrap-reverse'] as const;
export type StackWrap = (typeof STACK_WRAPS)[number];

/** Per-item flex participation. */
export const STACK_ITEM_SIZES = ['static', 'fill'] as const;
export type StackItemSize = (typeof STACK_ITEM_SIZES)[number];

/** Per-item cross-axis override (`align-self`). */
export const STACK_ITEM_CROSS_ALIGN_SELF = STACK_CROSS_ALIGNMENTS;
export type StackItemCrossAlignSelf = StackCrossAlignment;

/**
 * Elements a stack (or stack item) can render as. Upstream accepts any `ElementType`; a fixed list
 * covers the semantic containers that make sense around slotted content (`form` is left out: a
 * `<form>` inside a shadow root does not own the slotted controls).
 */
export const STACK_ELEMENTS = [
  'div',
  'section',
  'article',
  'aside',
  'nav',
  'header',
  'footer',
  'main',
  'ul',
  'ol',
  'li',
] as const;
export type StackElement = (typeof STACK_ELEMENTS)[number];

/** `value` when it is one of `allowed`, otherwise `undefined` (with a once-only dev warning). */
export function oneOf<const T extends readonly string[]>(
  allowed: T,
  value: unknown,
  what: string,
): T[number] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const found = allowed.find((item) => item === value);
  if (found !== undefined) return found;
  const shown = typeof value === 'string' ? value : typeof value;
  devWarn(`stack:${what}:${shown}`, `${what}="${shown}" is not one of ${allowed.join(', ')}.`);
  return undefined;
}

export interface StackAlignmentInput {
  direction: StackDirection;
  hAlign?: StackAlignment | undefined;
  vAlign?: StackAlignment | undefined;
  justify?: StackMainAlignment | undefined;
  alignment?: StackCrossAlignment | undefined;
}

/**
 * Upstream's resolution, unchanged: `justify` and `alignment` are direction-relative aliases that
 * lose to an explicit `h-align`/`v-align`; `h-align` is the main axis of a horizontal stack and the
 * cross axis of a vertical one. A value that does not belong to its axis (`stretch` on the main
 * axis, `between` on the cross axis) is ignored, as upstream's lookup tables ignore it.
 */
export function resolveStackAlignment(input: StackAlignmentInput): {
  main: StackMainAlignment | undefined;
  cross: StackCrossAlignment | undefined;
} {
  const horizontal = input.direction === 'horizontal';
  const h = input.hAlign ?? (horizontal ? input.justify : input.alignment);
  const v = input.vAlign ?? (horizontal ? input.alignment : input.justify);
  const main = horizontal ? h : v;
  const cross = horizontal ? v : h;
  return {
    main: (STACK_MAIN_ALIGNMENTS as readonly string[]).includes(main ?? '')
      ? (main as StackMainAlignment)
      : undefined,
    cross: (STACK_CROSS_ALIGNMENTS as readonly string[]).includes(cross ?? '')
      ? (cross as StackCrossAlignment)
      : undefined,
  };
}
