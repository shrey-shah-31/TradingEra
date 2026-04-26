import { User } from '../models/User.js';

export async function getWatchlist(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('watchlist');
    res.json({ watchlist: user.watchlist || [] });
  } catch (e) {
    next(e);
  }
}

export async function addWatchlist(req, res, next) {
  try {
    const { symbol } = req.body;
    const sym = symbol.toUpperCase();
    await User.findByIdAndUpdate(req.user._id, { $addToSet: { watchlist: sym } });
    const user = await User.findById(req.user._id).select('watchlist');
    res.json({ watchlist: user.watchlist });
  } catch (e) {
    next(e);
  }
}

export async function removeWatchlist(req, res, next) {
  try {
    const sym = req.params.symbol.toUpperCase();
    await User.findByIdAndUpdate(req.user._id, { $pull: { watchlist: sym } });
    const user = await User.findById(req.user._id).select('watchlist');
    res.json({ watchlist: user.watchlist });
  } catch (e) {
    next(e);
  }
}

export async function setTheme(req, res, next) {
  try {
    const { theme } = req.body;
    await User.findByIdAndUpdate(req.user._id, { theme });
    res.json({ theme });
  } catch (e) {
    next(e);
  }
}

export async function listAlerts(req, res, next) {
  try {
    const user = await User.findById(req.user._id).select('priceAlerts');
    res.json({ alerts: user.priceAlerts || [] });
  } catch (e) {
    next(e);
  }
}

export async function addAlert(req, res, next) {
  try {
    const { symbol, above, targetPrice } = req.body;
    const user = await User.findById(req.user._id);
    user.priceAlerts.push({
      symbol: symbol.toUpperCase(),
      above: above !== false,
      targetPrice,
      triggered: false,
    });
    await user.save();
    res.status(201).json({ alerts: user.priceAlerts });
  } catch (e) {
    next(e);
  }
}

export async function removeAlert(req, res, next) {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { priceAlerts: { _id: req.params.id } },
    });
    const user = await User.findById(req.user._id).select('priceAlerts');
    res.json({ alerts: user.priceAlerts });
  } catch (e) {
    next(e);
  }
}
