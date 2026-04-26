import mongoose from 'mongoose';

/**
 * Connect to MongoDB with sane defaults for dev and production.
 */
export async function connectDb() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set in environment');
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('[db] MongoDB connected');
}
