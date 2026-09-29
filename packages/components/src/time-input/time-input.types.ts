/** How a committed time is displayed: 12-hour with AM/PM ("2:30 PM") or 24-hour ("14:30"). */
export const TIME_HOUR_FORMATS = ['12h', '24h'] as const;
export type TimeHourFormat = (typeof TIME_HOUR_FORMATS)[number];
