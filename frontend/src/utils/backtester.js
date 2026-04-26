// ─── BACKTESTING ENGINE ───────────────────────────────────────────────────────

export class Backtester {
  /**
   * @param {import('./strategies.js').Strategy} strategy   - Instantiated strategy
   * @param {Array<{time,open,high,low,close,volume}>} data - Historical bars
   * @param {number} initialCapital                         - Starting cash (paper)
   * @param {number} commission                            - Commission % per trade (e.g. 0.1)
   */
  constructor(strategy, data, initialCapital = 100_000, commission = 0.1) {
    this.strategy       = strategy;
    this.data           = data;
    this.initialCapital = initialCapital;
    this.commission     = commission / 100;  // convert % to decimal
    this.capital        = initialCapital;
    this.equityCurve    = [];
    this.trades         = [];
    this.openTrade      = null;
  }

  run() {
    this.capital  = this.initialCapital;
    this.trades   = [];
    this.openTrade = null;
    this.equityCurve = [];

    // Reset strategy internal state
    this.strategy.position   = 0;
    this.strategy.entryPrice = 0;
    this.strategy._closes    = [];
    this.strategy._highs     = [];
    this.strategy._lows      = [];
    this.strategy._volumes   = [];

    for (let i = 0; i < this.data.length; i++) {
      const bar = this.data[i];

      const account = {
        balance:    this.capital,
        positions:  this.strategy.position,
        equity:     this.capital + this.strategy.position * bar.close,
        lastPrice:  bar.close,
      };

      const signal = this.strategy.onBar(bar, account);

      if (signal) {
        this._executeSignal(signal, bar, i);
      }

      // Check stop-loss / take-profit if open
      this._checkSLTP(bar, i);

      const posValue = this.strategy.position * bar.close;
      const equity   = this.capital + posValue;
      this.equityCurve.push({ time: bar.time, value: equity, bar: i });
    }

    // Close any open position on last bar
    if (this.strategy.position > 0) {
      const lastBar = this.data[this.data.length - 1];
      this._forceClose(lastBar, this.data.length - 1, 'End of Data');
    }

    return this._calculateStats();
  }

  _executeSignal(signal, bar, idx) {
    const price = bar.close;
    const fee   = price * this.commission;

    if (signal.action === 'BUY' && this.strategy.position === 0) {
      const qty  = Math.floor(signal.size * 100) / 100;
      const cost = qty * (price + fee);
      if (cost <= 0 || cost > this.capital) return;

      this.capital -= cost;
      this.strategy.position   = qty;
      this.strategy.entryPrice = price;

      this.openTrade = {
        type: 'BUY', entryBar: idx, entryPrice: price,
        size: qty, entryTime: bar.time,
        slPrice: signal.sl ?? null,
        tpPrice: signal.tp ?? null,
      };
    }

    else if (signal.action === 'SELL' && this.strategy.position > 0) {
      const qty     = Math.min(signal.size, this.strategy.position);
      const revenue = qty * (price - fee);
      this.capital += revenue;

      const pnl    = revenue - (qty * this.strategy.entryPrice);
      const pnlPct = (pnl / (qty * this.strategy.entryPrice)) * 100;

      if (this.openTrade) {
        this.trades.push({
          ...this.openTrade,
          exitBar:  idx, exitPrice: price, exitTime: bar.time,
          pnl, pnlPct,
          barsHeld: idx - this.openTrade.entryBar,
        });
        this.openTrade = null;
      }

      this.strategy.position  -= qty;
      if (this.strategy.position <= 0) this.strategy.position = 0;
    }
  }

  _checkSLTP(bar, idx) {
    if (!this.openTrade || this.strategy.position <= 0) return;
    const { slPrice, tpPrice } = this.openTrade;
    if (tpPrice && bar.high >= tpPrice) {
      this._forceClose(bar, idx, 'Take Profit', tpPrice);
    } else if (slPrice && bar.low <= slPrice) {
      this._forceClose(bar, idx, 'Stop Loss', slPrice);
    }
  }

  _forceClose(bar, idx, reason, price = bar.close) {
    if (this.strategy.position <= 0) return;
    const qty     = this.strategy.position;
    const fee     = price * this.commission;
    const revenue = qty * (price - fee);
    this.capital += revenue;

    const pnl    = revenue - (qty * (this.openTrade?.entryPrice ?? price));
    const pnlPct = this.openTrade
      ? (pnl / (qty * this.openTrade.entryPrice)) * 100
      : 0;

    if (this.openTrade) {
      this.trades.push({
        ...this.openTrade,
        exitBar: idx, exitPrice: price, exitTime: bar.time,
        pnl, pnlPct,
        barsHeld: idx - this.openTrade.entryBar,
        reason,
      });
      this.openTrade = null;
    }

    this.strategy.position = 0;
  }

  _calculateStats() {
    if (this.equityCurve.length === 0) return this._empty();

    const starts = this.initialCapital;
    const ends   = this.equityCurve[this.equityCurve.length - 1].value;

    const totalReturn    = ((ends - starts) / starts) * 100;
    const winTrades      = this.trades.filter(t => t.pnl > 0);
    const lossTrades     = this.trades.filter(t => t.pnl <= 0);
    const winRate        = this.trades.length ? (winTrades.length / this.trades.length) * 100 : 0;
    const avgWin         = winTrades.length  ? winTrades.reduce((s, t)  => s + t.pnl, 0) / winTrades.length  : 0;
    const avgLoss        = lossTrades.length ? lossTrades.reduce((s, t) => s + t.pnl, 0) / lossTrades.length : 0;
    const profitFactor   = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : Infinity;
    const avgBarsHeld    = this.trades.length ? this.trades.reduce((s, t) => s + t.barsHeld, 0) / this.trades.length : 0;

    // Max drawdown
    let peak = starts, maxDD = 0;
    for (const { value } of this.equityCurve) {
      if (value > peak) peak = value;
      const dd = (peak - value) / peak * 100;
      if (dd > maxDD) maxDD = dd;
    }

    // Sharpe (daily returns approximation)
    const rets = [];
    for (let i = 1; i < this.equityCurve.length; i++) {
      const prev = this.equityCurve[i - 1].value;
      const cur  = this.equityCurve[i].value;
      if (prev > 0) rets.push((cur - prev) / prev);
    }
    const avgRet = rets.reduce((s, r) => s + r, 0) / (rets.length || 1);
    const stdRet = Math.sqrt(rets.reduce((s, r) => s + (r - avgRet) ** 2, 0) / (rets.length || 1));
    const sharpe = stdRet > 0 ? (avgRet / stdRet) * Math.sqrt(252) : 0;

    return {
      totalReturn:   +totalReturn.toFixed(2),
      finalEquity:   +ends.toFixed(2),
      initialCapital: starts,
      totalTrades:   this.trades.length,
      winTrades:     winTrades.length,
      lossTrades:    lossTrades.length,
      winRate:       +winRate.toFixed(1),
      maxDrawdown:   +maxDD.toFixed(2),
      profitFactor:  isFinite(profitFactor) ? +profitFactor.toFixed(2) : 999,
      sharpeRatio:   +sharpe.toFixed(2),
      avgBarsHeld:   +avgBarsHeld.toFixed(1),
      avgWin:        +avgWin.toFixed(2),
      avgLoss:       +avgLoss.toFixed(2),
      trades:        this.trades,
      equityCurve:   this.equityCurve,
    };
  }

  _empty() {
    return {
      totalReturn: 0, finalEquity: this.initialCapital, initialCapital: this.initialCapital,
      totalTrades: 0, winTrades: 0, lossTrades: 0, winRate: 0,
      maxDrawdown: 0, profitFactor: 0, sharpeRatio: 0, avgBarsHeld: 0,
      avgWin: 0, avgLoss: 0, trades: [], equityCurve: [],
    };
  }
}

// ─── RISK MANAGER ─────────────────────────────────────────────────────────────
export class RiskManager {
  constructor(config = {}) {
    this.maxPositionPct  = config.maxPositionPct  ?? 20;   // % of balance
    this.maxDailyLoss    = config.maxDailyLoss    ?? 5;    // % of balance
    this.stopLossPct     = config.stopLossPct     ?? 0;    // 0 = disabled
    this.takeProfitPct   = config.takeProfitPct   ?? 0;    // 0 = disabled
    this._dailyLoss      = 0;
    this._lastResetDate  = new Date().toDateString();
  }

  validate(signal, account) {
    const today = new Date().toDateString();
    if (today !== this._lastResetDate) { this._dailyLoss = 0; this._lastResetDate = today; }
    if (!signal) return null;

    const maxLossAmt = account.balance * (this.maxDailyLoss / 100);
    if (this._dailyLoss >= maxLossAmt) return null;

    let size = signal.size;
    const maxQty = (account.balance * (this.maxPositionPct / 100)) / (account.lastPrice ?? 1);
    size = Math.min(size, maxQty);
    if (size <= 0) return null;

    const enriched = { ...signal, size };
    if (this.stopLossPct  > 0 && signal.action === 'BUY')
      enriched.sl = account.lastPrice * (1 - this.stopLossPct  / 100);
    if (this.takeProfitPct > 0 && signal.action === 'BUY')
      enriched.tp = account.lastPrice * (1 + this.takeProfitPct / 100);

    return enriched;
  }

  recordLoss(amount) { this._dailyLoss += Math.max(0, -amount); }
}
