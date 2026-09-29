import type {Rule} from 'eslint';

/** POSIX-style absolute path of the linted file (rules test it against repository-relative patterns). */
export function posixFilename(context: Rule.RuleContext): string {
  return context.filename.split('\\').join('/');
}

/** True when the linted file path matches any of the patterns. */
export function fileMatches(context: Rule.RuleContext, patterns: readonly RegExp[]): boolean {
  const file = posixFilename(context);
  return patterns.some((pattern) => pattern.test(file));
}

export const TEST_FILE = /\.(?:node\.)?test\.ts$/;

/** Name of a call/member chain root such as `customElements` in `window.customElements.define`. */
export function memberPropertyName(node: {
  computed?: boolean;
  property: {type: string; name?: string; value?: unknown};
}): string | undefined {
  if (!node.computed && node.property.type === 'Identifier') return node.property.name;
  if (
    node.computed &&
    node.property.type === 'Literal' &&
    typeof node.property.value === 'string'
  ) {
    return node.property.value;
  }
  return undefined;
}
