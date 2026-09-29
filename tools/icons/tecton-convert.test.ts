import {describe, expect, it} from 'vitest';
import {renderIconModule, renderRegistry, type TectonIconData} from './extract-tecton.ts';
import {
  conicGradientFan,
  convertGlyph,
  DEFAULT_FAN,
  gradientColor,
  parseConicGradient,
  parseMarkup,
  parsePolygon,
} from './tecton-convert.ts';

describe('parseMarkup', () => {
  it('parses nested elements with quoted attributes, self-closing tags and empty tags', () => {
    const tree = parseMarkup(
      '<g clip-path="url(#a)"><path d="M0 0H1"></path><rect width="2" height="3"/></g><defs><clipPath id="a"><rect width="16" height="16" fill="white"></rect></clipPath></defs>',
    );
    expect(tree.map((node) => node.tag)).toEqual(['g', 'defs']);
    expect(tree[0]!.attrs).toEqual({'clip-path': 'url(#a)'});
    expect(tree[0]!.children.map((node) => node.tag)).toEqual(['path', 'rect']);
    expect(tree[1]!.children[0]!.children[0]!.attrs.fill).toBe('white');
  });

  it('rejects stray text and unbalanced tags', () => {
    expect(() => parseMarkup('<path d="M0 0"></path>oops')).toThrow(/text/);
    expect(() => parseMarkup('<g><path d="M0 0"></g>')).toThrow(/unbalanced/);
    expect(() => parseMarkup('<g>')).toThrow(/unclosed/);
  });
});

describe('convertGlyph: the exact route', () => {
  const view = '1 1 14 14';

  it('keeps path data verbatim, in order, with fill-rule (clip-rule is dropped)', () => {
    const glyph = convertGlyph(
      '<path fill-rule="evenodd" clip-rule="evenodd" d="M1.5 2L3 4Z"></path><path d="M5 5H6V6Z"></path>',
      view,
    );
    expect(glyph).toEqual({
      paths: [{d: 'M1.5 2L3 4Z', fillRule: 'evenodd'}, {d: 'M5 5H6V6Z'}],
    });
    expect(glyph.svg).toBeUndefined();
  });

  it('converts <rect> to an equivalent path, plain and rounded', () => {
    expect(convertGlyph('<rect x="3" y="4" width="18" height="2"/>', view).paths).toEqual([
      {d: 'M3 4h18v2h-18z'},
    ]);
    expect(
      convertGlyph('<rect x="8" y="8" width="14" height="14" rx="2" ry="2"/>', view).paths[0]!.d,
    ).toBe('M10 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-10a2 2 0 0 1 2 -2z');
  });

  it('flattens simple <g> wrappers and lets a group pass its fill-rule down', () => {
    const glyph = convertGlyph(
      '<g><path d="M0 0H1V1Z"></path><g fill-rule="evenodd"><path d="M2 2H3V3Z"></path><path fill-rule="nonzero" d="M4 4H5V5Z"></path></g></g>',
      view,
    );
    expect(glyph.paths).toEqual([
      {d: 'M0 0H1V1Z'},
      {d: 'M2 2H3V3Z', fillRule: 'evenodd'},
      {d: 'M4 4H5V5Z'},
    ]);
  });

  it('drops a clip that clips nothing (a rect covering the viewBox), and its <defs>', () => {
    const glyph = convertGlyph(
      '<g clip-path="url(#c)"><path d="M2 2H3V3Z"></path></g><defs><clipPath id="c"><rect width="16" height="16" fill="white"></rect></clipPath></defs>',
      view,
    );
    expect(glyph).toEqual({paths: [{d: 'M2 2H3V3Z'}]});
  });

  it('refuses what it cannot convert exactly rather than shipping it wrong', () => {
    expect(() => convertGlyph('<circle cx="1" cy="1" r="1"/>', view)).toThrow(
      /unsupported element/,
    );
    expect(() => convertGlyph('<path d="M0 0" opacity="0.5"/>', view)).toThrow(/opacity/);
    expect(() =>
      convertGlyph('<g transform="matrix(1 0 0 1 2 2)"><path d="M0 0"/></g>', view),
    ).toThrow(/transformed/);
    expect(() =>
      convertGlyph(
        '<g clip-path="url(#c)"><path d="M2 2H3V3Z"></path></g><defs><clipPath id="c"><rect width="4" height="4"></rect></clipPath></defs>',
        view,
      ),
    ).toThrow(/clip/);
    expect(() => convertGlyph('<g clip-path="url(#missing)"><path d="M0 0"/></g>', view)).toThrow(
      /clip-path/,
    );
    expect(() => convertGlyph('', view)).toThrow(/no shapes/);
  });

  it('a per-path colour needs the raw SVG body (and keeps the outline paths as the fallback)', () => {
    const glyph = convertGlyph(
      '<path d="M0 0H1V1Z"></path><path fill="#ff0000" d="M2 2H3V3Z"></path>',
      view,
    );
    expect(glyph.colored).toBe(true);
    expect(glyph.paths).toEqual([{d: 'M0 0H1V1Z'}]);
    expect(glyph.svg).toBe(
      '<path d="M0 0H1V1Z" fill="currentColor"/><path d="M2 2H3V3Z" fill="#ff0000"/>',
    );
  });
});

describe('conic gradient', () => {
  const css =
    'background:conic-gradient(from 90deg,rgba(153, 87, 190, 1) 0deg,rgba(200, 16, 46, 1) 180deg,rgba(246, 143, 31, 1) 270deg,rgba(153, 87, 190, 1) 360deg);height:100%;width:100%;opacity:1';

  it('parses the CSS the design export writes', () => {
    const gradient = parseConicGradient(css);
    expect(gradient.from).toBe(90);
    expect(gradient.stops.map((stop) => stop.at)).toEqual([0, 180, 270, 360]);
    expect(gradient.stops[1]!.rgb).toEqual([200, 16, 46]);
  });

  it('rejects gradients it cannot reproduce', () => {
    expect(() => parseConicGradient('background:red')).toThrow(/no conic-gradient/);
    expect(() =>
      parseConicGradient('background:conic-gradient(rgba(1,2,3,0.5) 0deg, red 360deg)'),
    ).toThrow();
    expect(() =>
      parseConicGradient('background:conic-gradient(rgba(1,2,3,1) 10deg,rgba(1,2,3,1) 360deg)'),
    ).toThrow(/span 0deg/);
  });

  it('interpolates piecewise in sRGB', () => {
    const {stops} = parseConicGradient(css);
    expect(gradientColor(stops, 0)).toEqual([153, 87, 190]);
    expect(gradientColor(stops, 90)).toEqual([176.5, 51.5, 118]);
    expect(gradientColor(stops, 360)).toEqual([153, 87, 190]);
  });

  describe('fan', () => {
    // A square clip around the centre, an identity-like transform: gradient box is a 2x2 square at the origin.
    const box = {x: -1, y: -1, width: 2, height: 2};
    const identity: [number, number, number, number, number, number] = [1, 0, 0, 1, 5, 5];
    const square: [number, number][] = [
      [3, 3],
      [7, 3],
      [7, 7],
      [3, 7],
    ];
    const gradient = parseConicGradient(css);

    it('paints the underlay first, then the top layer, as closed polygons from the centre', () => {
      const {wedges} = conicGradientFan(gradient, identity, box, square, DEFAULT_FAN);
      expect(wedges.length).toBeGreaterThan(50);
      for (const wedge of wedges) {
        expect(wedge.d).toMatch(/^M5 5L[\d. L-]+Z$/);
        expect(wedge.fill).toMatch(/^#[0-9a-f]{6}$/);
      }
      // Underlay (coarse) wedges come first: fewer than the top layer's.
      const withoutUnderlay = conicGradientFan(gradient, identity, box, square, {
        ...DEFAULT_FAN,
        underlay: null,
      });
      expect(withoutUnderlay.wedges.length).toBeLessThan(wedges.length);
      expect(wedges.slice(-withoutUnderlay.wedges.length)).toEqual(withoutUnderlay.wedges);
    });

    it('starts where CSS starts (from 90deg = pointing right) and reaches the clip boundary', () => {
      const {wedges} = conicGradientFan(gradient, identity, box, square, {
        ...DEFAULT_FAN,
        underlay: null,
      });
      // Wedge 0 begins on the ray towards +x, which meets the square at (7, 5), in the start colour.
      expect(wedges[0]!.d.startsWith('M5 5L7 5')).toBe(true);
      const near = (fill: string, expected: number[]) =>
        [1, 3, 5].every(
          (i, k) => Math.abs(Number.parseInt(fill.slice(i, i + 2), 16) - expected[k]!) <= 3,
        );
      expect(near(wedges[0]!.fill, [153, 87, 190])).toBe(true); // the 0deg stop, within one step
      // The last wedge ends on that same ray, back at the start colour.
      expect(wedges[wedges.length - 1]!.d.endsWith('L7 5Z')).toBe(true);
      expect(near(wedges[wedges.length - 1]!.fill, [153, 87, 190])).toBe(true);
    });

    it('quantises colour: no wedge differs from its neighbour by more than the step', () => {
      const {wedges} = conicGradientFan(gradient, identity, box, square, {
        maxColorStep: 4,
        underlay: null,
      });
      const channels = (fill: string) =>
        [1, 3, 5].map((i) => Number.parseInt(fill.slice(i, i + 2), 16));
      for (let i = 1; i < wedges.length; i++) {
        const [a, b] = [channels(wedges[i - 1]!.fill), channels(wedges[i]!.fill)];
        expect(Math.max(...a.map((value, k) => Math.abs(value - b[k]!)))).toBeLessThanOrEqual(5);
      }
    });

    it('refuses a centre outside the clip polygon', () => {
      expect(() =>
        conicGradientFan(gradient, [1, 0, 0, 1, 50, 50], box, square, {
          ...DEFAULT_FAN,
          underlay: null,
        }),
      ).toThrow(/not inside/);
    });
  });
});

describe('generated modules', () => {
  const icon: TectonIconData = {
    name: 'demo',
    label: 'Demo',
    description: 'a demo',
    viewBox: '1 1 14 14',
    outlined: '<path d="M0 0H1V1Z"></path>',
    filled: '<path d="M0 0H1V1Z"></path>',
  };
  const commit = 'a'.repeat(40);

  it('writes outlined, filled and a default; identical variants share one object', () => {
    const glyph = convertGlyph(icon.outlined, icon.viewBox);
    const text = renderIconModule(icon, glyph, glyph, commit);
    expect(text).toContain(`GENERATED by tools/icons/extract-tecton.ts`);
    expect(text).toContain(commit);
    expect(text).toContain(
      `export const outlined: IconDefinition = {viewBox: "1 1 14 14", paths: [{d: "M0 0H1V1Z"}], mode: 'fill'};`,
    );
    expect(text).toContain('export const filled: IconDefinition = outlined;');
    expect(text).toContain('export default outlined;');
  });

  it('writes a distinct filled variant, with fillRule and svg when present', () => {
    const outlined = convertGlyph(icon.outlined, icon.viewBox);
    const filled = convertGlyph(
      '<path fill-rule="evenodd" fill="#00ff00" d="M0 0H2V2Z"></path>',
      icon.viewBox,
    );
    const text = renderIconModule(icon, outlined, filled, commit);
    expect(text).not.toContain('= outlined;\n\nexport default');
    expect(text).toContain(
      `svg: "<path d=\\"M0 0H2V2Z\\" fill=\\"#00ff00\\" fill-rule=\\"evenodd\\"/>"`,
    );
    expect(text).toContain('colored: true');
  });

  it('registers <name> and <name>-filled as lazy loaders, plus metadata', () => {
    const text = renderRegistry([icon], commit);
    expect(text).toContain(
      `"demo": () => import('./tecton/demo.js').then((module) => module.outlined),`,
    );
    expect(text).toContain(
      `"demo-filled": () => import('./tecton/demo.js').then((module) => module.filled),`,
    );
    expect(text).toContain('export type TectonIconName = keyof typeof tectonIcons;');
    expect(text).toContain('"demo": {label: "Demo", description: "a demo", colored: false},');
  });
});

describe('parsePolygon', () => {
  it('reads absolute M/L/H/V/Z and drops the closing duplicate', () => {
    expect(
      parsePolygon('M8.31667 8.83333L1 4.91667L8.31667 1L15.65 4.91667L8.31667 8.83333Z'),
    ).toEqual([
      [8.31667, 8.83333],
      [1, 4.91667],
      [8.31667, 1],
      [15.65, 4.91667],
    ]);
    expect(parsePolygon('M0 0H4V4H0Z')).toEqual([
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ]);
    expect(() => parsePolygon('M0 0L1 1')).toThrow(/polygon/);
    expect(() => parsePolygon('M0 0L1 1L2 0ZM5 5L6 6L7 5Z')).toThrow(/sub-paths/);
  });
});
