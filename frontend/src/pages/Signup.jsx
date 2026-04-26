import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth.js';

export default function Signup() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setBusy(true);
    try {
      await register({ name, email, password });
      toast.success('Account created — ₹1,00,000 paper balance');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Signup failed');
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = {
    marginTop: 6,
    width: '100%',
    background: '#191c1f',
    border: 'none',
    borderRadius: 8,
    padding: '11px 14px',
    fontSize: 14,
    color: '#e1e2e7',
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div
      style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#111417',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient glows */}
      <div style={{
        position: 'absolute', top: '-20%', right: '-10%', width: '50%', height: '50%',
        background: 'rgba(173,198,255,0.05)', borderRadius: '50%', filter: 'blur(120px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', left: '-10%', width: '40%', height: '40%',
        background: 'rgba(63,227,151,0.04)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#1d2023',
          borderRadius: 16,
          padding: 36,
          border: '1px solid rgba(65,71,85,0.3)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div style={{ marginBottom: 28 }}>
          <h1
            className="font-headline"
            style={{ fontSize: 26, fontWeight: 900, color: '#adc6ff', letterSpacing: '-0.04em', marginBottom: 4 }}
          >
            Join TradingEra
          </h1>
          <p style={{ fontSize: 13, color: '#8b90a0' }}>
            Paper trade with live crypto &amp; NSE markets.
          </p>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'Name', type: 'text', value: name, setter: setName },
            { label: 'Email', type: 'email', value: email, setter: setEmail },
            { label: 'Password (min 8)', type: 'password', value: password, setter: setPassword },
          ].map(({ label, type, value, setter }) => (
            <div key={label}>
              <label style={{ fontSize: 10, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                {label}
              </label>
              <input
                type={type}
                required
                value={value}
                onChange={(e) => setter(e.target.value)}
                style={inputStyle}
                onFocus={(e) => e.target.style.boxShadow = '0 0 0 1px rgba(173,198,255,0.4)'}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={busy}
            style={{
              marginTop: 4,
              padding: '13px 0',
              borderRadius: 8,
              background: busy ? 'rgba(63,227,151,0.1)' : 'linear-gradient(135deg, #3fe397, #00c77e)',
              border: 'none',
              color: busy ? '#8b90a0' : '#002111',
              fontSize: 13,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              cursor: busy ? 'wait' : 'pointer',
              transition: 'opacity 0.15s',
            }}
            className="font-headline"
          >
            {busy ? 'Creating…' : 'Create Account'}
          </button>
        </form>

        <p style={{ fontSize: 13, color: '#8b90a0', marginTop: 24, textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#adc6ff', textDecoration: 'none', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
