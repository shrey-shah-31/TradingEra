import { useCallback } from 'react';
import { toast } from 'sonner';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useTrading } from '../context/TradingContext.jsx';
import { useAuth } from '../hooks/useAuth.js';

/**
 * Global real-time tickers + price alerts (mount inside authenticated layout).
 */
export function PriceStream() {
  const {
    setLiveTickers,
    setIndianTickers,
    setDemo,
    setNseStatus,
    setUsdInr,
  } = useTrading();
  const { refreshUser } = useAuth();

  const onPrices = useCallback(
    (payload) => {
      setLiveTickers(payload.tickers || []);
      setIndianTickers(payload.indian || []);
      setDemo(!!payload.demo);
      if (payload.nse) setNseStatus(payload.nse);
      if (payload.usdInr != null) setUsdInr(payload.usdInr);
    },
    [setLiveTickers, setIndianTickers, setDemo, setNseStatus, setUsdInr]
  );

  const onAlert = useCallback((a) => {
    toast(`Price alert: ${a.symbol}`, {
      description: `Target ${a.targetPrice} — now ${typeof a.price === 'number' ? a.price.toFixed(2) : a.price}`,
      duration: 8000,
    });
    if (typeof window !== 'undefined' && window.Notification?.permission === 'granted') {
      new Notification('TradingEra alert', {
        body: `${a.symbol} crossed your level`,
      });
    }
  }, []);

  const onOrder = useCallback(() => {
    refreshUser();
  }, [refreshUser]);

  useWebSocket({
    'prices:update': onPrices,
    'alert:triggered': onAlert,
    'order:update': onOrder,
    'balance:update': onOrder,
    'portfolio:update': onOrder,
  });

  return null;
}
