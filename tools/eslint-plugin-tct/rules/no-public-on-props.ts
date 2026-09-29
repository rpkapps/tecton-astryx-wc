import type {Rule} from 'eslint';

interface MemberNode {
  type: string;
  static?: boolean;
  accessibility?: 'public' | 'private' | 'protected';
  key: {type: string; name?: string; value?: unknown};
  computed?: boolean;
}

/**
 * Public `on*` properties are hijacked by React 19 (it assigns props named `onX` as properties on
 * custom elements) and duplicate the event system (A§7.6, CONVENTIONS §9). Handlers are private
 * (`#onKeyDown = (e) => {}`).
 */
export const noPublicOnProps: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {description: 'Disallow public class members named on<Event>.'},
    schema: [],
    messages: {
      onProp:
        'Public member "{{name}}" looks like an event-handler property. Make it #private or rename it; never name a property on...',
    },
  },
  create(context) {
    const check = (node: MemberNode) => {
      if (node.static || node.computed) return;
      if (node.accessibility === 'private' || node.accessibility === 'protected') return;
      if (node.key.type !== 'Identifier' || !node.key.name) return; // #private keys are PrivateIdentifier
      if (/^on[A-Z]/.test(node.key.name)) {
        context.report({
          node: node as unknown as Rule.Node,
          messageId: 'onProp',
          data: {name: node.key.name},
        });
      }
    };
    return {
      PropertyDefinition: (node) => check(node),
      MethodDefinition: (node) => check(node),
      AccessorProperty: (node: Rule.Node) => check(node as unknown as MemberNode),
    };
  },
};
