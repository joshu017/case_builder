import test from 'node:test';import assert from 'node:assert/strict';
import {arrange,marqueeSelection,rectangleOutline,selectionUnits} from '../src/layout';
import {type Shape,newProject,parseProject,issues} from '../src/model';
const q=(id:string,x:number,y:number,w=10,h=6,group?:string):Shape=>({id,name:id,kind:'rect',x,y,w,h,...(group?{group}:{})});
test('alignment anchors to selection order, distribution keeps extremes and centering preserves group spacing',()=>{
 const a=q('a',20,30),b=q('b',60,50,20,10),c=q('c',110,70,6,4);
 arrange([b,a,c],'align-horizontal',{w:180,h:110});assert.equal(b.y,50);assert.equal(a.y,52);assert.equal(c.y,53);
 arrange([a,b,c],'distribute-horizontal',{w:180,h:110});assert.equal(a.x,20);assert.equal(c.x,110);assert.equal(b.x,59);
 const gap=b.x-a.x;arrange([a,b,c],'center-horizontal',{w:200,h:110});assert.equal(b.x-a.x,gap);assert.equal(a.x,52);assert.equal(c.x+c.w,148);
});
test('groups align and distribute as intact units; marquee includes full touched groups',()=>{
 const a=q('a',20,20,6,6,'g'),b=q('b',20,40,6,6,'g'),c=q('c',60,70);
 assert.equal(selectionUnits([a,b,c]).length,2);arrange([c,a,b],'align-horizontal',{w:180,h:110});assert.equal(b.y-a.y,20);assert.equal((a.y+b.y+6)/2,c.y+3);
 assert.deepEqual(marqueeSelection([a,b,c],{x:a.x-1,y:a.y-1,w:8,h:8}),['a','b']);
});
test('rectangle corner outlines preserve exact extents, portable decimals and validate excessive radii',()=>{
 const p=newProject(),shape={...q('usb',30.1234567,20.456789,9.2,3.2),corner:'fillet' as const,radius:1.6};p.layouts.back=[shape];
 assert.deepEqual(parseProject(JSON.stringify(p)),p);const poly=rectangleOutline(shape);assert.ok(poly.length>8);assert.equal(Math.min(...poly.map(p=>p[0])),shape.x);assert.equal(Math.max(...poly.map(p=>p[1])),shape.y+shape.h);
 shape.radius=1.7;assert.ok(issues(p).some(x=>x.includes('corner size')));
});
test('out-of-range alignment fails without partially moving a selection',()=>{const a=q('a',1,1,2,2),b=q('b',40,40,50,50),old=structuredClone([a,b]);assert.throws(()=>arrange([a,b],'align-horizontal',{w:180,h:110}),/coordinate range/);assert.deepEqual([a,b],old);});

test('default USB-C library is available to existing projects without adding guides or mutating custom components',async()=>{
 const {componentLibrary,defaultComponents}=await import('../src/model');const p=newProject(),c=componentLibrary(p).find(c=>c.id==='builtin-usb-c-port')!;assert.ok(c);assert.equal(c.shapes[0].corner,'fillet');assert.equal(c.shapes[0].guide,undefined);assert.equal(p.components.length,0);p.components.push(structuredClone(c));p.components[0].shapes[0].w=10;assert.equal(componentLibrary(p).filter(x=>x.id===c.id).length,1);assert.equal(defaultComponents()[0].shapes[0].w,9.4);assert.deepEqual(parseProject(JSON.stringify(p)),p);
});

test('hardware margins protect only top/bottom on both faces; sides still enforce face bounds',()=>{
 for(const face of ['control','back'] as const){const p=newProject(),shape=q('edge',1,20,5,5);p.layouts[face]=[shape];assert.deepEqual(issues(p),[]);
 shape.x=174;assert.deepEqual(issues(p),[]);shape.x=176;assert.ok(issues(p).some(x=>x.includes('side edge')));
 shape.x=1;shape.y=12;assert.ok(issues(p).some(x=>x.includes('top/bottom hardware margin')));
 shape.x=2;shape.y=20;shape.guide={innerWidth:7,innerHeight:7,wall:1,height:2,offsetX:0,offsetY:0};assert.deepEqual(issues(p),[]);
 shape.x=1;assert.ok(issues(p).some(x=>x.includes('side edge')));
 }
});
