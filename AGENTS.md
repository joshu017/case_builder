# Case Builder

## Product and terminology
- A local-first electronics enclosure designer, initially focused on MIDI control surfaces.
- Control surface = upper sloped face; back = wide vertical face; front = narrow vertical face; end caps = printed or wooden left/right closures; bottom plate = removable lower sloped face.
- CRITICAL: symmetric trapezoid. The TOTAL included angle is 10 degrees, split into +5 / -5 degree faces about its centerline. Never interpret this as 10 degrees on each face or a horizontal bottom.
- Rear height defaults to 50 mm and is user adjustable. It is the exterior height at the wide back, not internal clearance. Reject profiles with insufficient front height.
- Wood thickness 6 mm; cap overhang 1.5 mm, configurable to zero. Rounded/chamfered profile corners should match shell and cap. Cosmetic bevel on wood thickness edges is outside MVP CAM.
- Bottom plate recessed flush, four countersunk M3 screws or optional six. Plastic pilot holes 2.5 mm for manual tapping. Four M3 screws per end cap.
- Printer: user-specified Bambu P1S usable 250 x 250 x 250 mm. Shell printed control surface down. Straight 45-degree structural gussets reduce support needs; back cutouts, small horizontal bores and decorative outer edges still require slicer/physical review.
- CNC: stock FoxAlien Masuter spindle/controller; 1/16 inch (1.5875 mm) or 1/8 inch (3.175 mm) flat end mill; double-sided tape initially. Do not silently treat tape programs as clamp-safe.
- Library bundled/global without accounts. User components embedded in project JSON alongside both layouts and manufacturing settings. Local storage plus portable, versioned project JSON.
- User supplies actual component dimensions later; do not represent example cutouts as verified hardware templates.

## Implementation and first-use review
Use user's terminology, literal titles, explicit selected layout scope. Empty editor must explain how to add the first cutout. Inspect rendered pages and flows separately from tests.
Maintain references/decisions.md with assumptions, open questions, and implementation status. Save corrections here before expanding UI navigation.
Use Context7 resolve-library-id then query-docs for current library/API documentation. Keep geometry, CAM, persistence and UI separate; use millimeters throughout. Exports and preview must derive from the same solid geometry. Validate imports and bounds; block manufacturing exports for invalid geometry. Test symmetry, wall thickness, bore alignment, watertightness, cutter compensation, pass depths and modal initialization.

## Workspace and deployment
User-selected repository: joshu017/case_builder. Preserve reference/ images. Exclude FoxAlien_Masuter_V2.0/ from Git; distilled notes go in references/foxalien_masuter.md.
Follow ~/workers conventions: pnpm, TypeScript, credential-free CI, manual Cloudflare Workers deployment, no account IDs or credentials committed. The Worker serves static assets and a stateless MCP endpoint at /casebuilder/mcp; no database is needed.
Production target: https://joshjacobson.net/casebuilder/ in the Josh@joshjacobson.net account, verified from zone ownership. The user explicitly authorized deployment on 2026-11-07 after Snyk scanning. Keep the account ID in the deployment environment only. Before release run Snyk SCA including dev dependencies and SAST with high severity thresholds; unavailable/failed scans block release. Do not put credentials in GitHub Actions. Local testing does not require deployment approval. Ask for outward-facing push/deploy approval only after the result is reviewable, per ~/workers/AGENTS.md.

## Screw-rail reinforcement and bottom hardware
The earlier broad reinforcement was rejected as bulky, then the user explicitly requested support-oriented geometry and straight 45-degree gussets. Add bed-facing rail gussets and local 8.6 mm-wide bottom-screw gussets measured in control-surface-down print coordinates. Preserve exterior, pilot centers and plate fit. Keep the small junction chamfers where helpful. Validate rear cutouts against the local bottom-screw gusset keepouts as well as the general hardware margin. Do not promise support-free printing for arbitrary rear cutouts or untested materials/settings.
Bottom screws are M3x6 flathead as in the user's photo. Model flush conical heads, not cylindrical button heads. Assumed countersink: 90° included angle, 6.4 mm mouth, 3.4 mm clearance bore, 1.5 mm deep. Actual head dimensions are not supplied; do not claim exact hardware fit. At the default 3 mm plate plus 0.25 mm clearance, nominal thread engagement is 2.75 mm. Flag thicker plates as needing longer screws.

## End-cap exports
Always include BOTH end-cap-left.stl and end-cap-right.stl along with end-cap.nc in the package; no manufacturing-mode toggle. Print caps inner-face down with screw recesses upward, minimum Z=0. Use the same cap solids, thickness, overhang and holes as the assembly/CNC geometry. Thickness remains the existing woodThickness project parameter for compatibility.

## MCP design tools
- The same Worker serves Streamable HTTP at /casebuilder/mcp. Public, stateless, no saved projects or browser localStorage access. Pass complete portable project JSON on every call.
- Reuse model, geometry, CAM and export code; do not create a divergent LLM-only geometry implementation. Serve the same four STLs and cap G-code.
- Geometry uses precompiled Manifold WASM via instantiateWasm. Wrangler defines globalThis.process as undefined so Emscripten does not select its Node filesystem loader in Workers; nodejs_compat supports bundled dependencies.
- Return dimensioned 2D SVG previews honestly labelled as such, not 3D or electronics-clearance checks. Overlapping cutouts are warnings because compound openings may be intentional.
- MCP request limit 256 KiB; 64 shapes per face/component. Rate limit 60 requests per IP per minute per Cloudflare location. No supplied code execution, arbitrary URL fetch, machine control, accounts or persistent artifacts.
- Validate real MCP client initialize/list/call flows and export in workerd before release. scripts/check-mcp.ts accepts a local or production endpoint.

## Interface design system
- Reference: https://wrong.rodeo. Use its metal palette (#D8E1E7 / #EEF3F6 / #C4CFD7), ink #101418, vermilion #F04424, Bricolage Grotesque display and Instrument Sans body typography. Keep technical numeric fields in monospace.
- Compact single-row desktop header: 54 px, buttons ~32 px, no subtitle or visible second-line save text. Preserve accessible save status and hover tooltip.
- New-project case material defaults to a lighter blue-tinged gray #71808A; wood remains walnut. Preserve all saved project colors. UI restyling must not override project material settings.
- Appearance section is expanded by default, exposing plastic color and wood controls.
- Compact layout: navigation 38 px, fields 28 px, tight spacing. All former disclosure sections (including Repeat selection) are permanent sections with headings. Appearance and profile controls use two-column rows. Target the normal editor's full settings at 1366×768; retain scrolling for long selection tools and smaller screens.

## Latest selectors and cap material
- Control surface / Back sidebar selectors use a plain #E1E8ED selected/hover fill, with no red stripe, special icon color, outline or pressed movement.
- Keep Wood dropdown terminology; include plastic alongside walnut/maple/cherry/oak. plastic caps use the current case color and plastic material (no wood texture). woodThickness remains the shared cap-thickness project key; UI label is Cap thickness. Persist and accept plastic through project import and MCP. Both cap STLs and cap G-code remain in every package regardless of appearance choice.

## Editor refinement requirements
- Control surface is shown top-down with front at screen bottom; stored Y still increases front-to-back. Back also displays bottom at screen bottom. Arrow-key nudging follows screen directions; inputs accept arbitrary finite decimals within physical limits, without spinners.
- Geometry status is an overlay between the workspace title and export actions; it must never shift the drawing area.
- Align horizontal = shared Y center; align vertical = shared X center, anchored to first selected object. Distribution spaces centers between extremes. Groups move as units. Center horizontal/vertical uses the whole selection bounds within the current face.
- Drag empty canvas to marquee-select; Shift extends selection. Group/ungroup and repeat preserve independent group instances.
- Rectangle cutouts support sharp, chamfer and fillet corners consistently in editor, solid, SVG/DXF, project and MCP. Assembly plate visibility is preview-only and hides plate screws too.
- Bottom-screw gussets must blend into the circular boss footprint without a projecting square shelf, while retaining a 45-degree bed-facing ramp.
- User approved implementing rectangular internal guides now. Each cutout may carry innerWidth/innerHeight, wall, height and signed offsetX/offsetY relative to its center. Extrude inward from inside face; include in shell STL and portable component/project/MCP data. Guide copies must be independent. Validate aperture inside cavity, protected margins and top/bottom clearance. Physical fit tolerance remains caller-supplied.
- wrong.rodeo deployment is deferred again at user request; joshjacobson.net/casebuilder is the only current release target.
- Latest UI refinement supersedes the three-row layout on Control surface / Back: omit the duplicate workspace heading entirely. SVG/DXF exports sit with Undo/Redo/Fit view at the toolbar's upper right. Geometry status overlays below the toolbar, never reserving space. Assembly/Manufacturing retain their headings.
- Right inspector edits must preserve Tab/Shift+Tab traversal through fields after re-rendering; selecting an option must preserve focus too.
- Default library includes builtin-usb-c-port: nominal 9.4 × 3.6 mm rounded clearance opening, R1.8, no internal guide. Available to new and existing projects; embed a copy on placement so exports stay self-contained. Dimensions are an editable clearance preset, not a universal panel-mount standard.

- Default Behringer-style fader uses the user drawing: 75 × 9 mm body, 60 mm travel (despite request calling it 100 mm), 71 mm M2 mounting pitch. Preset is vertical, grouped slot + two clearance holes, one body fence. Editable allowances: 66 × 3 R1.5 slot, Ø2.2 holes, 9.4 × 75.4 fence cavity, 1 mm wall, 2 mm height. Do not scale drawing to 100 mm or claim verified physical fit.
