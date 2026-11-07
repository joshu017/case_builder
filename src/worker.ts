import { handleMcp } from './mcp';
const PREFIX = '/casebuilder';

export interface Env {
  MCP_RATE_LIMIT?: { limit(options:{key:string}): Promise<{success:boolean}> };
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === PREFIX) {
      url.pathname = `${PREFIX}/`;
      return Response.redirect(url.toString(), 308);
    }
    if (!url.pathname.startsWith(`${PREFIX}/`)) {
      return new Response('Not found', { status: 404 });
    }
    if (url.pathname === `${PREFIX}/mcp`) {
      if(env.MCP_RATE_LIMIT && !(await env.MCP_RATE_LIMIT.limit({key:`casebuilder:${request.headers.get('CF-Connecting-IP') ?? 'local'}`})).success)
        return new Response('Too many requests', {status:429,headers:{'Retry-After':'60'}});
      return handleMcp(request, async p => (await import('./worker-geometry')).buildWorkerAssembly(p));
    }
    url.pathname = url.pathname.slice(PREFIX.length);
    if (url.pathname === '/') url.pathname = '/index.html';
    return env.ASSETS.fetch(new Request(url, request));
  },
};
