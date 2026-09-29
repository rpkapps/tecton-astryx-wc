/**
 * In-house Stylelint plugin (A§18.1). Usage in stylelint.config.js: `plugins: tct.plugins`, then
 * enable `tct/<rule>` entries. Rules: no-palette-vars, no-import, no-color-literals, no-px-font-size,
 * no-host-context, host-box-props, host-selectors, layers-required, forced-colors-in-a11y-layer,
 * hover-in-media, logical-properties, known-custom-properties.
 */
export {plugins, DEFAULT_TOKEN_NAMES_FILE, findColorLiteral, inForcedColors} from './rules.ts';
import {plugins} from './rules.ts';
export default {plugins};
