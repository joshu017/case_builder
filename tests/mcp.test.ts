import test from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import { unzipSync, strFromU8 } from 'fflate';
import { handleMcp, designReport } from '../src/mcp';
import { buildAssembly } from '../src/geometry';
import { newProject, parseProject } from '../src/model';
const wasm=await Module();wasm.setup();
const build=async(p:ReturnType<typeof newProject>)=>buildAssembly(wasm,p);
async function rpc(method:string,params:unknown={},headers:Record<string,string>={}) {
 const response=await handleMcp(new Request('https://example.com/casebuilder/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...headers},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}),build);
 return {status:response.status,body:await response.json() as any};
}
const call=async(name:string,args:unknown)=>(await rpc('tools/call',{name,arguments:args})).body.result;
test('stateless MCP handshake, tools and guide are discoverable',async()=>{
 const init=await rpc('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test',version:'1'}});
 assert.equal(init.status,200);assert.equal(init.body.result.serverInfo.name,'case-builder');
 const list=await rpc('tools/list');assert.equal(list.body.result.tools.length,7);
 const guide=await rpc('resources/read',{uri:'casebuilder:///guide'});assert.match(guide.body.result.contents[0].text,/TOTAL included angle/);
});
test('complete MCP design workflow round-trips into browser project and ZIP',async()=>{
 const created=await call('create_project',{name:'MCP test',enclosure:{wood:'plastic'}});let p=created.structuredContent.project;
 const placed=await call('place_component',{project:p,face:'control',x:30,y:30,component:{id:'knob',name:'Knob',shapes:[{id:'hole',name:'Shaft',kind:'rect',x:0,y:0,w:7,h:7,corner:'fillet',radius:1.125,guide:{innerWidth:12,innerHeight:12,wall:1,height:2,offsetX:.375,offsetY:-.125}}]}});
 p=placed.structuredContent.project;assert.equal(p.layouts.control[0].x,30);assert.equal(p.components.length,1);
 const updated=await call('update_enclosure',{project:p,enclosure:{height:55,overhang:0}});p=updated.structuredContent.project;
 const valid=await call('validate_project',{project:p});assert.equal(valid.structuredContent.validation.valid,true);
 const preview=await call('preview_project',{project:p});assert.match(preview.content[0].resource.text,/±5°/);
 const exported=await call('export_package',{project:p});assert.ok(!exported.isError);
 const zip=unzipSync(Buffer.from(exported.content[1].resource.blob,'base64'));
 for(const file of ['stl/extrusion.stl','stl/bottom-plate.stl','stl/end-cap-left.stl','stl/end-cap-right.stl','gcode/end-cap.nc'])assert.ok(zip[file].length>100);
 assert.deepEqual(parseProject(strFromU8(zip['project.json'])),p);
 const cleared=await call('replace_layout',{project:p,face:'control',shapes:[]});assert.equal(cleared.structuredContent.project.layouts.control.length,0);assert.equal(cleared.structuredContent.project.components.length,1);
});
test('MCP rejects invalid fields and manufacturing bounds, preserves editable invalid designs',async()=>{
 assert.equal((await call('create_project',{enclosure:{angle:90}})).isError,true);
 assert.equal((await call('create_project',{enclosure:{unexpected:1}})).isError,true);
 const p=newProject();p.enclosure.height=25;
 assert.equal((await call('validate_project',{project:p})).structuredContent.validation.valid,false);
 assert.equal((await call('export_package',{project:p})).isError,true);
 p.enclosure.height=50;p.enclosure.width=300;
 assert.equal((await call('export_package',{project:p})).isError,true);
 p.layouts.control=Array.from({length:65},(_,i)=>({id:String(i),name:'hole',kind:'circle',x:30,y:30,w:5,h:5}));
 assert.equal((await call('preview_project',{project:p})).isError,true);
});
test('cutout overlap warnings are geometric, including circle / rectangle',()=>{
 const p=newProject();p.layouts.control=[{id:'a',name:'a',kind:'circle',x:30,y:30,w:10,h:10},{id:'b',name:'b',kind:'rect',x:39,y:39,w:10,h:10}];
 assert.equal(designReport(p).warnings.length,0);p.layouts.control[1].x=35;p.layouts.control[1].y=35;assert.equal(designReport(p).warnings.length,1);
});
test('cross-origin and oversized MCP requests are rejected',async()=>{
 const response=await handleMcp(new Request('https://example.com/casebuilder/mcp',{method:'POST',headers:{Origin:'https://evil.example'}}),build);assert.equal(response.status,403);
 const large=await handleMcp(new Request('https://example.com/casebuilder/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:' '.repeat(256*1024+1)}),build);assert.equal(large.status,413);
});
test('MCP places built-in USB-C and embeds its definition for portable projects',async()=>{const placed=await call('place_component',{project:newProject(),face:'back',x:40,y:20,componentId:'builtin-usb-c-port'});assert.ok(!placed.isError);const p=placed.structuredContent.project;assert.equal(p.components[0].id,'builtin-usb-c-port');assert.equal(p.layouts.back[0].guide,undefined);assert.equal(p.layouts.back[0].radius,1.8);assert.equal((await call('validate_project',{project:p})).structuredContent.validation.valid,true);});

 test('pictured Behringer fader places as a portable group without mounting holes and with one body fence',async()=>{
 const placed=await call('place_component',{project:newProject(),face:'control',x:40,y:15,componentId:'builtin-behringer-fader-60mm'});assert.ok(!placed.isError);
 const p=placed.structuredContent.project,shapes=p.layouts.control;assert.equal(shapes.length,1);assert.equal(new Set(shapes.map((q:any)=>q.group)).size,1);assert.ok(shapes[0].group);
 assert.equal(shapes.filter((q:any)=>q.guide).length,1);assert.deepEqual(shapes[0].guide,{innerWidth:9.4,innerHeight:75.4,wall:1,height:2,offsetX:0,offsetY:0});
 assert.equal(p.components[0].id,'builtin-behringer-fader-60mm');assert.equal((await call('validate_project',{project:p})).structuredContent.validation.valid,true);
 });
