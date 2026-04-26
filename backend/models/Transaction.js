import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    asset: { type: String, required: true, uppercase: true },
    assetType: { type: String, enum: ['CRYPTO', 'STOCK'], default: 'CRYPTO' },
    exchange: { type: String, enum: ['BINANCE', 'NSE'], default: 'BINANCE' },
    currency: { type: String, default: 'INR' },
    type: { type: String, enum: ['BUY', 'SELL'], required: true },
    /** Execution price in INR */
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model('Transaction', transactionSchema);
