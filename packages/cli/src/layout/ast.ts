/** Shared AST and registry types of the layout expression language (compact and outline surfaces). */

export interface KvAttr {
  kind: 'kv';
  key: string;
  value: LayoutValue;
  raw?: string;
  line: number;
  col: number;
}

export interface FlagAttr {
  kind: 'flag';
  key: string;
  line: number;
  col: number;
}

export interface NegAttr {
  kind: 'neg';
  key: string;
  line: number;
  col: number;
}

export type Attr = KvAttr | FlagAttr | NegAttr;

/** Parsed `{name +flag :arg}` block hint body. */
export interface Hint {
  name: string;
  flags: string[];
  arg: string | null;
  /** Set by the validator when the hint resolves to an element. */
  resolved?: {tag: string; known: boolean};
}

export interface IdRef {
  idref: string;
}

export interface SubExprValue {
  subexpr: LayoutItem[];
}

export interface HintValue {
  hint: Hint;
}

export type SlotValue = string | IdRef | SubExprValue | HintValue | null;

export interface Slot {
  kind: 'slot';
  key: string;
  value: SlotValue;
  line: number;
  col: number;
}

export type LayoutValue =
  | string
  | number
  | boolean
  | IdRef
  | {subexpr: LayoutItem[]}
  | {hint: Hint}
  | LayoutValue[]
  | {[key: string]: LayoutValue};

/** One attribute of an element in the registry. */
export interface RegistryAttribute {
  name: string;
  type: string;
  enumValues: (string | number)[] | null;
  isBoolean: boolean;
}

/** An element as the validator and expander see it. */
export interface RegistryElement {
  tag: string;
  /** The component family folder that registers it (`@tecton-wc/components/<folder>`). */
  folder: string;
  /** Attributes by name. */
  attributes: Map<string, RegistryAttribute>;
  slots: Set<string>;
  hasDefaultSlot: boolean;
}

export interface LayoutRegistry {
  elements: Map<string, RegistryElement>;
  /** Alias -> tag. */
  aliases: Map<string, string>;
  tags: string[];
  /** Normalised short name (`textinput`) -> tag. */
  byShortName: Map<string, string>;
}

export interface BoundInfo {
  element: RegistryElement;
  /** Attribute name -> value, after aliases and enum checks. */
  props: Map<string, LayoutValue>;
  slots: Slot[];
}

export interface LayoutNode {
  kind: 'node';
  name: string | null;
  id: string | null;
  enumMods: string[];
  payload: string | null;
  payload2: string | null;
  attrs: Attr[];
  slots: Slot[];
  hint: Hint | null;
  repeat: number | null;
  selected: boolean;
  children: LayoutItem[];
  line: number;
  col: number;
  /** Set by the validator; null when the name could not be resolved. */
  bound?: BoundInfo | null;
}

export interface LayoutGroup {
  kind: 'group';
  repeat: number | null;
  children: LayoutItem[];
  line: number;
  col: number;
}

export type LayoutItem = LayoutNode | LayoutGroup;

export interface LayoutDoc {
  roots: LayoutItem[];
  overlays: LayoutItem[];
  form: 'compact' | 'outline';
}

export interface RawIssue {
  message: string;
  line?: number;
  col?: number;
  suggestions?: string[];
}
