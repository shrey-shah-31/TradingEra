import {
  fetch24hTickers,
  fetchHistoryUnified,
  searchSymbols,
  DEFAULT_SYMBOLS,
  fetchIndianQuotes,
  fetchAllIndianQuotes,
  fetchIndianStockPrice,
  DEFAULT_NSE_SYMBOLS,
  searchIndianStocks,
  fetchUsdInrRate,
  NSE_UNIVERSE,
} from '../services/marketService.js';
import { getNseStatus } from '../utils/nseCalendar.js';
import { normalizeNseSymbol } from '../utils/assetContext.js';

export async function prices(req, res, next) {
  try {
    const symbols = req.query.symbols
      ? String(req.query.symbols)
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : DEFAULT_SYMBOLS;
    const normalized = symbols.map((s) => (s.endsWith('USDT') ? s : `${s}USDT`));
    const { data, demo } = await fetch24hTickers(normalized);
    res.json({ tickers: data, demo });
  } catch (e) {
    next(e);
  }
}

export async function history(req, res, next) {
  try {
    const symbol = req.query.symbol || 'BTC';
    const interval = req.query.interval || '1h';
    const limit = Math.min(Number(req.query.limit) || 500, 1000);
    const assetType = req.query.assetType === 'STOCK' ? 'STOCK' : 'CRYPTO';
    const result = await fetchHistoryUnified(symbol, assetType, interval, limit);
    const nse = getNseStatus();
    res.json({ ...result, nse });
  } catch (e) {
    next(e);
  }
}

export async function search(req, res, next) {
  try {
    const q = req.query.q || '';
    const scope = req.query.scope || 'crypto';
    if (scope === 'stock') {
      const { results } = searchIndianStocks(q, 40);
      return res.json({ results, scope: 'stock' });
    }
    if (scope === 'all') {
      const [c, s] = await Promise.all([searchSymbols(q, 20), Promise.resolve(searchIndianStocks(q, 20))]);
      return res.json({
        crypto: c.results.map((x) => ({ symbol: x, type: 'CRYPTO' })),
        stocks: s.results.map((x) => ({ ...x, type: 'STOCK' })),
        scope: 'all',
      });
    }
    const { results } = await searchSymbols(q, 40);
    res.json({ results, scope: 'crypto' });
  } catch (e) {
    next(e);
  }
}

export async function movers(req, res, next) {
  try {
    const { data, demo } = await fetch24hTickers(DEFAULT_SYMBOLS);
    const mapped = data.map((t) => ({
      symbol: t.symbol,
      price: +t.lastPrice,
      changePct: +t.priceChangePercent,
      volume: +t.quoteVolume,
    }));
    const sorted = [...mapped].sort((a, b) => b.changePct - a.changePct);
    const gainers = sorted.slice(0, 8);
    const losers = [...mapped].sort((a, b) => a.changePct - b.changePct).slice(0, 8);
    const trending = [...mapped].sort((a, b) => b.volume - a.volume).slice(0, 8);
    res.json({ gainers, losers, trending, demo });
  } catch (e) {
    next(e);
  }
}

/** GET /api/market/indian-stocks */
export async function indianStocks(req, res, next) {
  try {
    const { quotes, demo } = await fetchIndianQuotes(DEFAULT_NSE_SYMBOLS);
    const nse = getNseStatus();
    const { rate: usdInr, demo: fxDemo } = await fetchUsdInrRate();
    res.json({
      stocks: quotes,
      demo: demo || fxDemo,
      nse,
      usdInr,
    });
  } catch (e) {
    next(e);
  }
}

/** GET /api/market/indian-stocks/all — full universe with live prices */
export async function allIndianStocks(req, res, next) {
  try {
    const { stocks, demo, total } = await fetchAllIndianQuotes();
    const nse = getNseStatus();
    const { rate: usdInr } = await fetchUsdInrRate();
    res.json({ stocks, demo, total, nse, usdInr });
  } catch (e) {
    next(e);
  }
}

/** GET /api/market/indian-stocks/list — symbol+name list only (no live prices, instant) */
export async function indianStocksList(req, res) {
  res.json({
    stocks: NSE_UNIVERSE.map((s) => ({ symbol: s.symbol, name: s.name })),
    total: NSE_UNIVERSE.length,
  });
}

/** GET /api/market/stock/:symbol */
export async function stockBySymbol(req, res, next) {
  try {
    const raw = req.params.symbol || req.query.symbol;
    if (!raw) return res.status(400).json({ message: 'symbol required' });
    const sym = normalizeNseSymbol(raw);
    const { price, demo } = await fetchIndianStockPrice(sym);
    const nse = getNseStatus();
    res.json({ symbol: sym, price, currency: 'INR', demo, nse });
  } catch (e) {
    next(e);
  }
}
