/**
 * In-house Custom Elements Manifest analyzer plugins (A§17). They run after the analyzer's own
 * feature plugins and the Lit plugin, so inheritance is already applied when the package-link
 * hooks run. Each plugin is a small object with the analyzer's phase hooks:
 *
 *  - `tct-class-tags`     `@upstream`, `@cloakDisplay`, `@cloakMinBlockSize`, `@hideInherited`,
 *                         `@internal` on a class (the `tct-internal-tags` behaviour) -> `x-tct`
 *  - `tct-event-classes`  collects classes tagged `@eventName` (core/src/events)
 *  - `tct-events`         resolves `@fires tct-x` against those classes: type, flags, payload fields
 *  - `tct-public-api`     drops private, protected, `_underscored`, `#private` and static plumbing;
 *                         applies `@hideInherited`
 *  - `tct-type-values`    resolves union / `as const` aliases to option lists (`x-tct.values`)
 *  - `tct-parity`         attaches `x-tct-upstream` (mapping, keyboard, form, differences)
 *
 * `@cssstate` is handled by the analyzer itself. The analyzer walks ASTs with its own bundled
 * TypeScript; every hook receives that instance as `ts`, and nothing here uses the repository's copy
 * except for types.
 */
import type * as TS from 'typescript';
import type {
  CemClassExtension,
  CemDeclaration,
  CemEventExtension,
  CemEventFieldExtension,
  CemPackage,
  CemUpstream,
} from '../lib/cem.ts';
import {resolveTypeValues, type TypeAliasTable} from './type-values.ts';

type Ts = typeof TS;

/** Values shared between plugin hooks, and with tools/cem/analyze.ts. */
export interface CemContext {
  typeAliases: TypeAliasTable;
  /** tag name -> parity facts of the entry that implements it. */
  parityByTag: Map<string, CemUpstream>;
  eventClasses: Map<string, EventClassInfo>;
  [key: string]: unknown;
}

export interface EventClassInfo {
  eventName: string;
  className: string;
  description: string;
  bubbles: boolean;
  composed: boolean;
  cancelable: boolean;
  fields: CemEventFieldExtension[];
}

interface ModuleDoc {
  declarations: CemDeclaration[];
}

interface Plugin {
  name: string;
  analyzePhase?: (params: {
    ts: Ts;
    node: TS.Node;
    moduleDoc: ModuleDoc;
    context: CemContext;
  }) => void;
  packageLinkPhase?: (params: {customElementsManifest: CemPackage; context: CemContext}) => void;
}

/** Static members that are wiring, not API. */
export const STATIC_PLUMBING: ReadonlySet<string> = new Set([
  'styles',
  'shadowRootOptions',
  'formAssociated',
  'dependencies',
  'tagName',
  'version',
  'properties',
  'eventName',
]);

/** Instance members that are custom-element or framework callbacks, never consumer API. */
const CALLBACK_MEMBERS: ReadonlySet<string> = new Set([
  'connectedMoveCallback',
  'formAssociatedCallback',
  'formDisabledCallback',
  'formResetCallback',
  'formStateRestoreCallback',
]);

interface DocTag {
  tag: string;
  text: string;
}

function docTags(ts: Ts, node: TS.Node): DocTag[] {
  return ts.getJSDocTags(node).map((tag) => ({
    tag: tag.tagName.text,
    text: (ts.getTextOfJSDocComment(tag.comment) ?? '').trim(),
  }));
}

function docComment(ts: Ts, node: TS.Node): string {
  const docs = (node as TS.Node & {jsDoc?: TS.JSDoc[]}).jsDoc;
  const last = docs?.at(-1);
  return last ? (ts.getTextOfJSDocComment(last.comment) ?? '').trim() : '';
}

function findClass(moduleDoc: ModuleDoc, name: string | undefined): CemDeclaration | undefined {
  return name === undefined ? undefined : moduleDoc.declarations.find((d) => d.name === name);
}

function extension(declaration: CemDeclaration): CemClassExtension {
  return (declaration['x-tct'] ??= {});
}

export function tctClassTags(): Plugin {
  return {
    name: 'tct-class-tags',
    analyzePhase({ts, node, moduleDoc}) {
      if (!ts.isClassDeclaration(node)) return;
      const declaration = findClass(moduleDoc, node.name?.text);
      if (!declaration) return;
      for (const {tag, text} of docTags(ts, node)) {
        switch (tag) {
          case 'upstream':
            extension(declaration).upstream = text;
            break;
          case 'cloakDisplay':
            extension(declaration).cloakDisplay = text;
            break;
          case 'cloakMinBlockSize':
            extension(declaration).cloakMinBlockSize = text;
            break;
          case 'internal':
            extension(declaration).internal = true;
            break;
          case 'hideInherited': {
            const [names = '', ...reason] = text.split(/\s+-\s+/);
            extension(declaration).hideInherited = {
              names: names
                .split(',')
                .map((name) => name.trim())
                .filter(Boolean),
              reason: reason.join(' - ').trim(),
            };
            break;
          }
          default:
            break;
        }
      }
    },
  };
}

export function tctEventClasses(): Plugin {
  return {
    name: 'tct-event-classes',
    analyzePhase({ts, node, moduleDoc, context}) {
      if (!ts.isClassDeclaration(node) || !node.name) return;
      const tags = docTags(ts, node);
      const eventName = tags.find((tag) => tag.tag === 'eventName')?.text;
      if (!eventName) return;
      const has = (name: string) => tags.some((tag) => tag.tag === name);
      const fields: CemEventFieldExtension[] = [];
      for (const member of node.members) {
        if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) continue;
        if (member.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword)) continue;
        fields.push({
          name: member.name.text,
          type: member.type?.getText() ?? 'unknown',
          description: docComment(ts, member),
        });
      }
      const info: EventClassInfo = {
        eventName,
        className: node.name.text,
        description: docComment(ts, node),
        bubbles: has('bubbles'),
        composed: has('composed'),
        cancelable: has('cancelable'),
        fields,
      };
      context.eventClasses.set(eventName, info);
      const declaration = findClass(moduleDoc, info.className);
      if (declaration) extension(declaration).eventName = eventName;
    },
  };
}

export function tctEvents(): Plugin {
  return {
    name: 'tct-events',
    packageLinkPhase({customElementsManifest, context}) {
      for (const module of customElementsManifest.modules) {
        for (const declaration of module.declarations ?? []) {
          for (const event of declaration.events ?? []) {
            const info = context.eventClasses.get(event.name);
            const ext: CemEventExtension = info
              ? {
                  eventClass: info.className,
                  bubbles: info.bubbles,
                  composed: info.composed,
                  cancelable: info.cancelable,
                  fields: info.fields,
                }
              : {native: !event.name.startsWith('tct-')};
            if (info) {
              event.type = {text: info.className};
              if (!event.description) event.description = info.description;
            }
            event['x-tct'] = ext;
          }
        }
      }
    },
  };
}

const isPrivateName = (name: string) => name.startsWith('_') || name.startsWith('#');

export function tctPublicApi(): Plugin {
  return {
    name: 'tct-public-api',
    packageLinkPhase({customElementsManifest}) {
      for (const module of customElementsManifest.modules) {
        for (const declaration of module.declarations ?? []) {
          if (declaration.kind !== 'class') continue;
          const hidden = new Set(declaration['x-tct']?.hideInherited?.names ?? []);
          const dropped = new Set<string>();

          declaration.members = (declaration.members ?? []).filter((member) => {
            const inherited = member.inheritedFrom !== undefined;
            const drop =
              (member.privacy !== undefined && member.privacy !== 'public') ||
              isPrivateName(member.name) ||
              (member.static === true && STATIC_PLUMBING.has(member.name)) ||
              (!member.static && CALLBACK_MEMBERS.has(member.name)) ||
              (inherited && hidden.has(member.name));
            if (drop) dropped.add(member.name);
            return !drop;
          });

          declaration.attributes = (declaration.attributes ?? []).filter((attribute) => {
            const fieldName = attribute.fieldName;
            const drop =
              (fieldName !== undefined && dropped.has(fieldName)) ||
              (attribute.inheritedFrom !== undefined &&
                (hidden.has(attribute.name) || (fieldName !== undefined && hidden.has(fieldName))));
            return !drop;
          });

          // Inherited events named in @hideInherited.
          declaration.events = (declaration.events ?? []).filter(
            (event) => !(event.inheritedFrom && hidden.has(event.name)),
          );
        }
      }
    },
  };
}

export function tctTypeValues(): Plugin {
  return {
    name: 'tct-type-values',
    packageLinkPhase({customElementsManifest, context}) {
      for (const module of customElementsManifest.modules) {
        for (const declaration of module.declarations ?? []) {
          for (const member of declaration.members ?? []) {
            if (member.kind !== 'field' || !member.type) continue;
            const values = resolveTypeValues(member.type.text, context.typeAliases);
            if (values) member['x-tct'] = {...member['x-tct'], values};
          }
          for (const attribute of declaration.attributes ?? []) {
            if (!attribute.type) continue;
            const values = resolveTypeValues(attribute.type.text, context.typeAliases);
            if (values) attribute['x-tct'] = {...attribute['x-tct'], values};
          }
        }
      }
    },
  };
}

export function tctParity(): Plugin {
  return {
    name: 'tct-parity',
    packageLinkPhase({customElementsManifest, context}) {
      for (const module of customElementsManifest.modules) {
        for (const declaration of module.declarations ?? []) {
          if (!declaration.tagName) continue;
          const facts = context.parityByTag.get(declaration.tagName);
          if (facts) declaration['x-tct-upstream'] = facts;
        }
      }
    },
  };
}

/** Plugins in execution order (after the analyzer's built-ins and the Lit plugin). */
export function tctPlugins(): Plugin[] {
  return [
    tctClassTags(),
    tctEventClasses(),
    tctPublicApi(),
    tctEvents(),
    tctTypeValues(),
    tctParity(),
  ];
}
