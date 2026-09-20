import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const initialForm = { title: '', youtubeId: '', videoId: '', description: '', order: 1, isIntro: false };

export default function AdminPanel() {
  const [videos, setVideos] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'videos'), orderBy('order', 'asc'));
    return onSnapshot(q, snap => setVideos(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => setError(err.message));
  }, []);

  function change(e) {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  function edit(v) {
    setEditingId(v.id);
    setForm({
      title: v.title || '',
      youtubeId: v.youtubeId || '',
      videoId: v.videoId || '',
      description: v.description || '',
      order: v.order ?? 1,
      isIntro: Boolean(v.isIntro)
    });
    setMessage('');
    setError('');
  }

  function reset() { setEditingId(null); setForm(initialForm); }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      if (!form.title.trim()) throw new Error('Title is required.');
      const payload = {
        title: form.title.trim(),
        youtubeId: form.youtubeId.trim(),
        videoId: form.videoId.trim(),
        description: form.description.trim(),
        order: Number(form.order),
        isIntro: Boolean(form.isIntro)
      };
      if (!payload.youtubeId && !payload.videoId) throw new Error('Enter a YouTube ID or a Cloudflare Stream video ID.');
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
    try { await deleteDoc(doc(db, 'videos', id)); setMessage('Lesson deleted.'); }
    catch (err) { setError(err.message || 'Could not delete the lesson.'); }
  }

  return (
    <section>
      <div className="hero">
        <div><div className="eyebrow">ADMIN</div><h1>Manage lessons</h1><p className="muted">Add, edit, or remove course videos.</p></div>
      </div>
      <div className="admin-layout">
        <form className="panel" onSubmit={submit}>
          <h2>{editingId ? 'Edit lesson' : 'Add lesson'}</h2>
          <label>Title<input name="title" value={form.title} onChange={change} required /></label>
          <label>YouTube ID <span className="hint">(used when provider = youtube)</span><input name="youtubeId" value={form.youtubeId} onChange={change} placeholder="dQw4w9WgXcQ" /></label>
          <label>Cloudflare Stream ID <span className="hint">(used when provider = cloudflare)</span><input name="videoId" value={form.videoId} onChange={change} placeholder="Stream video UID" /></label>
          <label>Description<textarea name="description" value={form.description} onChange={change} rows="4" /></label>
          <label>Order<input name="order" type="number" min="1" step="1" value={form.order} onChange={change} required /></label>
          <label className="checkbox-label"><input name="isIntro" type="checkbox" checked={form.isIntro} onChange={change} /> This is the guest introductory lesson</label>
          {message && <div className="success-box">{message}</div>}
          {error && <div className="error-box">{error}</div>}
          <div className="button-row">
            <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add lesson'}</button>
            {editingId && <button type="button" className="button button-secondary" onClick={reset}>Cancel</button>}
          </div>
        </form>
        <div className="panel">
          <h2>Published lessons</h2>
          <div className="admin-list">
            {videos.map(v => (
              <div className="admin-item" key={v.id}>
                <div><strong>{v.order}. {v.title}</strong><small>{v.videoId || v.youtubeId}{v.isIntro ? ' · Guest intro' : ''}</small></div>
                <div className="button-row">
                  <button className="button button-small button-secondary" onClick={() => edit(v)}>Edit</button>
                  <button className="button button-small button-danger" onClick={() => remove(v.id)}>Delete</button>
                </div>
              </div>
            ))}
            {!videos.length && <p className="muted">No lessons yet.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}