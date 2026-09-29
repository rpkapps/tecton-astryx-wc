/**
 * Static contrast matrix (A§5.6, styling.md §14.3): WCAG 2.x ratios for foreground / background token
 * pairs in both modes, after alpha compositing over the real backdrop. Known design shortfalls live in
 * `contrast.allow.json`, each with a reason and the ratio measured when it was recorded, so a listed
 * pair can never get worse (or be forgotten once it passes).
 */
import {composite, contrastOver, parseColor, toHex} from './color.ts';
import type {Rgba} from './color.ts';
import type {Mode, Token} from './model.ts';
import {MODES, cssValue} from './resolve.ts';

/** A token name, or a different token per mode (inverted surfaces flip). */
export type PairSide = string | {light: string; dark: string};

export interface PairRule {
  id: string;
  kind: 'text' | 'icon' | 'boundary' | 'focus';
  /** WCAG minimum: 4.5 text, 3 icons, UI boundaries and the focus ring. */
  min: number;
  description?: string;
  /** Cross product of `fg` and `bg`... */
  fg?: PairSide[];
  bg?: PairSide[];
  /** ...or explicit `[fg, bg]` pairs. */
  pairs?: [PairSide, PairSide][];
  /** Opaque backdrop for a translucent `bg` (default `--color-background-body`). */
  over?: string;
}

export interface PairsFile {
  rules: PairRule[];
}

export interface AllowEntry {
  /** `"<fg> on <bg>"`, sides rendered by {@link sideLabel}. */
  pair: string;
  /** Ratio measured per mode when the entry was recorded; the pair may not fall below it. */
  measured: Partial<Record<Mode, number>>;
  reason: string;
}
export interface AllowFile {
  entries: AllowEntry[];
}

export interface PairResult {
  rule: string;
  kind: PairRule['kind'];
  mode: Mode;
  pair: string;
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  pass: boolean;
}

export const sideLabel = (side: PairSide): string =>
  typeof side === 'string'
    ? side
    : side.light === side.dark
      ? side.light
      : `${side.light}|${side.dark}`;

const side = (value: PairSide, mode: Mode): string =>
  typeof value === 'string' ? value : value[mode];

export function expandRule(rule: PairRule): [PairSide, PairSide][] {
  const out: [PairSide, PairSide][] = [...(rule.pairs ?? [])];
  for (const fg of rule.fg ?? []) for (const bg of rule.bg ?? []) out.push([fg, bg]);
  return out;
}

export function measureMatrix(file: PairsFile, byName: ReadonlyMap<string, Token>): PairResult[] {
  const colour = (name: string, mode: Mode): Rgba => {
    const token = byName.get(name);
    if (!token) throw new Error(`contrast pairs: unknown token ${name}`);
    return parseColor(cssValue(token, mode, byName, true));
  };
  const results: PairResult[] = [];
  for (const rule of file.rules) {
    for (const [fg, bg] of expandRule(rule)) {
      for (const mode of MODES) {
        const [fgName, bgName] = [side(fg, mode), side(bg, mode)];
        const backdrop = colour(rule.over ?? '--color-background-body', mode);
        const ratio = contrastOver(colour(fgName, mode), colour(bgName, mode), backdrop);
        const rounded = Math.round(ratio * 100) / 100;
        results.push({
          rule: rule.id,
          kind: rule.kind,
          mode,
          pair: `${sideLabel(fg)} on ${sideLabel(bg)}`,
          fg: fgName,
          bg: bgName,
          ratio: rounded,
          min: rule.min,
          pass: ratio >= rule.min,
        });
      }
    }
  }
  return results;
}

export interface MatrixReport {
  total: number;
  failures: PairResult[];
  /** Failing pairs that are allowlisted and not worse than recorded. */
  allowed: (PairResult & {reason: string})[];
  /** Failing and not (adequately) allowlisted: the check fails on these. */
  unexpected: (PairResult & {why: string})[];
  /** Allow entries that no longer match a failing pair (delete them). */
  stale: string[];
}

export function evaluateMatrix(results: PairResult[], allow: AllowFile): MatrixReport {
  const failures = results.filter((result) => !result.pass);
  const allowed: MatrixReport['allowed'] = [];
  const unexpected: MatrixReport['unexpected'] = [];
  const usedModes = new Map<string, Set<Mode>>();
  const entries = new Map(allow.entries.map((entry) => [entry.pair, entry]));

  for (const failure of failures) {
    const entry = entries.get(failure.pair);
    const recorded = entry?.measured[failure.mode];
    if (!entry || recorded === undefined) {
      unexpected.push({...failure, why: 'not in contrast.allow.json'});
    } else if (failure.ratio < recorded - 0.005) {
      unexpected.push({...failure, why: `worse than recorded (${recorded}:1)`});
    } else {
      allowed.push({...failure, reason: entry.reason});
      const modes = usedModes.get(failure.pair) ?? new Set<Mode>();
      modes.add(failure.mode);
      usedModes.set(failure.pair, modes);
    }
  }
  const stale: string[] = [];
  for (const entry of allow.entries) {
    if (entry.reason.trim() === '') stale.push(`${entry.pair}: needs a reason`);
    for (const mode of Object.keys(entry.measured) as Mode[]) {
      if (!usedModes.get(entry.pair)?.has(mode))
        stale.push(`${entry.pair} (${mode}): no longer fails or no longer exists; remove it`);
    }
  }
  return {total: results.length, failures, allowed, unexpected, stale};
}

/** Composite helper re-exported for tests and docs tooling. */
export function compositeHex(fg: string, bg: string): string {
  return toHex(composite(parseColor(fg), parseColor(bg)));
}
