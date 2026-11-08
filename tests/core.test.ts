import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import { newProject, dimensions, parseProject, issues, screwCenters, bottomCenters } from '../src/model.ts';
import { buildAssembly, stl, type MeshData } from '../src/geometry.ts';
import { makeToolpath, offsetConvex } from '../src/cam.ts';
import { exportPackage, layoutSVG, layoutDXF } from '../src/export.ts';
import { unzipSync, strFromU8 } from 'fflate';
const wasm=await Module();wasm.setup();
function solid(m:MeshData){return new wasm.Manifold(new wasm.Mesh({numProp:3,vertProperties:m.positions,triVerts:m.indices}));}
function close(a:number,b:number,tol=1e-4){assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);}
function valid(m:MeshData){assert.ok(m.volume>0);const s=solid(m);assert.equal(s.status(),'NoError');const parts=s.decompose();assert.equal(parts.length,1,'part must be one connected solid');parts.forEach(q=>q.delete());s.delete();}
test('10 degree total profile is symmetric with equal 5 degree slopes',()=>{const p=newProject(),d=dimensions(p);close(d.frontHeight,50-2*110*Math.tan(5*Math.PI/180));close(d.rise+(50-d.rise),50);const holes=screwCenters(p);close(holes[0][1]+holes[3][1],50);close(holes[1][1]+holes[2][1],50);});
test('JSON project and component library round trip; malformed and huge inputs rejected',()=>{const p=newProject();p.components.push({id:'part',name:'Test slider',shapes:[{id:'s',name:'slot',kind:'rect',x:0,y:0,w:3,h:20}]});assert.deepEqual(parseProject(JSON.stringify(p)),p);for(const x of [{...p,version:2},{...p,enclosure:{...p.enclosure,angle:99}},{...p,layouts:{control:[{kind:'wat'}],back:[]}}])assert.throws(()=>parseProject(JSON.stringify(x)));assert.throws(()=>parseProject(' '.repeat(2_000_001)));});
test('default and corner variants create watertight connected parts without assembly collisions',()=>{for(const edge of ['sharp','chamfer','fillet'] as const){const p=newProject();p.enclosure.edge=edge;const a=buildAssembly(wasm,p);[a.shell,a.bottom,a.left,a.right].forEach(valid);const shell=solid(a.shell),plate=solid(a.bottom),left=solid(a.left),right=solid(a.right);for(const other of [plate,left,right]){const overlap=shell.intersect(other);close(overlap.volume(),0,1e-3);overlap.delete();}const x=left.boundingBox(),y=right.boundingBox();close(x.min[0],-6);close(y.max[0],186);[shell,plate,left,right].forEach(s=>s.delete());assert.ok(a.printBounds.every(n=>n<=250));}});
test('through cutouts follow the true face planes and leave expected material volume',()=>{const p=newProject(),base=buildAssembly(wasm,p);p.layouts.control=[{id:'c',name:'circle',kind:'circle',x:40,y:30,w:8,h:8}];p.layouts.back=[{id:'r',name:'USB rectangle',kind:'rect',x:60,y:20,w:12,h:8}];const a=buildAssembly(wasm,p);valid(a.shell);close(base.shell.volume-a.shell.volume,(Math.PI*16+12*8)*p.enclosure.wall,0.5);const s=solid(a.shell),d=dimensions(p);assert.equal(s.rayCast([44,34*d.c-10*d.s,50-d.rise+34*d.s+10*d.c],[44,34*d.c+10*d.s,50-d.rise+34*d.s-10*d.c]).length,0);assert.equal(s.rayCast([66,115,24],[66,100,24]).length,0);s.delete();});
test('pilot bores and bottom plate holes align; countersinks face outward',()=>{const p=newProject(),a=buildAssembly(wasm,p),s=solid(a.shell),b=solid(a.bottom),d=dimensions(p);for(const [y,z] of screwCenters(p)){assert.equal(s.rayCast([-1,y,z],[7,y,z]).length,0);assert.ok(s.rayCast([-1,y+2,z],[7,y+2,z]).length>0);}for(const [x,y] of bottomCenters(p)){const point=(n:number):[number,number,number]=>[x,y*d.c+n*d.s,d.rise-y*d.s+n*d.c];assert.equal(s.rayCast(point(-1),point(12)).length,0);assert.equal(b.rayCast(point(-1),point(5)).length,0);}s.delete();b.delete();});
test('six-screw plate, zero overhang and angle zero remain valid',()=>{const p=newProject();p.enclosure.screws=6;p.enclosure.overhang=0;p.enclosure.angle=0;const a=buildAssembly(wasm,p);[a.shell,a.bottom,a.left].forEach(valid);assert.equal(bottomCenters(p).length,6);});
test('thin front and hardware-margin cutouts block geometry exports',()=>{const p=newProject();p.enclosure.height=25;assert.ok(issues(p).length);assert.throws(()=>buildAssembly(wasm,p));p.enclosure.height=50;p.layouts.control=[{id:'s',kind:'rect',name:'slot',x:1,y:10,w:10,h:5}];assert.ok(issues(p).length);});
test('CAM compensates outside contours, respects stepdown, emits modal reset and retracts before travel',()=>{const p=newProject(),a=buildAssembly(wasm,p);for(const tool of [1.5875,3.175]){p.machining.tool=tool;const cam=makeToolpath(p,a.capOutline,a.screwCenters);assert.match(cam.code,/G21 G17 G90 G94 G54/);assert.match(cam.code,/G40 G49 G80/);assert.match(cam.code,/M5\nM9\nM2\n$/);assert.doesNotMatch(cam.code,/G28|G30|M6|\$H|\$X/);let z=Infinity,minimum=0,lastCutZ=0;for(const line of cam.code.split('\n')){const match=line.match(/ Z(-?[\d.]+)/);if(line.startsWith('G0 X'))assert.ok(z>=p.machining.safeZ);if(match){const next=Number(match[1]);if(next<0&&z>=0)lastCutZ=0;if(next<0){assert.ok(lastCutZ-next<=p.machining.stepDown+1e-4);lastCutZ=next;}z=next;minimum=Math.min(minimum,z);}}close(minimum,-6.2);assert.ok(cam.width<400&&cam.height<380);}assert.deepEqual(offsetConvex([[0,0],[10,0],[10,10],[0,10]],1),[[-1,-1],[11,-1],[11,11],[-1,11]]);});
test('ZIP includes reloadable project, valid binary STLs, CNC and unit-aware SVG/DXF',()=>{const p=newProject(),a=buildAssembly(wasm,p),files=unzipSync(exportPackage(p,a));assert.deepEqual(parseProject(strFromU8(files['project.json'])),p);for(const file of ['extrusion.stl','bottom-plate.stl','end-cap-left.stl','end-cap-right.stl']){const b=files[file],view=new DataView(b.buffer,b.byteOffset,b.byteLength);assert.equal(b.length,84+50*view.getUint32(80,true));}assert.match(strFromU8(files['end-cap.nc']),/ONE cap per setup/);assert.match(layoutSVG(p,'control'),/width="180mm"/);assert.match(layoutDXF(p,'control'),/\$INSUNITS\n70\n4/);assert.ok(stl(a.left).length>84);});
test('thick walls reserve extra hardware margin; bottom countersinks stay inside the plate',()=>{for(const wall of [1.6,2,6])for(const plate of [2,5]){const p=newProject();Object.assign(p.enclosure,{wall,plate});const a=buildAssembly(wasm,p);valid(a.shell);valid(a.bottom);const d=dimensions(p),margin=wall/d.c+0.25;for(const [,y] of bottomCenters(p)){assert.ok(y-3.2>margin);assert.ok(y+3.2<d.surfaceDepth-margin);}}});
test('print-oriented rail and screw-pad gussets have no steep internal undersides',()=>{
 for(const angle of [0,10,30])for(const wall of [1.6,2,6]) {
  const p=newProject();Object.assign(p.enclosure,{angle,wall,height:90});const d=dimensions(p),a=buildAssembly(wasm,p);valid(a.shell);
  const minV=-d.c*(p.enclosure.height-d.rise),m=a.shell;
  for(let i=0;i<m.indices.length;i+=3){
   const pts=[0,1,2].map(k=>{const j=m.indices[i+k]*3;return [...m.positions.slice(j,j+3)];});
   const center=pts[0].map((_,k)=>(pts[0][k]+pts[1][k]+pts[2][k])/3);
   // Exclude horizontal end pilot bores and cosmetic first-layer perimeter edges.
   if(center[0]<8.2||center[0]>d.width-8.2||d.s*center[1]-d.c*center[2]-minV<wall+.05)continue;
   const u=pts[1].map((n,k)=>n-pts[0][k]),v=pts[2].map((n,k)=>n-pts[0][k]);
   const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n);
   if(length<1e-6)continue;
   assert.ok((d.s*n[1]-d.c*n[2])/length>=-Math.SQRT1_2-.002,`Unsupported internal facet at ${center}; angle=${angle}, wall=${wall}`);
  }
 }
});
test('plastic cap appearance round-trips without changing manufacturing geometry',()=>{
 const p=newProject();p.enclosure.wood='plastic';p.enclosure.color='#71808a';
 assert.deepEqual(parseProject(JSON.stringify(p)),p);
 const plastic=buildAssembly(wasm,p);p.enclosure.wood='walnut';const wood=buildAssembly(wasm,p);
 for(const part of ['shell','bottom','left','right'] as const)close(plastic[part].volume,wood[part].volume);
});
test('bottom flathead seats taper at 90 degrees on the outside face',()=>{
 const p=newProject(),d=dimensions(p),a=buildAssembly(wasm,p),b=solid(a.bottom),[x,y]=bottomCenters(p)[0];
 const at=(offset:number,z:number):[number,number,number]=>[x+offset,y*d.c+z*d.s,d.rise-y*d.s+z*d.c];
 // At radius 2.5 the cone ends at depth 0.7; higher material remains solid.
 const hits=b.rayCast(at(2.5,-1),at(2.5,4));assert.equal(hits.length,2);
 const clear=b.rayCast(at(2.5,0.1),at(2.5,0.6));assert.equal(clear.length,0);
 const crossing=b.rayCast(at(2.5,0.6),at(2.5,0.8));assert.equal(crossing.length,1);
 close(6-p.enclosure.plate-0.25,2.75);b.delete();
});

test('both cap STLs lie flat with screw-head recesses upward',()=>{
 for(const thickness of [4,6,10]) {
  const p=newProject();p.enclosure.woodThickness=thickness;
  const a=buildAssembly(wasm,p),files=unzipSync(exportPackage(p,a));
  const minY=Math.min(...a.capOutline.map(q=>q[0])),minZ=Math.min(...a.capOutline.map(q=>q[1])),maxZ=Math.max(...a.capOutline.map(q=>q[1]));
  for(const side of ['left','right']) {
   const bytes=files[`end-cap-${side}.stl`],view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),vertices:number[]=[],indices:number[]=[],ids=new Map<string,number>();
   for(let t=0;t<view.getUint32(80,true);t++)for(let k=0;k<3;k++) {
    const pos=[0,1,2].map(c=>view.getFloat32(84+t*50+12+k*12+c*4,true)),key=pos.join(',');
    if(!ids.has(key)){ids.set(key,vertices.length/3);vertices.push(...pos);}indices.push(ids.get(key)!);
   }
   const s=solid({positions:new Float32Array(vertices),indices:new Uint32Array(indices),volume:1});
   assert.equal(s.status(),'NoError');close(s.boundingBox().min[2],0);close(s.boundingBox().max[2],thickness);
   close(s.volume(),a[side==='left'?'left':'right'].volume,0.1);
   for(const [y,z] of a.screwCenters) {
    const x=y-minY+2,yy=side==='left'?maxZ-z:z-minZ;
    assert.equal(s.rayCast([x,yy,thickness-2.5],[x,yy,thickness+1]).length,0,'recess opens upward');
    assert.equal(s.rayCast([x,yy,0.1],[x,yy,thickness+1]).length,1,'recess has a solid floor');
   }
   s.delete();
  }
 }
});

test('rear cutouts cannot cut through the new bottom-screw gussets',()=>{
 const p=newProject();p.layouts.back=[{id:'c',name:'Connector',kind:'rect',x:13,y:13,w:7,h:7}];
 assert.ok(issues(p).some(s=>s.includes('gusset')));
 p.layouts.back[0].x=40;assert.deepEqual(issues(p),[]);
 p.enclosure.screws=6;p.layouts.back[0].x=88;assert.ok(issues(p).some(s=>s.includes('gusset')));
 p.layouts.back[0].y=30;assert.deepEqual(issues(p),[]);
});

test('rounded and chamfered rectangle openings agree with exported contours and solid volume',()=>{
 const p=newProject(),base=buildAssembly(wasm,p);
 for(const corner of ['fillet','chamfer'] as const){const q={id:'usb',name:'USB-C',kind:'rect' as const,x:50.1234,y:21.2345,w:9.2,h:3.2,corner,radius:1.6};p.layouts.back=[q];const a=buildAssembly(wasm,p);valid(a.shell);
 const area=q.w*q.h-(corner==='fillet'?(4-Math.PI)*q.radius**2:2*q.radius**2);close(base.shell.volume-a.shell.volume,area*p.enclosure.wall,.05);
 assert.match(layoutSVG(p,'back'),/<polygon/);assert.match(layoutSVG(p,'back'),/scale\(1 -1\)/);assert.match(layoutDXF(p,'back'),/LWPOLYLINE/);
 }
});
test('internal guides fuse to inside faces, preserve opening, offset and portable project',()=>{
 for(const face of ['control','back'] as const){const p=newProject();const q={id:'guide',name:'Button',kind:'rect' as const,x:50,y:24,w:8,h:6,guide:{innerWidth:12,innerHeight:12,wall:1,height:2,offsetX:1.125,offsetY:.375}};p.layouts[face]=[q];assert.deepEqual(issues(p),[]);assert.deepEqual(parseProject(JSON.stringify(p)),p);
 const guided=buildAssembly(wasm,p);valid(guided.shell);delete (q as any).guide;const plain=buildAssembly(wasm,p);close(guided.shell.volume-plain.shell.volume,(14*14-12*12)*2,.01);
 const s=solid(guided.shell),plate=solid(guided.bottom),overlap=s.intersect(plate);close(overlap.volume(),0,.001);overlap.delete();s.delete();plate.delete();
 }
});
test('guides reject offset apertures outside their cavity and heights reaching the plate',()=>{
 const p=newProject();const q={id:'guide',name:'Button',kind:'rect' as const,x:50,y:30,w:8,h:6,guide:{innerWidth:12,innerHeight:12,wall:1,height:2,offsetX:10,offsetY:0}};p.layouts.control=[q];assert.ok(issues(p).some(s=>s.includes('inside its guide')));q.guide.offsetX=0;q.guide.height=80;assert.ok(issues(p).some(s=>s.includes('bottom plate')));
});
test('bottom gussets no longer project a square shelf beside the circular boss',()=>{
 const p=newProject(),d=dimensions(p),a=buildAssembly(wasm,p),s=solid(a.shell);
 for(const [x,y] of bottomCenters(p)){const sign=y<d.surfaceDepth/2?1:-1;const point=(dx:number,dy:number,z:number):[number,number,number]=>[x+dx,(y+dy)*d.c+z*d.s,d.rise-(y+dy)*d.s+z*d.c];
 // Near the square corner, outside radius 4.3 but inside the former rectangular rib.
 assert.equal(s.rayCast(point(4,sign*3.7,8),point(4,sign*3.7,12)).length,0);
 }
 s.delete();
});

test('plastic outer cap treatment preserves flat mating face, symmetry and portable settings',()=>{
 for(const edge of ['chamfer','fillet'] as const){
  const p=newProject();Object.assign(p.enclosure,{wood:'plastic',edge});const base=buildAssembly(wasm,p);p.enclosure.capOuterEdges=true;assert.deepEqual(parseProject(JSON.stringify(p)),p);const a=buildAssembly(wasm,p);valid(a.left);valid(a.right);assert.ok(a.left.volume<base.left.volume);close(a.left.volume,a.right.volume);assert.deepEqual(a.capOutline,base.capOutline);close(a.shell.volume,base.shell.volume);
  const b=solid(base.left),c=solid(a.left);const slab=wasm.Manifold.cube([.2,200,200]).translate([-.2,-20,-20]);const bi=b.intersect(slab),ci=c.intersect(slab);close(bi.volume(),ci.volume(),.01);[b,c,slab,bi,ci].forEach(x=>x.delete());
  const zip=unzipSync(exportPackage(p,a));assert.match(strFromU8(zip['README.txt']),/G-code does not machine/);
  p.enclosure.wood='walnut';close(buildAssembly(wasm,p).left.volume,base.left.volume);
 }
});
