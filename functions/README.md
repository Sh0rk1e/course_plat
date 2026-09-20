# Optional Cloudflare Stream token service

The frontend supports a stronger video-protection mode using Cloudflare Stream signed playback.

This folder contains a reference architecture rather than a deployed backend. The signing secret must NEVER be placed in the React/GitHub Pages frontend.

Recommended deployment:

1. Create a Cloudflare Worker/API endpoint.
2. Keep the Cloudflare Stream signing key in the Worker secret store.
3. Verify the Firebase ID token sent by the browser.
4. Confirm the Firebase user is authenticated and, for full lessons, non-anonymous.
5. Confirm the requested video is permitted.
6. Generate a short-lived Cloudflare Stream signed token.
7. Return `{ "playbackUrl": "https://videodelivery.net/<TOKEN>/manifest/video.m3u8" }` or the current Cloudflare Stream signed playback URL for your account.

The browser should call this endpoint only after Firebase Auth succeeds.

Do not implement signing with a secret in Vite environment variables: VITE_* values are public and become part of the shipped JavaScript.
