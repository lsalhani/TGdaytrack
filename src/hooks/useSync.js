import { useEffect, useState, useCallback } from 'react';
import { reconcile } from '../sync';
import { supabase } from '../supabase';

// useSync — orchestrates cloud sync for the logged-in session.
//
// Returns { status, syncNow } where status is one of:
//   'idle'     not logged in / nothing to do
//   'syncing'  a reconcile is in progress
//   'synced'   last reconcile succeeded
//   'offline'  last attempt failed (likely no connection) — will retry
//
// It runs a reconcile automatically:
//   - when a session becomes available (login / app open while logged in)
//   - when the browser fires 'online' after being offline
export function useSync(session) {
  const [status, setStatus] = useState('idle');

  const syncNow = useCallback(async () => {
    // Only sync with an active session.
    const { data } = await supabase.auth.getUser();
    if (!data?.user) { setStatus('idle'); return; }

    setStatus('syncing');
    const res = await reconcile();
    setStatus(res.ok ? 'synced' : 'offline');
  }, []);

  // Run when the session appears/changes.
  useEffect(() => {
    if (session) syncNow();
    else setStatus('idle');
  }, [session, syncNow]);

  // Re-sync when the connection comes back.
  useEffect(() => {
    const onOnline = () => { if (session) syncNow(); };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [session, syncNow]);

  return { status, syncNow };
}
