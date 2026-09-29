/// <reference types="vite/types/importMeta.d.ts" />

// Vite `?raw` imports of the generated stylesheets, used by the browser tests.
declare module '*.css?raw' {
  const css: string;
  export default css;
}
