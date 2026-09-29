/// <reference types="@vitest/browser-playwright" />
/**
 * Accessibility assertions (A§10, A§15.2): axe-core over open shadow roots, and Chromium's computed
 * accessibility tree through CDP (`axNode`, `axTree`, `axActiveDescendant`) as ground truth for
 * role, name, description and states, including names that come through shadow roots, slots,
 * `<label for>` and ARIA element reflection, which axe can only approximate.
 */
import axe from 'axe-core';
import {expect} from 'vitest';
import {cdp} from 'vitest/browser';
import {settle} from './fixture.js';

export type AxeResults = axe.AxeResults;

/**
 * Runs axe on `element` (it traverses open shadow roots and understands element reflection) and
 * fails with a readable list of violations. The `region` rule is off (fixtures are not in
 * landmarks). Returns the results so tests can triage `incomplete`.
 */
export async function expectAccessible(
  element: Element,
  options: axe.RunOptions = {},
): Promise<AxeResults> {
  await settle(element.parentNode ?? element);
  const results = await axe.run(element, {
    ...options,
    rules: {region: {enabled: false}, ...options.rules},
  });
  const report = results.violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n` +
        violation.nodes
          .map((node) => `  ${JSON.stringify(node.target)} ${node.failureSummary ?? ''}`)
          .join('\n'),
    )
    .join('\n\n');
  expect(report, 'axe violations').toBe('');
  return results;
}

/** One node of Chromium's computed accessibility tree (see {@link axNode}). */
export interface AxNode {
  role: string;
  name: string;
  description?: string;
  /** Every AX property (`expanded`, `checked`, `disabled`, `invalid`, `level`, ...) as a string. */
  [property: string]: string | undefined;
}

interface CdpAxNode {
  ignored: boolean;
  role?: {value: string};
  name?: {value: string};
  description?: {value: string};
  properties?: {
    name: string;
    value: {value?: unknown; relatedNodes?: {text?: string; backendDOMNodeId?: number}[]};
  }[];
}

interface CdpDomNode {
  backendNodeId: number;
  attributes?: string[];
  children?: CdpDomNode[];
  shadowRoots?: CdpDomNode[];
  contentDocument?: CdpDomNode;
}

function findProbe(node: CdpDomNode, token: string): CdpDomNode | undefined {
  const attributes = node.attributes;
  if (attributes) {
    for (let i = 0; i < attributes.length; i += 2) {
      if (attributes[i] === 'data-ax-probe' && attributes[i + 1] === token) return node;
    }
  }
  const children = [
    ...(node.shadowRoots ?? []),
    ...(node.children ?? []),
    ...(node.contentDocument ? [node.contentDocument] : []),
  ];
  for (const child of children) {
    const hit = findProbe(child, token);
    if (hit) return hit;
  }
  return undefined;
}

const utf8 = new TextDecoder('utf-8', {fatal: true});

/** Chromium returns some string properties as UTF-8 bytes read as Latin-1; re-decode those. */
function repairUtf8(value: string): string {
  if (!/[\u0080-ÿ]/.test(value) || /[^\u0000-ÿ]/.test(value)) return value;
  try {
    return utf8.decode(Uint8Array.from(value, (character) => character.charCodeAt(0)));
  } catch {
    return value;
  }
}

function toAxNode(node: CdpAxNode): AxNode {
  const out: AxNode = {role: node.role?.value ?? '', name: node.name?.value ?? ''};
  if (node.description?.value) out.description = node.description.value;
  for (const property of node.properties ?? []) {
    const {value, relatedNodes} = property.value;
    // Relation properties (labelledby, describedby, ...) carry nodes, not a value: use their text.
    if (value === undefined && relatedNodes) {
      out[property.name] = relatedNodes
        .map((related) => related.text ?? '')
        .join(' ')
        .trim();
    } else {
      out[property.name] = typeof value === 'string' ? repairUtf8(value) : String(value);
    }
  }
  return out;
}

async function withProbe<T>(
  element: Element,
  run: (backendNodeId: number) => Promise<T>,
): Promise<T> {
  const token = `p${Math.random().toString(36).slice(2)}`;
  element.setAttribute('data-ax-probe', token);
  try {
    const session = cdp();
    const {root} = (await session.send('DOM.getDocument', {depth: -1, pierce: true})) as {
      root: CdpDomNode;
    };
    const found = findProbe(root, token);
    if (!found) throw new Error('ax helpers: element not found in the DOM snapshot');
    return await run(found.backendNodeId);
  } finally {
    element.removeAttribute('data-ax-probe');
  }
}

/**
 * Chromium's *computed* accessibility node for `element` (which may be inside a shadow root).
 * Ignored nodes (`aria-hidden` subtrees) return `{role: '', name: '', ignored: 'true'}`.
 *
 * ```ts
 * expect(await axNode(inner)).toMatchObject({role: 'button', name: 'Open', expanded: 'true'});
 * ```
 */
export function axNode(element: Element): Promise<AxNode> {
  return withProbe(element, async (backendNodeId) => {
    const {nodes} = (await cdp().send('Accessibility.getPartialAXTree', {
      backendNodeId,
      fetchRelatives: false,
    })) as {nodes: CdpAxNode[]};
    const node = nodes[0];
    if (!node || node.ignored) return {role: '', name: '', ignored: 'true'};
    return toAxNode(node);
  });
}

/**
 * The non-ignored accessibility nodes at or under `element`, flattened in document order, as
 * `"role: name [states]"` strings for snapshot-style assertions.
 */
export function axTree(element: Element): Promise<string[]> {
  const states = ['selected', 'checked', 'expanded', 'disabled', 'pressed', 'invalid', 'required'];
  return withProbe(element, async (backendNodeId) => {
    const {nodes} = (await cdp().send('Accessibility.queryAXTree', {backendNodeId})) as {
      nodes: CdpAxNode[];
    };
    return nodes
      .filter(
        (node) =>
          !node.ignored &&
          !['generic', 'StaticText', 'InlineTextBox', 'none', ''].includes(node.role?.value ?? ''),
      )
      .map((node) => {
        const ax = toAxNode(node);
        const flags = states
          .filter((state) => ax[state] && ax[state] !== 'false')
          .map((state) => (ax[state] === 'true' ? state : `${state}=${ax[state]}`));
        return `${ax.role}${ax.name ? `: ${ax.name}` : ''}${flags.length ? ` [${flags.join(', ')}]` : ''}`;
      });
  });
}

/**
 * The element Chromium's accessibility tree reports as `aria-activedescendant` of `element`
 * (resolved through element reflection and shadow roots), found among `candidates`; `null` if none.
 */
export async function axActiveDescendant<T extends Element>(
  element: Element,
  candidates: readonly T[],
): Promise<T | null> {
  const all: Element[] = [element, ...candidates];
  const tokens = new Map<string, Element>();
  all.forEach((candidate, index) => {
    const token = `ad${index}-${Math.random().toString(36).slice(2)}`;
    candidate.setAttribute('data-ax-probe', token);
    tokens.set(token, candidate);
  });
  try {
    const session = cdp();
    const {root} = (await session.send('DOM.getDocument', {depth: -1, pierce: true})) as {
      root: CdpDomNode;
    };
    const ids = new Map<number, Element>();
    for (const [token, candidate] of tokens) {
      const node = findProbe(root, token);
      if (node) ids.set(node.backendNodeId, candidate);
    }
    const own = [...ids].find(([, candidate]) => candidate === element)?.[0];
    if (own === undefined) throw new Error('axActiveDescendant: element not found');
    const {nodes} = (await session.send('Accessibility.getPartialAXTree', {
      backendNodeId: own,
      fetchRelatives: false,
    })) as {nodes: CdpAxNode[]};
    const property = nodes[0]?.properties?.find((p) => p.name === 'activedescendant');
    const target = property?.value.relatedNodes?.[0]?.backendDOMNodeId;
    return target === undefined ? null : ((ids.get(target) as T | undefined) ?? null);
  } finally {
    for (const candidate of all) candidate.removeAttribute('data-ax-probe');
  }
}
