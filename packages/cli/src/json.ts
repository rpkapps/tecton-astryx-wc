/**
 * `@tecton-wc/cli/json`: the out-of-process consumer's view of `tct --json` output.
 *
 * Success envelope: `{apiVersion, type, data, meta?}`. Error envelope: `{apiVersion, error, code,
 * suggestions?}`. Branch on `code`, never on the message.
 *
 * ```ts
 * import {parseResponse, isError} from '@tecton-wc/cli/json';
 * const result = parseResponse(stdout);
 * if (isError(result)) console.error(result.code);
 * ```
 */
import type {ErrorCode, Suggestion} from './errors.ts';

export type {ErrorCode, Suggestion} from './errors.ts';
export {ERROR_CODES, isErrorCode} from './errors.ts';
export type * from './types.ts';

/** Version of the envelope contract. Bumped on a breaking shape change. */
export const API_VERSION = 1;

/** A success response: a `type` discriminator, its `data` payload and an optional `meta` sidecar. */
export interface CLIResponse<Type extends string = string, Data = unknown> {
  apiVersion: number;
  type: Type;
  data: Data;
  meta?: Record<string, unknown>;
}

/** A structured error. Check `'error' in result` (or {@link isError}) to discriminate. */
export interface CLIError {
  apiVersion: number;
  error: string;
  code: ErrorCode;
  suggestions?: Suggestion[];
}

export type CLIResult = CLIResponse | CLIError;

/** Parses raw CLI output (a JSON string, or an already parsed object). Throws on invalid JSON. */
export function parseResponse(raw: unknown): CLIResult {
  return (typeof raw === 'string' ? JSON.parse(raw) : raw) as CLIResult;
}

/** Type guard: is the result an error envelope? */
export function isError(result: unknown): result is CLIError {
  return result !== null && typeof result === 'object' && 'error' in result;
}

/** Asserts a specific response type. Throws on an error envelope or a type mismatch. */
export function assertResponse<Type extends string>(
  raw: unknown,
  expectedType: Type,
): CLIResponse<Type> {
  const result = parseResponse(raw);
  if (isError(result)) throw new Error(result.error);
  if (result.type !== expectedType) {
    throw new Error(`Expected type "${expectedType}", got "${result.type}"`);
  }
  return result as CLIResponse<Type>;
}
