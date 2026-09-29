import type {Rule} from 'eslint';
import {memberPropertyName} from '../lib.ts';

/**
 * Elements are created by rendering templates (or parsing markup), never by `document.createElement`
 * with a literal tag or `new TctFoo()` (A§18.1): constructors run before upgrade ordering is known
 * and framework/SSR paths skip them.
 */
export const noCreateTctElement: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {description: 'Disallow document.createElement("tct-...") and new Tct*().'},
    schema: [],
    messages: {
      createElement: 'Render {{tag}} in a Lit template instead of document.createElement.',
      construct: 'Do not construct {{name}} directly; render it in a Lit template.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type !== 'MemberExpression' ||
          memberPropertyName(node.callee) !== 'createElement'
        )
          return;
        const first = node.arguments[0];
        if (
          first?.type === 'Literal' &&
          typeof first.value === 'string' &&
          first.value.startsWith('tct-')
        ) {
          context.report({node, messageId: 'createElement', data: {tag: `<${first.value}>`}});
        }
      },
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && /^Tct[A-Z]/.test(node.callee.name)) {
          context.report({node, messageId: 'construct', data: {name: node.callee.name}});
        }
      },
    };
  },
};
