/**
 * Type-alias resolution for the CEM (tct-type-values plugin). Lit's analyzer plugin records a
 * property's type as written (`ButtonVariant`). Docs tables and agent output need the options, so
 * this scans the sources for the two shapes CONVENTIONS §4 allows and resolves them:
 *
 *   export type Size = 'sm' | 'md' | 'lg';
 *   export const VARIANTS = ['primary', 'secondary'] as const;
 *   export type Variant = (typeof VARIANTS)[number];
 *
 * Anything else stays unresolved (the raw type text is still shown). The scan uses the analyzer's own
 * TypeScript instance because its `SyntaxKind` numbering differs from the repository's TypeScript.
 */
import type * as TS from 'typescript';

type Ts = typeof TS;

interface AliasDefinition {
  /** Literal options written directly in the union. */
  literals: string[];
  /** Names of other aliases the union references. */
  refs: string[];
  /** A `(typeof CONST)[number]` reference. */
  constRef?: string;
  /** True when every union member was a literal, a reference or a const index. */
  resolvable: boolean;
}

export interface TypeAliasTable {
  aliases: Map<string, AliasDefinition | 'ambiguous'>;
  constArrays: Map<string, string[] | 'ambiguous'>;
}

export function createTypeAliasTable(): TypeAliasTable {
  return {aliases: new Map(), constArrays: new Map()};
}

function literalText(ts: Ts, node: TS.Node): string | undefined {
  if (ts.isLiteralTypeNode(node)) {
    const literal = node.literal;
    if (ts.isStringLiteral(literal) || ts.isNumericLiteral(literal)) return literal.text;
    if (literal.kind === ts.SyntaxKind.TrueKeyword) return 'true';
    if (literal.kind === ts.SyntaxKind.FalseKeyword) return 'false';
  }
  return undefined;
}

function describeUnionMember(ts: Ts, node: TS.TypeNode, into: AliasDefinition): void {
  const literal = literalText(ts, node);
  if (literal !== undefined) {
    into.literals.push(literal);
    return;
  }
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) && !node.typeArguments) {
    into.refs.push(node.typeName.text);
    return;
  }
  // (typeof CONST)[number]
  if (
    ts.isIndexedAccessTypeNode(node) &&
    node.indexType.kind === ts.SyntaxKind.NumberKeyword &&
    ts.isParenthesizedTypeNode(node.objectType) &&
    ts.isTypeQueryNode(node.objectType.type) &&
    ts.isIdentifier(node.objectType.type.exprName)
  ) {
    into.constRef = node.objectType.type.exprName.text;
    return;
  }
  if (ts.isParenthesizedTypeNode(node)) {
    describeUnionMember(ts, node.type, into);
    return;
  }
  into.resolvable = false;
}

/** Collects type aliases and `as const` string arrays of one source file into `table`. */
export function scanTypeAliases(ts: Ts, source: TS.SourceFile, table: TypeAliasTable): void {
  for (const statement of source.statements) {
    if (ts.isTypeAliasDeclaration(statement)) {
      const definition: AliasDefinition = {literals: [], refs: [], resolvable: true};
      const type = statement.type;
      const members = ts.isUnionTypeNode(type) ? type.types : [type];
      for (const member of members) describeUnionMember(ts, member, definition);
      const name = statement.name.text;
      table.aliases.set(name, table.aliases.has(name) ? 'ambiguous' : definition);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        const initializer = declaration.initializer;
        if (!ts.isAsExpression(initializer)) continue;
        if (
          !ts.isTypeReferenceNode(initializer.type) ||
          initializer.type.typeName.getText() !== 'const'
        )
          continue;
        if (!ts.isArrayLiteralExpression(initializer.expression)) continue;
        const values: string[] = [];
        let ok = true;
        for (const element of initializer.expression.elements) {
          if (ts.isStringLiteral(element) || ts.isNumericLiteral(element))
            values.push(element.text);
          else ok = false;
        }
        if (!ok) continue;
        const name = declaration.name.text;
        table.constArrays.set(name, table.constArrays.has(name) ? 'ambiguous' : values);
      }
    }
  }
}

function resolveAlias(
  name: string,
  table: TypeAliasTable,
  seen: Set<string>,
): string[] | undefined {
  if (seen.has(name)) return undefined;
  const definition = table.aliases.get(name);
  if (!definition || definition === 'ambiguous' || !definition.resolvable) return undefined;
  seen.add(name);
  const values = [...definition.literals];
  for (const ref of definition.refs) {
    const resolved = resolveAlias(ref, table, seen);
    if (!resolved) return undefined;
    values.push(...resolved);
  }
  if (definition.constRef) {
    const array = table.constArrays.get(definition.constRef);
    if (!array || array === 'ambiguous') return undefined;
    values.push(...array);
  }
  return values;
}

/**
 * Options of a written type such as `ButtonVariant | undefined` or `'a' | 'b'`; undefined when the
 * type is not a finite set of string/number literals.
 */
export function resolveTypeValues(typeText: string, table: TypeAliasTable): string[] | undefined {
  const values: string[] = [];
  for (const raw of typeText.split('|')) {
    const part = raw.trim();
    if (part === '' || part === 'undefined' || part === 'null') continue;
    const quoted = /^(['"])(.*)\1$/.exec(part);
    if (quoted) {
      values.push(quoted[2]!);
      continue;
    }
    if (/^-?\d+(\.\d+)?$/.test(part)) {
      values.push(part);
      continue;
    }
    const resolved = resolveAlias(part, table, new Set());
    if (!resolved) return undefined;
    values.push(...resolved);
  }
  const unique = [...new Set(values)];
  return unique.length > 0 ? unique : undefined;
}
