import type {Rule} from 'eslint';
import {fileMatches, memberPropertyName} from '../lib.ts';

/** The only file that may call `customElements.define` (A§9.2). */
const ALLOWED = [/\/packages\/core\/src\/define\.ts$/];

/**
 * Registration goes through `defineElement()` in `core/src/define.ts` so duplicate/different-class
 * registration is handled once (A§9.2, A§14). Lit's `@customElement` decorator registers as a side
 * effect of importing the class module, which breaks the side-effect-free class modules of A§2.5.
 */
export const noCustomElementsDefine: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow customElements.define and @customElement outside core/src/define.ts.',
    },
    schema: [],
    messages: {
      define:
        'Register elements with defineElement() from @tecton-astryx/core/define.js in the family define.ts; ' +
        'customElements.define is only allowed in core/src/define.ts.',
      decorator:
        '@customElement registers on import. Class modules are side-effect free; register in define.ts with defineElement().',
    },
  },
  create(context) {
    const allowed = fileMatches(context, ALLOWED);
    return {
      CallExpression(node) {
        if (allowed) return;
        const callee = node.callee;
        if (callee.type !== 'MemberExpression' || memberPropertyName(callee) !== 'define') return;
        const target = callee.object;
        const isCustomElements =
          (target.type === 'Identifier' && target.name === 'customElements') ||
          (target.type === 'MemberExpression' && memberPropertyName(target) === 'customElements');
        if (isCustomElements) context.report({node, messageId: 'define'});
      },
      // TS legacy decorators: `@customElement('x')` / `@customElement`
      Decorator(node: Rule.Node) {
        const expression = (
          node as unknown as {expression: {type: string; name?: string; callee?: {name?: string}}}
        ).expression;
        const name =
          expression.type === 'CallExpression' ? expression.callee?.name : expression.name;
        if (name === 'customElement') context.report({node, messageId: 'decorator'});
      },
    };
  },
};
