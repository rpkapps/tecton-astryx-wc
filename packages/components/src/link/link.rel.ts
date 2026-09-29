const BLANK_TARGET_REL_TOKENS = ['noopener', 'noreferrer'] as const;

/**
 * Normalises `target` and `rel` (upstream `computeTargetAndRel`): a link that opens a new browsing context
 * (`target="_blank"`) always carries `rel="noopener noreferrer"`, added after any tokens the author gave.
 * [mwg:security]
 */
export function computeTargetAndRel(
  target: string | undefined,
  rel: string | undefined,
): {target: string | undefined; rel: string | undefined} {
  if (target !== '_blank') return {target, rel};
  const tokens = rel?.split(/\s+/).filter(Boolean) ?? [];
  for (const token of BLANK_TARGET_REL_TOKENS) {
    if (!tokens.includes(token)) tokens.push(token);
  }
  return {target, rel: tokens.join(' ')};
}
