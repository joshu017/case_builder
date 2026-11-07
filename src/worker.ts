const PREFIX = '/casebuilder';

export interface Env {
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
    url.pathname = url.pathname.slice(PREFIX.length);
    if (url.pathname === '/') url.pathname = '/index.html';
    return env.ASSETS.fetch(new Request(url, request));
  },
};
