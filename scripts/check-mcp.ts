import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { unzipSync, strFromU8 } from 'fflate';
import { parseProject } from '../src/model';
const endpoint=process.argv[2]??'http://127.0.0.1:8787/casebuilder/mcp';
const client=new Client({name:'case-builder-release-check',version:'1.0'});
await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)));
try {
 const tools=await client.listTools();assert.equal(tools.tools.length,7);
 const created:any=await client.callTool({name:'create_project',arguments:{name:'MCP release check'}});assert.ok(!created.isError,JSON.stringify(created));
 const project=created.structuredContent.project;
 project.layouts.control=[{id:'test',name:'Knob',kind:'circle',x:40,y:30,w:7,h:7}];
 project.layouts.back=[{id:'usb',name:'USB',kind:'rect',x:40,y:20,w:10,h:7}];
 const start=performance.now();
 const exported:any=await client.callTool({name:'export_package',arguments:{project}});assert.ok(!exported.isError,JSON.stringify(exported));
 const file=exported.content.find((x:any)=>x.type==='resource').resource;
 const zip=unzipSync(Buffer.from(file.blob,'base64'));
 for(const name of ['extrusion.stl','bottom-plate.stl','end-cap-left.stl','end-cap-right.stl','end-cap.nc'])assert.ok(zip[name]?.length>100,name);
 assert.deepEqual(parseProject(strFromU8(zip['project.json'])),project);
 console.log(JSON.stringify({endpoint,tools:tools.tools.map(t=>t.name),exportMs:Math.round(performance.now()-start),zipBytes:exported.structuredContent.bytes,files:Object.keys(zip)},null,2));
} finally {await client.close();}
