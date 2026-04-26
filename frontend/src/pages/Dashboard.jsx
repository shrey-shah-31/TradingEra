import { useEffect, useMemo, useCallback, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../services/api.js';
import { useTrading } from '../context/TradingContext.jsx';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { Chart } from '../components/Chart.jsx';
import { OrderForm } from '../components/OrderForm.jsx';
import { Skeleton } from '../components/Skeleton.jsx';
import { formatPct, cn } from '../utils/helpers.js';

/* ── small stat chip ─────────────────────────────────────────────────────── */
function StatChip({ label, value, positive }) {
  return (
    <div style={{
      background: '#1d2023',
      borderRadius: 10,
      padding: '10px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      minWidth: 110,
    }}>
      <span style={{ fontSize: 10, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
        {label}
      </span>
      <span style={{
        fontFamily: 'monospace',
        fontSize: 14,
        fontWeight: 700,
        color: positive === true ? '#3fe397' : positive === false ? '#ffb3b5' : '#e1e2e7',
      }}>
        {value}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [params] = useSearchParams();
  const {
    symbol, setSymbol, assetClass, setAssetClass,
    interval, setInterval, demo, liveTickers, indianTickers,
    nseStatus, setNseStatus, usdInr,
  } = useTrading();
  const { fmt, convert, currency } = useCurrency();
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [movers, setMovers] = useState(null);
  const [indianMovers, setIndianMovers] = useState(null);
  const [holdings, setHoldings] = useState([]);

  const symParam = params.get('symbol');
  const classParam = params.get('assetClass');

  useEffect(() => {
    if (classParam === 'STOCK' || classParam === 'CRYPTO') setAssetClass(classParam);
  }, [classParam, setAssetClass]);

  useEffect(() => {
    if (symParam) setSymbol(symParam.toUpperCase());
  }, [symParam, setSymbol]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/api/market/indian-stocks');
        setIndianMovers(data);
        if (data.nse) setNseStatus(data.nse);
      } catch { setIndianMovers(null); }
    })();
  }, [setNseStatus]);

  const assetType = assetClass === 'STOCK' ? 'STOCK' : 'CRYPTO';

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/api/market/history', {
          params: { symbol, interval, limit: 500, assetType },
        });
        if (!cancel) {
          setCandles(data.candles || []);
          if (data.nse) setNseStatus(data.nse);
          if (data.demo) toast.message('Demo mode', { description: 'Market API fallback data' });
        }
      } catch {
        if (!cancel) setCandles([]);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [symbol, interval, assetType, setNseStatus]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/api/market/movers');
        setMovers(data);
      } catch { setMovers(null); }
    })();
  }, []);

  const watchPreview = useMemo(() => {
    if (assetClass === 'STOCK') {
      const list = indianMovers?.stocks || indianTickers || [];
      const map = new Map(list.map((t) => [t.symbol, t]));
      return ['RELIANCE.NS', 'TCS.NS', 'INFY.NS'].map((s) => {
        const row = map.get(s);
        return { s: s.replace('.NS', ''), change: row ? +row.changePct : null, price: row ? +row.price : null };
      });
    }
    const map = new Map((liveTickers || []).map((t) => [t.symbol.replace('USDT', ''), t]));
    return ['BTC', 'ETH', 'SOL'].map((s) => {
      const row = map.get(s);
      const priceUsdt = row ? +row.lastPrice : null;
      return { s, change: row ? +row.priceChangePercent : null, price: priceUsdt != null ? priceUsdt * (usdInr || 83) : null };
    });
  }, [liveTickers, indianTickers, indianMovers, assetClass, usdInr]);

  const livePrice = useMemo(() => {
    if (assetClass === 'STOCK') {
      const row = (indianTickers || indianMovers?.stocks || []).find(t => t.symbol === symbol || t.symbol === symbol + '.NS');
      return row ? +row.price : null;
    }
    const row = (liveTickers || []).find(t => t.symbol === symbol || t.symbol === symbol + 'USDT');
    return row ? +row.lastPrice : null;
  }, [assetClass, symbol, indianTickers, indianMovers, liveTickers]);

  const activePrice = livePrice || (candles?.length ? candles[candles.length - 1].close : 0);

  const loadHoldings = useCallback(async () => {
    try {
      const { data } = await api.get('/api/portfolio');
      setHoldings(data.holdings || []);
    } catch { setHoldings([]); }
  }, []);

  useEffect(() => { loadHoldings(); }, [symbol, loadHoldings]);

  const currentHolding = useMemo(() => {
    const sym = symbol.replace('.NS', '').toUpperCase();
    return holdings.find((h) => h.asset?.toUpperCase().replace('.NS', '') === sym) ?? null;
  }, [holdings, symbol]);

  const onFilled = useCallback(() => {
    toast.success('Portfolio updated');
    loadHoldings();
  }, [loadHoldings]);

  const nseOpen = nseStatus?.open !== false && nseStatus?.session !== 'closed';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Banners */}
      {demo && (
        <div style={{ borderRadius: 10, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)', padding: '10px 16px', fontSize: 13, color: '#fde68a' }}>
          Demo market data — feed fallback. Trades still simulate in INR.
        </div>
      )}
      {assetClass === 'STOCK' && nseStatus && !nseOpen && (
        <div style={{ borderRadius: 10, border: '1px solid rgba(255,179,181,0.3)', background: 'rgba(255,179,181,0.08)', padding: '10px 16px', fontSize: 13, color: '#ffb3b5' }}>
          NSE cash market is closed (IST). Paper trading may still be allowed.
        </div>
      )}

      {/* Asset class toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['CRYPTO', 'Crypto (USDT→INR)'], ['STOCK', 'Indian Stocks (NSE)']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAssetClass(id)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: assetClass === id ? '1px solid rgba(173,198,255,0.4)' : '1px solid rgba(65,71,85,0.3)',
              background: assetClass === id ? 'rgba(173,198,255,0.1)' : '#1d2023',
              color: assetClass === id ? '#adc6ff' : '#8b90a0',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              transition: 'all 0.15s',
            }}
            className="font-headline"
          >
            {label}
          </button>
        ))}
        {assetClass === 'CRYPTO' && usdInr != null && (
          <span style={{ fontSize: 11, color: '#8b90a0', alignSelf: 'center', marginLeft: 8 }}>
            USDT→INR: ₹{Number(usdInr).toFixed(2)}
          </span>
        )}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* Chart column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Symbol bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="font-headline" style={{ fontSize: 18, fontWeight: 800, color: '#e1e2e7', letterSpacing: '-0.02em' }}>
              {symbol}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 280 }}>
              <span style={{ fontSize: 11, color: '#8b90a0' }}>Symbol</span>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder={assetClass === 'STOCK' ? 'RELIANCE.NS' : 'BTC'}
                style={{
                  flex: 1,
                  background: '#191c1f',
                  border: 'none',
                  borderRadius: 7,
                  padding: '7px 10px',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  color: '#e1e2e7',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Chart */}
          <div
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid rgba(65,71,85,0.2)',
              minHeight: 520,
              height: 'calc(80vh - 140px)',
              display: 'flex',
              flexDirection: 'column',
              background: '#0b0e11',
            }}
          >
            {loading && !candles.length ? (
              <Skeleton style={{ flex: 1, width: '100%' }} />
            ) : (
              <Chart
                candles={candles}
                interval={interval}
                onIntervalChange={setInterval}
                loading={loading}
                livePrice={livePrice}
                symbol={symbol}
                assetType={assetType}
                nseOpen={assetType === 'STOCK' ? nseOpen : true}
                usdInr={usdInr}
                holding={currentHolding}
                fmt={fmt}
                onBuy={async ({ qty, orderType, limitPrice }) => {
                  try {
                    const { data } = await api.post('/api/trade/buy', {
                      asset: symbol, assetType, type: 'BUY', orderType, quantity: qty,
                      ...(limitPrice ? { limitPrice } : {}),
                    });
                    toast.success(data.message || 'Order submitted');
                    onFilled(data);
                  } catch (err) {
                    toast.error(err.response?.data?.message || err.message || 'Order failed');
                  }
                }}
                onSell={async ({ qty, orderType, limitPrice }) => {
                  try {
                    const { data } = await api.post('/api/trade/sell', {
                      asset: symbol, assetType, type: 'SELL', orderType, quantity: qty,
                      ...(limitPrice ? { limitPrice } : {}),
                    });
                    toast.success(data.message || 'Order submitted');
                    onFilled(data);
                  } catch (err) {
                    toast.error(err.response?.data?.message || err.message || 'Order failed');
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <OrderForm
            symbol={symbol}
            assetType={assetType}
            nseOpen={nseOpen}
            onFilled={onFilled}
            usdInr={usdInr}
            currentPrice={activePrice}
            currency={currency}
            convert={convert}
            fmt={fmt}
            holding={currentHolding}
          />

          {/* Movers / NSE snapshot */}
          <div style={{ background: '#1d2023', borderRadius: 12, padding: 16 }}>
            <h2 className="font-headline" style={{ fontSize: 11, fontWeight: 700, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              {assetClass === 'CRYPTO' ? '⚡ Crypto Movers' : '📈 NSE Snapshot'}
            </h2>
            {assetClass === 'CRYPTO' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[['Gainers', movers?.gainers, true], ['Losers', movers?.losers, false]].map(([title, rows, isGain]) => (
                  <div key={title}>
                    <p style={{ fontSize: 10, color: isGain ? '#3fe397' : '#ffb3b5', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {title}
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {rows?.slice(0, 4).map((m) => (
                        <li key={m.symbol} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <button
                            type="button"
                            style={{ color: '#adc6ff', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace', padding: 0 }}
                            onClick={() => { setAssetClass('CRYPTO'); setSymbol(m.symbol.replace('USDT', '')); }}
                          >
                            {m.symbol.replace('USDT', '')}
                          </button>
                          <span style={{ color: isGain ? '#3fe397' : '#ffb3b5', fontFamily: 'monospace' }}>
                            {formatPct(m.changePct)}
                          </span>
                        </li>
                      )) ?? <li style={{ color: '#8b90a0' }}>—</li>}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(indianMovers?.stocks || []).slice(0, 6).map((s) => (
                  <li key={s.symbol} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <button
                      type="button"
                      style={{ color: '#adc6ff', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace', padding: 0 }}
                      onClick={() => setSymbol(s.symbol)}
                    >
                      {s.shortName || s.symbol.replace('.NS', '')}
                    </button>
                    <span style={{ color: s.changePct >= 0 ? '#3fe397' : '#ffb3b5', fontFamily: 'monospace' }}>
                      {fmt(s.price)} {formatPct(s.changePct)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Watchlist preview */}
          <div style={{ background: '#1d2023', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h2 className="font-headline" style={{ fontSize: 11, fontWeight: 700, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                ⭐ Watchlist
              </h2>
              <Link to="/watchlist" style={{ fontSize: 11, color: '#adc6ff', textDecoration: 'none', fontWeight: 600 }}>
                Manage
              </Link>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {watchPreview.map((w) => (
                <li key={w.s} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: 12 }}>
                  <span style={{ color: '#e1e2e7' }}>{w.s}</span>
                  <span style={{ color: w.change >= 0 ? '#3fe397' : '#ffb3b5' }}>
                    {w.price != null ? fmt(w.price) : '—'}{' '}
                    {w.change != null ? `(${formatPct(w.change)})` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
