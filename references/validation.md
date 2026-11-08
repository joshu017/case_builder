# Validation — 2026-11-07

## Passed

- TypeScript typecheck and Vite production build.
- 10 automated tests covering total-angle symmetry, project/component JSON round trip and invalid import rejection, connected watertight solids for sharp/chamfer/fillet profiles, non-overlapping assembled parts, cutout plane/volume correctness, pilot-bore alignment, four/six bottom screws, zero overhang, zero angle, thin-front and protected-margin rejection, cutter compensation and bounded pass depths, GRBL initialization and rapid clearance, ZIP contents and binary STL structure, and thicker-wall/plate configurations.
- Additional geometry sampling: wall 2/6 mm, plate 2/5 mm, included angle 0/10/20 degrees at 80 mm rear height yielded connected shell and plate solids.
- Actual desktop browser: empty-state rendering, circle creation, dimension inspector, repeated four-column pattern, component save and reuse on back, assembled/exploded preview, manufacturing/toolpath display, package download, saved project import including components. No browser error logs observed.
- Downloaded ZIP inspected: project JSON contains 4 control cutouts, 1 back cutout and 1 test component; STL/SVG/DXF/CNC/setup files present.
- Wrangler deployment dry run passed. No live deployment.
- Snyk SCA with dev dependencies and high threshold: 190 dependencies, no vulnerable paths found. Snyk Code at high threshold: zero reported issues. Scans ran after final implementation changes.

## Not yet verified

- Printed fit, screw engagement, material tolerances, slicing/support behavior and actual CNC cuts/feeds.
- Clamp workholding and multi-user libraries are not implemented.
- Touch/mobile browser flows and non-WebGL fallback were not exercised.
- Per-cutout chamfering and live linked pattern parameters are not implemented; generated repetitions are editable independent copies.
- GitHub push and Cloudflare deployment are pending review/account selection per Workers conventions.

## Local editor and internal-guide refinement

- Rounded boss-footprint clipping removes the former square gusset shelf. Tests verify connected solids, plate clearance, hole alignment, and internal overhang normals across 0/10/30-degree total angles and 2/6 mm walls.
- Rounded/chamfered rectangle cutout volume is checked against expected area and exported shared contours. Decimal project fields round-trip without quantization.
- Guide tests cover connected inside-wall rings on control/back faces, expected added volume, plate clearance, offset containment and excessive height rejection. MCP workflow includes a rounded guided component and full export round-trip.
- Browser checks: marquee selected four shapes; group/ungroup and a 30.125 mm repeated row worked; align/distribute/center actions worked; native typed decimals persisted to an exported ZIP; Arrow Up increased stored Y by exactly 1 mm. Geometry status did not change drawing bounds. Library and all repeated guide definitions were present in browser-downloaded project JSON.
- Assembly visually inspected from underneath with plate hidden: guide rings and rounded screw bosses visible. Plate button changes to Show plate. Current preview checked at actual browser viewport 1195×1258; requested viewport override did not apply, so no new 1366×768 claim is made.
- User's original localhost project was backed up and restored. Additional example retained on localhost hostname, separate from 127.0.0.1 origin. Physical printing is not tested.
