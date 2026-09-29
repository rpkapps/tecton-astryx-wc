/**
 * `pnpm tokens:check` (A§5.6). Every check returns its problems as text; none throws, so the report
 * lists all of them at once.
 */
import {existsSync, readFileSync} from 'node:fs';
import {evaluateMatrix, measureMatrix} from './contrast.ts';
import type {AllowFile, PairsFile} from './contrast.ts';
import type {BuildResult} from './build.ts';
import {tokenMeta} from './emit-meta.ts';
import {PALETTE_PREFIX} from './palette.ts';
import {cssValue} from './resolve.ts';

export interface CheckResult {
  name: string;
  problems: string[];
  /** One-line summary printed for passing checks. */
  note?: string;
}

/** Tailwind v4 default-theme names that Astryx also defines. Documented (styling.md 3.1); layer order resolves them. */
export const DOCUMENTED_TAILWIND_COLLISIONS = [
  '--font-weight-bold',
  '--font-weight-medium',
  '--font-weight-normal',
  '--font-weight-semibold',
];

/** D-002: what has no Tecton decision and is therefore provisional (breakpoints, z-index, letter-spacing, the destructive button and icons have no custom property: provisional.json `nonTokens`). */
export const D002_TOKEN_CATEGORIES = ['data', 'motion'];
export const D002_TOKEN_NAMES = ['--size-element-lg'];

/** D-001 spot checks: the export is authoritative for role values in both modes; overrides are explicit. */
export const D001_SPOT_CHECKS: {
  token: string;
  mode: 'light' | 'dark';
  expected: string;
  why: string;
}[] = [
  {
    token: '--color-accent',
    mode: 'light',
    expected: '#644a78',
    why: 'export action.primary.background (mauve.onLight.680), not the derived #b89dc8',
  },
  {
    token: '--color-accent',
    mode: 'dark',
    expected: '#5d4d68',
    why: 'export = tecton-astryx (violet.onDark.220)',
  },
  {
    token: '--color-on-accent',
    mode: 'light',
    expected: '#f7f3f8',
    why: 'export action.primary.text',
  },
  {
    token: '--color-text-primary',
    mode: 'light',
    expected: '#21172a',
    why: 'export text.primary (graphite.onLight.1570)',
  },
  {token: '--color-text-primary', mode: 'dark', expected: '#f6f5f8', why: 'export = tecton-astryx'},
  {
    token: '--color-warning',
    mode: 'light',
    expected: '#ffdd89',
    why: 'export status.warning.filledBackground',
  },
  {
    token: '--color-error',
    mode: 'light',
    expected: '#a3240d',
    why: 'export status.error.filledBackground',
  },
  {token: '--focus-outline-color', mode: 'light', expected: '#ff00aa', why: 'hot pink, light'},
  {token: '--focus-outline-color', mode: 'dark', expected: '#ff52a8', why: 'hot pink, dark'},
  {
    token: '--color-text-accent',
    mode: 'light',
    expected: '#5c3878',
    why: 'accent-ink rebind (override): the export value #dbcae1 is 1.4:1 as ink',
  },
  {
    token: '--color-icon-accent',
    mode: 'light',
    expected: '#5c3878',
    why: 'accent-ink rebind (override)',
  },
  {
    token: '--color-text-accent',
    mode: 'dark',
    expected: '#beb1c8',
    why: 'export action.primary.adornment (dark) is a valid ink',
  },
  {
    token: '--tecton-color-input-border-hover',
    mode: 'dark',
    expected: '#a7a2ac',
    why: 'one of the 3 swapped text-field dark roles: the export wins over tecton-astryx (#cac5d2)',
  },
  {
    token: '--tecton-color-input-outlined-border-hover',
    mode: 'dark',
    expected: '#a7a2ac',
    why: 'export role behind the swapped input hover border',
  },
  {
    token: '--tecton-color-top-nav-background',
    mode: 'light',
    expected: '#ffffff',
    why: 'export: the top-nav band turns white in light mode',
  },
];

export function checkInputs(problems: string[]): CheckResult {
  return {name: 'input hashes (inputs.lock.json)', problems};
}

export function checkPalette(result: BuildResult): CheckResult {
  const problems: string[] = [];
  const {palette, resolved} = result;
  if (palette.entries.length !== 1820)
    problems.push(`expected 1,820 palette entries, found ${palette.entries.length}`);
  const emitted = new Set(resolved.tokens.map((token) => token.name));
  for (const entry of palette.entries) {
    if (emitted.has(entry.name))
      problems.push(`palette name ${entry.name} collides with a semantic token`);
  }
  for (const token of resolved.tokens) {
    if (token.name.startsWith(PALETTE_PREFIX))
      problems.push(`semantic token ${token.name} uses the reserved palette prefix`);
  }
  return {
    name: 'palette (1,820 names, no collisions)',
    problems,
    note: `${palette.entries.length} names`,
  };
}

export function checkD001(result: BuildResult): CheckResult {
  const problems: string[] = [];
  const {byName} = result.resolved;
  const {exportRoles} = result;
  for (const spot of D001_SPOT_CHECKS) {
    const token = byName.get(spot.token);
    if (!token) {
      problems.push(`${spot.token}: not emitted`);
      continue;
    }
    const actual = cssValue(token, spot.mode, byName, true);
    if (actual !== spot.expected)
      problems.push(
        `${spot.token} (${spot.mode}) is ${actual}, expected ${spot.expected} (${spot.why})`,
      );
  }
  // Every export role is emitted verbatim in both modes, unless an override says otherwise.
  for (const mode of ['light', 'dark'] as const) {
    for (const [name, hex] of exportRoles[mode]) {
      const token = byName.get(name);
      if (!token) {
        problems.push(`${name}: export role not emitted`);
      } else if (!token.override && cssValue(token, mode, byName, true) !== hex) {
        problems.push(`${name} (${mode}) differs from the export (${hex}) without an override`);
      }
    }
  }
  // Every colour resolves to a palette path (D-001: flag any that do not).
  for (const token of result.resolved.tokens) {
    if (token.value.kind !== 'color') continue;
    for (const mode of ['light', 'dark'] as const) {
      const path = mode === 'light' ? token.value.lightPath : token.value.darkPath;
      if (path === undefined) problems.push(`${token.name} (${mode}) resolves to no palette entry`);
      else if (result.palette.byPath.get(path)?.value !== token.value[mode])
        problems.push(`${token.name} (${mode}) is ${token.value[mode]} but ${path} differs`);
    }
  }
  return {
    name: 'D-001 (export authoritative, every colour on a palette path)',
    problems,
    note: `${D001_SPOT_CHECKS.length} spot checks, ${result.resolved.exportOverMap.length} export-over-map values, ${result.resolved.tokens.filter((t) => t.override).length} overrides`,
  };
}

export function checkTypography(result: BuildResult): CheckResult {
  // The export's type scale (px) must equal the Astryx type-scale tokens bound to the same variant.
  const problems: string[] = [];
  const {byName} = result.resolved;
  const px = (name: string, mode: 'light' | 'dark' = 'light') => {
    const token = byName.get(name);
    if (!token) return undefined;
    const value = cssValue(token, mode, byName, true);
    if (value.endsWith('rem')) return Number.parseFloat(value) * 16;
    if (value.endsWith('px')) return Number.parseFloat(value);
    return Number.parseFloat(value);
  };
  const variants: Record<string, string[]> = {
    'display-1': ['display-1'],
    'display-2': ['display-2'],
    'display-3': ['display-3'],
    'heading-1': ['heading-1'],
    'heading-2': ['heading-2'],
    large: ['large', 'heading-3'],
    medium: ['body'],
    small: ['supporting'],
    tiny: ['heading-6'],
  };
  for (const [variant, roles] of Object.entries(variants)) {
    const size = px(`--tecton-font-size-${variant}`);
    const lineHeight = px(`--tecton-line-height-${variant}`);
    const weight = px(`--tecton-font-weight-${variant}`);
    for (const role of roles) {
      const roleSize = px(`--text-${role}-size`);
      const leading = px(`--text-${role}-leading`);
      const roleWeight = px(`--text-${role}-weight`);
      if (size === undefined || roleSize !== size)
        problems.push(`--text-${role}-size is ${roleSize}px, the export ${variant} is ${size}px`);
      if (size !== undefined && lineHeight !== undefined && leading !== undefined) {
        if (Math.abs(leading * size - lineHeight) > 0.5)
          problems.push(
            `--text-${role}-leading ${leading} x ${size}px is ${(leading * size).toFixed(1)}px, the export ${variant} line height is ${lineHeight}px`,
          );
      }
      if (weight !== undefined && roleWeight !== weight)
        problems.push(`--text-${role}-weight is ${roleWeight}, the export ${variant} is ${weight}`);
    }
  }
  return {name: 'typography (export type scale = Astryx type-scale tokens)', problems};
}

export function checkAstryxCoverage(result: BuildResult): CheckResult {
  const problems: string[] = [];
  const emitted = new Set(result.resolved.tokens.map((token) => token.name));
  const upstream = Object.keys(result.inputs.astryxTokens.tokens);
  if (upstream.length !== 258)
    problems.push(`expected 258 upstream tokens, inventory has ${upstream.length}`);
  for (const name of upstream)
    if (!emitted.has(name)) problems.push(`upstream token ${name} is not emitted`);
  const allowed = new Map(
    result.inputs.overrides.allowedExtraNames.map((entry) => [entry.name, entry.reason]),
  );
  const known = new Set(upstream);
  for (const name of emitted) {
    if (name.startsWith('--tecton-') || known.has(name)) continue;
    if (!allowed.has(name))
      problems.push(`emitted ${name} is neither an upstream token nor --tecton-*`);
  }
  for (const name of allowed.keys())
    if (!emitted.has(name)) problems.push(`allowedExtraNames lists ${name}, which is not emitted`);
  return {
    name: 'Astryx coverage (258 names, no unknown unprefixed names)',
    problems,
    note: `${upstream.length} upstream names, ${allowed.size} allowed extras`,
  };
}

export function checkSnapshot(result: BuildResult, snapshotFile: string): CheckResult {
  const problems: string[] = [];
  if (!existsSync(snapshotFile)) {
    problems.push(`${snapshotFile} is missing; run pnpm generate and commit it`);
  } else {
    const committed = readFileSync(snapshotFile, 'utf8');
    if (committed !== result.snapshot) {
      const before = new Set((JSON.parse(committed) as {names: string[]}).names);
      const after = new Set((JSON.parse(result.snapshot) as {names: string[]}).names);
      const added = [...after].filter((name) => !before.has(name));
      const removed = [...before].filter((name) => !after.has(name));
      problems.push(
        `snapshots/token-names.json is out of date (+${added.length} -${removed.length}); run pnpm generate and review the diff` +
          `${added.length > 0 ? `\n      added: ${added.slice(0, 8).join(', ')}${added.length > 8 ? ', ...' : ''}` : ''}` +
          `${removed.length > 0 ? `\n      removed: ${removed.slice(0, 8).join(', ')}${removed.length > 8 ? ', ...' : ''}` : ''}`,
      );
    }
  }
  return {name: 'token-name snapshot', problems};
}

export function checkTailwind(result: BuildResult): CheckResult {
  const problems: string[] = [];
  const emitted = new Set(result.resolved.tokens.map((token) => token.name));
  const collisions = result.inputs.tailwindNames.names.filter((name) => emitted.has(name)).sort();
  const documented = [...DOCUMENTED_TAILWIND_COLLISIONS].sort();
  if (collisions.join() !== documented.join()) {
    problems.push(
      `Tailwind v4 collisions are ${collisions.join(', ') || 'none'}; the documented list is ${documented.join(', ')}. Update the docs (layer order note) and DOCUMENTED_TAILWIND_COLLISIONS together.`,
    );
  }
  return {
    name: 'Tailwind v4 collision list',
    problems,
    note: `${collisions.length} collisions (${result.inputs.tailwindNames.source.package})`,
  };
}

export function checkContrast(
  result: BuildResult,
  pairs: PairsFile,
  allow: AllowFile,
): CheckResult {
  const problems: string[] = [];
  let report;
  try {
    report = evaluateMatrix(measureMatrix(pairs, result.resolved.byName), allow);
  } catch (error) {
    return {name: 'contrast matrix', problems: [(error as Error).message]};
  }
  for (const item of report.unexpected) {
    problems.push(
      `${item.pair} (${item.mode}) is ${item.ratio}:1, needs ${item.min}:1 [${item.rule}]: ${item.why}`,
    );
  }
  problems.push(...report.stale);
  return {
    name: 'contrast matrix (alpha-composited, both modes)',
    problems,
    note: `${report.total} pair measurements, ${report.allowed.length} allowlisted shortfalls`,
  };
}

export function checkProvisional(result: BuildResult): CheckResult {
  const problems: string[] = [];
  const {tokens} = result.resolved;
  const {provisional, extraTokens} = result.inputs;
  const categories = new Set(provisional.categories.map((entry) => entry.category));
  const expected = new Set<string>();
  for (const token of tokens) {
    if (categories.has(token.category)) expected.add(token.name);
  }
  for (const entry of provisional.names) expected.add(entry.name);
  for (const entry of extraTokens.tokens) expected.add(entry.name);
  const actual = new Set(
    tokens.filter((token) => token.status === 'provisional').map((token) => token.name),
  );
  for (const name of expected)
    if (!actual.has(name)) problems.push(`${name} should be provisional`);
  for (const name of actual)
    if (!expected.has(name)) problems.push(`${name} is provisional but not in provisional.json`);
  for (const token of tokens) {
    if (token.status === 'provisional' && !token.provisional)
      problems.push(`${token.name}: provisional without a reason`);
  }
  // D-002 itself: data-viz colours, motion and --size-element-lg are provisional whatever the file says.
  for (const category of D002_TOKEN_CATEGORIES) {
    if (!categories.has(category))
      problems.push(`D-002: category "${category}" must be listed as provisional`);
  }
  for (const name of D002_TOKEN_NAMES) {
    if (!actual.has(name)) problems.push(`D-002: ${name} must be provisional`);
  }
  // D-002 numbers: 56 data-viz tokens, 10 motion tokens.
  const count = (category: string) => tokens.filter((token) => token.category === category).length;
  if (count('data') !== 56) problems.push(`expected 56 data-viz tokens, found ${count('data')}`);
  if (count('motion') !== 10) problems.push(`expected 10 motion tokens, found ${count('motion')}`);
  return {
    name: 'provisional set (D-002) exact',
    problems,
    note: `${actual.size} provisional tokens`,
  };
}

export function checkFonts(result: BuildResult): CheckResult {
  const problems: string[] = [];
  const {byName} = result.resolved;
  const body = result.fonts.xHeightRatio;
  const check = (name: string, expected: number) => {
    const token = byName.get(name);
    const actual = token ? Number.parseFloat(cssValue(token, 'light', byName, true)) : Number.NaN;
    if (actual !== expected)
      problems.push(`${name} is ${actual}, the Capsize x-height ratio is ${expected}`);
  };
  check('--font-size-adjust-body', body.body);
  check('--font-size-adjust-code', body.code);
  const css = result.files.get('fonts.css') ?? '';
  for (const face of [
    'Figtree Variable',
    'IBM Plex Mono',
    'Figtree Fallback',
    'IBM Plex Mono Fallback',
  ]) {
    if (!css.includes(`font-family: "${face}"`))
      problems.push(`fonts.css does not declare "${face}"`);
  }
  if ((css.match(/font-display: swap/g) ?? []).length !== 6)
    problems.push('every web-font face must use font-display: swap');
  if (!/size-adjust: [\d.]+%/.test(css)) problems.push('fallback faces need size-adjust');
  for (const name of ['--font-family-body', '--font-family-heading', '--font-family-code']) {
    const token = byName.get(name);
    if (!token) problems.push(`${name} is not emitted`);
  }
  return {name: 'fonts (D-003: swap, metric-matched fallbacks, x-height tokens)', problems};
}

export function checkModel(result: BuildResult): CheckResult {
  const problems: string[] = [];
  const {tokens, byName} = result.resolved;
  for (const token of tokens) {
    if (!/^--[a-z0-9]+(-[a-z0-9]+)*$/.test(token.name))
      problems.push(`${token.name}: not a valid token name`);
    try {
      tokenMeta(token, byName); // resolves every reference chain
    } catch (error) {
      problems.push((error as Error).message);
    }
  }
  return {name: 'token model (names, reference chains)', problems, note: `${tokens.length} tokens`};
}

export function runChecks(
  result: BuildResult,
  inputProblems: string[],
  snapshotFile: string,
  contrast: {pairs: PairsFile; allow: AllowFile},
): CheckResult[] {
  return [
    checkInputs(inputProblems),
    checkPalette(result),
    checkModel(result),
    checkD001(result),
    checkTypography(result),
    checkAstryxCoverage(result),
    checkSnapshot(result, snapshotFile),
    checkTailwind(result),
    checkContrast(result, contrast.pairs, contrast.allow),
    checkProvisional(result),
    checkFonts(result),
  ];
}
