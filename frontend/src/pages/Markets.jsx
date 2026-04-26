import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { createChart, CandlestickSeries, HistogramSeries, ColorType } from 'lightweight-charts';
import { api } from '../services/api.js';
import { Skeleton } from '../components/Skeleton.jsx';
import { formatPct, cn } from '../utils/helpers.js';
import { useCurrency } from '../context/CurrencyContext.jsx';

/* ── Inline Chart Modal ──────────────────────────────────────────────────── */
const INTERVALS = ['1h', '4h', '1D', '1W'];

function ChartModal({ symbol, assetType, onClose }) {
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  const [interval, setInterval] = useState('1D');
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null); // { open, high, low, close, change }

  // Fetch candles whenever symbol or interval changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data } = await api.get('/api/market/history', {
          params: { symbol, interval, limit: 300, assetType },
        });
        if (!cancelled) setCandles(data.candles || []);
      } catch {
        if (!cancelled) setCandles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [symbol, interval, assetType]);

  // Build / update chart
  useEffect(() => {
    if (!containerRef.current || loading || candles.length === 0) return;

    const el = containerRef.current;
    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0e11' },
        textColor: '#8b90a0',
      },
      grid: {
        vertLines: { color: 'rgba(65,71,85,0.2)' },
        horzLines: { color: 'rgba(65,71,85,0.2)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(65,71,85,0.3)' },
      timeScale: { borderColor: 'rgba(65,71,85,0.3)', timeVisible: true },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#3fe397',
      downColor: '#ffb3b5',
      borderUpColor: '#3fe397',
      borderDownColor: '#ffb3b5',
      wickUpColor: '#3fe397',
      wickDownColor: '#ffb3b5',
    });

    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const mapped = candles.map(c => ({
      time: typeof c.time === 'number' && c.time > 1e10 ? Math.floor(c.time / 1000) : c.time,
      open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    const volMapped = candles.map(c => ({
      time: typeof c.time === 'number' && c.time > 1e10 ? Math.floor(c.time / 1000) : c.time,
      value: c.volume || 0,
      color: c.close >= c.open ? 'rgba(63,227,151,0.4)' : 'rgba(255,179,181,0.4)',
    }));

    candleSeries.setData(mapped);
    volSeries.setData(volMapped);
    chart.timeScale().fitContent();

    // Show OHLC on crosshair move
    chart.subscribeCrosshairMove(param => {
      if (!param.time) return;
      const d = param.seriesData.get(candleSeries);
      if (d) {
        const prev = mapped[mapped.findIndex(c => c.time === param.time) - 1];
        const chg = prev ? ((d.close - prev.close) / prev.close) * 100 : 0;
        setInfo({ open: d.open, high: d.high, low: d.low, close: d.close, change: chg });
      }
    });

    // Last candle info by default
    const last = mapped[mapped.length - 1];
    const prev = mapped[mapped.length - 2];
    if (last && prev) {
      setInfo({ open: last.open, high: last.high, low: last.low, close: last.close, change: ((last.close - prev.close) / prev.close) * 100 });
    }

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);

    chartRef.current = chart;
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, [candles, loading]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const positive = info ? info.change >= 0 : true;
  const displaySymbol = symbol.replace('.NS', '').replace('USDT', '');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.2 }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 900,
            background: '#111417',
            border: '1px solid rgba(65,71,85,0.4)',
            borderRadius: 16,
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 40px 80px rgba(0,0,0,0.7)',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid rgba(65,71,85,0.2)',
            background: '#1d2023',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'rgba(173,198,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#adc6ff',
              }}>
                {displaySymbol.slice(0, 4)}
              </div>
              <div>
                <div className="font-headline" style={{ fontSize: 16, fontWeight: 800, color: '#e1e2e7', letterSpacing: '-0.02em' }}>
                  {displaySymbol}
                  <span style={{ marginLeft: 8, fontSize: 10, color: '#8b90a0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {assetType === 'STOCK' ? 'NSE' : 'CRYPTO'}
                  </span>
                </div>
                {info && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 2, fontSize: 11, fontFamily: 'monospace' }}>
                    <span style={{ color: '#8b90a0' }}>O <span style={{ color: '#e1e2e7' }}>{info.open?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></span>
                    <span style={{ color: '#8b90a0' }}>H <span style={{ color: '#3fe397' }}>{info.high?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></span>
                    <span style={{ color: '#8b90a0' }}>L <span style={{ color: '#ffb3b5' }}>{info.low?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></span>
                    <span style={{ color: '#8b90a0' }}>C <span style={{ color: '#e1e2e7', fontWeight: 700 }}>{info.close?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></span>
                    <span style={{ color: positive ? '#3fe397' : '#ffb3b5', fontWeight: 700 }}>
                      {info.change >= 0 ? '+' : ''}{info.change?.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Interval selector */}
              <div style={{ display: 'flex', gap: 4 }}>
                {INTERVALS.map(iv => (
                  <button
                    key={iv}
                    type="button"
                    onClick={() => setInterval(iv)}
                    style={{
                      padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: interval === iv ? 'rgba(173,198,255,0.15)' : 'transparent',
                      border: interval === iv ? '1px solid rgba(173,198,255,0.35)' : '1px solid transparent',
                      color: interval === iv ? '#adc6ff' : '#8b90a0',
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}
                  >
                    {iv}
                  </button>
                ))}
              </div>

              {/* Open full chart */}
              <button
                type="button"
                onClick={() => { onClose(); window.location.href = `/?symbol=${encodeURIComponent(symbol)}&assetClass=${assetType}`; }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8,
                  background: 'linear-gradient(135deg, #adc6ff, #4b8eff)',
                  border: 'none', color: '#002e69', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}
                className="font-headline"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_full</span>
                Full Chart
              </button>

              {/* Close */}
              <button
                type="button"
                onClick={onClose}
                style={{ background: '#323538', border: 'none', color: '#c1c6d7', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
          </div>

          {/* Chart area */}
          <div style={{ height: 420, position: 'relative', background: '#0b0e11' }}>
            {loading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0e11', zIndex: 10 }}>
                <div style={{ width: 32, height: 32, border: '3px solid rgba(173,198,255,0.2)', borderTopColor: '#adc6ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            )}
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const fmtVol = (v) =>
  v == null || v === 0 ? '—' : v >= 1e7 ? `${(v / 1e7).toFixed(2)}Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(2)}L` : v.toLocaleString('en-IN');

const SORT_ICONS = { none: 'unfold_more', asc: 'arrow_upward', desc: 'arrow_downward' };

function SortTh({ col, label, sortKey, setSortKey, right }) {
  const active = sortKey.key === col;
  const dir = active ? sortKey.dir : 'none';
  return (
    <th
      onClick={() => setSortKey((s) => s.key === col ? { key: col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: col, dir: 'desc' })}
      style={{
        padding: '12px 16px',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        color: active ? '#adc6ff' : '#8b90a0',
        cursor: 'pointer',
        userSelect: 'none',
        textAlign: right ? 'right' : 'left',
        whiteSpace: 'nowrap',
        background: 'rgba(39,42,46,0.5)',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{SORT_ICONS[dir]}</span>
      </span>
    </th>
  );
}

export default function Markets() {
  const [tab, setTab] = useState('crypto');
  const [data, setData] = useState(null);
  const [indian, setIndian] = useState(null);
  const [allStocks, setAllStocks] = useState(null);
  const [allLoading, setAllLoading] = useState(false);
  const [allError, setAllError] = useState(null);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState([]);
  const [sortKey, setSortKey] = useState({ key: 'changePct', dir: 'desc' });
  const [filterText, setFilterText] = useState('');
  const [chartAsset, setChartAsset] = useState(null); // { symbol, assetType }
  const navigate = useNavigate();
  const { fmt } = useCurrency();

  useEffect(() => {
    (async () => {
      try { const { data: d } = await api.get('/api/market/movers'); setData(d); } catch { setData(null); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try { const { data: d } = await api.get('/api/market/indian-stocks'); setIndian(d); } catch { setIndian(null); }
    })();
  }, []);

  const loadAllStocks = async () => {
    setAllLoading(true); setAllError(null);
    try {
      const { data: d } = await api.get('/api/market/indian-stocks/all');
      if (!d || !Array.isArray(d.stocks)) throw new Error('Invalid response');
      setAllStocks(d);
    } catch (e) {
      setAllError(`Failed to load: ${e.message}`);
    } finally { setAllLoading(false); }
  };

  useEffect(() => {
    if (tab === 'stocks' && !allStocks && !allLoading) loadAllStocks();
  }, [tab]);

  useEffect(() => {
    let t;
    (async () => {
      if (q.length < 2) { setSearch([]); return; }
      clearTimeout(t);
      t = setTimeout(async () => {
        try {
          const scope = tab === 'stocks' ? 'stock' : tab === 'crypto' ? 'crypto' : 'all';
          const { data: d } = await api.get('/api/market/search', { params: { q, scope } });
          if (scope === 'all') {
            setSearch([...(d.crypto || []).map((x) => ({ ...x, kind: 'CRYPTO' })), ...(d.stocks || []).map((x) => ({ ...x, kind: 'STOCK' }))]);
          } else if (scope === 'stock') {
            setSearch((d.results || []).map((x) => ({ symbol: x.symbol, name: x.name, kind: 'STOCK' })));
          } else {
            setSearch((d.results || []).map((x) => ({ symbol: x, kind: 'CRYPTO' })));
          }
        } catch { setSearch([]); }
      }, 250);
    })();
    return () => clearTimeout(t);
  }, [q, tab]);

  const displayStocks = useMemo(() => {
    if (!allStocks?.stocks) return [];
    let list = allStocks.stocks;
    if (filterText.trim()) {
      const f = filterText.trim().toUpperCase();
      list = list.filter((s) => s.symbol.replace('.NS', '').includes(f) || (s.name || '').toUpperCase().includes(f) || (s.shortName || '').toUpperCase().includes(f));
    }
    const { key, dir } = sortKey;
    return [...list].sort((a, b) => {
      const av = a[key] ?? (dir === 'asc' ? Infinity : -Infinity);
      const bv = b[key] ?? (dir === 'asc' ? Infinity : -Infinity);
      if (typeof av === 'string') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return dir === 'asc' ? av - bv : bv - av;
    });
  }, [allStocks, filterText, sortKey]);

  const tabStyle = (id) => ({
    padding: '8px 18px',
    borderRadius: 8,
    border: tab === id ? '1px solid rgba(173,198,255,0.4)' : '1px solid rgba(65,71,85,0.3)',
    background: tab === id ? 'rgba(173,198,255,0.1)' : '#1d2023',
    color: tab === id ? '#adc6ff' : '#8b90a0',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    transition: 'all 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Chart modal */}
      {chartAsset && (
        <ChartModal
          symbol={chartAsset.symbol}
          assetType={chartAsset.assetType}
          onClose={() => setChartAsset(null)}
        />
      )}
      {/* Header */}
      <div>
        <h1 className="font-headline" style={{ fontSize: 28, fontWeight: 900, color: '#e1e2e7', letterSpacing: '-0.03em', marginBottom: 4 }}>
          MARKET OVERVIEW
        </h1>
        <p style={{ fontSize: 13, color: '#8b90a0' }}>
          Crypto via Binance · Indian equities via NSE / Yahoo Finance.
        </p>
      </div>

      {/* Market stats bento */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {[
          { label: 'Total Volume (24h)', value: '$142.9B', sub: '+12.4%', color: '#3fe397' },
          { label: 'Fear & Greed', value: '74 / 100', sub: 'Greed', color: '#adc6ff' },
          { label: 'BTC Dominance', value: '54.2%', sub: 'ETH 18.1%', color: '#e1e2e7' },
          { label: 'Active Tickers', value: '4,812', sub: '182 new today', color: '#e1e2e7' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#1d2023', borderRadius: 12, padding: '16px 18px' }}>
            <p style={{ fontSize: 10, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 6 }}>{s.label}</p>
            <p className="font-headline" style={{ fontSize: 20, fontWeight: 800, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
            <p style={{ fontSize: 11, color: '#8b90a0', marginTop: 2 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Tab bar + search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, background: '#191c1f', borderRadius: 12, padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['crypto', 'Crypto'], ['stocks', 'Indian Stocks'], ['all', 'Search Both']].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} style={tabStyle(id)} className="font-headline">
              {label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 360 }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#8b90a0', pointerEvents: 'none' }}>search</span>
          <input
            value={tab === 'stocks' ? filterText : q}
            onChange={(e) => tab === 'stocks' ? setFilterText(e.target.value) : setQ(e.target.value.toUpperCase())}
            placeholder={tab === 'stocks' ? 'Filter by name or ticker…' : 'BTC, ETH, RELIANCE…'}
            style={{ width: '100%', background: '#0b0e11', border: 'none', borderRadius: 8, padding: '8px 12px 8px 34px', fontSize: 13, color: '#e1e2e7', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {allStocks && tab === 'stocks' && (
          <span style={{ fontSize: 11, color: '#8b90a0' }}>
            {displayStocks.length} / {allStocks.total} stocks
          </span>
        )}
        <button
          type="button"
          onClick={loadAllStocks}
          disabled={allLoading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 8, background: '#323538', border: 'none', color: '#c1c6d7', fontSize: 12, cursor: 'pointer' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16, animation: allLoading ? 'spin 0.8s linear infinite' : 'none' }}>refresh</span>
          Refresh
        </button>
      </div>

      {/* Search results (non-stocks) */}
      {tab !== 'stocks' && search.length > 0 && (
        <div style={{ background: '#1d2023', borderRadius: 12, overflow: 'hidden' }}>
          {search.map((s) => (
            <div
              key={`${s.kind}-${s.symbol}`}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(65,71,85,0.15)' }}
              className="hover:bg-white/5"
            >
              <button
                type="button"
                onClick={() => s.kind === 'STOCK' ? navigate(`/?symbol=${encodeURIComponent(s.symbol)}&assetClass=STOCK`) : navigate(`/?symbol=${s.symbol}&assetClass=CRYPTO`)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e1e2e7', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}
              >
                <span style={{ fontFamily: 'monospace', color: '#adc6ff' }}>{s.symbol}</span>
                <span style={{ fontSize: 11, color: '#8b90a0' }}>{s.kind}</span>
              </button>
              <button
                type="button"
                title="View chart"
                onClick={() => setChartAsset({ symbol: s.symbol, assetType: s.kind })}
                style={{ background: 'rgba(65,71,85,0.3)', border: 'none', borderRadius: 6, padding: '5px 10px', color: '#c1c6d7', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>candlestick_chart</span>
                Chart
              </button>
            </div>
          ))}
        </div>
      )}

      {/* CRYPTO tab */}
      {tab === 'crypto' && (
        !data ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[0,1,2].map(i => <Skeleton key={i} style={{ height: 200, borderRadius: 12 }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { title: '🚀 Top Gainers', rows: data.gainers, positive: true },
              { title: '📉 Top Losers', rows: data.losers, positive: false },
              { title: '🔥 Trending Volume', rows: data.trending, positive: null },
            ].map(({ title, rows, positive }) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ background: '#1d2023', borderRadius: 12, padding: 18 }}
              >
                <h3 className="font-headline" style={{ fontSize: 12, fontWeight: 700, color: '#c1c6d7', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {title}
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {rows?.map((m) => (
                    <li key={m.symbol} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <button
                        type="button"
                        style={{ color: '#adc6ff', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace', padding: 0 }}
                        onClick={() => navigate(`/?symbol=${m.symbol.replace('USDT', '')}&assetClass=CRYPTO`)}
                      >
                        {m.symbol.replace('USDT', '')}
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: m.changePct >= 0 ? '#3fe397' : '#ffb3b5', fontFamily: 'monospace' }}>
                          {formatPct(m.changePct)}
                        </span>
                        <button
                          type="button"
                          title="View chart"
                          onClick={() => setChartAsset({ symbol: m.symbol.replace('USDT', ''), assetType: 'CRYPTO' })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b90a0', padding: 2, borderRadius: 4, display: 'flex', alignItems: 'center', transition: 'color 0.12s' }}
                          className="hover:text-primary"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>candlestick_chart</span>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* STOCKS tab */}
      {tab === 'stocks' && (
        <div>
          {allError && (
            <div style={{ color: '#ffb3b5', background: 'rgba(255,179,181,0.08)', border: '1px solid rgba(255,179,181,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 13, marginBottom: 12 }}>
              {allError}{' '}
              <button onClick={loadAllStocks} style={{ color: '#adc6ff', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
            </div>
          )}
          {allLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} style={{ height: 44, borderRadius: 8 }} />)}
            </div>
          )}
          {!allLoading && allStocks && (
            <div style={{ background: '#1d2023', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8b90a0', textAlign: 'left', background: 'rgba(39,42,46,0.5)', width: 32 }}>#</th>
                      <SortTh col="shortName" label="Company" sortKey={sortKey} setSortKey={setSortKey} />
                      <SortTh col="symbol" label="Symbol" sortKey={sortKey} setSortKey={setSortKey} />
                      <SortTh col="price" label="Price (₹)" sortKey={sortKey} setSortKey={setSortKey} right />
                      <SortTh col="changePct" label="Change %" sortKey={sortKey} setSortKey={setSortKey} right />
                      <SortTh col="high" label="Day High" sortKey={sortKey} setSortKey={setSortKey} right />
                      <SortTh col="low" label="Day Low" sortKey={sortKey} setSortKey={setSortKey} right />
                      <SortTh col="volume" label="Volume" sortKey={sortKey} setSortKey={setSortKey} right />
                      <th style={{ padding: '12px 16px', background: 'rgba(39,42,46,0.5)' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {displayStocks.map((s, i) => (
                      <tr
                        key={s.symbol}
                        style={{ borderBottom: '1px solid rgba(65,71,85,0.1)', transition: 'background 0.1s', cursor: 'pointer' }}
                        className="group hover:bg-white/[0.025]"
                      >
                        <td style={{ padding: '10px 16px', fontSize: 11, color: '#8b90a0' }}>{i + 1}</td>
                        <td style={{ padding: '10px 16px', maxWidth: 180 }}>
                          <button
                            type="button"
                            onClick={() => navigate(`/?symbol=${encodeURIComponent(s.symbol)}&assetClass=STOCK`)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                              fontSize: 13, fontWeight: 600, color: '#e1e2e7',
                              display: 'block', overflow: 'hidden', textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap', maxWidth: 180, textAlign: 'left',
                              transition: 'color 0.12s',
                            }}
                            className="hover:text-[#adc6ff]"
                            title={`View chart for ${s.name || s.shortName}`}
                          >
                            {s.name || s.shortName}
                          </button>
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <button
                            type="button"
                            onClick={() => navigate(`/?symbol=${encodeURIComponent(s.symbol)}&assetClass=STOCK`)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                              fontFamily: 'monospace', fontSize: 12, color: '#adc6ff',
                              transition: 'opacity 0.12s',
                            }}
                            className="hover:opacity-70"
                            title={`View chart for ${s.symbol}`}
                          >
                            {(s.symbol || '').replace('.NS', '')}
                          </button>
                        </td>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: '#e1e2e7', textAlign: 'right' }}>
                          {s.price != null ? `₹${Number(s.price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            background: (s.changePct || 0) >= 0 ? 'rgba(63,227,151,0.1)' : 'rgba(255,179,181,0.1)',
                            color: (s.changePct || 0) >= 0 ? '#3fe397' : '#ffb3b5',
                          }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                              {(s.changePct || 0) >= 0 ? 'trending_up' : 'trending_down'}
                            </span>
                            {s.changePct != null ? `${s.changePct >= 0 ? '+' : ''}${Number(s.changePct).toFixed(2)}%` : '—'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: '#8b90a0', textAlign: 'right' }}>
                          {s.high != null ? `₹${Number(s.high).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: '#8b90a0', textAlign: 'right' }}>
                          {s.low != null ? `₹${Number(s.low).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 11, color: '#8b90a0', textAlign: 'right' }}>
                          {fmtVol(s.volume)}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            <button
                              type="button"
                              title="View chart"
                              onClick={() => setChartAsset({ symbol: s.symbol, assetType: 'STOCK' })}
                              style={{
                                padding: '5px 10px', borderRadius: 6,
                                background: 'rgba(65,71,85,0.3)', border: '1px solid rgba(65,71,85,0.4)',
                                color: '#c1c6d7', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                opacity: 0, transition: 'opacity 0.15s',
                                display: 'flex', alignItems: 'center', gap: 4,
                              }}
                              className="group-hover:opacity-100"
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>candlestick_chart</span>
                              Chart
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/?symbol=${encodeURIComponent(s.symbol)}&assetClass=STOCK`)}
                              style={{
                                padding: '5px 12px', borderRadius: 6,
                                background: 'rgba(173,198,255,0.1)', border: '1px solid rgba(173,198,255,0.25)',
                                color: '#adc6ff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                opacity: 0, transition: 'opacity 0.15s',
                              }}
                              className="group-hover:opacity-100"
                            >
                              Trade
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {displayStocks.length === 0 && !allLoading && (
                      <tr>
                        <td colSpan={9} style={{ padding: '40px 16px', textAlign: 'center', color: '#8b90a0', fontSize: 13 }}>
                          No stocks match your filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'all' && search.length === 0 && (
        <p style={{ fontSize: 13, color: '#8b90a0' }}>
          Use the search box above to find any crypto or NSE stock, then click to open its chart.
        </p>
      )}
    </div>
  );
}
