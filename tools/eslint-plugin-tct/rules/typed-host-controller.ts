import type {Rule} from 'eslint';

interface Node {
  type: string;
  [key: string]: unknown;
}

/**
 * A class field initialised with a controller that receives the host (`#locale = new
 * LocaleController(this, …)`) must declare its type (`#locale: LocaleController = new …`).
 *
 * Without the annotation TypeScript infers the field's type from the initializer, which checks that
 * `this` is assignable to the controller's host type; that needs the class's own members (such as
 * `render()`), whose inferred types use the field again. TypeScript breaks the cycle with `any`, and
 * whether it meets the cycle depends on the order types are requested in: `tsc` passed while typed
 * lint failed intermittently with no-unsafe-* errors on `this.#locale.t(…)`.
 */
export const typedHostController: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {description: 'Require a type annotation on fields initialised with new X(this, …).'},
    schema: [],
    messages: {
      annotate:
        'Declare the type of "{{name}}" ({{name}}: {{ctor}}{{args}} = new …): an inferred controller type that depends on `this` can silently become any.',
    },
  },
  create(context) {
    return {
      PropertyDefinition(node: Rule.Node) {
        const field = node as unknown as Node & {
          typeAnnotation?: unknown;
          value?: Node | null;
          key: Node & {name?: string};
        };
        if (field.typeAnnotation) return;
        const value = field.value;
        if (value?.type !== 'NewExpression') return;
        const args = value.arguments as Node[] | undefined;
        if (args?.[0]?.type !== 'ThisExpression') return;
        const callee = value.callee as Node & {name?: string};
        const ctor = callee.type === 'Identifier' ? (callee.name ?? 'Controller') : 'Controller';
        const typeArgs = value.typeArguments ?? value.typeParameters;
        const name = field.key.type === 'PrivateIdentifier' ? `#${field.key.name}` : field.key.name;
        context.report({
          node,
          messageId: 'annotate',
          data: {name: name ?? 'field', ctor, args: typeArgs ? '<…>' : ''},
        });
      },
    };
  },
};
