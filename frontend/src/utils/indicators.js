/** Simple moving average */
export function sma(values, period) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let s = 0;
    for (let j = 0; j < period; j++) s += values[i - j];
    out.push(s / period);
  }
  return out;
}

export function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (prev == null) {
      prev = v;
      out.push(i < period - 1 ? null : prev);
      continue;
    }
    prev = v * k + prev * (1 - k);
    out.push(i < period - 1 ? null : prev);
  }
  return out;
}

export function rsi(closes, period = 14) {
  const out = closes.map(() => null);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gains += ch;
    else losses -= ch;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period; i < closes.length; i++) {
    if (i > period) {
      const ch = closes[i] - closes[i - 1];
      const g = ch > 0 ? ch : 0;
      const l = ch < 0 ? -ch : 0;
      avgGain = (avgGain * (period - 1) + g) / period;
      avgLoss = (avgLoss * (period - 1) + l) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out[i] = 100 - 100 / (1 + rs);
  }
  return out;
}

export function macd(closes, fast = 12, slow = 26, signal = 9) {
  const ef = ema(closes, fast).map((v) => v ?? 0);
  const es = ema(closes, slow).map((v) => v ?? 0);
  const line = closes.map((_, i) => ef[i] - es[i]);
  const sig = ema(line, signal);
  const hist = line.map((v, i) => v - (sig[i] ?? 0));
  return { macdLine: line, signalLine: sig, histogram: hist };
}
