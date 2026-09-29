/// <reference types="vite/types/importMeta.d.ts" />

// Ambient declaration for component stylesheets compiled by tools/vite-plugin-tct-css.ts (A§2.3),
// plus `import.meta.env` for code that runs under Vite/Vitest.
declare module '*.styles.css' {
  import type {CSSResult} from 'lit';
  const styles: CSSResult;
  export default styles;
}

// Light-DOM sheets (`*.light.css`, A§6.7) are imported as CSS text and adopted at runtime by
// `TctProviderElement` / `adoptLightDomStyles`; the static `light-dom.css` build serves the rest.
declare module '*.light.css?inline' {
  const css: string;
  export default css;
}
