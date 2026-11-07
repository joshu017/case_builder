import { type Project } from './model';
export type Point=[number,number];
export type Toolpath={ code:string; paths:Point[][]; width:number; height:number; origin:Point };
export function offsetConvex(input:number[][], distance:number):Point[] {
 let pts=input.map(p=>[p[0],p[1]] as Point);
 const area=pts.reduce((s,a,i)=>{const b=pts[(i+1)%pts.length];return s+a[0]*b[1]-b[0]*a[1];},0);if(area<0)pts=pts.reverse();
 return pts.map((v,i)=>{
  const a=pts[(i+pts.length-1)%pts.length],b=pts[(i+1)%pts.length];
  const u=[v[0]-a[0],v[1]-a[1]],w=[b[0]-v[0],b[1]-v[1]],lu=Math.hypot(...u),lw=Math.hypot(...w);
  const n=[u[1]/lu,-u[0]/lu],m=[w[1]/lw,-w[0]/lw],den=1+n[0]*m[0]+n[1]*m[1];
  return [v[0]+distance*(n[0]+m[0])/den,v[1]+distance*(n[1]+m[1])/den];
 });
}
export function makeToolpath(p:Project,outline:number[][],holes:number[][]):Toolpath {
 const m=p.machining, thick=p.enclosure.woodThickness;
 if(![1.5875,3.175].includes(m.tool))throw Error('Choose a 1/16 or 1/8 inch flat end mill.');
 if(m.workholding!=='tape')throw Error('This toolpath requires double-sided tape workholding.');
 if(m.stepDown<=0||m.stepDown>1||m.safeZ<2||m.safeZ>20||m.feed<=0||m.plunge<=0)throw Error('Invalid machining settings.');
 if(thick<=3)throw Error('Wood must be thicker than the 3 mm screw-head recess.');
 const minX=Math.min(...outline.map(q=>q[0])),minY=Math.min(...outline.map(q=>q[1]));
 const origin:Point=[m.stockMargin-minX,m.stockMargin-minY];
 const outlineTool=offsetConvex(outline,m.tool/2).map(q=>[q[0]+origin[0],q[1]+origin[1]] as Point);
 const width=Math.max(...outline.map(q=>q[0]))-minX+2*m.stockMargin,height=Math.max(...outline.map(q=>q[1]))-minY+2*m.stockMargin;
 if(width>400||height>380||thick+m.safeZ>55)throw Error('End-cap setup exceeds the Masuter 400 × 380 × 55 mm working envelope.');
 const f=(n:number)=>n.toFixed(4),lines=[
 '(Case Builder - FoxAlien Masuter stock 60W - GRBL 1.1h)',
 '(ONE cap per setup - outside face up - run twice for a pair)',
 '(G54 X0 Y0 = lower-left stock corner; Z0 = stock top)',
 '(Double-sided tape on spoilboard. No clamp keepouts or tabs.)',
 '(Confirm tool, stock, feeds, spindle scaling and work offsets before running.)',
 '(No machine homing or automatic unlock in this program.)',
 'G21 G17 G90 G94 G54','G40 G49 G80','G92.1','M5','M9',`G0 Z${f(m.safeZ)}`,`M3 S${Math.round(m.rpm)}`,'G4 P2'];
 const paths:Point[][]=[];
 const safe=()=>lines.push(`G0 Z${f(m.safeZ)}`);
 const rapid=(q:Point)=>lines.push(`G0 X${f(q[0])} Y${f(q[1])}`);
 const point=(q:Point)=>lines.push(`G1 X${f(q[0])} Y${f(q[1])} F${f(m.feed)}`);
 const depths=(depth:number)=>Array.from({length:Math.ceil(depth/m.stepDown)},(_,i)=>-Math.min((i+1)*m.stepDown,depth));
 const pocket=(center:Point,diameter:number,depth:number)=>{
  const maxRadius=(diameter-m.tool)/2;
  if(maxRadius<0)throw Error('Cutter cannot fit the screw hole.');
  const rings=Math.max(1,Math.ceil(maxRadius/(m.tool*0.4)));
  safe();rapid(center);
  for(const z of depths(depth)){
   lines.push(`G1 Z${f(z)} F${f(m.plunge)}`);
   for(let j=1;j<=rings;j++){
    const r=maxRadius*j/rings,loop:Point[]=[];
    for(let n=0;n<=64;n++){const a=n*Math.PI/32;loop.push([center[0]+r*Math.cos(a),center[1]+r*Math.sin(a)]);}
    loop.forEach(point);if(z===depths(depth)[0])paths.push(loop);
   }
   point(center);
  }
  safe();
 };
 lines.push('(Screw head recesses - diameter 6 mm, depth 3 mm)');
 for(const q of holes)pocket([q[0]+origin[0],q[1]+origin[1]],6,3);
 lines.push('(Screw clearance holes - diameter 3.4 mm)');
 for(const q of holes)pocket([q[0]+origin[0],q[1]+origin[1]],3.4,thick+m.through);
 lines.push('(Outside contour - tool radius compensated in coordinates)');
 safe();rapid(outlineTool[0]);
 const loop=[...outlineTool,outlineTool[0]];paths.push(loop);
 for(const z of depths(thick+m.through)){
  lines.push(`G1 Z${f(z)} F${f(m.plunge)}`);loop.slice(1).forEach(point);
 }
 safe();lines.push('M5','M9','M2');
 return {code:lines.join('\n')+'\n',paths,width,height,origin};
}
