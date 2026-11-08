export type Face = 'control' | 'back';
export type Guide = {innerWidth:number;innerHeight:number;wall:number;height:number;offsetX:number;offsetY:number};
export type Shape = { id: string; kind: 'rect' | 'circle'; x: number; y: number; w: number; h: number; group?: string; corner?: 'sharp' | 'chamfer' | 'fillet'; radius?: number; guide?:Guide; name: string };
export type Component = { id: string; name: string; shapes: Shape[] };
export type Project = {
  version: 1; name: string;
  enclosure: { width: number; depth: number; height: number; angle: number; wall: number; plate: number; padding: number; autoSize: boolean; overhang: number; woodThickness: number; capOuterEdges?: boolean; edge: 'sharp' | 'chamfer' | 'fillet'; radius: number; screws: 4 | 6; color: string; wood: 'walnut' | 'maple' | 'cherry' | 'oak' | 'plastic' };
  machining: { tool: number; feed: number; plunge: number; stepDown: number; safeZ: number; rpm: number; through: number; stockMargin: number; workholding: 'tape'; };
  layouts: Record<Face, Shape[]>; components: Component[];
};
/** Nominal USB-C receptacle clearance opening; adjust to the actual connector. */
export function defaultComponents():Component[]{return [
 {id:'builtin-usb-c-port',name:'USB-C port · 9.4 × 3.6 mm',shapes:[{id:'usb-c-opening',name:'USB-C port',kind:'rect',x:0,y:0,w:9.4,h:3.6,corner:'fillet',radius:1.8}]},
 // User drawing: 75 × 9 body, 60 travel, 71 mounting pitch, M2 threads.
 // Panel clearances and fence allowance are editable assumptions, not drawing dimensions.
 {id:'builtin-behringer-fader-60mm',name:'Behringer-style fader · 60 mm travel',shapes:[
  {id:'fader-slot',name:'Fader slot · 66 × 3 mm',kind:'rect',x:3,y:4.5,w:3,h:66,corner:'fillet',radius:1.5,guide:{innerWidth:9.4,innerHeight:75.4,wall:1,height:2,offsetX:0,offsetY:0}}
 ]},
 {id:'builtin-button-12mm',name:'12 mm button',shapes:[{id:'button-opening',name:'12 mm button',kind:'circle',x:0,y:0,w:7.2,h:7.2,guide:{innerWidth:12,innerHeight:12,wall:1,height:2,offsetX:0,offsetY:0}}]},
 {id:'builtin-potentiometer-20k',name:'20k potentiometer',shapes:[{id:'pot-opening',name:'20k potentiometer',kind:'circle',x:0,y:0,w:7,h:7}]}
];}
export function componentLibrary(p:Project):Component[]{return [...defaultComponents().filter(c=>!p.components.some(saved=>saved.id===c.id)),...p.components.map(c=>c.id==='builtin-behringer-fader-60mm'?{...c,shapes:c.shapes.filter(q=>!['fader-mount-front','fader-mount-back'].includes(q.id))}:c)];}
export const uid = () => crypto.randomUUID();
export function newProject(): Project {
  return {version:1,name:'Untitled enclosure',enclosure:{width:180,depth:110,height:50,angle:10,wall:3,plate:3,padding:12,autoSize:false,overhang:1.5,woodThickness:6,edge:'chamfer',radius:2,screws:4,color:'#71808a',wood:'walnut'},machining:{tool:1.5875,feed:250,plunge:80,stepDown:0.5,safeZ:5,rpm:10000,through:0.2,stockMargin:8,workholding:'tape'},layouts:{control:[],back:[]},components:[]};
}
export const clone = <T>(x:T):T => structuredClone(x);
export function dimensions(p:Project) {
  const e=p.enclosure, a=e.angle*Math.PI/360, c=Math.cos(a), s=Math.sin(a), t=Math.tan(a);
  let width=e.width, depth=e.depth;
  if(e.autoSize && p.layouts.control.length) {
    width=Math.max(40,...p.layouts.control.map(q=>q.x+q.w+e.padding));
    depth=Math.max(35,...p.layouts.control.map(q=>(q.y+(q.kind==='circle'?q.w:q.h)+Math.max(e.padding,layoutMargin(p)))*c));
    if(p.layouts.back.length) width=Math.max(width,...p.layouts.back.map(q=>q.x+q.w+e.padding));
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
/** Straight screw-pad gusset in original Y/Z coordinates; shared with validation. */
export function bottomGussetProfile(p:Project,y:number):[number,number][] {
 const d=dimensions(p),e=p.enclosure,r=4.3,front=y<d.surfaceDepth/2,sign=front?1:-1;
 const c2=Math.cos(2*d.a),s2=Math.sin(2*d.a);
 const innerH=c2*(y+sign*r)+s2*(front?e.plate+9:e.plate)+d.s*d.rise;
 const rampV=s2*(y-r)-c2*(e.plate+9)-d.c*d.rise-0.1;
 const joinV=s2*(y+r)-c2*(e.plate+8.9)-d.c*d.rise+0.1;
 const wall=front?e.wall-0.25:d.depth-e.wall+0.25;
 const anchorV=(rampV+sign*(wall/d.c-innerH))/(1+sign*d.t);
 const at=(h:number,v:number):[number,number]=>[d.c*h+d.s*v,d.s*h-d.c*v];
 const points=[at(wall/d.c-d.t*anchorV,anchorV),at(innerH,rampV),at(innerH,joinV),at(wall/d.c-d.t*joinV,joinV)];
 const [a,b,c]=points;if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<0)points.reverse();
 return points;
}
export function backGussetKeepouts(p:Project) {
 const d=dimensions(p);
 return bottomCenters(p).filter(([,y])=>y>d.surfaceDepth/2).map(([x,y])=>({x:x-4.8,w:9.6,h:Math.max(...bottomGussetProfile(p,y).map(q=>q[1]))+0.5}));
}
export function layoutMargin(p:Project) { const e=p.enclosure; return Math.max(11,Math.max(6,e.wall+3,e.radius+3)+5); }
export function guideBounds(q:Shape){const g=q.guide!;return {x:q.x+q.w/2+g.offsetX-g.innerWidth/2-g.wall,y:q.y+(q.kind==='circle'?q.w:q.h)/2+g.offsetY-g.innerHeight/2-g.wall,w:g.innerWidth+2*g.wall,h:g.innerHeight+2*g.wall};}
export function issues(p:Project):string[] {
 const e=p.enclosure,d=dimensions(p), margin=layoutMargin(p), out:string[]=[];
 if(d.frontHeight<22) out.push('Front height must be at least 22 mm for the screw rails. Increase rear height or reduce depth / total angle.');
 if(d.width<40||d.depth<35) out.push('Case width must be at least 40 mm and depth at least 35 mm.');
 if(e.wall<2||e.wall>6||e.plate<2||e.plate>5) out.push('Wall thickness must be 2–6 mm; bottom plate thickness must be 2–5 mm.');
 if(e.wood==='plastic'&&e.capOuterEdges&&e.edge!=='sharp'&&e.radius>e.woodThickness-1)out.push('Cap edge size must leave at least 1 mm of full-thickness rim.');
 if(e.radius>Math.min(5,e.wall+1))out.push('Profile corner size must not exceed 5 mm or wall thickness + 1 mm.');
 for(const f of ['control','back'] as Face[]) {
  const size=faceSize(p,f);
  for(const q of p.layouts[f]) {
    const h=q.kind==='circle'?q.w:q.h;
    if(q.kind==='rect'&&q.corner&&q.corner!=='sharp'&&(!Number.isFinite(q.radius)||q.radius!<0||q.radius!>Math.min(q.w,q.h)/2))out.push(`Rectangle “${q.name}”: corner size must be between 0 and half the smaller dimension.`);
    if(q.guide){const g=q.guide,b=guideBounds(q);
      if(b.x< -1e-6||b.x+b.w>size.w+1e-6)out.push(`Guide for “${q.name}” extends beyond a side edge.`);
      if(b.y<margin-1e-6||b.y+b.h>size.h-margin+1e-6)out.push(`Guide for “${q.name}” crosses the top/bottom hardware margin.`);
      if(q.x<b.x+g.wall-1e-6||q.y<b.y+g.wall-1e-6||q.x+q.w>b.x+b.w-g.wall+1e-6||q.y+h>b.y+b.h-g.wall+1e-6)out.push(`Guide for “${q.name}”: the cutout must fit inside its guide opening. Increase inner dimensions or reduce the offset.`);
      const reach=e.wall+g.height;
      if(f==='control'){if(d.c*b.y+d.s*reach<e.wall||d.c*(b.y+b.h)+d.s*reach>d.depth-e.wall)out.push(`Guide for “${q.name}” reaches a front or back wall. Reduce guide height or move it.`);const y=d.c*b.y+d.s*reach,z=e.height-d.rise+d.s*b.y-d.c*reach;if(z<d.rise-y*d.t+(e.plate+.25)/d.c)out.push(`Guide for “${q.name}” reaches the bottom plate. Reduce guide height.`);}
      else {if(reach>d.depth-e.wall)out.push(`Guide for “${q.name}” reaches the front wall. Reduce guide height.`);for(const box of backGussetKeepouts(p))if(b.x<box.x+box.w&&b.x+b.w>box.x&&b.y<box.h)out.push(`Guide for “${q.name}” overlaps a bottom-screw gusset.`);const y=d.depth-reach;if(b.y<d.rise-y*d.t+(e.plate+.25)/d.c||b.y+b.h>e.height-d.rise+y*d.t-e.wall/d.c)out.push(`Guide for “${q.name}” reaches the top or bottom. Reduce guide height or move it.`);}
    }
    // Rails protect the top/bottom strips; the open extrusion ends have no side hardware margin.
    if(q.x< -1e-6||q.x+q.w>size.w+1e-6)out.push(`${f==='control'?'Control surface':'Back'}: “${q.name}” extends beyond a side edge.`);
    if(q.y<margin-1e-6||q.y+h>size.h-margin+1e-6)out.push(`${f==='control'?'Control surface':'Back'}: “${q.name}” crosses the ${margin} mm top/bottom hardware margin.`);
    if(f==='back')for(const box of backGussetKeepouts(p))if(q.x<box.x+box.w&&q.x+q.w>box.x&&q.y<box.h)out.push(`Back: “${q.name}” overlaps a bottom-screw gusset. Move it above ${box.h.toFixed(1)} mm or sideways clear of the screw pad.`);
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
 if(!['sharp','chamfer','fillet'].includes(e.edge)||![4,6].includes(e.screws)||!['walnut','maple','cherry','oak','plastic'].includes(e.wood)||!/^#[0-9a-f]{6}$/i.test(e.color)||typeof e.autoSize!=='boolean')throw Error('Invalid enclosure options.');
 Object.assign(base.enclosure,{edge:e.edge,screws:e.screws,wood:e.wood,color:e.color,autoSize:e.autoSize});
 if(e.capOuterEdges!==undefined){if(typeof e.capOuterEdges!=='boolean')throw Error('Invalid cap edge option.');base.enclosure.capOuterEdges=e.capOuterEdges;}
 for(const [k,lo,hi] of [['tool',1,4],['feed',10,1000],['plunge',10,300],['stepDown',0.1,1],['safeZ',2,20],['rpm',1000,10000],['through',0,0.5],['stockMargin',5,30]] as const)base.machining[k]=num(m,k,lo,hi);
 if(![1.5875,3.175].includes(m.tool)||m.workholding!=='tape')throw Error('Unsupported cutter or workholding.');
 const shapes=(arr:unknown):Shape[]=>{
 if(!Array.isArray(arr)||arr.length>400)throw Error('A layout can contain up to 400 cutouts.');
 const ids=new Set<string>();
 return arr.map(q=>{if(!q||!['rect','circle'].includes(q.kind)||typeof q.id!=='string'||ids.has(q.id)||typeof q.name!=='string'||q.name.length>100||(q.group!==undefined&&typeof q.group!=='string'))throw Error('Invalid cutout.');if(q.corner!==undefined&&!['sharp','chamfer','fillet'].includes(q.corner))throw Error('Invalid cutout corner.');if(q.radius!==undefined)num(q,'radius',0,250);ids.add(q.id);return {id:q.id,kind:q.kind,x:num(q,'x',0,1000),y:num(q,'y',0,1000),w:num(q,'w',0.5,500),h:num(q,'h',0.5,500),name:q.name,...(q.corner!==undefined?{corner:q.corner}:{}),...(q.radius!==undefined?{radius:q.radius}:{}),...(q.guide?{guide:{innerWidth:num(q.guide,'innerWidth',.5,500),innerHeight:num(q.guide,'innerHeight',.5,500),wall:num(q.guide,'wall',.4,10),height:num(q.guide,'height',.2,100),offsetX:num(q.guide,'offsetX',-500,500),offsetY:num(q.guide,'offsetY',-500,500)}}:{}),...(q.group?{group:q.group}:{})};});};
 base.layouts={control:shapes(raw.layouts?.control),back:shapes(raw.layouts?.back)};
 if(!Array.isArray(raw.components)||raw.components.length>100)throw Error('Invalid component library.');
 base.components=raw.components.map((c:Component)=>{if(typeof c.name!=='string'||c.name.length>100||typeof c.id!=='string')throw Error('Invalid component.');return {id:c.id,name:c.name,shapes:shapes(c.shapes)};});base.name=raw.name;return base;
}
