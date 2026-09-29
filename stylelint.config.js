/**
 * Stylelint config (A§18.1). Base hygiene rules apply to every stylesheet under packages/ and apps/;
 * the in-house `tct/*` rules (tools/stylelint-plugin-tct) apply to component CSS only:
 * packages/components/src/**\/*.styles.css (shadow roots) and *.light.css (light-DOM families).
 */
import tct from './tools/stylelint-plugin-tct/index.ts';

const COMPONENT_SHEETS = ['packages/components/src/**/*.styles.css'];
const LIGHT_DOM_SHEETS = ['packages/components/src/**/*.light.css'];

const COMPONENT_RULES = {
  'tct/no-palette-vars': true,
  'tct/no-import': true,
  'tct/no-color-literals': true,
  'tct/no-px-font-size': true,
  'tct/no-host-context': true,
  'tct/host-box-props': true,
  'tct/host-selectors': true,
  'tct/layers-required': true,
  'tct/forced-colors-in-a11y-layer': true,
  'tct/hover-in-media': true,
  'tct/logical-properties': true,
  'tct/known-custom-properties': true,
};

/** @type {import('stylelint').Config} */
export default {
  plugins: tct.plugins,
  ignoreFiles: [
    '**/node_modules/**',
    '**/dist/**',
    '**/generated/**',
    'reports/**',
    '**/.astro/**',
  ],
  reportNeedlessDisables: true,
  rules: {
    'block-no-empty': true,
    'color-no-invalid-hex': true,
    'declaration-block-no-duplicate-custom-properties': true,
    'declaration-block-no-duplicate-properties': [
      true,
      {ignore: ['consecutive-duplicates-with-different-values']},
    ],
    'function-no-unknown': true,
    'keyframe-declaration-no-important': true,
    'no-duplicate-at-import-rules': true,
    'no-duplicate-selectors': true,
    'no-invalid-double-slash-comments': true,
    'property-no-unknown': true,
    'selector-pseudo-class-no-unknown': [true, {ignorePseudoClasses: ['state']}],
    'selector-pseudo-element-no-unknown': true,
    'string-no-newline': true,
    'unit-no-unknown': true,
    'at-rule-no-unknown': true,
  },
  overrides: [
    {files: COMPONENT_SHEETS, rules: COMPONENT_RULES},
    {
      files: LIGHT_DOM_SHEETS,
      rules: {
        ...COMPONENT_RULES,
        // Light-DOM families put everything in one layer of the document-level stack (A§6.7).
        'tct/layers-required': [true, {layers: ['tecton.light-dom']}],
        'tct/forced-colors-in-a11y-layer': null,
        'tct/host-box-props': null,
        'tct/host-selectors': null,
      },
    },
  ],
};
