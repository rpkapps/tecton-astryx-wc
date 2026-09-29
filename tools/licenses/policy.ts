/**
 * Licence policy (A§18.6, D-007a, D-008). Pure functions; `tools/licenses/check.ts` feeds them the
 * installed tree. Any licence outside the allowlist fails unless a named exception below covers the
 * exact package and licence.
 */

/** SPDX ids accepted for every package (case-insensitive compare). */
export const ALLOWED_LICENSES: readonly string[] = [
  'MIT',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'ISC',
  '0BSD',
  'OFL-1.1',
];

export interface Election {
  /** Licence of the package as reported by pnpm. */
  license: string;
  /** The alternative we elect (must itself be allowed). */
  elected: string;
  reason: string;
}

/** Dual-licensed packages where we elect an allowed alternative. Allowed in the shipped tree. */
export const ELECTIONS: Readonly<Record<string, Election>> = {
  dompurify: {
    license: '(MPL-2.0 OR Apache-2.0)',
    elected: 'Apache-2.0',
    reason: 'D-007a: dual licence, Apache-2.0 elected',
  },
};

export interface DevOnlyException {
  license: string;
  /**
   * The decision that approved the exception: `D-007a` (direct dev dependencies) or `D-013` (the
   * transitive dev-only licences found after D-007a and tolerated in D-012, approved by the owner
   * under D-013 Q-01: royalty-free, commercial use allowed, never shipped).
   */
  approval: 'D-007a' | 'D-013';
  reason: string;
}

/**
 * Packages whose licence is not on the allowlist but which are tolerated because they are dev/build
 * tooling that never reaches the shipped packages. They must not appear in the closure of a shipped
 * package (`SHIPPED_PACKAGES`). Entries approved by `D-013` were not covered by the D-007a audit
 * (which listed direct dev dependencies only); the owner approved them on 2026-09-29. A licence that is
 * not listed here, or that differs from the recorded one, still fails: new licences need review.
 */
export const DEV_ONLY_EXCEPTIONS: Readonly<Record<string, DevOnlyException>> = {
  'axe-core': {
    license: 'MPL-2.0',
    approval: 'D-007a',
    reason: 'File-level copyleft; used only in tests, never bundled or modified',
  },
  lightningcss: {
    license: 'MPL-2.0',
    approval: 'D-013',
    reason:
      'Transitive of the docs/build tooling (Astro/Vite CSS); not imported by our code, never shipped',
  },
  'lightningcss-linux-x64-gnu': {
    license: 'MPL-2.0',
    approval: 'D-013',
    reason: 'Platform binary of lightningcss',
  },
  argparse: {
    license: 'Python-2.0',
    approval: 'D-013',
    reason: 'Transitive of js-yaml (docs build); permissive PSF-style licence, not shipped',
  },
  'common-ancestor-path': {
    license: 'BlueOak-1.0.0',
    approval: 'D-013',
    reason: 'Transitive of Astro tooling; permissive (Blue Oak Model License), not shipped',
  },
  'lru-cache': {
    license: 'BlueOak-1.0.0',
    approval: 'D-013',
    reason: 'Transitive dev tooling; permissive (Blue Oak Model License), not shipped',
  },
  minimatch: {
    license: 'BlueOak-1.0.0',
    approval: 'D-013',
    reason:
      'Transitive dev tooling (ESLint, size-limit); permissive (Blue Oak Model License), not shipped',
  },
  sax: {
    license: 'BlueOak-1.0.0',
    approval: 'D-013',
    reason: 'Transitive of svgo (docs build); permissive (Blue Oak Model License), not shipped',
  },
  '@csstools/css-syntax-patches-for-csstree': {
    license: 'MIT-0',
    approval: 'D-013',
    reason: 'Transitive of Stylelint; MIT-0 is MIT without the attribution condition, not shipped',
  },
  '@csstools/selector-resolve-nested': {
    license: 'MIT-0',
    approval: 'D-013',
    reason: 'Transitive of Stylelint; MIT-0, not shipped',
  },
  '@csstools/selector-specificity': {
    license: 'MIT-0',
    approval: 'D-013',
    reason: 'Transitive of Stylelint; MIT-0, not shipped',
  },
  'mdn-data': {
    license: 'CC0-1.0',
    approval: 'D-013',
    reason:
      'Transitive data package of css-tree (Stylelint, SVGO); public-domain dedication, not shipped',
  },
};

/**
 * Workspace packages whose output reaches consumers or the CDN bundle. Their production dependency
 * closure is the "shipped runtime tree": strict allowlist, no dev-only exceptions, all listed in
 * THIRD-PARTY-NOTICES.md. (`testing`, `docs` and `tools` are private tooling.)
 */
export const SHIPPED_PACKAGES: readonly string[] = [
  '@tecton-wc/tokens',
  '@tecton-wc/core',
  '@tecton-wc/icons',
  '@tecton-wc/locales',
  '@tecton-wc/components',
];

/**
 * Private tooling packages that people and agents run but that are not part of the shipped runtime (the `tct`
 * CLI, D-013 Q-07). Their production dependency closure is held to the same strict allowlist as the shipped
 * packages (no dev-only exceptions); THIRD-PARTY-NOTICES.md must name their direct dependencies.
 */
export const TOOLING_RUNTIME_PACKAGES: readonly string[] = ['@tecton-wc/cli'];

/**
 * Packages whose *content* is copied into shipped output (font files, icon glyph data) even though
 * they are dev dependencies. They must be listed in THIRD-PARTY-NOTICES.md too (D-003, D-009).
 */
export const SHIPPED_ASSET_PACKAGES: readonly string[] = [
  '@fontsource-variable/figtree',
  '@fontsource/ibm-plex-mono',
  'lucide',
];

/** Strings THIRD-PARTY-NOTICES.md must contain (D-007a, D-008, D-009). */
export const REQUIRED_NOTICE_TEXT: readonly string[] = [
  'OFL-1.1',
  'Figtree',
  'IBM Plex Mono',
  'Lucide',
  'Feather',
  'Astryx',
  'Meta Platforms, Inc.',
  '@modelcontextprotocol/sdk',
  'Anthropic, PBC',
];

type Token = string;

function tokenize(expression: string): Token[] {
  return expression.match(/\(|\)|[^\s()]+/g) ?? [];
}

/**
 * Evaluates an SPDX licence expression against the allowlist: `A OR B` needs one allowed side,
 * `A AND B` needs both, `WITH exception` is never allowed. Unknown ids are not allowed.
 */
export function isExpressionAllowed(
  expression: string,
  allowed: readonly string[] = ALLOWED_LICENSES,
): boolean {
  const allow = new Set(allowed.map((id) => id.toLowerCase()));
  const tokens = tokenize(expression);
  let index = 0;

  const parseOr = (): boolean => {
    let result = parseAnd();
    while (tokens[index]?.toUpperCase() === 'OR') {
      index++;
      const right = parseAnd();
      result = result || right;
    }
    return result;
  };
  const parseAnd = (): boolean => {
    let result = parseAtom();
    while (tokens[index]?.toUpperCase() === 'AND') {
      index++;
      const right = parseAtom();
      result = result && right;
    }
    return result;
  };
  const parseAtom = (): boolean => {
    const token = tokens[index++];
    if (token === undefined) return false;
    if (token === '(') {
      const inner = parseOr();
      if (tokens[index] === ')') index++;
      return inner;
    }
    let ok = allow.has(token.replace(/\+$/, '').toLowerCase()) && !token.endsWith('+');
    if (tokens[index]?.toUpperCase() === 'WITH') {
      index += 2; // exception id
      ok = false;
    }
    return ok;
  };

  const result = parseOr();
  return index >= tokens.length && result;
}

export interface PackageLicense {
  name: string;
  versions: string[];
  license: string;
}

export interface Finding {
  level: 'error' | 'warning';
  message: string;
}

export interface EvaluateInput {
  /** Every installed package (prod + dev, whole workspace). */
  all: readonly PackageLicense[];
  /** Names of packages in the production closure of the shipped workspace packages. */
  shippedNames: ReadonlySet<string>;
}

/** Applies the policy to the installed tree. */
export function evaluateLicenses({all, shippedNames}: EvaluateInput): Finding[] {
  const findings: Finding[] = [];
  const label = (pkg: PackageLicense) => `${pkg.name}@${pkg.versions.join(',')}`;

  for (const pkg of all) {
    const license = pkg.license?.trim() ?? '';
    const inShipped = shippedNames.has(pkg.name);

    if (license && isExpressionAllowed(license)) continue;

    const election = ELECTIONS[pkg.name];
    if (election?.license === license && isExpressionAllowed(election.elected)) continue;

    const exception = DEV_ONLY_EXCEPTIONS[pkg.name];
    if (exception?.license === license) {
      if (inShipped) {
        findings.push({
          level: 'error',
          message: `${label(pkg)} (${license}) is only allowed as a dev-only tool but is in the shipped runtime tree`,
        });
      }
      continue;
    }

    findings.push({
      level: 'error',
      message: license
        ? `${label(pkg)} has licence "${license}", which is not on the allowlist (${ALLOWED_LICENSES.join(', ')})` +
          (exception ? ` (recorded exception expects "${exception.license}")` : '')
        : `${label(pkg)} declares no licence`,
    });
  }
  return findings;
}
