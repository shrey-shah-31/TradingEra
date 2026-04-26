import mongoose from 'mongoose';

const portfolioSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    asset: { type: String, required: true, uppercase: true },
    assetType: { type: String, enum: ['CRYPTO', 'STOCK'], default: 'CRYPTO' },
    exchange: { type: String, enum: ['BINANCE', 'NSE'], default: 'BINANCE' },
    quantity: { type: Number, required: true, min: 0 },
    /** Average cost in INR per unit */
    avgPrice: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

portfolioSchema.index({ userId: 1, asset: 1, assetType: 1 }, { unique: true });

export const Portfolio = mongoose.model('Portfolio', portfolioSchema);
