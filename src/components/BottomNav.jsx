import { NavLink } from 'react-router-dom';

// BottomNav — fixed four-tab bar. NavLink automatically adds the
// "active" class to whichever route matches the current URL.
const TABS = [
  { to: '/log',      ico: '✎',  label: 'Log' },
  { to: '/stats',    ico: '📊', label: 'Stats' },
  { to: '/insights', ico: '💡', label: 'Insights' },
  { to: '/history',  ico: '📅', label: 'History' }
];

export default function BottomNav() {
  return (
    <nav className="bottom">
      {TABS.map(({ to, ico, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
        >
          <span className="ico">{ico}</span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
