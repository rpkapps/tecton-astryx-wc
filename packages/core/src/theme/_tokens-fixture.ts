/// <reference types="node" />
/**
 * Test fixture: the token pipeline's output (`packages/tokens/dist/tokens.json`, produced by `pnpm
 * generate`), so theme tests run against the real Tecton token set. The leading underscore keeps it
 * out of the core barrel.
 */
import {readFileSync} from 'node:fs';
import {
  registerTokenDefaults,
  resetTokenDefaults,
  tokenDefaultsFromMetadata,
} from './token-defaults.js';

export interface PipelineToken {
  name: string;
  category: string;
  light: string;
  dark: string;
}

interface TokensJson {
  breakpoints: {values: Record<string, number>};
  tokens: Record<string, PipelineToken>;
}

let cached: TokensJson | undefined;

/** The parsed `tokens.json`. */
export function pipeline(): TokensJson {
  cached ??= JSON.parse(
    readFileSync(new URL('../../../tokens/dist/tokens.json', import.meta.url), 'utf8'),
  ) as TokensJson;
  return cached;
}

/** Every pipeline token. */
export function pipelineTokens(): Record<string, PipelineToken> {
  return pipeline().tokens;
}

/** Registers the pipeline's tokens as the defaults (what an application does at start-up). */
export function registerPipelineDefaults(): void {
  resetTokenDefaults();
  registerTokenDefaults(tokenDefaultsFromMetadata(pipelineTokens()));
}
