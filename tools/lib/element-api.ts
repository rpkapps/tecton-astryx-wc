/**
 * One element's public API as the docs tables, the agent registry and the API snapshots see it.
 * Derived from a CEM class declaration (after the tct-* plugins have removed private API and
 * resolved event classes and option lists). Descriptions are kept here; the snapshot drops them.
 */
import {publicMembers, type CemDeclaration, type CemElement} from './cem.ts';
import {publicText} from './public-text.ts';

export interface AttributeDoc {
  name: string;
  property: string;
  type: string;
  values?: string[];
  default?: string;
  reflects: boolean;
  description: string;
  deprecated?: string;
}

export interface PropertyDoc {
  name: string;
  type: string;
  values?: string[];
  default?: string;
  readonly: boolean;
  description: string;
  deprecated?: string;
}

export interface MethodDoc {
  name: string;
  signature: string;
  parameters: {name: string; type: string; optional: boolean; description: string}[];
  returns: string;
  description: string;
  deprecated?: string;
}

export interface EventDoc {
  name: string;
  description: string;
  class?: string;
  native?: boolean;
  bubbles?: boolean;
  composed?: boolean;
  cancelable?: boolean;
  fields: {name: string; type: string; description: string}[];
}

export interface ElementDoc {
  tag: string;
  class: string;
  folder: string | undefined;
  summary: string;
  description: string;
  upstream?: string;
  attributes: AttributeDoc[];
  properties: PropertyDoc[];
  methods: MethodDoc[];
  slots: {name: string; description: string}[];
  events: EventDoc[];
  cssParts: {name: string; description: string}[];
  cssStates: {name: string; description: string}[];
  cssProperties: {name: string; default?: string; description: string}[];
}

const byName = <T extends {name: string}>(a: T, b: T) =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : 0;

const deprecation = (value: string | boolean | undefined) =>
  value === undefined || value === false ? {} : {deprecated: value === true ? 'true' : value};

/** Runs every prose field through `publicText` (the public site never names the upstream system). */
function scrub<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => scrub(item as unknown)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        typeof inner === 'string' && ['description', 'summary', 'deprecated'].includes(key)
          ? publicText(inner)
          : scrub(inner),
      ]),
    ) as T;
  }
  return value;
}

export function elementDoc(element: CemElement): ElementDoc {
  return scrub(buildElementDoc(element));
}

function buildElementDoc(element: CemElement): ElementDoc {
  const declaration: CemDeclaration = element.declaration;
  const {fields, methods} = publicMembers(declaration);
  const attributeFields = new Set(
    (declaration.attributes ?? []).map((attribute) => attribute.fieldName ?? attribute.name),
  );
  const fieldByName = new Map(fields.map((field) => [field.name, field]));

  const attributes: AttributeDoc[] = (declaration.attributes ?? [])
    .map((attribute) => {
      const property = attribute.fieldName ?? attribute.name;
      const field = fieldByName.get(property);
      return {
        name: attribute.name,
        property,
        type: attribute.type?.text ?? field?.type?.text ?? 'unknown',
        ...(attribute['x-tct']?.values ? {values: attribute['x-tct'].values} : {}),
        ...(attribute.default === undefined ? {} : {default: attribute.default}),
        reflects: field?.reflects === true,
        description: attribute.description ?? field?.description ?? '',
        ...deprecation(attribute.deprecated ?? field?.deprecated),
      };
    })
    .sort(byName);

  const properties: PropertyDoc[] = fields
    .filter((field) => !attributeFields.has(field.name))
    .map((field) => ({
      name: field.name,
      type: field.type?.text ?? 'unknown',
      ...(field['x-tct']?.values ? {values: field['x-tct'].values} : {}),
      ...(field.default === undefined ? {} : {default: field.default}),
      readonly: field.readonly === true,
      description: field.description ?? '',
      ...deprecation(field.deprecated),
    }));

  const methodDocs: MethodDoc[] = methods.map((method) => {
    const parameters = (method.parameters ?? []).map((p) => ({
      name: p.name,
      type: p.type?.text ?? 'unknown',
      optional: p.optional === true,
      description: p.description ?? '',
    }));
    const returns = method.return?.type?.text ?? 'void';
    return {
      name: method.name,
      signature: `(${parameters.map((p) => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ')}) => ${returns}`,
      parameters,
      returns,
      description: method.description ?? '',
      ...deprecation(method.deprecated),
    };
  });

  const events: EventDoc[] = (declaration.events ?? [])
    .map((event) => {
      const ext = event['x-tct'];
      return {
        name: event.name,
        description: event.description ?? '',
        ...(ext?.eventClass ? {class: ext.eventClass} : {}),
        ...(ext?.native ? {native: true} : {}),
        ...(ext?.eventClass
          ? {
              bubbles: ext.bubbles === true,
              composed: ext.composed === true,
              cancelable: ext.cancelable === true,
            }
          : {}),
        fields: ext?.fields ?? [],
      };
    })
    .sort(byName);

  const named = (items: {name: string; description?: string}[] | undefined) =>
    (items ?? [])
      .map((item) => ({name: item.name, description: item.description ?? ''}))
      .sort(byName);

  return {
    tag: element.tagName,
    class: declaration.name,
    folder: element.folder,
    summary: declaration.summary ?? '',
    description: declaration.description ?? '',
    ...(declaration['x-tct']?.upstream ? {upstream: declaration['x-tct'].upstream} : {}),
    attributes,
    properties,
    methods: methodDocs,
    slots: named(declaration.slots),
    events,
    cssParts: named(declaration.cssParts),
    cssStates: named(declaration.cssStates),
    cssProperties: (declaration.cssProperties ?? [])
      .map((property) => ({
        name: property.name,
        ...(property.default === undefined ? {} : {default: property.default}),
        description: property.description ?? '',
      }))
      .sort(byName),
  };
}
