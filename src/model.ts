export type Face = 'control' | 'back';
export type Shape = { id: string; kind: 'rect' | 'circle'; x: number; y: number; w: number; h: number; group?: string; name: string };
export type Component = { id: string; name: string; shapes: Shape[] };
export type Project = {
  version: 1; name: string;
  enclosure: { width: number; depth: number; height: number; angle: number; wall: number; plate: number; padding: number; autoSize: boolean; overhang: number; woodThickness: number; edge: 'sharp' | 'chamfer' | 'fillet'; radius: number; screws: 4 | 6; color: string; wood: 'walnut' | 'maple' | 'cherry' | 'oak' };
  machining: { tool: number; feed: number; plunge: number; stepDown: number; safeZ: number; rpm: number; through: number; stockMargin: number; workholding: 'tape'; };
  layouts: Record<Face, Shape[]>; components: Component[];
};
export const uid = () => crypto.randomUUID();
export function newProject(): Project {
  return {version:1,name:'Untitled enclosure',enclosure:{width:180,depth:110,height:50,angle:10,wall:3,plate:3,padding:12,autoSize:false,overhang:1.5,woodThickness:6,edge:'chamfer',radius:2,screws:4,color:'#354c4b',wood:'walnut'},machining:{tool:1.5875,feed:250,plunge:80,stepDown:0.5,safeZ:5,rpm:10000,through:0.2,stockMargin:8,workholding:'tape'},layouts:{control:[],back:[]},components:[]};
}
export const clone = <T>(x:T):T => structuredClone(x);
export function dimensions(p:Project) {
  const e=p.enclosure, a=e.angle*Math.PI/360, c=Math.cos(a), s=Math.sin(a), t=Math.tan(a);
  let width=e.width, depth=e.depth;
  if(e.autoSize && p.layouts.control.length) {
    width=Math.max(40,...p.layouts.control.map(q=>q.x+q.w+Math.max(e.padding,layoutMargin(p))));
    depth=Math.max(35,...p.layouts.control.map(q=>(q.y+(q.kind==='circle'?q.w:q.h)+Math.max(e.padding,layoutMargin(p)))*c));
    if(p.layouts.back.length) width=Math.max(width,...p.layouts.back.map(q=>q.x+q.w+Math.max(e.padding,layoutMargin(p))));
  }
  return {width,depth,a,c,s,t,frontHeight:e.height-2*depth*t, rise:depth*t, surfaceDepth:depth/c};
}
export function faceSize(p:Project,f:Face) {const d=dimensions(p);return {w:d.width,h:f==='control'?d.surfaceDepth:p.enclosure.height};}
export function screwCenters(p:Project):[number,number][] {
  const d=dimensions(p), e=p.enclosure, inset=Math.max(6,e.wall+3,e.radius+3);
  return [[inset,d.rise+inset],[d.depth-inset,inset],[d.depth-inset,e.height-inset],[inset,e.height-d.rise-inset]];
}
export function bottomCenters(p:Project):[number,number][] {
  const d=dimensions(p), inset=p.enclosure.wall/d.c+4.25, ys=[inset,d.surfaceDepth-inset];
  const xs=p.enclosure.screws===6?[14,d.width/2,d.width-14]:[14,d.width-14];
  return xs.flatMap(x=>ys.map(y=>[x,y] as [number,number]));
}
export function layoutMargin(p:Project) { const e=p.enclosure; return Math.max(18,2*Math.max(6,e.wall+3,e.radius+3)-e.wall+9); }
export function issues(p:Project):string[] {
 const e=p.enclosure,d=dimensions(p), margin=layoutMargin(p), out:string[]=[];
 if(d.frontHeight<22) out.push('Front height must be at least 22 mm for the screw rails. Increase rear height or reduce depth / total angle.');
 if(d.width<40||d.depth<35) out.push('Case width must be at least 40 mm and depth at least 35 mm.');
 if(e.wall<2||e.wall>6||e.plate<2||e.plate>5) out.push('Wall thickness must be 2–6 mm; bottom plate thickness must be 2–5 mm.');
 if(e.radius>Math.min(5,e.wall+1))out.push('Profile corner size must not exceed 5 mm or wall thickness + 1 mm.');
 for(const f of ['control','back'] as Face[]) {
  const size=faceSize(p,f);
  for(const q of p.layouts[f]) {
    const h=q.kind==='circle'?q.w:q.h;
    // Rails occupy a protected perimeter; this also prevents cutouts severing screw bosses.
    if(q.x<margin-1e-6||q.y<margin-1e-6||q.x+q.w>size.w-margin+1e-6||q.y+h>size.h-margin+1e-6)out.push(`${f==='control'?'Control surface':'Back'}: “${q.name}” crosses the ${margin} mm hardware margin.`);
  }
 }
 return [...new Set(out)];
}
export function parseProject(text:string):Project {
 if(text.length>2_000_000)throw Error('Project file exceeds 2 MB.');
 const raw=JSON.parse(text);
 if(raw?.version!==1)throw Error('Unsupported project version. Expected version 1.');
 const base=newProject();
 if(typeof raw.name!=='string'||raw.name.length>100)throw Error('Invalid project name.');
 const num=(o:Record<string,unknown>, k:string,lo:number,hi:number)=>{if(typeof o?.[k]!=='number'||!Number.isFinite(o[k])||(o[k] as number)<lo||(o[k] as number)>hi)throw Error(`Invalid ${k}.`);return o[k] as number;};
 const e=raw.enclosure,m=raw.machining;
 for(const k of ['width','depth','height'] as const)base.enclosure[k]=num(e,k,10,1000);
 for(const [k,lo,hi] of [['angle',0,30],['wall',2,6],['plate',2,5],['padding',12,100],['overhang',0,10],['woodThickness',4,25],['radius',0,5]] as const)base.enclosure[k]=num(e,k,lo,hi);
 if(!['sharp','chamfer','fillet'].includes(e.edge)||![4,6].includes(e.screws)||!['walnut','maple','cherry','oak'].includes(e.wood)||!/^#[0-9a-f]{6}$/i.test(e.color)||typeof e.autoSize!=='boolean')throw Error('Invalid enclosure options.');
 Object.assign(base.enclosure,{edge:e.edge,screws:e.screws,wood:e.wood,color:e.color,autoSize:e.autoSize});
 for(const [k,lo,hi] of [['tool',1,4],['feed',10,1000],['plunge',10,300],['stepDown',0.1,1],['safeZ',2,20],['rpm',1000,10000],['through',0,0.5],['stockMargin',5,30]] as const)base.machining[k]=num(m,k,lo,hi);
 if(![1.5875,3.175].includes(m.tool)||m.workholding!=='tape')throw Error('Unsupported cutter or workholding.');
 const shapes=(arr:unknown):Shape[]=>{
 if(!Array.isArray(arr)||arr.length>400)throw Error('A layout can contain up to 400 cutouts.');
 const ids=new Set<string>();
 return arr.map(q=>{if(!q||!['rect','circle'].includes(q.kind)||typeof q.id!=='string'||ids.has(q.id)||typeof q.name!=='string'||q.name.length>100||(q.group!==undefined&&typeof q.group!=='string'))throw Error('Invalid cutout.');ids.add(q.id);return {id:q.id,kind:q.kind,x:num(q,'x',0,1000),y:num(q,'y',0,1000),w:num(q,'w',0.5,500),h:num(q,'h',0.5,500),name:q.name,...(q.group?{group:q.group}:{})};});};
 base.layouts={control:shapes(raw.layouts?.control),back:shapes(raw.layouts?.back)};
 if(!Array.isArray(raw.components)||raw.components.length>100)throw Error('Invalid component library.');
 base.components=raw.components.map((c:Component)=>{if(typeof c.name!=='string'||c.name.length>100||typeof c.id!=='string')throw Error('Invalid component.');return {id:c.id,name:c.name,shapes:shapes(c.shapes)};});base.name=raw.name;return base;
}
