/**
 * How the navigation areas contrast with the content: `wash` (wash background, no dividers), `surface`
 * (surface background, no dividers), `section` (dividers between navigation and content: the classic
 * look) or `elevated` (a wash navigation frame around an elevated content surface with a rounded corner).
 */
export const APP_SHELL_VARIANTS = ['wash', 'surface', 'section', 'elevated'] as const;
export type AppShellVariant = (typeof APP_SHELL_VARIANTS)[number];

/**
 * The named width below which the shell switches to the mobile navigation: `sm` 640, `md` 768 (default),
 * `lg` 1024, `xl` 1280 or `2xl` 1536 px (or the values of the nearest theme), and `none` for never.
 * The edge belongs to the wider layout: at exactly the breakpoint the shell is not mobile.
 */
export const APP_SHELL_BREAKPOINTS = ['sm', 'md', 'lg', 'xl', '2xl', 'none'] as const;
export type AppShellBreakpoint = (typeof APP_SHELL_BREAKPOINTS)[number];

/** The id of the main region: the target of the skip link. */
export const APP_SHELL_MAIN_ID = 'tct-app-shell-main';
