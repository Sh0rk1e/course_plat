import { useEffect, useMemo, useState } from 'react';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';

const initialForm = {
  title: '', lessonDate: '', youtubeId: '', videoId: '', videoUrl: '',
  description: '', order: 1, isIntro: false,
};

function dateLabel(dateKey) {
  if (!dateKey) return 'Unscheduled';
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).format(date);
}

function sortLessons(a, b) {
  const dateCompare = (a.lessonDate || a.date || '').localeCompare(b.lessonDate || b.date || '');
  if (dateCompare !== 0) return dateCompare;
  return (Number(a.order) || 0) - (Number(b.order) || 0);
}

export default function AdminPanel() {
  const [videos, setVideos] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'videos'), snap => {
      setVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(sortLessons));
      setError('');
    }, err => setError(err.message));
    return unsubscribe;
  }, []);

  const dates = useMemo(() => [...new Set(videos.map(v => v.lessonDate || v.date || '').filter(Boolean))].sort(), [videos]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return videos.filter(v => {
      const date = v.lessonDate || v.date || '';
      const matchesDate = dateFilter === 'all' || date === dateFilter;
      const haystack = `${v.title || ''} ${v.description || ''} ${v.videoId || ''} ${v.youtubeId || ''}`.toLowerCase();
      return matchesDate && (!term || haystack.includes(term));
    });
  }, [videos, search, dateFilter]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach(v => {
      const key = v.lessonDate || v.date || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(v);
    });
    return [...map.entries()].sort(([a], [b]) => {
      if (!a) return 1;
      if (!b) return -1;
      return b.localeCompare(a);
    });
  }, [filtered]);

  function change(e) {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  function edit(v) {
    setEditingId(v.id);
    setForm({
      title: v.title || '',
      lessonDate: v.lessonDate || v.date || '',
      youtubeId: v.youtubeId || '',
      videoId: v.videoId || '',
      videoUrl: v.videoUrl || '',
      description: v.description || '',
      order: v.order ?? 1,
      isIntro: Boolean(v.isIntro),
    });
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reset() {
    setEditingId(null);
    setForm({ ...initialForm, order: Math.max(1, videos.length + 1) });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      if (!form.title.trim()) throw new Error('Title is required.');
      const payload = {
        title: form.title.trim(),
        lessonDate: form.lessonDate || '',
        youtubeId: form.youtubeId.trim(),
        videoId: form.videoId.trim(),
        videoUrl: form.videoUrl.trim(),
        description: form.description.trim(),
        order: Number(form.order) || 1,
        isIntro: Boolean(form.isIntro),
      };
      if (!payload.youtubeId && !payload.videoId && !payload.videoUrl) {
        throw new Error('Enter a YouTube ID, Cloudflare Stream ID, or video URL.');
      }
      if (editingId) await updateDoc(doc(db, 'videos', editingId), payload);
      else await addDoc(collection(db, 'videos'), payload);
      setMessage(editingId ? 'Lesson updated.' : 'Lesson added.');
      reset();
    } catch (err) {
      setError(err.message || 'Could not save the lesson.');
    } finally { setBusy(false); }
  }

  async function remove(id) {
    if (!window.confirm('Delete this lesson?')) return;
    try {
      await deleteDoc(doc(db, 'videos', id));
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
      setMessage('Lesson deleted.');
    } catch (err) { setError(err.message || 'Could not delete the lesson.'); }
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (!ids.length || !window.confirm(`Delete ${ids.length} selected lesson${ids.length === 1 ? '' : 's'}?`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await Promise.all(ids.map(id => deleteDoc(doc(db, 'videos', id))));
      setSelected(new Set());
      setMessage(`${ids.length} lesson${ids.length === 1 ? '' : 's'} deleted.`);
    } catch (err) {
      setError(err.message || 'Some lessons could not be deleted.');
    } finally { setBusy(false); }
  }

  async function duplicate(v) {
    setBusy(true); setError(''); setMessage('');
    try {
      const copy = { ...v };
      delete copy.id;
      await addDoc(collection(db, 'videos'), {
        ...copy,
        title: `${v.title || 'Lesson'} (copy)`,
        order: Math.max(1, ...videos.map(item => Number(item.order) || 0)) + 1,
        isIntro: false,
      });
      setMessage('Lesson duplicated. Edit it to assign its final title and date.');
    } catch (err) {
      setError(err.message || 'Could not duplicate the lesson.');
    } finally { setBusy(false); }
  }

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev);
      const all = filtered.every(v => next.has(v.id));
      filtered.forEach(v => all ? next.delete(v.id) : next.add(v.id));
      return next;
    });
  }

  return (
    <section>
      <div className="hero">
        <div>
          <div className="eyebrow">ADMIN CONSOLE</div>
          <h1>Manage course</h1>
          <p className="muted">Organize lessons by day, search the library, and manage multiple lessons at once.</p>
        </div>
      </div>

      <div className="admin-stats">
        <div className="stat-card"><strong>{videos.length}</strong><span>Total lessons</span></div>
        <div className="stat-card"><strong>{dates.length}</strong><span>Lesson days</span></div>
        <div className="stat-card"><strong>{videos.filter(v => v.isIntro).length}</strong><span>Guest intro</span></div>
        <div className="stat-card"><strong>{videos.filter(v => !(v.lessonDate || v.date)).length}</strong><span>Unscheduled</span></div>
      </div>

      <div className="admin-layout">
        <form className="panel" onSubmit={submit}>
          <h2>{editingId ? 'Edit lesson' : 'Add lesson'}</h2>
          <label>Lesson title<input name="title" value={form.title} onChange={change} required /></label>
          <label>Lesson date <span className="hint">This creates the learner-facing day folder.</span><input name="lessonDate" type="date" value={form.lessonDate} onChange={change} /></label>
          <label>Lesson order <span className="hint">Order within the selected day</span><input name="order" type="number" min="1" step="1" value={form.order} onChange={change} required /></label>
          <label>YouTube ID <span className="hint">(provider = youtube)</span><input name="youtubeId" value={form.youtubeId} onChange={change} placeholder="dQw4w9WgXcQ" /></label>
          <label>Cloudflare Stream ID <span className="hint">(provider = cloudflare)</span><input name="videoId" value={form.videoId} onChange={change} placeholder="Stream video UID" /></label>
          <label>Video URL <span className="hint">Optional; existing Firebase URLs can be kept here.</span><input name="videoUrl" value={form.videoUrl} onChange={change} placeholder="https://..." /></label>
          <label>Description<textarea name="description" value={form.description} onChange={change} rows="4" /></label>
          <label className="checkbox-label"><input name="isIntro" type="checkbox" checked={form.isIntro} onChange={change} /> This is the guest introductory lesson</label>
          {message && <div className="success-box">{message}</div>}
          {error && <div className="error-box">{error}</div>}
          <div className="button-row">
            <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add lesson'}</button>
            {editingId && <button type="button" className="button button-secondary" onClick={reset}>Cancel</button>}
          </div>
        </form>

        <div className="panel">
          <div className="admin-toolbar">
            <div><h2>Lesson library</h2><p className="muted">Newest lesson days first.</p></div>
            <button className="button button-small button-secondary" type="button" onClick={toggleAll}>
              {filtered.length && filtered.every(v => selected.has(v.id)) ? 'Clear selection' : 'Select all'}
            </button>
          </div>
          <div className="filter-row">
            <input aria-label="Search lessons" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, description or video ID…" />
            <select aria-label="Filter by date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
              <option value="all">All dates</option>
              {dates.map(date => <option key={date} value={date}>{dateLabel(date)}</option>)}
            </select>
          </div>

          {selected.size > 0 && (
            <div className="bulk-bar">
              <strong>{selected.size} selected</strong>
              <button className="button button-small button-danger" type="button" disabled={busy} onClick={bulkDelete}>Delete selected</button>
            </div>
          )}

          <div className="admin-groups">
            {grouped.map(([date, items]) => (
              <div className="admin-group" key={date || 'unscheduled'}>
                <div className="admin-group-heading"><span>📁</span><strong>{dateLabel(date)}</strong><small>{items.length} lessons</small></div>
                <div className="admin-list">
                  {items.map(v => (
                    <div className="admin-item" key={v.id}>
                      <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} aria-label={`Select ${v.title}`} />
                      <div className="admin-item-copy">
                        <strong>{v.order}. {v.title}</strong>
                        <small>{v.videoUrl || v.videoId || v.youtubeId || 'No video source'}{v.isIntro ? ' · Guest intro' : ''}</small>
                      </div>
                      <div className="button-row">
                        <button className="button button-small button-secondary" type="button" onClick={() => edit(v)}>Edit</button>
                        <button className="button button-small button-secondary" type="button" disabled={busy} onClick={() => duplicate(v)}>Duplicate</button>
                        <button className="button button-small button-danger" type="button" disabled={busy} onClick={() => remove(v.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!grouped.length && <p className="muted">No lessons match your filters.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
