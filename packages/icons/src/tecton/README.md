# Tecton domain icons

Eighteen oil & gas / subsurface glyphs, each with an `outlined` and a `filled` variant: `christmas-tree`,
`drill-bit`, `fault`, `geobodies`, `geostructure`, `horizon`, `log-curve`, `oil-rig-offshore`,
`rock-formations`, `seismic`, `strata`, `surface`, `trajectory`, `valve`, `velocity-model`, `well`,
`well-pick`, `well-plan`.

## Provenance

- **Owner-supplied.** The set is the owner's own Tecton design work (decision D-013, Q-02). It is not
  third-party material, so `THIRD-PARTY-NOTICES.md` has no entry for it. The library itself is unlicensed
  (D-008); nothing here is published.
- **Origin.** `rpkapps/tecton-webcomponents`, branch `claude/busy-johnson-0wz57h`,
  `packages/wc/src/icons/`, commit `8b119b84ec4b912eceebb9f220218346596c6407` (recorded in
  [`glyphs/SOURCE-COMMIT`](glyphs/SOURCE-COMMIT); a read-only copy lives at `/home/user/refs/tecton-icons`).
- The larger 131-glyph set of the owner's earlier React theme is **not** used (D-013). Lucide stays the general-purpose set
  and the source of the Astryx role names (D-009).

## Layout

| Path                                   | Kind                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `glyphs/<name>.ts`, `glyphs/types.ts`  | **Authored source.** The owner's data, copied verbatim (only Prettier formatting differs) plus a provenance header. |
| `<name>.ts` (this folder, gitignored)  | Generated `IconDefinition` module: `outlined`, `filled`, default = outlined.                                  |
| `../tecton.ts` (gitignored)            | Generated `tectonIcons` lazy loaders (`<name>`, `<name>-filled`), `tectonIconNames`, `tectonIconMeta`.         |

`pnpm generate` runs `tools/icons/extract-tecton.ts`, which converts every glyph with
`tools/icons/tecton-convert.ts`. To update a glyph, replace its file in `glyphs/`, update `SOURCE-COMMIT` and
each file's header, and regenerate.

## Use

The default icon set (`@tecton-wc/icons/default.js`) registers all 36 names, so
`<tct-icon name="well">` and `<tct-icon name="well-filled">` work with no registration. Per-icon modules are
importable on their own:

```ts
import well, {filled as wellFilled} from '@tecton-wc/icons/tecton/well.js';
import {tectonIcons} from '@tecton-wc/icons/tecton.js'; // lazy loaders, e.g. for a namespace
```

## Conversion

The authored markup is converted to the `IconDefinition` shape of ARCHITECTURE §12 (`mode: 'fill'`, the glyph's
own `viewBox`):

- Plain `<path>` elements keep their `d` (and `fill-rule`) exactly. `<rect>` and simple `<g>` wrappers are
  converted or flattened exactly. A clip that clips nothing (a `<rect>` covering the viewBox, as the design tool
  exports around every frame) is dropped. Seventeen of the eighteen glyphs take this route, and their
  rendering is pixel-identical to the original markup (`packages/icons/src/tecton.test.ts`).
- Fourteen glyphs (`strata` included) draw the same shapes in both variants, so `filled` is the same object as
  `outlined`.
- **`strata`** is the exception. Its top layer is a CSS `conic-gradient()` drawn through `<foreignObject>`
  (purple, red, orange, back to purple); `<defs>`, clip paths, `style` and `<foreignObject>` cannot be
  expressed as paths, and the sanitiser the registry applies to raw SVG (ARCHITECTURE §12) removes `style` and
  unsafe elements such as `<foreignObject>`, so the original markup cannot be registered as it is. The
  generator therefore re-expresses the gradient as a fan of flat-coloured wedges in a raw SVG body, the
  optional `IconDefinition.svg` field (`<path d fill fill-rule>` elements only, and `colored: true`).
  `paths` keeps the single-colour outline as a fallback for renderers that ignore `svg`. This is an
  approximation of the gradient, not an identity; the browser test bounds the difference from the original
  (mean 1.7 levels over painted pixels at 96 px, 3.9 at 48 px, Chromium 141).
- The lower two layers of `strata` stay `currentColor`; only the top layer carries its own colours.
