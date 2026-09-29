import type {Rule} from 'eslint';
import {fileMatches, memberPropertyName} from '../lib.ts';

const ALLOWED = [/\/packages\/core\/src\/security\//];

const SINK_PROPERTIES = new Set(['innerHTML', 'outerHTML']);
const SINK_CALLS = new Set([
  'insertAdjacentHTML',
  'setHTMLUnsafe',
  'parseHTMLUnsafe',
  'createContextualFragment',
  'parseFromString',
  'write',
  'writeln',
]);
const SINK_IMPORT = /^lit\/directives\/unsafe-(?:html|svg)\.js$/;

/**
 * Consumer markup reaches the DOM only through `core/src/security` (A§13). Elsewhere, build DOM with
 * Lit templates and text bindings. Flagged: `innerHTML`/`outerHTML` writes, `insertAdjacentHTML`,
 * `document.write`, `setHTMLUnsafe`, `DOMParser#parseFromString`, `createContextualFragment`, and the
 * imports `lit/directives/unsafe-html.js`, `lit/directives/unsafe-svg.js` and `unsafeStatic`.
 */
export const noHtmlSinks: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow HTML sinks (innerHTML, insertAdjacentHTML, unsafeHTML, ...) outside core/src/security.',
    },
    schema: [],
    messages: {
      sink: 'HTML sink "{{name}}" is only allowed in packages/core/src/security/. Use Lit templates or the sanitizer module.',
      directive: 'Importing "{{source}}" is only allowed in packages/core/src/security/.',
    },
  },
  create(context) {
    if (fileMatches(context, ALLOWED)) return {};
    return {
      AssignmentExpression(node) {
        if (node.left.type !== 'MemberExpression') return;
        const name = memberPropertyName(node.left);
        if (name && SINK_PROPERTIES.has(name))
          context.report({node, messageId: 'sink', data: {name}});
      },
      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression') return;
        const name = memberPropertyName(node.callee);
        if (!name || !SINK_CALLS.has(name)) return;
        // `write`/`writeln` are only sinks on `document`; other objects use those names freely.
        if (
          (name === 'write' || name === 'writeln') &&
          !(node.callee.object.type === 'Identifier' && node.callee.object.name === 'document')
        ) {
          return;
        }
        context.report({node, messageId: 'sink', data: {name}});
      },
      ImportDeclaration(node) {
        const source = String(node.source.value);
        if (source === 'lit/static-html.js') {
          for (const specifier of node.specifiers) {
            if (
              specifier.type === 'ImportSpecifier' &&
              specifier.imported.type === 'Identifier' &&
              specifier.imported.name === 'unsafeStatic'
            ) {
              context.report({
                node: specifier,
                messageId: 'directive',
                data: {source: `${source} (unsafeStatic)`},
              });
            }
          }
        } else if (SINK_IMPORT.test(source)) {
          context.report({node, messageId: 'directive', data: {source}});
        }
      },
    };
  },
};
