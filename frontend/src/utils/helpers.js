import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatInr(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

/**
 * Format a value in any currency using Intl.NumberFormat.
 * @param {number} value — Already converted to target currency
 * @param {string} currency — e.g. 'USD', 'EUR', 'INR'
 * @param {string} [locale] — BCP 47 locale string
 */
export function formatCurrency(value, currency = 'INR', locale) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  try {
    return new Intl.NumberFormat(locale ?? undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'JPY' ? 0 : Math.abs(value) >= 100 ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
}


export function formatPct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

/**
 * Approximate portfolio equity over time: cash + Σ qty×lastMarkPrice per asset.
 */
export function buildEquitySeries(transactions, initialCash = 100_000) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const qtyBy = {};
  const lastPrice = {};
  let cash = initialCash;
  const startT = Math.floor(Date.now() / 1000) - 86400 * 30;
  const points = [{ time: startT, value: initialCash }];

  for (const tx of sorted) {
    const t = Math.floor(new Date(tx.createdAt).getTime() / 1000);
    lastPrice[tx.asset] = tx.price;
    if (tx.type === 'BUY') {
      cash -= tx.total;
      qtyBy[tx.asset] = (qtyBy[tx.asset] || 0) + tx.quantity;
    } else {
      cash += tx.total;
      qtyBy[tx.asset] = (qtyBy[tx.asset] || 0) - tx.quantity;
    }
    let hv = 0;
    for (const [sym, q] of Object.entries(qtyBy)) {
      if (q > 0) hv += q * (lastPrice[sym] ?? 0);
    }
    points.push({ time: t, value: cash + hv });
  }

  points.push({
    time: Math.floor(Date.now() / 1000),
    value: points[points.length - 1]?.value ?? initialCash,
  });
  return points;
}
