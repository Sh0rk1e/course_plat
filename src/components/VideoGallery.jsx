import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { getPlaybackSource, getVideoProvider } from '../videoProvider';
import { lessonDateKey } from '../dateUtils';

function formatDate(dateKey) {
  if (!dateKey) return 'Unscheduled';
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function dateKey(video) {
  return lessonDateKey(video);
}

function VideoCard({ video, locked, user, preferences }) {
  const [playback, setPlayback] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (locked) return;
    let cancelled = false;
    setPlayback(null);
    setError('');
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
        {video.description && preferences.showDescriptions && <p>{video.description}</p>}
      </div>
    </article>
  );
}

export default function VideoGallery({ user }) {
  const [videos, setVideos] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [error, setError] = useState('');
  const [preferences, setPreferences] = useState({ showDescriptions: true, reduceMotion: false });

  useEffect(() => {
    const q = user.isAnonymous
      ? query(collection(db, 'videos'), where('isIntro', '==', true))
      : query(collection(db, 'videos'));
    return onSnapshot(q, snapshot => {
      setVideos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setError('');
    }, err => {
      console.error(err);
      setError('Unable to load lessons. Check Firebase configuration and Firestore rules.');
    });
  }, []);

  useEffect(() => {
    if (!user || user.isAnonymous) return undefined;
    return onSnapshot(doc(db, 'users', user.uid), snapshot => {
      const data = snapshot.exists() ? snapshot.data() : {};
      setPreferences(prev => ({ ...prev, ...(data.preferences || {}) }));
    }, err => {
      console.error('Preference error:', err);
    });
  }, [user]);

  const sorted = useMemo(() => [...videos].sort((a, b) => {
    const dateCompare = dateKey(a).localeCompare(dateKey(b));
    if (dateCompare !== 0) return dateCompare;
    return (Number(a.order) || 0) - (Number(b.order) || 0);
  }), [videos]);

  const groups = useMemo(() => {
    const map = new Map();
    sorted.forEach(video => {
      const key = dateKey(video);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(video);
    });
    return [...map.entries()]
      .sort(([a], [b]) => {
        if (!a) return 1;
        if (!b) return -1;
        return b.localeCompare(a);
      })
      .map(([key, items]) => ({ key, items }));
  }, [sorted]);

  useEffect(() => {
    if (selectedDate === null && groups.length) setSelectedDate(groups[0].key);
    if (selectedDate !== null && groups.length && !groups.some(g => g.key === selectedDate)) {
      setSelectedDate(groups[0].key);
    }
  }, [groups, selectedDate]);

  const activeGroup = groups.find(group => group.key === selectedDate) || groups[0];
  const introId = sorted.find(v => v.isIntro)?.id;

  return (
    <section>
      <div className="hero course-hero">
        <div>
          <div className="eyebrow">YOUR COURSE</div>
          <h1>Course lessons</h1>
          <p className="muted">
            {user.isAnonymous
              ? 'Guest preview: the introduction is available.'
              : `Choose a lesson day below. Dates are read automatically from lesson names when needed. Provider: ${getVideoProvider()}.`}
          </p>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {!error && !sorted.length && <div className="empty-state">No lessons have been published yet.</div>}

      {!!groups.length && (
        <>
          <div className="day-folder-grid" aria-label="Lesson days">
            {groups.map(group => (
              <button
                type="button"
                className={`day-folder ${selectedDate === group.key ? 'selected' : ''}`}
                key={group.key || 'unscheduled'}
                onClick={() => setSelectedDate(group.key)}
              >
                <span className="folder-icon" aria-hidden="true" />
                <span className="day-folder-copy">
                  <strong>{formatDate(group.key)}</strong>
                  <small>{group.items.length} {group.items.length === 1 ? 'lesson' : 'lessons'}</small>
                </span>
                <span className="folder-arrow">›</span>
              </button>
            ))}
          </div>

          {activeGroup && (
            <section className="lesson-day" aria-labelledby="active-day-title">
              <div className="day-heading">
                <div>
                  <div className="eyebrow">LESSON DAY</div>
                  <h2 id="active-day-title">{formatDate(activeGroup.key)}</h2>
                </div>
                <span className="day-count">{activeGroup.items.length} lessons</span>
              </div>
              <div className="video-grid">
                {activeGroup.items.map(video => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    user={user}
                    preferences={preferences}
                    locked={user.isAnonymous && video.id !== introId}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
