/** Shared types of the token pipeline (A§5). */

export type Mode = 'light' | 'dark';

/**
 * D-002 / A§5.2 status per token:
 * - `tecton-export`     value comes from the generated Tecton export (D-001)
 * - `tecton-astryx`     value comes from the owner's tecton-astryx theme (bindings, derivations)
 * - `upstream-default`  Tecton made no change; the Astryx default is kept
 * - `provisional`       proposed here, no Tecton decision (D-002)
 */
export type TokenStatus = 'tecton-export' | 'tecton-astryx' | 'upstream-default' | 'provisional';

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
  /** Astryx category (`core`, `surface`, `data`, …) or `tecton-role`, `tecton-<kind>`, `component`, `pipeline`. */
  category: string;
  value: TokenValue;
  status: TokenStatus;
  /** Human-readable origin, e.g. `tecton-tokens.css --tecton-color-action-primary-bg`. */
  source: string;
  description: string;
  /** Set when D-002 (or the provisional list) applies: why the value is only proposed. */
  provisional?: string;
  /** Set when `bindings.overrides.json` changed this token. */
  override?: {reason: string; modes: Mode[]};
}

/** Files of the copied inputs, parsed. */
export interface Inputs {
  paletteJson: unknown;
  exportCss: string;
  semanticMap: SemanticMap;
  astryxTokens: {count: number; tokens: Record<string, {category: string; default: string}>};
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
  source: 'tecton-astryx' | 'proposed' | 'upstream-default';
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

export interface ProvisionalFile {
  /** Categories whose tokens are all provisional. */
  categories: {category: string; reason: string}[];
  /** Individual tokens. */
  names: {name: string; reason: string}[];
  /** Items with no custom property (breakpoints, z-index, destructive button, missing icons, …). */
  nonTokens: {name: string; reason: string}[];
}
