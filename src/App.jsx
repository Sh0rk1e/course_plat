import { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, onAuthStateChanged, signOut } from './firebase';
import { Navigate, Link, Routes, Route, useLocation } from 'react-router-dom';
import Auth from './components/Auth';
import VideoGallery from './components/VideoGallery';
import AdminPanel from './components/AdminPanel';
import Settings from './components/Settings';

function Loading() {
  return <div className="page-center"><div className="spinner" /><p>Loading…</p></div>;
}

function Layout({ user, profile, children }) {
  const location = useLocation();
  const admin = profile?.role === 'admin';

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">Course Platform</Link>
        <nav>
          <Link className={location.pathname === '/' ? 'active' : ''} to="/">Lessons</Link>
          {admin && <Link className={location.pathname === '/admin' ? 'active' : ''} to="/admin">Admin</Link>}
          <Link className={location.pathname === '/settings' ? 'active' : ''} to="/settings">Settings</Link>
          <span className="user-badge">{user.isAnonymous ? 'Guest' : (user.email || 'User')}</span>
          <button className="button button-small button-ghost" onClick={() => signOut(auth)}>Sign out</button>
        </nav>
      </header>
      <main className="container">{children}</main>
    </div>
  );
}

function Protected({ user, children }) {
  return user ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setUser(nextUser);
    if (!nextUser) {
      setProfile(null);
      return;
    }

    try {
      const ref = doc(db, 'users', nextUser.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setProfile(snap.data());
      } else if (!nextUser.isAnonymous) {
        const newProfile = {
          email: nextUser.email || '',
          displayName: nextUser.displayName || '',
          role: 'user',
          createdAt: serverTimestamp(),
        };
        await setDoc(ref, newProfile);
        setProfile(newProfile);
      } else {
        setProfile({ role: 'guest' });
      }
    } catch (error) {
      console.error('Profile error:', error);
      setProfile(nextUser.isAnonymous ? { role: 'guest' } : null);
    }
  }), []);

  if (user === undefined) return <Loading />;

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/" element={
        <Protected user={user}>
          <Layout user={user} profile={profile}><VideoGallery user={user} /></Layout>
        </Protected>
      } />
      <Route path="/admin" element={
        <Protected user={user}>
          {profile?.role === 'admin'
            ? <Layout user={user} profile={profile}><AdminPanel /></Layout>
            : <Navigate to="/" replace />}
        </Protected>
      } />
      <Route path="/settings" element={
        <Protected user={user}>
          <Layout user={user} profile={profile}><Settings user={user} profile={profile} /></Layout>
        </Protected>
      } />
      <Route path="*" element={<Navigate to={user ? '/' : '/auth'} replace />} />
    </Routes>
  );
}