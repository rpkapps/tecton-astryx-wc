import type {Rule} from 'eslint';
import {fileMatches, memberPropertyName} from '../lib.ts';

const ALLOWED = [/\/packages\/core\/src\/features\.ts$/];

/** Global scopes whose `'name' in scope` test is a feature probe. */
const PROBE_SCOPES = new Set(['window', 'globalThis', 'self', 'document', 'navigator', 'CSS']);
/** Platform constructors whose `typeof X` test is a feature probe. */
const PROBE_GLOBALS = new Set([
  'CloseWatcher',
  'Sanitizer',
  'ElementInternals',
  'ToggleEvent',
  'CommandEvent',
  'ViewTransition',
  'CSSStyleSheet',
  'ResizeObserver',
  'IntersectionObserver',
  'PopStateEvent',
  'HTMLDialogElement',
]);
const PLATFORM_PROTOTYPE =
  /^(?:(?:HTML|SVG)\w*Element|Element|ElementInternals|Document|Window|Navigator|Node|ShadowRoot|CSSStyleSheet|CSSStyleDeclaration|Event)$/;

/**
 * Every capability probe lives in `core/src/features.ts` (A§9.5) so Tier-2 emulation
 * (`TCT_TIER2=1`) can force features off in one place and the fallbacks are tested once.
 */
export const noFeatureChecks: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {description: 'Disallow platform feature detection outside core/src/features.ts.'},
    schema: [],
    messages: {
      probe:
        'Feature detection belongs in @tecton-astryx/core/features.js. Add a probe there and import it.',
    },
  },
  create(context) {
    if (fileMatches(context, ALLOWED)) return {};
    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'CSS' &&
          memberPropertyName(node.callee) === 'supports'
        ) {
          context.report({node, messageId: 'probe'});
        }
      },
      BinaryExpression(node) {
        if (node.operator !== 'in') return;
        const right = node.right;
        if (right.type === 'Identifier' && PROBE_SCOPES.has(right.name)) {
          context.report({node, messageId: 'probe'});
        } else if (
          right.type === 'MemberExpression' &&
          memberPropertyName(right) === 'prototype' &&
          right.object.type === 'Identifier' &&
          PLATFORM_PROTOTYPE.test(right.object.name)
        ) {
          context.report({node, messageId: 'probe'});
        }
      },
      UnaryExpression(node) {
        if (
          node.operator === 'typeof' &&
          node.argument.type === 'Identifier' &&
          PROBE_GLOBALS.has(node.argument.name)
        ) {
          context.report({node, messageId: 'probe'});
        }
      },
    };
  },
};
