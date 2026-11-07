# Case Builder

Local-first electronics enclosure designer. Builds a symmetric trapezoid with a **10° total included angle (±5° top/bottom)**, printed shell and recessed plate, and wooden end caps.

## Run locally

```sh
pnpm install
pnpm dev
```

Open http://127.0.0.1:5173/ . Requires a modern browser with WebAssembly; the optional orbit preview also needs WebGL.

## First test

1. Add rectangles/circles on **Control surface**; select and edit their dimensions in millimeters. Drag on a 1 mm grid; Shift-click for multiple selection. Use Copy/Paste, Group/Ungroup, or Repeat selection.
2. Save selected cutouts to the component library. Insert the same component on **Back**. Library entries are embedded in this project, not shared through a server.
3. Change rear height, footprint, total angle, wall/plate thickness, cap overhang and corner style. Choose automatic dimensions to derive the footprint from cutout extents and padding.
4. Inspect **Assembly**. Drag to rotate; scroll to zoom; toggle exploded view. Appearance includes plastic color and four procedural wood textures.
5. Review **Manufacturing**, then export the ZIP. It includes print-oriented STL files, cutout SVG/DXF files, a one-cap GRBL program, a setup README, and self-contained project JSON.
6. Download **Save project**, then reload it using **Open project**. Browser local storage is convenient but is not a backup.

Rectangle/circle sizes are cutout dimensions, not verified physical component models. The library starts empty pending actual hardware dimensions from the user. Decorative wood edge bevels, per-cutout bevels, clamp fixtures, and multi-user accounts are outside this initial build. Pattern copies are independent after generation, not live constraint-linked arrays.

## Manufacturing limits

- Configured printer envelope is the user's conservative 250 × 250 × 250 mm. Oversized shell exports are blocked.
- Profile front height must remain at least 22 mm for screw rails. Hardware margin is reserved around each layout.
- Plastic tap bores 2.5 mm. End-cap clearance holes 3.4 mm, cylindrical socket-head recesses 6 mm × 3 mm. Bottom countersinks are nominal 90°, 6.4 mm diameter. Check actual chosen hardware and print tolerances before production.
- CAM uses tape workholding only, one cap per setup. No machine has been run. Feed settings are provisional. Review the exported setup sheet and simulate/air-cut before cutting.

## Development

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm security:all
```

`src/model.ts`: versioned project data and validation. `src/geometry.ts`: shared Manifold solids. `src/cam.ts`: isolated Masuter postprocessor. `src/export.ts`: STL/SVG/DXF/JSON/ZIP. `src/main.ts`: editor. `src/preview.ts`: Three.js assembly.

Cloudflare Workers assets deployment is configured in `wrangler.jsonc`. No database, accounts or backend API is required for this local-first MVP. Account selection and outward-facing deployment/push approval remain pending under the user's Workers conventions. Authenticated Snyk SCA/SAST are release gates; CI does not hold credentials or deploy automatically.
