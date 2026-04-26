/**
 * currencyService.js
 * ------------------
 * Fetches live exchange rates (base = INR) from Yahoo Finance.
 * Falls back to ExchangeRate-API if EXCHANGERATE_API_KEY is set.
 * Caches for 1 hour and returns stale data on any error.
 */

import axios from 'axios';

// ---------------------------------------------------------------------------
// Supported currencies and their Yahoo Finance ticker pairs (vs USD)
// We fetch each pair vs USD then derive the INR rate via USDINR.
// ---------------------------------------------------------------------------
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'JPY', 'GBP', 'AED', 'SGD', 'CAD', 'AUD', 'CHF'];

// Yahoo Finance tickers → each pair is CURRENCY=X (USD-based)
const YAHOO_FX_SYMBOLS = SUPPORTED_CURRENCIES.map((c) => `${c}=X`);

// Hard-coded fallback rates (vs INR) — used only when all APIs fail
const FALLBACK_RATES = {
  USD: 83.5,
  EUR: 90.2,
  JPY: 0.56,
  GBP: 105.8,
  AED: 22.73,
  SGD: 62.1,
  CAD: 61.5,
  AUD: 54.8,
  CHF: 94.2,
};

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------
let ratesCache = {
  /** rates[currency] = how many of that currency == 1 INR (i.e. INR→X rate) */
  rates: buildFallback(),
  fetchedAt: 0,
  stale: true,
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function buildFallback() {
  /** Convert FALLBACK_RATES (INR per 1 unit) → inverse (units per 1 INR) */
  const out = { INR: 1 };
  for (const [cur, inrPer1Unit] of Object.entries(FALLBACK_RATES)) {
    out[cur] = 1 / inrPer1Unit;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fetch from Yahoo Finance (free, no key needed)
// ---------------------------------------------------------------------------
const axiosYahoo = axios.create({
  timeout: 12000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; TradingEra/2.0)',
    Accept: 'application/json',
  },
});

async function fetchFromYahoo() {
  // Yahoo Finance v7 now returns 401. Use fawazahmed0 CDN as primary (truly free, no key).
  const { data } = await axios.get(
    'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/inr.json',
    { timeout: 10000 }
  );

  const inrRates = data?.inr;
  if (!inrRates) throw new Error('fawazahmed0 returned empty rates');

  const rates = { INR: 1 };
  for (const cur of SUPPORTED_CURRENCIES) {
    const val = inrRates[cur.toLowerCase()];
    if (val && val > 0) rates[cur] = +val; // already INR-based: 1 INR = X of currency
  }

  if (!rates.USD || rates.USD < 0.001) throw new Error(`Suspicious USD rate: ${rates.USD}`);
  return rates;
}

// ---------------------------------------------------------------------------
// Fetch from ExchangeRate-API (optional, key-based)
// ---------------------------------------------------------------------------
async function fetchFromExchangeRateApi() {
  const key = process.env.EXCHANGERATE_API_KEY;
  if (!key) return null;

  const { data } = await axios.get(`https://v6.exchangerate-api.com/v6/${key}/latest/INR`, {
    timeout: 12000,
  });

  if (data?.result !== 'success') return null;

  const convRates = data.conversion_rates || {};
  const rates = { INR: 1 };
  for (const cur of SUPPORTED_CURRENCIES) {
    if (convRates[cur]) rates[cur] = convRates[cur]; // already INR-based
  }
  return rates;
}

// ---------------------------------------------------------------------------
// Fetch from Open Exchange Rates (Free, no key)
// ---------------------------------------------------------------------------
async function fetchFromExchangeRateHost() {
  try {
    // Note: exchangerate.host now requires an API key, so we use open.er-api.com instead which is truly free.
    const { data } = await axios.get('https://open.er-api.com/v6/latest/INR', {
      timeout: 12000,
    });
    
    if (!data?.rates) return null;
    
    const convRates = data.rates || {};
    const rates = { INR: 1 };
    for (const cur of SUPPORTED_CURRENCIES) {
      if (convRates[cur]) rates[cur] = convRates[cur];
    }
    return rates;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns cached exchange rates (base: INR).
 * rates[currency] = how many of that currency per 1 INR.
 * Example: rates.USD ≈ 0.012  (1 INR ≈ 0.012 USD)
 */
export async function getExchangeRates() {
  const now = Date.now();
  if (!ratesCache.stale && now - ratesCache.fetchedAt < CACHE_TTL_MS) {
    return { rates: ratesCache.rates, stale: false, source: 'cache' };
  }

  try {
    // Try ExchangeRate-API first (more reliable when key exists)
    let rates = null;
    try {
      rates = await fetchFromExchangeRateApi();
    } catch (e) {}

    // Try recommended free ExchangeRate.host next
    if (!rates) {
      rates = await fetchFromExchangeRateHost();
    }

    // Try Yahoo Finance fallback
    if (!rates) rates = await fetchFromYahoo();

    ratesCache = { rates, fetchedAt: now, stale: false };
    console.log('[currency] Rates refreshed ✓', Object.keys(rates).join(', '));
    return { rates, stale: false, source: 'live' };
  } catch (err) {
    console.warn('[currency] Rate fetch failed, using cached/fallback:', err.message);
    // Keep existing cache (stale) rather than breaking the app
    return { rates: ratesCache.rates, stale: true, source: 'fallback' };
  }
}

/**
 * Convert an INR amount to a target currency.
 * @param {number} amountInr
 * @param {string} toCurrency  e.g. 'USD', 'EUR', 'INR'
 * @returns {{ value: number, currency: string, stale: boolean }}
 */
export async function convertFromInr(amountInr, toCurrency = 'INR') {
  const { rates, stale } = await getExchangeRates();
  const cur = String(toCurrency).toUpperCase();

  if (cur === 'INR') return { value: amountInr, currency: 'INR', stale };

  const rate = rates[cur];
  if (!rate) {
    return { value: amountInr, currency: 'INR', stale: true, error: `Unknown currency: ${cur}` };
  }

  return { value: amountInr * rate, currency: cur, stale };
}

/**
 * Metadata about each supported currency for the frontend.
 */
export const CURRENCY_META = {
  INR: { symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳', locale: 'en-IN' },
  USD: { symbol: '$', name: 'US Dollar', flag: '🇺🇸', locale: 'en-US' },
  EUR: { symbol: '€', name: 'Euro', flag: '🇪🇺', locale: 'de-DE' },
  JPY: { symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵', locale: 'ja-JP' },
  GBP: { symbol: '£', name: 'British Pound', flag: '🇬🇧', locale: 'en-GB' },
  AED: { symbol: 'د.إ', name: 'UAE Dirham', flag: '🇦🇪', locale: 'ar-AE' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬', locale: 'en-SG' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦', locale: 'en-CA' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺', locale: 'en-AU' },
  CHF: { symbol: 'Fr', name: 'Swiss Franc', flag: '🇨🇭', locale: 'de-CH' },
};

export const SUPPORTED_CURRENCY_CODES = ['INR', ...SUPPORTED_CURRENCIES];
