/** `input` is a compact field; `dropzone` is a larger surface that also takes dropped files. */
export const FILE_INPUT_MODES = ['input', 'dropzone'] as const;
export type FileInputMode = (typeof FILE_INPUT_MODES)[number];

/**
 * Whether `file` matches an `accept` list in the HTML attribute format: extensions (`.pdf`), wildcard
 * types (`image/*`) and exact types (`image/png`), comma separated and case-insensitive.
 */
export function acceptsFile(file: {name: string; type: string}, accept: string): boolean {
  const tokens = accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith('.')) return name.endsWith(token);
    if (token.endsWith('/*')) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

/** A size in bytes as text in `locale`: `512 byte`, `1.5 kB`, `2.0 MB` (Intl units, one decimal above bytes). */
export function formatFileSize(bytes: number, locale?: string): string {
  const [value, unit] =
    bytes < 1024
      ? [bytes, 'byte']
      : bytes < 1024 * 1024
        ? [bytes / 1024, 'kilobyte']
        : [bytes / (1024 * 1024), 'megabyte'];
  const fractionDigits = unit === 'byte' ? 0 : 1;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'unit',
      unit,
      unitDisplay: 'short',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return `${value.toFixed(fractionDigits)} ${unit}`;
  }
}
