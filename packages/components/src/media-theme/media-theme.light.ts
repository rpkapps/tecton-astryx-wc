import {css} from 'lit';

/**
 * The light-DOM sheet, adopted onto the root that holds the element (A§6.7). It repeats
 * `media-theme.light.css`, which the generated `light-dom.css` ships for pages without JavaScript: a
 * `*.light.css` file is not compiled to a Lit `css` module the way `*.styles.css` is, and a node test
 * keeps the two identical.
 */
export const mediaThemeLightStyles = css`
  @layer tecton.light-dom {
    :where(tct-media-theme:not([hidden])) {
      display: contents;
    }
  }
`;
