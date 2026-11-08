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
