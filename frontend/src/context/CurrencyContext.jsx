/**
 * CurrencyContext.jsx
 * -------------------
 * Global currency state for TradingEra.
 *
 * - Fetches live exchange rates from /api/currency/rates on mount (base: INR)
 * - Persists selected currency in localStorage (key: te_currency)
 * - Auto-detects default currency from browser locale on first visit
 * - Provides convert(amountInr) and fmt(amountInr) helpers
 * - Refreshes rates every 60 minutes automatically
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { api } from '../services/api.js';

// ---------------------------------------------------------------------------
// Fallback rates (INR → X) — used before the first successful API call
// ---------------------------------------------------------------------------
const FALLBACK_RATES = {
  INR: 1,
  USD: 1 / 83.5,
  EUR: 1 / 90.2,
  JPY: 1 / 0.56,
  GBP: 1 / 105.8,
  AED: 1 / 22.73,
  SGD: 1 / 62.1,
  CAD: 1 / 61.5,
  AUD: 1 / 54.8,
  CHF: 1 / 94.2,
};

// ---------------------------------------------------------------------------
// Currency metadata (mirrors backend CURRENCY_META)
// ---------------------------------------------------------------------------
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

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_META);

// ---------------------------------------------------------------------------
// Detect default currency from browser locale
// ---------------------------------------------------------------------------
function detectDefaultCurrency() {
  try {
    const locale = navigator.language || 'en-US';
    // Map common locales to currencies
    const localeCurrencyMap = {
      'en-IN': 'INR', 'hi-IN': 'INR', 'mr-IN': 'INR',
      'en-US': 'USD', 'en': 'USD',
      'de-DE': 'EUR', 'fr-FR': 'EUR', 'es-ES': 'EUR', 'it-IT': 'EUR',
      'pt-PT': 'EUR', 'nl-NL': 'EUR',
      'ja-JP': 'JPY',
      'en-GB': 'GBP',
      'ar-AE': 'AED',
      'en-SG': 'SGD',
      'en-CA': 'CAD',
      'en-AU': 'AUD',
      'de-CH': 'CHF', 'fr-CH': 'CHF',
    };

    // Try exact match first, then language prefix
    const exact = localeCurrencyMap[locale];
    if (exact) return exact;
    const prefix = locale.split('-')[0];
    const byPrefix = localeCurrencyMap[prefix];
    if (byPrefix) return byPrefix;
  } catch {
    // ignore
  }
  return 'INR'; // safe default
}

const STORAGE_KEY = 'te_currency';
const RATES_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  // Load saved currency or auto-detect
  const [currency, setCurrencyState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_CURRENCIES.includes(saved)) return saved;
    return detectDefaultCurrency();
  });

  const [rates, setRates] = useState(FALLBACK_RATES);
  const [ratesStale, setRatesStale] = useState(true);
  const [ratesLoading, setRatesLoading] = useState(true);
  const lastFetchRef = useRef(0);

  // Persist currency preference
  const setCurrency = useCallback((code) => {
    if (!SUPPORTED_CURRENCIES.includes(code)) return;
    setCurrencyState(code);
    localStorage.setItem(STORAGE_KEY, code);
  }, []);

  // Fetch live rates
  const fetchRates = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchRef.current < RATES_TTL_MS) return;
    try {
      const { data } = await api.get('/api/currency/rates');
      if (data?.rates) {
        setRates(data.rates);
        setRatesStale(data.stale ?? false);
        lastFetchRef.current = now;
      }
    } catch (err) {
      console.warn('[CurrencyContext] Rate fetch failed, using fallback:', err.message);
      setRatesStale(true);
    } finally {
      setRatesLoading(false);
    }
  }, []);

  // Initial fetch + hourly refresh
  useEffect(() => {
    fetchRates(true);
    const interval = setInterval(() => fetchRates(true), RATES_TTL_MS);
    return () => clearInterval(interval);
  }, [fetchRates]);

  /**
   * Convert an INR amount to the currently selected currency.
   * @param {number} amountInr
   * @returns {number}
   */
  const convert = useCallback(
    (amountInr) => {
      if (amountInr == null || Number.isNaN(Number(amountInr))) return 0;
      const rate = rates[currency] ?? (FALLBACK_RATES[currency] || 1);
      return Number(amountInr) * rate;
    },
    [rates, currency]
  );

  /**
   * Format an INR amount as the selected currency string using Intl.
   * e.g. fmt(100000) → "₹1,00,000" (INR) or "$1,197.60" (USD)
   * @param {number} amountInr
   * @returns {string}
   */
  const fmt = useCallback(
    (amountInr) => {
      if (amountInr == null || Number.isNaN(Number(amountInr))) return '—';
      const value = convert(amountInr);
      const meta = CURRENCY_META[currency];
      try {
        return new Intl.NumberFormat(meta?.locale ?? undefined, {
          style: 'currency',
          currency,
          maximumFractionDigits: currency === 'JPY' ? 0 : Math.abs(value) >= 100 ? 0 : 2,
          minimumFractionDigits: 0,
        }).format(value);
      } catch {
        // Fallback if Intl doesn't support the currency
        return `${meta?.symbol ?? currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
      }
    },
    [convert, currency]
  );

  /**
   * Get just the currency symbol for the currently selected currency.
   */
  const symbol = CURRENCY_META[currency]?.symbol ?? currency;

  const value = useMemo(
    () => ({
      currency,
      setCurrency,
      rates,
      ratesStale,
      ratesLoading,
      convert,
      fmt,
      symbol,
      meta: CURRENCY_META[currency],
      allMeta: CURRENCY_META,
      supported: SUPPORTED_CURRENCIES,
      refreshRates: () => fetchRates(true),
    }),
    [currency, setCurrency, rates, ratesStale, ratesLoading, convert, fmt, symbol, fetchRates]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
