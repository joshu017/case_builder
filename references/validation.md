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
