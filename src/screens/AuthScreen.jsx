import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

// AuthScreen — shown when nobody is logged in. One form that toggles between
// "Log in" and "Sign up" modes. On signup (with email confirmation on) it tells
// the user to check their inbox rather than logging them straight in.
export default function AuthScreen() {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async () => {
    setError(''); setInfo('');
    if (!email || !password) { setError('Email and password are both required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }

    setBusy(true);
    if (mode === 'signup') {
      const { data, error } = await signUp(email, password);
      setBusy(false);
      if (error) { setError(error.message); return; }
      // If confirmation is on, there's a user but no active session yet.
      if (data?.user && !data.session) {
        setInfo('Check your email for a confirmation link, then come back and log in.');
        setMode('login');
      }
    } else {
      const { error } = await signIn(email, password);
      setBusy(false);
      if (error) {
        // Friendlier message for the most common case.
        setError(
          error.message.includes('Email not confirmed')
            ? 'Please confirm your email first — check your inbox for the link.'
            : error.message
        );
      }
      // On success, the auth listener flips the app to the logged-in view.
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">WE</div>
        <h1 className="auth-title">DayTrack</h1>
        <p className="auth-sub">
          {mode === 'login' ? 'Log in to sync your days.' : 'Create an account to get started.'}
        </p>

        {error && <div className="auth-error">{error}</div>}
        {info && <div className="auth-info">{info}</div>}

        <input
          className="auth-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value.trim())}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        <input
          className="auth-input"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />

        <button className="save auth-submit" onClick={submit} disabled={busy}>
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>

        <p className="auth-toggle">
          {mode === 'login' ? "No account yet? " : 'Already have an account? '}
          <button
            className="link"
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setInfo(''); }}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  );
}
