import {devWarn} from '@tecton-astryx/core/utils/dev.js';

/**
 * Built-in Astryx text types (upstream `BuiltinTextType`). `inherit` takes size, leading and weight
 * (and colour) from the surrounding text.
 */
export const BUILTIN_TEXT_TYPES = [
  'body',
  'large',
  'label',
  'supporting',
  'code',
  'display-1',
  'display-2',
  'display-3',
  'inherit',
] as const;

/**
 * Tecton text variants that no built-in type covers, registered as custom types (the owner's React
 * theme `customTextTypes`, kebab-cased): the strong and data variants and the two action sizes.
 */
export const TECTON_TEXT_TYPES = [
  'medium-strong',
  'small-strong',
  'tiny',
  'large-data',
  'medium-data',
  'small-data',
  'action-medium',
  'action-small',
] as const;

export const TEXT_TYPES = [...BUILTIN_TEXT_TYPES, ...TECTON_TEXT_TYPES] as const;

/**
 * A text type: a built-in or Tecton type, or any custom string. A custom type renders with the `body`
 * baseline and gets its treatment from your CSS (`tct-text[type="hero"]::part(text) {…}`).
 */
export type TextType = (typeof TEXT_TYPES)[number] | (string & {});

export const TEXT_SIZES = [
  '4xs',
  '3xs',
  '2xs',
  'xsm',
  'sm',
  'base',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

/** Built-in text colours. A custom colour renders as `primary` until your CSS styles `[color="brand"]`. */
export const TEXT_COLORS = [
  'primary',
  'secondary',
  'disabled',
  'placeholder',
  'accent',
  'inherit',
] as const;
export type TextColor = (typeof TEXT_COLORS)[number] | (string & {});

export const TEXT_WEIGHTS = ['normal', 'medium', 'semibold', 'bold'] as const;
export type TextWeight = (typeof TEXT_WEIGHTS)[number];

export const TEXT_DISPLAYS = ['inline', 'block'] as const;
export type TextDisplay = (typeof TEXT_DISPLAYS)[number];

export const WORD_BREAKS = ['break-word', 'break-all'] as const;
export type WordBreak = (typeof WORD_BREAKS)[number];

export const TEXT_WRAPS = ['wrap', 'nowrap', 'balance', 'pretty'] as const;
export type TextWrap = (typeof TEXT_WRAPS)[number];

export const TEXT_JUSTIFY = ['start', 'center', 'end'] as const;
export type TextJustify = (typeof TEXT_JUSTIFY)[number];

export const TEXT_ELEMENTS = ['span', 'p', 'div', 'label', 'h1', 'h2', 'h3'] as const;
export type TextElement = (typeof TEXT_ELEMENTS)[number];

/** Where the truncation tooltip sits (upstream `LayerPlacement`). */
export const TOOLTIP_PLACEMENTS = ['above', 'below', 'start', 'end'] as const;
export type TooltipPlacement = (typeof TOOLTIP_PLACEMENTS)[number];

/**
 * Dev-mode warning for an enumerated attribute that got a value outside its list (A§7.3): the value is
 * ignored by CSS, so the element falls back to its default look. Once per tag, attribute and value.
 */
export function warnInvalidValue(
  tag: string,
  attribute: string,
  value: string | undefined,
  allowed: readonly string[],
): void {
  if (value !== undefined && !allowed.includes(value)) {
    devWarn(
      `${tag}:${attribute}:${value}`,
      `<${tag} ${attribute}="${value}"> is not one of ${allowed.join(', ')}.`,
    );
  }
}
