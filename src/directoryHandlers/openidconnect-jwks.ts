import { Bindings } from '../bindings';
import { convertRSASSAPSSToEnc } from '../crypto';
import { b64Tou8, b64URLtoB64 } from '../encoding/base64';
import { responseToInnerText, textToResponse } from '../html';
import { signatureKeys, StorageMetadata } from '../rotation';

export async function handler(req: Request, env: Bindings): Promise<Response> {
  const keys = await signatureKeys(env);

  const keyToJWK = async (key: R2Object) => {
    const metadata = key.customMetadata as StorageMetadata;
    const rsaSsaPssPublicKey = b64Tou8(b64URLtoB64(metadata.publicKey));
    const publicKeyEnc = convertRSASSAPSSToEnc(rsaSsaPssPublicKey);
    const publicKey = await crypto.subtle.importKey(
      'spki',
      publicKeyEnc,
      {
        name: 'RSA-PSS',
        hash: { name: 'SHA-384' },
      },
      true,
      ['verify'],
    );

    const publicKeyJwk = (await crypto.subtle.exportKey('jwk', publicKey)) as JsonWebKey;
    // List of arguments https://www.iana.org/assignments/jose/jose.xhtml
    return {
      kty: publicKeyJwk.kty,
      n: publicKeyJwk.n,
      e: publicKeyJwk.e,
      alg: publicKeyJwk.alg,
      kid: metadata.tokenKeyID, // self defined
      nbf: Number.parseInt(metadata.notBefore),
    };
  };

  const keysEnc = await Promise.all(keys.map((key) => keyToJWK(key)));

  const directory = {
    keys: keysEnc,
  };

  const body = JSON.stringify(directory, null, 2);

  const response = new Response(body, {
    headers: {
      'content-type': 'application/json',
      'cache-control': `public, max-age=${Number.parseInt(env.DIRECTORY_CACHE_MAX_AGE_SECONDS)}`,
      'content-length': body.length.toString(),
      date: new Date().toUTCString(),
    },
  });
  const text = `<a href="/">⮪</a>
# OpenID Connect JWKS format

<a href="https://openid.net/specs/openid-connect-core-1_0.html">https://openid.net/specs/openid-connect-core-1_0.html</a>

## Request
GET /openid-connect/jwks.json

## Response
${await responseToInnerText(response)}

## Notes
kid can be any string. In this example, we enforce it to be the last byte of SHA256(base64url(publickey_rsassa))
No specific content-type header
`;
  return textToResponse('OpenID Connect JWKS Format', text);
}
