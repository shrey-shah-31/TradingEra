/** @typedef {'CRYPTO' | 'STOCK'} AssetType */

export const ASSET_TYPES = ['CRYPTO', 'STOCK'];
export const EXCHANGES = { CRYPTO: 'BINANCE', STOCK: 'NSE' };

/**
 * Normalize stock symbol to Yahoo NSE suffix.
 */
export function normalizeNseSymbol(input) {
  const s = String(input || '')
    .trim()
    .toUpperCase();
  if (!s) return '';
  if (s.endsWith('.NS')) return s;
  return `${s}.NS`;
}

/**
 * Infer asset type from persisted record or symbol shape.
 */
export function inferAssetType(asset, explicit) {
  if (explicit === 'STOCK' || explicit === 'CRYPTO') return explicit;
  const a = String(asset || '').toUpperCase();
  if (a.endsWith('.NS')) return 'STOCK';
  return 'CRYPTO';
}
