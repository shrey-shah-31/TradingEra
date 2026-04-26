import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { api } from '../services/api.js';
import { formatPct, cn } from '../utils/helpers.js';
import { useCurrency } from '../context/CurrencyContext.jsx';
import { ChevronDown, ChevronUp, TrendingDown } from 'lucide-react';

export function PortfolioCard({ holding, index = 0, onSold }) {
  const { fmt } = useCurrency();
  const pnl = holding.pnl ?? 0;
  const pos = pnl >= 0;

  const [open, setOpen] = useState(false);
  const [orderType, setOrderType] = useState('MARKET');
  const [quantity, setQuantity] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [busy, setBusy] = useState(false);

  const maxQty = holding.quantity ?? 0;
  const isStock = holding.assetType === 'STOCK';
  const minQty = isStock ? 1 : 0.000001;

  const assetLabel =
    holding.assetType === 'STOCK'
      ? 'NSE · INR'
      : 'Crypto · INR (via USDT)';

  function fillAll() {
    setQuantity(isStock ? String(Math.floor(maxQty)) : String(maxQty));
  }

  async function sell(e) {
    e.preventDefault();
    const qty = Number(quantity);
    if (!qty || qty < minQty) {
      toast.error(`Minimum sell qty is ${minQty}`);
      return;
    }
    if (qty > maxQty) {
      toast.error(`You only hold ${maxQty} — can't sell more`);
      return;
    }
    setBusy(true);
    try {
      const body = {
        asset: holding.asset,
        assetType: holding.assetType,
        type: 'SELL',
        orderType,
        quantity: qty,
        ...(orderType === 'LIMIT' ? { limitPrice: Number(limitPrice) } : {}),
      };
      const { data } = await api.post('/api/trade/sell', body);
      toast.success(data.message || 'Sell order placed');
      setOpen(false);
      setQuantity('');
      setLimitPrice('');
      onSold?.();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Sell failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="glass rounded-2xl border border-era-border flex flex-col overflow-hidden"
    >
      {/* Holdings info */}
      <div className="p-4 flex flex-col gap-2">
        <div className="flex justify-between items-start gap-2">
          <div>
            <p className="text-xs text-era-muted">Asset</p>
            <p className="text-lg font-semibold font-mono tracking-tight">{holding.asset}</p>
            <p className="text-[10px] text-era-muted mt-0.5">{assetLabel}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-era-muted">Qty</p>
            <p className="font-mono text-era-text">{holding.quantity?.toFixed?.(6) ?? holding.quantity}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-era-muted">Avg</p>
            <p className="font-mono">{fmt(holding.avgPrice)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-era-muted">Mark</p>
            <p className="font-mono">{fmt(holding.marketPrice)}</p>
          </div>
          <div className="col-span-2 flex justify-between items-center pt-1 border-t border-white/5">
            <span className="text-era-muted text-xs">Unrealized P/L</span>
            <span className={pos ? 'text-emerald-400 font-mono' : 'text-rose-400 font-mono'}>
              {fmt(pnl)} · {formatPct(holding.pnlPct)}
            </span>
          </div>
        </div>

        {/* Sell toggle button */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'mt-1 flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-semibold border transition-all',
            open
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-200'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40'
          )}
        >
          <TrendingDown className="size-3.5" />
          {open ? 'Cancel Sell' : 'Sell Position'}
          {open ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      </div>

      {/* Expandable sell form */}
      <AnimatePresence>
        {open && (
          <motion.form
            key="sell-form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            onSubmit={sell}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 flex flex-col gap-3 border-t border-rose-500/20 pt-3 bg-rose-500/5">

              {/* Order type toggle */}
              <div className="grid grid-cols-2 gap-2">
                {['MARKET', 'LIMIT'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setOrderType(t)}
                    className={cn(
                      'py-1.5 rounded-xl text-xs font-medium border transition-colors',
                      orderType === t
                        ? 'border-rose-500/40 bg-rose-500/15 text-rose-200'
                        : 'border-white/10 text-era-muted hover:bg-white/5'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Quantity row */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-era-muted">Quantity to sell</label>
                  <button
                    type="button"
                    onClick={fillAll}
                    className="text-[10px] text-rose-300 hover:text-rose-200 border border-rose-500/30 px-2 py-0.5 rounded-md"
                  >
                    Sell All ({isStock ? Math.floor(maxQty) : maxQty})
                  </button>
                </div>
                <input
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder={isStock ? `1 – ${Math.floor(maxQty)}` : `0.01 – ${maxQty}`}
                  className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 font-mono text-sm outline-none focus:border-rose-500/40"
                />
              </div>

              {/* Limit price */}
              {orderType === 'LIMIT' && (
                <div>
                  <label className="text-xs text-era-muted">Limit price</label>
                  <input
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    placeholder={`e.g. ${fmt(holding.marketPrice || 0)}`}
                    className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 font-mono text-sm outline-none focus:border-rose-500/40"
                  />
                </div>
              )}

              {/* Estimated proceeds */}
              <div className="flex justify-between items-center bg-black/20 p-2.5 rounded-xl border border-white/5 text-xs">
                <span className="text-era-muted">Est. proceeds</span>
                <span className="font-mono font-semibold text-rose-200">
                  {fmt((Number(quantity) || 0) * (holding.marketPrice || 0))}
                </span>
              </div>

              <button
                type="submit"
                disabled={busy || !quantity}
                className={cn(
                  'rounded-xl py-2.5 text-sm font-semibold transition-opacity border bg-rose-500/20 border-rose-500/40 text-rose-200',
                  (busy || !quantity) && 'opacity-40 cursor-not-allowed'
                )}
              >
                {busy ? 'Placing order…' : `Confirm SELL ${holding.asset}`}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
