/**
 * Registration (A§9.2). Class modules are side-effect free; only a family's `define.ts` calls
 * `defineElement(Ctor)`. Never use `@customElement` or `customElements.define` elsewhere (lint).
 *
 * Scoped-registry recipe: create a registry, call `defineElement(Ctor, registry)`, and attach it to
 * the application's shadow root. Elements rendered from templates inside our shadow roots (never
 * `document.createElement('tct-...')`) are then resolved through that registry.
 */
import type {TctElementConstructor} from './tct-element.js';

const warned = new Set<string>();

function define(
  ctor: TctElementConstructor,
  registry: CustomElementRegistry,
  visiting: Set<TctElementConstructor>,
): void {
  if (visiting.has(ctor)) return; // dependency cycle: the first visit will register it
  visiting.add(ctor);

  // Dependencies first, so a class can render them the moment it upgrades.
  for (const dependency of ctor.dependencies) define(dependency, registry, visiting);

  const tag = ctor.tagName;
  if (typeof tag !== 'string' || !tag.includes('-')) {
    throw new TypeError(
      `defineElement: ${ctor.name || 'the class'} needs a static tagName containing a hyphen.`,
    );
  }
  const existing = registry.get(tag);
  if (existing === undefined) {
    registry.define(tag, ctor);
    return;
  }
  if (existing === ctor) return;
  if (!warned.has(tag)) {
    warned.add(tag);
    const version = (ctor as {version?: string}).version ?? 'unknown';
    const existingVersion = (existing as {version?: string}).version ?? 'unknown';
    console.warn(
      `[tecton] <${tag}> is already defined by another class (registered v${existingVersion}, ` +
        `ignored v${version}); keeping the first definition. Two copies of the library are probably loaded.`,
    );
  }
}

/**
 * Registers `ctor.dependencies` (recursively, cycle-safe) and then `ctor` under `ctor.tagName`.
 * Same class already registered: no-op. A different class owns the tag: the first is kept and a
 * warning names both versions, once per tag.
 */
export function defineElement(
  ctor: TctElementConstructor,
  registry: CustomElementRegistry = customElements,
): void {
  define(ctor, registry, new Set());
}

/** Forgets which duplicate definitions already warned. Test-only. */
export function resetDefineWarnings(): void {
  warned.clear();
}
