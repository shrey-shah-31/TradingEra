import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../services/api.js';
import { useTrading } from '../context/TradingContext.jsx';
import { cn } from '../utils/helpers.js';

export default function Watchlist() {
  const [list, setList] = useState([]);
  const [sym, setSym] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showDrop, setShowDrop] = useState(false);
  const [selected, setSelected] = useState(null);
  const [loadingSug, setLoadingSug] = useState(false);
  const { liveTickers, indianTickers } = useTrading();
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const debounceRef = useRef(null);

  async function load() {
    try {
      const { data } = await api.get('/api/user/watchlist');
      setList(data.watchlist || []);
    } catch { setList([]); }
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < 1) { setSuggestions([]); setShowDrop(false); return; }
    setLoadingSug(true);
    try {
      const { data } = await api.get('/api/market/search', { params: { q, scope: 'all' } });
      const stocks = (data.stocks || []).map((s) => ({ symbol: s.symbol, name: s.name || s.symbol, kind: 'STOCK' }));
      const crypto = (data.crypto || []).map((s) => ({ symbol: typeof s === 'string' ? s : s.symbol, name: typeof s === 'string' ? s : (s.symbol || s), kind: 'CRYPTO' }));
      setSuggestions([...stocks, ...crypto].slice(0, 12));
      setShowDrop(true);
    } catch { setSuggestions([]); }
    finally { setLoadingSug(false); }
  }, []);

  function handleInput(e) {
    const val = e.target.value.toUpperCase();
    setSym(val);
    setSelected(null);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 200);
  }

  function pickSuggestion(item) {
    setSym(item.symbol);
    setSelected(item);
    setSuggestions([]);
    setShowDrop(false);
  }

  const cryptoPriceMap = new Map((liveTickers || []).map((t) => [t.symbol.replace('USDT', ''), +t.lastPrice]));
  const indianPriceMap = new Map((indianTickers || []).map((t) => [t.symbol, t.price]));

  function getPrice(symbol) {
    if (indianPriceMap.has(symbol)) return { price: +indianPriceMap.get(symbol), currency: '₹' };
    const base = symbol.replace('.NS', '').replace('USDT', '');
    if (cryptoPriceMap.has(base)) return { price: cryptoPriceMap.get(base), currency: '₹' };
    return null;
  }

  function getChange(symbol) {
    const t = (indianTickers || []).find((x) => x.symbol === symbol);
    if (t) return +t.changePct;
    const base = symbol.replace('USDT', '');
    const ct = (liveTickers || []).find((x) => x.symbol.replace('USDT', '') === base);
    if (ct) return +ct.priceChangePercent;
    return null;
  }

  async function add(e) {
    e.preventDefault();
    const s = sym.trim();
    if (!s) return;
    try {
      await api.post('/api/user/watchlist', { symbol: s });
      toast.success(`${s} added to watchlist`);
      setSym(''); setSelected(null); setSuggestions([]);
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add'); }
  }

  async function remove(s) {
    try {
      await api.delete(`/api/user/watchlist/${s}`);
      toast.success('Removed from watchlist');
      load();
    } catch { toast.error('Remove failed'); }
  }

  // Pinned top 3 for bento display
  const pinned = list.slice(0, 3);
  const secondary = list.slice(3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="font-headline" style={{ fontSize: 28, fontWeight: 900, color: '#e1e2e7', letterSpacing: '-0.03em', marginBottom: 4 }}>
            Watchlist
          </h1>
          <p style={{ fontSize: 13, color: '#8b90a0' }}>Real-time market intelligence &amp; high-priority assets.</p>
        </div>
        {/* Add form */}
        <form onSubmit={add} ref={wrapRef} style={{ position: 'relative', display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#8b90a0', pointerEvents: 'none' }}>search</span>
            <input
              value={sym}
              onChange={handleInput}
              onFocus={() => suggestions.length > 0 && setShowDrop(true)}
              placeholder="Search ticker or name…"
              autoComplete="off"
              style={{ background: '#1d2023', border: '1px solid rgba(65,71,85,0.3)', borderRadius: 8, padding: '9px 12px 9px 34px', fontSize: 13, color: '#e1e2e7', outline: 'none', width: 260 }}
            />
            {loadingSug && (
              <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }}>
                <div style={{ width: 12, height: 12, border: '2px solid rgba(173,198,255,0.3)', borderTopColor: '#adc6ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            )}
            <AnimatePresence>
              {showDrop && suggestions.length > 0 && (
                <motion.ul
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#1d2023', border: '1px solid rgba(65,71,85,0.4)', borderRadius: 10, overflow: 'hidden', zIndex: 100, listStyle: 'none', padding: '4px 0', margin: 0, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}
                >
                  {suggestions.map((item) => {
                    const alreadyAdded = list.includes(item.symbol);
                    return (
                      <li key={`${item.kind}-${item.symbol}`}>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); pickSuggestion(item); }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#e1e2e7', fontSize: 13, opacity: alreadyAdded ? 0.5 : 1 }}
                          className="hover:bg-white/5"
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontFamily: 'monospace', color: '#adc6ff', fontSize: 12, fontWeight: 600 }}>{item.symbol.replace('.NS', '')}</span>
                            <span style={{ color: '#8b90a0', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                          </div>
                          <span style={{
                            fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
                            background: item.kind === 'STOCK' ? 'rgba(63,227,151,0.1)' : 'rgba(173,198,255,0.1)',
                            color: item.kind === 'STOCK' ? '#3fe397' : '#adc6ff',
                            border: item.kind === 'STOCK' ? '1px solid rgba(63,227,151,0.2)' : '1px solid rgba(173,198,255,0.2)',
                          }}>
                            {item.kind === 'STOCK' ? 'NSE' : 'CRYPTO'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
          <button
            type="submit"
            disabled={!sym.trim()}
            style={{
              padding: '9px 18px', borderRadius: 8,
              background: 'linear-gradient(135deg, #adc6ff, #4b8eff)',
              border: 'none', color: '#002e69', fontWeight: 700, fontSize: 12,
              cursor: sym.trim() ? 'pointer' : 'not-allowed',
              opacity: sym.trim() ? 1 : 0.4,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
            className="font-headline"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            Add Asset
          </button>
        </form>
      </div>

      {/* Pinned bento cards */}
      {pinned.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {pinned.map((s) => {
            const p = getPrice(s);
            const chg = getChange(s);
            const isStock = s.endsWith('.NS');
            const positive = chg != null ? chg >= 0 : null;
            return (
              <motion.div
                key={s}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ background: '#1d2023', borderRadius: 14, padding: 20, position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                onClick={() => navigate(`/?symbol=${encodeURIComponent(s)}&assetClass=${isStock ? 'STOCK' : 'CRYPTO'}`)}
              >
                <div style={{ position: 'absolute', top: 0, right: 0, padding: 14, opacity: 0.12 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 48, color: positive === true ? '#3fe397' : positive === false ? '#ffb3b5' : '#adc6ff' }}>
                    {isStock ? 'show_chart' : 'currency_bitcoin'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 10, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                      {isStock ? 'NSE Stock' : 'Crypto'}
                    </span>
                    <div className="font-headline" style={{ fontSize: 18, fontWeight: 900, color: '#e1e2e7', letterSpacing: '-0.02em', marginTop: 2 }}>
                      {s.replace('.NS', '')}
                    </div>
                  </div>
                  {chg != null && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 6,
                      background: positive ? 'rgba(63,227,151,0.1)' : 'rgba(255,179,181,0.1)',
                      color: positive ? '#3fe397' : '#ffb3b5',
                    }}>
                      {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                    </span>
                  )}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div className="font-headline" style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: '#e1e2e7' }}>
                    {p ? `${p.currency}${p.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                  </div>
                </div>
                {/* Mini sparkline bars */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 32 }}>
                  {[0.5, 0.75, 0.6, 1, 0.85, 0.65].map((h, i) => (
                    <div key={i} style={{
                      flex: 1, borderRadius: '2px 2px 0 0',
                      height: `${h * 100}%`,
                      background: positive === false ? 'rgba(255,179,181,0.15)' : 'rgba(63,227,151,0.15)',
                      borderTop: `2px solid ${positive === false ? 'rgba(255,179,181,0.5)' : 'rgba(63,227,151,0.5)'}`,
                    }} />
                  ))}
                </div>
                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(s); }}
                  style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: '#8b90a0', cursor: 'pointer', padding: 4, borderRadius: 6, opacity: 0, transition: 'opacity 0.15s' }}
                  className="group-hover:opacity-100"
                  aria-label={`Remove ${s}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Secondary list */}
      {secondary.length > 0 && (
        <div style={{ background: '#191c1f', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(65,71,85,0.1)' }}>
          <div style={{ padding: '12px 20px', background: 'rgba(39,42,46,0.5)', borderBottom: '1px solid rgba(65,71,85,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="font-headline" style={{ fontSize: 11, fontWeight: 700, color: '#e1e2e7', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Secondary Market
            </h3>
            <span style={{ fontSize: 11, color: '#8b90a0' }}>Sorted by: Added</span>
          </div>
          {secondary.map((s) => {
            const p = getPrice(s);
            const chg = getChange(s);
            const isStock = s.endsWith('.NS');
            const positive = chg != null ? chg >= 0 : null;
            return (
              <motion.div
                key={s}
                layout
                style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid rgba(65,71,85,0.08)', cursor: 'pointer', transition: 'background 0.1s' }}
                className="hover:bg-surface-container-highest"
                onClick={() => navigate(`/?symbol=${encodeURIComponent(s)}&assetClass=${isStock ? 'STOCK' : 'CRYPTO'}`)}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1d2023', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 14, flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: positive === false ? '#ffb3b5' : '#3fe397' }}>
                    {isStock ? 'show_chart' : 'currency_bitcoin'}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="font-headline" style={{ fontWeight: 700, color: '#e1e2e7', fontSize: 14 }}>{s.replace('.NS', '')}</div>
                  <div style={{ fontSize: 11, color: '#8b90a0' }}>{isStock ? 'NSE · Indian Stock' : 'Crypto · Binance'}</div>
                </div>
                {/* Mini sparkline */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 20, marginRight: 20 }}>
                  {[0.4, 0.6, 0.5, 0.8, 0.7].map((h, i) => (
                    <div key={i} style={{ width: 4, height: `${h * 100}%`, borderRadius: 2, background: positive === false ? 'rgba(255,179,181,0.4)' : 'rgba(63,227,151,0.4)' }} />
                  ))}
                </div>
                <div style={{ textAlign: 'right', marginRight: 16 }}>
                  <div className="font-headline" style={{ fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: '#e1e2e7' }}>
                    {p ? `${p.currency}${p.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                  </div>
                  {chg != null && (
                    <div style={{ fontSize: 12, color: positive ? '#3fe397' : '#ffb3b5', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(s); }}
                  style={{ padding: 6, borderRadius: 8, background: 'none', border: 'none', color: '#8b90a0', cursor: 'pointer', transition: 'color 0.15s' }}
                  className="hover:text-red-400"
                  aria-label={`Remove ${s}`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {list.length === 0 && (
        <div style={{ background: '#1d2023', borderRadius: 12, padding: '48px 24px', textAlign: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#323538', display: 'block', marginBottom: 12 }}>star</span>
          <p style={{ color: '#8b90a0', fontSize: 14 }}>Your watchlist is empty. Search above to add stocks or crypto.</p>
        </div>
      )}

      {/* Market sentiment strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        {[
          { label: 'Market Mood', value: 'Extreme Greed', color: '#3fe397', bar: '#3fe397' },
          { label: 'BTC Dominance', value: '52.8%', color: '#e1e2e7', bar: '#adc6ff' },
          { label: 'Gas Price', value: '24 Gwei', color: '#e1e2e7', bar: '#8b90a0' },
          { label: 'Liquidations', value: '$124.5M', color: '#ffb3b5', bar: '#ffb3b5' },
        ].map(({ label, value, color, bar }) => (
          <div key={label} style={{ background: '#0b0e11', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 3, height: 40, background: bar, borderRadius: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8b90a0', marginBottom: 4 }}>{label}</div>
              <div className="font-headline" style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
