/**
 * Vitest browser setup (A§15.1), loaded before every browser test file through `setupFiles`.
 *
 *  - loads `tokens.css` and `fonts.css` when the tokens package has generated them, so computed
 *    colours are real (axe contrast) and components see the Tecton theme;
 *  - injects a Tailwind-preflight-equivalent reset (real applications have one, it beats `:host`
 *    rules, and components must render correctly under it);
 *  - forces the Tier-2 feature set off when `TCT_TIER2=1` (A§18.5);
 *  - restores globals after each test: fixtures, feature overrides, media emulation, layer stack,
 *    announcer regions, scroll lock.
 */
import {afterEach, beforeEach} from 'vitest';
import {resetFeatures} from '@tecton-astryx/core/features.js';
import {cleanupFixtures} from './fixture.js';
import {clearMediaEmulation} from './emulate.js';
import {resetCoreGlobals} from './reset.js';
import {forceFeatures, isTier2, TIER2_DISABLED} from './tier.js';

// Optional inputs: absent until `pnpm generate` has produced the tokens package output.
import.meta.glob('../../tokens/dist/{tokens,fonts}.css', {eager: true});

const preflight = document.createElement('style');
preflight.dataset.testPreflight = '';
preflight.textContent =
  '*, ::after, ::before, ::backdrop { box-sizing: border-box; margin: 0; padding: 0; border: 0 solid; }';
document.head.append(preflight);

let restoreTier2: (() => void) | undefined;

beforeEach(() => {
  if (isTier2) {
    restoreTier2 = forceFeatures(Object.fromEntries(TIER2_DISABLED.map((name) => [name, false])));
  }
});

afterEach(async () => {
  restoreTier2?.();
  restoreTier2 = undefined;
  cleanupFixtures();
  resetCoreGlobals();
  resetFeatures();
  await clearMediaEmulation();
});
