import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    asset: { type: String, required: true, uppercase: true },
    assetType: { type: String, enum: ['CRYPTO', 'STOCK'], default: 'CRYPTO' },
    exchange: { type: String, enum: ['BINANCE', 'NSE'], default: 'BINANCE' },
    currency: { type: String, default: 'INR' },
    type: { type: String, enum: ['BUY', 'SELL'], required: true },
    orderType: { type: String, enum: ['MARKET', 'LIMIT'], required: true },
    /** Limit price for LIMIT orders (always INR in paper engine) */
    limitPrice: { type: Number },
    /** Executed / market reference price (INR) */
    price: { type: Number },
    quantity: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['OPEN', 'COMPLETED', 'CANCELLED'], default: 'OPEN' },
    filledAt: { type: Date },
  },
  { timestamps: true }
);

export const Order = mongoose.model('Order', orderSchema);
