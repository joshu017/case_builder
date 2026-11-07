import Module from 'manifold-3d';
import compiledWasm from 'manifold-3d/manifold.wasm';
import { buildAssembly } from './geometry';
import type { Project } from './model';

// Workers require a precompiled WASM module, rather than compiling fetched bytes.
let modulePromise:ReturnType<typeof Module>|undefined;
export async function buildWorkerAssembly(p:Project) {
 const options={locateFile:()=>'',instantiateWasm(imports:WebAssembly.Imports,receive:(instance:WebAssembly.Instance,module:WebAssembly.Module)=>void){const instance=new WebAssembly.Instance(compiledWasm,imports);receive(instance,compiledWasm);return instance.exports;}};
 modulePromise??=Module(options).then(wasm=>{wasm.setup();return wasm;}).catch(error=>{modulePromise=undefined;throw error;});
 return buildAssembly(await modulePromise,p);
}
