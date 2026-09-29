/**
 * The analyzer ships JavaScript with a types file that only describes its plugin and config shapes.
 * Its `create()` and the TypeScript instance it bundles (TS 5.4, whose `SyntaxKind` numbering differs
 * from the repository's TypeScript 6) are used programmatically by tools/cem/analyze.ts, so they
 * are declared here.
 */
declare module '@custom-elements-manifest/analyzer/index.js' {
  import type tsType from 'typescript';

  /** The TypeScript instance the analyzer walks ASTs with. Use it to parse, never the repo's copy. */
  export const ts: typeof tsType;

  export function create(options: {
    modules: tsType.SourceFile[];
    plugins?: readonly object[];
    context?: Record<string, unknown>;
  }): unknown;
}

declare module '@custom-elements-manifest/analyzer/src/features/framework-plugins/lit/lit.js' {
  export function litPlugin(): object[];
}
