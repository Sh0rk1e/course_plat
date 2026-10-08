# Protected Cloudflare Stream playback

`src/token-endpoint.example.js` is a Cloudflare Worker example for minting one-hour Stream tokens after verifying Firebase ID tokens.

Configure Worker variables:

- `APP_ORIGIN`: exact site origin, for example `https://sh0rk1e.github.io` (no path or trailing slash).
- `FIREBASE_PROJECT_ID`: Firebase project ID.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.
- `STREAM_CUSTOMER_CODE`: customer code used by `customer-<CODE>.cloudflarestream.com`.

Configure the `CLOUDFLARE_API_TOKEN` Worker secret with Stream read/edit access. Never put it in Vite, GitHub Pages variables, or frontend code.

Set the GitHub Actions variable `VITE_VIDEO_TOKEN_ENDPOINT` to the deployed Worker URL. The frontend now defaults to protected playback and fails closed if this endpoint is missing.

## Protect each video before publishing

For every Stream video:

1. Upload the source to Cloudflare Stream; YouTube videos cannot be made private by this integration.
2. Set `requireSignedURLs` to `true`.
3. Set `allowedOrigins` to the hostname of the course site only (for GitHub Pages: `sh0rk1e.github.io`; use your custom hostname instead if you publish on one).
4. Store the Stream UID in the lesson's `videoId` field. Do not use `youtubeId` or a public `videoUrl`.

The Worker refuses to issue a token unless signed URLs and the exact configured site hostname are enabled on that Stream video. It reads the lesson through Firestore using the user's Firebase ID token, so Firestore rules continue to enforce access. Anonymous users can only receive tokens for intro lessons.

Saving a legacy lesson from Admin removes its `youtubeId` and `videoUrl` fields. Existing documents must be resaved after adding a Stream UID or have those fields removed directly in Firestore. The browser cannot hide legacy source values already returned by Firestore.

## Limits

The player must receive a short-lived playback token to play the video. A determined viewer can inspect browser network traffic or record the screen; no web player can guarantee that a video or its temporary playback URL is impossible to capture. Signed URLs, site-origin restrictions, short expiry, no download permission, and authenticated authorization prevent ordinary public-link/YouTube access, but they are not DRM.
