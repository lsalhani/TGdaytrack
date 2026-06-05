import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useSync } from './hooks/useSync';
import AuthScreen from './screens/AuthScreen';
import SyncBadge from './components/SyncBadge';
import BottomNav from './components/BottomNav';
import LogScreen from './screens/LogScreen';
import StatsScreen from './screens/StatsScreen';
import InsightsScreen from './screens/InsightsScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';

export default function App() {
  const { session, loading } = useAuth();
  // Sync runs whenever there's a session; it also seeds this user's habits in
  // the cloud and mirrors them down — so we no longer seed locally on startup.
  const { status, syncNow } = useSync(session);

  // 1. Still checking for an existing session — brief.
  if (loading) {
    return (
      <div className="auth-screen">
        <div className="auth-card"><p className="auth-sub">Loading…</p></div>
      </div>
    );
  }

  // 2. Not logged in — show the auth screen only.
  if (!session) {
    return <AuthScreen />;
  }

  // 3. Logged in — the app, plus the floating sync indicator.
  return (
    <BrowserRouter>
      <SyncBadge status={status} onSync={syncNow} />
      <Routes>
        <Route path="/" element={<Navigate to="/log" replace />} />
        <Route path="/log" element={<LogScreen />} />
        <Route path="/stats" element={<StatsScreen />} />
        <Route path="/insights" element={<InsightsScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Routes>
      <BottomNav />
    </BrowserRouter>
  );
}
