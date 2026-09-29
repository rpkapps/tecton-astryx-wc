/**
 * Names the theme system writes to and reads from the DOM and CSS (upstream `naming.ts`, adapted
 * from the upstream design system, MIT). Upstream spreads its namespace prefix over classes, `data-*`
 * attributes and custom properties; the web components have three surfaces instead:
 *
 *  - the theme scope attribute `data-tct-theme="<name>"`, written by `tct-theme`;
 *  - the media surface attribute `data-media-theme="dark|light"`, written by `tct-media-theme` and
 *    targeted by the token pipeline's `[data-media-theme]` blocks;
 *  - public component custom properties, which follow `--<component>-<css-property>` (A§6.3), so no
 *    namespace segment.
 */

/** Attribute that names the theme a subtree uses; the scope root of generated theme CSS. */
export const THEME_ATTRIBUTE = 'data-tct-theme';

/** Attribute that marks a media surface (`dark` or `light`); written by `tct-media-theme`. */
export const MEDIA_ATTRIBUTE = 'data-media-theme';

/** Tag prefix of every element. */
export const TAG_PREFIX = 'tct-';

/** A public component custom property name: `cssVar('card-padding')` is `--card-padding`. */
export function cssVar(name: string): string {
  return `--${name}`;
}
