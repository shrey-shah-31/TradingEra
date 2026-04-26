import mongoose from 'mongoose';

const priceAlertSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, uppercase: true },
    /** true = fire when price >= target */
    above: { type: Boolean, default: true },
    targetPrice: { type: Number, required: true },
    triggered: { type: Boolean, default: false },
    triggeredAt: { type: Date },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8 },
    /** Virtual INR balance for paper trading */
    balance: { type: Number, default: 100_000 },
    watchlist: [{ type: String, uppercase: true }],
    theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
    priceAlerts: [priceAlertSchema],
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
