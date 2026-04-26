import { User } from '../models/User.js';

/**
 * Check price alerts for all users; emit via callback when triggered.
 * @param {Record<string, number>} pricesByBase — e.g. { BTC: 65000 }
 */
export async function processAlerts(io, pricesByBase) {
  if (!io) return;
  const users = await User.find({ 'priceAlerts.0': { $exists: true } });

  for (const user of users) {
    let changed = false;
    for (const alert of user.priceAlerts) {
      if (alert.triggered) continue;
      const px = pricesByBase[alert.symbol];
      if (px == null) continue;

      const fireAbove = alert.above && px >= alert.targetPrice;
      const fireBelow = !alert.above && px <= alert.targetPrice;
      if (fireAbove || fireBelow) {
        alert.triggered = true;
        alert.triggeredAt = new Date();
        changed = true;
        io.to(`user:${user._id}`).emit('alert:triggered', {
          symbol: alert.symbol,
          price: px,
          targetPrice: alert.targetPrice,
          above: alert.above,
        });
      }
    }
    if (changed) await user.save();
  }
}
