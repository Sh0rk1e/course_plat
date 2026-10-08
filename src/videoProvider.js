const provider = import.meta.env.VITE_VIDEO_PROVIDER || 'youtube';
const tokenEndpoint = import.meta.env.VITE_VIDEO_TOKEN_ENDPOINT || '';

export function getVideoProvider() {
  return provider;
}

export async function getPlaybackSource(video, user) {
  if (provider === 'cloudflare') {
    if (!tokenEndpoint) {
      throw new Error('Cloudflare Stream is enabled but VITE_VIDEO_TOKEN_ENDPOINT is missing.');
    }

    const id = video.videoId || video.youtubeId || video.videoUrl;
    const tokenUrl = new URL(tokenEndpoint);
    tokenUrl.searchParams.set('videoId', id);

    const response = await fetch(tokenUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error(`Video authorization failed (${response.status}).`);
    }

    const data = await response.json();
    if (!data.playbackUrl) {
      throw new Error('Video authorization endpoint returned no playbackUrl.');
    }

    return {
      type: 'cloudflare',
      src: data.playbackUrl,
      poster: data.poster || '',
    };
  }

  const source = video.youtubeId || video.videoId || video.videoUrl;
  if (!source) throw new Error('This lesson has no video source configured.');

  let youtubeId = source;
  const youtubeMatch = String(source).match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([^?&/]+)/
  );
  if (youtubeMatch) youtubeId = youtubeMatch[1];

  return {
    type: 'youtube',
    src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?modestbranding=1&rel=0`,
  };
}