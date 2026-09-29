import type {ChatToken, ChatTokenCustom} from './chat-message.types.js';

export const isCustomToken = (token: ChatToken): token is ChatTokenCustom =>
  'render' in token && typeof token.render === 'function';

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** One piece of the projected message: literal text, or the token that replaced a matched value. */
export type TokenPart = string | {token: ChatToken; key: string};

/**
 * Splits `text` at every literal occurrence of a token value. Values are matched literally, in the
 * order the tokens are given (the first token that matches at a position wins), and empty values are
 * ignored so the scan always makes progress.
 */
export function splitTokens(text: string, tokens: readonly ChatToken[]): TokenPart[] {
  const matchable = tokens.filter((token) => token.value.length > 0);
  if (text === '' || matchable.length === 0) return [text];
  const byValue = new Map<string, ChatToken>();
  for (const token of matchable) byValue.set(token.value, token);
  const pattern = new RegExp(
    `(${matchable.map((token) => escapeRegExp(token.value)).join('|')})`,
    'g',
  );
  const parts: TokenPart[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index;
    if (at > last) parts.push(text.slice(last, at));
    const token = byValue.get(match[0]);
    if (token) parts.push({token, key: `${match[0]}@${at}`});
    last = at + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
