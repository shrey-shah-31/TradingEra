import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { connectDb } from './config/db.js';
import { createTradingEngine } from './services/tradingEngine.js';
import {
  fetch24hTickers,
  DEFAULT_SYMBOLS,
  fetchIndianQuotes,
  DEFAULT_NSE_SYMBOLS,
  fetchUsdInrRate,
} from './services/marketService.js';
import { processAlerts } from './services/alertService.js';
import { getNseStatus } from './utils/nseCalendar.js';

import authRoutes from './routes/authRoutes.js';
import tradeRoutes from './routes/tradeRoutes.js';
import portfolioRoutes from './routes/portfolioRoutes.js';
import marketRoutes from './routes/marketRoutes.js';
import userRoutes from './routes/userRoutes.js';
import currencyRoutes from './routes/currencyRoutes.js';
import { protect } from './middlewares/authMiddleware.js';
import { apiLimiter } from './middlewares/rateLimiter.js';
import { errorHandler } from './middlewares/errorMiddleware.js';
import jwt from 'jsonwebtoken';

const PORT = Number(process.env.PORT) || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: FRONTEND_URL, credentials: true },
});

app.use(helmet());
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: '64kb' }));
app.use(apiLimiter);

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'TradingEra API' }));

app.use('/api/auth', authRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/user', userRoutes);
app.use('/api/currency', currencyRoutes);

/** Lightweight balance refresh for clients */
app.get('/api/auth/balance', protect, async (req, res, next) => {
  try {
    const { User } = await import('./models/User.js');
    const u = await User.findById(req.user._id).select('balance');
    res.json({ balance: u.balance });
  } catch (e) {
    next(e);
  }
});

app.use(errorHandler);

const tradingEngine = createTradingEngine(io);
app.locals.tradingEngine = tradingEngine;

/** Build map BASE -> lastPrice INR for crypto (USDT * USDINR) */
async function buildCryptoInrMap(tickers) {
  const { rate } = await fetchUsdInrRate();
  const map = {};
  for (const t of tickers) {
    const sym = t.symbol;
    if (sym.endsWith('USDT')) {
      const base = sym.replace('USDT', '');
      map[base] = +t.lastPrice * rate;
    }
  }
  return map;
}

/** Merge NSE INR prices */
function buildIndianMap(quotes) {
  const map = {};
  for (const q of quotes) {
    if (q.symbol && q.price != null) map[q.symbol] = +q.price;
  }
  return map;
}

/** Combined price map for limits + alerts */
function mergePriceMaps(cryptoInr, indian) {
  return { ...cryptoInr, ...indian };
}

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const room = `user:${socket.userId}`;
  socket.join(room);
  socket.emit('connected', { room });

  socket.on('disconnect', () => {
    /* noop */
  });
});

/** Broadcast live prices every 4s + match limits + alerts */
async function broadcastPrices() {
  try {
    const normalized = DEFAULT_SYMBOLS.map((s) => (s.endsWith('USDT') ? s : `${s}USDT`));
    const { data: tickers, demo: cryptoDemo } = await fetch24hTickers(normalized);
    const { quotes: indian, demo: indianDemo } = await fetchIndianQuotes(DEFAULT_NSE_SYMBOLS);
    const { rate: usdInr, demo: fxDemo } = await fetchUsdInrRate();

    const cryptoInrMap = await buildCryptoInrMap(tickers);
    const indianMap = buildIndianMap(indian);
    const merged = mergePriceMaps(cryptoInrMap, indianMap);

    const nse = getNseStatus();

    io.emit('prices:update', {
      tickers,
      indian,
      demo: cryptoDemo || indianDemo || fxDemo,
      ts: Date.now(),
      usdInr,
      nse,
    });

    await tradingEngine.tryMatchLimitOrders(merged);
    await processAlerts(io, merged);
  } catch (e) {
    console.warn('[ws] broadcastPrices', e.message);
  }
}

async function main() {
  if (!process.env.JWT_SECRET) {
    console.warn('[warn] JWT_SECRET missing — set in .env for production');
    process.env.JWT_SECRET = 'dev_only_change_me';
  }
  await connectDb();
  try {
    const { Portfolio } = await import('./models/Portfolio.js');
    const { Order } = await import('./models/Order.js');
    const { Transaction } = await import('./models/Transaction.js');
    await Portfolio.updateMany(
      { assetType: { $exists: false } },
      { $set: { assetType: 'CRYPTO', exchange: 'BINANCE' } }
    );
    await Order.updateMany(
      { assetType: { $exists: false } },
      { $set: { assetType: 'CRYPTO', exchange: 'BINANCE', currency: 'INR' } }
    );
    await Transaction.updateMany(
      { assetType: { $exists: false } },
      { $set: { assetType: 'CRYPTO', exchange: 'BINANCE', currency: 'INR' } }
    );
  } catch (e) {
    console.warn('[db] migration skip:', e.message);
  }
  setInterval(broadcastPrices, 4000);
  broadcastPrices();

  server.listen(PORT, () => {
    console.log(`[TradingEra] API + WebSocket on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
