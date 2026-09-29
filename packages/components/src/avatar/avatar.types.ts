import {devWarn} from '@tecton-astryx/core/utils/dev.js';

/** Named avatar sizes (upstream `AvatarNamedSize`): 20, 24, 36, 48 and 128 CSS px. */
export const AVATAR_NAMED_SIZES = ['xsm', 'sm', 'md', 'lg', 'xl'] as const;
export type AvatarNamedSize = (typeof AVATAR_NAMED_SIZES)[number];

/** The pixel values upstream documents; any positive number works at runtime. */
export type AvatarNumericSize =
  16 | 20 | 24 | 32 | 36 | 40 | 48 | 60 | 64 | 72 | 96 | 128 | 144 | 180;

/** A named size or a size in CSS px. */
export type AvatarSize = AvatarNamedSize | AvatarNumericSize;

export const AVATAR_SHAPES = ['circle', 'rounded', 'square'] as const;
export type AvatarShape = (typeof AVATAR_SHAPES)[number];

export const AVATAR_STATUS_DOT_VARIANTS = ['success', 'neutral', 'error'] as const;
export type AvatarStatusDotVariant = (typeof AVATAR_STATUS_DOT_VARIANTS)[number];

const NAMED_PX: Readonly<Record<AvatarNamedSize, number>> = {
  xsm: 20,
  sm: 24,
  md: 36,
  lg: 48,
  xl: 128,
};

/** Resolves a size (upstream `resolveSize`) to CSS px; an unknown value falls back to `md` (36). */
export function resolveSize(size: AvatarSize): number {
  if (typeof size === 'number') return Number.isFinite(size) && size > 0 ? size : NAMED_PX.md;
  // Attribute values are strings the type system cannot vouch for.
  const name: string = size;
  if (Object.hasOwn(NAMED_PX, name)) return NAMED_PX[name as AvatarNamedSize];
  devWarn(
    `avatar:size:${name}`,
    `Avatar size "${name}" is not ${AVATAR_NAMED_SIZES.join(', ')} or a number of pixels; using md.`,
  );
  return NAMED_PX.md;
}

/** `size="48"` arrives as a string; a numeric string is pixels, anything else stays a name. */
export const sizeConverter = {
  fromAttribute(value: string | null): AvatarSize {
    if (value === null) return 'md';
    return /^\d+(\.\d+)?$/.test(value.trim())
      ? (Number(value) as AvatarSize)
      : (value as AvatarSize);
  },
};
