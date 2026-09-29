/**
 * Typed reading of `custom-elements.json` (A§17). Everything that derives from the CEM (API
 * snapshots, docs pages, the agent registry, cloak.css, the autoloader map) goes through these
 * accessors, so the in-house `x-tct` extension fields have one definition.
 */
import {existsSync, readFileSync} from 'node:fs';

export interface CemType {
  text: string;
}

export interface CemParameter {
  name: string;
  type?: CemType;
  description?: string;
  optional?: boolean;
  default?: string;
}

export interface CemInheritedFrom {
  name: string;
  module?: string;
}

/** In-house extension fields on members and attributes. */
export interface CemMemberExtension {
  /** Finite options resolved from a type alias (`'a' | 'b'` or an `as const` array). */
  values?: string[];
}

export interface CemField {
  kind: 'field';
  name: string;
  type?: CemType;
  default?: string;
  description?: string;
  privacy?: 'public' | 'private' | 'protected';
  static?: boolean;
  readonly?: boolean;
  attribute?: string;
  reflects?: boolean;
  deprecated?: string | boolean;
  inheritedFrom?: CemInheritedFrom;
  'x-tct'?: CemMemberExtension;
}

export interface CemMethod {
  kind: 'method';
  name: string;
  description?: string;
  privacy?: 'public' | 'private' | 'protected';
  static?: boolean;
  parameters?: CemParameter[];
  return?: {type?: CemType; description?: string};
  deprecated?: string | boolean;
  inheritedFrom?: CemInheritedFrom;
}

export type CemMember = CemField | CemMethod;

export interface CemAttribute {
  name: string;
  fieldName?: string;
  type?: CemType;
  default?: string;
  description?: string;
  deprecated?: string | boolean;
  inheritedFrom?: CemInheritedFrom;
  'x-tct'?: CemMemberExtension;
}

export interface CemEventFieldExtension {
  name: string;
  type: string;
  description: string;
}

/** Facts resolved from the event's class in `core/src/events` (tct-events plugin). */
export interface CemEventExtension {
  /** Event class name, e.g. `TctOpenChangeEvent`; absent for native events. */
  eventClass?: string;
  native?: boolean;
  bubbles?: boolean;
  composed?: boolean;
  cancelable?: boolean;
  fields?: CemEventFieldExtension[];
}

export interface CemEvent {
  name: string;
  type?: CemType;
  description?: string;
  deprecated?: string | boolean;
  inheritedFrom?: CemInheritedFrom;
  'x-tct'?: CemEventExtension;
}

export interface CemSlot {
  name: string;
  description?: string;
}

export interface CemCssPart {
  name: string;
  description?: string;
}

export interface CemCssProperty {
  name: string;
  description?: string;
  default?: string;
  syntax?: string;
}

export interface CemCssState {
  name: string;
  description?: string;
}

/** In-house extension fields on a class declaration (tct-* plugins). */
export interface CemClassExtension {
  /** `@upstream Button`: the upstream component this element implements. */
  upstream?: string;
  /** `@cloakDisplay inline-flex`: display value reserved before upgrade (cloak.css). */
  cloakDisplay?: string;
  /** `@cloakMinBlockSize 2rem`: space reserved before upgrade (cloak.css). */
  cloakMinBlockSize?: string;
  /** `@internal` class: skipped by docs, parity, cloak, autoloader and JSX types. */
  internal?: boolean;
  /** `@hideInherited a, b - reason`: inherited names that are not part of this element's API. */
  hideInherited?: {names: string[]; reason: string};
  /** Present on event classes (`@eventName`). */
  eventName?: string;
}

/** Parity facts attached by the tct-parity plugin (`x-tct-upstream`). */
export interface CemUpstream {
  entry: string;
  status: string;
  upstream: {name: string; path: string; commit: string};
  api: {upstream: string; kind: string; as: string; target?: string; reason?: string}[];
  hooks?: unknown[];
  keyboard?: {keys: string; action: string; when?: string}[];
  form?: {formAssociated: boolean; notes?: string};
  differences?: {id: string; type: string; text: string}[];
}

export interface CemDeclaration {
  kind: 'class' | 'mixin' | 'function' | 'variable';
  name: string;
  description?: string;
  summary?: string;
  tagName?: string;
  customElement?: boolean;
  superclass?: {name: string; module?: string};
  mixins?: {name: string; module?: string}[];
  attributes?: CemAttribute[];
  members?: CemMember[];
  slots?: CemSlot[];
  events?: CemEvent[];
  cssParts?: CemCssPart[];
  cssProperties?: CemCssProperty[];
  cssStates?: CemCssState[];
  deprecated?: string | boolean;
  'x-tct'?: CemClassExtension;
  'x-tct-upstream'?: CemUpstream;
}

export interface CemModule {
  kind: 'javascript-module';
  /** Repository-relative POSIX path of the source file. */
  path: string;
  declarations?: CemDeclaration[];
  exports?: unknown[];
}

export interface CemPackage {
  schemaVersion: string;
  modules: CemModule[];
}

export function loadCem(path: string): CemPackage | undefined {
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as CemPackage) : undefined;
}

export interface CemElement {
  tagName: string;
  declaration: CemDeclaration;
  module: CemModule;
  /** Component family folder (`packages/components/src/<folder>/…`), if the class lives in one. */
  folder: string | undefined;
}

const FOLDER_PATTERN = /^packages\/components\/src\/([^/]+)\//;

export function folderOfModule(modulePath: string): string | undefined {
  return FOLDER_PATTERN.exec(modulePath)?.[1];
}

/**
 * Custom elements in the CEM (classes with a tag name), sorted by tag name. Internal classes are
 * skipped unless `includeInternal` is set.
 */
export function cemElements(
  cem: CemPackage,
  options: {includeInternal?: boolean} = {},
): CemElement[] {
  const out: CemElement[] = [];
  for (const module of cem.modules) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.kind !== 'class' || !declaration.tagName) continue;
      if (declaration['x-tct']?.internal && !options.includeInternal) continue;
      out.push({
        tagName: declaration.tagName,
        declaration,
        module,
        folder: folderOfModule(module.path),
      });
    }
  }
  return out.sort((a, b) => (a.tagName < b.tagName ? -1 : a.tagName > b.tagName ? 1 : 0));
}

/** Public fields (with attribute info) and methods of an element, own and inherited, sorted. */
export function publicMembers(declaration: CemDeclaration): {
  fields: CemField[];
  methods: CemMethod[];
} {
  const members = (declaration.members ?? []).filter(
    (member) => !member.static && (member.privacy ?? 'public') === 'public',
  );
  const byName = (a: {name: string}, b: {name: string}) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  return {
    fields: members.filter((member): member is CemField => member.kind === 'field').sort(byName),
    methods: members.filter((member): member is CemMethod => member.kind === 'method').sort(byName),
  };
}
