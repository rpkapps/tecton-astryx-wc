/**
 * Banner statuses: the four upstream severities plus Tecton's fifth, `neutral` (the owner's React theme
 * adds it as a custom `BannerStatusMap` value).
 */
export const BANNER_STATUSES = ['info', 'warning', 'error', 'success', 'neutral'] as const;
export type BannerStatus = (typeof BANNER_STATUSES)[number];

/** `card` is a standalone rounded card; `section` is a full-width band with square corners. */
export const BANNER_CONTAINERS = ['card', 'section'] as const;
export type BannerContainer = (typeof BANNER_CONTAINERS)[number];

/** Resting shadow depth of a floating banner. */
export const BANNER_ELEVATIONS = ['none', 'low', 'med', 'high'] as const;
export type BannerElevation = (typeof BANNER_ELEVATIONS)[number];
