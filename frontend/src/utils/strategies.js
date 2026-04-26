import { sma, ema, rsi as calcRsi, macd as calcMacd } from './indicators.js';

// ─── BASE STRATEGY ────────────────────────────────────────────────────────────
export class Strategy {
  constructor(config) {
    this.name        = config.name;
    this.symbol      = config.symbol      ?? 'BTC';
    this.timeframe   = config.timeframe   ?? '1h';
    this.parameters  = config.parameters  ?? {};
    this.position    = 0;     // current qty held
    this.entryPrice  = 0;
    this._closes     = [];
    this._highs      = [];
    this._lows       = [];
    this._volumes    = [];
  }

  /** Called once per bar. Return { action:'BUY'|'SELL', size } or null. */
  onBar(bar, _accountInfo) { // eslint-disable-line no-unused-vars
    throw new Error(`${this.constructor.name}.onBar() not implemented`);
  }

  // Optional lifecycle hooks
  onOrderFilled(_order)    {}
  onTradeComplete(_trade)  {}

  /** Internal: push a bar into the rolling history buffers */
  _push(bar) {
    this._closes.push(bar.close);
    this._highs.push(bar.high);
    this._lows.push(bar.low);
    this._volumes.push(bar.volume ?? 0);
  }
}

// ─── STRATEGY 1: Moving Average Crossover ────────────────────────────────────
export class MACrossover extends Strategy {
  onBar(bar, account) {
    this._push(bar);
    const { fastPeriod = 9, slowPeriod = 21, orderSize = 1 } = this.parameters;
    const closes = this._closes;
    if (closes.length < slowPeriod + 1) return null;

    const fast = ema(closes, fastPeriod);
    const slow = ema(closes, slowPeriod);
    const i = closes.length - 1;
    const prevFast = fast[i - 1], prevSlow = slow[i - 1];
    const curFast  = fast[i],     curSlow  = slow[i];
    if (!curFast || !curSlow || !prevFast || !prevSlow) return null;

    const crossed_up   = prevFast <= prevSlow && curFast > curSlow;
    const crossed_down = prevFast >= prevSlow && curFast < curSlow;

    if (crossed_up && this.position === 0) {
      const qty = Math.floor((account.balance * Number(orderSize) / 100) / bar.close * 100) / 100;
      return qty > 0 ? { action: 'BUY', size: qty } : null;
    }
    if (crossed_down && this.position > 0) {
      return { action: 'SELL', size: this.position };
    }
    return null;
  }
}

// ─── STRATEGY 2: RSI Overbought/Oversold ─────────────────────────────────────
export class RSIStrategy extends Strategy {
  onBar(bar, account) {
    this._push(bar);
    const { period = 14, oversold = 30, overbought = 70, orderSize = 1 } = this.parameters;
    const closes = this._closes;
    if (closes.length < period + 2) return null;

    const rv = calcRsi(closes, period);
    const i = closes.length - 1;
    const cur  = rv[i];
    const prev = rv[i - 1];
    if (cur == null || prev == null) return null;

    const enterLong  = prev <= Number(oversold)    && cur > Number(oversold)    && this.position === 0;
    const exitLong   = prev < Number(overbought)   && cur >= Number(overbought) && this.position > 0;

    if (enterLong) {
      const qty = Math.floor((account.balance * Number(orderSize) / 100) / bar.close * 100) / 100;
      return qty > 0 ? { action: 'BUY', size: qty } : null;
    }
    if (exitLong) return { action: 'SELL', size: this.position };
    return null;
  }
}

// ─── STRATEGY 3: MACD Signal Cross ───────────────────────────────────────────
export class MACDStrategy extends Strategy {
  onBar(bar, account) {
    this._push(bar);
    const { fast = 12, slow = 26, signal = 9, orderSize = 1 } = this.parameters;
    const closes = this._closes;
    if (closes.length < slow + signal + 2) return null;

    const { macdLine, signalLine } = calcMacd(closes, Number(fast), Number(slow), Number(signal));
    const i = closes.length - 1;
    const ml  = macdLine[i],    sl  = signalLine[i];
    const mlP = macdLine[i-1],  slP = signalLine[i-1];
    if (ml == null || sl == null || mlP == null || slP == null) return null;

    const bullCross = mlP <= slP && ml > sl;
    const bearCross = mlP >= slP && ml < sl;

    if (bullCross && this.position === 0) {
      const qty = Math.floor((account.balance * Number(orderSize) / 100) / bar.close * 100) / 100;
      return qty > 0 ? { action: 'BUY', size: qty } : null;
    }
    if (bearCross && this.position > 0) return { action: 'SELL', size: this.position };
    return null;
  }
}

// ─── STRATEGY 4: Bollinger Band Bounce ───────────────────────────────────────
export class BollingerBounce extends Strategy {
  onBar(bar, account) {
    this._push(bar);
    const { period = 20, multiplier = 2, orderSize = 1 } = this.parameters;
    const closes = this._closes;
    const n = Number(period);
    if (closes.length < n + 1) return null;

    const slice = closes.slice(-n);
    const mean  = slice.reduce((a, b) => a + b, 0) / n;
    const std   = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
    const upper = mean + Number(multiplier) * std;
    const lower = mean - Number(multiplier) * std;

    const prevClose = closes[closes.length - 2];
    const curClose  = bar.close;

    const touchLower = prevClose <= lower && curClose > lower && this.position === 0;
    const touchUpper = prevClose >= upper && curClose < upper && this.position > 0;

    if (touchLower) {
      const qty = Math.floor((account.balance * Number(orderSize) / 100) / bar.close * 100) / 100;
      return qty > 0 ? { action: 'BUY', size: qty } : null;
    }
    if (touchUpper) return { action: 'SELL', size: this.position };
    return null;
  }
}

// ─── STRATEGY 5: EMA Trend Follower ──────────────────────────────────────────
export class EMATrend extends Strategy {
  onBar(bar, account) {
    this._push(bar);
    const { ema1 = 8, ema2 = 21, ema3 = 55, orderSize = 1 } = this.parameters;
    const closes = this._closes;
    const maxPeriod = Math.max(Number(ema1), Number(ema2), Number(ema3));
    if (closes.length < maxPeriod + 2) return null;

    const e1 = ema(closes, Number(ema1));
    const e2 = ema(closes, Number(ema2));
    const e3 = ema(closes, Number(ema3));
    const i = closes.length - 1;

    const aligned_bull = e1[i] > e2[i] && e2[i] > e3[i];
    const aligned_bear = e1[i] < e2[i] && e2[i] < e3[i];

    const wasAligned_bull = e1[i-1] > e2[i-1] && e2[i-1] > e3[i-1];

    if (aligned_bull && !wasAligned_bull && this.position === 0) {
      const qty = Math.floor((account.balance * Number(orderSize) / 100) / bar.close * 100) / 100;
      return qty > 0 ? { action: 'BUY', size: qty } : null;
    }
    if (aligned_bear && this.position > 0) return { action: 'SELL', size: this.position };
    return null;
  }
}

// ─── STRATEGY REGISTRY ────────────────────────────────────────────────────────
export const STRATEGY_REGISTRY = [
  {
    id: 'ma_crossover',
    label: 'MA Crossover',
    description: 'Buys when fast EMA crosses above slow EMA; sells on the reverse cross.',
    color: '#38bdf8',
    Class: MACrossover,
    defaultParams: { fastPeriod: 9, slowPeriod: 21, orderSize: 5 },
    paramDefs: [
      { key: 'fastPeriod', label: 'Fast EMA Period',  type: 'number', min: 2,   max: 50,  step: 1 },
      { key: 'slowPeriod', label: 'Slow EMA Period',  type: 'number', min: 5,   max: 200, step: 1 },
      { key: 'orderSize',  label: 'Order Size (%)',    type: 'number', min: 0.5, max: 100, step: 0.5 },
    ],
  },
  {
    id: 'rsi',
    label: 'RSI Reversal',
    description: 'Buys when RSI crosses back above the oversold level; sells at overbought.',
    color: '#facc15',
    Class: RSIStrategy,
    defaultParams: { period: 14, oversold: 30, overbought: 70, orderSize: 5 },
    paramDefs: [
      { key: 'period',     label: 'RSI Period',        type: 'number', min: 2,  max: 50,  step: 1 },
      { key: 'oversold',   label: 'Oversold Level',    type: 'number', min: 5,  max: 45,  step: 1 },
      { key: 'overbought', label: 'Overbought Level',  type: 'number', min: 55, max: 95,  step: 1 },
      { key: 'orderSize',  label: 'Order Size (%)',     type: 'number', min: 0.5, max: 100, step: 0.5 },
    ],
  },
  {
    id: 'macd',
    label: 'MACD Signal',
    description: 'Enters long on MACD line bullish crossover; exits on bearish crossover.',
    color: '#a78bfa',
    Class: MACDStrategy,
    defaultParams: { fast: 12, slow: 26, signal: 9, orderSize: 5 },
    paramDefs: [
      { key: 'fast',      label: 'Fast EMA',    type: 'number', min: 2,  max: 50,  step: 1 },
      { key: 'slow',      label: 'Slow EMA',    type: 'number', min: 5,  max: 200, step: 1 },
      { key: 'signal',    label: 'Signal EMA',  type: 'number', min: 2,  max: 50,  step: 1 },
      { key: 'orderSize', label: 'Order Size (%)', type: 'number', min: 0.5, max: 100, step: 0.5 },
    ],
  },
  {
    id: 'bollinger',
    label: 'Bollinger Bounce',
    description: 'Buys when price bounces off the lower band; sells at the upper band.',
    color: '#34d399',
    Class: BollingerBounce,
    defaultParams: { period: 20, multiplier: 2, orderSize: 5 },
    paramDefs: [
      { key: 'period',     label: 'BB Period',      type: 'number', min: 5,   max: 100, step: 1 },
      { key: 'multiplier', label: 'Std Multiplier', type: 'number', min: 0.5, max: 5,   step: 0.25 },
      { key: 'orderSize',  label: 'Order Size (%)',  type: 'number', min: 0.5, max: 100, step: 0.5 },
    ],
  },
  {
    id: 'ema_trend',
    label: 'EMA Trend',
    description: 'Enters when 3 EMAs align bullishly (8>21>55); exits on bearish alignment.',
    color: '#f97316',
    Class: EMATrend,
    defaultParams: { ema1: 8, ema2: 21, ema3: 55, orderSize: 5 },
    paramDefs: [
      { key: 'ema1',      label: 'EMA 1 (Fast)',   type: 'number', min: 2,  max: 50,  step: 1 },
      { key: 'ema2',      label: 'EMA 2 (Mid)',    type: 'number', min: 5,  max: 100, step: 1 },
      { key: 'ema3',      label: 'EMA 3 (Slow)',   type: 'number', min: 10, max: 200, step: 1 },
      { key: 'orderSize', label: 'Order Size (%)', type: 'number', min: 0.5, max: 100, step: 0.5 },
    ],
  },
];
