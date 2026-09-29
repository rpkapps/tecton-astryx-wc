/**
 * Value resolution (A§5.2, D-001, D-002).
 *
 * Per emitted token and mode:
 *  1. `bindings.overrides.json` entry -> that palette path (D-001 rebinds, with a reason);
 *  2. else the semantic-map row has `exportAlt` -> the **Tecton export** value (asserted equal to the
 *     palette path the map states);
 *  3. else the map's `light` / `dark` path (Tecton binding derivation or upstream default);
 *  4. every colour must resolve to a palette path, else it is an error unless allowlisted.
 *
 * Token groups: the 258 upstream names (map.tokens), every `--tecton-color-*` role of the export
 * (verbatim names), the Tecton binding theme-local names as aliases of export roles, the
 * binding-only component roles, the export's non-colour tokens, and pipeline-defined extras.
 */
import type {Palette, PaletteEntry} from './palette.ts';
import {shortPath} from './palette.ts';
import type {TectonExport} from './export-css.ts';
import type {
  ExtraTokenEntry,
  Inputs,
  MapRole,
  Mode,
  OverrideEntry,
  PathValue,
  SemanticMap,
  ShadowPart,
  Token,
  TokenValue,
} from './model.ts';

export const MODES: readonly Mode[] = ['light', 'dark'];

export interface Resolved {
  tokens: Token[];
  byName: Map<string, Token>;
  /** Export colour vars whose palette path was found by hex (not stated by the map), with the alternatives. */
  hexResolved: {name: string; mode: Mode; chosen: string; alternatives: string[]}[];
  /** Deliberate differences between the map's own values and the export (D-001 audit trail). */
  exportOverMap: {token: string; mode: Mode; map: string; export: string}[];
}

const camelToKebab = (text: string) => text.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** `component.tab.restText` -> `--tecton-color-tab-rest-text`; `accent.lilac.fill` -> `--tecton-color-accent-lilac-fill`. */
export function roleTokenName(roleKey: string): string {
  const parts = roleKey.split('.');
  if (parts[0] === 'component') parts.shift();
  return `--tecton-color-${parts.map(camelToKebab).join('-')}`;
}

/** `--tecton-space-100` -> `tecton-space`, `--tecton-font-size-medium` -> `tecton-font-size`, ... */
function exportCategory(variable: string): string {
  const match =
    /^--tecton-(space|radius|border-width|icon-size|font-size|font-weight|line-height|font-family)-/.exec(
      variable,
    );
  if (!match) throw new Error(`tecton-tokens.css: unexpected non-colour variable ${variable}`);
  return `tecton-${match[1]!}`;
}

function paletteEntry(palette: Palette, path: string, context: string): PaletteEntry {
  const entry = palette.byPath.get(path);
  if (!entry) throw new Error(`${context}: palette path not found: ${path}`);
  return entry;
}

/** Checks that a `{path, value}` pair of the map matches the palette. */
function checkPathValue(palette: Palette, pv: PathValue, context: string): PaletteEntry {
  const entry = paletteEntry(palette, pv.path, context);
  if (entry.value !== pv.value.toLowerCase()) {
    throw new Error(
      `${context}: ${pv.path} is ${entry.value} in tecton.tokens.json but ${pv.value} in the map`,
    );
  }
  return entry;
}

/** Deterministic pick among palette entries that share a hex: prefer the mode's ramp, then shortest, then sorted. */
function pickByHex(candidates: PaletteEntry[], mode: Mode): PaletteEntry {
  const ramp = mode === 'light' ? '.onLight.' : '.onDark.';
  const score = (entry: PaletteEntry) => [
    entry.path.includes(ramp)
      ? 0
      : entry.path.includes('.onDark.') || entry.path.includes('.onLight.')
        ? 2
        : 1,
    entry.path.split('.').length,
    entry.path,
  ];
  return [...candidates].sort((a, b) => {
    const [sa, sb] = [score(a), score(b)];
    for (let i = 0; i < sa.length; i++) {
      if (sa[i]! < sb[i]!) return -1;
      if (sa[i]! > sb[i]!) return 1;
    }
    return 0;
  })[0]!;
}

interface ExportAlt {
  var: string;
  light: PathValue;
  dark: PathValue;
}

/** Palette paths the map states per export variable (asserted consistent across every mention). */
function exportPathIndex(map: SemanticMap): Map<string, ExportAlt> {
  const index = new Map<string, ExportAlt>();
  const add = (alt: ExportAlt | null | undefined, where: string) => {
    if (!alt) return;
    const known = index.get(alt.var);
    if (known) {
      if (
        known.light.path !== alt.light.path ||
        known.dark.path !== alt.dark.path ||
        known.light.value !== alt.light.value ||
        known.dark.value !== alt.dark.value
      )
        throw new Error(`semantic map: ${alt.var} has conflicting exportAlt entries (${where})`);
      return;
    }
    index.set(alt.var, alt);
  };
  for (const [name, token] of Object.entries(map.tokens)) add(token.exportAlt, name);
  for (const [name, role] of Object.entries(map.themeLocal)) add(role.exportAlt, name);
  for (const [name, role] of Object.entries(map.roles)) add(role.exportAlt, name);
  return index;
}

const isFullVar = (value: string) => /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(value);

export function resolveTokens(inputs: Inputs, palette: Palette, exp: TectonExport): Resolved {
  const map = inputs.semanticMap;
  const tokens: Token[] = [];
  const byName = new Map<string, Token>();
  const hexResolved: Resolved['hexResolved'] = [];
  const exportOverMap: Resolved['exportOverMap'] = [];
  const unresolvedAllowed = new Set(inputs.unresolvedAllow.entries.map((entry) => entry.token));

  const push = (token: Token) => {
    if (byName.has(token.name)) throw new Error(`duplicate token name ${token.name}`);
    byName.set(token.name, token);
    tokens.push(token);
  };

  const exportPaths = exportPathIndex(map);
  const exportHex = (variable: string, mode: Mode): string => {
    const value = (mode === 'light' ? exp.light : exp.dark).get(variable);
    if (value === undefined) throw new Error(`tecton-tokens.css has no ${variable}`);
    return value;
  };

  // ---- Group A: the upstream names (semantic map) -------------------------------------------------
  for (const [name, row] of Object.entries(map.tokens)) {
    const base = {
      name,
      category: row.category,
      description: `${row.notes ?? `${row.category} token`}${
        row.exportAlt && row.exportLightDiffers
          ? ' Light value: Tecton export (D-001); any light-mode figure quoted above describes the superseded Tecton binding derivation.'
          : ''
      }`,
    };
    const upstreamStatus = row.source === 'proposed' ? 'provisional' : row.source;

    if (row.parts) {
      for (const part of row.parts) {
        checkPathValue(palette, part.light, `${name} (light shadow colour)`);
        checkPathValue(palette, part.dark, `${name} (dark shadow colour)`);
      }
      push({
        ...base,
        value: {kind: 'shadow', parts: row.parts},
        status: upstreamStatus,
        source: `semantic map (${row.source})`,
      });
      continue;
    }

    if (row.references) {
      push({
        ...base,
        value: {kind: 'ref', name: row.references},
        status: upstreamStatus,
        source: `semantic map (${row.source}): upstream default var(${row.references})`,
      });
      continue;
    }

    if (row.light && row.dark) {
      const value: TokenValue = {kind: 'color', light: '', dark: ''};
      for (const mode of MODES) {
        const mapped = row[mode]!;
        let entryValue: string;
        let path: string;
        if (row.exportAlt) {
          const alt = row.exportAlt;
          const hex = exportHex(alt.var, mode);
          if (hex !== alt[mode].value.toLowerCase())
            throw new Error(
              `${name}: export ${alt.var} (${mode}) is ${hex}, map says ${alt[mode].value}`,
            );
          const entry = checkPathValue(palette, alt[mode], `${name} (${mode}, export ${alt.var})`);
          entryValue = entry.value;
          path = entry.path;
          if (mapped.value.toLowerCase() !== entryValue)
            exportOverMap.push({token: name, mode, map: mapped.value, export: entryValue});
        } else {
          const entry = checkPathValue(palette, mapped, `${name} (${mode})`);
          entryValue = entry.value;
          path = entry.path;
        }
        value[mode] = entryValue;
        value[mode === 'light' ? 'lightPath' : 'darkPath'] = path;
      }
      const viaExport = row.exportAlt !== undefined;
      push({
        ...base,
        value,
        status: viaExport ? 'tecton-export' : upstreamStatus,
        source: viaExport
          ? `tecton-tokens.css ${row.exportAlt!.var}${row.tectonRole ? ` (role ${row.tectonRole})` : ''}`
          : `semantic map (${row.source})${row.tectonRole ? ` role ${row.tectonRole}` : ''}`,
      });
      continue;
    }

    if (row.value !== undefined) {
      const ref = isFullVar(row.value);
      push({
        ...base,
        value: ref ? {kind: 'ref', name: ref[1]!} : {kind: 'literal', value: row.value},
        status: upstreamStatus,
        source: `semantic map (${row.source})`,
      });
      continue;
    }
    throw new Error(
      `semantic map: ${name} has neither colour paths, parts, references nor a value`,
    );
  }

  // ---- Group B: every --tecton-color-* role of the export, verbatim names -----------------------
  for (const variable of exp.light.keys()) {
    const stated = exportPaths.get(variable);
    const value: TokenValue = {kind: 'color', light: '', dark: ''};
    for (const mode of MODES) {
      const hex = exportHex(variable, mode);
      let path: string | undefined;
      if (stated) {
        path = checkPathValue(palette, stated[mode], `${variable} (${mode})`).path;
        if (stated[mode].value.toLowerCase() !== hex)
          throw new Error(`${variable} (${mode}): export ${hex} != map ${stated[mode].value}`);
      } else {
        const candidates = palette.byHex.get(hex);
        if (candidates && candidates.length > 0) {
          const chosen = pickByHex(candidates, mode);
          path = chosen.path;
          hexResolved.push({
            name: variable,
            mode,
            chosen: chosen.path,
            alternatives: candidates.filter((c) => c !== chosen).map((c) => c.path),
          });
        } else if (!unresolvedAllowed.has(variable)) {
          throw new Error(
            `${variable} (${mode}) = ${hex} resolves to no palette entry (add it to unresolved.allow.json with a reason)`,
          );
        }
      }
      value[mode] = hex;
      if (path !== undefined) value[mode === 'light' ? 'lightPath' : 'darkPath'] = path;
    }
    push({
      name: variable,
      category: 'tecton-role',
      value,
      status: 'tecton-export',
      source: `tecton-tokens.css ${variable}`,
      description: stated
        ? `Tecton role (export)`
        : `Tecton role (export); palette path found by hex`,
    });
  }

  // ---- Group C: Tecton binding theme-local names: aliases of the export roles --------------------
  for (const [name, role] of Object.entries(map.themeLocal)) {
    if (byName.has(name)) continue; // the export already carries this exact name
    if (!exp.light.has(role.exportAlt.var))
      throw new Error(`${name}: aliased export role ${role.exportAlt.var} does not exist`);
    push({
      name,
      category: 'tecton-role',
      value: {kind: 'ref', name: role.exportAlt.var},
      status: 'tecton-export',
      source: `alias of ${role.exportAlt.var} (theme-local binding name, role ${role.tectonRole ?? '?'})`,
      description:
        `Tecton role ${role.tectonRole ?? ''} (binding name); same value as ${role.exportAlt.var}`.trim(),
    });
  }

  // ---- Group D: binding-only component roles (no export counterpart) ----------------------
  for (const [key, role] of Object.entries<MapRole>(map.roles)) {
    if (role.exportAlt) continue;
    const name = roleTokenName(key);
    const light = checkPathValue(palette, role.light, `${key} (light)`);
    const dark = checkPathValue(palette, role.dark, `${key} (dark)`);
    push({
      name,
      category: 'tecton-role',
      value: {
        kind: 'color',
        light: light.value,
        dark: dark.value,
        lightPath: light.path,
        darkPath: dark.path,
      },
      status: 'tecton-binding',
      source: `semantic map role ${key} (Tecton binding; the export has no such role)`,
      description: `Tecton role ${key} (not in the export; Tecton binding derivation)`,
    });
  }

  // ---- Group E: the export's non-colour tokens --------------------------------------------------
  for (const [variable, value] of exp.nonColor) {
    const isFamily = variable.startsWith('--tecton-font-family-');
    let tokenValue: TokenValue = {kind: 'literal', value};
    let source = `tecton-tokens.css ${variable}`;
    if (isFamily) {
      // The export names the families only; the stacks (D-003) live in --font-family-*.
      tokenValue = {
        kind: 'ref',
        name: variable.endsWith('-mono') ? '--font-family-code' : '--font-family-body',
      };
      source += ` (${value}); the full stack is defined by --font-family-* (D-003)`;
    }
    push({
      name: variable,
      category: exportCategory(variable),
      value: tokenValue,
      status: 'tecton-export',
      source,
      description: `Tecton export value ${value}`,
    });
  }

  // ---- Group F: component tokens with a public upstream name, and pipeline extras ---------------
  for (const [name, row] of Object.entries(map.componentTokens)) {
    if (name.startsWith('--_') || row.value.startsWith('(')) continue; // private / compiler-emitted
    push({
      name,
      category: 'component',
      value: {kind: 'literal', value: row.value},
      status: 'tecton-binding',
      source: `semantic map componentTokens (${row.source}, ${row.target ?? 'component'})`,
      description: `Documented upstream component property (${row.target ?? ''}) with the Tecton default`,
    });
  }
  for (const extra of inputs.extraTokens.tokens) pushExtra(extra);

  function pushExtra(extra: ExtraTokenEntry) {
    if (extra.light !== undefined || extra.dark !== undefined) {
      const light = paletteEntry(palette, extra.light ?? extra.dark!, `${extra.name} (light)`);
      const dark = paletteEntry(palette, extra.dark ?? extra.light!, `${extra.name} (dark)`);
      push({
        name: extra.name,
        category: extra.category,
        value: {
          kind: 'color',
          light: light.value,
          dark: dark.value,
          lightPath: light.path,
          darkPath: dark.path,
        },
        status: 'provisional',
        provisional: extra.provisional,
        source: 'extra-tokens.json (pipeline-defined)',
        description: extra.description,
      });
    } else if (extra.value !== undefined) {
      push({
        name: extra.name,
        category: extra.category,
        value: {kind: 'literal', value: extra.value},
        status: 'provisional',
        provisional: extra.provisional,
        source: 'extra-tokens.json (pipeline-defined)',
        description: extra.description,
      });
    } else throw new Error(`extra-tokens.json: ${extra.name} has no value`);
  }

  applyOverrides(inputs.overrides.overrides, byName, palette);
  applyProvisional(inputs, tokens);

  return {tokens, byName, hexResolved, exportOverMap};
}

function applyOverrides(overrides: OverrideEntry[], byName: Map<string, Token>, palette: Palette) {
  const seen = new Set<string>();
  for (const override of overrides) {
    if (seen.has(override.token))
      throw new Error(`overrides: duplicate entry for ${override.token}`);
    seen.add(override.token);
    if (override.reason.trim() === '')
      throw new Error(`overrides: ${override.token} needs a reason`);
    const token = byName.get(override.token);
    if (!token) throw new Error(`overrides: unknown token ${override.token}`);
    const modes: Mode[] = [];
    if (override.light !== undefined || override.dark !== undefined) {
      if (token.value.kind !== 'color')
        throw new Error(`overrides: ${override.token} is not a colour token (use "value")`);
      for (const mode of MODES) {
        const path = override[mode];
        if (path === undefined) continue;
        const entry = paletteEntry(palette, path, `overrides ${override.token} (${mode})`);
        token.value[mode] = entry.value;
        token.value[mode === 'light' ? 'lightPath' : 'darkPath'] = entry.path;
        modes.push(mode);
      }
    }
    if (override.value !== undefined) {
      if (token.value.kind !== 'literal' && token.value.kind !== 'ref')
        throw new Error(`overrides: ${override.token} cannot take a literal value`);
      const ref = isFullVar(override.value);
      token.value = ref ? {kind: 'ref', name: ref[1]!} : {kind: 'literal', value: override.value};
    }
    token.status = override.status ?? 'tecton-binding';
    token.override = {reason: override.reason, modes};
    token.source = `${token.source} [override: ${override.reason}]`;
  }
}

/**
 * Applies `provisional.json` (D-002, D-013). Every token falls into at most one group: an explicit
 * `tectonDerived` entry (never provisional), `retained-default` names/categories, or provisional
 * names/categories (plus the pipeline extras, which carry their own reason). Overlaps are an error.
 */
function applyProvisional(inputs: Inputs, tokens: Token[]) {
  const {provisional} = inputs;
  const categories = new Map(provisional.categories.map((entry) => [entry.category, entry.reason]));
  const names = new Map(provisional.names.map((entry) => [entry.name, entry.reason]));
  const retainedCategories = new Map(
    provisional.retainedDefault.categories.map((entry) => [entry.category, entry.reason]),
  );
  const retainedNames = new Map(
    provisional.retainedDefault.names.map((entry) => [entry.name, entry.reason]),
  );
  const derived = new Map(
    provisional.tectonDerived.names.map((entry) => [entry.name, entry.reason]),
  );

  for (const token of tokens) {
    const isDerived = derived.has(token.name);
    const isRetained = retainedNames.has(token.name) || retainedCategories.has(token.category);
    const isProvisional =
      token.provisional !== undefined || names.has(token.name) || categories.has(token.category);
    if (Number(isDerived) + Number(isRetained) + Number(isProvisional) > 1)
      throw new Error(
        `provisional.json: ${token.name} is listed in more than one of provisional, retainedDefault and tectonDerived`,
      );

    if (isDerived) {
      if (token.status === 'provisional')
        throw new Error(
          `provisional.json: tectonDerived ${token.name} resolves to a provisional status`,
        );
      token.derived = derived.get(token.name)!;
    } else if (isRetained) {
      token.status = 'retained-default';
      token.retained = retainedNames.get(token.name) ?? retainedCategories.get(token.category)!;
    } else {
      const reason =
        token.provisional ??
        names.get(token.name) ??
        categories.get(token.category) ??
        (token.status === 'provisional'
          ? 'proposed value: no Tecton decision (semantic map)'
          : undefined);
      if (reason !== undefined) {
        token.status = 'provisional';
        token.provisional = reason;
      }
    }
  }
}

// ---- Value rendering ------------------------------------------------------------------------------

/** `0px 1px 2px <colour>` (or `inset 0px 0px 0px 2px <colour>`) for one shadow part. */
function shadowPartCss(part: ShadowPart, colour: string): string {
  const values = [
    part.inset ? 'inset' : '',
    part.offsetX ?? '0px',
    part.offsetY ?? '0px',
    part.blur ?? '0px',
    part.spread ?? '',
    colour,
  ];
  return values.filter((v) => v !== '').join(' ');
}

const lightDark = (light: string, dark: string) =>
  light === dark ? light : `light-dark(${light}, ${dark})`;

/**
 * CSS text of a token for one mode. `resolveRefs` replaces `var(--x)` references by the referenced
 * token's value (used for fallbacks and metadata); emission keeps them.
 */
export function cssValue(
  token: Token,
  mode: Mode,
  byName: ReadonlyMap<string, Token>,
  resolveRefs: boolean,
  depth = 0,
): string {
  if (depth > 8) throw new Error(`reference chain too deep at ${token.name}`);
  const value = token.value;
  switch (value.kind) {
    case 'color':
      return value[mode];
    case 'literal':
      return value.value;
    case 'shadow':
      return value.parts
        .map((part) => shadowPartCss(part, part[mode].value.toLowerCase()))
        .join(', ');
    case 'ref': {
      if (!resolveRefs) return `var(${value.name})`;
      const target = byName.get(value.name);
      if (!target) throw new Error(`${token.name} references unknown token ${value.name}`);
      return cssValue(target, mode, byName, true, depth + 1);
    }
  }
}

/** Light-dark form (`light-dark(a, b)`) or the single value when both modes agree. */
export function cssLightDark(token: Token, byName: ReadonlyMap<string, Token>): string {
  const value = token.value;
  if (value.kind === 'shadow') {
    return value.parts
      .map((part) =>
        shadowPartCss(
          part,
          lightDark(part.light.value.toLowerCase(), part.dark.value.toLowerCase()),
        ),
      )
      .join(', ');
  }
  return lightDark(cssValue(token, 'light', byName, false), cssValue(token, 'dark', byName, false));
}

/**
 * True when the token renders identically in both modes (emitted once). A reference (`var(--x)`) is only
 * invariant when its target is: `var()` is substituted where it is declared and the result inherits, so an
 * alias of a varying token must be redeclared inside every scheme island (fallback path).
 */
export function isModeInvariant(token: Token, byName: ReadonlyMap<string, Token>): boolean {
  const followRefs = token.value.kind === 'ref';
  return (
    cssValue(token, 'light', byName, followRefs) === cssValue(token, 'dark', byName, followRefs)
  );
}

/** True when a reference chain from `token` passes through one of `names`. */
export function dependsOn(
  token: Token,
  names: ReadonlySet<string>,
  byName: ReadonlyMap<string, Token>,
): boolean {
  let current: Token | undefined = token;
  for (let depth = 0; current?.value.kind === 'ref' && depth < 8; depth++) {
    if (names.has(current.value.name)) return true;
    current = byName.get(current.value.name);
  }
  return false;
}

/** Palette path of a mode for docs and comments (`—` for literals). */
export function pathOf(token: Token, mode: Mode): string | undefined {
  const value = token.value;
  if (value.kind === 'color') {
    const path = mode === 'light' ? value.lightPath : value.darkPath;
    return path === undefined ? undefined : shortPath(path);
  }
  if (value.kind === 'shadow') {
    return [...new Set(value.parts.map((part) => shortPath(part[mode].path)))].join(' + ');
  }
  return undefined;
}
