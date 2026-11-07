import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.ts';
const env = { ASSETS: { async fetch(request: Request) { return new Response(new URL(request.url).pathname); } } };

test('canonical path adds slash and preserves query', async () => {
 const r = await worker.fetch(new Request('https://joshjacobson.net/casebuilder?test=1'), env);
 assert.equal(r.status, 308);
 assert.equal(r.headers.get('location'), 'https://joshjacobson.net/casebuilder/?test=1');
});
test('nested app and WASM assets resolve inside the asset binding', async () => {
 for (const [path, expected] of [['/casebuilder/', '/index.html'], ['/casebuilder/assets/model.wasm', '/assets/model.wasm']]) {
  const r = await worker.fetch(new Request(`https://joshjacobson.net${path}`), env);
  assert.equal(await r.text(), expected);
 }
});
test('worker does not serve app outside its exact path namespace', async () => {
 for (const path of ['/', '/casebuilder-other', '/casebuiilder/']) {
  assert.equal((await worker.fetch(new Request(`https://joshjacobson.net${path}`), env)).status, 404);
 }
});

test('MCP rate limit is enforced without changing static asset access', async () => {
 const limited={...env,MCP_RATE_LIMIT:{async limit(){return {success:false};}}};
 const r=await worker.fetch(new Request('https://joshjacobson.net/casebuilder/mcp'),limited);
 assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'60');
 assert.equal((await worker.fetch(new Request('https://joshjacobson.net/casebuilder/'),limited)).status,200);
});
