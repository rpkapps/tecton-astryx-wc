/**
 * Stable, machine-readable error codes of the `tct` CLI.
 *
 * The JSON error envelope carries a human-readable `error` string. That string is for people and changes
 * whenever the wording improves; agents and CI branch on `code`, which is the contract. Codes are
 * append-only: once shipped, a code's meaning never changes and it is never removed. Naming:
 * `ERR_<SUBJECT>[_<QUALIFIER>]`.
 */

export const ERROR_CODES = {
  /** Fallback for any error without a more specific code. */
  ERR_UNKNOWN: 'ERR_UNKNOWN',

  // CLI parsing and dispatch
  /** A top-level command name was not recognised (`tct bogus`). */
  ERR_UNKNOWN_COMMAND: 'ERR_UNKNOWN_COMMAND',
  /** A subcommand under a command group was not recognised (`tct layout bogus`). */
  ERR_UNKNOWN_SUBCOMMAND: 'ERR_UNKNOWN_SUBCOMMAND',
  /** An unknown flag was passed. */
  ERR_INVALID_OPTION: 'ERR_INVALID_OPTION',
  /** An argument or option value was rejected. */
  ERR_INVALID_ARGUMENT: 'ERR_INVALID_ARGUMENT',
  /** A required positional argument or option value was omitted. */
  ERR_MISSING_ARGUMENT: 'ERR_MISSING_ARGUMENT',
  /** `--detail` was given a value outside `brief`, `compact`, `full`. */
  ERR_INVALID_DETAIL: 'ERR_INVALID_DETAIL',

  // Environment
  /** The running Node.js version is below the supported minimum. */
  ERR_NODE_VERSION: 'ERR_NODE_VERSION',
  /** No agent registry could be located (component package not installed, not in the workspace). */
  ERR_REGISTRY_NOT_FOUND: 'ERR_REGISTRY_NOT_FOUND',
  /** A registry was found but cannot be read or has an unsupported schema version. */
  ERR_REGISTRY_INCOMPATIBLE: 'ERR_REGISTRY_INCOMPATIBLE',

  // "Unknown <subject>" lookups
  /** No element or component family matched the requested name. */
  ERR_UNKNOWN_COMPONENT: 'ERR_UNKNOWN_COMPONENT',
  /** No controller or utility matched the requested name. */
  ERR_UNKNOWN_CONTROLLER: 'ERR_UNKNOWN_CONTROLLER',
  /** No docs topic matched the requested name. */
  ERR_UNKNOWN_TOPIC: 'ERR_UNKNOWN_TOPIC',
  /** A docs topic exists but the requested section does not (or is ambiguous). */
  ERR_UNKNOWN_SECTION: 'ERR_UNKNOWN_SECTION',
  /** A `--category` filter value matched no category. */
  ERR_UNKNOWN_CATEGORY: 'ERR_UNKNOWN_CATEGORY',
  /** No package matched the requested name (discover, gap-report). */
  ERR_UNKNOWN_PACKAGE: 'ERR_UNKNOWN_PACKAGE',
  /** An unrecognised `--agent` value was passed to `init`. */
  ERR_UNKNOWN_AGENT: 'ERR_UNKNOWN_AGENT',
  /** An unrecognised `--features` value was passed to `init`. */
  ERR_UNKNOWN_FEATURE: 'ERR_UNKNOWN_FEATURE',
  /** A generic lookup matched nothing. */
  ERR_NOT_FOUND: 'ERR_NOT_FOUND',
  /** A component name matches more than one element and needs a narrower query. */
  ERR_AMBIGUOUS_COMPONENT: 'ERR_AMBIGUOUS_COMPONENT',

  // Resource shape problems (subject exists, artifact missing)
  /** A component exists but has no authored docs page yet. */
  ERR_NO_DOC: 'ERR_NO_DOC',
  /** The element source is not available in this install. */
  ERR_NO_SOURCE: 'ERR_NO_SOURCE',
  /** No example matched the requested id. */
  ERR_NO_EXAMPLE: 'ERR_NO_EXAMPLE',

  // Filesystem
  /** A required input file did not exist. */
  ERR_FILE_NOT_FOUND: 'ERR_FILE_NOT_FOUND',
  /** Refused to overwrite an existing file. */
  ERR_FILE_EXISTS: 'ERR_FILE_EXISTS',
  /** A path escaped its allowed root, or a name contained traversal markers. */
  ERR_PATH_TRAVERSAL: 'ERR_PATH_TRAVERSAL',
  /** Writing output failed (and was rolled back). */
  ERR_WRITE_FAILED: 'ERR_WRITE_FAILED',

  // Agent docs
  /** A managed agent-docs block is malformed (duplicate or unterminated markers): fix the file by hand. */
  ERR_AGENT_DOCS_MALFORMED: 'ERR_AGENT_DOCS_MALFORMED',

  // Layout expressions
  /** A layout expression failed to parse (syntax error, with line and column). */
  ERR_LAYOUT_PARSE: 'ERR_LAYOUT_PARSE',
  /** A layout expression parsed but failed validation (unknown element, attribute, value or hint). */
  ERR_LAYOUT_INVALID: 'ERR_LAYOUT_INVALID',

  /** The MCP server could not start or a request to it was malformed. */
  ERR_MCP: 'ERR_MCP',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_CODES, value);
}

/** A "did you mean" entry attached to an error. */
export interface Suggestion {
  name: string;
  reason?: string;
}

/** What command code throws. The runner turns it into the error envelope (or a `Error:` line) and exit 1. */
export class CliError extends Error {
  readonly code: ErrorCode;
  readonly suggestions: Suggestion[];

  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.ERR_UNKNOWN,
    suggestions: Suggestion[] = [],
  ) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.suggestions = suggestions;
  }
}
