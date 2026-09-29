/**
 * `TablePluginController`: the base class of the first-party table plugins. Upstream plugins are React
 * hooks that read a config every render and return a plugin object; here each plugin is a class that
 * is both a {@link TablePlugin} (the transform pipeline) and a Lit `ReactiveController`:
 *
 * ```ts
 * class MyPage extends LitElement {
 *   #sort: TableSortableController = new TableSortableController(this, {sort: [], onSortChange: (sort) => {…}});
 *   render() { return html`<tct-table .data=${…} .plugins=${{sort: this.#sort}}></tct-table>`; }
 * }
 * ```
 *
 * The config is an object that is read live on every render (`config.sort`, not a copy), so it can be a
 * plain literal you replace (`plugin.config = {...}`), or a state controller that implements the config
 * interface and notifies through `subscribe`. When the state behind a config changes without the
 * config object changing, call `plugin.refresh()` (state controllers do it for you).
 *
 * A plugin can be on several tables; it re-renders all of them (and its Lit host) when it refreshes.
 * The `host` argument is optional: pass the app element that owns the state, the table itself, or `null`.
 */
import type {ReactiveController, ReactiveControllerHost} from 'lit';
import type {TablePlugin, TablePluginHost} from './table.types.js';

/** Something a config can offer so a plugin refreshes when the state behind it changes. */
export interface TableConfigSource {
  /** Registers a listener called after every state change; returns the unsubscribe function. */
  subscribe?(listener: () => void): () => void;
}

export abstract class TablePluginController<T extends Record<string, unknown>, C extends object>
  implements TablePlugin<T>, ReactiveController
{
  readonly #tables = new Set<TablePluginHost>();
  readonly #host: ReactiveControllerHost | null;
  #config: C;
  #unsubscribe: (() => void) | undefined;

  constructor(host: ReactiveControllerHost | null, config: C) {
    this.#host = host;
    this.#config = config;
    host?.addController(this);
    this.#subscribe();
  }

  /** The current config; it is read live on every render. Assigning a new one re-renders the tables. */
  get config(): C {
    return this.#config;
  }
  set config(value: C) {
    if (value === this.#config) return;
    this.#config = value;
    this.#subscribe();
    this.refresh({rows: true});
  }

  /**
   * Re-renders every table this plugin is on, and the Lit host that owns it. Rows are rebuilt only when
   * their item or a `rowSignature` value changed; pass `{rows: true}` when the change affects every
   * row in a way no signature covers (a different set of pinned columns, an indent step).
   */
  refresh(options: {rows?: boolean} = {}): void {
    for (const table of this.#tables) {
      if (options.rows) table.invalidateRows();
      else table.requestUpdate();
    }
    this.#host?.requestUpdate();
  }

  /** The first table this plugin is on (for translation and direction), if any. */
  protected get table(): TablePluginHost | undefined {
    return this.#tables.values().next().value;
  }

  /** Localised message; falls back to the id when the plugin is on no table yet. */
  protected translate(id: string, args?: Record<string, unknown>): string {
    return this.table?.translate(id, args) ?? id;
  }

  attach(table: TablePluginHost): void {
    this.#tables.add(table);
  }

  detach(table: TablePluginHost): void {
    this.#tables.delete(table);
  }

  hostConnected(): void {
    this.#subscribe();
  }

  hostDisconnected(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
  }

  #subscribe(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    const source = this.#config as TableConfigSource;
    if (typeof source.subscribe === 'function') {
      this.#unsubscribe = source.subscribe(() => {
        this.refresh();
      });
    }
  }
}

/**
 * Base of the state controllers (`TableSortableStateController`, `TableSelectionStateController`, ...):
 * they own state, derive data, implement the config interface of the plugin they feed, and tell that
 * plugin (through `subscribe`) and their Lit host after every change.
 */
export abstract class TableStateController implements TableConfigSource, ReactiveController {
  readonly #listeners = new Set<() => void>();
  readonly #host: ReactiveControllerHost | null;

  constructor(host: ReactiveControllerHost | null) {
    this.#host = host;
    host?.addController(this);
  }

  /** Registers a listener called after every state change; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Notifies the plugins fed by this state and the Lit host. */
  protected notify(): void {
    for (const listener of [...this.#listeners]) listener();
    this.#host?.requestUpdate();
  }

  hostConnected(): void {
    // Nothing to set up: state is plain data.
  }

  hostDisconnected(): void {
    // Nothing to release.
  }
}
