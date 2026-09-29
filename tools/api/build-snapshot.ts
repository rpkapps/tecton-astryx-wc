/**
 * Per-folder public-API snapshot (A§3): the CEM slice for the folder's tags, reduced to what a
 * consumer can depend on (names, types, defaults, reflection, event flags, slots, parts, states,
 * custom properties). Descriptions are deliberately left out so rewording docs never churns it.
 * `pnpm api:check` fails when the committed file differs from what the source now produces.
 */
import {cemElements, type CemPackage} from '../lib/cem.ts';
import {elementDoc, type ElementDoc} from '../lib/element-api.ts';

export interface ElementApi {
  class: string;
  attributes: {
    name: string;
    property: string;
    type: string;
    values?: string[];
    default?: string;
    reflects: boolean;
  }[];
  properties: {
    name: string;
    type: string;
    values?: string[];
    default?: string;
    readonly: boolean;
  }[];
  methods: {name: string; signature: string}[];
  slots: string[];
  events: {
    name: string;
    class?: string;
    native?: boolean;
    bubbles?: boolean;
    composed?: boolean;
    cancelable?: boolean;
  }[];
  cssParts: string[];
  cssStates: string[];
  cssProperties: {name: string; default?: string}[];
}

export interface FolderSnapshot {
  folder: string;
  elements: Record<string, ElementApi>;
}

/** Drops descriptions (and deprecation text) from an element's documented API. */
export function apiOf(doc: ElementDoc): ElementApi {
  return {
    class: doc.class,
    attributes: doc.attributes.map(
      ({name, property, type, values, default: fallback, reflects}) => ({
        name,
        property,
        type,
        ...(values ? {values} : {}),
        ...(fallback === undefined ? {} : {default: fallback}),
        reflects,
      }),
    ),
    properties: doc.properties.map(({name, type, values, default: fallback, readonly}) => ({
      name,
      type,
      ...(values ? {values} : {}),
      ...(fallback === undefined ? {} : {default: fallback}),
      readonly,
    })),
    methods: doc.methods.map(({name, signature}) => ({name, signature})),
    slots: doc.slots.map((slot) => (slot.name === '' ? '(default)' : slot.name)).sort(),
    events: doc.events.map(({name, class: eventClass, native, bubbles, composed, cancelable}) => ({
      name,
      ...(eventClass ? {class: eventClass, bubbles, composed, cancelable} : {}),
      ...(native ? {native: true} : {}),
    })),
    cssParts: doc.cssParts.map((part) => part.name),
    cssStates: doc.cssStates.map((state) => state.name),
    cssProperties: doc.cssProperties.map(({name, default: fallback}) => ({
      name,
      ...(fallback === undefined ? {} : {default: fallback}),
    })),
  };
}

/** One snapshot per folder that defines at least one public element, keyed by folder name. */
export function buildSnapshots(cem: CemPackage): Map<string, FolderSnapshot> {
  const out = new Map<string, FolderSnapshot>();
  for (const element of cemElements(cem)) {
    if (!element.folder) continue;
    const snapshot = out.get(element.folder) ?? {folder: element.folder, elements: {}};
    snapshot.elements[element.tagName] = apiOf(elementDoc(element));
    out.set(element.folder, snapshot);
  }
  return out;
}

export function serializeSnapshot(snapshot: FolderSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}
