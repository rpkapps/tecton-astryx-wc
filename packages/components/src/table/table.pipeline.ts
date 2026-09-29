/**
 * The plugin pipeline (upstream `BaseTable` `applyPlugins` and `useBaseTablePlugins`): sequential
 * transforms with failure isolation, the canonical order of the first-party plugin names, and a
 * resolver that keeps the plugin array referentially stable so row memoization survives an inline
 * `plugins` record.
 */
import type {ReactiveControllerHost} from 'lit';
import {devError, devWarn} from '@tecton-wc/core/utils/dev.js';
import type {TablePlugin} from './table.types.js';

/**
 * Runs `initial` through every plugin's transform in order. A throwing transform is reported once (in
 * dev mode it names the plugin index) and the previous value carries on, so one broken plugin cannot
 * take the table down.
 */
export function applyPlugins<T extends Record<string, unknown>, P, A extends unknown[]>(
  plugins: readonly TablePlugin<T>[],
  select: (plugin: TablePlugin<T>) => ((props: P, ...args: A) => P) | undefined,
  initial: P,
  ...args: A
): P {
  let value = initial;
  for (let index = 0; index < plugins.length; index++) {
    const plugin = plugins[index]!;
    // A class-based plugin's transforms live on its prototype, so they need their `this`.
    const transform = select(plugin);
    if (!transform) continue;
    try {
      value = transform.call(plugin, value, ...args);
    } catch (error) {
      devError(
        `table:plugin:${index}`,
        `Table plugin at index ${index} threw in a transform.`,
        error,
      );
    }
  }
  return value;
}

/**
 * Canonical order of the first-party plugin names. It decides layout (which column lands left of which,
 * who wraps whom), never whether the table works.
 *
 *  1. `columnSettings`: filters columns before the others see them
 *  2. `sort`: adds header UI before selection adds its own column
 *  3. `tree`: wraps the first user column before selection prepends its column
 *  4. `selection`: adds its column after sort, so its header gets no sort button
 *  5. `pagination`: wraps the table in context last (outermost)
 *
 * Unknown names follow the known set in record order.
 */
export const TABLE_PLUGIN_ORDER: readonly string[] = [
  'columnSettings',
  'sort',
  'tree',
  'selection',
  'pagination',
];

const ORDER = new Map(TABLE_PLUGIN_ORDER.map((name, index) => [name, index]));

/** The method names of a {@link TablePlugin} that take part in the pipeline. */
export const TABLE_PLUGIN_TRANSFORMS = [
  'transformColumns',
  'transformTable',
  'transformHeaderRow',
  'transformHeaderCell',
  'transformBodyRow',
  'transformBodyCell',
  'transformScrollWrapper',
  'transformTableContext',
] as const;

const KNOWN_KEYS = new Set<string>([
  ...TABLE_PLUGIN_TRANSFORMS,
  'rowSignature',
  'attach',
  'detach',
]);

function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

/** Dev-mode checks: misspelt keys of plain-object plugins, non-function transforms, empty plugins. */
function validatePlugin(name: string, plugin: TablePlugin): void {
  const record = plugin as unknown as Record<string, unknown>;
  if (isPlainObject(plugin)) {
    for (const key of Object.keys(record)) {
      if (!KNOWN_KEYS.has(key)) {
        devWarn(
          `table:plugin:${name}:key:${key}`,
          `Table plugin "${name}" has unknown key "${key}". Valid keys: ${[...KNOWN_KEYS].join(', ')}. It is ignored.`,
        );
      }
    }
  }
  for (const key of TABLE_PLUGIN_TRANSFORMS) {
    const value = record[key];
    if (value != null && typeof value !== 'function') {
      devWarn(
        `table:plugin:${name}:type:${key}`,
        `Table plugin "${name}" has a non-function "${key}" (${typeof value}); it is skipped.`,
      );
    }
  }
  if (!TABLE_PLUGIN_TRANSFORMS.some((key) => typeof record[key] === 'function')) {
    devWarn(
      `table:plugin:${name}:empty`,
      `Table plugin "${name}" has no transform methods; it stays in the pipeline and does nothing.`,
    );
  }
}

function sameRecord(
  a: Readonly<Record<string, TablePlugin>> | undefined,
  b: Readonly<Record<string, TablePlugin>> | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

/**
 * Resolves a named plugin record into one ordered array after the built-in plugins, keeping the same
 * array while the base plugins and every named plugin are referentially unchanged (an inline record is
 * fine: only its values are compared).
 *
 * ```ts
 * const resolver = new BaseTablePlugins([stylePlugin]);
 * const plugins = resolver.resolve(userPlugins);   // stable across equal records
 * ```
 */
export class BaseTablePlugins<T extends Record<string, unknown> = Record<string, unknown>> {
  #base: readonly TablePlugin<T>[];
  #user: Readonly<Record<string, TablePlugin<T>>> | undefined;
  #result: TablePlugin<T>[] | undefined;

  /** `host` is accepted for symmetry with the other controllers; the resolver holds no reactive state. */
  constructor(
    _host: ReactiveControllerHost | null = null,
    basePlugins: readonly TablePlugin<T>[] = [],
  ) {
    this.#base = basePlugins;
  }

  /** The resolved array: base plugins, then known names in canonical order, then the rest in record order. */
  resolve(userPlugins?: Readonly<Record<string, TablePlugin<T>>>): TablePlugin<T>[] {
    if (
      this.#result &&
      sameRecord(
        this.#user as Readonly<Record<string, TablePlugin>> | undefined,
        userPlugins as Readonly<Record<string, TablePlugin>> | undefined,
      )
    ) {
      this.#user = userPlugins;
      return this.#result;
    }
    const entries = userPlugins ? Object.entries(userPlugins) : [];
    const unknown = TABLE_PLUGIN_ORDER.length;
    // Array#sort is stable: unknown names keep their record order.
    entries.sort(([a], [b]) => (ORDER.get(a) ?? unknown) - (ORDER.get(b) ?? unknown));
    for (const [name, plugin] of entries) validatePlugin(name, plugin as unknown as TablePlugin);
    this.#user = userPlugins;
    this.#result = [...this.#base, ...entries.map(([, plugin]) => plugin)];
    return this.#result;
  }
}
