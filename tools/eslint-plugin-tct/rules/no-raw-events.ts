import type {Rule} from 'eslint';
import {fileMatches} from '../lib.ts';

const ALLOWED = [/\/packages\/core\/src\/events\//];

/**
 * One `Event` subclass per name lives in `core/src/events` (A§7.6, A§9.3), so payload typing, flags
 * and documentation are defined once. Everywhere else dispatches those classes.
 */
export const noRawEvents: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow new CustomEvent(...) and new Event("tct-...") outside core/src/events.',
    },
    schema: [],
    messages: {
      customEvent:
        'Do not construct CustomEvent. Add or reuse an Event subclass in packages/core/src/events/.',
      tctEvent:
        'Do not construct tct-* events inline. Add or reuse an Event subclass in packages/core/src/events/.',
    },
  },
  create(context) {
    if (fileMatches(context, ALLOWED)) return {};
    return {
      NewExpression(node) {
        if (node.callee.type !== 'Identifier') return;
        if (node.callee.name === 'CustomEvent') {
          context.report({node, messageId: 'customEvent'});
          return;
        }
        if (node.callee.name !== 'Event') return;
        const first = node.arguments[0];
        const literal =
          first?.type === 'Literal' && typeof first.value === 'string'
            ? first.value
            : first?.type === 'TemplateLiteral'
              ? (first.quasis[0]?.value.cooked ?? '')
              : '';
        if (literal.startsWith('tct-')) context.report({node, messageId: 'tctEvent'});
      },
    };
  },
};
