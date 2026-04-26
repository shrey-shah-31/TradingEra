import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { api } from '../services/api.js';
import { cn } from '../utils/helpers.js';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

export function OrderForm({ symbol, assetType, nseOpen, onFilled, usdInr, currentPrice, currency, convert, fmt, holding }) {
  const [side, setSide] = useState('BUY');
  const [orderType, setOrderType] = useState('MARKET');
  const [quantity, setQuantity] = useState(assetType === 'STOCK' ? '1' : '0.01');
  const [limitPrice, setLimitPrice] = useState('');
  const [busy, setBusy] = useState(false);

  const isStock = assetType === 'STOCK';
  const minQty = isStock ? 1 : 0.01;
  const maxSellQty = holding ? (isStock ? Math.floor(holding.quantity) : holding.quantity) : 0;
  const hasHolding = maxSellQty > 0;

  // Reset quantity to correct default when asset type changes
  useEffect(() => {
    setQuantity(isStock ? '1' : '0.01');
    setSide('BUY');
  }, [isStock]);

  // Auto-switch to BUY when no holding and SELL is selected
  useEffect(() => {
    if (side === 'SELL' && !hasHolding) {
      // don't force switch — just show the warning
    }
  }, [side, hasHolding]);

  // When switching to SELL, pre-fill with held quantity
  function handleSideChange(newSide) {
    setSide(newSide);
    if (newSide === 'SELL' && hasHolding) {
      setQuantity(isStock ? String(Math.floor(maxSellQty)) : String(maxSellQty));
    }
    if (newSide === 'BUY') {
      setQuantity(isStock ? '1' : '0.01');
    }
  }

  function fillAll() {
    setQuantity(isStock ? String(Math.floor(maxSellQty)) : String(maxSellQty));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      let qty = Number(quantity);
      if (!qty || qty < minQty) throw new Error(isStock ? 'Minimum 1 share' : `Minimum quantity is ${minQty}`);
      if (isStock) qty = Math.floor(qty);
      if (isStock && qty < 1) throw new Error('Minimum 1 share');
      if (side === 'SELL' && qty > maxSellQty) {
        throw new Error(`You only hold ${maxSellQty} — can't sell more`);
      }
      const body = {
        asset: symbol,
        assetType,
        type: side,
        orderType,
        quantity: qty,
        ...(orderType === 'LIMIT' ? { limitPrice: Number(limitPrice) } : {}),
      };
      const path = side === 'BUY' ? '/api/trade/buy' : '/api/trade/sell';
      const { data } = await api.post(path, body);
      if (data?.nseClosed) {
        toast.message('NSE session', { description: 'Order simulated outside cash hours (paper mode).' });
      }
      toast.success(data.message || 'Order submitted');
      onFilled?.(data);
      // Reset quantity after fill
      setQuantity(isStock ? '1' : '0.01');
      setSide('BUY');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Order failed');
    } finally {
      setBusy(false);
    }
  }

  // Estimated cost/proceeds — Indian stocks use 5x leverage (user pays price/5)
  const STOCK_LEVERAGE = 5;
  const orderPrice = orderType === 'LIMIT' && Number(limitPrice) > 0 ? Number(limitPrice) : (currentPrice || 0);
  const effectiveOrderPrice = isStock ? orderPrice / STOCK_LEVERAGE : orderPrice;
  const estUsd = !isStock ? (Number(quantity) || 0) * orderPrice : 0;
  const estInr = isStock
    ? (Number(quantity) || 0) * effectiveOrderPrice
    : estUsd * (usdInr || 83);

  return (
    <motion.form
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={submit}
      className="glass rounded-2xl border border-era-border p-4 flex flex-col gap-4"
    >
      {/* Header badge */}
      <div className="flex items-center justify-between text-xs">
        <span
          className={cn(
            'px-2 py-0.5 rounded-md border font-medium',
            isStock ? 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10' : 'border-sky-500/30 text-sky-200 bg-sky-500/10'
          )}
        >
          {isStock ? 'NSE · INR' : 'Crypto · INR (via USDT)'}
        </span>
        <div className="flex items-center gap-2">
          {isStock && (
            <span className="px-2 py-0.5 rounded-md border border-violet-500/40 text-violet-300 bg-violet-500/10 font-semibold">
              5× Leverage
            </span>
          )}
          {isStock && nseOpen === false && (
            <span className="text-amber-300">Market closed (IST)</span>
          )}
        </div>
      </div>

      {/* BUY / SELL toggle */}
      <div className="flex rounded-xl overflow-hidden border border-white/10">
        {['BUY', 'SELL'].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleSideChange(s)}
            className={cn(
              'flex-1 py-2 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5',
              side === s
                ? s === 'BUY'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/20 text-rose-300'
                : 'bg-transparent text-era-muted hover:bg-white/5'
            )}
          >
            {s === 'BUY' ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {s}
          </button>
        ))}
      </div>

      {/* ── When SELL selected: show holding info or no-holding warning ── */}
      <AnimatePresence mode="wait">
        {side === 'SELL' && (
          <motion.div
            key={hasHolding ? 'holding-info' : 'no-holding'}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
          >
            {hasHolding ? (
              /* ── You have a holding → show position summary ── */
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-3 flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-era-muted">Your position</span>
                  <span className="font-mono font-semibold text-emerald-300">
                    {Number(holding.quantity).toFixed(isStock ? 0 : 6)} {symbol.replace('.NS', '')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-era-muted">Avg entry</span>
                  <span className="font-mono">{fmt(holding.avgPrice)}</span>
                </div>
                <div className="flex justify-between border-t border-white/5 pt-1">
                  <span className="text-era-muted">Unrealized P/L</span>
                  <span className={cn('font-mono font-semibold', (holding.pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                    {(holding.pnl ?? 0) >= 0 ? '+' : ''}{fmt(holding.pnl ?? 0)}
                  </span>
                </div>
              </div>
            ) : (
              /* ── No holding → warning ── */
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-3 flex items-start gap-2 text-xs">
                <AlertTriangle className="size-3.5 text-amber-400 mt-0.5 shrink-0" />
                <span className="text-amber-200">
                  You don&apos;t hold any <span className="font-semibold font-mono">{symbol.replace('.NS', '')}</span>.
                  Buy first, then sell.
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order type */}
      <div className="grid grid-cols-2 gap-2">
        {['MARKET', 'LIMIT'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setOrderType(t)}
            className={cn(
              'py-2 rounded-xl text-xs font-medium border',
              orderType === t ? 'border-sky-500/40 bg-sky-500/10' : 'border-white/10'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Quantity */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-era-muted">{isStock ? 'Shares' : 'Quantity'}</label>
          {side === 'SELL' && hasHolding && (
            <button
              type="button"
              onClick={fillAll}
              className="text-[10px] text-rose-300 hover:text-rose-200 border border-rose-500/30 px-2 py-0.5 rounded-md transition-colors"
            >
              Sell All ({isStock ? Math.floor(maxSellQty) : maxSellQty} {isStock ? 'shares' : 'units'})
            </button>
          )}
        </div>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          min={isStock ? 1 : 0.00001}
          step={isStock ? 1 : 0.01}
          disabled={side === 'SELL' && !hasHolding}
          className={cn(
            'w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 font-mono text-sm outline-none',
            side === 'SELL' && !hasHolding
              ? 'opacity-40 cursor-not-allowed'
              : 'focus:border-sky-500/40'
          )}
        />
      </div>

      {/* Limit price */}
      {orderType === 'LIMIT' && (
        <div>
          <label className="text-xs text-era-muted">
            Limit price ({isStock ? '₹ (INR)' : '₹ (notional USDT×INR)'})
          </label>
          <input
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            placeholder={isStock ? 'e.g. 2450' : 'e.g. 5800000'}
            className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 font-mono text-sm outline-none focus:border-sky-500/40"
          />
        </div>
      )}

      {/* Estimated cost / proceeds */}
      <div className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
        <span className="text-xs text-era-muted">
          {side === 'SELL' ? 'Est. proceeds' : 'Estimated cost'}
        </span>
        <div className="text-right">
          <span className="text-sm font-semibold font-mono text-white">
            {fmt(estInr)}
            {!isStock && (
              <span className="text-xs text-era-muted ml-1 font-normal inline-block" dir="ltr">
                ( ${estUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })} )
              </span>
            )}
          </span>
          {isStock && orderPrice > 0 && (
            <p className="text-[10px] text-era-muted mt-0.5">
              ₹{orderPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })} market × 1/5 leverage
            </p>
          )}
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={busy || (side === 'SELL' && !hasHolding)}
        className={cn(
          'rounded-xl py-3 text-sm font-semibold transition-opacity border',
          side === 'BUY'
            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
            : hasHolding
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-200'
              : 'bg-white/5 border-white/10 text-era-muted',
          (busy || (side === 'SELL' && !hasHolding)) && 'opacity-50 cursor-not-allowed'
        )}
      >
        {busy
          ? 'Submitting…'
          : side === 'SELL' && !hasHolding
            ? 'No position to sell'
            : `${side} ${symbol.replace('.NS', '')}`}
      </button>
    </motion.form>
  );
}
