# LLM-assisted design with MCP

Endpoint: **https://joshjacobson.net/casebuilder/mcp**

Transport: Streamable HTTP (stateless JSON responses). Authentication: none. Add this URL as a remote MCP server in a client that supports Streamable HTTP. No second Worker, database, login or API key is required. The endpoint provides design tools; it does not call an LLM itself.

## Tools

| Tool | Input and result |
| --- | --- |
| `create_project` | Optional name and enclosure overrides; returns complete project JSON and validation. |
| `update_enclosure` | Complete project plus enclosure / machining changes; returns updated project. |
| `place_component` | Complete project, face, x/y, and either a component definition or embedded componentId; returns project with new cutout IDs. |
| `replace_layout` | Complete project and replacement shapes for one face; moves, edits or removes cutouts. |
| `validate_project` | Reports hardware-margin and dimension errors, cutout-overlap warnings; builds solids and checks export constraints. |
| `preview_project` | Returns a dimensioned SVG resource with both face layouts and the symmetric end profile. |
| `export_package` | Returns an embedded ZIP resource (base64 blob) containing all manufacturing files and project JSON. |

Read resource `casebuilder:///guide` for coordinates and constraints. Tool discovery exposes complete input schemas. Start by calling create_project; retain its `structuredContent.project` and pass the latest project to each following call. No server state is changed. To undo, retain the earlier JSON. Repeated place_component calls create additional instances.

Example request to an assistant:

> Create a case 180 mm wide, 110 mm deep, 50 mm tall at the back, with a total 10-degree angle. Place four 7 mm shaft holes in a horizontal row on the control surface, at x=30, 60, 90 and 120 mm, y=35 mm. Show me the preview and validation, then export the package.

Dimensions must come from actual component drawings; the tool does not infer electronics-body or wiring clearance from panel cutouts. Cutout overlap warnings permit intentional compound openings.

## Returning to the browser

Save the returned `project` object as `project.json`, or extract it from the ZIP. Open https://joshjacobson.net/casebuilder/ and choose **Open project**. The project includes custom components and both layouts. The MCP endpoint cannot see browser local storage or update an already-open editor.

For ZIP results, locate the content item with `type: "resource"` and `resource.mimeType: "application/zip"`; base64-decode `resource.blob` into `case-builder-package.zip`. These resource URIs label embedded response contents; they are not hosted download links or persistent resources. SVG previews similarly contain `resource.text`. Client support for displaying or saving embedded resources varies.

ZIP contents: `project.json`, `extrusion.stl`, `bottom-plate.stl`, `end-cap-left.stl`, `end-cap-right.stl`, `end-cap.nc`, control/back SVG and DXF layouts, and README. No machine is operated by MCP. Review G-code and air-cut before machining; current workholding is double-sided tape.

## Limits and deployment

The endpoint is public and processes caller-supplied designs without storing projects. MCP limits are 256 KiB per request, 64 cutouts per face and 64 shapes per component. Rate limiting is 60 requests per IP per minute per Cloudflare location (not a global quota). Arbitrary URLs and code execution are not accepted. Larger browser projects may need simplification before MCP use.

Manifold runs from a precompiled WASM import in the same Worker. Geometry, CAM and exports use the same implementation as the browser. No network requests are needed for geometry initialization. No Durable Object or storage binding is required.

Local verification:

```sh
pnpm build
pnpm exec wrangler dev --port 8787
# In another terminal:
pnpm exec tsx scripts/check-mcp.ts
```

The check uses the official MCP client to initialize, discover tools, create a project, export through workerd, decode the ZIP and verify project round-trip and all five manufacturing files. Supply the production endpoint as the final argument for a release smoke test. Unit tests cover editing, validation, transport rejection and resource outputs.
