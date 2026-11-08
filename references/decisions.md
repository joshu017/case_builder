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

## Compact interface revision

- User requested shorter navigation, smaller inputs, reduced spacing, permanently expanded settings, and side-by-side Plastic color / Wood.
- Replaced all disclosure controls with permanent sections, including Repeat selection. Navigation is 38 px and inputs 28 px. Profile style and radius also share a row.
- Shortened redundant helper prose while retaining hardware sizes, symmetric slopes and thicker-plate warnings. Canvas height adapts to browser height.
- User reviewed the local preview and explicitly approved deployment. Normal enclosure controls fit the 1366×768 viewport; selected-cutout tools can still require sidebar scrolling.

## Control-surface-down print gussets and cap material

- User asked to revisit the extrusion for support-free printing, then explicitly preferred straight 45-degree gussets over curved ramps. This supersedes the previous requirement to keep all reinforcement limited to small 1.25 mm junction chamfers.
- Bed-facing rail gussets use straight 45-degree profiles in the ACTUAL export orientation; local bottom-screw gussets are 8.6 mm wide. Exterior, screw centers and removable plate fit are preserved.
- Default blank-shell volume rises from 132163.87 to 138483.76 mm³ (+4.78%). Sampled triangle normals identify zero internal facets steeper than 45 degrees after excluding the end pilot bores and first-layer perimeter region. This geometric check does not establish a physical support-free print.
- Keep circular 2.5 mm horizontal tap bores for existing hardware. Back apertures can still need bridging/support. Edge treatments and filament/cooling/layer settings need slicer and print review.
- Validate rear cutouts against local screw-pad gusset keepouts; otherwise a previously valid cutout near a lower screw could leave reinforcement behind its opening.
- Plastic added to Wood dropdown; case and caps share the selected plastic color/material. Walnut remains default. All output formats remain available.
- Simplify face selectors to plain gray backgrounds without red stripe or pressed movement.
- Local comparison SVG, full package and 25 mm print-oriented coupon generated for review. User approved and this revision was deployed to joshjacobson.net/casebuilder.
- User also requested wrong.rodeo/casebuilder. This supersedes the earlier deferral; deployment is authorized but pending access to its Cloudflare zone (not visible to the current Wrangler OAuth login).

## Editor tools, rounded bosses and internal guides

- User requested a new local review with rounded bottom-screw gusset footprints, stationary geometry feedback, arbitrary decimal measurements, icon alignment/distribution/centering, marquee selection, group repetition, front-at-bottom control view, rounded/chamfered rectangular cutouts and a plate visibility toggle.
- User explicitly approved implementing rectangular internal guide walls now. Guide dimensions are the inner cavity; offsets are relative to cutout center in face coordinates. Default guide height 2 mm and wall 1 mm. The initial cavity is cutout width/height + 2 mm; user supplies component dimensions and fit allowances.
- Store guides with cutouts so library, copy/paste and grouped repeat carry them together. Keep the existing version-1 project format with optional fields for backward compatibility. Preview and STL share solids; SVG/DXF remain cutout-only manufacturing drawings.
- Align horizontal means common Y center; vertical means common X center. First selected unit anchors alignment; groups are units. Distribution spaces centers between extreme units; centering moves selection bounds as a unit relative to the current face. Arbitrary reference rectangles remain future work.
- Stored coordinates are unchanged; both editor and SVG now display Y upward from bottom/front. DXF uses stored Cartesian coordinates directly.
- Added 0.02 mm bonded extension at rail ramp tangency to avoid an almost-collinear mesh sliver after the rounded boss Boolean intersection. Bed-facing slope remains 45 degrees.
- Later user refinement: eliminate the nested center work-area card. Heading, toolbar/drawing area and bottom information form three direct rows on the center background. Status feedback stays overlaid and cannot reflow the drawing.
- wrong.rodeo remains deferred by the user's latest instruction. This new editor/geometry revision is local only pending review.

## Remove redundant layout headings

User requested removing the entire duplicate Control surface/Back heading area. Layout tabs now begin with tools; SVG/DXF exports share the upper-right Undo/Redo/Fit view group. On narrow centers, whole toolbar groups wrap while export and history actions stay together. Geometry feedback remains an overlay below the toolbar; Assembly and Manufacturing headings remain.

The user approved the complete editor/guide/toolbar revision for deployment; released to joshjacobson.net/casebuilder. This supersedes the local-only status above. wrong.rodeo remains deferred.

## Inspector keyboard focus and default USB-C component

- User withdrew the reported viewport/zoom issue; no viewport change made for that report.
- Commit-on-blur previously rebuilt the right inspector and discarded browser focus. Tab now commits before resolving the next field in the replacement DOM; Shift+Tab works in reverse. Option changes preserve focus across inspector rebuilds.
- Add a global default USB-C preset available alongside existing custom libraries. Nominal clearance opening: 9.4 × 3.6 mm, fillet R1.8, no guide/fence. Inserted definitions are embedded into the project; custom definitions with the same ID are preserved.
- Reference: Amphenol 10168357 receptacle drawing https://cdn.amphenol-cs.com/media/wysiwyg/files/drawing/10168357.pdf. Connector interface and shell dimensions differ from panel clearance; the selected preset is a practical editable clearance allowance, not a guaranteed fit for every connector or cable overmold.
- Browser verified an edited cutout Width advances to Height; Shift+Tab returns to Width without losing the committed decimal value. This revision is local pending review.

## Pictured Behringer-style fader

- Requested “100 mm” conflicts with supplied drawing: body 75 × 9 mm, travel 60 mm, two M2 threaded mounts 71 mm apart. Follow drawing and label library entry 60 mm travel; a true 100 mm part needs its own dimensions.
- Default vertical orientation suits a mixer; slot and two mounting holes form a group on placement. One centered guide surrounds the full body. Body thickness shown as 7 mm is not the fence height: retain a shallow 2 mm alignment fence.
- Assumed editable manufacturing clearances: slot 66 × 3 mm R1.5 (60 travel + 5 mm stem length + 1 mm total clearance), Ø2.2 M2 panel holes, body cavity 75.4 × 9.4 mm (0.2 mm per side), wall 1 mm. Drawing does not specify a panel cutout or print tolerances; physical fit remains untested. Preset is available globally and embedded on placement, including MCP, without changing existing projects.

- Hardware margin applies only to top/bottom on both layouts (default 13 mm); no side hardware margin. Cutouts and guide walls must remain within face width. Draw two dotted horizontal margin lines across the full face, with no vertical inset lines. Auto-size width uses requested padding, not the rail margin; keep local rear gusset collision checks.

## Library and plastic cap refinement
- Latest instruction supersedes the fader mounting-hole preset: library fader retains slot and fence only. Filter the two known factory mounting-hole IDs out of embedded library definitions on lookup; preserve already placed layouts. Re-embed the current definition on placement.
- Add 12 mm button: Ø7.2 mm opening, centered 12 × 12 mm INNER fence cavity, 1 mm wall and 2 mm height. Add 20k potentiometer: Ø7.0 mm opening, no fence.
- User confirmed plastic-cap treatment is OUTSIDE edges only, with flat inside mating face. Optional capOuterEdges flag defaults off/absent for compatibility; show only for plastic. Use profile corner style/radius around all four outside perimeter edges; sharp leaves geometry unchanged. Radius must leave 1 mm full-size rim through thickness. Shared preview/STL geometry; cap G-code remains the existing 2.5D profile/recess operation and does not machine the decorative edge treatment, explicitly stated in package README.
- Build and 38 tests pass, including watertight chamfer/fillet caps, symmetric volume, unchanged mating face and portable option. Local browser verified checkbox and chamfered assembly; physical print fit remains untested. Not deployed.

## Pattern operation
- Replaces permanent Repeat selection inspector section with toolbar Pattern button and anchored dropdown-style dialog. Cancel/Escape/outside dismissal makes no project change; Apply inserts copies as one undo step. Disabled without selection. Dialog fields are temporary operation parameters, not shape attributes.
- Rectangular: rows/columns and decimal spacing. Circular: instance count, center X/Y, signed sweep angle. Counts include original; full ±360° excludes duplicate endpoint, partial arcs include both ends. Selection bounding-box center establishes radius. Copies keep their orientation (no rectangle/guide rotation support); group structure and independent guides preserved. Reject invalid counts, zero radius, out-of-range coordinates and >400 total cutouts before mutation.
- Browser verified rectangular Apply/Undo, circular Apply/Undo, Cancel, and rendered dialog. Build and 39 tests pass. Local only pending review.

- Remove redundant Control surface/Back selectors and Project contents label from left sidebar; main tabs alone select the face. Remove Design studio nav label. Left sidebar starts with Cutouts (or Parts), followed by component library; attributes remain right, tools above workspace.

## Compact pattern operation and live preview

Replaced pattern dropdown with standard-size thin SVG rectangular/circular toggle icons beside Pattern. Added mouse center picker, centered/clamped popover placement, and dotted preview copies with guide outlines and center cross. Shared pattern calculation drives preview and Apply. Browser verified mouse picking, changing six instances to four (five preview copies to three), Cancel preserving two actual cutouts, Apply producing seven actual cutouts and removing preview, then Undo restoring the project. Build passes; local pending review.

## Draggable pattern source

Original selection is now a provisional draggable source for rectangular and circular operations. Preview and visible original use the same draft coordinates; actual project remains unchanged until Apply. Browser verified rectangular dragging with dialog visible and Cancel restoring exact original coordinates, circular source dragging, Apply adding five copies, and single Undo restoring the original 17-cutout project. Build passed; local only.

- Latest margin request: default top/bottom hardware margin is 11 mm (supersedes 13 mm). Retain adaptive increases for thicker walls/larger profile corners and local rear screw-gusset collision checks; side hardware margins remain zero.

## Slim extrusion review
- Latest user request: default shell wall 1.6 mm, superseding 3 mm and the interim 2 mm. Bottom plate remains 3 mm. Accept 1.6 mm through UI, portable JSON and MCP; preserve saved thickness choices.
- Reduce side rail outer radius from 4.3 to 3.6 mm around unchanged 2.5 mm pilot bores. At equal wall thickness this lifts the 45-degree wall intersection approximately 1 mm; a thinner wall independently changes that intersection. Fully bond rails to thin walls to avoid sealed slivers.
- Bottom screw pad cylinder depth is 4 mm instead of 9 mm; its local rounded 45-degree support and rear keepout follow the shorter pad. Shared side rails can extend beyond the pad itself.
- User approved the rendered profile and deployment; see references/release-2026-11-08.md. Physical rigidity/printability remains unvalidated. Internal guides may help rigidity, but depend on the user's layout.

- Latest default thickness decision: shell wall 2 mm AND bottom plate 2 mm, superseding the 1.6 mm shell / 3 mm plate defaults. Preserve explicitly saved project thicknesses and the supported 1.6 mm shell minimum.

- Bottom-plate STL print orientation: flat inner face on the bed, external flathead countersinks facing UP, minimum Z=0. This changes export orientation only; assembly geometry stays unchanged.

- Flush bottom fit: preserve the recessed plate and rim. Seat the inner plate face exactly one plate thickness from the outside bottom plane, removing the old 0.25 mm axial gap. Retain 0.25 mm lateral clearance. At the 2 mm default, M3x6 nominal boss engagement is 4 mm.

- Superseding flush-fit instruction: remove the entire perimeter rim from the extrusion. Shell walls terminate in the same plane as bottom screw-pad seating faces. The bottom plate covers the trimmed walls and follows the exterior profile/corner treatment, retaining X clearance to end caps. Plate STL remains countersinks-up.
