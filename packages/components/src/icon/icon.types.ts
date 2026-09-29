/** Icon colour variants (upstream `IconColor`); `inherit` follows the surrounding text colour. */
export const ICON_COLORS = [
  'inherit',
  'primary',
  'secondary',
  'tertiary',
  'disabled',
  'accent',
  'success',
  'error',
  'warning',
  'blue',
  'red',
  'green',
  'gray',
  'cyan',
  'teal',
  'yellow',
  'orange',
  'pink',
  'purple',
] as const;
export type IconColor = (typeof ICON_COLORS)[number];

/** Icon sizes (upstream `IconSize`): 12, 16, 20 and 24 CSS px (Tecton icon size tokens). */
export const ICON_SIZES = ['xsm', 'sm', 'md', 'lg'] as const;
export type IconSize = (typeof ICON_SIZES)[number];
