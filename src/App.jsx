import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, onAuthStateChanged, signOut, getIdTokenResult } from './firebase';
import { Navigate, Link, Routes, Route, useLocation } from 'react-router-dom';
import Auth from './components/Auth';
import VideoGallery from './components/VideoGallery';
import AdminPanel from './components/AdminPanel';
import Settings from './components/Settings';

function isAdminAccount(user, claims = {}, profile = null) {
  return Boolean(
    user &&
    !user.isAnonymous &&
    (
      claims.admin === true ||
      claims.isAdmin === true ||
      claims.role === 'admin' ||
      profile?.role === 'admin'
    )
  );
}

function Loading() {
  return <div className="page-center"><div className="spinner" /><p>Loading…</p></div>;
}

function Layout({ user, profile, isAdmin, children }) {
  const location = useLocation();
  const admin = isAdmin;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const displayName = user.isAnonymous
    ? 'Guest'
    : (profile?.displayName?.trim() || user.displayName?.trim() || 'User');

  useEffect(() => {
    if (!menuOpen) return undefined;

    function handleOutsideClick(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setMenuOpen(false);
    }

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut(auth);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">Course Platform</Link>
        <nav>
          <Link className={location.pathname === '/' ? 'active' : ''} to="/">Lessons</Link>
          {admin && <Link className={location.pathname === '/admin' ? 'active' : ''} to="/admin">Admin</Link>}
          <div className="account-menu" ref={menuRef}>
            <button
              type="button"
              className={`account-trigger${menuOpen ? ' open' : ''}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(open => !open)}
            >
              <span className="account-name">{displayName}</span>
              <span className="account-chevron" aria-hidden="true">⌄</span>
            </button>
            {menuOpen && (
              <div className="account-dropdown" role="menu">
                <div className="account-dropdown-header">
                  <strong>{displayName}</strong>
                  {!user.isAnonymous && <small>{user.email || 'Signed-in account'}</small>}
                </div>
                <Link
                  role="menuitem"
                  className={location.pathname === '/settings' ? 'account-menu-item active' : 'account-menu-item'}
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                >
                  <span>Settings</span>
                </Link>
                <button type="button" role="menuitem" className="account-menu-item" onClick={handleSignOut}>
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
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
  const [claims, setClaims] = useState({});

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setUser(nextUser);
    if (!nextUser) {
      setProfile(null);
      setClaims({});
      return;
    }

    try {
      const tokenResult = await getIdTokenResult(nextUser, true);
      setClaims(tokenResult.claims || {});

      const ref = doc(db, 'users', nextUser.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setProfile(snap.data());
      } else if (!nextUser.isAnonymous) {
        const newProfile = {
          email: nextUser.email || '',
          displayName: nextUser.displayName || '',
          createdAt: serverTimestamp(),
        };
        await setDoc(ref, newProfile);
        setProfile(newProfile);
      } else {
        setProfile({ role: 'guest' });
      }
    } catch (error) {
      console.error('Profile error:', error);
      setClaims({});
      setProfile(nextUser.isAnonymous ? { role: 'guest' } : null);
    }
  }), []);

  if (user === undefined) return <Loading />;

  const admin = isAdminAccount(user, claims, profile);

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <Auth />} />
      <Route path="/" element={
        <Protected user={user}>
          <Layout user={user} profile={profile} isAdmin={admin}><VideoGallery user={user} /></Layout>
        </Protected>
      } />
      <Route path="/admin" element={
        <Protected user={user}>
          {admin
            ? <Layout user={user} profile={profile} isAdmin={admin}><AdminPanel /></Layout>
            : <Navigate to="/" replace />}
        </Protected>
      } />
      <Route path="/settings" element={
        <Protected user={user}>
          <Layout user={user} profile={profile} isAdmin={admin}><Settings user={user} profile={profile} isAdmin={admin} /></Layout>
        </Protected>
      } />
      <Route path="*" element={<Navigate to={user ? '/' : '/auth'} replace />} />
    </Routes>
  );
}