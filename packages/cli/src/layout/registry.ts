/**
 * The element registry the layout language validates against, built from the agent registry: every `tct-*`
 * element with its attributes (and their enumerated values), slots and default-slot flag. Nothing is
 * hand-maintained: an alias whose element does not exist in this install is silently dropped.
 */
import type {AgentRegistry} from '../registry/types.ts';
import type {LayoutRegistry, RegistryAttribute, RegistryElement} from './ast.ts';

/**
 * Curated alias table: single letters for the highest-frequency structural elements, short mnemonics for the
 * rest. Collision policy: case-only pairs are forbidden; a form-frequency element wins a contested pair.
 */
export const ALIAS_TABLE: Readonly<Record<string, string>> = {
  // Layout
  V: 'tct-vstack',
  H: 'tct-hstack',
  St: 'tct-stack',
  SI: 'tct-stack-item',
  G: 'tct-grid',
  GS: 'tct-grid-span',
  S: 'tct-section',
  Ctr: 'tct-center',
  C: 'tct-card',
  F: 'tct-form-layout',
  D: 'tct-divider',
  Tbar: 'tct-toolbar',
  AR: 'tct-aspect-ratio',
  // Content
  Tx: 'tct-text',
  Hd: 'tct-heading',
  BQ: 'tct-blockquote',
  Cd: 'tct-code',
  K: 'tct-kbd',
  Ic: 'tct-icon',
  Lk: 'tct-link',
  Bd: 'tct-badge',
  Av: 'tct-avatar',
  SD: 'tct-status-dot',
  It: 'tct-item',
  ML: 'tct-metadata-list',
  MLI: 'tct-metadata-list-item',
  ES: 'tct-empty-state',
  // Actions
  B: 'tct-button',
  IB: 'tct-icon-button',
  BG: 'tct-button-group',
  Tg: 'tct-toggle-button',
  // Forms
  Fd: 'tct-field',
  IG: 'tct-input-group',
  TI: 'tct-text-input',
  TA: 'tct-text-area',
  NI: 'tct-number-input',
  FI: 'tct-file-input',
  CB: 'tct-checkbox-input',
  CL: 'tct-checkbox-list',
  RL: 'tct-radio-list',
  SW: 'tct-switch',
  SL: 'tct-slider',
  SG: 'tct-segmented-control',
  SGI: 'tct-segmented-control-item',
  // Overlays and feedback
  Dlg: 'tct-dialog',
  DH: 'tct-dialog-header',
  AD: 'tct-alert-dialog',
  Po: 'tct-popover',
  HC: 'tct-hover-card',
  Tt: 'tct-tooltip',
  Bn: 'tct-banner',
  DM: 'tct-dropdown-menu',
  MM: 'tct-more-menu',
  CM: 'tct-context-menu',
  Col: 'tct-collapsible',
  Sp: 'tct-spinner',
  PB: 'tct-progress-bar',
  Sk: 'tct-skeleton',
};

const normalize = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, '');

export function buildLayoutRegistry(registry: AgentRegistry): LayoutRegistry {
  const elements = new Map<string, RegistryElement>();
  const byShortName = new Map<string, string>();
  for (const component of registry.components) {
    for (const element of component.elements) {
      const attributes = new Map<string, RegistryAttribute>();
      for (const attribute of element.attributes) {
        attributes.set(attribute.name, {
          name: attribute.name,
          type: attribute.type,
          enumValues: attribute.values ?? null,
          isBoolean: attribute.type.trim() === 'boolean',
        });
      }
      elements.set(element.tag, {
        tag: element.tag,
        folder: component.folder,
        attributes,
        slots: new Set(element.slots.map((slot) => slot.name).filter((name) => name !== '')),
        hasDefaultSlot: element.slots.some((slot) => slot.name === ''),
      });
      byShortName.set(normalize(element.tag.replace(/^tct-/, '')), element.tag);
      byShortName.set(normalize(element.tag), element.tag);
    }
  }
  const aliases = new Map<string, string>();
  for (const [alias, tag] of Object.entries(ALIAS_TABLE)) {
    if (elements.has(tag)) aliases.set(alias, tag);
  }
  return {elements, aliases, tags: [...elements.keys()].sort(), byShortName};
}

/** Resolves an alias (`H`), a tag (`tct-hstack`), a short or Pascal name (`hstack`, `HStack`) to an element. */
export function resolveElement(
  registry: LayoutRegistry,
  name: string | null,
): RegistryElement | null {
  if (name === null) return null;
  const alias = registry.aliases.get(name);
  if (alias) return registry.elements.get(alias) ?? null;
  const tag = registry.elements.has(name.toLowerCase())
    ? name.toLowerCase()
    : registry.byShortName.get(normalize(name));
  return tag ? (registry.elements.get(tag) ?? null) : null;
}
