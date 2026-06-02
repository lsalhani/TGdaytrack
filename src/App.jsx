import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { seedHabits } from './db';
import BottomNav from './components/BottomNav';
import LogScreen from './screens/LogScreen';
import StatsScreen from './screens/StatsScreen';
import InsightsScreen from './screens/InsightsScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';

export default function App() {
  // Seed default habits once on first launch.
  useEffect(() => { seedHabits(); }, []);

  return (
    <BrowserRouter>
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
