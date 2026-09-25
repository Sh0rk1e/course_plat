import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const ADMIN_EMAILS = ['ovsiankinna@gmail.com'];

const userDefaults = {
  displayName: '',
  showDescriptions: true,
  reduceMotion: false,
  tomatoThrowing: true,
};

const adminDefaults = {
  autoDateParsing: true,
  defaultProvider: 'youtube',
  guestIntroEnabled: true,
};

export default function Settings({ user, profile }) {
  const isAdmin = Boolean(user && !user.isAnonymous && ADMIN_EMAILS.includes((user.email || '').toLowerCase()));
  const [tab, setTab] = useState(isAdmin ? 'admin' : 'profile');
  const [userForm, setUserForm] = useState(userDefaults);
  const [adminForm, setAdminForm] = useState(adminDefaults);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (!cancelled && userSnap.exists()) {
          const data = userSnap.data();
          setUserForm({ ...userDefaults, ...(data.preferences || {}), displayName: data.displayName || '' });
        }
        if (isAdmin) {
          // Keep admin-only settings on the admin user's own profile.
          // This avoids a separate settings document becoming a Firestore
          // permission bottleneck and keeps the values protected by the
          // existing per-user rules.
          const data = userSnap.exists() ? userSnap.data() : {};
          if (!cancelled && data.adminSettings) {
            setAdminForm({ ...adminDefaults, ...data.adminSettings });
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load settings.');
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user.uid, isAdmin]);

  function updateUser(name, value) {
    setUserForm(prev => ({ ...prev, [name]: value }));
  }

  function updateAdmin(name, value) {
    setAdminForm(prev => ({ ...prev, [name]: value }));
  }

  async function saveUser(e) {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      await setDoc(doc(db, 'users', user.uid), {
        displayName: userForm.displayName.trim(),
        preferences: {
          showDescriptions: Boolean(userForm.showDescriptions),
          reduceMotion: Boolean(userForm.reduceMotion),
          tomatoThrowing: Boolean(userForm.tomatoThrowing),
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setMessage('Your settings were saved.');
    } catch (err) {
      setError(err.message || 'Could not save your settings.');
    } finally { setBusy(false); }
  }

  async function saveAdmin(e) {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      await setDoc(doc(db, 'users', user.uid), {
        adminSettings: { ...adminForm },
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setMessage('Admin settings were saved.');
    } catch (err) {
      setError(err.message || 'Could not save admin settings.');
    } finally { setBusy(false); }
  }

  return (
    <section>
      <div className="hero settings-hero">
        <div>
          <div className="eyebrow">SETTINGS</div>
          <h1>{isAdmin ? 'Settings' : 'Your settings'}</h1>
          <p className="muted">
            {isAdmin ? 'Manage your admin preferences and lesson automation.' : 'Manage your profile and lesson viewing preferences.'}
          </p>
        </div>
      </div>

      <div className="settings-layout">
        <aside className="settings-nav panel">
          {!isAdmin && (
            <>
              <button className={tab === 'profile' ? 'settings-nav-item active' : 'settings-nav-item'} onClick={() => setTab('profile')}>Profile</button>
              <button className={tab === 'preferences' ? 'settings-nav-item active' : 'settings-nav-item'} onClick={() => setTab('preferences')}>Lesson preferences</button>
            </>
          )}
          {isAdmin && (
            <>
              <button className={tab === 'automation' ? 'settings-nav-item active' : 'settings-nav-item'} onClick={() => setTab('automation')}>Lesson automation</button>
              <button className={tab === 'access' ? 'settings-nav-item active' : 'settings-nav-item'} onClick={() => setTab('access')}>Access</button>
              <button className={tab === 'preferences' ? 'settings-nav-item active' : 'settings-nav-item'} onClick={() => setTab('preferences')}>Lesson preferences</button>
              <button className={tab === 'profile' ? 'settings-nav-item active' : 'settings-nav-item'} onClick={() => setTab('profile')}>Admin profile</button>
            </>
          )}
        </aside>

        <div className="panel settings-content">
          {error && <div className="error-box">{error}</div>}
          {message && <div className="success-box">{message}</div>}

          {!isAdmin && tab === 'profile' && (
            <form onSubmit={saveUser}>
              <div><h2>Profile</h2><p className="muted">This information is stored with your account.</p></div>
              <label>Display name<input value={userForm.displayName} onChange={e => updateUser('displayName', e.target.value)} placeholder="Your name" /></label>
              <label>Email<input value={user.email || ''} readOnly /></label>
              <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
            </form>
          )}

          {!isAdmin && tab === 'preferences' && (
            <form onSubmit={saveUser}>
              <div><h2>Lesson preferences</h2><p className="muted">Choose how the lesson library should look for you.</p></div>
              <label className="setting-toggle"><input type="checkbox" checked={userForm.showDescriptions} onChange={e => updateUser('showDescriptions', e.target.checked)} /><span><strong>Show lesson descriptions</strong><small>Display descriptions below video titles.</small></span></label>
              <label className="setting-toggle"><input type="checkbox" checked={userForm.reduceMotion} onChange={e => updateUser('reduceMotion', e.target.checked)} /><span><strong>Reduce motion</strong><small>Reduce interface animations and transitions.</small></span></label>
              <label className="setting-toggle"><input type="checkbox" checked={userForm.tomatoThrowing} onChange={e => updateUser('tomatoThrowing', e.target.checked)} /><span><strong>Tomato throwing</strong><small>Show a tomato button while watching a lesson so you can throw tomatoes at the video.</small></span></label>
              <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</button>
            </form>
          )}

          {isAdmin && (tab === 'automation' || tab === 'access') && (
            <form onSubmit={saveAdmin}>
              {tab === 'automation' && <>
                <div><h2>Lesson automation</h2><p className="muted">Control how newly imported or existing lesson names are interpreted.</p></div>
                <label className="setting-toggle"><input type="checkbox" checked={adminForm.autoDateParsing} onChange={e => updateAdmin('autoDateParsing', e.target.checked)} /><span><strong>Automatic date parsing</strong><small>Recognize dates such as 02.09.26 or 07.09.2026 in lesson titles.</small></span></label>
                <label>Default video provider<select value={adminForm.defaultProvider} onChange={e => updateAdmin('defaultProvider', e.target.value)}><option value="youtube">YouTube</option><option value="cloudflare">Cloudflare Stream</option><option value="auto">Auto-detect</option></select></label>
              </>}
              {tab === 'access' && <>
                <div><h2>Access</h2><p className="muted">Control the introductory guest experience.</p></div>
                <label className="setting-toggle"><input type="checkbox" checked={adminForm.guestIntroEnabled} onChange={e => updateAdmin('guestIntroEnabled', e.target.checked)} /><span><strong>Guest introduction</strong><small>Allow anonymous visitors to access the lesson marked as the introduction.</small></span></label>
              </>}
              <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save admin settings'}</button>
            </form>
          )}

          {isAdmin && tab === 'preferences' && (
            <form onSubmit={saveUser}>
              <div><h2>Lesson preferences</h2><p className="muted">Choose the interactive features available while watching lessons.</p></div>
              <label className="setting-toggle"><input type="checkbox" checked={userForm.tomatoThrowing} onChange={e => updateUser('tomatoThrowing', e.target.checked)} /><span><strong>Tomato throwing</strong><small>Show a tomato button while watching a lesson so you can throw tomatoes at the video.</small></span></label>
              <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</button>
            </form>
          )}

          {isAdmin && tab === 'profile' && (
            <form onSubmit={saveUser}>
              <div><h2>Admin profile</h2><p className="muted">Your account information and personal preferences.</p></div>
              <label>Display name<input value={userForm.displayName} onChange={e => updateUser('displayName', e.target.value)} /></label>
              <label>Email<input value={user.email || ''} readOnly /></label>
              <button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
