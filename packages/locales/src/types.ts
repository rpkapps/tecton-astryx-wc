/**
 * Types shared by the generated locale modules (`dist/<tag>.js`, `dist/en/<namespace>.js`,
 * `dist/pseudo.js`, `dist/loaders.js`). The runtime logic that resolves and formats messages lives in
 * `@tecton-wc/core/i18n` (A§9.15); this package ships data only.
 */

/** A flat catalog: message id (`@tct.<namespace>.<key>`, `@tct.<folder>.<key>`) to ICU message. */
export type Messages = Readonly<Record<string, string>>;

/** A lazily loaded catalog module. */
export type MessageLoader = () => Promise<{readonly default: Messages}>;
