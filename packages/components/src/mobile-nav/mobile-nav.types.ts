/** Which edge the drawer slides in from; `auto` picks the side of the toggle that opened it. */
export const MOBILE_NAV_SIDES = ['start', 'end', 'auto'] as const;
export type MobileNavSide = (typeof MOBILE_NAV_SIDES)[number];
