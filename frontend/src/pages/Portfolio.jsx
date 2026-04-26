import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { api } from '../services/api.js';
import { PortfolioCard } from '../components/PortfolioCard.jsx';
import { EquityMiniChart } from '../components/EquityMiniChart.jsx';
import { Skeleton } from '../components/Skeleton.jsx';
import { buildEquitySeries } from '../utils/helpers.js';
import { useCurrency } from '../context/CurrencyContext.jsx';

function StatCard({ label, value, sub, color = '#e1e2e7', icon, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{ background: '#1d2023', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: 2 }}>
        {icon && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{icon}</span>}
        {label}
      </div>
      <p style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: '#8b90a0' }}>{sub}</p>}
    </motion.div>
  );
}

export default function Portfolio() {
  const [holdings, setHoldings] = useState([]);
  const [txs, setTxs] = useState([]);
  const [pnlData, setPnlData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { fmt, currency } = useCurrency();

  async function load() {
    setLoading(true);
    try {
      const [p, h, pnl] = await Promise.all([
        api.get('/api/portfolio'),
        api.get('/api/portfolio/history'),
        api.get('/api/portfolio/pnl'),
      ]);
      setHoldings(p.data.holdings || []);
      setTxs(h.data.transactions || []);
      setPnlData(pnl.data);
    } catch {
      setHoldings([]); setTxs([]); setPnlData(null);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 10_000);
    function onVisible() { if (document.visibilityState === 'visible') load(); }
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const equityPoints = useMemo(() => buildEquitySeries(txs), [txs]);
  const totals = useMemo(() => {
    const hv = holdings.reduce((s, h) => s + (h.value || 0), 0);
    const cost = holdings.reduce((s, h) => s + (h.cost || 0), 0);
    return { hv, cost, pnl: hv - cost };
  }, [holdings]);

  const realized = pnlData?.totalRealized ?? 0;
  const realizedPos = realized >= 0;

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {[0,1,2,3].map(i => <Skeleton key={i} style={{ height: 160, borderRadius: 12 }} />)}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div>
        <h1 className="font-headline" style={{ fontSize: 28, fontWeight: 900, color: '#e1e2e7', letterSpacing: '-0.03em', marginBottom: 4 }}>
          Portfolio Overview
        </h1>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <span className="font-headline" style={{ fontSize: 36, fontWeight: 900, color: '#adc6ff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>
            {fmt(totals.hv)}
          </span>
          <span style={{ fontSize: 14, color: totals.pnl >= 0 ? '#3fe397' : '#ffb3b5', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{totals.pnl >= 0 ? 'trending_up' : 'trending_down'}</span>
            {totals.pnl >= 0 ? '+' : ''}{fmt(totals.pnl)} unrealized
          </span>
        </div>
      </div>

      {/* Chart + allocation */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ background: '#1d2023', borderRadius: 12, padding: 20, minHeight: 280, position: 'relative', overflow: 'hidden' }}
        >
          <h2 className="font-headline" style={{ fontSize: 12, fontWeight: 700, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
            Historical Performance
          </h2>
          <EquityMiniChart points={equityPoints} />
        </motion.div>

        <div style={{ background: '#1d2023', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 className="font-headline" style={{ fontSize: 12, fontWeight: 700, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Summary
          </h2>
          {[
            { label: 'Holdings Value', value: fmt(totals.hv), color: '#e1e2e7' },
            { label: 'Cost Basis', value: fmt(totals.cost), color: '#8b90a0' },
            { label: 'Unrealized P&L', value: `${totals.pnl >= 0 ? '+' : ''}${fmt(totals.pnl)}`, color: totals.pnl >= 0 ? '#3fe397' : '#ffb3b5' },
            { label: 'Realized P&L', value: `${realized >= 0 ? '+' : ''}${fmt(realized)}`, color: realizedPos ? '#3fe397' : '#ffb3b5' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: '#8b90a0' }}>{label}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Realized P&L stats */}
      <div>
        <h2 className="font-headline" style={{ fontSize: 12, fontWeight: 700, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bar_chart</span>
          Realized P&amp;L
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <StatCard label="Total Realized" value={fmt(realized)} sub={realized !== 0 ? (realizedPos ? '▲ Profit' : '▼ Loss') : 'No closed trades'} color={realizedPos ? '#3fe397' : realized < 0 ? '#ffb3b5' : '#e1e2e7'} icon={realizedPos ? 'trending_up' : 'trending_down'} delay={0} />
          <StatCard label="Closed Trades" value={pnlData?.tradeCount ?? 0} sub={`${pnlData?.wins ?? 0}W · ${pnlData?.losses ?? 0}L`} icon="target" delay={0.05} />
          <StatCard label="Win Rate" value={pnlData?.tradeCount > 0 ? `${(pnlData.winRate).toFixed(1)}%` : '—'} sub="Profitable sells" color={(pnlData?.winRate ?? 0) >= 50 ? '#3fe397' : '#ffb3b5'} icon="bar_chart" delay={0.1} />
          <StatCard label="Best Trade" value={pnlData?.bestTrade ? fmt(pnlData.bestTrade.realized) : '—'} sub={pnlData?.bestTrade ? `${pnlData.bestTrade.asset} · ${pnlData.bestTrade.realizedPct.toFixed(2)}%` : 'No trades yet'} color="#3fe397" icon="emoji_events" delay={0.15} />
          <StatCard label="Worst Trade" value={pnlData?.worstTrade ? fmt(pnlData.worstTrade.realized) : '—'} sub={pnlData?.worstTrade ? `${pnlData.worstTrade.asset} · ${pnlData.worstTrade.realizedPct.toFixed(2)}%` : 'No trades yet'} color="#ffb3b5" icon="warning" delay={0.2} />
        </div>
      </div>

      {/* Closed trade history */}
      {pnlData?.trades?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{ background: '#1d2023', borderRadius: 12, overflow: 'hidden' }}
        >
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(65,71,85,0.2)' }}>
            <h3 className="font-headline" style={{ fontSize: 13, fontWeight: 700, color: '#e1e2e7' }}>Closed Trade History</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(65,71,85,0.2)' }}>
                  {['Asset', 'Qty Sold', 'Avg Cost', 'Sell Price', 'Realized P&L', 'Return %'].map((h, i) => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8b90a0', textAlign: i > 0 ? 'right' : 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pnlData.trades.map((t, i) => {
                  const pos = t.realized >= 0;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(65,71,85,0.1)', transition: 'background 0.1s' }} className="hover:bg-white/[0.02]">
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{ color: '#e1e2e7', fontWeight: 600 }}>{t.asset}</span>
                        <span style={{ marginLeft: 8, fontSize: 10, color: '#8b90a0' }}>{t.assetType}</span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#c1c6d7' }}>{Number(t.qty).toFixed(6)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#8b90a0' }}>{fmt(t.costBasis)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: '#e1e2e7' }}>{fmt(t.sellPrice)}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700, color: pos ? '#3fe397' : '#ffb3b5' }}>
                        {pos ? '+' : ''}{fmt(t.realized)}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', color: pos ? '#3fe397' : '#ffb3b5' }}>
                        {pos ? '+' : ''}{Number(t.realizedPct).toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Open positions */}
      <div>
        <h2 className="font-headline" style={{ fontSize: 12, fontWeight: 700, color: '#8b90a0', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>trending_up</span>
          Open Positions
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {holdings.length === 0 && (
            <p style={{ color: '#8b90a0', fontSize: 13, gridColumn: '1/-1' }}>No open positions yet. Place a buy order to begin.</p>
          )}
          {holdings.map((h, i) => (
            <PortfolioCard key={h._id} holding={h} index={i} onSold={load} />
          ))}
        </div>
      </div>
    </div>
  );
}
