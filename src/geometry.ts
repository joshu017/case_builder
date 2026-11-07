import type { ManifoldToplevel, Manifold, CrossSection, Vec2 } from 'manifold-3d';
import { dimensions, screwCenters, bottomCenters, issues, type Project, type Shape } from './model';
export type MeshData = { positions: Float32Array; indices: Uint32Array; volume: number };
export type Assembly = { shell:MeshData; bottom:MeshData; left:MeshData; right:MeshData; capOutline:number[][]; screwCenters:number[][]; printBounds:number[] };
export function profile(p:Project):Vec2[] {
 const d=dimensions(p), h=p.enclosure.height;
 return [[0,d.rise],[d.depth,0],[d.depth,h],[0,h-d.rise]];
}
export function softened(poly:Vec2[], amount:number, mode:string):Vec2[] {
 if(mode==='sharp'||amount<=0)return poly;
 const out:Vec2[]=[];
 for(let i=0;i<poly.length;i++) {
  const prev=poly[(i+poly.length-1)%poly.length],v=poly[i],next=poly[(i+1)%poly.length];
  const va=[prev[0]-v[0],prev[1]-v[1]],vb=[next[0]-v[0],next[1]-v[1]],la=Math.hypot(...va),lb=Math.hypot(...vb);
  const u=va.map(x=>x/la),w=vb.map(x=>x/lb),theta=Math.acos(Math.max(-1,Math.min(1,u[0]*w[0]+u[1]*w[1])));
  const tangent=Math.min(amount/Math.tan(theta/2),la/3,lb/3);
  const a:Vec2=[v[0]+u[0]*tangent,v[1]+u[1]*tangent],b:Vec2=[v[0]+w[0]*tangent,v[1]+w[1]*tangent];
  if(mode==='chamfer'){out.push(a,b);continue;}
  const r=tangent*Math.tan(theta/2), bis=[u[0]+w[0],u[1]+w[1]],l=Math.hypot(...bis);
  const center=[v[0]+bis[0]/l*r/Math.sin(theta/2),v[1]+bis[1]/l*r/Math.sin(theta/2)];
  let aa=Math.atan2(a[1]-center[1],a[0]-center[0]),bb=Math.atan2(b[1]-center[1],b[0]-center[0]);while(bb<aa)bb+=Math.PI*2;
  for(let n=0;n<=12;n++){const t=aa+(bb-aa)*n/12;out.push([center[0]+r*Math.cos(t),center[1]+r*Math.sin(t)]);}
 }
 return out;
}
/** Small 1.25 mm chamfers at wall/rail intersections, with a bonded overlap. */
export function railWallChamfers(center:Vec2, wallPoint:Vec2, inward:Vec2, radius=4.3):Vec2[][] {
 const distance=(center[0]-wallPoint[0])*inward[0]+(center[1]-wallPoint[1])*inward[1];
 const tangent:Vec2=[-inward[1],inward[0]], overlap=0.25;
 const intersection=Math.sqrt(Math.max(0,radius*radius-distance*distance));
 const run=Math.max(intersection+1.25,distance-radius+1.25);
 // Intersect the 45-degree line u+v=run with the near circle surface.
 const discriminant=(run+distance)**2-2*(run*run+distance*distance-radius*radius);
 const depth=(run+distance-Math.sqrt(Math.max(0,discriminant)))/2+0.1;
 const origin:Vec2=[center[0]-distance*inward[0],center[1]-distance*inward[1]];
 const at=(u:number,v:number):Vec2=>[origin[0]+u*tangent[0]+v*inward[0],origin[1]+u*tangent[1]+v*inward[1]];
 return [-1,1].map(sign=>{
  const points=[at(sign*(run+overlap),-overlap),at(sign*(run-depth),depth),at(0,-overlap)];
  const [a,b,c]=points;
  if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<0)points.reverse();
  return points;
 });
}
export function buildAssembly(wasm:ManifoldToplevel,p:Project):Assembly {
 const errors=issues(p);if(errors.length)throw Error(errors[0]);
 const objects:(Manifold|CrossSection)[]=[];
 const keep=<T extends Manifold|CrossSection>(o:T):T=>{objects.push(o);return o;};
 const {Manifold:M,CrossSection:C}=wasm, e=p.enclosure,d=dimensions(p),deg=e.angle/2;
 const move=(s:Manifold,v:[number,number,number])=>keep(s.translate(v));
 const rotate=(s:Manifold,a:[number,number,number])=>keep(s.rotate(a));
 const cube=(size:[number,number,number])=>keep(M.cube(size));
 const cyl=(h:number,r:number,r2=r)=>keep(M.cylinder(h,r,r2,48));
 const cross=(pts:Vec2[])=>keep(new C([pts]));
 const extrude=(c:CrossSection,l:number)=>keep(c.extrude(l));
 const yz=(s:Manifold)=>keep(s.transform([0,1,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,1]));
 const cut=(a:Manifold,b:Manifold)=>keep(a.subtract(b));
 const add=(a:Manifold,b:Manifold)=>keep(a.add(b));
 const bottomFrame=(s:Manifold)=>move(rotate(s,[-deg,0,0]),[0,0,d.rise]);
 const mesh=(s:Manifold):MeshData=>{
  if(s.isEmpty()||s.status()!=='NoError')throw Error('Solid generation failed. Check enclosure dimensions.');
  const m=s.getMesh(),pos=new Float32Array(m.numVert*3);
  for(let i=0;i<m.numVert;i++)pos.set(m.vertProperties.slice(i*m.numProp,i*m.numProp+3),i*3);
  return {positions:pos,indices:new Uint32Array(m.triVerts),volume:s.volume()};
 };
 try {
  const outerCS=cross(softened(profile(p),e.radius,e.edge));
  const outer=yz(extrude(outerCS,d.width));
  const topOffset=e.wall/d.c;
  const inner=cross([[e.wall,-20],[d.depth-e.wall,-20],[d.depth-e.wall,e.height-e.wall*d.t-topOffset],[e.wall,e.height-d.rise+e.wall*d.t-topOffset]]);
  let shell=cut(outer,yz(extrude(inner,d.width)));
  for(const [i,center] of screwCenters(p).entries()) {
   const [y,z]=center;
   shell=add(shell,move(rotate(cyl(d.width,4.3),[0,90,0]),[0,y,z]));
   const front=i===0||i===3;
   const webs=railWallChamfers(center,[front?e.wall:d.depth-e.wall,0],[front?1:-1,0]);
   if(i>=2)webs.push(...railWallChamfers(center,[0,e.height-d.rise-topOffset],[d.s,-d.c]));
   for(const triangle of webs)shell=add(shell,yz(extrude(cross(triangle),d.width)));
  }
  for(const [x,y] of bottomCenters(p))shell=add(shell,bottomFrame(move(cyl(9,4.3),[x,y,e.plate])));
  shell=keep(shell.intersect(outer));
  const plateY=e.wall/d.c+0.25, plateDepth=d.surfaceDepth-2*plateY;
  // Pocket extends through the open ends; leaves front/back walls and upper screw rails.
  const pocket=bottomFrame(move(cube([d.width+2,plateDepth+0.5,e.plate+20.25]),[-1,plateY-0.25,-20]));
  shell=cut(shell,pocket);
  let bottom=move(cube([d.width-0.5,plateDepth,e.plate]),[0.25,plateY,0]);
  for(const [x,y] of bottomCenters(p)) {
    shell=cut(shell,bottomFrame(move(cyl(e.plate+11,1.25),[x,y,-1])));
    bottom=cut(bottom,move(cyl(e.plate+2,1.7),[x,y,-1]));
    const boreRadius=1.7, headRadius=3.2, sinkDepth=headRadius-boreRadius; // 90° included angle
    bottom=cut(bottom,move(cyl(sinkDepth+0.1,headRadius+0.1,boreRadius),[x,y,-0.1]));
  }
  for(const [y,z] of screwCenters(p)) {
   shell=cut(shell,move(rotate(cyl(8.1,1.25),[0,90,0]),[-0.1,y,z]));
   shell=cut(shell,move(rotate(cyl(8.1,1.25),[0,90,0]),[d.width-8,y,z]));
  }
  const shapeSolid=(q:Shape,length:number)=>q.kind==='circle'?move(cyl(length,q.w/2),[q.x+q.w/2,q.y+q.w/2,0]):move(cube([q.w,q.h,length]),[q.x,q.y,0]);
  for(const q of p.layouts.control) {
    const tool=move(rotate(move(shapeSolid(q,e.wall+2),[0,0,-e.wall-1]),[deg,0,0]),[0,0,e.height-d.rise]);shell=cut(shell,tool);
  }
  for(const q of p.layouts.back) {
    const tool=move(rotate(move(shapeSolid(q,e.wall+2),[0,0,-1]),[90,0,0]),[0,d.depth,0]);shell=cut(shell,tool);
  }
  const capCS=keep(outerCS.offset(e.overhang,'Miter'));
  let cap=extrude(capCS,e.woodThickness);
  for(const [y,z] of screwCenters(p)) {
   cap=cut(cap,move(cyl(e.woodThickness+2,1.7),[y,z,-1]));
   // Outside face is local z=0; cylindrical socket-head recess.
   cap=cut(cap,move(cyl(3.01,3),[y,z,-0.01]));
  }
  const left=move(yz(cap),[-e.woodThickness,0,0]);
  // Mirror through the width center so both recesses face outwards.
  const right=move(keep(left.mirror([1,0,0])),[d.width,0,0]);
  const printShell=rotate(shell,[180-deg,0,0]), bb=printShell.boundingBox();
  return {shell:mesh(shell),bottom:mesh(bottomFrame(bottom)),left:mesh(left),right:mesh(right),capOutline:capCS.toPolygons()[0],screwCenters:screwCenters(p),printBounds:bb.max.map((v,i)=>v-bb.min[i])};
 } finally {for(const o of objects.reverse())o.delete();}
}
export function stl(mesh:MeshData,transform?:(x:number,y:number,z:number)=>number[]):Uint8Array {
 const v=new Float32Array(mesh.positions), count=mesh.indices.length/3;
 if(transform){for(let i=0;i<v.length;i+=3)v.set(transform(v[i],v[i+1],v[i+2]),i);}
 const min=[Infinity,Infinity,Infinity];for(let i=0;i<v.length;i++)min[i%3]=Math.min(min[i%3],v[i]);
 const bytes=new Uint8Array(84+count*50),view=new DataView(bytes.buffer);view.setUint32(80,count,true);
 for(let t=0;t<count;t++) {
  const pts=[0,1,2].map(k=>{const i=mesh.indices[t*3+k]*3;return [v[i]-min[0],v[i+1]-min[1],v[i+2]-min[2]];});
  const u=pts[1].map((n,i)=>n-pts[0][i]),w=pts[2].map((n,i)=>n-pts[0][i]);let normal=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]],len=Math.hypot(...normal);normal=normal.map(x=>x/(len||1));
  [...normal,...pts.flat()].forEach((n,i)=>view.setFloat32(84+t*50+i*4,n,true));
 }
 return bytes;
}
