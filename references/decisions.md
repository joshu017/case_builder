# Decisions and assumptions

## Confirmed
- 10 degrees TOTAL, symmetric trapezoid, ±5 degrees about the centerline. This correction supersedes any earlier interpretation of the Takachi page.
- Adjustable rear exterior height, 50 mm default; recessed flush bottom plate; adjustable wooden cap overhang down to 0.
- Stock Masuter, 6 mm wood, 1/16 or 1/8 inch flat end mills, tape for initial tests.
- Local storage and self-contained JSON projects including custom components, no accounts.

## Implementation choices for first test
- 180 x 110 mm starting plastic footprint; 3 mm walls/plate; 1.5 mm cap overhang.
- Four end-cap socket-head screws, 3.4 mm clearance bores, 6 mm diameter x 3 mm deep head recesses. These hardware dimensions are editable in code and must be checked against the selected physical screws before production.
- 12 mm protected layout margin to reserve hardware and shell attachment space.
- Tape-only CAM initially. Clamping requires a later fixture/keepout and retention strategy; do not relabel the tape program.
- Feed 250 mm/min, plunge 80 mm/min, stepdown 0.5 mm are provisional test inputs, not validated wood-specific machining recipes.
- End caps machined separately with outside face upward; same symmetric part works on either end. No tool change or decorative edge bevel operation.
- Browser-local geometry avoids a CAD server and keeps projects self-contained. No backend API is needed yet.

## Pending deployment
- Select Cloudflare account; pass authenticated Snyk dependency/code scans; review local build before requesting push/deploy approval under ~/workers instructions.

## First test build

Implemented: two layout editors, rectangle/circle primitives, selection/grouping/copy/paste, independent row/grid repetition, project component library, local save and JSON import/export, symmetric parametric solid model, hardware clearances and dedicated bottom bosses, corner styles, cap overhang, interactive assembly/exploded preview, procedural wood appearance, printable STL orientation, SVG/DXF cutouts, tape-only Masuter end-cap CAM and ZIP packaging.

The hardware margin is dynamic (at least 12 mm, larger for thicker walls/corners). Bottom screw centers move inward with wall thickness so their countersinks stay within the plate. Printable geometries have mathematical checks; physical commissioning remains separate. See validation.md for actual test coverage.

## Reinforcement revision — 2026-11-07

User requested internal chamfers at the screw-rail/wall junctions to match the reference. The shell now includes continuous 45-degree webs on both sides of each rail's front/rear wall connection, plus the upper rails' control-surface connections. Webs overlap the faceted cylinders and wall to avoid tangent-only seams and trapped cavities. The existing exterior, pilot centers, caps and bottom recess remain driven by the same parameters. Dynamic protected layout margin is now at least 18 mm to reserve space for reinforcement.

## Reduced reinforcement and M3x6 bottom screws — 2026-11-07

The user rejected the large tangent braces as too bulky. Replace them with 1.25 mm chamfers at the existing wall/cylinder intersections; reserve a minimum 13 mm hardware margin. Small bonded overlaps prevent disconnected slivers and internal cavities. This supersedes the earlier full tangent-web design.

The user's bottom screw photo specifies M3x6 flathead but no head diameter/angle. Retain the 90-degree, 6.4 mm mouth / 3.4 mm bore / 1.5 mm deep exterior countersinks and make the hardware preview conical with 6 mm overall length. Existing STL seats were already countersunk; the old preview's cylindrical heads were misleading. Nominal default engagement is 6 - 3 - 0.25 = 2.75 mm. Warn on thicker plates to select longer screws. Actual fit remains unverified without the hardware dimensions/print test.

Manufacturer references confirm head sizes vary: https://www.accu.co.uk/phillips-countersunk-screws/989273-SIK-M3-6-CS-BZP lists a 90-degree head and 5.6 mm diameter; https://www.accu.co.uk/countersunk-socket-head-screws/770509-ZF602M3X6-LOW lists 6 mm diameter. These are references for the assumption, not identification of the photographed screw.

## Both cap manufacturing formats — 2026-11-07

User selected always including printable end caps alongside the existing CNC program, with no mode selector. ZIP now contains end-cap-left.stl and end-cap-right.stl in addition to extrusion.stl, bottom-plate.stl and end-cap.nc. Caps use existing assembly geometry and thickness/overhang/hole settings, rotated flat with the inner face on the bed and head recesses upward. The existing wood thickness setting also controls printed cap thickness. End-cap printer bounds are checked separately. Export regression tests reconstruct both STL meshes and verify volume, thickness, minimum Z, and upward-open recesses at three thicknesses.

## MCP on the existing Worker

- User approved adding LLM-assisted design through the same Worker after reviewing the proposed stateless design.
- Implement seven tools: create_project, update_enclosure, place_component, replace_layout, validate_project, preview_project, export_package. Use existing project/geometry/CAM/export code.
- No accounts or persistence for MVP. Full project JSON travels with requests; embedded ZIP/SVG resources travel with responses. Browser handoff uses Open project, not live synchronization.
- Preview is dimensioned 2D SVG, not a 3D render. Cutout overlap warnings do not validate electronics bodies or wiring. This limitation is included in tool instructions/results.
- Public stateless endpoint is bounded to 256 KiB and 64 cutouts per face, plus rate limiting. Larger projects remain usable in the browser.
- Manifold precompiled WASM successfully generated a complete package in local workerd. Production validation recorded separately at release.

## wrong.rodeo interface refresh

- User requested the reference site's design system across the app: exact metal/ink/vermilion palette, Bricolage Grotesque display headings and Instrument Sans body.
- User requested a thinner banner, removing unnecessary padding and second-line subtitle. Desktop header is 54 px with ~32 px controls; save status is a compact accessible indicator.
- Latest correction supersedes keeping the old green default: NEW projects use blue-gray #71808A. Walnut stays the default cap material. Existing project colors remain unchanged.
- Controls, coordinates, geometry, project format and manufacturing workflow remain unchanged. Responsive stacked header on narrow screens is retained to keep actions usable.
