/**
 * Name resolution over a registry: an element tag (`tct-button`, `<tct-button>`), a component family folder
 * (`button`, `dropdown-menu`) or a display name (`Button`, `Dropdown Menu`) all find the component.
 * Naming an element of a compound family (`tct-dropdown-menu-item`) finds the family and scopes the answer
 * to that element.
 */
import {closest} from '../text.ts';
import type {
  AgentRegistry,
  RegistryComponent,
  RegistryController,
  RegistryElement,
  RegistryTopic,
} from './types.ts';

export interface ComponentMatch {
  component: RegistryComponent;
  /** Set when the query named a non-primary element of the family. */
  element: RegistryElement | null;
}

const key = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Strips angle brackets and whitespace: `<tct-button>` -> `tct-button`. */
export function cleanQuery(query: string): string {
  return query.trim().replace(/^</, '').replace(/\/?>$/, '').trim();
}

export class RegistryLookup {
  readonly registry: AgentRegistry;
  private readonly byKey = new Map<string, RegistryComponent>();
  private readonly byElementTag = new Map<string, ComponentMatch>();
  private readonly controllersByName = new Map<string, RegistryController>();
  private readonly topicsBySlug = new Map<string, RegistryTopic>();

  constructor(registry: AgentRegistry) {
    this.registry = registry;
    for (const component of registry.components) {
      for (const alias of [component.folder, component.name, component.tag ?? '']) {
        if (alias) this.byKey.set(key(alias), component);
      }
      for (const tag of component.tags) this.byKey.set(key(tag), component);
      for (const element of component.elements) {
        this.byElementTag.set(element.tag, {
          component,
          element: element.tag === component.tag ? null : element,
        });
      }
    }
    for (const controller of registry.controllers) {
      this.controllersByName.set(controller.name.toLowerCase(), controller);
    }
    for (const topic of registry.topics) this.topicsBySlug.set(topic.slug.toLowerCase(), topic);
  }

  component(query: string): ComponentMatch | null {
    const cleaned = cleanQuery(query);
    if (!cleaned) return null;
    const tag = this.byElementTag.get(cleaned.toLowerCase());
    if (tag) return tag;
    // `Button` and `button` find tct-button; `tct-button` is the tag itself.
    const found = this.byKey.get(key(cleaned)) ?? this.byKey.get(key(`tct-${cleaned}`));
    return found ? {component: found, element: null} : null;
  }

  controller(query: string): RegistryController | null {
    return this.controllersByName.get(cleanQuery(query).toLowerCase()) ?? null;
  }

  topic(query: string): RegistryTopic | null {
    return this.topicsBySlug.get(cleanQuery(query).toLowerCase()) ?? null;
  }

  componentNames(): string[] {
    return this.registry.components.flatMap((component) => component.tags);
  }

  /** Similar component tags for an unknown name. */
  suggestComponents(query: string, max = 4): string[] {
    const cleaned = cleanQuery(query);
    const names = this.componentNames();
    const stripped = cleaned.toLowerCase().replace(/^tct-/, '');
    const direct = closest(cleaned, names, max);
    if (direct.length >= max) return direct;
    const short = closest(
      stripped,
      names.map((name) => name.replace(/^tct-/, '')),
      max,
    ).map((name) => `tct-${name}`);
    return [...new Set([...direct, ...short])].slice(0, max);
  }

  suggestControllers(query: string, max = 4): string[] {
    return closest(
      cleanQuery(query),
      this.registry.controllers.map((controller) => controller.name),
      max,
    );
  }

  suggestTopics(query: string, max = 4): string[] {
    return closest(
      cleanQuery(query),
      this.registry.topics.map((topic) => topic.slug),
      max,
    );
  }
}

/** The import that registers a family: `import '@tecton-wc/components/dropdown-menu';`. */
export function importStatement(component: RegistryComponent): string {
  return `import '@tecton-wc/components/${component.folder}';`;
}

/** The package specifier of a family's define entry. */
export function importSpecifier(component: RegistryComponent): string {
  return `@tecton-wc/components/${component.folder}`;
}
