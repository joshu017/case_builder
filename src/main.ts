import {patternCopies,arrange,selectionUnits,marqueeSelection,rectangleOutline,shapeHeight} from './layout';
import Module from 'manifold-3d';
import wasmUrl from 'manifold-3d/manifold.wasm?url';
import { newProject, componentLibrary, parseProject, dimensions, faceSize, guideBounds, layoutMargin, clone, uid, issues, type Component, type Project, type Shape, type Face } from './model';
import { buildAssembly, type Assembly } from './geometry';
import { Preview } from './preview';
import { download, exportPackage, layoutDXF, layoutSVG, escape as esc } from './export';
import { makeToolpath } from './cam';
import './style.css';
const $=<T extends Element=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
let project=newProject(),face:Face='control',tab='control',selected=new Set<string>(),clipboard:Shape[]=[],undo:Project[]=[],redo:Project[]=[],assembly:Assembly|null=null,exploded=false,showPlate=true,preview:Preview|null=null;
let startup='';try{const saved=localStorage.getItem('case-builder-v1');if(saved)project=parseProject(saved);}catch{startup='Saved project could not be loaded. Import a project JSON or start a new design.';}
const app=$('#app');
app.innerHTML=`<header><div class="brand"><span class="brand-icon">▱</span><span>Case Builder</span></div><div class="project-title"><input id="project-name" aria-label="Project name" maxlength="100"><span id="save-state" role="status" aria-label="Saved on this device" title="Saved on this device">Saved on this device</span></div><div class="header-actions"><button data-action="new">New</button><button data-action="open">Open project</button><button data-action="save">Save project</button><button class="primary" data-action="package">Export package <span>↗</span></button></div><input type="file" id="import-file" accept=".json,application/json" hidden></header>
<nav aria-label="Design views"><button data-tab="control" class="active">01 <span>Control surface</span></button><button data-tab="back">02 <span>Back</span></button><button data-tab="assembly">03 <span>Assembly</span></button><button data-tab="manufacturing">04 <span>Manufacturing</span></button><div class="units">All dimensions in mm</div></nav>
<main><aside id="left-panel"></aside><section class="workspace"><div class="workspace-heading"><div><span class="eyebrow" id="scope"></span><h1 id="view-title"></h1></div><div id="notice" role="status" aria-live="polite"></div><div id="view-actions"></div></div><div id="editor-wrap"><div class="editor-toolbar"><div class="shape-tools"><button class="icon-button" data-action="add-rect" title="Rectangle" aria-label="Rectangle"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="12" fill="none" stroke="currentColor" stroke-width="2.4"/></svg></button><button class="icon-button" data-action="add-circle" title="Circle" aria-label="Circle"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/></svg></button></div><div class="position-tools"><div id="layout-tools"></div><button data-action="pattern" aria-haspopup="dialog" aria-expanded="false">Pattern</button></div><div id="pattern-dialog" role="dialog" aria-label="Pattern selection" hidden></div><div class="editor-actions"><button data-action="undo" title="Undo (⌘Z)">↶ Undo</button><button data-action="redo" title="Redo (⌘⇧Z)">↷</button><button data-action="fit">Fit view</button><button data-action="svg">Export SVG</button><button data-action="dxf">Export DXF</button></div></div><div class="drawing"><svg id="canvas" role="img" aria-label="Cutout layout editor"></svg></div><div class="canvas-footer"><span id="canvas-size"></span><span>Drag to move · Drag empty space to select · Shift adds · Arrow keys nudge 1 mm</span></div></div><div id="assembly-wrap"><div id="preview"></div><div class="preview-controls"><span>Drag to rotate · Scroll to zoom</span><button data-action="explode">Exploded view</button><button data-action="plate">Hide plate</button><button data-action="fit3d">Reset view</button></div></div><div id="manufacturing-wrap"></div><div id="bottom-info"></div></section><aside id="right-panel"></aside></main><div id="toast" role="status"></div>`;
$('#project-name').setAttribute('value',project.name);
try{preview=new Preview($('#preview'));}catch{ $('#preview').textContent='3D preview is unavailable: WebGL could not start. Geometry and file exports remain available.'; }
const wasmPromise=Module({locateFile:()=>wasmUrl}).then(w=>{w.setup();return w;});
let geometryTimer:ReturnType<typeof setTimeout>,revision=0;
function setSaveState(message:string){const el=$('#save-state');el.textContent=message;el.setAttribute('aria-label',message);el.title=message;el.classList.toggle('save-error',message!=='Saved on this device');}
function persist(){try{localStorage.setItem('case-builder-v1',JSON.stringify(project));setSaveState('Saved on this device');}catch{setSaveState('Local save unavailable — download project');}}
function checkpoint(){undo.push(clone(project));if(undo.length>50)undo.shift();redo=[];}
function change(fn:()=>void){checkpoint();fn();persist();render();queueGeometry();}
function toast(text:string){$('#toast').textContent=text;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),4500);}
function shapes(){return project.layouts[face];}
function picked(){return [...selected].map(id=>shapes().find(q=>q.id===id)).filter((q):q is Shape=>Boolean(q));}
function queueGeometry(){const rev=++revision;assembly=null;clearTimeout(geometryTimer);geometryTimer=setTimeout(async()=>{try{const errors=issues(project);if(errors.length){renderStatus();return;}const w=await wasmPromise;if(rev!==revision)return;const result=buildAssembly(w,project);if(rev!==revision)return;assembly=result;preview?.set(result,project,exploded,showPlate);renderStatus();if(tab==='manufacturing')renderManufacturing();}catch(err){$('#notice').textContent=String(err instanceof Error?err.message:err);$('#notice').className='error';}},180);renderStatus();}
const field=(label:string,key:string,value:number,min:number,max:number,step=1)=>`<label class="field"><span>${label}</span><div><input type="number" data-e="${key}" value="${value}" min="${min}" max="${max}" step="any" aria-label="${label}"><span>mm</span></div></label>`;
const mfield=(label:string,key:string,value:number,min:number,max:number,step=1,unit='mm')=>`<label class="field"><span>${label}</span><div><input type="number" data-m="${key}" value="${value}" min="${min}" max="${max}" step="any" aria-label="${label}"><span>${unit}</span></div></label>`;
function render(){
 closePattern(false);
 $('.workspace').dataset.view=tab;
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',(b as HTMLElement).dataset.tab===tab));
 const editing=tab==='control'||tab==='back';
 $('#editor-wrap').hidden=!editing;$('#assembly-wrap').hidden=tab!=='assembly';$('#manufacturing-wrap').hidden=tab!=='manufacturing';
 $('#scope').textContent=editing?'LAYOUT · '+(face==='control'?'UPPER SLOPED FACE':'WIDE REAR FACE'):tab==='assembly'?'ASSEMBLED ENCLOSURE':'FABRICATION SETUP';
 $('#view-title').textContent=tab==='control'?'Control surface':tab==='back'?'Back':tab==='assembly'?'Assembly':'Manufacturing';
 $('.workspace-heading').hidden=editing;
 $(editing?'.editor-toolbar':'.workspace-heading').append($('#notice'));
 $('#view-actions').innerHTML='<span class="badge">SYMMETRIC PROFILE</span>';
 const d=dimensions(project),e=project.enclosure;
 $('#left-panel').innerHTML=`<div class="section-title"><h2>${editing?'Cutouts':'Parts'}</h2><span>${editing?shapes().length:4}</span></div>${editing?(shapes().length?`<div class="object-list">${shapes().map(q=>`<button data-select="${esc(q.id)}" class="object ${selected.has(q.id)?'chosen':''}"><span>${q.kind==='circle'?'○':'▭'}</span><span>${esc(q.name)}${q.group?'<small>Grouped</small>':''}</span></button>`).join('')}</div>`:'<p class="muted empty-copy">No cutouts yet. Add a rectangle or circle to this face.</p>'):'<ul class="parts-list"><li>Plastic extrusion</li><li>Bottom plate</li><li>Left end cap</li><li>Right end cap</li></ul>'}<div class="section-title"><h2>Component library</h2><span>${componentLibrary(project).length}</span></div><p class="muted">Custom components travel with this project and work on either face.</p>${componentLibrary(project).map(c=>`<button class="library-item" data-component="${esc(c.id)}"><span>⊞</span><div>${esc(c.name)}<small>${c.shapes.length} cutouts</small></div><span>+</span></button>`).join('')}${componentLibrary(project).length?'':'<div class="empty-library">Select cutouts, then save them as a component.</div>'}<div class="left-foot"><span class="status-dot"></span> Local-first project<small>Saved in this browser. Download a project file to keep a portable copy.</small></div>`;
 renderInspector();renderCanvas();renderToolbar();renderStatus();if(tab==='manufacturing')renderManufacturing();
 $('#bottom-info').innerHTML=`<div><span>PLASTIC FOOTPRINT</span><strong>${d.width.toFixed(1)} × ${d.depth.toFixed(1)} mm</strong></div><div><span>REAR / FRONT HEIGHT</span><strong>${e.height.toFixed(1)} / ${d.frontHeight.toFixed(1)} mm</strong></div><div><span>TOTAL INCLUDED ANGLE</span><strong>${e.angle}° <small>(±${e.angle/2}°)</small></strong></div><div><span>END CAPS</span><strong>${e.woodThickness} mm ${e.wood}</strong></div>`;
}
const toolIcons:Record<string,string>={
 'align-horizontal':'<path d="M2 12h20"/><rect x="5" y="5" width="4" height="14"/><rect x="15" y="8" width="4" height="8"/>',
 'align-vertical':'<path d="M12 2v20"/><rect x="5" y="5" width="14" height="4"/><rect x="8" y="15" width="8" height="4"/>',
 'distribute-horizontal':'<path d="M3 3v18M21 3v18"/><rect x="6" y="7" width="3" height="10"/><rect x="15" y="7" width="3" height="10"/><path d="M10 12h4"/>',
 'distribute-vertical':'<path d="M3 3h18M3 21h18"/><rect x="7" y="6" width="10" height="3"/><rect x="7" y="15" width="10" height="3"/><path d="M12 10v4"/>',
 'center-horizontal':'<path d="M3 3v18M21 3v18M3 12h5m8 0h5"/><rect x="9" y="7" width="6" height="10"/>',
 'center-vertical':'<path d="M3 3h18M3 21h18M12 3v5m0 8v5"/><rect x="7" y="9" width="10" height="6"/>'};
function renderToolbar(){const ps=picked(),count=selectionUnits(ps).length;$<HTMLButtonElement>('[data-action="pattern"]').disabled=!ps.length;$('#layout-tools').innerHTML=Object.entries(toolIcons).map(([action,icon])=>`<button class="icon-button" data-action="${action}" title="${action.replace('-',' ')}" aria-label="${action.replace('-',' ')}" ${count<(action.startsWith('center')?1:action.startsWith('align')?2:3)?'disabled':''}><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg></button>`).join('');}
function guideInspector(q:Shape){return `<section class="settings-section"><h3>Internal guide</h3><label class="check"><input type="checkbox" id="guide-enabled" ${q.guide?'checked':''}> Add rectangular guide</label>${q.guide?`<div class="field-grid">${[['Inner width','innerWidth',.5,500],['Inner height','innerHeight',.5,500],['Wall thickness','wall',.4,10],['Guide height','height',.2,100],['X offset','offsetX',-500,500],['Y offset','offsetY',-500,500]].map(([label,key,min,max])=>`<label class="field">${label}<input aria-label="${label}" data-guide="${key}" type="number" step="any" min="${min}" max="${max}" value="${q.guide![key as keyof NonNullable<Shape['guide']>]}"></label>`).join('')}</div><p class="hint">Inner opening centered on the cutout, plus offsets. Positive Y points toward the back/top. Height extends inward from the inside face; shown dashed in the editor.</p>`:''}</section>`;}
function focusKey(el:Element|null):string {
 if(!el)return '';for(const key of ['id','data-shape','data-guide','data-e','data-m','data-corner','data-action'])if(el.hasAttribute(key))return `${key}:${el.getAttribute(key)}`;return '';
}
function inspectorControls(){return [...document.querySelectorAll<HTMLElement>('#right-panel input,#right-panel select,#right-panel button')].filter(el=>!el.hasAttribute('disabled')&&el.getClientRects().length>0);}
function renderInspector(){
 const focused=$('#right-panel').contains(document.activeElement)?focusKey(document.activeElement):'';

 const e=project.enclosure,ps=picked(),editing=tab==='control'||tab==='back';
 const selection=editing?`<div class="section-title"><h2>Selection</h2><span>${ps.length}</span></div>${ps.length?`${ps.length===1?`<label class="wide-field">Name<input id="shape-name" value="${esc(ps[0].name)}" maxlength="100"></label><div class="field-grid">${[['X','x'],['Y','y'],[ps[0].kind==='circle'?'Diameter':'Width','w'],...(ps[0].kind==='rect'?[['Height','h']]:[])].map(([label,k])=>`<label class="field"><span>${label}</span><input type="number" data-shape="${k}" value="${ps[0][k as 'x'|'y'|'w'|'h']}" min="${k==='x'||k==='y'?0:0.5}" max="${k==='x'||k==='y'?1000:500}" step="any"></label>`).join('')}</div>${ps[0].kind==='rect'?`<div class="field-grid"><label class="wide-field">Cutout corners<select data-corner>${['sharp','chamfer','fillet'].map(v=>`<option ${(ps[0].corner??'sharp')===v?'selected':''}>${v}</option>`).join('')}</select></label>${ps[0].corner&&ps[0].corner!=='sharp'?`<label class="field">Corner radius / size<input aria-label="Cutout corner size" data-shape="radius" type="number" step="any" min="0" max="${Math.min(ps[0].w,ps[0].h)/2}" value="${ps[0].radius??0}"></label>`:''}</div>`:''}`:`<p class="muted">${ps.length} cutouts selected. Drag to move together. Align anchor: ${esc(ps[0].name)}${ps[0].group?' group':''}.</p>`}${ps.length===1?guideInspector(ps[0]):''}<div class="button-row"><button data-action="copy">Copy</button><button data-action="paste">Paste</button><button data-action="delete" class="danger">Delete</button></div><div class="button-row"><button data-action="group">Group</button><button data-action="ungroup">Ungroup</button></div><label class="wide-field">Component name<input id="component-name" placeholder="e.g. Slider with mounting holes" maxlength="100"></label><button data-action="save-component" class="full">Save selection to library</button>`:'<p class="muted">Select a cutout to edit. Shift-click for multiple.</p>'}<hr>`:'';
 $('#right-panel').innerHTML=selection+`<div class="section-title"><h2>Enclosure</h2><span>mm</span></div><label class="check"><input id="auto-size" type="checkbox" ${e.autoSize?'checked':''}> Size from control layout</label><p class="hint">${e.autoSize?'Cutout extents + padding determine width and depth.':'Set dimensions directly, or size them from your layout.'}</p><div class="field-grid">${e.autoSize?field('Padding','padding',e.padding,12,100):field('Width','width',e.width,40,1000)+field('Depth','depth',e.depth,35,1000)}${field('Rear height','height',e.height,22,300)}<label class="field"><span>Total angle</span><div><input type="number" data-e="angle" aria-label="Total angle" value="${e.angle}" min="0" max="30" step="any"><span>°</span></div></label></div><p class="hint">Symmetric slopes: +${e.angle/2}° / −${e.angle/2}°.</p><section class="settings-section"><h3>Walls & bottom plate</h3><div class="field-grid">${field('Wall','wall',e.wall,1.6,6,0.5)}${field('Plate','plate',e.plate,2,5,0.5)}</div><label class="wide-field">Bottom screws<select data-e="screws"><option value="4" ${e.screws===4?'selected':''}>4 × M3×6 flathead</option><option value="6" ${e.screws===6?'selected':''}>6 × M3×6 flathead</option></select></label><p class="hint">Ø2.5 mm tap bores · 45° print gussets. Bottom: Ø3.4 / 6.4 mm, 90° countersinks. M3×6 engagement: ~ ${(6-e.plate-0.25).toFixed(2)} mm.${e.plate>3?' Use longer screws for thicker plates.':''}</p></section><section class="settings-section"><h3>End caps & profile</h3><div class="field-grid">${field('Cap thickness','woodThickness',e.woodThickness,4,25,0.5)}${field('Overhang','overhang',e.overhang,0,10,0.5)}</div><div class="field-grid profile-fields"><label class="wide-field">Profile corners<select data-e="edge">${['sharp','chamfer','fillet'].map(v=>`<option ${e.edge===v?'selected':''}>${v}</option>`).join('')}</select></label>${e.edge!=='sharp'?field(e.edge==='fillet'?'Radius':'Corner size','radius',e.radius,0,5,0.5):''}</div>${e.wood==='plastic'?`<label class="check"><input type="checkbox" data-e="capOuterEdges" ${e.capOuterEdges?'checked':''}> Apply profile corners to all four outside cap edges</label>`:''}<p class="hint">Four M3 socket-head screws per cap.</p></section><section class="settings-section"><h3>Appearance</h3><div class="field-grid appearance-fields"><label class="wide-field">Plastic color<input type="color" data-e="color" value="${e.color}"></label><label class="wide-field">Wood<select data-e="wood">${['walnut','maple','cherry','oak','plastic'].map(v=>`<option ${e.wood===v?'selected':''}>${v}</option>`).join('')}</select></label></div></section>`;
 if(focused)inspectorControls().find(el=>focusKey(el)===focused)?.focus({preventScroll:true});
}
function renderStatus(){
 const errs=issues(project),notice=$('#notice');notice.className=errs.length?'error':assembly?'':'loading';
 notice.textContent=errs.length?errs.join(' '):assembly?(startup||''):'Updating solid geometry…';
 document.querySelectorAll<HTMLButtonElement>('[data-action="package"]').forEach(b=>{b.disabled=!assembly||errs.length>0;});
}
function renderCanvas(){
 const svg=$<SVGSVGElement>('#canvas'),size=faceSize(project,face),m=16,margin=layoutMargin(project);
 svg.setAttribute('viewBox',`${-m} ${-m} ${size.w+2*m} ${size.h+2*m}`);
 svg.innerHTML=`<defs><pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="#ccd6de" stroke-width="0.15"/></pattern></defs><rect x="0" y="0" width="${size.w}" height="${size.h}" rx="1.5" fill="#eef3f6" stroke="#607482" stroke-width="0.35"/><rect width="${size.w}" height="${size.h}" fill="url(#grid)"/><path d="M 0 ${margin} H ${size.w} M 0 ${size.h-margin} H ${size.w}" fill="none" stroke="#8c9eac" stroke-dasharray="1.2 1.5" stroke-width="0.3"/><text class="face-label" x="${size.w/2}" y="-3" text-anchor="middle">${face==='control'?'BACK EDGE':'TOP EDGE'}</text><text class="face-label" x="${size.w/2}" y="${size.h+6}" text-anchor="middle">${face==='control'?'FRONT EDGE':'BOTTOM EDGE'}</text>${patternDisplayShapes().filter(q=>q.guide).map(q=>{const b=guideBounds(q),g=q.guide!;return `<g class="guide-outline" pointer-events="none"><rect x="${b.x}" y="${size.h-b.y-b.h}" width="${b.w}" height="${b.h}"/><rect x="${b.x+g.wall}" y="${size.h-b.y-b.h+g.wall}" width="${g.innerWidth}" height="${g.innerHeight}"/></g>`;}).join('')}${patternDisplayShapes().map(q=>{const attrs=`data-id="${esc(q.id)}" class="cutout ${selected.has(q.id)?'selected':''}" fill="${selected.has(q.id)?'#f8c6b9':'#c4cfd7'}" stroke="${selected.has(q.id)?'#bd341a':'#4a5661'}" stroke-width="${selected.has(q.id)?0.8:0.4}"`;return q.kind==='circle'?`<circle ${attrs} cx="${q.x+q.w/2}" cy="${size.h-q.y-q.w/2}" r="${q.w/2}"><title>${esc(q.name)} · Ø${q.w} mm</title></circle>`:`<polygon ${attrs} points="${rectangleOutline(q).map(([x,y])=>`${x},${size.h-y}`).join(' ')}"><title>${esc(q.name)} · ${q.w} × ${q.h} mm</title></polygon>`;}).join('')}${!shapes().length?`<text class="empty-subtitle" x="${size.w/2}" y="${size.h/2+5}" text-anchor="middle">Add a shape from above</text>`:''}`;
 renderPatternPreview();
 $('#canvas-size').textContent=`${size.w.toFixed(1)} × ${size.h.toFixed(1)} mm · ${shapes().length} cutouts`;
}
function renderManufacturing(){
 const m=project.machining;let cam;try{if(assembly)cam=makeToolpath(project,assembly.capOutline,assembly.screwCenters);}catch{}
 $('#manufacturing-wrap').innerHTML=`<div class="manufacturing-grid"><div class="setup-card"><div class="eyebrow">3-AXIS MILL</div><h2>FoxAlien Masuter</h2><p>Stock 60 W spindle · GRBL 1.1h</p><label class="wide-field">Flat end mill<select data-m="tool"><option value="1.5875" ${m.tool===1.5875?'selected':''}>1/16 inch · 1.5875 mm</option><option value="3.175" ${m.tool===3.175?'selected':''}>1/8 inch · 3.175 mm</option></select></label><div class="field-grid">${mfield('Feed','feed',m.feed,10,1000,10,'mm/min')}${mfield('Plunge','plunge',m.plunge,10,300,10,'mm/min')}${mfield('Stepdown','stepDown',m.stepDown,0.1,1,0.1)}${mfield('Safe Z','safeZ',m.safeZ,2,20,1)}${mfield('Spindle','rpm',m.rpm,1000,10000,100,'S')}${mfield('Through cut','through',m.through,0,0.5,0.1)}${mfield('Stock margin','stockMargin',m.stockMargin,5,30,1)}</div><div class="setup-note"><strong>Double-sided tape setup</strong><p>One cap per setup, outside face up. G54 XY zero: lower-left stock corner. Z zero: top of wood. Repeat for the second cap.</p><p>Feeds are provisional. Verify spindle scaling, work offset and tool clearance; simulate and air-cut before machining. Clamp fixtures are not supported yet.</p></div></div><div><div class="toolpath-card"><div class="eyebrow">END-CAP TOOLPATH · TOP VIEW</div>${cam?`<svg viewBox="-3 -3 ${cam.width+6} ${cam.height+6}" role="img" aria-label="End cap milling toolpath"><g transform="translate(0 ${cam.height}) scale(1 -1)"><rect width="${cam.width}" height="${cam.height}" fill="#e8ddc4" stroke="#ad9b7b" stroke-width="0.3"/>${cam.paths.map(path=>`<polyline points="${path.map(q=>q.join(',')).join(' ')}" fill="none" stroke="#36414b" stroke-width="0.18"/>`).join('')}<circle r="1.2" fill="#f04424"/></g></svg><p>Minimum stock: ${cam.width.toFixed(1)} × ${cam.height.toFixed(1)} × ${project.enclosure.woodThickness} mm</p><p class="hint">Lines show cutter-center paths. Head recesses → clearance holes → outside contour.</p>`:'<p>Resolve geometry errors to preview the toolpath.</p>'}</div><div class="setup-card"><div class="eyebrow">FDM PRINTING</div><h2>Bambu P1S</h2><p>Configured usable volume: 250 × 250 × 250 mm.</p><p>${assembly?'Control-surface-down shell: '+assembly.printBounds.map(n=>n.toFixed(1)).join(' × ')+' mm':'Calculating print envelope…'}</p>${assembly?.printBounds.some(n=>n>250)?'<p class="error">Shell exceeds the printer envelope. Reduce case size before exporting.</p>':''}<p class="hint">The package includes extrusion, bottom plate, left cap and right cap STLs, plus end-cap G-code. Print the extrusion control surface down. Straight 45° gussets support the screw rails and plate bosses. Inspect rear openings, small horizontal bores and outer edge details in the slicer; these may still need bridging or local support. Caps export flat with screw-head recesses upward. Cap thickness uses the wood thickness setting.</p></div></div></div>`;
}
function addShape(kind:'rect'|'circle'){
 const q:Shape={id:uid(),kind,x:20,y:20,w:kind==='circle'?7:20,h:kind==='circle'?7:8,name:kind==='circle'?'Circle cutout':'Rectangle cutout'};
 if(shapes().length>=400)return toast('Maximum 400 cutouts per face.');
 change(()=>{shapes().push(q);selected=new Set([q.id]);});
}
function select(id:string,extend=false){const q=shapes().find(x=>x.id===id);if(!q)return;const ids=q.group?shapes().filter(x=>x.group===q.group).map(x=>x.id):[id];if(!extend)selected.clear();const remove=extend&&selected.has(id);ids.forEach(x=>remove?selected.delete(x):selected.add(x));}
function duplicate(source:Shape[],dx=5,dy=5){const groups=new Map<string,string>();return source.map(q=>({...clone(q),id:uid(),x:q.x+dx,y:q.y+dy,...(q.group?{group:groups.get(q.group)??(groups.set(q.group,uid()),groups.get(q.group))}:{})}));}
function insertCopies(copy:Shape[],component?:Component){if(component&&!project.components.some(c=>c.id===component.id)&&project.components.length>=100)return toast('Maximum 100 components per project.');if(shapes().length+copy.length>400)return toast('Maximum 400 cutouts per face.');change(()=>{if(component){const i=project.components.findIndex(c=>c.id===component.id);if(i<0)project.components.push(clone(component));else project.components[i]=clone(component);}shapes().push(...copy);selected=new Set(copy.map(q=>q.id));});}
let patternCenterClick=false,patternSource:Shape[]=[];
let patternSourceDrag:null|{pointerId:number;x:number;y:number;items:Shape[]}=null;
function patternDisplayShapes(){return shapes().map(q=>patternSource.find(d=>d.id===q.id)??q);}
function circularPatternActive(){return !$('#pattern-dialog').hidden&&$('#pattern-dialog').dataset.kind==='circular';}
let patternCenterDrag:null|{pointerId:number;dx:number;dy:number;x:number;y:number}=null;
function readPatternOptions(){
  const val=(id:string)=>{const el=$<HTMLInputElement>('#'+id);if(!el.value.trim()||!el.checkValidity())throw Error('Enter valid pattern values.');return Number(el.value);};
  const kind=$('#pattern-dialog').dataset.kind;
  return kind==='rectangular'?{kind:'rectangular' as const,columns:val('columns'),rows:val('rows'),dx:val('pitch-x'),dy:val('pitch-y')}:{kind:'circular' as const,count:val('pattern-count'),centerX:val('pattern-x'),centerY:val('pattern-y'),angle:val('pattern-angle')};
}
function renderPatternPreview(){
 $('#pattern-preview')?.remove();const dialog=$('#pattern-dialog');if(dialog.hidden)return;
 const h=faceSize(project,face).h;let markup='';
 if(dialog.dataset.kind==='circular'){const x=Number($<HTMLInputElement>('#pattern-x').value),y=Number($<HTMLInputElement>('#pattern-y').value);if(Number.isFinite(x+y))markup+=`<g data-pattern-center pointer-events="all"><circle cx="${x}" cy="${h-y}" r="3" fill="transparent" stroke="none"/><path class="pattern-center" d="M ${x-2} ${h-y} h 4 M ${x} ${h-y-2} v 4"/><title>Drag pattern center</title></g>`;}
 try{const copies=patternCopies(patternSource,readPatternOptions(),400-shapes().length);for(const q of copies){markup+=q.kind==='circle'?`<circle cx="${q.x+q.w/2}" cy="${h-q.y-q.w/2}" r="${q.w/2}"/>`:`<polygon points="${rectangleOutline(q).map(([x,y])=>`${x},${h-y}`).join(' ')}"/>`;if(q.guide){const b=guideBounds(q),g=q.guide;markup+=`<rect x="${b.x}" y="${h-b.y-b.h}" width="${b.w}" height="${b.h}"/><rect x="${b.x+g.wall}" y="${h-b.y-b.h+g.wall}" width="${g.innerWidth}" height="${g.innerHeight}"/>`;}}
 $('#pattern-error').hidden=true;$<HTMLButtonElement>('[data-action="pattern-apply"]').disabled=false;
 }catch(error){$('#pattern-error').textContent=error instanceof Error?error.message:String(error);$('#pattern-error').hidden=false;$<HTMLButtonElement>('[data-action="pattern-apply"]').disabled=true;}
 const group=document.createElementNS('http://www.w3.org/2000/svg','g');group.id='pattern-preview';group.setAttribute('pointer-events','none');group.innerHTML=markup;$('#canvas').append(group);
}
app.addEventListener('input',event=>{if((event.target as HTMLElement).closest('#pattern-dialog'))renderPatternPreview();});
function endPatternSourceDrag(restore=false){if(!patternSourceDrag)return;const state=patternSourceDrag;patternSourceDrag=null;const canvas=$<SVGSVGElement>('#canvas');if(canvas.hasPointerCapture(state.pointerId))canvas.releasePointerCapture(state.pointerId);canvas.classList.remove('drag-pattern-source');if(restore){patternSource=state.items;renderCanvas();}}
function endPatternCenterDrag(restore=false){
 if(!patternCenterDrag)return;const state=patternCenterDrag;patternCenterDrag=null;
 const canvas=$<SVGSVGElement>('#canvas');if(canvas.hasPointerCapture(state.pointerId))canvas.releasePointerCapture(state.pointerId);canvas.classList.remove('drag-pattern-center');
 if(restore){$<HTMLInputElement>('#pattern-x').value=String(state.x);$<HTMLInputElement>('#pattern-y').value=String(state.y);renderPatternPreview();}
}
function positionPattern(){const dialog=$<HTMLElement>('#pattern-dialog'),bar=$('.editor-toolbar').getBoundingClientRect(),button=$('[data-action="pattern"]').getBoundingClientRect();dialog.style.left=`${Math.max(0,Math.min(button.left+button.width/2-bar.left-dialog.offsetWidth/2,bar.width-dialog.offsetWidth))}px`;dialog.style.top=`${button.bottom-bar.top+6}px`;}
window.addEventListener('resize',()=>{if(!$('#pattern-dialog').hidden)positionPattern();});
function closePattern(focus=true){endPatternSourceDrag();endPatternCenterDrag();$('#canvas').classList.remove('pick-center');$('#pattern-dialog').style.visibility='';const dialog=$('#pattern-dialog');if(dialog.hidden)return;dialog.hidden=true;patternSource=[];$('#canvas').classList.remove('pattern-active');renderCanvas();$('[data-action="pattern"]').setAttribute('aria-expanded','false');if(focus)$<HTMLButtonElement>('[data-action="pattern"]').focus({preventScroll:true});}
function openPattern(){
 if(!picked().length)return;patternSource=clone(picked());$('#canvas').classList.add('pattern-active');const size=faceSize(project,face),dialog=$('#pattern-dialog');
 const input=(label:string,id:string,value:number,min:number,max:number)=>`<label class="field">${label}<input id="${id}" type="number" step="any" value="${value}" min="${min}" max="${max}"></label>`;
 dialog.innerHTML=`<div class="pattern-heading"><h3>Pattern</h3><button class="icon-button" data-action="pattern-rectangular" title="Rectangular pattern" aria-label="Rectangular pattern" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="16" height="12" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button><button class="icon-button" data-action="pattern-circular" title="Circular pattern" aria-label="Circular pattern" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button></div><div id="pattern-rect" class="field-grid">${input('Columns','columns',4,1,20)}${input('Rows','rows',1,1,20)}${input('Column pitch (mm)','pitch-x',25,.001,500)}${input('Row pitch (mm)','pitch-y',25,.001,500)}</div><div id="pattern-circle" hidden><div class="field-grid">${input('Instances','pattern-count',6,2,400)}${input('Sweep angle (°)','pattern-angle',360,-360,360)}</div><div class="pattern-center-fields">${input('Center X (mm)','pattern-x',size.w/2,0,1000)}${input('Center Y (mm)','pattern-y',size.h/2,0,1000)}<button id="pattern-pick" class="icon-button pick-center-button" data-action="pattern-pick-center" title="Pick center on canvas" aria-label="Pick center on canvas"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 3v7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button></div><p class="hint">Click field or drag cross to set center. Copies stay upright.</p></div><p class="hint">Counts include the original.</p><p id="pattern-error" class="hint error" role="status" hidden></p><div class="button-row"><button data-action="pattern-cancel">Cancel</button><button data-action="pattern-apply" class="primary">Apply</button></div>`;
 dialog.dataset.kind='rectangular';dialog.hidden=false;positionPattern();renderPatternPreview();$('[data-action="pattern"]').setAttribute('aria-expanded','true');$<HTMLButtonElement>('[data-action="pattern-rectangular"]').focus({preventScroll:true});
}
async function action(name:string){
 try{
 if(/^(align|distribute|center)-(horizontal|vertical)$/.test(name)&&selected.size)change(()=>arrange(picked(),name,faceSize(project,face)));
 if(name==='plate'){showPlate=!showPlate;if(assembly)preview?.set(assembly,project,exploded,showPlate);$('[data-action="plate"]').textContent=showPlate?'Hide plate':'Show plate';}
 if(name==='add-rect')addShape('rect');
 if(name==='add-circle')addShape('circle');
 if(name==='save')download(JSON.stringify(project,null,2),'project.json','application/json');
 if(name==='open')$<HTMLInputElement>('#import-file').click();
 if(name==='new'&&confirm('Start a new project? Download the current project first if you want to keep it.')){change(()=>{project=newProject();selected.clear();});$<HTMLInputElement>('#project-name').value=project.name;}
 if(name==='package'){if(!assembly)throw Error('Wait for valid geometry before exporting.');download(exportPackage(project,assembly),'case-builder-package.zip','application/zip');toast('Package exported: shell, plate and both cap STLs, end-cap G-code, layouts and project JSON.');}
 if(name==='svg')download(layoutSVG(project,face),`${face}.svg`,'image/svg+xml');
 if(name==='dxf')download(layoutDXF(project,face),`${face}.dxf`,'application/dxf');
 if(name==='copy'){clipboard=clone(picked());toast(`${clipboard.length} cutouts copied.`);}
 if(name==='paste'){if(!clipboard.length)return toast('Copy a selection first.');insertCopies(duplicate(clipboard));}
 if(name==='delete'&&selected.size)change(()=>{project.layouts[face]=shapes().filter(q=>!selected.has(q.id));selected.clear();});
 if(name==='group'&&selected.size>1)change(()=>{const group=uid();picked().forEach(q=>q.group=group);});
 if(name==='ungroup'&&selected.size)change(()=>{picked().forEach(q=>delete q.group);});
 if(name==='save-component'){const name=$<HTMLInputElement>('#component-name').value.trim();if(!name)return toast('Enter a name for the component.');if(project.components.length>=100)return toast('Maximum 100 components per project.');const ps=picked(),x=Math.min(...ps.map(q=>q.x)),y=Math.min(...ps.map(q=>q.y));change(()=>project.components.push({id:uid(),name,shapes:ps.map(q=>({...clone(q),x:q.x-x,y:q.y-y}))}));toast('Component saved with this project.');}
 if(name==='pattern')openPattern();
 if(name==='pattern-rectangular'||name==='pattern-circular'){const circular=name==='pattern-circular';$('#pattern-dialog').dataset.kind=circular?'circular':'rectangular';$('#pattern-rect').hidden=circular;$('#pattern-circle').hidden=!circular;$('#pattern-pick').hidden=!circular;$('#canvas').classList.toggle('pick-center',circular);for(const kind of ['rectangular','circular'])$(`[data-action="pattern-${kind}"]`).setAttribute('aria-pressed',String($('#pattern-dialog').dataset.kind===kind));positionPattern();renderPatternPreview();}
 if(name==='pattern-pick-center')toast('Click the field to set the center, or drag the center cross.');

 if(name==='pattern-cancel')closePattern();
 if(name==='pattern-apply'){
  const opts=readPatternOptions();
  const copies=patternCopies(patternSource,opts,400-shapes().length),originals=clone(patternSource);change(()=>{for(const q of originals){const target=shapes().find(s=>s.id===q.id);if(target){target.x=q.x;target.y=q.y;}}shapes().push(...copies);selected=new Set([...originals,...copies].map(q=>q.id));});closePattern();$<HTMLButtonElement>('[data-action="pattern"]').focus({preventScroll:true});
 }
 if(name==='undo'&&undo.length){redo.push(clone(project));project=undo.pop()!;selected.clear();persist();render();queueGeometry();$<HTMLInputElement>('#project-name').value=project.name;}
 if(name==='redo'&&redo.length){undo.push(clone(project));project=redo.pop()!;selected.clear();persist();render();queueGeometry();$<HTMLInputElement>('#project-name').value=project.name;}
 if(name==='explode'){exploded=!exploded;if(assembly)preview?.set(assembly,project,exploded,showPlate);$('[data-action="explode"]').textContent=exploded?'Assembled view':'Exploded view';}
 if(name==='fit3d')preview?.fit(project);
 if(name==='fit')renderCanvas();
 }catch(err){toast(err instanceof Error?err.message:String(err));}
}
app.addEventListener('click',event=>{
 if(patternCenterClick){patternCenterClick=false;if((event.target as Element).closest('#canvas'))return;}
 if(circularPatternActive()&&(event.target as Element).closest('#canvas'))return;
 if(!$('#pattern-dialog').hidden&&!(event.target as HTMLElement).closest('#pattern-dialog,[data-action="pattern"]'))closePattern(false);
 const t=(event.target as HTMLElement).closest<HTMLElement>('button');if(!t)return;
 if(t.dataset.action)void action(t.dataset.action);
 if(t.dataset.tab){tab=t.dataset.tab;if(tab==='control'||tab==='back'){face=tab;selected.clear();}render();}
 if(t.dataset.select){select(t.dataset.select,(event as MouseEvent).shiftKey);render();}
 if(t.dataset.component){const c=componentLibrary(project).find(c=>c.id===t.dataset.component);if(c){if(tab!=='control'&&tab!=='back'){tab=face;render();}const copies=duplicate(c.shapes,20,20),group=uid();copies.forEach(q=>q.group=group);insertCopies(copies,c);}}
});
// Commit before moving focus: change handlers replace the inspector synchronously.
app.addEventListener('keydown',event=>{
 if(event.key!=='Tab'||!(event.target instanceof HTMLElement)||!event.target.closest('#right-panel'))return;
 const controls=inspectorControls(),i=controls.indexOf(event.target),next=controls[i+(event.shiftKey?-1:1)];if(i<0||!next)return;
 const key=focusKey(next);event.preventDefault();event.target.blur();
 inspectorControls().find(el=>focusKey(el)===key)?.focus();
});
app.addEventListener('change',event=>{
 const t=event.target as HTMLInputElement|HTMLSelectElement;
 try{
 if(t.id==='project-name'){const v=t.value.trim()||'Untitled enclosure';change(()=>project.name=v);t.value=v;}
 if(t.id==='shape-name')change(()=>picked()[0].name=t.value.slice(0,100));
 if(t.id==='auto-size')change(()=>project.enclosure.autoSize=(t as HTMLInputElement).checked);
 if(t.id==='guide-enabled')change(()=>{const q=picked()[0];if((t as HTMLInputElement).checked)q.guide={innerWidth:q.w+2,innerHeight:shapeHeight(q)+2,wall:1,height:2,offsetX:0,offsetY:0};else delete q.guide;});
 if(t.dataset.guide){if(!t.value.trim()||!t.checkValidity())throw Error('Enter a guide dimension within the displayed limits.');change(()=>{picked()[0].guide![t.dataset.guide as keyof NonNullable<Shape['guide']>]=Number(t.value);});}
 if(t.hasAttribute('data-corner'))change(()=>{const q=picked()[0];q.corner=t.value as Shape['corner'];q.radius??=Math.min(1,q.w/2,q.h/2);});
 if(t.dataset.shape){if(!t.value.trim()||!(t as HTMLInputElement).checkValidity())throw Error('Enter a valid cutout dimension.');change(()=>{const q=picked()[0];(q as unknown as Record<string,unknown>)[t.dataset.shape!]=Number(t.value);if(q.kind==='circle')q.h=q.w;});}
 if(t.dataset.e||t.dataset.m){if(!t.value.trim()||!t.checkValidity())throw Error('Enter a value within the displayed limits.');const key=t.dataset.e??t.dataset.m!,v=key==='capOuterEdges'?(t as HTMLInputElement).checked:['edge','color','wood'].includes(key)?t.value:Number(t.value);change(()=>{const obj=t.dataset.e?project.enclosure:project.machining;(obj as unknown as Record<string,unknown>)[key]=v;});}
 }catch(err){toast(err instanceof Error?err.message:String(err));render();}
});
$<HTMLInputElement>('#import-file').addEventListener('change',async event=>{const input=event.target as HTMLInputElement,f=input.files?.[0];if(!f)return;try{if(f.size>2_000_000)throw Error('Project file exceeds 2 MB.');const p=parseProject(await f.text());if(confirm('Replace the current design with this project?')){change(()=>{project=p;selected.clear();startup='';});$<HTMLInputElement>('#project-name').value=project.name;toast('Project loaded, including custom components.');}}catch(err){toast(err instanceof Error?err.message:String(err));}input.value='';});
function svgPoint(event:PointerEvent){const svg=$<SVGSVGElement>('#canvas'),p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;const v=p.matrixTransform(svg.getScreenCTM()!.inverse());return {x:v.x,y:faceSize(project,face).h-v.y};}
let drag:null|{x:number;y:number;items:Shape[];moved:boolean}=null;
let marquee:null|{x:number;y:number;initial:Set<string>;moved:boolean;clientX:number;clientY:number}=null;
$('#canvas').addEventListener('pointerdown',event=>{
 const ev=event as PointerEvent;if(ev.button!==0)return;
 const sourceTarget=(ev.target as Element).closest<SVGElement>('[data-id]');
 if(!$('#pattern-dialog').hidden&&sourceTarget&&patternSource.some(q=>q.id===sourceTarget.dataset.id)){const p=svgPoint(ev);patternSourceDrag={pointerId:ev.pointerId,x:p.x,y:p.y,items:clone(patternSource)};patternCenterClick=true;$<SVGSVGElement>('#canvas').setPointerCapture(ev.pointerId);$('#canvas').classList.add('drag-pattern-source');ev.preventDefault();return;}

 if(circularPatternActive()&&(ev.target as Element).closest('[data-pattern-center]')){const p=svgPoint(ev),x=Number($<HTMLInputElement>('#pattern-x').value),y=Number($<HTMLInputElement>('#pattern-y').value);patternCenterDrag={pointerId:ev.pointerId,dx:x-p.x,dy:y-p.y,x,y};patternCenterClick=true;$<SVGSVGElement>('#canvas').setPointerCapture(ev.pointerId);$('#canvas').classList.add('drag-pattern-center');ev.preventDefault();return;}

 if(circularPatternActive()){const p=svgPoint(ev),size=faceSize(project,face);if(p.x<0||p.y<0||p.x>size.w||p.y>size.h)return;for(const axis of ['x','y'] as const)$<HTMLInputElement>('#pattern-'+axis).value=String(Number(p[axis].toFixed(4)));patternCenterClick=true;renderPatternPreview();ev.preventDefault();return;}const t=(ev.target as Element).closest<SVGElement>('[data-id]'),p=svgPoint(ev);
 (document.activeElement as HTMLElement)?.blur();
 if(!t){marquee={x:p.x,y:p.y,initial:ev.shiftKey?new Set(selected):new Set(),moved:false,clientX:ev.clientX,clientY:ev.clientY};if(!ev.shiftKey)selected.clear();renderInspector();renderCanvas();renderToolbar();ev.preventDefault();return;}
 const id=t.dataset.id!;if(!selected.has(id)||ev.shiftKey)select(id,ev.shiftKey);
 drag={x:p.x,y:p.y,items:clone(picked()),moved:false};renderInspector();renderCanvas();renderToolbar();ev.preventDefault();
});
window.addEventListener('pointermove',ev=>{
 if(patternSourceDrag){const state=patternSourceDrag;if(ev.pointerId!==state.pointerId)return;const p=svgPoint(ev);const dx=Math.max(-Math.min(...state.items.map(q=>q.x)),Math.min(1000-Math.max(...state.items.map(q=>q.x)),p.x-state.x)),dy=Math.max(-Math.min(...state.items.map(q=>q.y)),Math.min(1000-Math.max(...state.items.map(q=>q.y)),p.y-state.y));patternSource=state.items.map(q=>({...clone(q),x:Number((q.x+dx).toFixed(4)),y:Number((q.y+dy).toFixed(4))}));renderCanvas();ev.preventDefault();return;}

 if(patternCenterDrag){if(ev.pointerId!==patternCenterDrag.pointerId)return;const p=svgPoint(ev),size=faceSize(project,face);for(const axis of ['x','y'] as const){const value=Math.max(0,Math.min(axis==='x'?size.w:size.h,p[axis]+(axis==='x'?patternCenterDrag.dx:patternCenterDrag.dy)));$<HTMLInputElement>('#pattern-'+axis).value=String(Number(value.toFixed(4)));}renderPatternPreview();ev.preventDefault();return;}
 if(marquee){const p=svgPoint(ev),box={x:Math.min(p.x,marquee.x),y:Math.min(p.y,marquee.y),w:Math.abs(p.x-marquee.x),h:Math.abs(p.y-marquee.y)};marquee.moved ||= Math.hypot(ev.clientX-marquee.clientX,ev.clientY-marquee.clientY)>3;if(!marquee.moved)return;selected=new Set([...marquee.initial,...marqueeSelection(shapes(),box)]);renderCanvas();const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');for(const [key,value] of Object.entries({x:box.x,y:faceSize(project,face).h-box.y-box.h,width:box.w,height:box.h}))rect.setAttribute(key,String(value));rect.setAttribute('class','marquee');$('#canvas').append(rect);renderToolbar();return;}
 if(!drag||!drag.items.length)return;const p=svgPoint(ev);let dx=Math.round(p.x-drag.x),dy=Math.round(p.y-drag.y);if(!dx&&!dy&&!drag.moved)return;
 dx=Math.max(dx,-Math.min(...drag.items.map(q=>q.x)));dy=Math.max(dy,-Math.min(...drag.items.map(q=>q.y)));
 if(!drag.moved){checkpoint();drag.moved=true;}
 for(const src of drag.items){const q=shapes().find(q=>q.id===src.id);if(q){q.x=src.x+dx;q.y=src.y+dy;}}
 renderCanvas();
});
window.addEventListener('pointerup',()=>{if(patternSourceDrag){endPatternSourceDrag();return;}if(patternCenterDrag){endPatternCenterDrag();return;}if(marquee){marquee=null;render();}if(drag?.moved){persist();render();queueGeometry();}drag=null;});
window.addEventListener('pointercancel',()=>{if(patternSourceDrag){endPatternSourceDrag(true);patternCenterClick=false;return;}if(patternCenterDrag){endPatternCenterDrag(true);patternCenterClick=false;return;}if(drag?.moved){persist();queueGeometry();}drag=null;marquee=null;render();});
window.addEventListener('keydown',ev=>{
 if(patternSourceDrag){if(ev.key==='Escape'){ev.preventDefault();endPatternSourceDrag(true);}return;}
 if(patternCenterDrag){if(ev.key==='Escape'){ev.preventDefault();endPatternCenterDrag(true);}return;}

 if(!$('#pattern-dialog').hidden){if(ev.key==='Escape'){ev.preventDefault();closePattern();}else if(ev.key==='Tab'){const controls=[...$('#pattern-dialog').querySelectorAll<HTMLElement>('input,select,button')].filter(e=>e.getClientRects().length);const i=controls.indexOf(document.activeElement as HTMLElement);if(ev.shiftKey&&i===0){ev.preventDefault();controls.at(-1)?.focus();}else if(!ev.shiftKey&&i===controls.length-1){ev.preventDefault();controls[0]?.focus();}}return;}
 if((ev.target as Element).closest('input,textarea,select,button')||!(tab==='control'||tab==='back'))return;
 const mod=ev.metaKey||ev.ctrlKey;
 if(mod&&['c','v','z','g','a'].includes(ev.key.toLowerCase())){ev.preventDefault();const key=ev.key.toLowerCase();if(key==='a'){selected=new Set(shapes().map(q=>q.id));render();}else void action(key==='c'?'copy':key==='v'?'paste':key==='g'?(ev.shiftKey?'ungroup':'group'):ev.shiftKey?'redo':'undo');}
 if((ev.key==='Delete'||ev.key==='Backspace')&&selected.size){ev.preventDefault();void action('delete');}
 if(ev.key==='Escape'){selected.clear();render();}
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(ev.key)&&selected.size){ev.preventDefault();const step=ev.shiftKey?10:1;change(()=>{const ps=picked(),dx=Math.max(ev.key==='ArrowRight'?step:ev.key==='ArrowLeft'?-step:0,-Math.min(...ps.map(q=>q.x))),dy=Math.max(ev.key==='ArrowUp'?step:ev.key==='ArrowDown'?-step:0,-Math.min(...ps.map(q=>q.y)));ps.forEach(q=>{q.x+=dx;q.y+=dy;});});}
});
render();queueGeometry();
