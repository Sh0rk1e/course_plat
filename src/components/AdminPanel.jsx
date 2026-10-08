import { useEffect, useMemo, useState } from 'react';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, updateDoc, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { inferDateFromTitle, lessonDateKey } from '../dateUtils';

const initialForm = {
  title: '', lessonDate: '', youtubeId: '', videoId: '', videoUrl: '',
  description: '', order: 1, isIntro: false,
};

function dateLabel(dateKey) {
  if (!dateKey) return 'Unscheduled';
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(date);
}

function sortLessons(a, b) {
  const dateCompare = lessonDateKey(a).localeCompare(lessonDateKey(b));
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
  const [bulkDate, setBulkDate] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'videos'), snap => {
      setVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort(sortLessons));
      setError('');
    }, err => setError(err.message));
    return unsubscribe;
  }, []);

  const dates = useMemo(() => [...new Set(videos.map(lessonDateKey).filter(Boolean))].sort(), [videos]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return videos.filter(v => {
      const date = lessonDateKey(v);
      const matchesDate = dateFilter === 'all' || date === dateFilter;
      const haystack = `${v.title || ''} ${v.description || ''} ${v.videoId || ''} ${v.youtubeId || ''} ${v.videoUrl || ''}`.toLowerCase();
      return matchesDate && (!term || haystack.includes(term));
    });
  }, [videos, search, dateFilter]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach(v => {
      const key = lessonDateKey(v);
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
      lessonDate: v.lessonDate || v.date || inferDateFromTitle(v.title || ''),
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
      const batch = writeBatch(db);
      ids.forEach(id => batch.delete(doc(db, 'videos', id)));
      await batch.commit();
      setSelected(new Set());
      setMessage(`${ids.length} lesson${ids.length === 1 ? '' : 's'} deleted.`);
    } catch (err) {
      setError(err.message || 'Some lessons could not be deleted.');
    } finally { setBusy(false); }
  }

  async function bulkSetDate(nextDate = bulkDate) {
    const ids = [...selected];
    if (!ids.length) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const batch = writeBatch(db);
      ids.forEach(id => batch.update(doc(db, 'videos', id), { lessonDate: nextDate || '' }));
      await batch.commit();
      setSelected(new Set());
      setMessage(nextDate
        ? `${ids.length} lesson${ids.length === 1 ? '' : 's'} moved to ${dateLabel(nextDate)}.`
        : `${ids.length} lesson${ids.length === 1 ? '' : 's'} moved to Unscheduled.`);
      setBulkDate('');
    } catch (err) {
      setError(err.message || 'Could not move the selected lessons.');
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
      const all = filtered.length > 0 && filtered.every(v => next.has(v.id));
      filtered.forEach(v => all ? next.delete(v.id) : next.add(v.id));
      return next;
    });
  }

  function toggleGroup(items) {
    setSelected(prev => {
      const next = new Set(prev);
      const all = items.every(v => next.has(v.id));
      items.forEach(v => all ? next.delete(v.id) : next.add(v.id));
      return next;
    });
  }

  return (
    <section>
      <div className="hero admin-hero">
        <div>
          <div className="eyebrow">ADMIN</div>
          <h1>Manage course</h1>
          <p className="muted">Add lessons, set their dates, or move several existing lessons at once.</p>
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
          <label>Lesson date <span className="hint">Optional override. If empty, the date is read automatically from the title.</span><input name="lessonDate" type="date" value={form.lessonDate} onChange={change} /></label>
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
            <div><h2>Lesson library</h2><p className="muted">Dates are detected automatically from names like <strong>02.09.26 програмування 1</strong>. You can still select lessons and assign a different date.</p></div>
            <button className="button button-small button-secondary" type="button" onClick={toggleAll} disabled={!filtered.length}>
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
              <div className="bulk-selection"><strong>{selected.size}</strong> selected</div>
              <div className="bulk-actions">
                <label className="bulk-date-label">Set date <input type="date" value={bulkDate} onChange={e => setBulkDate(e.target.value)} /></label>
                <button className="button button-small button-primary-auto" type="button" disabled={busy || !bulkDate} onClick={bulkSetDate}>Move selected</button>
                <button className="button button-small button-secondary" type="button" disabled={busy} onClick={() => { setBulkDate(''); bulkSetDate(''); }}>Clear date</button>
                <button className="button button-small button-danger" type="button" disabled={busy} onClick={bulkDelete}>Delete selected</button>
              </div>
            </div>
          )}

          <div className="admin-groups">
            {grouped.map(([date, items]) => {
              const allInGroup = items.length > 0 && items.every(v => selected.has(v.id));
              return (
                <div className="admin-group" key={date || 'unscheduled'}>
                  <div className="admin-group-heading">
                    <input type="checkbox" checked={allInGroup} onChange={() => toggleGroup(items)} aria-label={`Select all lessons for ${dateLabel(date)}`} />
                    <span className="folder-icon folder-icon-small" aria-hidden="true" />
                    <strong>{dateLabel(date)}</strong>
                    <small>{items.length} lessons</small>
                  </div>
                  <div className="admin-list">
                    {items.map(v => (
                      <div className={`admin-item ${selected.has(v.id) ? 'is-selected' : ''}`} key={v.id}>
                        <input type="checkbox" checked={selected.has(v.id)} onChange={() => toggle(v.id)} aria-label={`Select ${v.title}`} />
                        <div className="admin-item-copy">
                          <strong>{v.order}. {v.title}</strong>
                          <small>{v.videoUrl || v.videoId || v.youtubeId || 'No video source'}{v.isIntro ? ' · Guest intro' : ''}{!v.lessonDate && !v.date && inferDateFromTitle(v.title || '') ? ' · date from title' : ''}</small>
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
              );
            })}
            {!grouped.length && <p className="muted">No lessons match your filters.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
