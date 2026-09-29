/** Layout orientation: `vertical` stacks the pairs (in columns), `horizontal` flows them in a wrapping row. */
export const METADATA_LIST_ORIENTATIONS = ['vertical', 'horizontal'] as const;
export type MetadataListOrientation = (typeof METADATA_LIST_ORIENTATIONS)[number];

/** Where each label sits: `start` beside its value, `top` above it. */
export const METADATA_LIST_LABEL_POSITIONS = ['start', 'top'] as const;
export type MetadataListLabelPosition = (typeof METADATA_LIST_LABEL_POSITIONS)[number];

/** Column layout: one column, as many as fit (`multi`), or a fixed count. */
export type MetadataListColumns = 'single' | 'multi' | number;

/** Parses the `columns` attribute: `single`, `multi`, or a whole number of columns. */
export function parseColumns(value: string | null): MetadataListColumns {
  if (value === null) return 'single';
  const text = value.trim();
  if (text === 'multi') return 'multi';
  const count = Number(text);
  return text !== '' && Number.isFinite(count) && count >= 1 ? Math.floor(count) : 'single';
}

/** Parses `label-width`: a bare number is CSS pixels, anything else is a CSS length. */
export function parseLabelWidth(value: string | null): string | number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const text = value.trim();
  const number = Number(text);
  return Number.isFinite(number) ? number : text;
}
