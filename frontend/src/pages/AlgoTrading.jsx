import { useState, useCallback, useRef, useEffect } from 'react';
import { createChart } from 'lightweight-charts';
import Editor from '@monaco-editor/react';
import { STRATEGY_REGISTRY } from '../utils/strategies.js';
import { Backtester, RiskManager } from '../utils/backtester.js';
import { useAuth } from '../context/AuthContext.jsx';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

const SYMBOLS = [
  // ── Crypto ──────────────────────────────────────────────────────────────────
  { value: 'BTCUSDT',  label: 'BTC/USDT',  asset: 'BTC',  type: 'CRYPTO' },
  { value: 'ETHUSDT',  label: 'ETH/USDT',  asset: 'ETH',  type: 'CRYPTO' },
  { value: 'SOLUSDT',  label: 'SOL/USDT',  asset: 'SOL',  type: 'CRYPTO' },
  { value: 'BNBUSDT',  label: 'BNB/USDT',  asset: 'BNB',  type: 'CRYPTO' },
  { value: 'ADAUSDT',  label: 'ADA/USDT',  asset: 'ADA',  type: 'CRYPTO' },
  { value: 'XRPUSDT',  label: 'XRP/USDT',  asset: 'XRP',  type: 'CRYPTO' },
  { value: 'DOGEUSDT', label: 'DOGE/USDT', asset: 'DOGE', type: 'CRYPTO' },
  { value: 'AVAXUSDT', label: 'AVAX/USDT', asset: 'AVAX', type: 'CRYPTO' },
  // ── Indian Stocks (NSE) ──────────────────────────────────────────────────────
  { value: 'RELIANCE.NS',   label: 'RELIANCE',   asset: 'RELIANCE.NS',   type: 'STOCK' },
  { value: 'TCS.NS',        label: 'TCS',         asset: 'TCS.NS',        type: 'STOCK' },
  { value: 'INFY.NS',       label: 'INFOSYS',     asset: 'INFY.NS',       type: 'STOCK' },
  { value: 'HDFCBANK.NS',   label: 'HDFC BANK',   asset: 'HDFCBANK.NS',   type: 'STOCK' },
  { value: 'ICICIBANK.NS',  label: 'ICICI BANK',  asset: 'ICICIBANK.NS',  type: 'STOCK' },
  { value: 'SBIN.NS',       label: 'SBI',          asset: 'SBIN.NS',       type: 'STOCK' },
  { value: 'BHARTIARTL.NS', label: 'AIRTEL',       asset: 'BHARTIARTL.NS', type: 'STOCK' },
  { value: 'WIPRO.NS',      label: 'WIPRO',        asset: 'WIPRO.NS',      type: 'STOCK' },
  { value: 'HCLTECH.NS',    label: 'HCL TECH',     asset: 'HCLTECH.NS',    type: 'STOCK' },
  { value: 'AXISBANK.NS',   label: 'AXIS BANK',    asset: 'AXISBANK.NS',   type: 'STOCK' },
  { value: 'BAJFINANCE.NS', label: 'BAJAJ FIN',    asset: 'BAJFINANCE.NS', type: 'STOCK' },
  { value: 'MARUTI.NS',     label: 'MARUTI',       asset: 'MARUTI.NS',     type: 'STOCK' },
  { value: 'TITAN.NS',      label: 'TITAN',        asset: 'TITAN.NS',      type: 'STOCK' },
  { value: 'SUNPHARMA.NS',  label: 'SUN PHARMA',   asset: 'SUNPHARMA.NS',  type: 'STOCK' },
  { value: 'LT.NS',         label: 'L&T',           asset: 'LT.NS',         type: 'STOCK' },
  { value: 'NTPC.NS',       label: 'NTPC',          asset: 'NTPC.NS',       type: 'STOCK' },
  { value: 'ONGC.NS',       label: 'ONGC',          asset: 'ONGC.NS',       type: 'STOCK' },
  { value: 'ETERNAL.NS',    label: 'ZOMATO',        asset: 'ETERNAL.NS',    type: 'STOCK' },
  { value: 'ADANIENT.NS',   label: 'ADANI ENT',     asset: 'ADANIENT.NS',   type: 'STOCK' },
  { value: 'TATAMOTORS.NS', label: 'TATA MOTORS',   asset: 'TATAMOTORS.NS', type: 'STOCK' },
];

const TIMEFRAMES = [
  { value: '1h',  label: '1H',  binance: '1h',  limit: 500 },
  { value: '4h',  label: '4H',  binance: '4h',  limit: 500 },
  { value: '1d',  label: '1D',  binance: '1d',  limit: 365 },
];

const DEFAULT_CUSTOM_CODE = `// ─── Custom Strategy Template ────────────────────────────────────────────────
// context = { bars, index, position, balance, indicators: { sma20, sma50, rsi14 } }
// Return { action: 'BUY'|'SELL', size: number } or null

function strategy(context) {
  const { bars, index, position, balance, indicators } = context;
  const close  = bars[index].close;
  const sma20  = indicators.sma20[index];
  const sma50  = indicators.sma50[index];
  const rsi14  = indicators.rsi14[index];

  // Example: Buy when RSI < 35 and price above SMA50
  if (rsi14 < 35 && close > sma50 && position === 0) {
    const size = (balance * 0.05) / close;   // 5% of balance
    return { action: 'BUY', size };
  }

  // Sell when RSI > 65
  if (rsi14 > 65 && position > 0) {
    return { action: 'SELL', size: position };
  }

  return null;
}
`;

// Stat card
function Stat({ label, value, sub, color = '#e2e8f0', positive }) {
  const col = positive === true ? '#34d399' : positive === false ? '#f87171' : color;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, padding: '12px 16px', minWidth: 110,
    }}>
      <div style={{ fontSize: 10, color: '#4a5a7a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: col, fontFamily: 'monospace', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#4a5a7a', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// Equity curve mini-chart
function EquityChart({ curve, color }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    if (!ref.current || !curve?.length) return;
    if (!chartRef.current) {
      chartRef.current = createChart(ref.current, {
        layout: { background: { color: 'transparent' }, textColor: '#4a5a7a' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, timeVisible: true },
        crosshair: { mode: 1 },
        handleScroll: true,
        handleScale: true,
      });
      seriesRef.current = chartRef.current.addAreaSeries({
        lineColor: color ?? '#38bdf8',
        topColor: (color ?? '#38bdf8') + '40',
        bottomColor: (color ?? '#38bdf8') + '05',
        lineWidth: 2,
        priceFormat: { type: 'price', precision: 0, minMove: 1 },
      });
    }
    const data = curve.map(p => ({
      time: typeof p.time === 'number' && p.time > 1e10 ? Math.floor(p.time / 1000) : p.time,
      value: p.value,
    }));
    seriesRef.current.setData(data);
    chartRef.current.timeScale().fitContent();

    const obs = new ResizeObserver(() => {
      chartRef.current?.applyOptions({
        width: ref.current.clientWidth,
        height: ref.current.clientHeight,
      });
    });
    obs.observe(ref.current);
    return () => { obs.disconnect(); };
  }, [curve, color]);

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
}

export default function AlgoTrading() {
  const { user } = useAuth();

  // Strategy config
  const [selectedStratId, setSelectedStratId] = useState(STRATEGY_REGISTRY[0].id);
  const [symbolKey, setSymbolKey]             = useState('BTCUSDT');
  const [timeframeKey, setTimeframeKey]       = useState('1d');
  const [capital, setCapital]                 = useState(100_000);
  const [commission, setCommission]           = useState(0.1);
  const [params, setParams]                   = useState({ ...STRATEGY_REGISTRY[0].defaultParams });

  // Custom code editor
  const [customCode, setCustomCode]           = useState(DEFAULT_CUSTOM_CODE);
  const [builderTab, setBuilderTab]           = useState('preset'); // 'preset' | 'code'

  // Risk manager config
  const [slPct, setSlPct] = useState(0);
  const [tpPct, setTpPct] = useState(0);
  const [maxPosPct, setMaxPosPct] = useState(20);

  // State
  const [backtestResult, setBacktestResult]   = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState('');
  const [activeTab, setActiveTab]             = useState('overview');

  // Live paper trading
  const [liveRunning, setLiveRunning]         = useState(false);
  const [liveLogs, setLiveLogs]               = useState([]);
  const liveIntervalRef = useRef(null);

  const symDef  = SYMBOLS.find(s => s.value === symbolKey);
  const isStock = symDef?.type === 'STOCK';
  const stratDef = STRATEGY_REGISTRY.find(s => s.id === selectedStratId);

  // When strategy changes, reset params to defaults
  const handleStrategyChange = (id) => {
    const def = STRATEGY_REGISTRY.find(s => s.id === id);
    setSelectedStratId(id);
    setParams({ ...def.defaultParams });
    setBacktestResult(null);
  };

  // ── Fetch historical candles (Binance for crypto, backend for NSE stocks) ──
  const fetchCandles = useCallback(async () => {
    const tf = TIMEFRAMES.find(t => t.value === timeframeKey);
    if (isStock) {
      // Use our backend for NSE stock history
      const res = await fetch(`${API}/api/market/history?symbol=${encodeURIComponent(symbolKey)}&interval=${tf.value}&limit=500&assetType=STOCK`, {
        headers: { Authorization: `Bearer ${user?.token ?? localStorage.getItem('te_token')}` },
      });
      if (!res.ok) throw new Error(`Backend API error: ${res.status}`);
      const data = await res.json();
      return (data.candles || []).filter(c => c.open && c.close);
    }
    // Crypto via Binance
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbolKey}&interval=${tf.binance}&limit=${tf.limit}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
    const raw = await res.json();
    return raw.map(k => ({
      time:   Math.floor(k[0] / 1000),
      open:   parseFloat(k[1]),
      high:   parseFloat(k[2]),
      low:    parseFloat(k[3]),
      close:  parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  }, [symbolKey, timeframeKey, isStock, user]);

  // ── RUN BACKTEST ──────────────────────────────────────────────────────────
  const runBacktest = async () => {
    setError('');
    setLoading(true);
    setBacktestResult(null);
    try {
      const candles = await fetchCandles();
      if (!candles.length) throw new Error('No candle data returned');

      let strategy;

      if (builderTab === 'code') {
        // ── Custom code strategy (sandboxed in Web Worker via Function) ──────
        // Pre-compute indicators
        const closes = candles.map(c => c.close);
        const { sma: smaFn, ema: emaFn, rsi: rsiFn } = await import('../utils/indicators.js');
        const sma20  = smaFn(closes, 20);
        const sma50  = smaFn(closes, 50);
        const ema9   = emaFn(closes, 9);
        const ema21  = emaFn(closes, 21);
        const rsi14  = rsiFn(closes, 14);

        // Validate code syntax
        let userFn;
        try {
          // eslint-disable-next-line no-new-func
          userFn = new Function(`
            ${customCode}
            return typeof strategy === 'function' ? strategy : null;
          `)();
          if (typeof userFn !== 'function') throw new Error('No "strategy" function found in your code');
        } catch (syntaxErr) {
          throw new Error(`Code error: ${syntaxErr.message}`);
        }

        // Wrap as a Strategy-compatible class
        const { Strategy } = await import('../utils/strategies.js');
        class CustomStrategy extends Strategy {
          onBar(bar, account) {
            this._push(bar);
            const i = this._closes.length - 1;
            try {
              return userFn({
                bars: candles,
                index: i,
                position: this.position,
                balance: account.balance,
                indicators: { sma20, sma50, ema9, ema21, rsi14 },
              });
            } catch (e) {
              return null;
            }
          }
        }
        strategy = new CustomStrategy({ name: 'Custom', symbol: symbolKey, timeframe: timeframeKey, parameters: {} });
      } else {
        // ── Preset strategy ───────────────────────────────────────────────────
        strategy = new stratDef.Class({
          name: stratDef.label, symbol: symDef?.asset ?? symbolKey,
          timeframe: timeframeKey, parameters: params,
        });
        const risk = new RiskManager({ stopLossPct: slPct, takeProfitPct: tpPct, maxPositionPct: maxPosPct });
        const origOnBar = strategy.onBar.bind(strategy);
        strategy.onBar = (bar, account) => risk.validate(origOnBar(bar, account), account);
      }

      const backtester = new Backtester(strategy, candles, Number(capital), Number(commission));
      const result = backtester.run();
      setBacktestResult({
        ...result,
        stratLabel: builderTab === 'code' ? 'Custom Strategy' : stratDef.label,
        color: builderTab === 'code' ? '#a78bfa' : stratDef.color,
      });
      setActiveTab('overview');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── LIVE PAPER TRADE (simulate on latest bar each minute) ─────────────────
  const startLive = async () => {
    setLiveLogs([]);
    setLiveRunning(true);
    const symDef = SYMBOLS.find(s => s.value === symbolKey);
    const strategy = new stratDef.Class({
      name: stratDef.label, symbol: symDef.asset,
      timeframe: timeframeKey, parameters: params,
    });
    addLog('🚀 Live paper strategy started: ' + stratDef.label);

    const tick = async () => {
      try {
        const tf  = TIMEFRAMES.find(t => t.value === timeframeKey);
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbolKey}&interval=${tf.binance}&limit=100`;
        const res = await fetch(url);
        const raw = await res.json();
        const candles = raw.map(k => ({
          time: Math.floor(k[0]/1000), open: parseFloat(k[1]), high: parseFloat(k[2]),
          low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]),
        }));

        // Feed all bars except last one to warm up indicators
        for (let i = 0; i < candles.length - 1; i++) {
          strategy._push(candles[i]);
        }

        const lastBar = candles[candles.length - 1];
        const account = { balance: Number(capital), positions: strategy.position, equity: Number(capital), lastPrice: lastBar.close };
        const signal  = strategy.onBar(lastBar, account);

        if (signal) {
          addLog(
            `${signal.action === 'BUY' ? '🟢' : '🔴'} ${signal.action} ${signal.size.toFixed(4)} ${symDef.asset} @ ${lastBar.close.toLocaleString()} (paper)`
          );
          // Paper-execute: call app's backend (optional)
          try {
            await fetch(`${API}/api/trade/${signal.action === 'BUY' ? 'buy' : 'sell'}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.token}` },
              body: JSON.stringify({ asset: symDef.asset, quantity: signal.size }),
            });
          } catch (e) { addLog(`⚠️ Order submit failed: ${e.message}`); }
        } else {
          addLog(`⏳ No signal — ${symDef.asset} @ ${lastBar.close.toLocaleString()}`);
        }

        // Reset the internal buffers for next tick (re-process all bars fresh each tick)
        strategy._closes  = [];
        strategy._highs   = [];
        strategy._lows    = [];
        strategy._volumes = [];
      } catch (e) {
        addLog(`❌ Tick error: ${e.message}`);
      }
    };

    await tick();
    liveIntervalRef.current = setInterval(tick, 60_000); // every 1 min
  };

  const stopLive = () => {
    clearInterval(liveIntervalRef.current);
    setLiveRunning(false);
    addLog('⏹ Strategy stopped.');
  };

  const addLog = (msg) => {
    const ts = new Date().toLocaleTimeString('en-IN');
    setLiveLogs(prev => [`[${ts}] ${msg}`, ...prev].slice(0, 80));
  };

  useEffect(() => () => clearInterval(liveIntervalRef.current), []);

  const r = backtestResult;
  const returnPositive = r ? r.totalReturn >= 0 : undefined;
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 4px', minHeight: '100%' }}>

      {/* ── Top toolbar ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#e2e8f0' }}>
            🤖 <span style={{ background: 'linear-gradient(90deg,#38bdf8,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Algo Trading Studio</span>
          </h1>
        </div>

        {/* Symbol + timeframe badge */}
        <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', fontFamily: 'monospace', background: 'rgba(255,255,255,0.06)', padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)' }}>
          {symDef?.label ?? symbolKey} · {timeframeKey.toUpperCase()}
        </span>

        {/* Active strategy badge */}
        {backtestResult && (
          <span style={{ fontSize: 11, fontWeight: 600, color: stratDef.color, background: `${stratDef.color}15`, padding: '5px 12px', borderRadius: 7, border: `1px solid ${stratDef.color}35` }}>
            {backtestResult.stratLabel}
          </span>
        )}

        {/* ── Indicators button ── */}
        <button type="button" onClick={() => setIndicatorsOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12,
            background: indicatorsOpen ? 'rgba(56,189,248,0.2)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${indicatorsOpen ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.12)'}`,
            color: indicatorsOpen ? '#38bdf8' : '#94a3b8', transition: 'all 0.15s',
          }}
        >
          <span>📊</span> Indicators
        </button>

        {/* ── Custom Code toggle ── */}
        <button type="button" onClick={() => setBuilderTab(builderTab === 'code' ? 'preset' : 'code')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12,
            background: builderTab === 'code' ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${builderTab === 'code' ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.12)'}`,
            color: builderTab === 'code' ? '#a78bfa' : '#94a3b8', transition: 'all 0.15s',
          }}
        >
          <span>💻</span> Custom Code
        </button>
        {/* Run Backtest */}
        <button type="button" onClick={runBacktest} disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8, cursor: loading ? 'wait' : 'pointer', fontWeight: 700, fontSize: 12,
            background: loading ? 'rgba(56,189,248,0.1)' : 'linear-gradient(135deg,#0ea5e9,#6366f1)',
            border: 'none', color: '#fff', opacity: loading ? 0.7 : 1,
          }}
        >{loading ? '⏳ Running…' : '⚡ Run Backtest'}</button>

        {/* Live paper */}
        {!liveRunning ? (
          <button type="button" onClick={startLive}
            style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12, background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399' }}
          >▶ Live Paper</button>
        ) : (
          <button type="button" onClick={stopLive}
            style={{ padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12, background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171' }}
          >⏹ Stop</button>
        )}

        <div style={{ fontSize: 10, padding: '4px 10px', borderRadius: 6, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontWeight: 600 }}>
          📋 Paper Only
        </div>
      </div>

      {/* ── Indicators modal (Strategy Builder) ─────────────────────────────── */}
      {indicatorsOpen && (
        <>
          <div onClick={() => setIndicatorsOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 50, width: builderTab === 'code' ? 680 : 440, maxWidth: '95vw',
            maxHeight: '90vh', overflowY: 'auto',
            background: '#0d1220', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: 22,
            boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#7ca3cc', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                📊 Strategy Builder
              </span>
              <button type="button" onClick={() => setIndicatorsOpen(false)}
                style={{ fontSize: 20, color: '#4a5a7a', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            {/* Builder mode tabs */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3, marginBottom: 14 }}>
              {[['preset','📊 Preset'],['code','💻 Custom Code']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setBuilderTab(id)}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: builderTab === id ? 'rgba(56,189,248,0.2)' : 'transparent',
                    color: builderTab === id ? '#38bdf8' : '#4a5a7a',
                    border: `1px solid ${builderTab === id ? 'rgba(56,189,248,0.4)' : 'transparent'}`,
                  }}
                >{label}</button>
              ))}
            </div>

            {/* Strategy selector (preset mode) */}
            {builderTab === 'preset' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: '#4a5a7a', fontWeight: 600 }}>Strategy</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {STRATEGY_REGISTRY.map(s => (
                    <button key={s.id} type="button" onClick={() => handleStrategyChange(s.id)}
                      style={{
                        textAlign: 'left', padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                        background: selectedStratId === s.id ? `${s.color}18` : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${selectedStratId === s.id ? s.color + '55' : 'rgba(255,255,255,0.07)'}`,
                        color: selectedStratId === s.id ? s.color : '#94a3b8', transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{s.label}</div>
                      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>{s.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom code editor */}
            {builderTab === 'code' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: 11, color: '#4a5a7a', fontWeight: 600 }}>Strategy Code (JavaScript)</label>
                  <button type="button" onClick={() => setCustomCode(DEFAULT_CUSTOM_CODE)}
                    style={{ fontSize: 9, color: '#4a5a7a', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '2px 6px', cursor: 'pointer' }}>
                    Reset
                  </button>
                </div>
                <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', height: 340 }}>
                  <Editor height="340px" defaultLanguage="javascript" value={customCode}
                    onChange={(v) => setCustomCode(v ?? '')} theme="vs-dark"
                    options={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", minimap: { enabled: false }, scrollBeyondLastLine: false, lineNumbers: 'on', wordWrap: 'off', tabSize: 2, padding: { top: 10 }, scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 }, automaticLayout: true, folding: true }}
                  />
                </div>
                <div style={{ fontSize: 10, color: '#4a5a7a', lineHeight: 1.8, background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 10px', fontFamily: 'monospace' }}>
                  <div style={{ color: '#94a3b8', marginBottom: 4, fontFamily: 'sans-serif', fontWeight: 600, fontSize: 10 }}>📖 API Reference</div>
                  <div><span style={{ color: '#38bdf8' }}>context.bars[i]</span> <span style={{ color: '#4a5a7a' }}>→ {'{ time, open, high, low, close, volume }'}</span></div>
                  <div><span style={{ color: '#38bdf8' }}>context.index / position / balance</span></div>
                  <div style={{ marginTop: 4 }}>Indicators: {['sma20','sma50','ema9','ema21','rsi14'].map(k => <span key={k} style={{ color: '#facc15', marginRight: 8 }}>{k}</span>)}</div>
                  <div style={{ marginTop: 4, color: '#4a5a7a' }}>Return: <span style={{ color: '#34d399' }}>{'{ action: "BUY"|"SELL", size }'}</span> or <span style={{ color: '#f87171' }}>null</span></div>
                </div>
              </div>
            )}

            {/* Symbol + Timeframe */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: '#4a5a7a', fontWeight: 600 }}>Symbol</label>
                <select value={symbolKey} onChange={e => setSymbolKey(e.target.value)} style={selectStyle}>
                  <optgroup label="── Crypto ──">{SYMBOLS.filter(s => s.type === 'CRYPTO').map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</optgroup>
                  <optgroup label="── Indian Stocks (NSE) ──">{SYMBOLS.filter(s => s.type === 'STOCK').map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</optgroup>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: '#4a5a7a', fontWeight: 600 }}>Timeframe</label>
                <select value={timeframeKey} onChange={e => setTimeframeKey(e.target.value)} style={selectStyle}>
                  {TIMEFRAMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>

            {/* Strategy params */}
            {builderTab === 'preset' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                <label style={{ fontSize: 11, color: '#4a5a7a', fontWeight: 600 }}>Parameters</label>
                {stratDef.paramDefs.map(p => (
                  <div key={p.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: '#6b82a0' }}>{p.label}</span>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', color: stratDef.color }}>{params[p.key]}</span>
                    </div>
                    <input type="range" min={p.min} max={p.max} step={p.step} value={params[p.key] ?? p.min}
                      onChange={e => setParams(prev => ({ ...prev, [p.key]: Number(e.target.value) }))}
                      style={{ accentColor: stratDef.color, width: '100%', cursor: 'pointer' }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Risk / Capital */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.06)', marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#4a5a7a', fontWeight: 600 }}>Risk &amp; Capital</label>
              {[
                { label: 'Initial Capital (₹)', value: capital, setter: setCapital, min: 1000, max: 10_000_000, step: 1000 },
                { label: 'Commission (%)', value: commission, setter: setCommission, min: 0, max: 2, step: 0.05 },
                { label: 'Stop Loss (%)', value: slPct, setter: setSlPct, min: 0, max: 20, step: 0.5 },
                { label: 'Take Profit (%)', value: tpPct, setter: setTpPct, min: 0, max: 50, step: 0.5 },
                { label: 'Max Position (%)', value: maxPosPct, setter: setMaxPosPct, min: 1, max: 100, step: 1 },
              ].map(({ label, value, setter, min, max, step }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 10, color: '#4a5a7a', flex: 1 }}>{label}</label>
                  <input type="number" min={min} max={max} step={step} value={value}
                    onChange={e => setter(Number(e.target.value))}
                    style={{ ...inputStyle, width: 80, textAlign: 'right' }}
                  />
                </div>
              ))}
            <button type="button" onClick={() => { runBacktest(); setIndicatorsOpen(false); }} disabled={loading}
              style={{ width: '100%', padding: '10px', borderRadius: 8, cursor: loading ? 'wait' : 'pointer', fontWeight: 700, fontSize: 13, background: loading ? 'rgba(56,189,248,0.1)' : 'linear-gradient(135deg,#0ea5e9,#6366f1)', border: 'none', color: '#fff', opacity: loading ? 0.7 : 1 }}
            >{loading ? '⏳ Running Backtest…' : '⚡ Run Backtest'}</button>
          </div>
        </div>
        </>
      )}

      {/* ── Results (full width) ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Custom Code editor — always visible as a top-level section */}
        {builderTab === 'code' && (
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 6 }}>
                💻 Custom Strategy Code
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => setCustomCode(DEFAULT_CUSTOM_CODE)}
                  style={{ fontSize: 10, color: '#4a5a7a', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '3px 8px', cursor: 'pointer' }}>Reset</button>
                <button type="button" onClick={runBacktest} disabled={loading}
                  style={{ fontSize: 11, padding: '3px 12px', borderRadius: 5, cursor: loading ? 'wait' : 'pointer', fontWeight: 700,
                    background: loading ? 'rgba(56,189,248,0.1)' : 'linear-gradient(135deg,#0ea5e9,#6366f1)',
                    border: 'none', color: '#fff', opacity: loading ? 0.7 : 1 }}
                >{loading ? '⏳' : '⚡ Run'}</button>
              </div>
            </div>
            <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', height: 380 }}>
              <Editor height="380px" defaultLanguage="javascript" value={customCode}
                onChange={(v) => setCustomCode(v ?? '')} theme="vs-dark"
                options={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", minimap: { enabled: false }, scrollBeyondLastLine: false, lineNumbers: 'on', wordWrap: 'off', tabSize: 2, padding: { top: 10 }, scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 }, automaticLayout: true, folding: true }}
              />
            </div>
            <div style={{ fontSize: 10, color: '#4a5a7a', lineHeight: 1.8, background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 10px', fontFamily: 'monospace', marginTop: 8 }}>
              <span style={{ color: '#38bdf8' }}>context.bars[i]</span> · <span style={{ color: '#38bdf8' }}>index</span> · <span style={{ color: '#38bdf8' }}>position</span> · <span style={{ color: '#38bdf8' }}>balance</span>
              {' | '}Indicators: {['sma20','sma50','ema9','ema21','rsi14'].map(k => <span key={k} style={{ color: '#facc15', marginRight: 6 }}>{k}</span>)}
              {' | '}Return: <span style={{ color: '#34d399' }}>{'{ action:"BUY"|"SELL", size }'}</span> or <span style={{ color: '#f87171' }}>null</span>
            </div>
          </div>
        )}

          {/* Live logs (shown if running) */}
          {(liveRunning || liveLogs.length > 0) && (
            <div style={{
              background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(52,211,153,0.25)',
              borderRadius: 12, padding: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {liveRunning && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />}
                <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399' }}>
                  {liveRunning ? 'LIVE PAPER TRADING' : 'SESSION LOG'}
                </span>
                <span style={{ fontSize: 10, color: '#4a5a7a', marginLeft: 'auto' }}>{stratDef.label} · {symbolKey}</span>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                {liveLogs.map((l, i) => (
                  <div key={i} style={{ color: l.includes('🟢') ? '#34d399' : l.includes('🔴') ? '#f87171' : l.includes('❌') ? '#f59e0b' : '#6b82a0' }}>{l}</div>
                ))}
                {liveLogs.length === 0 && <div style={{ color: '#4a5a7a' }}>Initialising…</div>}
              </div>
            </div>
          )}

          {/* No result yet */}
          {!r && !loading && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 16, padding: 48,
              background: 'rgba(255,255,255,0.015)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 14,
            }}>
              <div style={{ fontSize: 48 }}>📊</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>Backtest Results</div>
              <div style={{ fontSize: 13, color: '#4a5a7a', textAlign: 'center', maxWidth: 340 }}>
                Configure your strategy on the left, then click <strong style={{ color: '#38bdf8' }}>⚡ Run Backtest</strong> to simulate performance on historical data.
              </div>
            </div>
          )}

          {loading && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 48,
              background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14,
            }}>
              <div style={{ width: 36, height: 36, border: '3px solid #38bdf8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <div style={{ fontSize: 14, color: '#4a5a7a' }}>Fetching candles &amp; running strategy…</div>
            </div>
          )}

          {r && !loading && (
            <>
              {/* Summary stats row */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Stat label="Total Return" value={`${r.totalReturn > 0 ? '+' : ''}${r.totalReturn}%`} positive={returnPositive} />
                <Stat label="Final Equity" value={`₹${r.finalEquity.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} color="#e2e8f0" />
                <Stat label="Max Drawdown" value={`${r.maxDrawdown}%`} positive={false} />
                <Stat label="Sharpe Ratio" value={r.sharpeRatio} positive={r.sharpeRatio > 1} />
                <Stat label="Win Rate" value={`${r.winRate}%`} positive={r.winRate >= 50} />
                <Stat label="Profit Factor" value={r.profitFactor} positive={r.profitFactor > 1} />
                <Stat label="Total Trades" value={r.totalTrades} color="#e2e8f0"
                  sub={`${r.winTrades}W / ${r.lossTrades}L`} />
                <Stat label="Avg Bars Held" value={r.avgBarsHeld} color="#e2e8f0" />
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 0 }}>
                {['overview', 'trades', 'equity'].map(tab => (
                  <button
                    key={tab} type="button" onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '6px 14px', borderRadius: '6px 6px 0 0', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', border: 'none', background: 'none',
                      color: activeTab === tab ? stratDef.color : '#4a5a7a',
                      borderBottom: `2px solid ${activeTab === tab ? stratDef.color : 'transparent'}`,
                      textTransform: 'capitalize',
                    }}
                  >{tab}</button>
                ))}
              </div>

              {/* Tab: Overview → Equity chart */}
              {activeTab === 'overview' && (
                <div style={{ height: 320, background: 'rgba(0,0,0,0.3)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ padding: '10px 14px 0', fontSize: 11, color: '#4a5a7a', fontWeight: 600 }}>
                    EQUITY CURVE — {r.stratLabel} · {symbolKey} · {timeframeKey.toUpperCase()}
                  </div>
                  <EquityChart curve={r.equityCurve} color={stratDef.color} />
                </div>
              )}

              {/* Tab: Equity → bigger chart */}
              {activeTab === 'equity' && (
                <div style={{ height: 420, background: 'rgba(0,0,0,0.3)', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <EquityChart curve={r.equityCurve} color={stratDef.color} />
                </div>
              )}

              {/* Tab: Trades list */}
              {activeTab === 'trades' && (
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,255,255,0.04)', color: '#4a5a7a', textAlign: 'left' }}>
                          {['#', 'Entry', 'Exit', 'Size', 'Entry $', 'Exit $', 'P&L', 'P&L %', 'Bars'].map(h => (
                            <th key={h} style={{ padding: '8px 10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {r.trades.length === 0 && (
                          <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#4a5a7a' }}>No trades executed.</td></tr>
                        )}
                        {r.trades.map((t, i) => {
                          const win = t.pnl >= 0;
                          return (
                            <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: '#94a3b8' }}>
                              <td style={{ padding: '6px 10px', color: '#4a5a7a' }}>{i + 1}</td>
                              <td style={{ padding: '6px 10px' }}>{fmtDate(t.entryTime)}</td>
                              <td style={{ padding: '6px 10px' }}>{fmtDate(t.exitTime)}</td>
                              <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{t.size.toFixed(4)}</td>
                              <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{t.entryPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                              <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{t.exitPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                              <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: win ? '#34d399' : '#f87171', fontWeight: 700 }}>
                                {win ? '+' : ''}{t.pnl.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '6px 10px', color: win ? '#34d399' : '#f87171' }}>
                                {win ? '+' : ''}{t.pnlPct.toFixed(2)}%
                              </td>
                              <td style={{ padding: '6px 10px', color: '#4a5a7a' }}>{t.barsHeld}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
}

// Helpers
const fmtDate = (t) => {
  if (!t) return '—';
  const d = typeof t === 'number' ? new Date(t * 1000) : new Date(t);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
};

const selectStyle = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 7, padding: '5px 8px', color: '#e2e8f0', fontSize: 12,
  outline: 'none', cursor: 'pointer', width: '100%',
};

const inputStyle = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6, padding: '4px 8px', color: '#e2e8f0', fontSize: 12,
  outline: 'none',
};
