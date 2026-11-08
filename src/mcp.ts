import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { newProject, parseProject, dimensions, faceSize, issues, layoutMargin, uid, type Project, type Face, type Shape } from './model';
import { exportPackage, layoutSVG, escape } from './export';
import { profile, type Assembly } from './geometry';

const mm = (min:number,max:number) => z.number().finite().min(min).max(max);
const name = z.string().max(100);
const shape = z.object({id:z.string().max(100),name,kind:z.enum(['rect','circle']),x:mm(0,1000),y:mm(0,1000),w:mm(.5,500),h:mm(.5,500),group:z.string().max(100).optional()}).strict();
const enclosure = z.object({
 width:mm(10,1000),depth:mm(10,1000),height:mm(10,1000).describe('Exterior rear height; front height is calculated.'),
 angle:mm(0,30).describe('TOTAL included angle in degrees: 10 means +5 top and -5 bottom.'),
 wall:mm(2,6),plate:mm(2,5),padding:mm(12,100),autoSize:z.boolean(),overhang:mm(0,10),
 woodThickness:mm(4,25).describe('Shared end-cap thickness for both printed and milled caps.'),
 edge:z.enum(['sharp','chamfer','fillet']),radius:mm(0,5),screws:z.union([z.literal(4),z.literal(6)]),color:z.string().regex(/^#[0-9a-f]{6}$/i),wood:z.enum(['walnut','maple','cherry','oak','plastic'])
}).strict();
const component = z.object({id:z.string().max(100),name,shapes:z.array(shape).max(64)}).strict();
const machining = z.object({tool:z.union([z.literal(1.5875),z.literal(3.175)]),feed:mm(10,1000),plunge:mm(10,300),stepDown:mm(.1,1),safeZ:mm(2,20),rpm:mm(1000,10000),through:mm(0,.5),stockMargin:mm(5,30),workholding:z.literal('tape')}).strict();
export const projectSchema = z.object({version:z.literal(1),name,enclosure,machining,layouts:z.object({control:z.array(shape).max(64),back:z.array(shape).max(64)}).strict(),components:z.array(component).max(100)}).strict().describe('Complete portable project. All lengths are millimeters. Use the most recent returned project in the next call.');
export const instructions = `Case Builder designs symmetric trapezoid electronics cases. All lengths are mm. angle is TOTAL included angle: 10 means +5/-5. height is exterior REAR height. Control surface coordinates: upper-left in editor, X along case width, Y from front toward back measured on the slope. Back coordinates: X along width, Y upward from rear bottom. Shapes use their minimum X/Y bounding-box corner; circle w is diameter (set h=w). Components have local coordinates and are translated on placement. End caps share woodThickness for printing and milling. No browser localStorage access or server project storage: pass the full returned project each call; save project.json and use Open project in the web app. Validate before exporting. Collision warnings cover cutouts only, not electronics bodies or wiring. Component dimensions are supplied by the caller, not verified library templates. G-code is for stock Masuter, tape workholding only; review and air-cut before machining. Public endpoint: no authentication, no execution of supplied code or machine control. MCP limits: 64 cutouts per face, 64 shapes per component, 256 KiB request. No arbitrary URLs are fetched.`;

function readProject(raw:unknown):Project { return parseProject(JSON.stringify(projectSchema.parse(raw))); }
function overlaps(a:Shape,b:Shape):boolean {
 const ah=a.kind==='circle'?a.w:a.h,bh=b.kind==='circle'?b.w:b.h;
 if(a.kind==='rect'&&b.kind==='rect')return a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+bh&&b.y<a.y+ah;
 if(a.kind==='circle'&&b.kind==='circle')return Math.hypot(a.x+a.w/2-b.x-b.w/2,a.y+a.w/2-b.y-b.w/2)<(a.w+b.w)/2;
 const c=a.kind==='circle'?a:b,r=a.kind==='rect'?a:b,cx=c.x+c.w/2,cy=c.y+c.w/2;
 return Math.hypot(cx-Math.max(r.x,Math.min(cx,r.x+r.w)),cy-Math.max(r.y,Math.min(cy,r.y+r.h)))<c.w/2;
}
export function designReport(p:Project) {
 const errors=issues(p),warnings:string[]=[];
 for(const f of ['control','back'] as Face[])for(let i=0;i<p.layouts[f].length;i++)for(let j=i+1;j<p.layouts[f].length;j++)if(overlaps(p.layouts[f][i],p.layouts[f][j]))warnings.push(`${f}: cutouts ${p.layouts[f][i].id} and ${p.layouts[f][j].id} overlap. Confirm this is intentional.`);
 if(p.enclosure.plate>3)warnings.push('A thicker bottom plate needs longer screws than M3x6.');
 return {valid:errors.length===0,errors,warnings,dimensions:dimensions(p),faces:{control:faceSize(p,'control'),back:faceSize(p,'back')},hardwareMargin:layoutMargin(p),checksNotPerformed:['electronics body / wiring clearance','measured screw and printer fit','physical machining validation']};
}
function projectResult(p:Project) {return {project:p,validation:designReport(p),nextStep:'Save project as project.json and use Open project at https://joshjacobson.net/casebuilder/; or pass project to the next tool.'};}
function result(value:Record<string,unknown>) {return {content:[{type:'text' as const,text:JSON.stringify(value)}],structuredContent:value};}
function base64(data:Uint8Array) {let out='';for(let i=0;i<data.length;i+=8192)out+=String.fromCharCode(...data.subarray(i,i+8192));return btoa(out);}
export function previewSVG(p:Project):string {
 const d=dimensions(p), gap=24, control=faceSize(p,'control'), back=faceSize(p,'back');
 const width=Math.max(170,control.w,d.depth)+20,height=control.h+back.h+p.enclosure.height+gap*4;
 let y=20;
 const face=(f:Face)=>{const size=faceSize(p,f),svg=layoutSVG(p,f),inner=svg.slice(svg.indexOf('<g'),svg.lastIndexOf('</svg>'));
 const group=`<g transform="translate(10 ${y})"><text y="-11">${f==='control'?'Control surface':'Back'}: ${size.w.toFixed(2)} × ${size.h.toFixed(2)} mm</text><text y="-5">${f==='control'?'Front edge at top of drawing; Y increases toward back.':'Bottom edge at top of drawing; Y increases toward top edge.'}</text><rect width="${size.w}" height="${size.h}" fill="#edf3f2" stroke="#354c4b"/>${inner}</g>`;y+=size.h+gap;return group;};
 const faces=face('control')+face('back');
 const points=profile(p).map(([x,z])=>`${x},${p.enclosure.height-z}`).join(' ');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}"><title>${escape(p.name)} — dimensioned design preview</title><rect width="100%" height="100%" fill="white"/><g font-family="sans-serif" font-size="4" stroke-width="0.3">${faces}<g transform="translate(10 ${y})"><text y="-11">End profile: depth ${d.depth.toFixed(2)} mm; ±${p.enclosure.angle/2}°</text><text y="-5">Rear ${p.enclosure.height} mm; front ${d.frontHeight.toFixed(2)} mm</text><polygon points="${points}" fill="#edf3f2" stroke="#354c4b"/></g></g></svg>`;
}
export type AssemblyBuilder = (p:Project)=>Promise<Assembly>;
export function createDesignServer(build:AssemblyBuilder) {
 const server=new McpServer({name:'case-builder',version:'0.2.0'},{instructions});
 const annotations={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
 const register = (tool:string,description:string,schema:z.ZodRawShape,run:(args:any)=>Promise<any>|any) => server.registerTool(tool,{description,inputSchema:schema,annotations:{...annotations,idempotentHint:tool!=='place_component'}},async args=>{
  try{return await run(args);}catch(error){return {isError:true,content:[{type:'text' as const,text:error instanceof Error?error.message:'Design operation failed.'}]};}
 });
 register('create_project','Create a complete project with defaults and optional enclosure overrides. Returns portable project JSON and validation.',{name:name.optional(),enclosure:enclosure.partial().optional()},({name,enclosure})=>{const p=newProject();if(name!==undefined)p.name=name;Object.assign(p.enclosure,enclosure);return result(projectResult(readProject(p)));});
 register('update_enclosure','Update enclosure and/or machining parameters. Keeps layouts and embedded components. Returns a new project; never changes a saved project.',{project:projectSchema,enclosure:enclosure.partial().optional(),machining:machining.partial().optional(),name:name.optional()},args=>{const p=readProject(args.project);Object.assign(p.enclosure,args.enclosure);Object.assign(p.machining,args.machining);if(args.name!==undefined)p.name=args.name;return result(projectResult(readProject(p)));});
 register('place_component','Place a caller-defined component on a face, or use an embedded componentId. Exactly one of component or componentId is required. Local shape coordinates are translated by x/y. Returns the project with generated cutout IDs. Repeated calls add another instance.',{project:projectSchema,face:z.enum(['control','back']),x:mm(0,1000),y:mm(0,1000),component:component.optional(),componentId:z.string().max(100).optional()},args=>{
  const p=readProject(args.project);if(Boolean(args.component)===Boolean(args.componentId))throw Error('Supply exactly one of component or componentId.');
  const c=args.component??p.components.find(c=>c.id===args.componentId);if(!c)throw Error('Component not found in this project.');if(!c.shapes.length)throw Error('Component needs at least one shape.');
  if(args.component){const existing=p.components.find(c=>c.id===args.component.id);if(existing&&JSON.stringify(existing)!==JSON.stringify(c))throw Error('Component ID already exists with different content. Use a new ID.');if(!existing)p.components.push(c);}
  const group=uid();p.layouts[args.face as Face].push(...c.shapes.map((s:Shape)=>({...s,id:uid(),group,x:s.x+args.x,y:s.y+args.y})));
  return result(projectResult(readProject(p)));
 });
 register('replace_layout','Replace all cutouts on one face. Use this to edit, move, or remove cutouts while preserving their IDs; other face is unchanged.',{project:projectSchema,face:z.enum(['control','back']),shapes:z.array(shape).max(64)},args=>{const p=readProject(args.project);p.layouts[args.face as Face]=args.shapes;return result(projectResult(readProject(p)));});
 register('validate_project','Validate dimensions and hardware margins; report cutout overlaps as warnings. Also builds solids and checks complete manufacturing export, including the 250 mm printer envelope and CNC constraints.',{project:projectSchema},async args=>{const p=readProject(args.project),report=designReport(p);if(report.valid){try{exportPackage(p,await build(p));}catch(e){report.errors.push(e instanceof Error?e.message:'Geometry validation failed.');report.valid=false;}}return result({validation:report});});
 register('preview_project','Return a dimensioned SVG resource with control surface, back and symmetric end profile. This is a 2D layout preview, not an electronics-body collision check.',{project:projectSchema},args=>{const p=readProject(args.project);return {...result({validation:designReport(p)}),content:[{type:'resource' as const,resource:{uri:'casebuilder:///preview.svg',mimeType:'image/svg+xml',text:previewSVG(p)}},{type:'text' as const,text:JSON.stringify(designReport(p))}]};});
 register('export_package','Validate and generate the same ZIP as the browser: project.json, shell/plate/both cap STLs, cap G-code, SVG/DXF layouts and README. Returns an embedded application/zip resource with base64 blob; decode to save case-builder-package.zip. No machine commands are executed.',{project:projectSchema},async args=>{const p=readProject(args.project),report=designReport(p);if(!report.valid)throw Error(report.errors.join('\n'));const zip=exportPackage(p,await build(p));return {content:[{type:'text' as const,text:'Save the embedded ZIP by base64-decoding its blob. Import its project.json in the web app to continue editing.'},{type:'resource' as const,resource:{uri:'casebuilder:///case-builder-package.zip',mimeType:'application/zip',blob:base64(zip)}}],structuredContent:{filename:'case-builder-package.zip',bytes:zip.length,validation:report}};});
 server.registerResource('design-guide','casebuilder:///guide',{mimeType:'text/plain',description:'Coordinates, constraints and portable project workflow.'},async uri=>({contents:[{uri:uri.href,mimeType:'text/plain',text:instructions}]}));
 return server;
}
export async function handleMcp(request:Request,build:AssemblyBuilder):Promise<Response> {
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return new Response('Origin not allowed',{status:403});
 const server=createDesignServer(build),transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true,maxRequestBodySize:256*1024});
 await server.connect(transport);
 try{return await transport.handleRequest(request);}finally{await server.close();}
}
