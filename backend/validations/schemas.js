import Joi from 'joi';

export const registerSchema = Joi.object({
  name: Joi.string().min(2).max(80).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const tradeSchema = Joi.object({
  asset: Joi.string().min(2).max(32).required(),
  assetType: Joi.string().valid('CRYPTO', 'STOCK').default('CRYPTO'),
  type: Joi.string().valid('BUY', 'SELL').required(),
  orderType: Joi.string().valid('MARKET', 'LIMIT').required(),
  quantity: Joi.number().positive().required(),
  limitPrice: Joi.when('orderType', {
    is: 'LIMIT',
    then: Joi.number().positive().required(),
    otherwise: Joi.forbidden(),
  }),
});

export const updateOrderSchema = Joi.object({
  quantity: Joi.number().positive(),
  limitPrice: Joi.number().positive(),
}).min(1);

export const watchlistSchema = Joi.object({
  symbol: Joi.string().min(2).max(32).required(),
});

export const alertSchema = Joi.object({
  symbol: Joi.string().min(2).max(32).required(),
  above: Joi.boolean().default(true),
  targetPrice: Joi.number().positive().required(),
});

export const themeSchema = Joi.object({
  theme: Joi.string().valid('dark', 'light').required(),
});
