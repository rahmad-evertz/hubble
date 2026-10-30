# Liquid glass style

A second visual style for Hubble, modelled on iOS liquid glass, selectable
alongside the existing one. Classic stays exactly as it is.

## Decisions

| Question         | Decision                                                                              |
| ---------------- | ------------------------------------------------------------------------------------- |
| Replace or add   | Add. Classic is unchanged and remains the default.                                    |
| Light and dark   | Independent of style. Style is Classic or Liquid glass; mode stays Auto, Light, Dark. |
| Behind the glass | A colourful drifting wallpaper, replacing the star field in Glass only.               |
| Rendering        | CSS glass everywhere, plus SVG edge lensing on Chromium for the header and tab bar.   |

## Switching

- Settings gains a **Style** field with two options, Classic and Liquid glass.
  It applies on Save, like every other field there.
- The header's Auto / Light / Dark button is unchanged and works in both styles.
- Persisted as `hubble.style` (`'classic' | 'glass'`, default `'classic'`)
  through `lib/storage`.
- Stamped on `<html>` as `data-style`. The pre-paint script in `index.html`
  stamps it before first paint, the same way it stamps `data-theme`, so a saved
  Glass choice never flashes Classic.

## Look

**Wallpaper.** Large soft radial blobs of blue, purple and warm orange on
`body::before` and `body::after`, drifting slowly. Saturated and deep in dark
mode, pastel in light mode. Replaces the star field and nebula when
`data-style='glass'`.

**Singleton surfaces** (header, tab bar, PR list panel, modals, Settings, setup
card): translucent fill, strong `backdrop-filter` blur with boosted saturation,
a bright specular highlight on the top edge, a faint inner glow, and 18 to 24px
radii. Header and tab bar also get edge lensing where supported. Modals do
not: Chromium stops painting a url() backdrop-filter during a 3D transform,
which blanked the PR dialog during its Z entry.

**Repeated surfaces** (deck cards, table rows, diff files, notification rows):
a lighter translucent tint and the same edge highlight, with no blur of their
own. They sit on a blurred panel, which carries the glass. This follows the
existing rule in `index.css` that blur is only for surfaces that exist once on
screen.

**Controls.** Buttons, tabs and badges become pills. The selected tab is a
raised glass lozenge rather than today's underline.

**Contrast.** Surface opacity is chosen so body text keeps at least 4.5:1
against the surface composited over the brightest part of the wallpaper, in
both modes.

## Structure

- `src/hooks/useStyle.ts`: `Style` type, pure `resolveStyle(stored)` that
  rejects unknown values to `'classic'`, and `useStyle()` returning
  `[style, setStyle]`. Mirrors `useTheme`.
- `src/glass.css`: imported after `index.css` in `main.tsx`. Every rule is
  scoped under `:root[data-style='glass']`. Mostly overrides of existing tokens
  (`--glass-*`, `--radius`, `--bg*`, `--blur-*`, `--elev-*`, the nebula and
  star tokens), plus the rules that tokens cannot express: pill tabs, specular
  edges, wallpaper keyframes, lens hookup.
- `index.html`: the pre-paint script also stamps `data-style`, and an inline,
  zero-size SVG defines `<filter id="hub-lens">`, a displacement map that pushes
  the backdrop outward near a surface's edges.
- Lens activation: Chromium only, detected in `useStyle` via
  `navigator.userAgentData?.brands` containing `Chromium`, which sets
  `data-lens="on"` on `<html>`. Not `@supports`: Safari parses
  `backdrop-filter: url(#hub-lens)` and then renders nothing, which would drop
  the blur as well. The lens rule lists blur and the url() filter together so a
  surface never ends up with neither.
- `App.tsx` calls `useStyle()` and passes the style and setter to `Settings`.

## Fallbacks

- **Safari, Firefox:** CSS glass without lensing.
- **`prefers-reduced-transparency: reduce`:** surfaces near-opaque, wallpaper
  dimmed.
- **`prefers-reduced-motion: reduce`:** wallpaper stops, through the existing
  `--anim-*` tokens in the reduced-motion block.
- **Containing block rule:** no `backdrop-filter`, `filter`, `transform` or
  `perspective` on `html`, `body`, `.app` or `.main`. These would make the
  element the containing block for the fixed `.modal-backdrop` and break both
  modals on long pages.

## Testing

- `useStyle.test.ts`: `resolveStyle` accepts both values, maps unknown and
  missing values to `'classic'`; lens detection is true only for a Chromium
  brand.
- `cssContract.test.ts` reads `glass.css` as well as `index.css`, and gains one
  assertion: no `backdrop-filter`, `filter`, `transform` or `perspective` in a
  rule whose selector targets `html`, `body`, `.app` or `.main` (pseudo-elements
  excluded).
- Manual: Chrome and Firefox, light and dark, with reduced motion and reduced
  transparency each enabled; open a PR modal and Settings on a long page. Safari
  needs one check on a Mac or iPhone, which cannot be done from the Linux
  development machine.

## Out of scope

Changes to Classic, new dependencies, WebGL, and any change to data fetching or
content.
