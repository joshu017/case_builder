import { zipSync, strToU8 } from 'fflate';
import { type Project, type Face, faceSize, dimensions } from './model';
import { stl, type Assembly } from './geometry';
import { makeToolpath } from './cam';
export const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function layoutSVG(p:Project,f:Face):string {
 const {w,h}=faceSize(p,f);
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}"><title>${escape(p.name)} — ${f} cutouts in millimeters</title><g fill="none" stroke="black" stroke-width="0.1">${p.layouts[f].map(q=>q.kind==='circle'?`<circle cx="${q.x+q.w/2}" cy="${q.y+q.w/2}" r="${q.w/2}"/>`:`<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}"/>`).join('')}</g></svg>`;
}
export function layoutDXF(p:Project,f:Face):string {
 const size=faceSize(p,f);
 const entities=p.layouts[f].map(q=>{
 if(q.kind==='circle')return `0\nCIRCLE\n8\nCUTOUTS\n10\n${q.x+q.w/2}\n20\n${size.h-q.y-q.w/2}\n40\n${q.w/2}\n`;
 const pts=[[q.x,size.h-q.y],[q.x+q.w,size.h-q.y],[q.x+q.w,size.h-q.y-q.h],[q.x,size.h-q.y-q.h]];
 return `0\nLWPOLYLINE\n8\nCUTOUTS\n90\n4\n70\n1\n${pts.map(v=>`10\n${v[0]}\n20\n${v[1]}\n`).join('')}`;
 }).join('');
 return `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`;
}
export function exportPackage(p:Project,a:Assembly):Uint8Array {
 const d=dimensions(p),cam=makeToolpath(p,a.capOutline,a.screwCenters);
 if(a.printBounds.some(n=>n>250))throw Error('The shell exceeds the configured 250 mm printer envelope in control-surface-down orientation. Reduce the case dimensions.');
 const rot=(angle:number)=>(x:number,y:number,z:number)=>[x,y*Math.cos(angle)-z*Math.sin(angle),y*Math.sin(angle)+z*Math.cos(angle)];
 const readme=`${p.name}\n\nProject JSON includes both layouts, custom components and manufacturing settings. Import project.json to continue editing. All dimensions are millimeters.\n\nPRINTING\nextrusion.stl is already control-surface down, minimum Z=0. bottom-plate.stl is flat, external face on the bed. Shell print envelope: ${a.printBounds.map(n=>n.toFixed(2)).join(' x ')} mm. Back cutouts require support. Pilot bores are nominal 2.5 mm for manual M3 tapping; verify printer fit using a small test before a full print.\n\nCNC\nend-cap.nc makes ONE cap, outside face upward. Repeat with fresh stock to make the other cap; symmetric geometry needs no mirror operation. End-cap outline includes ${p.enclosure.overhang} mm overhang. Stock thickness ${p.enclosure.woodThickness} mm. Minimum stock rectangle ${cam.width.toFixed(2)} x ${cam.height.toFixed(2)} mm. G54 XY zero is the lower-left stock corner; Z zero is the top of the wood. G92 offsets are cleared by the program. Set the G54 work offset explicitly in the sender. Double-sided tape and a sacrificial spoilboard are required. No clamps or tabs are modeled. Through-cut allowance ${p.machining.through} mm.\n\nFlat end mill ${p.machining.tool} mm; feed ${p.machining.feed} mm/min; plunge ${p.machining.plunge} mm/min; stepdown ${p.machining.stepDown} mm; S${p.machining.rpm}. These are provisional test settings, not validated feeds for your wood/tool. Confirm GRBL spindle scaling ($30), milling mode ($32=0), usable travel and clearance. Review in a G-code viewer and air-cut before cutting stock. No homing, unlocking, tool changes or automatic machine return are emitted.\n\nHARDWARE\nFour M3 socket-head screws per wooden cap, 3.4 mm clearance holes and 6 mm x 3 mm cylindrical recesses. Bottom: ${p.enclosure.screws} M3x6 flathead screws, 3.4 mm bores, 6.4 mm 90-degree countersinks, 1.5 mm deep from the exterior face. M3x6 includes the head in its 6 mm overall length; nominal boss engagement with this plate is ${(6-p.enclosure.plate-0.25).toFixed(2)} mm. Use longer screws with thicker plates. Head dimensions are assumed from the photo, not a verified drawing; confirm actual hardware fits. Bottom and end screws must not meet.\n\nLAYOUTS\nSVG and DXF contain cutouts only, at true face scale. SVG uses upper-left origin; DXF reverses Y for CAD coordinates. Editor control-surface Y measures from front toward back; back Y measures upward from the rear bottom.\n`;
 return zipSync({'project.json':strToU8(JSON.stringify(p,null,2)),'extrusion.stl':stl(a.shell,rot(Math.PI-d.a)),'bottom-plate.stl':stl(a.bottom,rot(d.a)),'end-cap.nc':strToU8(cam.code),'control-surface.svg':strToU8(layoutSVG(p,'control')),'control-surface.dxf':strToU8(layoutDXF(p,'control')),'back.svg':strToU8(layoutSVG(p,'back')),'back.dxf':strToU8(layoutDXF(p,'back')),'README.txt':strToU8(readme)});
}
export function download(data:string|Uint8Array,name:string,type='application/octet-stream') {
 const blob=new Blob([typeof data==='string'?data:new Uint8Array(data)],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
