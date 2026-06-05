import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { db } from '../db';

// useAuth — the single source of truth for "is someone logged in?".
// Watches Supabase auth state and re-renders the app on changes (login,
// logout, token refresh, email confirmation).
export function useAuth() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signUp = (email, password) =>
    supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin }
    });

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  // Sign out, then wipe the local database. This is important on shared/multiple
  // accounts: without it, the next user to log in on this device would see the
  // previous user's locally-cached entries merged into their data. Their real
  // data is safe in the cloud and re-pulled by reconcile on next login.
  const signOut = async () => {
    const res = await supabase.auth.signOut();
    try {
      await db.entries.clear();
      await db.habits_config.clear();
    } catch (e) {
      console.warn('local clear on logout failed:', e.message);
    }
    return res;
  };

  return {
    session,
    user: session?.user ?? null,
    loading,
    signUp,
    signIn,
    signOut
  };
}
