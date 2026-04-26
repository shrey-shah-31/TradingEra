import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Order } from '../models/Order.js';
import { Portfolio } from '../models/Portfolio.js';
import { Transaction } from '../models/Transaction.js';
import { fetchCryptoPriceInInr, fetchIndianStockPrice } from './marketService.js';
import { EXCHANGES, inferAssetType, normalizeNseSymbol } from '../utils/assetContext.js';
import { isNseCashSessionOpen } from '../utils/nseCalendar.js';

const STRICT_NSE = () => process.env.NSE_STRICT_HOURS === 'true';

/** 5× leverage for Indian stocks — user pays 1/5th of the notional price. */
const STOCK_LEVERAGE = 5;

function assertStockTradingAllowed() {
  if (STRICT_NSE() && !isNseCashSessionOpen()) {
    const e = new Error('NSE cash market is closed (IST). Paper trades are disabled until the next session.');
    e.statusCode = 403;
    throw e;
  }
}

/**
 * Paper trading execution and portfolio updates (all fills in INR).
 * @param {import('socket.io').Server | null} io
 */
export function createTradingEngine(io) {
  const notifyUser = (userId, event, payload) => {
    if (!io) return;
    io.to(`user:${userId}`).emit(event, payload);
  };

  async function fetchExecutionPrice(asset, assetType) {
    if (assetType === 'STOCK') {
      const sym = normalizeNseSymbol(asset);
      const r = await fetchIndianStockPrice(sym);
      return { priceInr: r.price, demo: r.demo, asset: sym };
    }
    const r = await fetchCryptoPriceInInr(asset);
    return { priceInr: r.priceInr, demo: r.demo, asset: r.symbol.replace('USDT', '') };
  }

  async function recordTx(payload) {
    const { userId, orderId, asset, type, price, quantity, assetType, exchange } = payload;
    const total = price * quantity;
    await Transaction.create({
      userId, orderId, asset, type, price, quantity, total, assetType, exchange, currency: 'INR',
    });
  }

  /**
   * Execute MARKET or immediate LIMIT fill at `price` (INR).
   *
   * Uses atomic single-command updates — no sessions or replica set required.
   *
   * BUY path:
   *   1. User.updateOne({ balance: { $gte: cost } }) → deduct balance atomically.
   *   2. Portfolio.findOneAndUpdate(upsert) → add quantity + recalculate avgPrice.
   *
   * SELL path:
   *   1. Portfolio.findOneAndUpdate({ quantity: { $gte: quantity } }) → deduct qty atomically.
   *   2. User.updateOne → credit proceeds unconditionally (holding check already passed).
   */
  async function executeFill(userId, { asset, type, quantity: rawQty, price: rawPrice, orderId, assetType, exchange }) {
    // ── Coerce to numbers to guard against stringified values from frontend ───
    const price    = Number(rawPrice);
    const quantity = Number(rawQty);
    const uid      = mongoose.Types.ObjectId.isValid(userId)
      ? new mongoose.Types.ObjectId(String(userId))
      : userId;

    if (!price || !quantity || Number.isNaN(price) || Number.isNaN(quantity)) {
      const err = new Error(`Invalid price (${rawPrice}) or quantity (${rawQty})`);
      err.statusCode = 400;
      throw err;
    }

    // For Indian stocks, user only pays/receives 1/STOCK_LEVERAGE of the notional.
    // The real market price is still stored for P&L tracking.
    const effectivePrice = assetType === 'STOCK' ? price / STOCK_LEVERAGE : price;

    if (type === 'BUY') {
      const cost = effectivePrice * quantity;

      // ── 1. Atomically check + deduct balance ─────────────────────────────────
      const userResult = await User.updateOne(
        { _id: uid, balance: { $gte: cost } },
        { $inc: { balance: -cost } }
      );
      if (userResult.modifiedCount !== 1) {
        const dbUser = await User.findById(uid).select('balance').lean();
        console.warn(
          `[trade] BUY rejected — userId=${uid} balance=${dbUser?.balance} cost=${cost} asset=${asset}`
        );
        const err = new Error('Insufficient balance');
        err.statusCode = 400;
        throw err;
      }

      // ── 2. Upsert portfolio — avgPrice at real market price for P&L accuracy ─
      try {
        const existing = await Portfolio.findOne({ userId: uid, asset, assetType }).lean();
        const oldQty = existing?.quantity ?? 0;
        const oldAvg = existing?.avgPrice ?? 0;
        const newQty = oldQty + quantity;
        const newAvg = oldQty > 0
          ? (oldQty * oldAvg + quantity * price) / newQty
          : price;

        await Portfolio.findOneAndUpdate(
          { userId: uid, asset, assetType },
          { $set: { userId: uid, asset, assetType, exchange, quantity: newQty, avgPrice: newAvg } },
          { upsert: true, new: true }
        );
      } catch (portfolioErr) {
        // Rollback: refund the balance so it is never lost
        await User.updateOne({ _id: uid }, { $inc: { balance: cost } });
        console.error('[trade] Portfolio upsert failed — balance refunded:', portfolioErr.message);
        throw portfolioErr;
      }

    } else {
      // ── SELL ─────────────────────────────────────────────────────────────────

      // 1. Atomically check + deduct holding quantity
      const holdingResult = await Portfolio.findOneAndUpdate(
        { userId: uid, asset, assetType, quantity: { $gte: quantity } },
        { $inc: { quantity: -quantity } },
        { new: true }
      );
      if (!holdingResult) {
        const dbHolding = await Portfolio.findOne({ userId: uid, asset, assetType }).select('quantity').lean();
        console.warn(
          `[trade] SELL rejected — userId=${uid} holding=${dbHolding?.quantity} needed=${quantity} asset=${asset}`
        );
        const err = new Error('Insufficient holdings');
        err.statusCode = 400;
        throw err;
      }

      // Clean up zero/dust holdings
      if (holdingResult.quantity <= 1e-12) {
        await Portfolio.deleteOne({ _id: holdingResult._id });
      }

      // 2. Credit proceeds using effective (leveraged) price
      const proceeds = effectivePrice * quantity;
      await User.updateOne({ _id: uid }, { $inc: { balance: proceeds } });
    }

    // ── Mark order complete + write transaction log ────────────────────────────
    await Order.findByIdAndUpdate(orderId, { status: 'COMPLETED', price, filledAt: new Date() });
    await recordTx({ userId: uid, orderId, asset, type, price, quantity, assetType, exchange });

    notifyUser(userId, 'order:update', { orderId, status: 'COMPLETED', price });
    notifyUser(userId, 'portfolio:update', { asset });
    notifyUser(userId, 'balance:update', {});

    return { price, quantity };
  }

  async function placeMarketOrder(userId, { asset, type, quantity, assetType: atIn }) {
    const assetType = inferAssetType(asset, atIn);
    if (assetType === 'STOCK') assertStockTradingAllowed();

    const qty = assetType === 'STOCK' ? Math.floor(Number(quantity)) : Number(quantity);
    if (assetType === 'STOCK' && qty < 1) throw Object.assign(new Error('Minimum 1 share for Indian stocks'), { statusCode: 400 });

    const { priceInr, demo, asset: resolvedAsset } = await fetchExecutionPrice(asset, assetType);
    if (!priceInr || Number.isNaN(priceInr)) throw new Error('Unable to fetch market price');

    const exchange = EXCHANGES[assetType];
    const sym =
      assetType === 'STOCK'
        ? normalizeNseSymbol(asset)
        : String(resolvedAsset || asset)
            .toUpperCase()
            .replace('USDT', '');

    const order = await Order.create({
      userId,
      asset: sym,
      assetType,
      exchange,
      currency: 'INR',
      type,
      orderType: 'MARKET',
      price: priceInr,
      quantity: qty,
      status: 'OPEN',
    });

    await executeFill(userId, {
      asset: order.asset,
      type,
      quantity: qty,
      price: priceInr,
      orderId: order._id,
      assetType,
      exchange,
    });

    return { order: await Order.findById(order._id), executionPrice: priceInr, demo };
  }

  async function placeLimitOrder(userId, { asset, type, quantity, limitPrice, assetType: atIn }) {
    if (!limitPrice || limitPrice <= 0) throw new Error('Invalid limit price');

    const assetType = inferAssetType(asset, atIn);
    if (assetType === 'STOCK') assertStockTradingAllowed();

    const qty = assetType === 'STOCK' ? Math.floor(Number(quantity)) : Number(quantity);
    if (assetType === 'STOCK' && qty < 1) throw Object.assign(new Error('Minimum 1 share for Indian stocks'), { statusCode: 400 });

    const exchange = EXCHANGES[assetType];
    const sym = assetType === 'STOCK' ? normalizeNseSymbol(asset) : String(asset).toUpperCase();

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    if (type === 'BUY') {
      const maxCost = (assetType === 'STOCK' ? limitPrice / STOCK_LEVERAGE : limitPrice) * qty;
      if (user.balance < maxCost) throw new Error('Insufficient balance for limit buy');
    } else {
      const holding = await Portfolio.findOne({ userId, asset: sym, assetType });
      if (!holding || holding.quantity < qty) throw new Error('Insufficient holdings for limit sell');
    }

    const order = await Order.create({
      userId,
      asset: sym,
      assetType,
      exchange,
      currency: 'INR',
      type,
      orderType: 'LIMIT',
      limitPrice,
      quantity: qty,
      status: 'OPEN',
    });

    notifyUser(userId, 'order:update', { orderId: order._id, status: 'OPEN' });

    return { order };
  }

  /**
   * Attempt to match open LIMIT orders against latest market prices (INR).
   * @param {Record<string, number>} pricesByKey — e.g. { BTC: 5.2e6, 'RELIANCE.NS': 2450 }
   */
  async function tryMatchLimitOrders(pricesByKey) {
    const open = await Order.find({ status: 'OPEN', orderType: 'LIMIT' }).lean();
    for (const o of open) {
      const key = o.asset;
      const market = pricesByKey[key];
      if (market == null || Number.isNaN(market)) continue;

      let hit = false;
      if (o.type === 'BUY' && market <= o.limitPrice) hit = true;
      if (o.type === 'SELL' && market >= o.limitPrice) hit = true;

      if (hit) {
        try {
          await executeFill(o.userId.toString(), {
            asset: o.asset,
            type: o.type,
            quantity: o.quantity,
            price: market,
            orderId: o._id,
            assetType: o.assetType || 'CRYPTO',
            exchange: o.exchange || EXCHANGES[o.assetType] || 'BINANCE',
          });
        } catch (err) {
          console.warn('[trade] limit fill failed', o._id, err.message);
        }
      }
    }
  }

  async function cancelOrder(userId, orderId) {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) throw new Error('Order not found');
    if (order.status !== 'OPEN') throw new Error('Only open orders can be cancelled');
    order.status = 'CANCELLED';
    await order.save();
    notifyUser(userId, 'order:update', { orderId, status: 'CANCELLED' });
    return order;
  }

  async function updateOrder(userId, orderId, { quantity, limitPrice }) {
    const order = await Order.findOne({ _id: orderId, userId });
    if (!order) throw new Error('Order not found');
    if (order.status !== 'OPEN' || order.orderType !== 'LIMIT') {
      throw new Error('Only open limit orders can be edited');
    }
    if (quantity != null) {
      if (quantity <= 0) throw new Error('Invalid quantity');
      order.quantity = quantity;
    }
    if (limitPrice != null) {
      if (limitPrice <= 0) throw new Error('Invalid limit price');
      order.limitPrice = limitPrice;
    }
    await order.save();
    notifyUser(userId, 'order:update', { orderId, status: 'OPEN', edited: true });
    return order;
  }

  return {
    placeMarketOrder,
    placeLimitOrder,
    tryMatchLimitOrders,
    cancelOrder,
    updateOrder,
    executeFill,
  };
}
