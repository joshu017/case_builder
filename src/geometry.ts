import {rectangleOutline} from './layout';
import type { ManifoldToplevel, Manifold, CrossSection, Vec2 } from 'manifold-3d';
import { dimensions, screwCenters, bottomCenters, bottomGussetProfile, guideBounds, issues, type Project, type Shape } from './model';
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
export function railWallChamfers(center:Vec2, wallPoint:Vec2, inward:Vec2, radius=3.6):Vec2[][] {
 const distance=(center[0]-wallPoint[0])*inward[0]+(center[1]-wallPoint[1])*inward[1];
 const tangent:Vec2=[-inward[1],inward[0]], overlap=0.25;
 const intersection=Math.sqrt(Math.max(0,radius*radius-distance*distance));
 const run=Math.max(intersection+1.25,distance-radius+1.25);
 // Intersect the 45-degree line u+v=run with the near circle surface.
 const discriminant=(run+distance)**2-2*(run*run+distance*distance-radius*radius);
 const depth=(run+distance-Math.sqrt(Math.max(0,discriminant)))/2+0.1;
 const origin:Vec2=[center[0]-distance*inward[0],center[1]-distance*inward[1]];
 const at=(u:number,v:number):Vec2=>[origin[0]+u*tangent[0]+v*inward[0],origin[1]+u*tangent[1]+v*inward[1]];
 // A thin wall can sit outside the reduced rail radius. Bridge that gap fully
 // instead of leaving sealed slivers between the rail, wall and print gusset.
 if(distance>=radius-.1){
  const points=[at(-radius,-overlap),at(radius,-overlap),at(radius,distance),at(-radius,distance)];
  const [a,b,c]=points;if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<0)points.reverse();
  return [points];
 }
 return [-1,1].map(sign=>{
  const points=[at(sign*(run+overlap),-overlap),at(sign*(run-depth),depth),at(0,-overlap)];
  const [a,b,c]=points;
  if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<0)points.reverse();
  return points;
 });
}
/** Straight 45-degree gusset covering the full bed-facing half of a rail. */
export function printRailGusset(p:Project,center:Vec2,radius=3.6):Vec2[] {
 const d=dimensions(p),front=center[0]<d.depth/2,sign=front?1:-1;
 // h is across the profile; v increases away from the bed with control face down.
 const h=d.c*center[0]+d.s*center[1],v=d.s*center[0]-d.c*center[1];
 const tangentH=h+sign*radius,tangentV=v-radius*(Math.SQRT2-1)-0.02;
 const wall=front?p.enclosure.wall-0.25:d.depth-p.enclosure.wall+0.25;
 const anchorV=(tangentV+sign*(wall/d.c-tangentH))/(1+sign*d.t);
 const at=(hh:number,vv:number):Vec2=>[d.c*hh+d.s*vv,d.s*hh-d.c*vv];
 const points=[at(wall/d.c-d.t*anchorV,anchorV),at(tangentH,tangentV),at(tangentH,v),center,at(wall/d.c-d.t*v,v)];
 const area=points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
 return area<0?points.reverse():points;
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
   shell=add(shell,move(rotate(cyl(d.width,3.6),[0,90,0]),[0,y,z]));
   const front=i===0||i===3;
   const webs=railWallChamfers(center,[front?e.wall:d.depth-e.wall,0],[front?1:-1,0]);
   if(i>=2)webs.push(...railWallChamfers(center,[0,e.height-d.rise-topOffset],[d.s,-d.c]));
   for(const triangle of webs)shell=add(shell,yz(extrude(cross(triangle),d.width)));
   shell=add(shell,yz(extrude(cross(printRailGusset(p,center)),d.width)));
   if(i<2){
    // Carry the bottom rails all the way to the plate plane. Their round crowns
    // otherwise leave a shallow groove between the wall and local screw pads.
    const railZ=d.s*y+d.c*(z-d.rise);
    if(railZ>e.plate){
     // Match the existing gusset's print-vertical inner edge; a bottom-frame
     // rectangle would introduce an unsupported ledge when the case is sloped.
     const h=d.c*y+d.s*z+(front?3.6:-3.6),v=d.s*y-d.c*z-3.6*(Math.SQRT2-1)-.02;
     const seat=e.plate-.1; // overlap the final trim plane to avoid coplanar Boolean slivers
     const topV=(Math.sin(2*d.a)*h-d.c*d.rise-seat)/Math.cos(2*d.a);
     const wall=front?e.wall-.25:d.depth-e.wall+.25;
     const points:Vec2[]=[[wall,d.rise+(seat-wall*d.s)/d.c],
      [d.c*h+d.s*topV,d.s*h-d.c*topV],
      [d.c*h+d.s*v,d.s*h-d.c*v],[wall,(d.s*wall-v)/d.c]];
     const area=points.reduce((sum,a,j)=>{const b=points[(j+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
     if(area<0)points.reverse();
     shell=add(shell,yz(extrude(cross(points),d.width)));
    }
   }
  }
  for(const [x,y] of bottomCenters(p)) {
   const boss=bottomFrame(move(cyl(4,4.3),[x,y,e.plate]));
   const points=bottomGussetProfile(p,y);
   // A straight triangular rib only at each screw pad, 8.6 mm wide.
   shell=add(shell,boss);
   const rib=move(yz(extrude(cross(points),8.6)),[x-4.3,0,0]);
   // Round the inward edge in the boss's own plane; wallward half remains bonded.
   const front=y<d.surfaceDepth/2,reach=d.surfaceDepth+20;
   const footprint=add(move(cyl(400,4.3),[x,y,-100]),move(cube([8.6,reach,400]),[x-4.3,front?y-reach:y,-100]));
   shell=add(shell,keep(rib.intersect(bottomFrame(footprint))));
  }
  shell=keep(shell.intersect(outer));
  // Trim the entire shell to the screw-pad seating plane: no raised perimeter lip.
  const pocket=bottomFrame(move(cube([d.width+2,d.surfaceDepth+40,e.plate+20]),[-1,-20,-20]));
  shell=cut(shell,pocket);
  // The plate replaces the trimmed profile, including its outside corner treatment.
  // Keep end-cap clearance along X; front/back edges now cover the wall ends.
  const localOuter=rotate(move(outer,[0,0,-d.rise]),[deg,0,0]);
  let bottom=keep(move(cube([d.width-0.5,d.surfaceDepth+40,e.plate]),[0.25,-20,0]).intersect(localOuter));
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
  const shapeSolid=(q:Shape,length:number)=>q.kind==='circle'?move(cyl(length,q.w/2),[q.x+q.w/2,q.y+q.w/2,0]):extrude(cross(rectangleOutline(q)),length);
  for(const face of ['control','back'] as const)for(const q of p.layouts[face])if(q.guide){
   const g=q.guide,b=guideBounds(q);
   const outside=move(cube([b.w,b.h,g.height+.2]),[b.x,b.y,0]);
   const inside=move(cube([g.innerWidth,g.innerHeight,g.height+2]),[b.x+g.wall,b.y+g.wall,-1]);
   const ring=cut(outside,inside);
   const guide=face==='control'?move(rotate(move(ring,[0,0,-e.wall-g.height]),[deg,0,0]),[0,0,e.height-d.rise]):move(rotate(move(ring,[0,0,e.wall-.2]),[90,0,0]),[0,d.depth,0]);
   shell=add(shell,guide);
  }
  for(const q of p.layouts.control) {
    const tool=move(rotate(move(shapeSolid(q,e.wall+2),[0,0,-e.wall-1]),[deg,0,0]),[0,0,e.height-d.rise]);shell=cut(shell,tool);
  }
  for(const q of p.layouts.back) {
    const tool=move(rotate(move(shapeSolid(q,e.wall+2),[0,0,-1]),[90,0,0]),[0,d.depth,0]);shell=cut(shell,tool);
  }
  const capCS=keep(outerCS.offset(e.overhang,'Miter'));
  let cap=extrude(capCS,e.woodThickness);
  if(e.wood==='plastic'&&e.capOuterEdges&&e.edge!=='sharp'&&e.radius>0){
   // Convex hull of inset sections: outside is z=0, mating face stays full-size.
   const r=e.radius,steps=e.edge==='fillet'?24:1,points:[number,number,number][]=[];
   for(let i=0;i<=steps;i++){
    const theta=i/steps*Math.PI/2;
    const z=e.edge==='fillet'?r*(1-Math.cos(theta)):r*i/steps;
    const inset=e.edge==='fillet'?r*(1-Math.sin(theta)):r-z;
    const section=keep(capCS.offset(-inset,'Miter'));
    for(const [x,y] of section.toPolygons()[0])points.push([x,y,z]);
   }
   for(const [x,y] of capCS.toPolygons()[0])points.push([x,y,e.woodThickness]);
   cap=keep(M.hull(points));
  }
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
