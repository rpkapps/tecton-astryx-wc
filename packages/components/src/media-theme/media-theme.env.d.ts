// The light-DOM stylesheet is imported as text: only `*.styles.css` files are compiled to Lit `css`
// by tools/vite-plugin-tct-css.ts, and `*.light.css` is also concatenated into light-dom.css (A§6.7).
declare module '*.light.css?raw' {
  const css: string;
  export default css;
}
