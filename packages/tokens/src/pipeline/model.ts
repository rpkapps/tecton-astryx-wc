/** Shared types of the token pipeline (A§5). */

export type Mode = 'light' | 'dark';

/**
 * D-002 / D-013 / A§5.2 status per token:
 * - `tecton-export`     value comes from the generated Tecton export (D-001)
 * - `tecton-binding`     value comes from the owner's Tecton binding theme (bindings, derivations)
 * - `upstream-default`  Tecton made no change; the upstream default is kept
 * - `retained-default`   not a brand token and Tecton has none (motion, breakpoints, z-index): the upstream
 *                       value is kept on purpose (D-013 Q-06)
 * - `provisional`       proposed here, no Tecton decision (D-002; D-013: data-viz, `--size-element-lg`,
 *                       the pipeline-defined extras)
 */
export type TokenStatus =
  'tecton-export' | 'tecton-binding' | 'upstream-default' | 'retained-default' | 'provisional';

export interface PathValue {
  path: string;
  value: string;
}

export interface ShadowPart {
  inset?: boolean;
  offsetX?: string;
  offsetY?: string;
  blur?: string;
  spread?: string;
  light: PathValue;
  dark: PathValue;
}

/** What a token holds. `ref` is `var(--name)` in both modes (aliases, syntax tokens, type scale). */
export type TokenValue =
  | {kind: 'color'; light: string; dark: string; lightPath?: string; darkPath?: string}
  | {kind: 'literal'; value: string}
  | {kind: 'ref'; name: string}
  | {kind: 'shadow'; parts: ShadowPart[]};

export interface Token {
  name: string;
  /** Upstream category (`core`, `surface`, `data`, …) or `tecton-role`, `tecton-<kind>`, `component`, `pipeline`. */
  category: string;
  value: TokenValue;
  status: TokenStatus;
  /** Human-readable origin, e.g. `tecton-tokens.css --tecton-color-action-primary-bg`. */
  source: string;
  description: string;
  /** Set when D-002 (or the provisional list) applies: why the value is only proposed. */
  provisional?: string;
  /** Set for `retained-default` tokens (D-013 Q-06): why the upstream value is kept. */
  retained?: string;
  /** Set for tokens `provisional.json` lists as Tecton-derived by decision (D-013 Q-06): what they map to. */
  derived?: string;
  /** Set when `bindings.overrides.json` changed this token. */
  override?: {reason: string; modes: Mode[]};
}

/** Files of the copied inputs, parsed. */
export interface Inputs {
  paletteJson: unknown;
  exportCss: string;
  semanticMap: SemanticMap;
  upstreamTokens: {count: number; tokens: Record<string, {category: string; default: string}>};
  tailwindNames: {names: string[]; source: {package: string}};
  overrides: OverridesFile;
  extraTokens: ExtraTokensFile;
  provisional: ProvisionalFile;
  unresolvedAllow: {entries: {token: string; reason: string}[]};
}

export interface MapToken {
  category: string;
  upstreamDefault: string;
  light?: PathValue;
  dark?: PathValue;
  css?: string;
  value?: string;
  parts?: ShadowPart[];
  references?: string;
  source: 'tecton-binding' | 'proposed' | 'upstream-default';
  tectonRole?: string;
  exportAlt?: {var: string; light: PathValue; dark: PathValue};
  exportLightDiffers?: boolean;
  notes?: string;
  verdict?: string;
}

export interface MapRole {
  light: PathValue;
  dark: PathValue;
  tectonRole?: string;
  source?: string;
  exportAlt?: {var: string; light: PathValue; dark: PathValue} | null;
  notes?: string;
}

export interface SemanticMap {
  tokens: Record<string, MapToken>;
  themeLocal: Record<
    string,
    MapRole & {exportAlt: {var: string; light: PathValue; dark: PathValue}}
  >;
  roles: Record<string, MapRole>;
  onMedia: Record<
    'onDark' | 'onLight',
    {tecton: Record<string, {light: PathValue; dark: PathValue}>}
  >;
  componentTokens: Record<string, {value: string; source: string; target?: string}>;
  breakpoints: {source: string; values: Record<string, number>; notes?: string};
}

export interface OverrideEntry {
  token: string;
  /** Palette path (`foundational.color…`) for the light mode. */
  light?: string;
  dark?: string;
  /** Literal replacement for a non-colour token. */
  value?: string;
  status?: TokenStatus;
  reason: string;
}
export interface OverridesFile {
  overrides: OverrideEntry[];
  /** Names emitted without an upstream counterpart and without a `--tecton-` prefix (coverage rule). */
  allowedExtraNames: {name: string; reason: string}[];
}

export interface ExtraTokenEntry {
  name: string;
  category: string;
  description: string;
  /** Provisional reason (D-002): pipeline-defined values have no Tecton decision. */
  provisional: string;
  light?: string;
  dark?: string;
  value?: string;
}
export interface ExtraTokensFile {
  tokens: ExtraTokenEntry[];
}

/** A named reason (token, category or item without a custom property). */
export interface ReasonEntry {
  name: string;
  reason: string;
}

/**
 * `provisional.json` (D-002, D-013). Three disjoint groups; `tokens:check` enforces the exact sets:
 * - provisional: no Tecton decision, proposed values;
 * - `retainedDefault`: not brand tokens (motion, breakpoints, z-index), upstream values kept on purpose;
 * - `tectonDerived`: settled by D-013 Q-06 as Tecton-derived (headings 3-6, letter-spacing, destructive button).
 */
export interface ProvisionalFile {
  /** Categories whose tokens are all provisional. */
  categories: {category: string; reason: string}[];
  /** Individual tokens. */
  names: ReasonEntry[];
  /** Provisional items with no custom property (missing icons, ...). */
  nonTokens: ReasonEntry[];
  retainedDefault: {
    /** Categories whose tokens are all `retained-default`. */
    categories: {category: string; reason: string}[];
    names: ReasonEntry[];
    /** Items with no custom property (breakpoints, z-index). */
    nonTokens: ReasonEntry[];
  };
  tectonDerived: {
    /** Tokens whose value is Tecton-derived by decision (never provisional). */
    names: ReasonEntry[];
    /** Items with no custom property: letter-spacing, the destructive button binding. */
    nonTokens: TectonDerivedNonToken[];
  };
}

export interface TectonDerivedNonToken extends ReasonEntry {
  /** The resolved value when the item is a single literal (`letter-spacing: normal`). */
  value?: string;
  /** Component-layer usage -> the emitted Tecton role token it is bound to (each must exist). */
  binds?: Record<string, string>;
}
