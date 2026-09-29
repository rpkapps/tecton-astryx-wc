/**
 * Inline visually-hidden declaration block (still exposed to assistive technology). Used where the
 * behaviour must not depend on a stylesheet having loaded: live regions, hidden field labels and the
 * text of owned satellites. Components with a stylesheet use the shared `sr-only` module instead.
 */
export const VISUALLY_HIDDEN_STYLE =
  'position:absolute;inline-size:1px;block-size:1px;margin:-1px;padding:0;border:0;overflow:hidden;' +
  'clip-path:inset(50%);white-space:nowrap;pointer-events:none;user-select:none;';
