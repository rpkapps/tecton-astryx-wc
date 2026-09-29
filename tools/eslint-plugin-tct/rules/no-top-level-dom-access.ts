import type {Rule, Scope} from 'eslint';

const BROWSER_GLOBALS = new Set([
  'document',
  'window',
  'navigator',
  'customElements',
  'localStorage',
  'sessionStorage',
  'location',
  'history',
  'screen',
  'matchMedia',
  'getComputedStyle',
  'requestAnimationFrame',
  'CSS',
]);

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
]);

/**
 * Modules must import in Node (server-import test, A§14): no browser global may be touched while the
 * module is evaluating. Access inside functions, methods and instance field initialisers is fine;
 * module scope, static fields and static blocks are not. `typeof document` guards and type-level
 * references are ignored.
 */
export const noTopLevelDomAccess: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {description: 'Disallow browser globals at module evaluation time.'},
    schema: [],
    messages: {
      topLevel:
        '"{{name}}" is accessed while the module evaluates. Move it into a function/lifecycle method so the module imports in Node.',
    },
  },
  create(context) {
    const isShadowed = (node: Rule.Node, name: string): boolean => {
      let scope: Scope.Scope | null = context.sourceCode.getScope(node);
      while (scope) {
        const variable = scope.set.get(name);
        if (variable && variable.defs.length > 0) return true;
        scope = scope.upper;
      }
      return false;
    };

    const runsAtModuleEvaluation = (start: Rule.Node): boolean => {
      let current: Rule.Node | null = start.parent;
      while (current) {
        if (FUNCTION_TYPES.has(current.type)) return false;
        if (current.type.startsWith('TS')) return false; // type positions
        const type: string = current.type;
        if (type === 'PropertyDefinition' || type === 'AccessorProperty') {
          return Boolean((current as unknown as {static?: boolean}).static);
        }
        if (current.type === 'StaticBlock') return true;
        current = current.parent;
      }
      return true;
    };

    return {
      Identifier(node) {
        if (!BROWSER_GLOBALS.has(node.name)) return;
        const parent = node.parent;
        // `typeof document !== 'undefined'` guards
        if (parent.type === 'UnaryExpression' && parent.operator === 'typeof') return;
        // property names / keys: `foo.document`, `{document: 1}`
        if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed)
          return;
        if (parent.type === 'Property' && parent.key === node && !parent.computed) return;
        if (parent.type === 'PropertyDefinition' || parent.type === 'MethodDefinition') {
          if ((parent as unknown as {key: unknown}).key === node) return;
        }
        if (/^(?:Import|Export)/.test(parent.type)) return;
        if (isShadowed(node, node.name)) return;
        if (runsAtModuleEvaluation(node))
          context.report({node, messageId: 'topLevel', data: {name: node.name}});
      },
    };
  },
};
