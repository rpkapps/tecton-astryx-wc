/** Token heights: `sm`, `md` and `lg` are the control height of the size minus 8px. */
export const TOKEN_SIZES = ['sm', 'md', 'lg'] as const;
export type TokenSize = (typeof TOKEN_SIZES)[number];

/** Token colours: the neutral chip and the ten tinted hues (upstream `TokenColorMap`). */
export const TOKEN_COLORS = [
  'default',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'cyan',
  'blue',
  'purple',
  'pink',
  'gray',
] as const;
export type TokenColor = (typeof TOKEN_COLORS)[number];
