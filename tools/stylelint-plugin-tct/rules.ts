/**
 * In-house Stylelint rules (A§18.1, A§6, D-005). Namespace `tct/`. Each rule's primary option is
 * `true`; rules that need configuration take a secondary options object.
 */
import {existsSync, readFileSync} from 'node:fs';
import {isAbsolute, resolve} from 'node:path';
import stylelint from 'stylelint';
import {
  ancestors,
  hasPhysicalComment,
  isAtRule,
  isHostOnlySelector,
  isRule,
  maskValue,
  normalizeParams,
  report,
  ruleMessages,
  splitSelectors,
  validateOptions,
  type CssAtRule,
  type CssDecl,
  type CssRoot,
  type CssRule,
  type PostcssResult,
} from './lib.ts';

const NAMESPACE = 'tct';
const ruleName = (name: string) => `${NAMESPACE}/${name}`;

type RuleFn = (root: CssRoot, result: PostcssResult) => void;

/** Builds a `stylelint.createPlugin` entry with `primary: true` validation. */
function plugin(
  name: string,
  messages: Record<string, (...args: string[]) => string>,
  create: (
    secondary: Record<string, unknown> | undefined,
    emit: (node: CssDecl | CssRule | CssAtRule, key: string, ...args: string[]) => void,
    result: PostcssResult,
  ) => RuleFn,
) {
  const fullName = ruleName(name);
  const msgs = ruleMessages(fullName, messages);
  const rule =
    (primary: unknown, secondary: Record<string, unknown> | undefined) =>
    (root: CssRoot, result: PostcssResult) => {
      if (!validateOptions(result, fullName, {actual: primary, possible: [true]})) return;
      const emit = (node: CssDecl | CssRule | CssAtRule, key: string, ...args: string[]) =>
        report({
          result,
          ruleName: fullName,
          node: node as never,
          message: (msgs as Record<string, (...a: string[]) => string>)[key]!(...args),
        });
      create(secondary, emit, result)(root, result);
    };
  rule.ruleName = fullName;
  rule.messages = msgs;
  return stylelint.createPlugin(fullName, rule as never);
}

// ---------------------------------------------------------------------------------------------
// no-palette-vars: component CSS never references the palette layer (D-005).
export const noPaletteVars = plugin(
  'no-palette-vars',
  {
    rejected: (name) =>
      `Component CSS must not reference palette variable "${name}"; use a semantic token (D-005).`,
  },
  (_options, emit) => (root) => {
    root.walkDecls((decl) => {
      const match = /--tecton-palette-[\w-]*/.exec(`${decl.prop} ${decl.value}`);
      if (match) emit(decl, 'rejected', match[0]);
    });
  },
);

// no-import: component sheets are self-contained (A§2.3).
export const noImport = plugin(
  'no-import',
  {
    rejected: () =>
      '@import is not allowed in component CSS; add another shared module to `static styles`.',
  },
  (_options, emit) => (root) => {
    root.walkAtRules((atRule) => {
      if (atRule.name.toLowerCase() === 'import') emit(atRule, 'rejected');
    });
  },
);

// ---------------------------------------------------------------------------------------------
// no-color-literals
const NAMED_COLORS = [
  'aliceblue',
  'antiquewhite',
  'aqua',
  'aquamarine',
  'azure',
  'beige',
  'bisque',
  'black',
  'blanchedalmond',
  'blue',
  'blueviolet',
  'brown',
  'burlywood',
  'cadetblue',
  'chartreuse',
  'chocolate',
  'coral',
  'cornflowerblue',
  'cornsilk',
  'crimson',
  'cyan',
  'darkblue',
  'darkcyan',
  'darkgoldenrod',
  'darkgray',
  'darkgreen',
  'darkgrey',
  'darkkhaki',
  'darkmagenta',
  'darkolivegreen',
  'darkorange',
  'darkorchid',
  'darkred',
  'darksalmon',
  'darkseagreen',
  'darkslateblue',
  'darkslategray',
  'darkslategrey',
  'darkturquoise',
  'darkviolet',
  'deeppink',
  'deepskyblue',
  'dimgray',
  'dimgrey',
  'dodgerblue',
  'firebrick',
  'floralwhite',
  'forestgreen',
  'fuchsia',
  'gainsboro',
  'ghostwhite',
  'gold',
  'goldenrod',
  'gray',
  'green',
  'greenyellow',
  'grey',
  'honeydew',
  'hotpink',
  'indianred',
  'indigo',
  'ivory',
  'khaki',
  'lavender',
  'lavenderblush',
  'lawngreen',
  'lemonchiffon',
  'lightblue',
  'lightcoral',
  'lightcyan',
  'lightgoldenrodyellow',
  'lightgray',
  'lightgreen',
  'lightgrey',
  'lightpink',
  'lightsalmon',
  'lightseagreen',
  'lightskyblue',
  'lightslategray',
  'lightslategrey',
  'lightsteelblue',
  'lightyellow',
  'lime',
  'limegreen',
  'linen',
  'magenta',
  'maroon',
  'mediumaquamarine',
  'mediumblue',
  'mediumorchid',
  'mediumpurple',
  'mediumseagreen',
  'mediumslateblue',
  'mediumspringgreen',
  'mediumturquoise',
  'mediumvioletred',
  'midnightblue',
  'mintcream',
  'mistyrose',
  'moccasin',
  'navajowhite',
  'navy',
  'oldlace',
  'olive',
  'olivedrab',
  'orange',
  'orangered',
  'orchid',
  'palegoldenrod',
  'palegreen',
  'paleturquoise',
  'palevioletred',
  'papayawhip',
  'peachpuff',
  'peru',
  'pink',
  'plum',
  'powderblue',
  'purple',
  'rebeccapurple',
  'red',
  'rosybrown',
  'royalblue',
  'saddlebrown',
  'salmon',
  'sandybrown',
  'seagreen',
  'seashell',
  'sienna',
  'silver',
  'skyblue',
  'slateblue',
  'slategray',
  'slategrey',
  'snow',
  'springgreen',
  'steelblue',
  'tan',
  'teal',
  'thistle',
  'tomato',
  'turquoise',
  'violet',
  'wheat',
  'white',
  'whitesmoke',
  'yellow',
  'yellowgreen',
];
const NAMED_COLOR = new RegExp(`(?<![\\w-])(?:${NAMED_COLORS.join('|')})(?![\\w-]|\\()`, 'i');

/**
 * CSS system colours (css-color-4, plus the deprecated ones browsers still honour). They follow the
 * user's forced-colours palette, so they are only allowed inside `@media (forced-colors: active)`
 * (A§6.6). In any other context they would hard-code a colour outside the Tecton tokens.
 */
const SYSTEM_COLORS = [
  'AccentColor',
  'AccentColorText',
  'ActiveText',
  'ButtonBorder',
  'ButtonFace',
  'ButtonText',
  'Canvas',
  'CanvasText',
  'Field',
  'FieldText',
  'GrayText',
  'Highlight',
  'HighlightText',
  'LinkText',
  'Mark',
  'MarkText',
  'SelectedItem',
  'SelectedItemText',
  'VisitedText',
  // Deprecated system colours.
  'ActiveBorder',
  'ActiveCaption',
  'AppWorkspace',
  'Background',
  'ButtonHighlight',
  'ButtonShadow',
  'CaptionText',
  'InactiveBorder',
  'InactiveCaption',
  'InactiveCaptionText',
  'InfoBackground',
  'InfoText',
  'Menu',
  'MenuText',
  'Scrollbar',
  'ThreeDDarkShadow',
  'ThreeDFace',
  'ThreeDHighlight',
  'ThreeDLightShadow',
  'ThreeDShadow',
  'Window',
  'WindowFrame',
  'WindowText',
];
const SYSTEM_COLOR = new RegExp(`(?<![\\w-])(?:${SYSTEM_COLORS.join('|')})(?![\\w-]|\\()`, 'i');
const COLOR_FUNCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|device-cmyk)\(/i;
const HEX_COLOR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})(?![\w-])/i;

/**
 * Properties whose values are author-defined identifiers or keywords, never colours: scanning them
 * for colour words (`animation-name: red-flash`, `font-family: Orange Sans`, `grid-area: tan`) would
 * only produce false positives. Every other property is scanned for named and system colours, so a
 * colour in `mask`, `caret`, `column-rule`, `text-emphasis`, `scrollbar-color`, ... cannot slip through.
 */
const IDENTIFIER_PROPERTY =
  /^(?:-webkit-)?(?:font(?:-family|-variant(?:-.+)?|-feature-settings|-variation-settings)?|animation(?:-.+)?|transition(?:-.+)?|will-change|grid(?:-.+)?|container(?:-.+)?|view-transition-.+|anchor-name|position-anchor|position-try(?:-.+)?|counter-.+|list-style(?:-.+)?|content|quotes|src|unicode-range|timeline-scope|scroll-timeline(?:-.+)?|view-timeline(?:-.+)?|cursor)$/;

/** True when `node` sits inside `@media (forced-colors: active)` (system colours are allowed there). */
export function inForcedColors(node: CssDecl): boolean {
  return ancestors(node).some(
    (container) =>
      isAtRule(container, 'media') &&
      /(?<!not\s)\(\s*forced-colors\s*:\s*active\s*\)/i.test(normalizeParams(container.params)),
  );
}

/**
 * The first colour literal in a declaration: hex, colour functions and named colours (anywhere), and
 * system colours unless `forcedColors` says the declaration is inside `@media (forced-colors: active)`.
 * `transparent`, `currentColor`, `inherit` and friends are keywords, not literals, and pass.
 */
export function findColorLiteral(
  prop: string,
  value: string,
  forcedColors = false,
): string | undefined {
  const masked = maskValue(value);
  const hex = HEX_COLOR.exec(masked);
  if (hex) return hex[0];
  const fn = COLOR_FUNCTION.exec(masked);
  if (fn) return fn[0];
  if (prop.startsWith('--') || !IDENTIFIER_PROPERTY.test(prop.toLowerCase())) {
    // Custom property *names* inside var() are not colours: the lookbehind skips `--color-red`.
    const named = NAMED_COLOR.exec(masked);
    if (named) return named[0];
    if (!forcedColors) {
      const system = SYSTEM_COLOR.exec(masked);
      if (system) return system[0];
    }
  }
  return undefined;
}

export const noColorLiterals = plugin(
  'no-color-literals',
  {
    rejected: (literal) =>
      `Colour literal "${literal}" is not allowed in component CSS; every colour resolves to a Tecton token (var(--color-...), D-013). Only transparent, currentColor and inherit are allowed, plus CSS system colours inside @media (forced-colors: active).`,
  },
  (_options, emit) => (root) => {
    root.walkDecls((decl) => {
      const found = findColorLiteral(decl.prop, decl.value, inForcedColors(decl));
      if (found) emit(decl, 'rejected', found);
    });
  },
);

// no-px-font-size
export const noPxFontSize = plugin(
  'no-px-font-size',
  {
    rejected: (value) =>
      `Font sizes must not be in px ("${value}"); use rem or a font-size token so user font scaling works.`,
  },
  (_options, emit) => (root) => {
    root.walkDecls((decl) => {
      const prop = decl.prop.toLowerCase();
      const masked = maskValue(decl.value);
      if (/(?:^|[-_])font-size$/.test(prop)) {
        const match = /(?<![\w.-])\d*\.?\d+px(?![\w-])/i.exec(masked);
        if (match) emit(decl, 'rejected', match[0]);
      } else if (prop === 'font') {
        // `font: [style] [weight] <size>[/<line-height>] <family>`: only the size may not be px.
        const match = /(?<![\w./-])\d*\.?\d+px(?=\s*(?:\/|\s|$))/i.exec(
          masked.split('/')[0] ?? masked,
        );
        if (match) emit(decl, 'rejected', match[0]);
      }
    });
  },
);

// no-host-context
export const noHostContext = plugin(
  'no-host-context',
  {rejected: () => ':host-context() is not supported by Firefox/Safari and is never used (A§1.2).'},
  (_options, emit) => (root) => {
    root.walkRules((rule) => {
      if (/:host-context\b/i.test(rule.selector)) emit(rule, 'rejected');
    });
  },
);

// host-box-props: paint lives on inner parts (A§6.2).
const HOST_BOX_PROPERTY =
  /^(?:background(?:-.+)?|border(?:-.+)?|padding(?:-.+)?|margin(?:-.+)?|box-shadow|outline(?:-.+)?)$/i;
export const hostBoxProps = plugin(
  'host-box-props',
  {
    rejected: (prop) =>
      `"${prop}" must not be set on :host (application resets erase it); paint an inner part instead (A§6.2).`,
  },
  (_options, emit) => (root) => {
    root.walkRules((rule) => {
      if (!splitSelectors(rule.selector).some(isHostOnlySelector)) return;
      for (const node of rule.nodes ?? []) {
        if (node.type === 'decl') {
          const decl = node as CssDecl;
          if (!decl.prop.startsWith('--') && HOST_BOX_PROPERTY.test(decl.prop))
            emit(decl, 'rejected', decl.prop);
        }
      }
    });
  },
);

// host-selectors: conditions live inside :host(...); no :where() in :host(); no nested pseudo on :host().
export const hostSelectors = plugin(
  'host-selectors',
  {
    where: () => 'Do not put :where() inside :host(); it is not supported consistently (A§6.2).',
    nested: () =>
      'Put conditions inside :host(...), e.g. :host(:dir(rtl)[placement="start"]); never nest "&:pseudo" on a :host() rule (A§6.2).',
  },
  (_options, emit) => (root) => {
    root.walkRules((rule) => {
      if (/:host\([^)]*:where\(/i.test(rule.selector.replace(/\s+/g, ''))) emit(rule, 'where');
      const parent = rule.parent;
      if (
        parent &&
        isRule(parent) &&
        splitSelectors(parent.selector).some(isHostOnlySelector) &&
        splitSelectors(rule.selector).some((selector) => /^&\s*:/.test(selector))
      ) {
        emit(rule, 'nested');
      }
    });
  },
);

// layers-required + forced-colors + hover
const DEFAULT_LAYERS = ['reset', 'component', 'state', 'a11y'];

function layerOptions(secondary: Record<string, unknown> | undefined): string[] {
  const layers = secondary?.layers;
  return Array.isArray(layers) ? (layers as string[]) : DEFAULT_LAYERS;
}

export const layersRequired = plugin(
  'layers-required',
  {
    unlayered: (layers) =>
      `Every rule must live inside one of the layers: ${layers}. Unlayered rules are forbidden (A§6.1).`,
    unknownLayer: (name, layers) => `Layer "${name}" is not allowed; use ${layers}.`,
  },
  (secondary, emit) => (root) => {
    const layers = layerOptions(secondary);
    const list = layers.join(', ');
    root.walkAtRules((atRule) => {
      if (atRule.name.toLowerCase() !== 'layer') return;
      const names = normalizeParams(atRule.params)
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);
      for (const name of names) {
        if (!layers.includes(name)) emit(atRule, 'unknownLayer', name, list);
      }
    });
    root.walkRules((rule) => {
      const chain = ancestors(rule);
      if (chain.some((node) => isAtRule(node) && /keyframes$/i.test(node.name))) return;
      const layered = chain.some(
        (node) => isAtRule(node, 'layer') && layers.includes(normalizeParams(node.params)),
      );
      if (!layered) emit(rule, 'unlayered', list);
    });
  },
);

export const forcedColorsInA11yLayer = plugin(
  'forced-colors-in-a11y-layer',
  {rejected: () => '@media (forced-colors) rules belong inside @layer a11y (A§6.6).'},
  (secondary, emit) => (root) => {
    const layer = typeof secondary?.layer === 'string' ? secondary.layer : 'a11y';
    root.walkAtRules((atRule) => {
      if (atRule.name.toLowerCase() !== 'media' || !/forced-colors/i.test(atRule.params)) return;
      const inLayer = ancestors(atRule).some(
        (node) => isAtRule(node, 'layer') && normalizeParams(node.params) === layer,
      );
      if (!inLayer) emit(atRule, 'rejected');
    });
  },
);

export const hoverInMedia = plugin(
  'hover-in-media',
  {
    rejected: () =>
      ':hover rules must be inside @media (hover: hover) so touch devices never get sticky hover (A§6.2).',
  },
  (_options, emit) => (root) => {
    root.walkRules((rule) => {
      if (!/:hover\b/i.test(rule.selector)) return;
      const guarded = ancestors(rule).some(
        (node) => isAtRule(node, 'media') && /\(\s*hover\s*:\s*hover\s*\)/i.test(node.params),
      );
      if (!guarded) emit(rule, 'rejected');
    });
  },
);

// logical-properties
const LOGICAL_HINTS: Record<string, string> = {
  left: 'inset-inline-start',
  right: 'inset-inline-end',
  top: 'inset-block-start',
  bottom: 'inset-block-end',
  width: 'inline-size',
  height: 'block-size',
  'min-width': 'min-inline-size',
  'min-height': 'min-block-size',
  'max-width': 'max-inline-size',
  'max-height': 'max-block-size',
  'overflow-x': 'overflow-inline',
  'overflow-y': 'overflow-block',
  'border-top-left-radius': 'border-start-start-radius',
  'border-top-right-radius': 'border-start-end-radius',
  'border-bottom-left-radius': 'border-end-start-radius',
  'border-bottom-right-radius': 'border-end-end-radius',
};
for (const [family, logical] of [
  ['margin', 'margin'],
  ['padding', 'padding'],
  ['scroll-margin', 'scroll-margin'],
  ['scroll-padding', 'scroll-padding'],
  ['border', 'border'],
] as const) {
  LOGICAL_HINTS[`${family}-left`] = `${logical}-inline-start`;
  LOGICAL_HINTS[`${family}-right`] = `${logical}-inline-end`;
  LOGICAL_HINTS[`${family}-top`] = `${logical}-block-start`;
  LOGICAL_HINTS[`${family}-bottom`] = `${logical}-block-end`;
}
for (const suffix of ['width', 'style', 'color']) {
  LOGICAL_HINTS[`border-left-${suffix}`] = `border-inline-start-${suffix}`;
  LOGICAL_HINTS[`border-right-${suffix}`] = `border-inline-end-${suffix}`;
  LOGICAL_HINTS[`border-top-${suffix}`] = `border-block-start-${suffix}`;
  LOGICAL_HINTS[`border-bottom-${suffix}`] = `border-block-end-${suffix}`;
}

export const logicalProperties = plugin(
  'logical-properties',
  {
    property: (prop, logical) =>
      `Physical property "${prop}"; use "${logical}" (RTL support), or justify with a preceding "/* physical: reason */" comment.`,
    value: (prop, value) =>
      `Physical value "${prop}: ${value}"; use start/end, or justify with a "/* physical: reason */" comment.`,
  },
  (_options, emit) => (root) => {
    root.walkDecls((decl) => {
      if (decl.prop.startsWith('--')) return;
      const prop = decl.prop.toLowerCase();
      const hint = LOGICAL_HINTS[prop];
      const value = decl.value.trim().toLowerCase();
      const physicalValue =
        (prop === 'text-align' && /^(?:left|right)$/.test(value)) ||
        ((prop === 'float' || prop === 'clear') && /^(?:left|right)$/.test(value));
      if (!hint && !physicalValue) return;
      if (hasPhysicalComment(decl)) return;
      if (hint) emit(decl, 'property', decl.prop, hint);
      else emit(decl, 'value', decl.prop, decl.value.trim());
    });
  },
);

// known-custom-properties
function readTokenNames(file: string): Set<string> | undefined {
  if (!existsSync(file)) return undefined;
  try {
    const json = JSON.parse(readFileSync(file, 'utf8')) as unknown;
    const names: unknown[] = Array.isArray(json)
      ? json
      : typeof json === 'object' &&
          json !== null &&
          Array.isArray((json as {names?: unknown}).names)
        ? (json as {names: unknown[]}).names
        : typeof json === 'object' && json !== null
          ? Object.keys(json)
          : [];
    return new Set(
      names
        .filter((name): name is string => typeof name === 'string')
        .map((name) => (name.startsWith('--') ? name : `--${name}`)),
    );
  } catch {
    return undefined;
  }
}

/** `@cssprop --name` tags in the sibling class file `tct-x.ts` of `tct-x.styles.css`. */
function readOwnCssProps(cssFile: string | undefined): Set<string> {
  const names = new Set<string>();
  if (!cssFile) return names;
  const ts = cssFile.replace(/\.(?:styles|light)\.css$/, '.ts');
  if (ts === cssFile || !existsSync(ts)) return names;
  for (const match of readFileSync(ts, 'utf8').matchAll(/@cssprop\s+(?:\{[^}]*\}\s*)?(--[\w-]+)/g))
    names.add(match[1]!);
  return names;
}

export const DEFAULT_TOKEN_NAMES_FILE = 'packages/tokens/snapshots/token-names.json';

export const knownCustomProperties = plugin(
  'known-custom-properties',
  {
    rejected: (name) =>
      `Unknown custom property "${name}". Use a token, one of this component's @cssprop names, or a private "--_<component>-*" property.`,
  },
  (secondary, emit) => (root) => {
    const inline = secondary?.tokenNames;
    const file =
      typeof secondary?.tokenNamesFile === 'string'
        ? secondary.tokenNamesFile
        : DEFAULT_TOKEN_NAMES_FILE;
    const path = isAbsolute(file) ? file : resolve(process.cwd(), file);
    const tokens = Array.isArray(inline)
      ? new Set((inline as string[]).map((name) => (name.startsWith('--') ? name : `--${name}`)))
      : readTokenNames(path);
    // Until milestone M2 emits the token-name snapshot there is no reference set: nothing to enforce.
    if (!tokens) return;

    const own = readOwnCssProps(root.source?.input.file);
    const declared = new Set<string>();
    root.walkDecls((decl) => {
      if (decl.prop.startsWith('--')) declared.add(decl.prop);
    });

    root.walkDecls((decl) => {
      for (const match of maskValue(decl.value).matchAll(/var\(\s*(--[\w-]+)/g)) {
        const name = match[1]!;
        if (name.startsWith('--_') || tokens.has(name) || own.has(name) || declared.has(name))
          continue;
        emit(decl, 'rejected', name);
      }
    });
  },
);

export const plugins = [
  noPaletteVars,
  noImport,
  noColorLiterals,
  noPxFontSize,
  noHostContext,
  hostBoxProps,
  hostSelectors,
  layersRequired,
  forcedColorsInA11yLayer,
  hoverInMedia,
  logicalProperties,
  knownCustomProperties,
];
