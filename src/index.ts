import { AutoRouter } from 'itty-router';

import { handler as coseHandler } from './directoryHandlers/ietf-hpke-cose-key-set';
import { handler as joseHandler } from './directoryHandlers/ietf-hpke-jwks';
import { handler as jwksHandler } from './directoryHandlers/openidconnect-jwks';
import { handler as privacypassHandler } from './directoryHandlers/privacypass';
import { clearKeyHandler, rotationHandler } from './rotation';
import { Bindings } from './bindings';
import { textToResponse } from './html';

export * from './rotation';

const router = AutoRouter();

export function handleHead<T extends (request: Request, env: Bindings) => Promise<Response>>(f: T): T {
  return (async (request, env) => {
    const response = await f(request, env);
    return new Response(undefined, {
      status: response.status,
      headers: response.headers,
    });
  }) as T;
}

export function index() {
  const body = `# HPKE Key Directory over HTTP

github.com/thibmeu/hpke-key-directory-over-http-playground

## FAQ

Key rotate every 5 minutes

## Endpoints

<a href="/ietf-hpke-cose/cose-key-set.cbor">GET /ietf-hpke-cose/cose-key-set.cbor</a>
<a href="/ietf-hpke-jose/jwks.json">GET /ietf-hpke-jose/jwks.json</a>
<a href="/openid-connect/jwks.json">GET /openid-connect/jwks.json</a>
<a href="/.well-known/private-token-key-directory">GET /.well-known/private-token-key-directory</a>
`;
  return textToResponse(`HPKE Key Directory over HTTP`, body);
}

router
  .get('/', index)
  .head('/ietf-hpke-cose/cose-key-set.cbor', handleHead(coseHandler))
  .get('/ietf-hpke-cose/cose-key-set.cbor', coseHandler)
  .head('/ietf-hpke-jose/jwks.json', handleHead(joseHandler))
  .get('/ietf-hpke-jose/jwks.json', joseHandler)
  .head('/openid-connect/jwks.json', handleHead(jwksHandler))
  .get('/openid-connect/jwks.json', jwksHandler)
  .head('/.well-known/private-token-key-directory', handleHead(privacypassHandler))
  .get('/.well-known/private-token-key-directory', privacypassHandler)
  .post('/admin/clear', (_req, env) => clearKeyHandler(env))
  .post('/admin/rotate', (_req, env) => rotationHandler(env))
  .all('*', () => Response.redirect('/'));

export default {
  ...router,

  async scheduled(_event: ScheduledEvent, env: Bindings, _ectx: ExecutionContext) {
    // dev note: should there be a different flow for each protocol?
    const id = 'rotation-workflow';
    let workflow: WorkflowInstance;
    try {
      workflow = await env.ROTATION.get(id);
    } catch (_) {
      workflow = await env.ROTATION.create({ id });
    }

    const status = await workflow.status();
    console.log(`started workflow ${id}. Status ${status.status}`);
  },
};
