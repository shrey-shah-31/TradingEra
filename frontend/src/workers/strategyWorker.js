// ── Sandboxed Strategy Web Worker ─────────────────────────────────────────────
// Runs inside a separate thread — no DOM, no network, no require.
// Receives: { code, bars, initialCapital, commission }
// Posts back: { result } | { error }

// ── Indicator helpers (inlined so worker needs no imports) ────────────────────
function _sma(arr, period) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    let s = 0;
    for (let j = 0; j < period; j++) s += arr[i - j];
    out.push(s / period);
  }
  return out;
}

function _ema(arr, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev = null;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (prev == null) { prev = v; out.push(i < period - 1 ? null : prev); continue; }
    prev = v * k + prev * (1 - k);
    out.push(i < period - 1 ? null : prev);
  }
  return out;
}

function _rsi(closes, period) {
  const out = closes.map(() => null);
  if (closes.length <= period) return out;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gains += ch; else losses -= ch;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period; i < closes.length; i++) {
    if (i > period) {
      const ch = closes[i] - closes[i - 1];
      avgGain = (avgGain * (period - 1) + (ch > 0 ? ch : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (ch < 0 ? -ch : 0)) / period;
    }
    out[i] = 100 - 100 / (1 + (avgLoss === 0 ? 100 : avgGain / avgLoss));
  }
  return out;
}

function _macd(closes, fast = 12, slow = 26, signal = 9) {
  const ef = _ema(closes, fast).map(v => v ?? 0);
  const es = _ema(closes, slow).map(v => v ?? 0);
  const line = closes.map((_, i) => ef[i] - es[i]);
  const sig  = _ema(line, signal);
  const hist = line.map((v, i) => v - (sig[i] ?? 0));
  return { macdLine: line, signalLine: sig, histogram: hist };
}

function _bb(closes, period = 20, mult = 2) {
  const upper = [], lower = [], mid = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(null); lower.push(null); mid.push(null); continue; }
    const sl = closes.slice(i - period + 1, i + 1);
    const m  = sl.reduce((a, b) => a + b, 0) / period;
    const sd = Math.sqrt(sl.reduce((s, v) => s + (v - m) ** 2, 0) / period);
    mid.push(m); upper.push(m + mult * sd); lower.push(m - mult * sd);
  }
  return { upper, lower, mid };
}

// ── Simulation helpers ────────────────────────────────────────────────────────
function _calcStats(equityCurve, trades, initialCapital) {
  const starts = initialCapital;
  const ends   = equityCurve.at(-1)?.value ?? starts;
  const totalReturn = ((ends - starts) / starts) * 100;
  const winTrades  = trades.filter(t => t.pnl > 0);
  const lossTrades = trades.filter(t => t.pnl <= 0);
  const winRate    = trades.length ? (winTrades.length / trades.length) * 100 : 0;
  const avgWin     = winTrades.length  ? winTrades.reduce((s, t)  => s + t.pnl, 0) / winTrades.length  : 0;
  const avgLoss    = lossTrades.length ? lossTrades.reduce((s, t) => s + t.pnl, 0) / lossTrades.length : 0;
  const pf         = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : (winTrades.length ? 999 : 0);

  let peak = starts, maxDD = 0;
  for (const { value } of equityCurve) {
    if (value > peak) peak = value;
    const dd = (peak - value) / peak * 100;
    if (dd > maxDD) maxDD = dd;
  }

  const rets = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const p = equityCurve[i - 1].value, c = equityCurve[i].value;
    if (p > 0) rets.push((c - p) / p);
  }
  const avgRet = rets.reduce((s, r) => s + r, 0) / (rets.length || 1);
  const stdRet = Math.sqrt(rets.reduce((s, r) => s + (r - avgRet) ** 2, 0) / (rets.length || 1));
  const sharpe = stdRet > 0 ? (avgRet / stdRet) * Math.sqrt(252) : 0;

  return {
    totalReturn: +totalReturn.toFixed(2), finalEquity: +ends.toFixed(2), initialCapital: starts,
    totalTrades: trades.length, winTrades: winTrades.length, lossTrades: lossTrades.length,
    winRate: +winRate.toFixed(1), maxDrawdown: +maxDD.toFixed(2),
    profitFactor: +pf.toFixed(2), sharpeRatio: +sharpe.toFixed(2),
    avgWin: +avgWin.toFixed(2), avgLoss: +avgLoss.toFixed(2),
    avgBarsHeld: trades.length ? +(trades.reduce((s, t) => s + t.barsHeld, 0) / trades.length).toFixed(1) : 0,
    trades, equityCurve,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
self.onmessage = function ({ data }) {
  const { code, bars, initialCapital = 100_000, commission = 0.001 } = data;

  // ── 1. Pre-compute all indicators ──────────────────────────────────────────
  const closes  = bars.map(b => b.close);
  const highs   = bars.map(b => b.high);
  const lows    = bars.map(b => b.low);
  const volumes = bars.map(b => b.volume ?? 0);
  const { upper: bb_upper, lower: bb_lower, mid: bb_mid } = _bb(closes, 20, 2);
  const { macdLine, signalLine, histogram } = _macd(closes);

  const indicators = {
    sma20: _sma(closes, 20), sma50: _sma(closes, 50), sma100: _sma(closes, 100), sma200: _sma(closes, 200),
    ema9:  _ema(closes, 9),  ema21: _ema(closes, 21),  ema55:  _ema(closes, 55),
    rsi14: _rsi(closes, 14), rsi7: _rsi(closes, 7),
    macdLine, macdSignal: signalLine, macdHist: histogram,
    bbUpper: bb_upper, bbLower: bb_lower, bbMid: bb_mid,
    closes, highs, lows, volumes,
  };

  // ── 2. Parse user code safely ──────────────────────────────────────────────
  // Strategy must define a `strategy(ctx)` function.
  // We use new Function() which has no access to DOM/fetch/require/process.
  let userFn;
  try {
    // Disable dangerous globals
    const safeEval = new Function(
      'indicators', 'bars',
      `'use strict';
       const fetch = undefined, XMLHttpRequest = undefined,
             require = undefined, process = undefined,
             importScripts = undefined, open = undefined;
       ${code}
       if (typeof strategy !== 'function') throw new Error("No 'strategy' function found.");
       return strategy;`
    );
    userFn = safeEval(indicators, bars);
  } catch (e) {
    self.postMessage({ error: `Code error: ${e.message}` });
    return;
  }

  // ── 3. Simulate bar by bar ─────────────────────────────────────────────────
  let position = 0, capital = initialCapital, entryPrice = 0;
  const trades = [], equityCurve = [];
  let openTrade = null;
  const startTime = Date.now();
  const commRate = Number(commission);
  let barCount = 0;

  for (let i = 0; i < bars.length; i++) {
    // Hard timeout: 10s
    if (++barCount % 200 === 0 && Date.now() - startTime > 10_000) {
      self.postMessage({ error: 'Timeout: backtest exceeded 10 seconds.' });
      return;
    }

    const bar = bars[i];
    const ctx = {
      bars, index: i, close: bar.close, open: bar.open, high: bar.high, low: bar.low,
      volume: bar.volume ?? 0, position, balance: capital,
      indicators,
      // Convenience shortcuts
      sma20: indicators.sma20[i], sma50: indicators.sma50[i],
      ema9: indicators.ema9[i],  ema21: indicators.ema21[i],
      rsi14: indicators.rsi14[i], rsi7: indicators.rsi7[i],
      macd: indicators.macdLine[i], macdSignal: indicators.macdSignal[i],
      bbUpper: indicators.bbUpper[i], bbLower: indicators.bbLower[i], bbMid: indicators.bbMid[i],
    };

    let signal;
    try {
      signal = userFn(ctx);
    } catch (e) {
      self.postMessage({ error: `Runtime error at bar ${i}: ${e.message}` });
      return;
    }

    if (signal && signal.action) {
      const price = bar.close;
      const fee   = price * commRate;

      if ((signal.action === 'buy' || signal.action === 'BUY') && position === 0) {
        const qty  = Number(signal.size ?? 0);
        const cost = qty * (price + fee);
        if (qty > 0 && cost <= capital) {
          capital -= cost; position = qty; entryPrice = price;
          openTrade = { entryBar: i, entryPrice: price, size: qty, entryTime: bar.time };
        }
      } else if ((signal.action === 'sell' || signal.action === 'SELL') && position > 0) {
        const qty     = Math.min(Number(signal.size ?? position), position);
        const revenue = qty * (price - fee);
        const pnl     = revenue - qty * entryPrice;
        capital      += revenue;
        if (openTrade) {
          trades.push({
            ...openTrade, exitBar: i, exitPrice: price, exitTime: bar.time,
            pnl, pnlPct: (pnl / (qty * entryPrice)) * 100,
            barsHeld: i - openTrade.entryBar,
          });
          openTrade = null;
        }
        position -= qty;
        if (position < 0.000001) position = 0;
      }
    }

    equityCurve.push({ time: bar.time, value: +(capital + position * bar.close).toFixed(2) });
  }

  // Force-close open position on last bar
  if (position > 0 && bars.length > 0) {
    const lb = bars.at(-1);
    const revenue = position * lb.close;
    const pnl     = revenue - position * entryPrice;
    capital      += revenue;
    if (openTrade) {
      trades.push({
        ...openTrade, exitBar: bars.length - 1, exitPrice: lb.close, exitTime: lb.time,
        pnl, pnlPct: (pnl / (position * entryPrice)) * 100,
        barsHeld: bars.length - 1 - openTrade.entryBar,
        reason: 'End of Data',
      });
    }
  }

  self.postMessage({ result: _calcStats(equityCurve, trades, initialCapital) });
};
