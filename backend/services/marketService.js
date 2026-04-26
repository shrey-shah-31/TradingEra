import axios from 'axios';
import { normalizeNseSymbol } from '../utils/assetContext.js';

const BINANCE  = 'https://api.binance.com';
const YQ1_BASE = 'https://query1.finance.yahoo.com';
const YAHOO_CHART = `${YQ1_BASE}/v8/finance/chart`;

// ── Yahoo Finance v8 chart headers (no crumb needed) ─────────────────────────
const YF_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Fetch a single NSE symbol quote via Yahoo Finance v8 chart (no auth needed).
 * Uses range:'5d' to get enough candles to compute accurate day-over-day change.
 */
async function fetchYahooChartQuote(symbol) {
  const { data } = await axios.get(`${YAHOO_CHART}/${encodeURIComponent(symbol)}`, {
    params: { interval: '1d', range: '5d' },
    headers: YF_HEADERS,
    timeout: 15000,
  });
  const result = data?.chart?.result?.[0];
  const meta = result?.meta || {};
  const ts = result?.timestamp || [];
  const quotes = result?.indicators?.quote?.[0] || {};

  const price = meta.regularMarketPrice ?? null;

  // Compute changePct from actual previous trading day close (second-to-last candle)
  // This is more accurate than chartPreviousClose which can be stale
  let changePct = 0;
  if (price != null && ts.length >= 2) {
    // Find the last valid close (previous trading day)
    let prevClose = null;
    for (let i = ts.length - 2; i >= 0; i--) {
      const c = quotes.close?.[i];
      if (c != null && c > 0) { prevClose = c; break; }
    }
    if (prevClose != null && prevClose > 0) {
      changePct = ((price - prevClose) / prevClose) * 100;
    }
  } else if (price != null && meta.chartPreviousClose != null && meta.chartPreviousClose > 0) {
    changePct = ((price - meta.chartPreviousClose) / meta.chartPreviousClose) * 100;
  }

  return {
    symbol,
    shortName: meta.shortName || symbol.replace('.NS', ''),
    longName: meta.longName || null,
    price,
    changePct,
    high: meta.regularMarketDayHigh ?? null,
    low: meta.regularMarketDayLow ?? null,
    volume: meta.regularMarketVolume ?? 0,
    currency: meta.currency || 'INR',
    marketState: meta.marketState || null,
  };
}

/** Default movers snapshot (top 10 by market cap) */
export const DEFAULT_NSE_SYMBOLS = [
  'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS',
  'HINDUNILVR.NS', 'ITC.NS', 'SBIN.NS', 'BHARTIARTL.NS', 'KOTAKBANK.NS',
];

/**
 * Comprehensive NSE universe — Nifty 50 + Nifty Next 50 + popular Midcaps.
 * ~200 symbols for a full Indian market view.
 */
export const NSE_UNIVERSE = [
  // ── Nifty 50 ──────────────────────────────────────────────────────────────
  { symbol: 'RELIANCE.NS',     name: 'Reliance Industries Ltd' },
  { symbol: 'TCS.NS',          name: 'Tata Consultancy Services Ltd' },
  { symbol: 'HDFCBANK.NS',     name: 'HDFC Bank Ltd' },
  { symbol: 'BHARTIARTL.NS',   name: 'Bharti Airtel Ltd' },
  { symbol: 'ICICIBANK.NS',    name: 'ICICI Bank Ltd' },
  { symbol: 'INFY.NS',         name: 'Infosys Ltd' },
  { symbol: 'SBIN.NS',         name: 'State Bank of India' },
  { symbol: 'HINDUNILVR.NS',   name: 'Hindustan Unilever Ltd' },
  { symbol: 'ITC.NS',          name: 'ITC Ltd' },
  { symbol: 'KOTAKBANK.NS',    name: 'Kotak Mahindra Bank Ltd' },
  { symbol: 'LT.NS',           name: 'Larsen & Toubro Ltd' },
  { symbol: 'AXISBANK.NS',     name: 'Axis Bank Ltd' },
  { symbol: 'BAJFINANCE.NS',   name: 'Bajaj Finance Ltd' },
  { symbol: 'ASIANPAINT.NS',   name: 'Asian Paints Ltd' },
  { symbol: 'MARUTI.NS',       name: 'Maruti Suzuki India Ltd' },
  { symbol: 'WIPRO.NS',        name: 'Wipro Ltd' },
  { symbol: 'HCLTECH.NS',      name: 'HCL Technologies Ltd' },
  { symbol: 'SUNPHARMA.NS',    name: 'Sun Pharmaceutical Industries Ltd' },
  { symbol: 'TITAN.NS',        name: 'Titan Company Ltd' },
  { symbol: 'ULTRACEMCO.NS',   name: 'UltraTech Cement Ltd' },
  { symbol: 'ONGC.NS',         name: 'Oil & Natural Gas Corporation Ltd' },
  { symbol: 'NTPC.NS',         name: 'NTPC Ltd' },
  { symbol: 'POWERGRID.NS',    name: 'Power Grid Corporation of India Ltd' },
  { symbol: 'M&M.NS',          name: 'Mahindra & Mahindra Ltd' },
  { symbol: 'TECHM.NS',        name: 'Tech Mahindra Ltd' },
  { symbol: 'HINDALCO.NS',     name: 'Hindalco Industries Ltd' },
  { symbol: 'ADANIENT.NS',     name: 'Adani Enterprises Ltd' },
  { symbol: 'ADANIPORTS.NS',   name: 'Adani Ports & SEZ Ltd' },
  { symbol: 'TATAMOTORS.NS',   name: 'Tata Motors Ltd' },
  { symbol: 'TATASTEEL.NS',    name: 'Tata Steel Ltd' },
  { symbol: 'INDUSINDBK.NS',   name: 'IndusInd Bank Ltd' },
  { symbol: 'JSWSTEEL.NS',     name: 'JSW Steel Ltd' },
  { symbol: 'COALINDIA.NS',    name: 'Coal India Ltd' },
  { symbol: 'BAJAJFINSV.NS',   name: 'Bajaj Finserv Ltd' },
  { symbol: 'BAJAJ-AUTO.NS',   name: 'Bajaj Auto Ltd' },
  { symbol: 'NESTLEIND.NS',    name: 'Nestle India Ltd' },
  { symbol: 'BRITANNIA.NS',    name: 'Britannia Industries Ltd' },
  { symbol: 'CIPLA.NS',        name: 'Cipla Ltd' },
  { symbol: 'DRREDDY.NS',      name: "Dr Reddy's Laboratories Ltd" },
  { symbol: 'EICHERMOT.NS',    name: 'Eicher Motors Ltd' },
  { symbol: 'GRASIM.NS',       name: 'Grasim Industries Ltd' },
  { symbol: 'HEROMOTOCO.NS',   name: 'Hero MotoCorp Ltd' },
  { symbol: 'DIVISLAB.NS',     name: "Divi's Laboratories Ltd" },
  { symbol: 'APOLLOHOSP.NS',   name: 'Apollo Hospitals Enterprise Ltd' },
  { symbol: 'TATACONSUM.NS',   name: 'Tata Consumer Products Ltd' },
  { symbol: 'BPCL.NS',         name: 'Bharat Petroleum Corporation Ltd' },
  { symbol: 'SBILIFE.NS',      name: 'SBI Life Insurance Company Ltd' },
  { symbol: 'HDFCLIFE.NS',     name: 'HDFC Life Insurance Company Ltd' },
  { symbol: 'SHRIRAMFIN.NS',   name: 'Shriram Finance Ltd' },
  { symbol: 'BEL.NS',          name: 'Bharat Electronics Ltd' },
  // ── Nifty Next 50 ─────────────────────────────────────────────────────────
  { symbol: 'ADANIGREEN.NS',   name: 'Adani Green Energy Ltd' },
  { symbol: 'ADANIPOWER.NS',   name: 'Adani Power Ltd' },
  { symbol: 'AMBUJACEM.NS',    name: 'Ambuja Cements Ltd' },
  { symbol: 'AUROPHARMA.NS',   name: 'Aurobindo Pharma Ltd' },
  { symbol: 'BANDHANBNK.NS',   name: 'Bandhan Bank Ltd' },
  { symbol: 'BERGEPAINT.NS',   name: 'Berger Paints India Ltd' },
  { symbol: 'BIOCON.NS',       name: 'Biocon Ltd' },
  { symbol: 'BOSCHLTD.NS',     name: 'Bosch Ltd' },
  { symbol: 'CANBK.NS',        name: 'Canara Bank' },
  { symbol: 'CHOLAFIN.NS',     name: 'Cholamandalam Investment & Finance Co Ltd' },
  { symbol: 'COLPAL.NS',       name: 'Colgate-Palmolive (India) Ltd' },
  { symbol: 'CONCOR.NS',       name: 'Container Corporation of India Ltd' },
  { symbol: 'DABUR.NS',        name: 'Dabur India Ltd' },
  { symbol: 'DLF.NS',          name: 'DLF Ltd' },
  { symbol: 'FEDERALBNK.NS',   name: 'Federal Bank Ltd' },
  { symbol: 'GAIL.NS',         name: 'GAIL (India) Ltd' },
  { symbol: 'GODREJCP.NS',     name: 'Godrej Consumer Products Ltd' },
  { symbol: 'GODREJPROP.NS',   name: 'Godrej Properties Ltd' },
  { symbol: 'HAVELLS.NS',      name: 'Havells India Ltd' },
  { symbol: 'HDFCAMC.NS',      name: 'HDFC Asset Management Company Ltd' },
  { symbol: 'ICICIGI.NS',      name: 'ICICI Lombard General Insurance Co Ltd' },
  { symbol: 'ICICIPRULI.NS',   name: 'ICICI Prudential Life Insurance Co Ltd' },
  { symbol: 'INDUSTOWER.NS',   name: 'Indus Towers Ltd' },
  { symbol: 'IRCTC.NS',        name: 'Indian Railway Catering & Tourism Corp Ltd' },
  { symbol: 'LICI.NS',         name: 'Life Insurance Corporation of India' },
  { symbol: 'LTIM.NS',         name: 'LTIMindtree Ltd' },
  { symbol: 'LTTS.NS',         name: 'L&T Technology Services Ltd' },
  { symbol: 'LUPIN.NS',        name: 'Lupin Ltd' },
  { symbol: 'MFSL.NS',         name: 'Max Financial Services Ltd' },
  { symbol: 'MPHASIS.NS',      name: 'MphasiS Ltd' },
  { symbol: 'MUTHOOTFIN.NS',   name: 'Muthoot Finance Ltd' },
  { symbol: 'NAUKRI.NS',       name: 'Info Edge (India) Ltd' },
  { symbol: 'NMDC.NS',         name: 'NMDC Ltd' },
  { symbol: 'OFSS.NS',         name: 'Oracle Financial Services Software Ltd' },
  { symbol: 'PAGEIND.NS',      name: 'Page Industries Ltd' },
  { symbol: 'PERSISTENT.NS',   name: 'Persistent Systems Ltd' },
  { symbol: 'PETRONET.NS',     name: 'Petronet LNG Ltd' },
  { symbol: 'PIDILITIND.NS',   name: 'Pidilite Industries Ltd' },
  { symbol: 'PIIND.NS',        name: 'PI Industries Ltd' },
  { symbol: 'PNB.NS',          name: 'Punjab National Bank' },
  { symbol: 'SBICARD.NS',      name: 'SBI Cards and Payment Services Ltd' },
  { symbol: 'SIEMENS.NS',      name: 'Siemens Ltd' },
  { symbol: 'SRF.NS',          name: 'SRF Ltd' },
  { symbol: 'TATAPOWER.NS',    name: 'Tata Power Company Ltd' },
  { symbol: 'TORNTPHARM.NS',   name: 'Torrent Pharmaceuticals Ltd' },
  { symbol: 'TRENT.NS',        name: 'Trent Ltd' },
  { symbol: 'VEDL.NS',         name: 'Vedanta Ltd' },
  { symbol: 'VOLTAS.NS',       name: 'Voltas Ltd' },
  { symbol: 'ETERNAL.NS',      name: 'Zomato Ltd (Eternal)' },
  { symbol: 'ZYDUSLIFE.NS',    name: 'Zydus Lifesciences Ltd' },
  // ── Nifty Midcap Select ───────────────────────────────────────────────────
  { symbol: 'ABB.NS',          name: 'ABB India Ltd' },
  { symbol: 'ABCAPITAL.NS',    name: 'Aditya Birla Capital Ltd' },
  { symbol: 'ALKEM.NS',        name: 'Alkem Laboratories Ltd' },
  { symbol: 'ASHOKLEY.NS',     name: 'Ashok Leyland Ltd' },
  { symbol: 'ASTRAL.NS',       name: 'Astral Ltd' },
  { symbol: 'BALKRISIND.NS',   name: 'Balkrishna Industries Ltd' },
  { symbol: 'BATAINDIA.NS',    name: 'Bata India Ltd' },
  { symbol: 'BHEL.NS',         name: 'Bharat Heavy Electricals Ltd' },
  { symbol: 'CESC.NS',         name: 'CESC Ltd' },
  { symbol: 'CROMPTON.NS',     name: 'Crompton Greaves Consumer Electricals Ltd' },
  { symbol: 'CUMMINSIND.NS',   name: 'Cummins India Ltd' },
  { symbol: 'DEEPAKNI.NS',     name: 'Deepak Nitrite Ltd' },
  { symbol: 'ESCORTS.NS',      name: 'Escorts Kubota Ltd' },
  { symbol: 'EXIDEIND.NS',     name: 'Exide Industries Ltd' },
  { symbol: 'GMRAIRPORT.NS',   name: 'GMR Airports Infrastructure Ltd' },
  { symbol: 'HINDPETRO.NS',    name: 'Hindustan Petroleum Corporation Ltd' },
  { symbol: 'IDFCFIRSTB.NS',   name: 'IDFC First Bank Ltd' },
  { symbol: 'IEX.NS',          name: 'Indian Energy Exchange Ltd' },
  { symbol: 'IGL.NS',          name: 'Indraprastha Gas Ltd' },
  { symbol: 'INDIANB.NS',      name: 'Indian Bank' },
  { symbol: 'INDIGO.NS',       name: 'InterGlobe Aviation Ltd' },
  { symbol: 'IOC.NS',          name: 'Indian Oil Corporation Ltd' },
  { symbol: 'IPCALAB.NS',      name: 'Ipca Laboratories Ltd' },
  { symbol: 'IRFC.NS',         name: 'Indian Railway Finance Corporation Ltd' },
  { symbol: 'JSWENERGY.NS',    name: 'JSW Energy Ltd' },
  { symbol: 'JUBLFOOD.NS',     name: 'Jubilant FoodWorks Ltd' },
  { symbol: 'KAJARIACER.NS',   name: 'Kajaria Ceramics Ltd' },
  { symbol: 'LAURUSLABS.NS',   name: 'Laurus Labs Ltd' },
  { symbol: 'LICHSGFIN.NS',    name: 'LIC Housing Finance Ltd' },
  { symbol: 'LTF.NS',          name: 'L&T Finance Ltd' },
  { symbol: 'MARICO.NS',       name: 'Marico Ltd' },
  { symbol: 'MAXHEALTH.NS',    name: 'Max Healthcare Institute Ltd' },
  { symbol: 'MCX.NS',          name: 'Multi Commodity Exchange of India Ltd' },
  { symbol: 'MGL.NS',          name: 'Mahanagar Gas Ltd' },
  { symbol: 'MOTHERSON.NS',    name: 'Samvardhana Motherson International Ltd' },
  { symbol: 'OBEROIRLTY.NS',   name: 'Oberoi Realty Ltd' },
  { symbol: 'POLYCAB.NS',      name: 'Polycab India Ltd' },
  { symbol: 'RECLTD.NS',       name: 'REC Ltd' },
  { symbol: 'SAIL.NS',         name: 'Steel Authority of India Ltd' },
  { symbol: 'SONACOMS.NS',     name: 'Sona BLW Precision Forgings Ltd' },
  { symbol: 'SUNDARMFIN.NS',   name: 'Sundaram Finance Ltd' },
  { symbol: 'SUPREMEIND.NS',   name: 'Supreme Industries Ltd' },
  { symbol: 'TATACOMM.NS',     name: 'Tata Communications Ltd' },
  { symbol: 'TATACHEM.NS',     name: 'Tata Chemicals Ltd' },
  { symbol: 'TATAELXSI.NS',    name: 'Tata Elxsi Ltd' },
  { symbol: 'THERMAX.NS',      name: 'Thermax Ltd' },
  { symbol: 'TIINDIA.NS',      name: 'Tube Investments of India Ltd' },
  { symbol: 'TORNTPOWER.NS',   name: 'Torrent Power Ltd' },
  { symbol: 'UNIONBANK.NS',    name: 'Union Bank of India' },
  { symbol: 'UPL.NS',          name: 'UPL Ltd' },
  { symbol: 'VGUARD.NS',       name: 'V-Guard Industries Ltd' },
  { symbol: 'ZEEL.NS',         name: 'Zee Entertainment Enterprises Ltd' },
  // ── Additional Prominent Stocks ───────────────────────────────────────────
  { symbol: 'ANGELONE.NS',     name: 'Angel One Ltd' },
  { symbol: 'APLAPOLLO.NS',    name: 'APL Apollo Tubes Ltd' },
  { symbol: 'ATUL.NS',         name: 'Atul Ltd' },
  { symbol: 'BAJAJHLDNG.NS',   name: 'Bajaj Holdings & Investment Ltd' },
  { symbol: 'BSE.NS',          name: 'BSE Ltd' },
  { symbol: 'CDSL.NS',         name: 'Central Depository Services (India) Ltd' },
  { symbol: 'COFORGE.NS',      name: 'Coforge Ltd' },
  { symbol: 'DALBHARAT.NS',    name: 'Dalmia Bharat Ltd' },
  { symbol: 'EMAMILTD.NS',     name: 'Emami Ltd' },
  { symbol: 'FORTIS.NS',       name: 'Fortis Healthcare Ltd' },
  { symbol: 'GLENMARK.NS',     name: 'Glenmark Pharmaceuticals Ltd' },
  { symbol: 'GODREJIND.NS',    name: 'Godrej Industries Ltd' },
  { symbol: 'GUJGASLTD.NS',    name: 'Gujarat Gas Ltd' },
  { symbol: 'HAL.NS',          name: 'Hindustan Aeronautics Ltd' },
  { symbol: 'IDBI.NS',         name: 'IDBI Bank Ltd' },
  { symbol: 'IIFL.NS',         name: 'IIFL Finance Ltd' },
  { symbol: 'INDHOTEL.NS',     name: 'Indian Hotels Company Ltd' },
  { symbol: 'INTELLECT.NS',    name: 'Intellect Design Arena Ltd' },
  { symbol: 'JKCEMENT.NS',     name: 'JK Cement Ltd' },
  { symbol: 'JINDALSTEL.NS',   name: 'Jindal Steel & Power Ltd' },
  { symbol: 'JSWINFRA.NS',     name: 'JSW Infrastructure Ltd' },
  { symbol: 'KPITTECH.NS',     name: 'KPIT Technologies Ltd' },
  { symbol: 'LALPATHLAB.NS',   name: 'Dr Lal PathLabs Ltd' },
  { symbol: 'MANAPPURAM.NS',   name: 'Manappuram Finance Ltd' },
  { symbol: 'MAZDOCK.NS',      name: 'Mazagon Dock Shipbuilders Ltd' },
  { symbol: 'MEDANTA.NS',      name: 'Global Health Ltd' },
  { symbol: 'NYKAA.NS',        name: 'FSN E-Commerce Ventures Ltd (Nykaa)' },
  { symbol: 'PAYTM.NS',        name: 'One97 Communications Ltd (Paytm)' },
  { symbol: 'PVRINOX.NS',      name: 'PVR INOX Ltd' },
  { symbol: 'RAMCOCEM.NS',     name: 'Ramco Cements Ltd' },
  { symbol: 'RELAXO.NS',       name: 'Relaxo Footwears Ltd' },
  { symbol: 'RITES.NS',        name: 'RITES Ltd' },
  { symbol: 'STARHEALTH.NS',   name: 'Star Health and Allied Insurance Company Ltd' },
  { symbol: 'TVSMOTOR.NS',     name: 'TVS Motor Company Ltd' },
  { symbol: 'UJJIVANSFB.NS',   name: 'Ujjivan Small Finance Bank Ltd' },
  { symbol: 'WELCORP.NS',      name: 'Welspun Corp Ltd' },
];

/** Default watch universe for dashboard */
export const DEFAULT_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'AVAXUSDT',
];

let usdInrCache = { rate: 93, at: 0 };
const USD_INR_TTL_MS = 60_000;

/**
 * USD→INR for converting crypto USDT notionals to INR balance.
 * Tries multiple free APIs in order; Yahoo Finance is no longer reliable (returns 401).
 */
export async function fetchUsdInrRate() {
  const now = Date.now();
  if (now - usdInrCache.at < USD_INR_TTL_MS && usdInrCache.rate > 50) {
    return { ok: true, rate: usdInrCache.rate, demo: false };
  }

  // ── Source 1: fawazahmed0 CDN (truly free, ~daily) ────────────────────────
  try {
    const { data } = await axios.get(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
      { timeout: 8000 }
    );
    const rate = data?.usd?.inr;
    if (rate && rate > 70 && rate < 200) {
      usdInrCache = { rate: +rate, at: now };
      console.log('[market] USDINR (fawazahmed0):', rate);
      return { ok: true, rate: +rate, demo: false };
    }
  } catch (e) {
    console.warn('[market] fawazahmed0 USDINR failed:', e.message);
  }

  // ── Source 2: open.er-api.com (free, daily) ───────────────────────────────
  try {
    const { data } = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 8000 });
    const rate = data?.rates?.INR;
    if (rate && rate > 70 && rate < 200) {
      usdInrCache = { rate: +rate, at: now };
      console.log('[market] USDINR (open.er-api):', rate);
      return { ok: true, rate: +rate, demo: false };
    }
  } catch (e) {
    console.warn('[market] open.er-api USDINR failed:', e.message);
  }

  // ── Source 3: frankfurter.app (ECB data, free) ────────────────────────────
  try {
    const { data } = await axios.get('https://api.frankfurter.app/latest?from=USD&to=INR', { timeout: 8000 });
    const rate = data?.rates?.INR;
    if (rate && rate > 70 && rate < 200) {
      usdInrCache = { rate: +rate, at: now };
      console.log('[market] USDINR (frankfurter):', rate);
      return { ok: true, rate: +rate, demo: false };
    }
  } catch (e) {
    console.warn('[market] frankfurter USDINR failed:', e.message);
  }

  // ── Stale cache or hardcoded last-resort ─────────────────────────────────
  console.warn('[market] All USDINR sources failed; using stale/fallback:', usdInrCache.rate);
  return { ok: false, rate: usdInrCache.rate || 93, demo: true };
}

/**
 * Fetch 24h ticker stats from Binance. Returns { ok, data, demo }.
 */
export async function fetch24hTickers(symbols = DEFAULT_SYMBOLS) {
  try {
    const { data } = await axios.get(`${BINANCE}/api/v3/ticker/24hr`, { timeout: 12000 });
    const list = Array.isArray(data) ? data : [];
    const wanted = new Set(symbols.map((s) => s.toUpperCase()));
    const filtered = list.filter((t) => wanted.has(t.symbol));
    return { ok: true, data: filtered.length ? filtered : list.slice(0, 30), demo: false };
  } catch (e) {
    console.warn('[market] Binance ticker failed, using demo data:', e.message);
    return { ok: false, data: buildDemoTickers(symbols), demo: true };
  }
}

function buildDemoTickers(symbols) {
  return symbols.map((symbol) => {
    const price = 50_000 + Math.random() * 2000;
    const change = (Math.random() - 0.45) * 5;
    return {
      symbol,
      lastPrice: String(price),
      priceChangePercent: String(change.toFixed(2)),
      quoteVolume: String(1e8 * Math.random()),
      highPrice: String(price * 1.02),
      lowPrice: String(price * 0.98),
    };
  });
}

function buildDemoIndian(symbols) {
  return symbols.map((symbol) => {
    const price = 500 + Math.random() * 2000;
    const change = (Math.random() - 0.48) * 3;
    return {
      symbol,
      shortName: symbol.replace('.NS', ''),
      price,
      changePct: change,
      currency: 'INR',
    };
  });
}

/**
 * Yahoo quote batch for NSE symbols via v8 chart (parallel, no auth needed).
 */
export async function fetchIndianQuotes(symbols = DEFAULT_NSE_SYMBOLS) {
  const sym = symbols.map((s) => normalizeNseSymbol(s)).filter(Boolean);
  if (!sym.length) return { ok: false, quotes: [], demo: true };
  try {
    const results = await Promise.allSettled(sym.map(fetchYahooChartQuote));
    let anyFailed = false;
    const quotes = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      anyFailed = true;
      console.warn('[market] fetchIndianQuotes failed for', sym[i], r.reason?.message);
      return buildDemoIndian([sym[i]])[0];
    });
    return { ok: !anyFailed, quotes, demo: anyFailed };
  } catch (e) {
    console.warn('[market] Yahoo Indian quotes failed:', e.message);
    return { ok: false, quotes: buildDemoIndian(sym), demo: true };
  }
}

/**
 * Fetch live quotes for the ENTIRE NSE_UNIVERSE in parallel batches of 20.
 * Uses Yahoo Finance v8 chart API (no auth/crumb needed).
 * Returns { stocks, demo, total }
 */
export async function fetchAllIndianQuotes() {
  const allSymbols = NSE_UNIVERSE.map((s) => s.symbol);
  const BATCH = 20; // concurrent requests per wave
  const nameMap = Object.fromEntries(NSE_UNIVERSE.map((s) => [s.symbol, s.name]));

  // Split into chunks
  const chunks = [];
  for (let i = 0; i < allSymbols.length; i += BATCH) {
    chunks.push(allSymbols.slice(i, i + BATCH));
  }

  let anyDemo = false;
  const allQuotes = [];

  // Fetch each batch in parallel waves (sequential waves to avoid rate limits)
  for (let idx = 0; idx < chunks.length; idx++) {
    const chunk = chunks[idx];
    const results = await Promise.allSettled(chunk.map(fetchYahooChartQuote));

    results.forEach((r, i) => {
      const symbol = chunk[i];
      if (r.status === 'fulfilled' && r.value.price != null) {
        allQuotes.push({
          ...r.value,
          name: nameMap[symbol] || r.value.longName || r.value.shortName || symbol.replace('.NS', ''),
        });
      } else {
        // Symbol unavailable on Yahoo (404, redirect with no price, etc.) — skip it
        if (r.status === 'rejected') {
          console.warn('[market] Symbol', symbol, 'unavailable:', r.reason?.message);
        } else {
          console.warn('[market] Symbol', symbol, 'returned no price — skipping');
        }
      }
    });

    // Small delay between waves to be polite to Yahoo
    if (idx < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Sort by changePct desc
  allQuotes.sort((a, b) => (b.changePct || 0) - (a.changePct || 0));

  return { stocks: allQuotes, demo: false, total: allQuotes.length };
}

/**
 * Single NSE stock quote (INR).
 */
export async function fetchIndianStockPrice(symbol) {
  const sym = normalizeNseSymbol(symbol);
  const { quotes, demo } = await fetchIndianQuotes([sym]);
  const q = quotes[0];
  const price = q?.price;
  if (price == null || Number.isNaN(+price)) {
    const p = 1000 + Math.random() * 500;
    return { ok: false, price: p, symbol: sym, demo: true };
  }
  return { ok: true, price: +price, symbol: sym, demo };
}

/**
 * Historical chart for NSE via Yahoo v8 chart.
 */
const YAHOO_RANGE = {
  '1m': { interval: '1m', range: '1d' },
  '5m': { interval: '5m', range: '5d' },
  '15m': { interval: '15m', range: '1mo' },
  '1h': { interval: '1h', range: '3mo' },
  '1D': { interval: '1d', range: '2y' },
};

export async function fetchIndianHistory(symbol, interval = '1h') {
  const sym = normalizeNseSymbol(symbol);
  const cfg = YAHOO_RANGE[interval] || YAHOO_RANGE['1h'];
  try {
    const { data } = await axios.get(`${YAHOO_CHART}/${encodeURIComponent(sym)}`, {
      params: { interval: cfg.interval, range: cfg.range },
      headers: YF_HEADERS,
      timeout: 15000,
    });
    const result = data?.chart?.result?.[0];
    const ts = result?.timestamp || [];
    const q = result?.indicators?.quote?.[0] || {};
    const candles = [];
    for (let i = 0; i < ts.length; i++) {
      const o = q.open?.[i];
      const h = q.high?.[i];
      const low = q.low?.[i];
      const c = q.close?.[i];
      const v = q.volume?.[i];
      // Skip any candle with null/zero OHLC — these are gaps or incomplete bars
      if (o == null || c == null || h == null || low == null) continue;
      if (o <= 0 || c <= 0 || h <= 0 || low <= 0) continue;
      candles.push({
        time: ts[i],
        open: +o,
        high: +(h),
        low: +(low),
        close: +c,
        volume: +(v ?? 0),
      });
    }
    return { ok: true, symbol: sym, candles, demo: false };
  } catch (e) {
    console.warn('[market] Indian history failed:', e.message);
    return { ok: false, symbol: sym, candles: generateDemoStockCandles(200), demo: true };
  }
}

function generateDemoStockCandles(n) {
  const out = [];
  let t = Math.floor(Date.now() / 1000) - n * 3600;
  let p = 2500;
  for (let i = 0; i < n; i++) {
    t += 3600;
    const o = p;
    const c = o + (Math.random() - 0.5) * 20;
    const h = Math.max(o, c) + Math.random() * 10;
    const l = Math.min(o, c) - Math.random() * 10;
    out.push({ time: t, open: o, high: h, low: l, close: c, volume: Math.random() * 1e6 });
    p = c;
  }
  return out;
}

const INTERVAL_MAP = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '1h': '1h',
  '1D': '1d',
};

/**
 * OHLCV klines for crypto (Binance USDT).
 */
export async function fetchKlines(symbol, interval = '1h', limit = 500) {
  const binanceInterval = INTERVAL_MAP[interval] || interval;
  const sym = symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : `${symbol.toUpperCase()}USDT`;
  try {
    const { data } = await axios.get(`${BINANCE}/api/v3/klines`, {
      params: { symbol: sym, interval: binanceInterval, limit },
      timeout: 15000,
    });
    const candles = data.map((k) => ({
      time: Math.floor(k[0] / 1000),
      open: +k[1],
      high: +k[2],
      low: +k[3],
      close: +k[4],
      volume: +k[5],
    }));
    return { ok: true, symbol: sym, assetType: 'CRYPTO', candles, demo: false };
  } catch (e) {
    console.warn('[market] klines failed:', e.message);
    const sym2 = symbol.toUpperCase().endsWith('USDT') ? symbol.toUpperCase() : `${symbol.toUpperCase()}USDT`;
    return { ok: false, symbol: sym2, assetType: 'CRYPTO', candles: generateDemoCandles(limit), demo: true };
  }
}

function generateDemoCandles(limit) {
  const out = [];
  let t = Math.floor(Date.now() / 1000) - limit * 3600;
  let p = 42000;
  for (let i = 0; i < limit; i++) {
    t += 3600;
    const o = p;
    const c = o + (Math.random() - 0.48) * 800;
    const h = Math.max(o, c) + Math.random() * 400;
    const l = Math.min(o, c) - Math.random() * 400;
    out.push({ time: t, open: o, high: h, low: l, close: c, volume: Math.random() * 1000 });
    p = c;
  }
  return out;
}

/**
 * Unified history for charts.
 */
export async function fetchHistoryUnified(symbol, assetType, interval = '1h', limit = 500) {
  if (assetType === 'STOCK') {
    const h = await fetchIndianHistory(symbol, interval);
    return {
      ...h,
      assetType: 'STOCK',
      currency: 'INR',
    };
  }
  return fetchKlines(symbol, interval, limit);
}

/**
 * USDT price → INR for crypto paper trading.
 */
export async function fetchCryptoPriceInInr(symbol) {
  const sym = String(symbol).toUpperCase().endsWith('USDT')
    ? String(symbol).toUpperCase()
    : `${String(symbol).toUpperCase()}USDT`;
  try {
    const { data } = await axios.get(`${BINANCE}/api/v3/ticker/price`, {
      params: { symbol: sym },
      timeout: 8000,
    });
    const usdt = +data.price;
    const { rate, demo: rateDemo } = await fetchUsdInrRate();
    const inr = usdt * rate;
    return { ok: true, priceInr: inr, priceUsdt: usdt, symbol: sym, usdInr: rate, demo: rateDemo };
  } catch {
    const usdt = 30_000 + Math.random() * 5000;
    const { rate } = await fetchUsdInrRate();
    return { ok: false, priceInr: usdt * rate, priceUsdt: usdt, symbol: sym, usdInr: rate, demo: true };
  }
}

/**
 * Legacy: single symbol USDT (not INR). Prefer fetchCryptoPriceInr for trading.
 */
export async function fetchPrice(symbol) {
  const sym = String(symbol).toUpperCase().endsWith('USDT')
    ? String(symbol).toUpperCase()
    : `${String(symbol).toUpperCase()}USDT`;
  try {
    const { data } = await axios.get(`${BINANCE}/api/v3/ticker/price`, {
      params: { symbol: sym },
      timeout: 8000,
    });
    return { ok: true, price: +data.price, symbol: sym, demo: false };
  } catch {
    const fake = 30000 + Math.random() * 5000;
    return { ok: false, price: fake, symbol: sym, demo: true };
  }
}

/**
 * Mark price in INR for portfolio P/L (crypto → USDT×INR, stock → spot INR).
 */
export async function fetchMarkPriceInr(asset, assetType) {
  const at = assetType || (String(asset).toUpperCase().endsWith('.NS') ? 'STOCK' : 'CRYPTO');
  if (at === 'STOCK') {
    const r = await fetchIndianStockPrice(asset);
    return {
      price: r.price,
      currency: 'INR',
      assetType: 'STOCK',
      demo: r.demo,
    };
  }
  const r = await fetchCryptoPriceInInr(asset);
  return {
    price: r.priceInr,
    currency: 'INR',
    assetType: 'CRYPTO',
    usdInr: r.usdInr,
    demo: r.demo,
  };
}

/**
 * Search Binance symbols.
 */
let symbolCache = null;
let symbolCacheAt = 0;

export async function searchSymbols(query, limit = 25) {
  const q = (query || '').trim().toUpperCase();
  if (!q) return { results: [] };
  const now = Date.now();
  if (!symbolCache || now - symbolCacheAt > 1000 * 60 * 60) {
    try {
      const { data } = await axios.get(`${BINANCE}/api/v3/exchangeInfo`, { timeout: 20000 });
      symbolCache = (data.symbols || [])
        .filter((s) => s.status === 'TRADING' && s.quoteAsset === 'USDT')
        .map((s) => s.baseAsset);
      symbolCacheAt = now;
    } catch {
      symbolCache = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK'];
      symbolCacheAt = now;
    }
  }
  const results = symbolCache.filter((s) => s.includes(q)).slice(0, limit);
  return { results };
}

/**
 * Search Indian equities (curated list).
 */
export function searchIndianStocks(query, limit = 25) {
  const q = (query || '').trim().toUpperCase();
  if (!q) return { results: [] };
  const rows = NSE_UNIVERSE.filter(
    (r) => r.symbol.includes(q) || r.name.toUpperCase().includes(q) || r.symbol.replace('.NS', '').includes(q)
  ).slice(0, limit);
  return { results: rows.map((r) => ({ symbol: r.symbol, name: r.name })) };
}
