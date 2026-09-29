/**
 * ESLint flat config (A§18.1): typescript-eslint (type-aware) + the in-house `tct` plugin
 * (tools/eslint-plugin-tct, loaded through Node type stripping) + import boundaries.
 * `@eslint/js` is not an approved dependency (D-007), so the core rules we want are listed explicitly.
 */
import {defineConfig, globalIgnores} from 'eslint/config';
import tseslint from 'typescript-eslint';
import tct from './tools/eslint-plugin-tct/index.ts';

const TS = ['**/*.ts'];
const TESTS = ['**/*.test.ts', 'packages/testing/**/*.ts'];
const SHIPPED_SRC = ['packages/{core,components,icons,locales}/src/**/*.ts'];
const TOOLS = ['tools/**/*.ts', 'packages/*/scripts/**/*.ts', 'vitest.config.ts'];

/** Boundary modules for approved non-lit runtime dependencies (A§2.2, D-007). */
const BOUNDARIES = {
  'packages/core/src/layer/floating.ts': ['@floating-ui/dom'],
  'packages/core/src/i18n/format.ts': ['intl-messageformat'],
  'packages/core/src/security/sanitize.ts': ['dompurify'],
};
const BOUNDARY_PACKAGES = [
  '@floating-ui/dom',
  'intl-messageformat',
  '@internationalized/date',
  'dompurify',
];

const boundaryPatterns = (allowed = []) =>
  BOUNDARY_PACKAGES.filter((name) => !allowed.includes(name)).map((name) => ({
    group: [name, `${name}/*`],
    message: `Import ${name} only through its boundary module in packages/core (A§2.2, D-007).`,
  }));

const SHARED_RESTRICTED_PATTERNS = [
  {
    group: ['@tecton-astryx/*/src/*', '@tecton-astryx/*/src/**'],
    message: 'Import package subpaths (e.g. @tecton-astryx/core/define.js), never src/ paths.',
  },
  {
    group: [
      '../**/packages/*/src/**',
      '../../core/src/**',
      '../../../core/src/**',
      '../../../../core/src/**',
      '../../components/src/**',
      '../../../components/src/**',
    ],
    message:
      'Cross-package imports use package subpaths (CONVENTIONS §4), never relative paths into another package.',
  },
];

const NOT_APPROVED = [
  {name: '@lit/context', message: 'Not approved (D-007): use @tecton-astryx/core/context (A-10).'},
];
const DEV_ONLY_IN_SHIPPED = [
  {
    // Anchored: only the `lucide` package, not our own generated `./lucide/<name>.js` modules.
    regex: '^lucide(/.*)?$',
    message:
      'lucide is a build-time source (D-009); import generated @tecton-astryx/icons modules.',
  },
  {group: ['@lit-labs/ssr', '@lit-labs/ssr/*'], message: '@lit-labs/ssr is dev-only (WP-H spike).'},
];

export default defineConfig([
  globalIgnores([
    '.claude/**',
    '**/node_modules/**',
    '**/dist/**',
    '**/generated/**',
    '**/__snapshots__/**',
    'reports/**',
    'apps/docs/.astro/**',
    'apps/docs/src/content/docs/components/**',
    'apps/docs/src/content/docs/reference/**',
    'apps/docs/dist/**',
    'packages/tokens/src/inputs/**',
    // Generated Lucide data (tools/icons/extract-lucide.ts): 1,854 machine-written modules
    'packages/icons/src/lucide/**',
    'packages/icons/src/lucide.ts',
    // Generated Tecton icon modules (tools/icons/extract-tecton.ts); the authored data is in tecton/glyphs/
    'packages/icons/src/tecton/*.ts',
    'packages/icons/src/tecton.ts',
    '**/fixtures/**',
  ]),

  // Type-aware TypeScript
  {
    files: TS,
    extends: [tseslint.configs.recommendedTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {tct},
    rules: {
      // core JS rules (a hand-picked equivalent of eslint:recommended plus house rules)
      'no-debugger': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-case': 'error',
      'no-empty': ['error', {allowEmptyCatch: true}],
      'no-fallthrough': 'error',
      'no-self-assign': 'error',
      'no-unsafe-finally': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', {null: 'ignore'}],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration[exported=null]:not([source.value=/^\\.\\.?\\//])',
          message: 'Re-export by name.',
        },
      ],

      '@typescript-eslint/consistent-type-imports': ['error', {fixStyle: 'inline-type-imports'}],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none'},
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'off', // DOM lookups are guarded case by case in review
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/array-type': ['error', {default: 'array'}],
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', {checksVoidReturn: {attributes: false}}],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {allowNumber: true, allowBoolean: true},
      ],
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/class-literal-property-style': 'off',
      '@typescript-eslint/no-empty-function': ['error', {allow: ['arrowFunctions']}],

      'no-restricted-imports': [
        'error',
        {paths: NOT_APPROVED, patterns: [...SHARED_RESTRICTED_PATTERNS, ...boundaryPatterns()]},
      ],

      // In-house rules (A§18.1)
      'tct/no-custom-elements-define': 'error',
      'tct/no-raw-events': 'error',
      'tct/no-html-sinks': 'error',
      'tct/no-create-tct-element': 'error',
      'tct/no-feature-checks': 'error',
      'tct/no-public-on-props': 'error',
      'tct/no-export-star-in-define': 'error',
    },
  },

  // Boundary modules may import exactly their own dependency.
  ...Object.entries(BOUNDARIES).map(([file, allowed]) => ({
    files: [file],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: NOT_APPROVED,
          patterns: [...SHARED_RESTRICTED_PATTERNS, ...boundaryPatterns(allowed)],
        },
      ],
    },
  })),
  // @internationalized/date is only used under core/src/date/.
  {
    files: ['packages/core/src/date/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: NOT_APPROVED,
          patterns: [
            ...SHARED_RESTRICTED_PATTERNS,
            ...boundaryPatterns(['@internationalized/date']),
          ],
        },
      ],
    },
  },

  // Shipped sources: importable in Node, no dev-only tools, no stray logging.
  {
    files: SHIPPED_SRC,
    ignores: TESTS,
    rules: {
      'tct/no-top-level-dom-access': 'error',
      'no-console': ['error', {allow: ['warn', 'error']}],
    },
  },
  {
    files: SHIPPED_SRC,
    ignores: [...TESTS, ...Object.keys(BOUNDARIES), 'packages/core/src/date/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: NOT_APPROVED,
          patterns: [...SHARED_RESTRICTED_PATTERNS, ...boundaryPatterns(), ...DEV_ONLY_IN_SHIPPED],
        },
      ],
    },
  },

  // Tests: fixtures legitimately define elements, build markup and construct events/classes.
  {
    files: TESTS,
    rules: {
      'tct/no-custom-elements-define': 'off',
      'tct/no-raw-events': 'off',
      'tct/no-html-sinks': 'off',
      'tct/no-create-tct-element': 'off',
      'tct/no-feature-checks': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },

  // Tooling scripts run in Node on type stripping: console output is their UI, dependencies are free.
  // They are type-checked by tools/tsconfig.json (which also covers vitest.config.ts and every
  // packages/*/scripts/), not by the per-package composite projects.
  {
    files: TOOLS,
    languageOptions: {
      parserOptions: {projectService: false, project: ['./tools/tsconfig.json']},
    },
    rules: {
      'no-console': 'off',
      'tct/no-custom-elements-define': 'off',
      'tct/no-html-sinks': 'off',
      'tct/no-feature-checks': 'off',
      'tct/no-raw-events': 'off',
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },

  // Plain JS files (this config): no type information.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', {null: 'ignore'}],
    },
  },
]);
