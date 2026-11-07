# Case Builder

## Product and terminology
- A local-first electronics enclosure designer, initially focused on MIDI control surfaces.
- Control surface = upper sloped face; back = wide vertical face; front = narrow vertical face; end caps = wooden left/right closures; bottom plate = removable lower sloped face.
- CRITICAL: symmetric trapezoid. The TOTAL included angle is 10 degrees, split into +5 / -5 degree faces about its centerline. Never interpret this as 10 degrees on each face or a horizontal bottom.
- Rear height defaults to 50 mm and is user adjustable. It is the exterior height at the wide back, not internal clearance. Reject profiles with insufficient front height.
- Wood thickness 6 mm; cap overhang 1.5 mm, configurable to zero. Rounded/chamfered profile corners should match shell and cap. Cosmetic bevel on wood thickness edges is outside MVP CAM.
- Bottom plate recessed flush, four countersunk M3 screws or optional six. Plastic pilot holes 2.5 mm for manual tapping. Four M3 screws per end cap.
- Printer: user-specified Bambu P1S usable 250 x 250 x 250 mm. Shell printed control surface down, supports expected for back cutouts.
- CNC: stock FoxAlien Masuter spindle/controller; 1/16 inch (1.5875 mm) or 1/8 inch (3.175 mm) flat end mill; double-sided tape initially. Do not silently treat tape programs as clamp-safe.
- Library bundled/global without accounts. User components embedded in project JSON alongside both layouts and manufacturing settings. Local storage plus portable, versioned project JSON.
- User supplies actual component dimensions later; do not represent example cutouts as verified hardware templates.

## Implementation and first-use review
Use user's terminology, literal titles, explicit selected layout scope. Empty editor must explain how to add the first cutout. Inspect rendered pages and flows separately from tests.
Maintain references/decisions.md with assumptions, open questions, and implementation status. Save corrections here before expanding UI navigation.
Use Context7 resolve-library-id then query-docs for current library/API documentation. Keep geometry, CAM, persistence and UI separate; use millimeters throughout. Exports and preview must derive from the same solid geometry. Validate imports and bounds; block manufacturing exports for invalid geometry. Test symmetry, wall thickness, bore alignment, watertightness, cutter compensation, pass depths and modal initialization.

## Workspace and deployment
User-selected repository: joshu017/case_builder. Preserve reference/ images. Exclude FoxAlien_Masuter_V2.0/ from Git; distilled notes go in references/foxalien_masuter.md.
Follow ~/workers conventions: pnpm, TypeScript, credential-free CI, manual Cloudflare Workers deployment, no account IDs or credentials committed. This MVP uses static assets and a minimal Worker to strip the /casebuilder prefix; no Hono API or database is needed.
Production target: https://joshjacobson.net/casebuilder/ in the Josh@joshjacobson.net account, verified from zone ownership. The user explicitly authorized deployment on 2026-11-07 after Snyk scanning. Keep the account ID in the deployment environment only. Before release run Snyk SCA including dev dependencies and SAST with high severity thresholds; unavailable/failed scans block release. Do not put credentials in GitHub Actions. Local testing does not require deployment approval. Ask for outward-facing push/deploy approval only after the result is reviewable, per ~/workers/AGENTS.md.

## Screw-rail reinforcement and bottom hardware
The large tangent webs were rejected as too bulky. Use small 1.25 mm internal 45-degree chamfers measured along the wall from the rail/wall intersection, not a tangent brace across the whole rail. Keep the pilot centers, exterior and bottom fit unchanged; minimum dynamic layout margin is 13 mm.
Bottom screws are M3x6 flathead as in the user's photo. Model flush conical heads, not cylindrical button heads. Assumed countersink: 90° included angle, 6.4 mm mouth, 3.4 mm clearance bore, 1.5 mm deep. Actual head dimensions are not supplied; do not claim exact hardware fit. At the default 3 mm plate plus 0.25 mm clearance, nominal thread engagement is 2.75 mm. Flag thicker plates as needing longer screws.
