import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { getPlaybackSource, getVideoProvider } from '../videoProvider';

function VideoCard({ video, locked, user }) {
  const [playback, setPlayback] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (locked) return;
    let cancelled = false;
    getPlaybackSource(video, user).then(source => {
      if (!cancelled) setPlayback(source);
    }).catch(err => {
      if (!cancelled) setError(err.message);
    });
    return () => { cancelled = true; };
  }, [video, locked, user]);

  return (
    <article className={`video-card ${locked ? 'is-locked' : ''}`}>
      {locked ? (
        <div className="video-locked">
          <div className="lock-icon">🔒</div>
          <h3>{video.title}</h3>
          <p>Create an account to unlock all lessons.</p>
        </div>
      ) : (
        <div className="video-frame">
          {error ? <div className="video-error">{error}</div> : playback?.type === 'cloudflare' ? (
            <iframe
              src={playback.src}
              title={video.title}
              loading="lazy"
              allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : playback ? (
            <iframe
              src={playback.src}
              title={video.title}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : <div className="video-loading">Authorizing video…</div>}
        </div>
      )}
      <div className="video-meta">
        <span className="lesson-number">Lesson {video.order ?? '—'}</span>
        <h3>{video.title}</h3>
        {video.description && <p>{video.description}</p>}
      </div>
    </article>
  );
}

export default function VideoGallery({ user }) {
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('order', 'asc'));
    return onSnapshot(q, snapshot => {
      setVideos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setError('');
    }, err => {
      console.error(err);
      setError('Unable to load lessons. Check Firebase configuration and Firestore rules.');
    });
  }, []);

  const sorted = [...videos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const introId = sorted.find(v => v.isIntro)?.id;

  return (
    <section>
      <div className="hero">
        <div>
          <div className="eyebrow">YOUR COURSE</div>
          <h1>Video lessons</h1>
          <p className="muted">
            {user.isAnonymous ? 'Guest preview: the introduction is available.' : `All available lessons are unlocked. Provider: ${getVideoProvider()}.`}
          </p>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {!error && !sorted.length && <div className="empty-state">No lessons have been published yet.</div>}

      <div className="video-grid">
        {sorted.map(video => (
          <VideoCard key={video.id} video={video} user={user} locked={user.isAnonymous && video.id !== introId} />
        ))}
      </div>
    </section>
  );
}