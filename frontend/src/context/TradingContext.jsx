import { createContext, useContext, useMemo, useState, useCallback } from 'react';

const TradingContext = createContext(null);

export function TradingProvider({ children }) {
  const [symbol, setSymbol] = useState('BTC');
  /** 'CRYPTO' | 'STOCK' */
  const [assetClass, setAssetClass] = useState('CRYPTO');
  const [interval, setInterval] = useState('1h');
  const [demo, setDemo] = useState(false);
  const [liveTickers, setLiveTickers] = useState([]);
  const [indianTickers, setIndianTickers] = useState([]);
  const [nseStatus, setNseStatus] = useState(null);
  const [usdInr, setUsdInr] = useState(null);

  const setAssetClassSafe = useCallback((ac) => {
    setAssetClass(ac);
    if (ac === 'STOCK') {
      setSymbol((s) => (s.includes('.NS') ? s : 'RELIANCE.NS'));
    } else {
      setSymbol((s) => (s.includes('.NS') ? 'BTC' : s.replace(/\.NS$/i, '') || 'BTC'));
    }
  }, []);

  const value = useMemo(
    () => ({
      symbol,
      setSymbol,
      assetClass,
      setAssetClass: setAssetClassSafe,
      interval,
      setInterval,
      demo,
      setDemo,
      liveTickers,
      setLiveTickers,
      indianTickers,
      setIndianTickers,
      nseStatus,
      setNseStatus,
      usdInr,
      setUsdInr,
    }),
    [
      symbol,
      assetClass,
      setAssetClassSafe,
      interval,
      demo,
      liveTickers,
      indianTickers,
      nseStatus,
      usdInr,
    ]
  );

  return <TradingContext.Provider value={value}>{children}</TradingContext.Provider>;
}

export function useTrading() {
  const ctx = useContext(TradingContext);
  if (!ctx) throw new Error('useTrading must be used within TradingProvider');
  return ctx;
}
