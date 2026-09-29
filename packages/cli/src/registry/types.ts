/**
 * The public agent registry (`@tecton-wc/components/agent-registry.json`, also served by the docs site) as the
 * CLI and the MCP server read it. Mirrors the generator's output (`tools/agent-registry/build.ts`,
 * schema version 2). Every string in it is already free of upstream naming (D-015).
 */

export const SUPPORTED_SCHEMA_VERSIONS: readonly number[] = [2];

export interface RegistryAttribute {
  name: string;
  property: string;
  type: string;
  values?: string[];
  default?: string;
  reflects: boolean;
  description: string;
  deprecated?: string;
}

export interface RegistryProperty {
  name: string;
  type: string;
  values?: string[];
  default?: string;
  readonly: boolean;
  description: string;
  deprecated?: string;
}

export interface RegistryMethod {
  name: string;
  signature: string;
  parameters: {name: string; type: string; optional: boolean; description: string}[];
  returns: string;
  description: string;
  deprecated?: string;
}

export interface RegistryEvent {
  name: string;
  description: string;
  class?: string;
  native?: boolean;
  bubbles?: boolean;
  composed?: boolean;
  cancelable?: boolean;
  fields: {name: string; type: string; description: string}[];
}

export interface RegistryElement {
  tag: string;
  class: string;
  folder?: string;
  summary: string;
  description: string;
  attributes: RegistryAttribute[];
  properties: RegistryProperty[];
  methods: RegistryMethod[];
  slots: {name: string; description: string}[];
  events: RegistryEvent[];
  cssParts: {name: string; description: string}[];
  cssStates: {name: string; description: string}[];
  cssProperties: {name: string; default?: string; description: string}[];
  keyboard: {keys: string; action: string; when?: string}[];
  form?: {formAssociated: boolean; notes?: string};
}

export interface DenseDoc {
  description: string;
  usage: string;
  bestPractices: {do: boolean; text: string}[];
  /** One line per public attribute, property, slot, event and method name. */
  properties: Record<string, string>;
}

export interface RegistryExample {
  id: string;
  title: string;
  description: string;
  source: string;
}

export interface RegistryComponent {
  id: string;
  name: string;
  folder: string;
  tag: string | null;
  tags: string[];
  category: string;
  url: string;
  summary: string;
  keywords: string[];
  related: string[];
  status: string;
  documented: boolean;
  dense: DenseDoc | null;
  elements: RegistryElement[];
  examples: RegistryExample[];
  sourceFiles: string[];
  sections: Record<string, string>;
}

export interface RegistryController {
  name: string;
  kind: 'controller' | 'context' | 'mixin' | 'class' | 'function' | 'constant';
  area: string;
  import: string;
  summary: string;
  description: string;
  example: string;
  signature: string;
  members: {name: string; signature: string; summary: string}[];
  usedBy: string[];
}

export interface RegistryTopic {
  slug: string;
  title: string;
  description: string;
  url: string;
  sections: {heading: string; body: string}[];
}

export interface RegistryToken {
  name: string;
  category: string;
  status: string;
  light: string;
  dark: string;
  description: string;
}

export interface AgentRegistry {
  schemaVersion: number;
  library: {name: string; description: string};
  categories: string[];
  components: RegistryComponent[];
  controllers: RegistryController[];
  topics: RegistryTopic[];
  tokens: RegistryToken[];
  tokenCounts: {tokens: number; byStatus: Record<string, number>} | null;
}
