import {describe, expect, it} from 'vitest';
import {build} from './build.ts';
import {
  checkAstryxCoverage,
  checkContrast,
  checkD001,
  checkFonts,
  checkPalette,
  checkProvisional,
  checkSnapshot,
  checkTailwind,
  checkTypography,
  runChecks,
} from './checks.ts';
import {evaluateMatrix, expandRule, measureMatrix, sideLabel} from './contrast.ts';
import type {AllowFile, PairsFile} from './contrast.ts';
import {loadContrastInputs, loadInputs, SNAPSHOT_FILE, verifyInputHashes} from './inputs.ts';

const fresh = () => structuredClone(loadInputs());
const real = build();
const contrast = loadContrastInputs();

describe('tokens:check on the real inputs', () => {
  it('passes every check', () => {
    const results = runChecks(real, verifyInputHashes(), SNAPSHOT_FILE, contrast);
    for (const result of results) expect(result.problems, result.name).toEqual([]);
  });

  it('input hashes match the lock file', () => {
    expect(verifyInputHashes()).toEqual([]);
  });
});

describe('failing checks', () => {
  it('coverage: fails when an upstream name is not emitted', () => {
    const inputs = fresh();
    inputs.astryxTokens.tokens['--color-nope'] = {category: 'core', default: '#000'};
    const problems = checkAstryxCoverage(build(inputs)).problems;
    expect(problems.some((line) => line.includes('--color-nope'))).toBe(true);
  });

  it('coverage: fails on an emitted unprefixed name that is not upstream', () => {
    const inputs = fresh();
    inputs.extraTokens.tokens.push({
      name: '--rogue',
      category: 'font',
      description: 'x',
      provisional: 'x',
      value: '1',
    });
    const problems = checkAstryxCoverage(build(inputs)).problems;
    expect(problems.join('\n')).toMatch(/--rogue is neither an upstream token nor --tecton-/);
  });

  it('provisional: fails when a token is provisional but not listed', () => {
    const inputs = fresh();
    inputs.provisional.categories = inputs.provisional.categories.filter(
      (c) => c.category !== 'data',
    );
    const problems = checkProvisional(build(inputs)).problems;
    expect(problems.length).toBeGreaterThan(0);
  });

  it('provisional: the set is D-013 exact', () => {
    const provisional = real.resolved.tokens.filter((token) => token.status === 'provisional');
    const categories = new Set(provisional.map((token) => token.category));
    expect([...categories].sort()).toEqual(['data', 'focus', 'font', 'scrollbar', 'size', 'text']);
    expect(provisional).toHaveLength(56 + 1 + 7);
  });

  it('astryx-retained: exactly the 10 motion tokens, with a reason (D-013 Q-06)', () => {
    const retained = real.resolved.tokens.filter((token) => token.status === 'astryx-retained');
    expect(new Set(retained.map((token) => token.category))).toEqual(new Set(['motion']));
    expect(retained).toHaveLength(10);
    for (const token of retained) expect(token.retained).toMatch(/D-013/);
    expect(real.resolved.byName.get('--duration-fast')?.provisional).toBeUndefined();
  });

  it('astryx-retained: fails when motion is listed as provisional too, or drops out of retained', () => {
    const both = fresh();
    both.provisional.categories.push({category: 'motion', reason: 'x'});
    expect(() => build(both)).toThrow(/more than one of provisional, astryxRetained/);

    const missing = fresh();
    missing.provisional.astryxRetained.categories = [];
    const problems = checkProvisional(build(missing)).problems.join('\n');
    expect(problems).toContain('astryx-retained categories: motion is required by D-013');
  });

  it('astryx-retained: fails when a retained value drifts from the upstream Astryx value', () => {
    const inputs = fresh();
    inputs.semanticMap.tokens['--duration-fast']!.value = '200ms';
    expect(checkProvisional(build(inputs)).problems.join('\n')).toMatch(
      /--duration-fast is 200ms, the retained Astryx value is 175ms/,
    );
  });

  it('astryx-retained: fails when breakpoints or z-index are not listed', () => {
    const inputs = fresh();
    inputs.provisional.astryxRetained.nonTokens =
      inputs.provisional.astryxRetained.nonTokens.filter((item) => item.name !== 'z-index');
    expect(checkProvisional(build(inputs)).problems.join('\n')).toContain(
      'astryx-retained non-tokens: z-index is required by D-013',
    );
  });

  it('tecton-derived: headings 3-6 are never provisional and record their reason', () => {
    for (const level of [3, 4, 5, 6]) {
      for (const part of ['size', 'weight', 'leading']) {
        const token = real.resolved.byName.get(`--text-heading-${level}-${part}`)!;
        expect(token.status).toBe('tecton-astryx');
        expect(token.derived).toMatch(/D-013/);
      }
    }
    const inputs = fresh();
    inputs.provisional.tectonDerived.names.pop();
    expect(checkProvisional(build(inputs)).problems.join('\n')).toContain(
      'tectonDerived names: --text-heading-6-leading is required by D-013',
    );
  });

  it('tecton-derived: the destructive button binds only emitted --tecton-color-status-error-* roles', () => {
    const item = real.inputs.provisional.tectonDerived.nonTokens.find(
      (entry) => entry.name === 'destructive button',
    )!;
    expect(Object.values(item.binds!).every((name) => real.resolved.byName.has(name))).toBe(true);

    const wrong = fresh();
    wrong.provisional.tectonDerived.nonTokens.find(
      (entry) => entry.name === 'destructive button',
    )!.binds!.background = '--color-accent';
    expect(checkProvisional(build(wrong)).problems.join('\n')).toMatch(
      /destructive button \(background\) must bind a --tecton-color-status-error-\* role/,
    );

    const missing = fresh();
    missing.provisional.tectonDerived.nonTokens.find(
      (entry) => entry.name === 'destructive button',
    )!.binds!.text = '--tecton-color-status-error-nope';
    expect(checkProvisional(build(missing)).problems.join('\n')).toContain('is not emitted');
  });

  it('typography: letter-spacing resolves to normal and headings 3-6 follow large/medium/small/tiny', () => {
    const inputs = fresh();
    const typography = inputs.semanticMap as unknown as {
      typography: {variants: Record<string, {letterSpacing: string}>};
    };
    typography.typography.variants.medium!.letterSpacing = '0.02em';
    expect(checkTypography(build(inputs)).problems.join('\n')).toMatch(
      /typography variant medium: letter-spacing is 0\.02em/,
    );

    const drift = fresh();
    drift.semanticMap.tokens['--text-heading-4-size']!.value = '1rem';
    expect(checkTypography(build(drift)).problems.join('\n')).toMatch(
      /--text-heading-4-size is 16px, the export medium is 14px/,
    );
  });

  it('snapshot: fails when the committed names differ', () => {
    const inputs = fresh();
    inputs.extraTokens.tokens.push({
      name: '--tecton-color-new-role',
      category: 'focus',
      description: 'x',
      provisional: 'x',
      value: '1px',
    });
    const problems = checkSnapshot(build(inputs), SNAPSHOT_FILE).problems;
    expect(problems.join('\n')).toMatch(/out of date \(\+1 -0\)/);
    expect(problems.join('\n')).toContain('--tecton-color-new-role');
  });

  it('snapshot: fails when the file is missing', () => {
    expect(checkSnapshot(real, '/nonexistent/token-names.json').problems[0]).toMatch(/missing/);
  });

  it('D-001: fails when the accent is bound to the derived light value', () => {
    const inputs = fresh();
    inputs.overrides.overrides.push({
      token: '--color-accent',
      light: 'foundational.color.violet.onLight.220',
      reason: 'test',
    });
    const problems = checkD001(build(inputs)).problems;
    expect(problems.join('\n')).toMatch(/--color-accent \(light\) is #b89dc8, expected #644a78/);
  });

  it('tailwind: fails when the collision list changes', () => {
    const inputs = fresh();
    inputs.tailwindNames.names = [...inputs.tailwindNames.names, '--color-accent'];
    expect(checkTailwind(build(inputs)).problems[0]).toMatch(/collisions are/);
  });

  it('typography: fails when a type-scale size drifts from the export', () => {
    const inputs = fresh();
    inputs.semanticMap.tokens['--font-size-base']!.value = '1rem';
    expect(checkTypography(build(inputs)).problems.length).toBeGreaterThan(0);
  });

  it('fonts: fails when the font-size-adjust token drifts from the Capsize metrics', () => {
    const inputs = fresh();
    inputs.extraTokens.tokens.find((token) => token.name === '--font-size-adjust-body')!.value =
      '0.55';
    expect(checkFonts(build(inputs)).problems[0]).toMatch(/Capsize x-height ratio/);
  });

  it('palette: passes and counts', () => {
    expect(checkPalette(real).problems).toEqual([]);
  });
});

describe('contrast matrix', () => {
  const pairs: PairsFile = {
    rules: [
      {
        id: 't',
        kind: 'text',
        min: 4.5,
        pairs: [
          ['--color-text-primary', '--color-background-body'],
          ['--tecton-color-text-placeholder', '--color-background-body'],
          [{light: '--color-on-dark', dark: '--color-on-light'}, '--color-background-inverted'],
        ],
      },
      {
        id: 'x',
        kind: 'icon',
        min: 3,
        fg: ['--color-icon-primary'],
        bg: ['--color-background-body', '--color-background-surface'],
      },
    ],
  };

  it('expands cross products and explicit pairs', () => {
    expect(expandRule(pairs.rules[1]!)).toHaveLength(2);
    expect(sideLabel({light: '--a', dark: '--b'})).toBe('--a|--b');
  });

  it('measures both modes with a per-mode side', () => {
    const results = measureMatrix(pairs, real.resolved.byName);
    expect(results).toHaveLength((3 + 2) * 2);
    const primary = results.find(
      (r) => r.pair.startsWith('--color-text-primary') && r.mode === 'light',
    )!;
    expect(primary.ratio).toBeGreaterThan(15);
    const inverted = results.find((r) => r.pair.includes('|') && r.mode === 'dark')!;
    expect(inverted.fg).toBe('--color-on-light');
    expect(inverted.pass).toBe(true);
  });

  it('composites translucent surfaces over the backdrop', () => {
    const wash = measureMatrix(
      {
        rules: [
          {
            id: 'w',
            kind: 'text',
            min: 4.5,
            pairs: [['--color-text-blue', '--color-background-blue']],
          },
        ],
      },
      real.resolved.byName,
    );
    const solid = measureMatrix(
      {
        rules: [
          {
            id: 'w',
            kind: 'text',
            min: 4.5,
            pairs: [['--color-text-blue', '--color-background-body']],
          },
        ],
      },
      real.resolved.byName,
    );
    expect(wash[0]!.ratio).toBeLessThan(solid[0]!.ratio);
  });

  it('flags unlisted failures, worse-than-recorded failures and stale allowlist entries', () => {
    const results = measureMatrix(pairs, real.resolved.byName);
    const placeholder = '--tecton-color-text-placeholder on --color-background-body';
    const none: AllowFile = {entries: []};
    expect(evaluateMatrix(results, none).unexpected.map((item) => item.pair)).toContain(
      placeholder,
    );

    const ok: AllowFile = {
      entries: [{pair: placeholder, measured: {light: 3.12, dark: 3.11}, reason: 'design'}],
    };
    const passing = evaluateMatrix(results, ok);
    expect(passing.unexpected).toEqual([]);
    expect(passing.allowed).toHaveLength(2);

    const worse: AllowFile = {
      entries: [{pair: placeholder, measured: {light: 4, dark: 3.11}, reason: 'design'}],
    };
    expect(evaluateMatrix(results, worse).unexpected[0]!.why).toMatch(/worse than recorded/);

    const stale: AllowFile = {
      entries: [
        {pair: placeholder, measured: {light: 3.12, dark: 3.11}, reason: 'design'},
        {
          pair: '--color-text-primary on --color-background-body',
          measured: {light: 2},
          reason: 'old',
        },
      ],
    };
    expect(evaluateMatrix(results, stale).stale.join('\n')).toMatch(/no longer fails/);
  });

  it('the real matrix has only allowlisted shortfalls, each with a reason', () => {
    const report = evaluateMatrix(
      measureMatrix(contrast.pairs, real.resolved.byName),
      contrast.allow,
    );
    expect(report.unexpected).toEqual([]);
    expect(report.stale).toEqual([]);
    expect(report.allowed.length).toBeGreaterThan(0);
    for (const entry of contrast.allow.entries) expect(entry.reason.length).toBeGreaterThan(40);
  });

  it('a regression in a bound colour fails the check', () => {
    const inputs = fresh();
    // put the derived (2.2:1) accent fill back on the ink token: the matrix must notice
    inputs.overrides.overrides.find((entry) => entry.token === '--color-text-accent')!.light =
      'foundational.color.violet.onLight.140';
    const result = checkContrast(build(inputs), contrast.pairs, contrast.allow);
    expect(result.problems.some((line) => line.includes('--color-text-accent'))).toBe(true);
  });

  it('the accent ink rebind passes 4.5:1 in both modes (D-001)', () => {
    const results = measureMatrix(contrast.pairs, real.resolved.byName).filter(
      (r) => r.fg === '--color-text-accent' || r.fg === '--color-icon-accent',
    );
    expect(results.length).toBeGreaterThan(0);
    for (const result of results)
      expect(result.pass, `${result.pair} ${result.mode} ${result.ratio}`).toBe(true);
  });
});
