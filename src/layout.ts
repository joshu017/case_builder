import {type Shape} from './model';
export const shapeHeight=(q:Shape)=>q.kind==='circle'?q.w:q.h;
export function bounds(items:Shape[]){const x=Math.min(...items.map(q=>q.x)),y=Math.min(...items.map(q=>q.y));return {x,y,w:Math.max(...items.map(q=>q.x+q.w))-x,h:Math.max(...items.map(q=>q.y+shapeHeight(q)))-y};}
/** Input order is selection order; a group is one layout unit. */
export function selectionUnits(items:Shape[]):Shape[][] {const units:Shape[][]=[],groups=new Map<string,Shape[]>();for(const q of items){if(q.group&&groups.has(q.group))groups.get(q.group)!.push(q);else{const unit=[q];units.push(unit);if(q.group)groups.set(q.group,unit);}}return units;}
function arrangeUnchecked(items:Shape[],action:string,size:{w:number;h:number}) {
 if(!items.length)return;
 const axis=action.endsWith('horizontal')?'x':'y',extent=axis==='x'?'w':'h';
 const move=(unit:Shape[],delta:number)=>unit.forEach(q=>q[axis]+=delta);
 if(action.startsWith('center')){const b=bounds(items);move(items,(size[extent]-b[extent])/2-b[axis]);return;}
 const units=selectionUnits(items);if(units.length<2)return;
 // Align horizontally means same Y; vertical alignment means same X.
 if(action.startsWith('align')){const a=axis==='x'?'y':'x',e=a==='x'?'w':'h',first=bounds(units[0]),target=first[a]+first[e]/2;for(const unit of units.slice(1)){const b=bounds(unit),delta=target-b[a]-b[e]/2;unit.forEach(q=>q[a]+=delta);}return;}
 if(units.length<3)return;
 const center=(u:Shape[])=>{const b=bounds(u);return b[axis]+b[extent]/2;};
 units.sort((a,b)=>center(a)-center(b));const lo=center(units[0]),hi=center(units.at(-1)!);
 units.slice(1,-1).forEach((u,i)=>move(u,lo+(hi-lo)*(i+1)/(units.length-1)-center(u)));
}
export function arrange(items:Shape[],action:string,size:{w:number;h:number}){
 const before=items.map(q=>[q.x,q.y]);arrangeUnchecked(items,action,size);
 if(items.some(q=>q.x<0||q.y<0||q.x>1000||q.y>1000)){items.forEach((q,i)=>{q.x=before[i][0];q.y=before[i][1];});throw Error('This arrangement would move cutouts outside the coordinate range. Move the anchor or increase the face size first.');}
}
export function marqueeSelection(items:Shape[],box:{x:number;y:number;w:number;h:number}):string[]{
 const hits=items.filter(q=>q.x<box.x+box.w&&q.x+q.w>box.x&&q.y<box.y+box.h&&q.y+shapeHeight(q)>box.y),groups=new Set(hits.map(q=>q.group).filter(Boolean));
 return items.filter(q=>hits.includes(q)||(q.group&&groups.has(q.group))).map(q=>q.id);
}
/** Shared tessellation for CAD, editor and vector exports. Radius is never silently clamped. */
export function rectangleOutline(q:Shape):[number,number][] {
 const {x,y,w,h}=q,r=q.corner&&q.corner!=='sharp'?(q.radius??0):0;
 if(!r)return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
 if(q.corner==='chamfer')return [[x+r,y],[x+w-r,y],[x+w,y+r],[x+w,y+h-r],[x+w-r,y+h],[x+r,y+h],[x,y+h-r],[x,y+r]];
 const points:[number,number][]=[];
 for(const [cx,cy,start] of [[x+w-r,y+r,-90],[x+w-r,y+h-r,0],[x+r,y+h-r,90],[x+r,y+r,180]])for(let i=0;i<=16;i++){const a=(start+i*90/16)*Math.PI/180;points.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
 return points;
}

export type PatternOptions={kind:'rectangular';columns:number;rows:number;dx:number;dy:number}|{kind:'circular';count:number;centerX:number;centerY:number;angle:number};
/** Return independent copies only; original selection is the first occurrence. */
export function patternCopies(source:Shape[],options:PatternOptions,capacity=400):Shape[]{
 if(!source.length)throw Error('Select at least one cutout.');
 const offsets:[number,number][]=[];
 if(options.kind==='rectangular'){
  const {columns,rows,dx,dy}=options;
  if(!Number.isInteger(columns)||!Number.isInteger(rows)||columns<1||rows<1||columns>20||rows>20||!Number.isFinite(dx)||!Number.isFinite(dy)||dx<=0||dy<=0)throw Error('Use 1–20 rows and columns with positive spacing.');
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)if(x||y)offsets.push([x*dx,y*dy]);
 }else{
  const {count,centerX,centerY,angle}=options;
  if(!Number.isInteger(count)||count<2||count>400||![centerX,centerY,angle].every(Number.isFinite)||angle===0||Math.abs(angle)>360)throw Error('Use 2–400 instances and an angle between −360° and 360° (excluding zero).');
  const b=bounds(source),vx=b.x+b.w/2-centerX,vy=b.y+b.h/2-centerY;
  if(Math.hypot(vx,vy)<1e-6)throw Error('Move the pattern center away from the selection center to set a radius.');
  const divisor=Math.abs(angle)===360?count:count-1;
  for(let i=1;i<count;i++){const a=angle*Math.PI/180*i/divisor;offsets.push([vx*Math.cos(a)-vy*Math.sin(a)-vx,vx*Math.sin(a)+vy*Math.cos(a)-vy]);}
 }
 if(!offsets.length)throw Error('Choose a pattern with at least two instances.');
 if(offsets.length*source.length>capacity)throw Error('Pattern exceeds the 400 cutouts per face limit.');
 const result=offsets.flatMap(([dx,dy])=>{const groups=new Map<string,string>();return source.map(q=>{const copy=structuredClone(q);copy.id=crypto.randomUUID();copy.x+=dx;copy.y+=dy;if(q.group){if(!groups.has(q.group))groups.set(q.group,crypto.randomUUID());copy.group=groups.get(q.group)!;}return copy;});});
 if(result.some(q=>q.x< -1e-6||q.y< -1e-6||q.x>1000||q.y>1000))throw Error('Pattern exceeds the coordinate range. Adjust the center, angle or spacing.');
 result.forEach(q=>{q.x=Math.max(0,q.x);q.y=Math.max(0,q.y);});return result;
}
