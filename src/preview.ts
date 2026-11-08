import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Assembly, MeshData } from './geometry';
import { type Project, dimensions, screwCenters, bottomCenters } from './model';
export class Preview {
 renderer:THREE.WebGLRenderer;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,1,0.1,5000);controls:OrbitControls;group=new THREE.Group();frame=0;observer:ResizeObserver;fitted=false;
 constructor(public el:HTMLElement) {
 this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));el.appendChild(this.renderer.domElement);
 this.camera.up.set(0,0,1);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;
 this.scene.add(new THREE.HemisphereLight(0xffffff,0x6d7468,3));
 const key=new THREE.DirectionalLight(0xffffff,4);key.position.set(-100,-150,400);this.scene.add(key);
 const fill=new THREE.DirectionalLight(0xe0f4ff,2);fill.position.set(200,200,200);this.scene.add(fill);this.scene.add(this.group);
 this.observer=new ResizeObserver(()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();});this.observer.observe(el);
 const draw=()=>{this.frame=requestAnimationFrame(draw);this.controls.update();this.renderer.render(this.scene,this.camera);};draw();
 }
 clear(){for(const o of [...this.group.children]){this.group.remove(o);if(o instanceof THREE.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if('map' in m)(m.map as THREE.Texture|null)?.dispose();m.dispose();}}}}
 set(a:Assembly,p:Project,exploded=false,showPlate=true){
 this.clear();const d=dimensions(p),woodColors={walnut:'#75513b',maple:'#d5b77e',cherry:'#ad6d4d',oak:'#b39361'};
 const woodTexture=()=>{const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle=woodColors[p.enclosure.wood==='plastic'?'walnut':p.enclosure.wood];ctx.fillRect(0,0,256,256);for(let i=0;i<90;i++){ctx.strokeStyle=`rgba(45,23,10,${0.03+(i%5)*0.015})`;ctx.lineWidth=0.5+(i%3)*0.5;ctx.beginPath();for(let x=0;x<=256;x+=4){const y=i*3+Math.sin(x/60+i)*2; x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;};
 const add=(m:MeshData,color:string,wood=false,shift=[0,0,0])=>{
 let g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(m.positions,3));g.setIndex(new THREE.BufferAttribute(m.indices,1));g=g.toNonIndexed();g.computeVertexNormals();
 if(wood){const pos=g.getAttribute('position'),uv=new Float32Array(pos.count*2);for(let i=0;i<pos.count;i++){uv[i*2]=pos.getY(i)/d.depth;uv[i*2+1]=pos.getZ(i)/p.enclosure.height;}g.setAttribute('uv',new THREE.BufferAttribute(uv,2));}
 const mat=new THREE.MeshStandardMaterial({color:wood?'#ffffff':color,roughness:wood?0.78:0.55,metalness:0.03,map:wood?woodTexture():null});const mesh=new THREE.Mesh(g,mat);mesh.position.set(shift[0],shift[1],shift[2]);this.group.add(mesh);};
 add(a.shell,p.enclosure.color);if(showPlate)add(a.bottom,p.enclosure.color,false,[0,0,exploded?-25:0]);add(a.left,p.enclosure.color,p.enclosure.wood!=='plastic',[exploded?-25:0,0,0]);add(a.right,p.enclosure.color,p.enclosure.wood!=='plastic',[exploded?25:0,0,0]);
 // Hardware heads are visual representations; actual clearances live in the solid model.
 const head=(pos:THREE.Vector3,axis:THREE.Vector3,r=2.75,h=2.6)=>{const g=new THREE.CylinderGeometry(r,r,h,24),mat=new THREE.MeshStandardMaterial({color:0x33383a,metalness:0.65,roughness:0.35}),m=new THREE.Mesh(g,mat);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);m.position.copy(pos);this.group.add(m);};
 for(const [y,z] of screwCenters(p)){head(new THREE.Vector3(-p.enclosure.woodThickness+1.5-(exploded?25:0),y,z),new THREE.Vector3(1,0,0));head(new THREE.Vector3(d.width+p.enclosure.woodThickness-1.5+(exploded?25:0),y,z),new THREE.Vector3(1,0,0));}
 if(showPlate)for(const [x,y] of bottomCenters(p)) {
  const axis=new THREE.Vector3(0,d.s,d.c),outside=new THREE.Vector3(x,y*d.c,d.rise-y*d.s-(exploded?25:0));
  const screwPart=(rTop:number,rBottom:number,height:number,offset:number)=>{
   const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBottom,height,32),new THREE.MeshStandardMaterial({color:0x33383a,metalness:0.65,roughness:0.35}));
   mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis);mesh.position.copy(outside).addScaledVector(axis,offset);this.group.add(mesh);
  };
  screwPart(1.5,3,1.5,0.75); // flush flat head, tapering inward
  screwPart(1.5,1.5,4.5,3.75); // M3 x 6 overall length, including head
 }
 if(!this.fitted){this.fit(p);this.fitted=true;}
 }
 fit(p:Project){const d=dimensions(p),r=Math.max(d.width,d.depth)*1.7;this.controls.target.set(d.width/2,d.depth/2,p.enclosure.height/2);this.camera.position.set(d.width/2+r,d.depth/2-r,p.enclosure.height+r*0.8);this.controls.update();}
 dispose(){cancelAnimationFrame(this.frame);this.observer.disconnect();this.controls.dispose();this.clear();this.renderer.dispose();}
}
