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
