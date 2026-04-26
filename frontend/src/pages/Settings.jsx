import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../services/api.js';
import { useAuth } from '../hooks/useAuth.js';

function Section({ title, icon, children }) {
  return (
    <div style={{ background: '#1d2023', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(65,71,85,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#adc6ff' }}>{icon}</span>
        <h2 className="font-headline" style={{ fontSize: 12, fontWeight: 700, color: '#c1c6d7', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {title}
        </h2>
      </div>
      <div style={{ padding: '20px' }}>
        {children}
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: '#191c1f',
  border: 'none',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  color: '#e1e2e7',
  outline: 'none',
  fontFamily: 'monospace',
  boxSizing: 'border-box',
  marginTop: 6,
};

export default function Settings() {
  const { user, refreshUser, setUser } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [sym, setSym] = useState('BTC');
  const [target, setTarget] = useState('');
  const [above, setAbove] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/api/user/alerts');
        setAlerts(data.alerts || []);
      } catch { setAlerts([]); }
    })();
  }, []);

  async function toggleTheme() {
    const next = document.documentElement.classList.contains('light') ? 'dark' : 'light';
    document.documentElement.classList.toggle('light', next === 'light');
    try {
      await api.patch('/api/user/theme', { theme: next });
      setUser((u) => (u ? { ...u, theme: next } : u));
      toast.success(`Theme: ${next}`);
    } catch { toast.error('Could not sync theme'); }
  }

  async function addAlert(e) {
    e.preventDefault();
    try {
      const { data } = await api.post('/api/user/alerts', { symbol: sym, above, targetPrice: Number(target) });
      setAlerts(data.alerts);
      setTarget('');
      toast.success('Alert created');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  }

  async function removeAlert(id) {
    try {
      const { data } = await api.delete(`/api/user/alerts/${id}`);
      setAlerts(data.alerts);
    } catch { toast.error('Remove failed'); }
  }

  function enableNotifications() {
    if (!('Notification' in window)) { toast.error('Notifications not supported'); return; }
    Notification.requestPermission().then((p) => { toast.message(`Notifications: ${p}`); });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600 }}>
      <div>
        <h1 className="font-headline" style={{ fontSize: 28, fontWeight: 900, color: '#e1e2e7', letterSpacing: '-0.03em', marginBottom: 4 }}>
          Settings
        </h1>
        <p style={{ fontSize: 13, color: '#8b90a0' }}>Manage your account preferences and alerts.</p>
      </div>

      {/* Appearance */}
      <Section title="Appearance" icon="palette">
        <p style={{ fontSize: 13, color: '#8b90a0', marginBottom: 14 }}>Toggle dark / light surfaces.</p>
        <button
          type="button"
          onClick={toggleTheme}
          style={{
            padding: '10px 20px', borderRadius: 8,
            background: '#323538', border: 'none',
            color: '#c1c6d7', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'background 0.15s',
          }}
          className="hover:bg-surface-bright"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {document.documentElement.classList.contains('light') ? 'dark_mode' : 'light_mode'}
          </span>
          Switch to {document.documentElement.classList.contains('light') ? 'dark' : 'light'} mode
        </button>
        <p style={{ fontSize: 11, color: '#8b90a0', marginTop: 10 }}>
          Saved preference: <span style={{ color: '#adc6ff' }}>{user?.theme || 'dark'}</span>
        </p>
      </Section>

      {/* Notifications */}
      <Section title="Browser Notifications" icon="notifications">
        <p style={{ fontSize: 13, color: '#8b90a0', marginBottom: 14 }}>Enable price alerts in your browser.</p>
        <button
          type="button"
          onClick={enableNotifications}
          style={{
            padding: '10px 20px', borderRadius: 8,
            background: 'rgba(173,198,255,0.1)', border: '1px solid rgba(173,198,255,0.25)',
            color: '#adc6ff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>notifications_active</span>
          Enable alerts in browser
        </button>
      </Section>

      {/* Price alerts */}
      <Section title="Price Alerts" icon="price_change">
        <form onSubmit={addAlert} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 10, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Symbol</label>
            <input value={sym} onChange={(e) => setSym(e.target.value.toUpperCase())} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Target (INR)</label>
            <input required value={target} onChange={(e) => setTarget(e.target.value)} style={inputStyle} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#c1c6d7', gridColumn: '1/-1', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={above}
              onChange={(e) => setAbove(e.target.checked)}
              style={{ accentColor: '#adc6ff', width: 16, height: 16 }}
            />
            Fire when price is at or above target (uncheck for below)
          </label>
          <button
            type="submit"
            style={{
              gridColumn: '1/-1', padding: '11px 0', borderRadius: 8,
              background: 'linear-gradient(135deg, #adc6ff, #4b8eff)',
              border: 'none', color: '#002e69', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
            className="font-headline"
          >
            Add Alert
          </button>
        </form>

        {alerts.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alerts.map((a) => (
              <li
                key={a._id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#191c1f', borderRadius: 8, padding: '10px 14px',
                  fontFamily: 'monospace', fontSize: 12,
                }}
              >
                <span style={{ color: '#c1c6d7' }}>
                  <span style={{ color: '#adc6ff', fontWeight: 700 }}>{a.symbol}</span>
                  {' '}{a.above ? '≥' : '≤'}{' '}
                  <span style={{ color: '#e1e2e7' }}>₹{a.targetPrice}</span>
                  {a.triggered && <span style={{ color: '#8b90a0', marginLeft: 8 }}>(triggered)</span>}
                </span>
                {!a.triggered && (
                  <button
                    type="button"
                    onClick={() => removeAlert(a._id)}
                    style={{ background: 'none', border: 'none', color: '#ffb3b5', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {alerts.length === 0 && (
          <p style={{ fontSize: 13, color: '#8b90a0' }}>No alerts set. Add one above.</p>
        )}
      </Section>

      <button
        type="button"
        style={{ fontSize: 12, color: '#8b90a0', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', alignSelf: 'flex-start' }}
        onClick={() => refreshUser()}
      >
        Refresh profile from server
      </button>
    </div>
  );
}
