const FIREBASE_CERT_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const CLOUDFLARE_API_URL = 'https://api.cloudflare.com/client/v4';
const TOKEN_LIFETIME_SECONDS = 60 * 60;

let cachedFirebaseKeys;
let firebaseKeysExpireAt = 0;

function jsonResponse(body, status, origin) {
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function base64UrlToBytes(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}

function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
}

async function getFirebaseKeys() {
  if (cachedFirebaseKeys && Date.now() < firebaseKeysExpireAt) return cachedFirebaseKeys;

  const response = await fetch(FIREBASE_CERT_URL);
  if (!response.ok) throw new Error('Could not retrieve Firebase public keys.');

  const keys = await response.json();
  const maxAge = Number(response.headers.get('Cache-Control')?.match(/max-age=(\d+)/)?.[1]) || 3600;
  cachedFirebaseKeys = keys;
  firebaseKeysExpireAt = Date.now() + maxAge * 1000;
  return keys;
}

async function verifyFirebaseIdToken(token, projectId) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid Firebase ID token.');

  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]);
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') {
    throw new Error('Unsupported Firebase ID token.');
  }

  const jwk = (await getFirebaseKeys()).keys?.find(key => key.kid === header.kid);
  if (!jwk) throw new Error('Firebase signing key was not found.');

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const signatureValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    base64UrlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  const now = Math.floor(Date.now() / 1000);

  if (
    !signatureValid ||
    claims.aud !== projectId ||
    claims.iss !== `https://securetoken.google.com/${projectId}` ||
    typeof claims.sub !== 'string' ||
    !claims.sub ||
    typeof claims.exp !== 'number' ||
    claims.exp <= now ||
    typeof claims.iat !== 'number' ||
    claims.iat > now + 60 ||
    typeof claims.auth_time !== 'number' ||
    claims.auth_time > now + 60 ||
    !claims.firebase?.sign_in_provider
  ) {
    throw new Error('Firebase ID token is invalid or expired.');
  }

  return claims;
}

async function getLesson(videoId, projectId, token) {
  const path = [
    'projects',
    encodeURIComponent(projectId),
    'databases',
    '(default)',
    'documents',
    'videos',
    encodeURIComponent(videoId),
  ].join('/');
  const response = await fetch(`https://firestore.googleapis.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Lesson access denied.');

  const document = await response.json();
  const fields = document.fields || {};
  return {
    streamId: fields.videoId?.stringValue || '',
    isIntro: fields.isIntro?.booleanValue === true,
  };
}

async function getProtectedStreamVideo(streamId, env, siteHostname) {
  const url = `${CLOUDFLARE_API_URL}/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/stream/${encodeURIComponent(streamId)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` },
  });
  const data = await response.json();
  const video = data.result;

  if (!response.ok || data.success !== true || !video) {
    throw new Error('Could not verify protected Stream video settings.');
  }
  if (video.requireSignedURLs !== true) {
    throw new Error('Stream video must require signed URLs.');
  }
  if (!Array.isArray(video.allowedOrigins) || !video.allowedOrigins.includes(siteHostname)) {
    throw new Error('Stream video must allow only the configured course site origin.');
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = env.APP_ORIGIN || '';
    const corsOrigin = origin === allowedOrigin ? origin : '';

    if (!allowedOrigin || origin !== allowedOrigin) {
      return jsonResponse({ error: 'Origin is not allowed.' }, 403, corsOrigin);
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Max-Age': '600',
          'Vary': 'Origin',
        },
      });
    }
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405, corsOrigin);
    }

    try {
      if (
        !env.FIREBASE_PROJECT_ID ||
        !env.CLOUDFLARE_ACCOUNT_ID ||
        !env.CLOUDFLARE_API_TOKEN ||
        !env.STREAM_CUSTOMER_CODE
      ) {
        console.error('Protected playback Worker is missing required configuration.');
        return jsonResponse({ error: 'Protected playback is not configured.' }, 500, corsOrigin);
      }

      const authorization = request.headers.get('Authorization') || '';
      const tokenMatch = authorization.match(/^Bearer (.+)$/);
      if (!tokenMatch) return jsonResponse({ error: 'Authentication required.' }, 401, corsOrigin);

      const claims = await verifyFirebaseIdToken(tokenMatch[1], env.FIREBASE_PROJECT_ID);
      const body = await request.json();
      if (typeof body.lessonId !== 'string' || !/^[A-Za-z0-9_-]{1,150}$/.test(body.lessonId)) {
        return jsonResponse({ error: 'Invalid lesson ID.' }, 400, corsOrigin);
      }

      const lesson = await getLesson(body.lessonId, env.FIREBASE_PROJECT_ID, tokenMatch[1]);
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(lesson.streamId)) {
        return jsonResponse({ error: 'Lesson is not configured for protected Stream playback.' }, 404, corsOrigin);
      }
      if (claims.firebase.sign_in_provider === 'anonymous' && !lesson.isIntro) {
        return jsonResponse({ error: 'Guest access is limited to introductory lessons.' }, 403, corsOrigin);
      }

      const customerCode = env.STREAM_CUSTOMER_CODE;
      if (!/^[a-z0-9-]+$/i.test(customerCode)) {
        return jsonResponse({ error: 'Stream playback is not configured.' }, 500, corsOrigin);
      }
      await getProtectedStreamVideo(
        lesson.streamId,
        env,
        new URL(allowedOrigin).hostname,
      );

      const cloudflareResponse = await fetch(
        `${CLOUDFLARE_API_URL}/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/stream/${encodeURIComponent(lesson.streamId)}/token`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            exp: Math.floor(Date.now() / 1000) + TOKEN_LIFETIME_SECONDS,
            downloadable: false,
          }),
        },
      );

      const cloudflareData = await cloudflareResponse.json();
      const playbackToken = cloudflareData.result?.token;
      if (!cloudflareResponse.ok || cloudflareData.success !== true || typeof playbackToken !== 'string') {
        console.error('Cloudflare Stream token request failed.', cloudflareData.errors || cloudflareResponse.status);
        return jsonResponse({ error: 'Could not authorize protected playback.' }, 502, corsOrigin);
      }

      return jsonResponse({
        playbackUrl: `https://customer-${customerCode}.cloudflarestream.com/${playbackToken}/iframe`,
      }, 200, corsOrigin);
    } catch (error) {
      console.error('Protected playback authorization failed.', error);
      return jsonResponse({ error: 'Could not authorize protected playback.' }, 401, corsOrigin);
    }
  },
};
