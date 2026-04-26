import { useEffect, useRef } from 'react';
import { createChart, LineSeries, ColorType } from 'lightweight-charts';

/** Compact line chart for portfolio performance */
export function EquityMiniChart({ points }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!ref.current || !points?.length) return;
    const chart = createChart(ref.current, {
      height: 120,
      width: ref.current.clientWidth,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b',
      },
      grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(148,163,184,0.08)' } },
      rightPriceScale: { visible: false },
      timeScale: { visible: false },
      crosshair: { mode: 0 },
    });
    const line = chart.addSeries(LineSeries, {
      color: '#38bdf8',
      lineWidth: 2,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    line.setData(points);
    chart.timeScale().fitContent();
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.applyOptions({ width: ref.current.clientWidth }));
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [points]);

  return <div ref={ref} className="w-full rounded-xl border border-white/10 overflow-hidden bg-black/20" />;
}
