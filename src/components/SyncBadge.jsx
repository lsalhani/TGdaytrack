// SyncBadge — a small fixed cloud indicator showing sync status.
// Floats top-right, out of the way. Tapping it triggers a manual re-sync.
//
//   syncing -> spinning cloud, "Syncing…"
//   synced  -> green cloud (auto-hides after a moment)
//   offline -> grey cloud, "Offline"
//   idle    -> hidden
import { useEffect, useState } from 'react';

export default function SyncBadge({ status, onSync }) {
  const [hidden, setHidden] = useState(false);

  // Auto-fade the "synced" confirmation after a couple of seconds.
  useEffect(() => {
    if (status === 'synced') {
      setHidden(false);
      const t = setTimeout(() => setHidden(true), 2200);
      return () => clearTimeout(t);
    }
    setHidden(false);
  }, [status]);

  if (status === 'idle') return null;
  if (status === 'synced' && hidden) return null;

  const map = {
    syncing: { cls: 'sync-syncing', icon: '☁', label: 'Syncing…' },
    synced:  { cls: 'sync-ok',      icon: '☁', label: 'Synced' },
    offline: { cls: 'sync-off',     icon: '☁', label: 'Offline' }
  };
  const s = map[status] || map.offline;

  return (
    <button
      className={'sync-badge ' + s.cls}
      onClick={onSync}
      title="Tap to sync now"
      aria-label={'Sync status: ' + s.label}
    >
      <span className="sync-icon">{s.icon}</span>
      <span className="sync-label">{s.label}</span>
    </button>
  );
}
