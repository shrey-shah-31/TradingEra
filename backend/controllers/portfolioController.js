import { Portfolio } from '../models/Portfolio.js';
import { Transaction } from '../models/Transaction.js';
import { fetchMarkPriceInr } from '../services/marketService.js';
import { inferAssetType } from '../utils/assetContext.js';

/**
 * Current holdings with live mark price and unrealized P/L (INR).
 */
export async function getPortfolio(req, res, next) {
  try {
    const holdings = await Portfolio.find({ userId: req.user._id }).lean();
    const enriched = [];

    for (const h of holdings) {
      const at = inferAssetType(h.asset, h.assetType);
      const { price: market, demo } = await fetchMarkPriceInr(h.asset, at);
      const m = market || h.avgPrice;
      const value = m * h.quantity;
      const cost = h.avgPrice * h.quantity;
      const pnl = value - cost;
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
      enriched.push({
        ...h,
        marketPrice: m,
        value,
        cost,
        pnl,
        pnlPct,
        demo,
      });
    }

    res.json({ holdings: enriched });
  } catch (e) {
    next(e);
  }
}

export async function getHistory(req, res, next) {
  try {
    const txs = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    res.json({ transactions: txs });
  } catch (e) {
    next(e);
  }
}

/**
 * Realized P&L — computed from transaction history using average-cost basis.
 * For every SELL we find the avg buy cost at that point in time and compute:
 *   realized = (sell_price - avg_cost) * quantity
 */
export async function getRealizedPnl(req, res, next) {
  try {
    // Fetch all transactions oldest-first so we can build cost basis correctly
    const txs = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: 1 })
      .lean();

    // Running average-cost state per asset key "ASSET:TYPE"
    const state = {};
    const trades = [];
    let totalRealized = 0;
    let wins = 0;
    let losses = 0;
    let bestTrade = null;
    let worstTrade = null;

    for (const tx of txs) {
      const key = `${tx.asset}:${tx.assetType}`;
      if (!state[key]) state[key] = { avgCost: 0, qty: 0 };
      const s = state[key];

      if (tx.type === 'BUY') {
        const newQty = s.qty + tx.quantity;
        s.avgCost = s.qty > 0
          ? (s.qty * s.avgCost + tx.quantity * tx.price) / newQty
          : tx.price;
        s.qty = newQty;
      } else if (tx.type === 'SELL') {
        const costBasis = s.avgCost || tx.price;
        const realized = (tx.price - costBasis) * tx.quantity;
        totalRealized += realized;

        if (realized >= 0) wins++;
        else losses++;

        const trade = {
          asset: tx.asset,
          assetType: tx.assetType,
          qty: tx.quantity,
          sellPrice: tx.price,
          costBasis,
          realized,
          realizedPct: costBasis > 0 ? ((tx.price - costBasis) / costBasis) * 100 : 0,
          date: tx.createdAt,
        };
        trades.push(trade);

        if (!bestTrade || realized > bestTrade.realized) bestTrade = trade;
        if (!worstTrade || realized < worstTrade.realized) worstTrade = trade;

        s.qty = Math.max(0, s.qty - tx.quantity);
      }
    }

    const tradeCount = trades.length;
    const winRate = tradeCount > 0 ? (wins / tradeCount) * 100 : 0;

    res.json({
      totalRealized,
      wins,
      losses,
      tradeCount,
      winRate,
      bestTrade,
      worstTrade,
      trades: [...trades].reverse().slice(0, 30), // newest first, last 30
    });
  } catch (e) {
    next(e);
  }
}
