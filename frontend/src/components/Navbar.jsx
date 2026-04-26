import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth.js';
import { api } from '../services/api.js';
import { useCurrency, CURRENCY_META, SUPPORTED_CURRENCIES } from '../context/CurrencyContext.jsx';
import { cn } from '../utils/helpers.js';

export function Navbar({ onMenu }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currency, setCurrency, convert, fmt } = useCurrency();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const currencyRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (currencyRef.current && !currencyRef.current.contains(e.target)) {
        setCurrencyOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function onSearch(v) {
    setQ(v);
    if (v.length < 2) { setResults([]); return; }
    try {
      const { data } = await api.get('/api/market/search', { params: { q: v, scope: 'all' } });
      const merged = [
        ...(data.crypto || []).map((x) => ({ ...x, kind: 'CRYPTO' })),
        ...(data.stocks || []).map((x) => ({ ...x, kind: 'STOCK' })),
      ];
      setResults(merged);
      setOpen(true);
    } catch {
      setResults([]);
    }
  }

  const balanceConverted = user?.balance != null ? convert(user.balance) : null;
  const balanceFmt =
    balanceConverted != null
      ? new Intl.NumberFormat(CURRENCY_META[currency]?.locale, {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }).format(balanceConverted)
      : '—';

  return (
    <header
      style={{
        background: '#111417',
        borderBottom: '1px solid rgba(65,71,85,0.2)',
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        gap: 16,
      }}
    >
      {/* Mobile menu button */}
      <button
        type="button"
        className="lg:hidden"
        onClick={onMenu}
        style={{
          background: 'none',
          border: 'none',
          color: '#8b90a0',
          cursor: 'pointer',
          padding: 8,
          borderRadius: 8,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>menu</span>
      </button>

      {/* Search */}
      <div style={{ position: 'relative', flex: 1, maxWidth: 380 }}>
        <span
          className="material-symbols-outlined"
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 18,
            color: '#8b90a0',
            pointerEvents: 'none',
          }}
        >
          search
        </span>
        <input
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => q.length >= 2 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search markets, assets or symbols..."
          style={{
            width: '100%',
            background: '#191c1f',
            border: 'none',
            borderRadius: 8,
            padding: '9px 12px 9px 40px',
            fontSize: 13,
            color: '#e1e2e7',
            outline: 'none',
          }}
        />
        <AnimatePresence>
          {open && results.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: '#1d2023',
                border: '1px solid rgba(65,71,85,0.4)',
                borderRadius: 10,
                overflow: 'hidden',
                maxHeight: 220,
                overflowY: 'auto',
                zIndex: 100,
                listStyle: 'none',
                padding: 0,
                margin: 0,
              }}
            >
              {results.map((row) => (
                <li key={`${row.kind}-${row.symbol}`}>
                  <button
                    type="button"
                    style={{
                      width: '100%',
                      padding: '9px 14px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      color: '#e1e2e7',
                      fontSize: 13,
                    }}
                    className="hover:bg-white/5"
                    onMouseDown={() => {
                      if (row.kind === 'STOCK') {
                        navigate(`/?symbol=${encodeURIComponent(row.symbol)}&assetClass=STOCK`);
                      } else {
                        navigate(`/?symbol=${row.symbol}&assetClass=CRYPTO`);
                      }
                      setOpen(false);
                      setQ('');
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', color: '#adc6ff' }}>{row.symbol}</span>
                    <span style={{ fontSize: 11, color: '#8b90a0' }}>
                      {row.kind === 'STOCK' ? 'NSE ₹' : 'Crypto'}
                    </span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
        {/* Notification icons */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['notifications', 'help'].map((icon) => (
            <button
              key={icon}
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: '#8b90a0',
                cursor: 'pointer',
                padding: 8,
                borderRadius: 8,
                transition: 'all 0.15s',
              }}
              className="hover:bg-surface-container-highest hover:text-white"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{icon}</span>
            </button>
          ))}
        </div>

        {/* Currency selector */}
        <div ref={currencyRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setCurrencyOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              border: currencyOpen
                ? '1px solid rgba(173,198,255,0.4)'
                : '1px solid rgba(65,71,85,0.4)',
              background: currencyOpen ? 'rgba(173,198,255,0.1)' : '#1d2023',
              color: currencyOpen ? '#adc6ff' : '#c1c6d7',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>language</span>
            <span style={{ fontFamily: 'monospace' }}>{currency}</span>
            <span>{CURRENCY_META[currency]?.flag}</span>
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 14,
                transition: 'transform 0.2s',
                transform: currencyOpen ? 'rotate(180deg)' : 'none',
              }}
            >
              expand_more
            </span>
          </button>

          <AnimatePresence>
            {currencyOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: 6,
                  width: 200,
                  background: '#1d2023',
                  border: '1px solid rgba(65,71,85,0.4)',
                  borderRadius: 12,
                  overflow: 'hidden',
                  zIndex: 100,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                }}
              >
                <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(65,71,85,0.2)' }}>
                  <p style={{ fontSize: 10, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Display Currency
                  </p>
                </div>
                <ul style={{ listStyle: 'none', padding: '4px 0', maxHeight: 280, overflowY: 'auto', margin: 0 }}>
                  {SUPPORTED_CURRENCIES.map((code) => {
                    const meta = CURRENCY_META[code];
                    const isActive = currency === code;
                    return (
                      <li key={code}>
                        <button
                          type="button"
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 12px',
                            background: isActive ? 'rgba(173,198,255,0.1)' : 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: isActive ? '#adc6ff' : '#e1e2e7',
                            fontSize: 13,
                            transition: 'background 0.1s',
                          }}
                          className="hover:bg-white/5"
                          onClick={() => { setCurrency(code); setCurrencyOpen(false); }}
                        >
                          <span style={{ fontSize: 16 }}>{meta.flag}</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, width: 32 }}>{code}</span>
                          <span style={{ color: '#8b90a0', fontSize: 11, flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {meta.name}
                          </span>
                          {isActive && (
                            <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#adc6ff' }}>check</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Deposit button */}
        <button
          type="button"
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: '#323538',
            border: '1px solid rgba(65,71,85,0.3)',
            color: '#e1e2e7',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          className="hover:bg-surface-bright"
        >
          Deposit
        </button>

        {/* Execute Trade CTA */}
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: 'linear-gradient(135deg, #adc6ff, #4b8eff)',
            border: 'none',
            color: '#002e69',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          className="font-headline"
        >
          Execute Trade
        </button>

        {/* Balance */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
          <span style={{ fontSize: 10, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Balance</span>
          <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#3fe397' }}>
            {balanceFmt}
          </span>
        </div>
      </div>
    </header>
  );
}
