import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

const links = [
  { to: '/',          label: 'Dashboard',    icon: 'dashboard' },
  { to: '/markets',   label: 'Markets',      icon: 'show_chart' },
  { to: '/portfolio', label: 'Portfolio',    icon: 'account_balance_wallet' },
  { to: '/orders',    label: 'Orders',       icon: 'reorder' },
  { to: '/watchlist', label: 'Watchlist',    icon: 'star' },
  { to: '/algo',      label: 'Algo Trading', icon: 'smart_toy' },
  { to: '/settings',  label: 'Settings',     icon: 'settings' },
];

export function Sidebar({ mobile, onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside
      style={{
        width: 256,
        background: '#0b0e11',
        height: '100vh',
        position: mobile ? 'relative' : 'fixed',
        top: 0,
        left: 0,
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 24,
        paddingBottom: 24,
        zIndex: 40,
        borderRight: '1px solid rgba(65,71,85,0.15)',
      }}
    >
      {/* Brand */}
      <div style={{ padding: '0 24px', marginBottom: 24 }}>
        <h1
          className="font-headline"
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: '#adc6ff',
            letterSpacing: '-0.04em',
          }}
        >
          TradingEra
        </h1>
        <p style={{ fontSize: 10, color: '#8b90a0', marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Paper Trading
        </p>
      </div>

      {/* User badge */}
      <div style={{ padding: '0 16px', marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            background: '#1d2023',
            borderRadius: 10,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #adc6ff, #4b8eff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              color: '#002e69',
              flexShrink: 0,
            }}
          >
            {(user?.name || 'U')[0].toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p
              className="font-headline"
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: '#adc6ff',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {user?.name || 'Trader'}
            </p>
            <p style={{ fontSize: 9, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Paper Account
            </p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 0' }}>
        {links.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => onNavigate?.()}
          >
            {({ isActive }) => (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '11px 24px',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  color: isActive ? '#adc6ff' : '#8b90a0',
                  background: isActive ? '#1d2023' : 'transparent',
                  borderLeft: isActive ? '3px solid #adc6ff' : '3px solid transparent',
                  borderRadius: isActive ? '0 8px 8px 0' : 0,
                }}
                className="font-headline"
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 18,
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {icon}
                </span>
                {label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom actions */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button
          type="button"
          style={{
            width: '100%',
            padding: '10px 0',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #adc6ff, #4b8eff)',
            color: '#002e69',
            fontWeight: 700,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            border: 'none',
            cursor: 'pointer',
            marginBottom: 8,
          }}
          className="font-headline"
        >
          Go Live
        </button>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login');
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 8px',
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#8b90a0',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            borderRadius: 6,
            transition: 'color 0.15s',
          }}
          className="font-headline hover:text-red-400"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
