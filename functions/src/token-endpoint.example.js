/*
 * Reference Cloudflare Worker architecture.
 *
 * This is intentionally an example: Cloudflare Stream signing APIs and Firebase
 * token verification should be configured against your current provider APIs.
 * Keep secrets server-side.
 *
 * Request:
 *   GET /token?videoId=<STREAM_UID>
 *   Authorization: Bearer <Firebase ID token>
 *
 * Response:
 *   { "playbackUrl": "<short-lived signed playback URL>" }
 */

export default {
  async fetch(request, env) {
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // 1. Read Authorization: Bearer <Firebase ID token>.
    // 2. Verify it using Firebase Admin / Google public keys.
    // 3. Reject anonymous users for non-intro lessons.
    // 4. Validate videoId against an allow-list/database.
    // 5. Create a short-lived Cloudflare Stream signed token using
    //    env.CLOUDFLARE_STREAM_SIGNING_KEY.
    // 6. Return the signed playback URL.

    return Response.json(
      { error: 'Configure the token verification and signing provider before deployment.' },
      { status: 501 }
    );
  }
};