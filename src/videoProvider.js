const tokenEndpoint = import.meta.env.VITE_VIDEO_TOKEN_ENDPOINT || '';

export function getVideoProvider() {
  return 'Cloudflare Stream (signed playback)';
}

export async function getPlaybackSource(video, user) {
  if (!tokenEndpoint) {
    throw new Error('Protected playback is not configured: VITE_VIDEO_TOKEN_ENDPOINT is missing.');
  }
  if (!user) {
    throw new Error('Sign in is required to authorize video playback.');
  }
  if (!video.id) {
    throw new Error('This lesson has no authorization ID.');
  }

  const tokenUrl = new URL(tokenEndpoint);
  const idToken = await user.getIdToken();
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lessonId: video.id }),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });

  if (!response.ok) {
    throw new Error(`Video authorization failed (${response.status}).`);
  }

  const data = await response.json();
  if (typeof data.playbackUrl !== 'string' || !data.playbackUrl) {
    throw new Error('Video authorization endpoint returned no playbackUrl.');
  }
  const playbackUrl = new URL(data.playbackUrl);
  if (playbackUrl.protocol !== 'https:' || !playbackUrl.hostname.endsWith('.cloudflarestream.com')) {
    throw new Error('Video authorization endpoint returned an untrusted playback URL.');
  }

  return {
    type: 'cloudflare',
    src: playbackUrl.href,
    poster: data.poster || '',
  };
}