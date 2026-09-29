/// <reference types="vite/types/importMeta.d.ts" />

// Ambient declaration for component stylesheets compiled by tools/vite-plugin-tct-css.ts (A§2.3),
// plus `import.meta.env` for code that runs under Vite/Vitest.
declare module '*.styles.css' {
  import type {CSSResult} from 'lit';
  const styles: CSSResult;
  export default styles;
}
