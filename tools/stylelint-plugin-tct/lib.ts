import stylelint from 'stylelint';

/**
 * Structural view of the PostCSS nodes the rules touch. Stylelint bundles PostCSS but does not
 * export its types, and `postcss` is not a direct dependency (D-007), so we describe what we use.
 */
export interface CssNode {
  type: string;
  parent?: CssContainer;
  source?: {
    start?: {line: number; column: number};
    end?: {line: number; column: number};
    input: {file?: string};
  };
  prev: () => CssNode | undefined;
  next: () => CssNode | undefined;
}
export interface CssContainer extends CssNode {
  nodes?: CssNode[];
}
export interface CssRule extends CssContainer {
  type: 'rule';
  selector: string;
}
export interface CssAtRule extends CssContainer {
  type: 'atrule';
  name: string;
  params: string;
}
export interface CssDecl extends CssNode {
  type: 'decl';
  prop: string;
  value: string;
}
export interface CssComment extends CssNode {
  type: 'comment';
  text: string;
}
export interface CssRoot extends CssContainer {
  type: 'root';
  walk: (callback: (node: CssNode) => void) => void;
  walkDecls: (callback: (decl: CssDecl) => void) => void;
  walkRules: (callback: (rule: CssRule) => void) => void;
  walkAtRules: (callback: (atRule: CssAtRule) => void) => void;
}

export type PostcssResult = stylelint.PostcssResult;

export const {report, ruleMessages, validateOptions} = stylelint.utils;

export function ancestors(node: CssNode): CssContainer[] {
  const chain: CssContainer[] = [];
  let current = node.parent;
  while (current && current.type !== 'root') {
    chain.push(current);
    current = current.parent;
  }
  return chain;
}

export function isAtRule(node: CssNode, name?: string): node is CssAtRule {
  return (
    node.type === 'atrule' &&
    (name === undefined || (node as CssAtRule).name.toLowerCase() === name)
  );
}

export function isRule(node: CssNode): node is CssRule {
  return node.type === 'rule';
}

/** Replaces strings and `url(...)` contents so value scanners never look inside them. */
export function maskValue(value: string): string {
  return value
    .replace(/url\((?:[^()"']|"[^"]*"|'[^']*')*\)/gi, 'url()')
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
}

/** Removes comments and collapses whitespace. */
export function normalizeParams(params: string): string {
  return params
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits a selector list on top-level commas. */
export function splitSelectors(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(selector.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(selector.slice(start).trim());
  return parts.filter(Boolean);
}

/** True for `:host` and `:host(...)` with nothing after them (host-level rules). */
export function isHostOnlySelector(selector: string): boolean {
  const text = selector.trim();
  if (!text.startsWith(':host') || text.startsWith(':host-context')) return false;
  let rest = text.slice(':host'.length);
  if (rest.startsWith('(')) {
    let depth = 0;
    let end = -1;
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === '(') depth++;
      else if (rest[i] === ')') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) return false;
    rest = rest.slice(end + 1);
  }
  return rest.trim() === '';
}

/** `physical: reason` comment directly before, or on the same line after, a declaration. */
export function hasPhysicalComment(decl: CssDecl): boolean {
  const prev = decl.prev();
  if (prev?.type === 'comment' && /^\s*physical:/i.test((prev as CssComment).text)) return true;
  const next = decl.next();
  return (
    next?.type === 'comment' &&
    /^\s*physical:/i.test((next as CssComment).text) &&
    next.source?.start?.line === decl.source?.end?.line
  );
}
