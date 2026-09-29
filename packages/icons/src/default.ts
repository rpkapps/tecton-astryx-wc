/**
 * The default icon set (A§12, D-009, D-013): upstream Astryx's semantic role names mapped to Lucide glyphs,
 * plus the owner's Tecton domain icons (D-013 Q-02) under their own kebab names.
 *
 * `IconName` at astryx@ca632c6 (`packages/core/src/Icon/globalIconRegistry.tsx`) has 28 roles, plus the
 * namespaced `numberInput:stepperDown` that `defaultIcons.tsx` also ships. Every one maps to a glyph
 * from the generated `./lucide/*.js` modules (no `lucide` runtime dependency). All are 24x24 stroke
 * icons (`mode: 'stroke'`, stroke width 2); components expose `--icon-stroke-width`. This also covers
 * the six roles the Tecton glyph set lacks (chevronsLeft, chevronsRight, calendar, clock, checkDouble,
 * stop; tecton-theme.md 8).
 *
 * The 18 Tecton domain glyphs (oil & gas / subsurface: `well`, `fault`, `seismic`, `strata`, ...) are
 * registered as lazy loaders under `<name>` (outlined) and `<name>-filled`, so they cost nothing until a
 * page uses them. Lucide stays the general-purpose set (`lucide.js`); the larger tecton-astryx glyph set
 * is not used (D-013).
 *
 * No module side effect: `tct-icon` registers this set as the lowest-priority layer on its first
 * connect, and any consumer registration overrides it. Directional roles are flagged `mirrorInRtl`
 * explicitly (not inherited from the generated modules' name heuristic).
 */
import type {IconDefinition, IconLoader} from './types.js';
import {tectonIconNames, tectonIcons} from './tecton.js';
import arrowDown from './lucide/arrow-down.js';
import arrowUp from './lucide/arrow-up.js';
import arrowUpDown from './lucide/arrow-up-down.js';
import calendar from './lucide/calendar.js';
import check from './lucide/check.js';
import checkCheck from './lucide/check-check.js';
import chevronDown from './lucide/chevron-down.js';
import chevronLeft from './lucide/chevron-left.js';
import chevronRight from './lucide/chevron-right.js';
import chevronsLeft from './lucide/chevrons-left.js';
import chevronsRight from './lucide/chevrons-right.js';
import circleCheck from './lucide/circle-check.js';
import circleX from './lucide/circle-x.js';
import clock from './lucide/clock.js';
import columns3 from './lucide/columns-3.js';
import copy from './lucide/copy.js';
import ellipsis from './lucide/ellipsis.js';
import externalLink from './lucide/external-link.js';
import eyeOff from './lucide/eye-off.js';
import funnel from './lucide/funnel.js';
import info from './lucide/info.js';
import menu from './lucide/menu.js';
import mic from './lucide/mic.js';
import search from './lucide/search.js';
import square from './lucide/square.js';
import triangleAlert from './lucide/triangle-alert.js';
import wrench from './lucide/wrench.js';
import x from './lucide/x.js';

/** A glyph that mirrors in right-to-left contexts. */
const rtl = (icon: IconDefinition): IconDefinition => ({...icon, mirrorInRtl: true});

export const roleIcons = {
  close: x,
  chevronDown,
  chevronLeft: rtl(chevronLeft),
  chevronRight: rtl(chevronRight),
  chevronsLeft: rtl(chevronsLeft),
  chevronsRight: rtl(chevronsRight),
  check,
  success: circleCheck,
  error: circleX,
  warning: triangleAlert,
  info,
  calendar,
  clock,
  externalLink,
  menu,
  moreHorizontal: ellipsis,
  search,
  arrowUp,
  arrowDown,
  arrowsUpDown: arrowUpDown,
  funnel,
  eyeSlash: eyeOff,
  viewColumns: columns3,
  copy,
  checkDouble: checkCheck,
  wrench,
  stop: square,
  microphone: mic,
  'numberInput:stepperDown': chevronDown,
} as const satisfies Record<string, IconDefinition>;

export type RoleIconName = keyof typeof roleIcons;

/** Role names, in upstream `IconName` order (namespaced extension roles last). */
export const roleIconNames = Object.keys(roleIcons) as RoleIconName[];

/**
 * Everything `tct-icon` registers by default: the role icons as data, the Tecton domain icons as lazy
 * loaders (`IconDefinition | IconLoader`, as `registerIcons` accepts).
 */
export const defaultIcons = {
  ...roleIcons,
  ...tectonIcons,
} as const satisfies Record<string, IconDefinition | IconLoader>;

export type DefaultIconName = keyof typeof defaultIcons;

/** Every registered name: the roles, then the Tecton glyphs (`well`, `well-filled`, ...). */
export const defaultIconNames: readonly string[] = [
  ...roleIconNames,
  ...tectonIconNames.flatMap((name) => [name, `${name}-filled`]),
];
