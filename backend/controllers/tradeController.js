/**
 * Trade controller — delegates to trading engine instance on app.locals.
 */
export async function buy(req, res, next) {
  try {
    if (req.body.type !== 'BUY') {
      const e = new Error('Buy endpoint expects type BUY');
      e.statusCode = 400;
      throw e;
    }
    const engine = req.app.locals.tradingEngine;
    const { asset, orderType, quantity, limitPrice, assetType } = req.body;

    if (orderType === 'MARKET') {
      const r = await engine.placeMarketOrder(req.user._id, {
        asset,
        type: 'BUY',
        quantity,
        assetType,
      });
      return res.json({ message: 'Order executed', ...r });
    }
    const r = await engine.placeLimitOrder(req.user._id, {
      asset,
      type: 'BUY',
      quantity,
      limitPrice,
      assetType,
    });
    return res.status(201).json({ message: 'Limit order placed', ...r });
  } catch (e) {
    if (!e.statusCode) e.statusCode = 400;
    next(e);
  }
}

export async function sell(req, res, next) {
  try {
    if (req.body.type !== 'SELL') {
      const e = new Error('Sell endpoint expects type SELL');
      e.statusCode = 400;
      throw e;
    }
    const engine = req.app.locals.tradingEngine;
    const { asset, orderType, quantity, limitPrice, assetType } = req.body;

    if (orderType === 'MARKET') {
      const r = await engine.placeMarketOrder(req.user._id, {
        asset,
        type: 'SELL',
        quantity,
        assetType,
      });
      return res.json({ message: 'Order executed', ...r });
    }
    const r = await engine.placeLimitOrder(req.user._id, {
      asset,
      type: 'SELL',
      quantity,
      limitPrice,
      assetType,
    });
    return res.status(201).json({ message: 'Limit order placed', ...r });
  } catch (e) {
    if (!e.statusCode) e.statusCode = 400;
    next(e);
  }
}

export async function listOrders(req, res, next) {
  try {
    const { Order } = await import('../models/Order.js');
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(200);
    res.json({ orders });
  } catch (e) {
    next(e);
  }
}

export async function cancelOrder(req, res, next) {
  try {
    const engine = req.app.locals.tradingEngine;
    const order = await engine.cancelOrder(req.user._id, req.params.id);
    res.json({ message: 'Order cancelled', order });
  } catch (e) {
    if (!e.statusCode) e.statusCode = 400;
    next(e);
  }
}

export async function patchOrder(req, res, next) {
  try {
    const engine = req.app.locals.tradingEngine;
    const order = await engine.updateOrder(req.user._id, req.params.id, req.body);
    res.json({ message: 'Order updated', order });
  } catch (e) {
    if (!e.statusCode) e.statusCode = 400;
    next(e);
  }
}
