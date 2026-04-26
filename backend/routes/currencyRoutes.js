/**
 * currencyRoutes.js
 * -----------------
 * Public currency API (no auth required for rates, balance is protected).
 *
 * GET /api/currency/rates          → full rates map (base: INR)
 * GET /api/currency/meta           → currency metadata (symbols, flags, names)
 * GET /api/currency/convert        → ?amount=&to=  (convert INR → target)
 */

import { Router } from 'express';
import {
  getExchangeRates,
  convertFromInr,
  CURRENCY_META,
  SUPPORTED_CURRENCY_CODES,
} from '../services/currencyService.js';

const router = Router();

/**
 * GET /api/currency/rates
 * Returns: { rates: { INR: 1, USD: 0.012, EUR: 0.011, ... }, stale, source, updatedAt }
 */
router.get('/rates', async (req, res, next) => {
  try {
    const result = await getExchangeRates();
    res.json({
      base: 'INR',
      rates: result.rates,
      supported: SUPPORTED_CURRENCY_CODES,
      stale: result.stale,
      source: result.source,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/currency/meta
 * Returns display metadata: symbols, names, flags, locales.
 */
router.get('/meta', (req, res) => {
  res.json({ meta: CURRENCY_META });
});

/**
 * GET /api/currency/convert?amount=100000&to=USD
 * Returns: { amount, from, to, converted, rate, stale }
 */
router.get('/convert', async (req, res, next) => {
  try {
    const amount = parseFloat(req.query.amount);
    const to = (req.query.to || 'INR').toUpperCase().trim();

    if (Number.isNaN(amount)) {
      return res.status(400).json({ message: 'amount must be a number' });
    }
    if (!SUPPORTED_CURRENCY_CODES.includes(to)) {
      return res.status(400).json({
        message: `Unsupported currency: ${to}`,
        supported: SUPPORTED_CURRENCY_CODES,
      });
    }

    const result = await convertFromInr(amount, to);
    return res.json({
      amount,
      from: 'INR',
      to: result.currency,
      converted: result.value,
      rate: to === 'INR' ? 1 : result.value / amount,
      stale: result.stale,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
