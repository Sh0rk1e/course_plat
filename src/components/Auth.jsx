import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  auth, googleProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signInAnonymously,
} from '../firebase';

export default function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(action) {
    setError('');
    setBusy(true);
    try {
      await action();
      navigate('/');
    } catch (err) {
      const messages = {
        'auth/invalid-credential': 'Invalid email or password.',
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/weak-password': 'Password must be at least 6 characters.',
        'auth/popup-closed-by-user': 'The Google sign-in window was closed.',
        'auth/unauthorized-domain': 'Add this domain to Firebase Authentication → Authorized domains.',
      };
      setError(messages[err.code] || err.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card">
        <div className="eyebrow">LEARNING PLATFORM</div>
        <h1>Learn at your own pace.</h1>
        <p className="muted">Guests can preview the introduction. Create an account for all lessons.</p>

        <button className="button button-google" disabled={busy}
          onClick={() => run(() => signInWithPopup(auth, googleProvider))}>
          Continue with Google
        </button>

        <div className="divider"><span>or</span></div>

        <form onSubmit={(e) => {
          e.preventDefault();
          run(() => mode === 'signup'
            ? createUserWithEmailAndPassword(auth, email, password)
            : signInWithEmailAndPassword(auth, email, password));
        }}>
          <label>Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} minLength="6" required /></label>
          {error && <div className="error-box">{error}</div>}
          <button className="button button-primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
        </form>

        <button className="link-button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); }}>
          {mode === 'signin' ? 'Need an account? Create one' : 'Already have an account? Sign in'}
        </button>

        <div className="guest-section">
          <button className="button button-secondary" disabled={busy} onClick={() => run(() => signInAnonymously(auth))}>Continue as guest</button>
          <small>Guest access includes the introductory lesson only.</small>
        </div>
      </section>
    </div>
  );
}