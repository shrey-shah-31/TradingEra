import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
} from 'lightweight-charts';

// ----------------------------------------------------------------------
// Helper
const cn = (...classes) => classes.filter(Boolean).join(' ');

// ----------------------------------------------------------------------
// TIMEFRAMES
const PINNED_TF = ['1m', '5m', '15m', '1h', '1D'];

const TF_GROUPS = [
  { label: 'Minutes',   items: ['1m','3m','5m','10m','15m','30m','45m'].map(id => ({ id, label: id })) },
  { label: 'Hours',     items: ['1h','2h','3h','4h','6h','8h','12h'].map(id => ({ id, label: id })) },
  { label: 'Days / Weeks / Months', items: ['1D','3D','1W','1M','3M'].map(id => ({ id, label: id })) },
];

// ----------------------------------------------------------------------
// Custom Interval Modal
const CUSTOM_TYPES = [
  { value: 'm', label: 'minutes', suffix: 'm' },
  { value: 'h', label: 'hours',   suffix: 'h' },
  { value: 'D', label: 'days',    suffix: 'D' },
  { value: 'W', label: 'weeks',   suffix: 'W' },
  { value: 'M', label: 'months',  suffix: 'M' },
];

function CustomIntervalButton({ onSelect }) {
  const [show, setShow]   = useState(false);
  const [type, setType]   = useState('m');
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (show) setTimeout(() => inputRef.current?.focus(), 50); }, [show]);

  const handleAdd = () => {
    const n = parseInt(value, 10);
    if (!n || n < 1) return;
    const suffix = CUSTOM_TYPES.find(t => t.value === type)?.suffix ?? type;
    onSelect(`${n}${suffix}`);
    setShow(false); setValue('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setShow(true)}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-white/20 text-[#4a5a7a] hover:bg-white/5 hover:text-white transition-all"
      >
        <span className="text-sky-400 text-sm">+</span>
        Add custom interval…
      </button>
      {show && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 backdrop-blur-sm"
          onMouseDown={e => { if (e.target === e.currentTarget) setShow(false); }}
        >
          <div className="relative rounded-2xl border border-white/10 bg-[#0d1422] shadow-2xl p-6 w-[360px]">
            <div className="flex justify-between mb-5">
              <h3 className="text-sm font-semibold text-white">Add custom interval</h3>
              <button onClick={() => setShow(false)} className="text-[#4a5a7a] hover:text-white text-lg">×</button>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <label className="text-xs text-[#4a5a7a] w-16">Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="flex-1 rounded-lg bg-[#1a2235] border border-white/10 text-sm text-white px-3 py-2 outline-none focus:border-sky-500/50">
                {CUSTOM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <label className="text-xs text-[#4a5a7a] w-16">Interval</label>
              <input
                ref={inputRef}
                type="number" min={1} max={999}
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShow(false); }}
                placeholder="e.g. 4"
                className="flex-1 rounded-lg bg-[#1a2235] border border-white/10 text-sm text-white px-3 py-2 outline-none focus:border-sky-500/50"
              />
            </div>
            {value && parseInt(value) > 0 && (
              <div className="flex items-center gap-2 mb-5 px-1">
                <span className="text-xs text-[#4a5a7a]">Result:</span>
                <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/40 text-sky-200 text-xs font-mono">
                  {parseInt(value)}{CUSTOM_TYPES.find(t => t.value === type)?.suffix}
                </span>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShow(false)} className="px-4 py-2 rounded-lg text-xs font-medium border border-white/10 text-[#4a5a7a] hover:bg-white/5">Cancel</button>
              <button onClick={handleAdd} disabled={!value || parseInt(value) < 1} className="px-5 py-2 rounded-lg text-xs font-semibold bg-sky-500/25 border border-sky-400/50 text-sky-200 hover:bg-sky-500/35 disabled:opacity-40">Add</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ----------------------------------------------------------------------
// TimeframeSelector
function TimeframeSelector({ interval, onIntervalChange }) {
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    function onDoc(e) { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pinnedIds = PINNED_TF.includes(interval) ? PINNED_TF : [...PINNED_TF.slice(0, 4), interval];
  const select = id => { onIntervalChange(id); setOpen(false); };

  return (
    <div className="relative flex items-center gap-0.5" ref={dropRef}>
      {pinnedIds.map(id => (
        <button
          key={id}
          onClick={() => select(id)}
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${interval === id ? 'bg-[#1e3a5f] text-[#60a5fa] font-bold' : 'text-[#4a5a7a] bg-transparent hover:text-white'}`}
        >
          {id}
        </button>
      ))}
      <div className="relative">
        <button onClick={() => setOpen(v => !v)} className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-0.5 transition-all ${open ? 'text-[#e2e8f0]' : 'text-[#4a5a7a] hover:text-white'}`}>
          More <span className={`text-[9px] transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
        </button>
        {open && (
          <div className="absolute top-full left-0 mt-1 z-50 rounded-lg border border-white/10 bg-[#0d1220] shadow-2xl p-2.5 min-w-[240px]">
            {TF_GROUPS.map(grp => (
              <div key={grp.label} className="mb-2.5 last:mb-0">
                <p className="text-[9px] uppercase tracking-widest text-[#3a4a5a] mb-1.5 px-1">{grp.label}</p>
                <div className="flex flex-wrap gap-1">
                  {grp.items.map(t => (
                    <button key={t.id} onClick={() => select(t.id)} className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${interval === t.id ? 'bg-[#1e3a5f] text-[#60a5fa] border border-[#2563eb40]' : 'text-[#4a5a7a] border border-transparent hover:text-white'}`}>
                      {t.id}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="border-t border-white/8 mt-2 pt-2">
              <CustomIntervalButton onSelect={select} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Fixed Range Tool
function FixedRangeTool({ onApplyX, onApplyY, onReset }) {
  const [xMin, setXMin] = useState('');
  const [xMax, setXMax] = useState('');
  const [yMin, setYMin] = useState('');
  const [yMax, setYMax] = useState('');

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-[#1a2235]/50 rounded-lg border border-white/10">
      <span className="text-xs text-[#4a5a7a]">X:</span>
      <input type="number" placeholder="from" value={xMin} onChange={e => setXMin(e.target.value)} className="w-20 bg-[#0d1220] border border-white/10 rounded px-2 py-1 text-xs text-white" />
      <span className="text-xs text-[#4a5a7a]">–</span>
      <input type="number" placeholder="to"   value={xMax} onChange={e => setXMax(e.target.value)} className="w-20 bg-[#0d1220] border border-white/10 rounded px-2 py-1 text-xs text-white" />
      <button onClick={() => onApplyX(Number(xMin), Number(xMax))} className="px-2 py-1 bg-sky-600/50 rounded text-xs text-white hover:bg-sky-600/70">Apply X</button>
      <span className="text-xs text-[#4a5a7a] ml-2">Y:</span>
      <input type="number" placeholder="min" value={yMin} onChange={e => setYMin(e.target.value)} className="w-20 bg-[#0d1220] border border-white/10 rounded px-2 py-1 text-xs text-white" />
      <span className="text-xs text-[#4a5a7a]">–</span>
      <input type="number" placeholder="max" value={yMax} onChange={e => setYMax(e.target.value)} className="w-20 bg-[#0d1220] border border-white/10 rounded px-2 py-1 text-xs text-white" />
      <button onClick={() => onApplyY(Number(yMin), Number(yMax))} className="px-2 py-1 bg-sky-600/50 rounded text-xs text-white hover:bg-sky-600/70">Apply Y</button>
      <button onClick={onReset} className="px-2 py-1 bg-gray-700/50 rounded text-xs text-white hover:bg-gray-700/70">Reset</button>
    </div>
  );
}

// ----------------------------------------------------------------------
// Replay Controls
function ReplayControls({ replayIndex, total, onPlay, onPause, onStop, onSeek, playing, speed, setSpeed, fullData }) {
  const progress = total > 0 ? Math.round((replayIndex / total) * 100) : 0;
  const fmtDate = (candle) => {
    if (!candle) return '';
    const d = new Date(candle.time * 1000);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  };
  const currentCandle = fullData?.[replayIndex - 1];
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-900/20 rounded-xl border border-purple-500/20">
      <span className="text-purple-400 text-[10px] font-semibold tracking-wide">▶ REPLAY</span>
      <span className="text-[10px] text-[#4a5a7a] font-mono">{replayIndex}/{total}</span>
      {currentCandle && <span className="text-[10px] text-purple-200/70 font-mono hidden sm:inline">{fmtDate(currentCandle)}</span>}
      {!playing
        ? <button onClick={onPlay}  className="px-2.5 py-1 text-xs bg-emerald-600/50 hover:bg-emerald-600/70 rounded-lg font-medium">▶ Play</button>
        : <button onClick={onPause} className="px-2.5 py-1 text-xs bg-yellow-600/50 hover:bg-yellow-600/70 rounded-lg font-medium">⏸ Pause</button>
      }
      <button onClick={onStop} className="px-2.5 py-1 text-xs bg-rose-600/50 hover:bg-rose-600/70 rounded-lg font-medium">■ Stop</button>
      <input
        type="range" min="0" max="100" value={progress}
        onChange={e => onSeek(Math.max(1, Math.round((Number(e.target.value) / 100) * total)))}
        className="w-32"
        style={{ accentColor: '#a855f7' }}
      />
      <select value={speed} onChange={e => setSpeed(Number(e.target.value))} className="bg-[#0d1220] text-xs rounded px-1 py-0.5 border border-white/10 text-white">
        {[0.25, 0.5, 1, 2, 5, 10].map(s => <option key={s} value={s}>{s}x</option>)}
      </select>
    </div>
  );
}

// ----------------------------------------------------------------------
// MASTER TOOL LIST — 80+ tools with categories and shortcuts
const TOOLS_DATA = [
  // VIEW
  { category: 'VIEW',          name: 'Cursor',                      shortcut: 'Esc',   mode: 'cursor' },
  // LINES (9)
  { category: 'LINES',         name: 'Trendline',                   shortcut: 'Alt+T', mode: 'line' },
  { category: 'LINES',         name: 'Ray',                         shortcut: 'Alt+H', mode: 'ray' },
  { category: 'LINES',         name: 'Info line',                   shortcut: 'Alt+J', mode: 'infoLine' },
  { category: 'LINES',         name: 'Extended line',               shortcut: 'Alt+V', mode: 'extendedLine' },
  { category: 'LINES',         name: 'Trend angle',                 shortcut: 'Alt+C', mode: 'trendAngle' },
  { category: 'LINES',         name: 'Horizontal line',             shortcut: 'Alt+H', mode: 'horizontalLine' },
  { category: 'LINES',         name: 'Horizontal ray',              shortcut: 'Alt+J', mode: 'horizontalRay' },
  { category: 'LINES',         name: 'Vertical line',               shortcut: 'Alt+V', mode: 'verticalLine' },
  { category: 'LINES',         name: 'Cross line',                  shortcut: 'Alt+C', mode: 'crossLine' },
  // CHANNELS (4)
  { category: 'CHANNELS',      name: 'Parallel channel',            shortcut: '',      mode: 'parallelChannel' },
  { category: 'CHANNELS',      name: 'Regression trend',            shortcut: '',      mode: 'regressionTrend' },
  { category: 'CHANNELS',      name: 'Flat top/bottom',             shortcut: '',      mode: 'flatChannel' },
  { category: 'CHANNELS',      name: 'Disjoint channel',            shortcut: '',      mode: 'disjointChannel' },
  // PITCHFORKS (4)
  { category: 'PITCHFORKS',    name: 'Pitchfork',                   shortcut: '',      mode: 'pitchfork' },
  { category: 'PITCHFORKS',    name: 'Schiff pitchfork',            shortcut: '',      mode: 'schiffPitchfork' },
  { category: 'PITCHFORKS',    name: 'Modified Schiff pitchfork',   shortcut: '',      mode: 'modSchiff' },
  { category: 'PITCHFORKS',    name: 'Inside pitchfork',            shortcut: '',      mode: 'insidePitchfork' },
  // FIBONACCI (11)
  { category: 'FIBONACCI',     name: 'Fib retracement',             shortcut: '',      mode: 'fibRetrace' },
  { category: 'FIBONACCI',     name: 'Trend-based fib extension',   shortcut: '',      mode: 'fibExt' },
  { category: 'FIBONACCI',     name: 'Fib channel',                 shortcut: '',      mode: 'fibChannel' },
  { category: 'FIBONACCI',     name: 'Fib time zone',               shortcut: '',      mode: 'fibTimeZone' },
  { category: 'FIBONACCI',     name: 'Fib speed resistance fan',    shortcut: '',      mode: 'fibFan' },
  { category: 'FIBONACCI',     name: 'Trend-based fib time',        shortcut: '',      mode: 'fibTrendTime' },
  { category: 'FIBONACCI',     name: 'Fib circles',                 shortcut: '',      mode: 'fibCircles' },
  { category: 'FIBONACCI',     name: 'Fib spiral',                  shortcut: '',      mode: 'fibSpiral' },
  { category: 'FIBONACCI',     name: 'Fib speed resistance arcs',   shortcut: '',      mode: 'fibArcs' },
  { category: 'FIBONACCI',     name: 'Fib wedge',                   shortcut: '',      mode: 'fibWedge' },
  { category: 'FIBONACCI',     name: 'Pitchfan',                    shortcut: '',      mode: 'pitchfan' },
  // GANN (4)
  { category: 'GANN',          name: 'Gann box',                    shortcut: '',      mode: 'gannBox' },
  { category: 'GANN',          name: 'Gann square fixed',           shortcut: '',      mode: 'gannSquareFixed' },
  { category: 'GANN',          name: 'Gann square',                 shortcut: '',      mode: 'gannSquare' },
  { category: 'GANN',          name: 'Gann fan',                    shortcut: '',      mode: 'gannFan' },
  // FORECASTING (6)
  { category: 'FORECASTING',   name: 'Long position',               shortcut: '',      mode: 'longPos' },
  { category: 'FORECASTING',   name: 'Short position',              shortcut: '',      mode: 'shortPos' },
  { category: 'FORECASTING',   name: 'Position forecast',           shortcut: '',      mode: 'posForecast' },
  { category: 'FORECASTING',   name: 'Bar pattern',                 shortcut: '',      mode: 'barPattern' },
  { category: 'FORECASTING',   name: 'Ghost feed',                  shortcut: '',      mode: 'ghostFeed' },
  { category: 'FORECASTING',   name: 'Sector',                      shortcut: '',      mode: 'sectorTool' },
  // VOLUME-BASED (3)
  { category: 'VOLUME-BASED',  name: 'Anchored VWAP',               shortcut: '',      mode: 'anchoredVwap' },
  { category: 'VOLUME-BASED',  name: 'Fixed range volume profile',  shortcut: '',      mode: 'fixedRangeVP' },
  { category: 'VOLUME-BASED',  name: 'Anchored volume profile',     shortcut: '',      mode: 'anchoredVP' },
  // MEASURERS (3)
  { category: 'MEASURERS',     name: 'Price range',                 shortcut: '',      mode: 'priceRange' },
  { category: 'MEASURERS',     name: 'Date range',                  shortcut: '',      mode: 'dateRange' },
  { category: 'MEASURERS',     name: 'Date and price range',        shortcut: '',      mode: 'datePriceRange' },
  // TEXT & NOTES (11)
  { category: 'TEXT & NOTES',  name: 'Text',                        shortcut: '',      mode: 'text' },
  { category: 'TEXT & NOTES',  name: 'Anchored text',               shortcut: '',      mode: 'anchoredText' },
  { category: 'TEXT & NOTES',  name: 'Note',                        shortcut: '',      mode: 'note' },
  { category: 'TEXT & NOTES',  name: 'Price note',                  shortcut: '',      mode: 'priceNote' },
  { category: 'TEXT & NOTES',  name: 'Pin',                         shortcut: '',      mode: 'pin' },
  { category: 'TEXT & NOTES',  name: 'Table',                       shortcut: '',      mode: 'tableTool' },
  { category: 'TEXT & NOTES',  name: 'Callout',                     shortcut: '',      mode: 'callout' },
  { category: 'TEXT & NOTES',  name: 'Comment',                     shortcut: '',      mode: 'commentTool' },
  { category: 'TEXT & NOTES',  name: 'Price label',                 shortcut: '',      mode: 'priceLabel' },
  { category: 'TEXT & NOTES',  name: 'Signpost',                    shortcut: '',      mode: 'signpost' },
  { category: 'TEXT & NOTES',  name: 'Flag mark',                   shortcut: '',      mode: 'flagMark' },
  // CONTENT (3)
  { category: 'CONTENT',       name: 'Image',                       shortcut: '',      mode: 'imageTool' },
  { category: 'CONTENT',       name: 'Post',                        shortcut: '',      mode: 'postTool' },
  { category: 'CONTENT',       name: 'Idea',                        shortcut: '',      mode: 'ideaTool' },
  // BRUSHES (2)
  { category: 'BRUSHES',       name: 'Brush',                       shortcut: '',      mode: 'brush' },
  { category: 'BRUSHES',       name: 'Highlighter',                 shortcut: '',      mode: 'highlighter' },
  // ARROWS (4)
  { category: 'ARROWS',        name: 'Arrow marker',                shortcut: '',      mode: 'arrowMarker' },
  { category: 'ARROWS',        name: 'Arrow',                       shortcut: '',      mode: 'arrow' },
  { category: 'ARROWS',        name: 'Arrow mark up',               shortcut: '',      mode: 'arrowUp' },
  { category: 'ARROWS',        name: 'Arrow mark down',             shortcut: '',      mode: 'arrowDown' },
  // SHAPES (10)
  { category: 'SHAPES',        name: 'Rectangle',                   shortcut: '',      mode: 'rectangle' },
  { category: 'SHAPES',        name: 'Rotated rectangle',           shortcut: '',      mode: 'rotatedRect' },
  { category: 'SHAPES',        name: 'Path',                        shortcut: '',      mode: 'pathTool' },
  { category: 'SHAPES',        name: 'Circle',                      shortcut: '',      mode: 'circle' },
  { category: 'SHAPES',        name: 'Ellipse',                     shortcut: '',      mode: 'ellipse' },
  { category: 'SHAPES',        name: 'Polyline',                    shortcut: '',      mode: 'polyline' },
  { category: 'SHAPES',        name: 'Triangle',                    shortcut: '',      mode: 'triangle' },
  { category: 'SHAPES',        name: 'Arc',                         shortcut: '',      mode: 'arcTool' },
  { category: 'SHAPES',        name: 'Curve',                       shortcut: '',      mode: 'curveTool' },
  { category: 'SHAPES',        name: 'Double curve',                shortcut: '',      mode: 'doubleCurve' },
  // MISC (5)
  { category: 'MISC',          name: 'Cross',                       shortcut: '',      mode: 'crossMarker' },
  { category: 'MISC',          name: 'Dot',                         shortcut: '',      mode: 'dotMarker' },
  { category: 'MISC',          name: 'Arrow (extra)',               shortcut: '',      mode: 'arrowExtra' },
  { category: 'MISC',          name: 'Demonstration',               shortcut: '',      mode: 'demoDraw' },
  { category: 'MISC',          name: 'Eraser',                      shortcut: '',      mode: 'eraser' },
];

// Group tools by category for rendering
const TOOLS_BY_CATEGORY = TOOLS_DATA.reduce((acc, tool) => {
  if (!acc[tool.category]) acc[tool.category] = [];
  acc[tool.category].push(tool);
  return acc;
}, {});

// Drawing Tools Panel (left side, collapsible)
function DrawingToolsPanel({ activeTool, setActiveTool, panelOpen, setPanelOpen }) {
  return (
    <div
      className="border-r border-white/[0.06] bg-[#111417] shrink-0 flex flex-col transition-all duration-300"
      style={{ width: panelOpen ? 224 : 32 }}
    >
      {/* Collapse toggle */}
      <button
        onClick={() => setPanelOpen(v => !v)}
        title={panelOpen ? 'Collapse tools' : 'Expand tools'}
        className="w-full flex items-center justify-center py-2 border-b border-white/[0.06] text-[#4a5a7a] hover:text-white transition-colors text-xs shrink-0"
      >
        {panelOpen ? '‹ Tools' : '›'}
      </button>

      {panelOpen && (
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a3a52 transparent' }}>
          {Object.entries(TOOLS_BY_CATEGORY).map(([category, tools]) => (
            <div key={category} className="border-b border-white/[0.05] px-2 py-2">
              <p className="text-[9px] uppercase tracking-widest text-[#2a3a52] font-bold mb-1.5 px-1">{category}</p>
              <div className="flex flex-wrap gap-1">
                {tools.map(tool => (
                  <button
                    key={tool.mode}
                    onClick={() => setActiveTool(tool.mode)}
                    title={tool.shortcut ? `${tool.name} (${tool.shortcut})` : tool.name}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium transition-all border',
                      activeTool === tool.mode
                        ? 'bg-sky-500/20 border-sky-400/50 text-sky-200 shadow-sm shadow-sky-900/30'
                        : 'bg-white/[0.04] border-white/[0.06] text-[#7a8fab] hover:bg-white/[0.08] hover:text-white hover:border-white/20'
                    )}
                  >
                    <span className="truncate max-w-[110px]">{tool.name}</span>
                    {tool.shortcut && (
                      <span className="shrink-0 bg-[#0a0e18] border border-yellow-400/30 text-yellow-300/70 text-[8px] px-1 rounded-full font-mono">
                        {tool.shortcut}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------
// Drawing canvas helpers (pure functions, no React state)
function renderShapeOnCtx(ctx, shape, chartCtx = {}) {
  if (!shape) return;
  ctx.save();
  ctx.strokeStyle = shape.color || '#FFD966';
  ctx.lineWidth   = shape.width  || 2;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  if (shape.type === 'line' && shape.points && shape.points.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(shape.points[0].x, shape.points[0].y);
    ctx.lineTo(shape.points[1].x, shape.points[1].y);
    ctx.stroke();
  } else if (shape.type === 'ray' && shape.points && shape.points.length >= 2) {
    const [p0, p1] = shape.points;
    let dx = p1.x - p0.x, dy = p1.y - p0.y;
    let t1 = -p0.x/dx, t2 = (w-p0.x)/dx;
    let t = Math.max(t1, t2);
    if (!isFinite(t) || isNaN(t)) t = 10000;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p0.x + t*dx, p0.y + t*dy); ctx.stroke();
  } else if (shape.type === 'extendedLine' && shape.points && shape.points.length >= 2) {
    const [p0, p1] = shape.points;
    let ddx = p1.x - p0.x, ddy = p1.y - p0.y;
    ctx.beginPath(); ctx.moveTo(p0.x - ddx*100, p0.y - ddy*100); ctx.lineTo(p0.x + ddx*100, p0.y + ddy*100); ctx.stroke();
  } else if (shape.type === 'horizontalLine') {
    ctx.beginPath(); ctx.moveTo(0, shape.y); ctx.lineTo(w, shape.y); ctx.stroke();
  } else if (shape.type === 'verticalLine') {
    ctx.beginPath(); ctx.moveTo(shape.x, 0); ctx.lineTo(shape.x, h); ctx.stroke();
  } else if (shape.type === 'crossLine' && shape.point) {
    ctx.beginPath(); ctx.moveTo(0, shape.point.y); ctx.lineTo(w, shape.point.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(shape.point.x, 0); ctx.lineTo(shape.point.x, h); ctx.stroke();
  } else if (shape.type === 'rectangle' && shape.points && shape.points.length >= 2) {
    const [p0, p1] = shape.points;
    ctx.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
  } else if (shape.type === 'circle' && shape.center) {
    ctx.beginPath();
    const r = shape.edge ? Math.hypot(shape.edge.x - shape.center.x, shape.edge.y - shape.center.y) : (shape.radius || 10);
    ctx.arc(shape.center.x, shape.center.y, r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape.type === 'ellipse' && shape.center) {
    ctx.beginPath();
    const rx = shape.edge ? Math.abs(shape.edge.x - shape.center.x) : (shape.radiusX || 10);
    const ry = shape.edge ? Math.abs(shape.edge.y - shape.center.y) : (shape.radiusY || 10);
    ctx.ellipse(shape.center.x, shape.center.y, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape.type === 'arrow' && shape.points && shape.points.length >= 2) {
    _drawArrow(ctx, shape.points[0], shape.points[1], shape.color || '#FFD966');
  } else if (shape.type === 'text' && shape.position) {
    ctx.font = '13px Inter, system-ui, sans-serif';
    ctx.fillStyle = shape.color || '#FFD966';
    ctx.fillText(shape.content, shape.position.x, shape.position.y);
  } else if (shape.type === 'fibRetrace' && shape.points && shape.points.length >= 2) {
    const [p1, p2] = shape.points;
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    const colors = ['#ff6b6b','#ffd700','#7bc8a4','#60a5fa','#7bc8a4','#ffd700','#ff6b6b'];
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    levels.forEach((l, i) => {
      const y = p1.y + (p2.y - p1.y) * l;
      ctx.beginPath(); ctx.moveTo(p1.x, y); ctx.lineTo(p2.x, y);
      ctx.strokeStyle = colors[i]; ctx.stroke();
      ctx.fillStyle   = colors[i];
      ctx.font = '9px monospace';
      ctx.fillText(`${(l * 100).toFixed(1)}%`, p1.x + 4, y - 3);
    });
  } else if (shape.type === 'gannBox' && shape.points && shape.points.length >= 2) {
    const [p0, p1] = shape.points;
    ctx.strokeRect(p0.x, p0.y, p1.x - p0.x, p1.y - p0.y);
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p0.x, p1.y); ctx.lineTo(p1.x, p0.y); ctx.stroke();
  } else if (shape.type === 'pitchfork' && shape.points && shape.points.length >= 3) {
    const [a, b, c] = shape.points;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    const midX = (b.x + c.x) / 2, midY = (b.y + c.y) / 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(midX, midY); ctx.stroke();
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    ctx.setLineDash([]);
  } else if (shape.type === 'channel' && shape.points && shape.points.length >= 3) {
    const [a, b, c] = shape.points;
    let offsetX = c.x - a.x, offsetY = c.y - a.y;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x + offsetX, a.y + offsetY); ctx.lineTo(b.x + offsetX, b.y + offsetY); ctx.stroke();
  } else if (shape.type === 'triangle' && shape.points && shape.points.length >= 3) {
    ctx.beginPath();
    ctx.moveTo(shape.points[0].x, shape.points[0].y);
    ctx.lineTo(shape.points[1].x, shape.points[1].y);
    ctx.lineTo(shape.points[2].x, shape.points[2].y);
    ctx.closePath(); ctx.stroke();
  } else if (shape.type === 'freeBrush' && shape.pointsArray && shape.pointsArray.length > 0) {
    if (shape.tool === 'highlighter') {
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = shape.width * 4;
    }
    ctx.beginPath();
    ctx.moveTo(shape.pointsArray[0].x, shape.pointsArray[0].y);
    for (let i = 1; i < shape.pointsArray.length; i++) {
        ctx.lineTo(shape.pointsArray[i].x, shape.pointsArray[i].y);
    }
    ctx.stroke();
  } else if (shape.type === 'polyline' && shape.points && shape.points.length > 0) {
    ctx.beginPath();
    ctx.moveTo(shape.points[0].x, shape.points[0].y);
    for (let i = 1; i < shape.points.length; i++) {
        ctx.lineTo(shape.points[i].x, shape.points[i].y);
    }
    ctx.stroke();
  } else if (shape.type === 'priceRange' && shape.points && shape.points.length >= 2) {
    const [p0, p1] = shape.points;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p0.x, p1.y); ctx.stroke();
    ctx.font = '11px monospace';
    ctx.fillStyle = shape.color || '#FFD966';
    ctx.fillText(`$${Math.abs(p0.y - p1.y).toFixed(0)}`, p0.x + 5, (p0.y + p1.y) / 2);
  } else if (shape.type === 'dateRange' && shape.points && shape.points.length >= 2) {
    const [p0, p1] = shape.points;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p0.y); ctx.stroke();
  } else if (shape.type === 'horizontalRay' && shape.points && shape.points.length >= 2) {
    const [p0, p1] = shape.points;
    const direction = p1.x >= p0.x ? "right" : "left";
    ctx.beginPath();
    ctx.moveTo(direction === "right" ? p0.x : 0, p0.y);
    ctx.lineTo(direction === "right" ? w : p0.x, p0.y);
    ctx.stroke();
  } else if (shape.type === 'trendAngle' && shape.points && shape.points.length >= 2) {
    const [p1, p2] = shape.points;
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    let midX = (p1.x + p2.x) / 2;
    let midY = (p1.y + p2.y) / 2;
    let angleRad = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    let angleDeg = angleRad * (180 / Math.PI);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(midX - 25, midY - 12, 50, 18);
    ctx.fillStyle = shape.color || '#FFD966';
    ctx.font = "11px monospace";
    ctx.fillText(`${Math.abs(angleDeg).toFixed(1)}°`, midX - 20, midY + 1);
  } else if (shape.type === 'fixedRangeVP' && shape.points && shape.points.length >= 2) {
    const [p0, p1] = shape.points;
    const minX = Math.min(p0.x, p1.x), maxX = Math.max(p0.x, p1.x);
    const { fullData, series } = chartCtx;
    
    if (fullData && series && p0.logical !== undefined && p1.logical !== undefined) {
        const startIdx = Math.max(0, Math.min(Math.round(p0.logical), Math.round(p1.logical)));
        const endIdx = Math.min(fullData.length - 1, Math.max(Math.round(p0.logical), Math.round(p1.logical)));
        const slice = fullData.slice(startIdx, endIdx + 1);
        
        if (slice.length > 0) {
            let minP = Infinity, maxP = -Infinity;
            slice.forEach(c => { minP = Math.min(minP, c.low); maxP = Math.max(maxP, c.high); });
            
            const binsCount = 24;
            const binSize = (maxP - minP) / binsCount;
            const bins = Array.from({ length: binsCount }, () => ({ up: 0, down: 0, total: 0 }));
            
            slice.forEach(c => {
                const isUp = c.close >= c.open;
                const vol = c.volume || 0;
                const center = (c.high + c.low) / 2;
                const bIdx = Math.min(binsCount - 1, Math.max(0, Math.floor((center - minP) / binSize)));
                bins[bIdx].total += vol;
                if (isUp) bins[bIdx].up += vol; else bins[bIdx].down += vol;
            });
            
            let maxVol = 0, pocY = 0;
            bins.forEach((b, i) => { 
                if (b.total > maxVol) {
                    maxVol = b.total; 
                    pocY = series.priceToCoordinate(minP + (i + 0.5) * binSize); 
                }
            });
            
            const startY = series.priceToCoordinate(maxP);
            const endY = series.priceToCoordinate(minP);
            
            // bg
            ctx.fillStyle = "rgba(13, 20, 35, 0.4)";
            ctx.fillRect(minX, startY, maxX - minX, endY - startY);
            
            // bins
            bins.forEach((b, i) => {
                const botY = series.priceToCoordinate(minP + i * binSize);
                const topY = series.priceToCoordinate(minP + (i + 1) * binSize);
                const h = botY - topY - 1; // 1px margin
                
                const maxW = maxX - minX;
                const barW = maxVol > 0 ? (b.total / maxVol) * maxW * 0.75 : 0;
                if (barW > 0) {
                    const wUp = (b.up / b.total) * barW;
                    const wDown = (b.down / b.total) * barW;
                    
                    ctx.fillStyle = "rgba(38, 166, 154, 0.5)"; // Green
                    ctx.fillRect(minX, topY, wUp, h);
                    ctx.fillStyle = "rgba(239, 83, 80, 0.5)"; // Red
                    ctx.fillRect(minX + wUp, topY, wDown, h);
                }
            });
            
            // POC
            if (pocY) {
                ctx.strokeStyle = "rgba(242, 54, 69, 0.9)";
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(minX, pocY); ctx.lineTo(maxX, pocY); ctx.stroke();
            }
        }
    }
  } else if (shape.type === 'anchoredVwap' && shape.points && shape.points.length >= 2) {
    const [p0, p1] = shape.points;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo((p0.x + p1.x)/2, p0.y - 50, p1.x, p1.y);
    ctx.stroke();
  } else if (shape.type === 'arc' && shape.points && shape.points.length >= 3) {
    const [start, control, end] = shape.points;
    ctx.beginPath(); ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
    ctx.stroke();
  } else if (shape.type === 'curve' && shape.points && shape.points.length >= 3) {
    const [start, control, end] = shape.points;
    ctx.beginPath(); ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(control.x, control.y, end.x, end.y);
    ctx.stroke();
  } else if (shape.type === 'doubleCurve' && shape.points && shape.points.length >= 3) {
    const [start, control, end] = shape.points;
    ctx.beginPath(); ctx.moveTo(start.x, start.y - 25); ctx.quadraticCurveTo(control.x, control.y - 25, end.x, end.y - 25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(start.x, start.y + 25); ctx.quadraticCurveTo(control.x, control.y + 25, end.x, end.y + 25); ctx.stroke();
  } else if (shape.type === 'longPos' && shape.point) {
    const {x, y} = shape.point;
    const targetY = shape.targetY !== undefined ? shape.targetY : y - 60;
    const stopY = shape.stopY !== undefined ? shape.stopY : y + 60;
    const targetPrice = shape.targetPrice || 0;
    const stopPrice = shape.stopPrice || 0;
    const entryPrice = shape.point.price || 0;
    const w = 180;
    
    const hTarget = y - targetY;
    ctx.fillStyle = "rgba(8, 153, 129, 0.15)";
    ctx.fillRect(x - w/2, targetY, w, hTarget);
    ctx.strokeStyle = "rgba(8, 153, 129, 0.4)";
    ctx.strokeRect(x - w/2, targetY, w, hTarget);

    const hStop = stopY - y;
    ctx.fillStyle = "rgba(242, 54, 69, 0.15)";
    ctx.fillRect(x - w/2, y, w, hStop);
    ctx.strokeStyle = "rgba(242, 54, 69, 0.4)";
    ctx.strokeRect(x - w/2, y, w, hStop);

    ctx.strokeStyle = "#434651";
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x - w/2, y); ctx.lineTo(x + w/2, y); ctx.stroke();
    ctx.setLineDash([]);
    
    const drawLabel = (lx, ly, text, bg) => {
        ctx.font = "11px Inter, system-ui, sans-serif";
        const tw = ctx.measureText(text).width + 12;
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx - tw/2, ly - 8, tw, 18, 4) : ctx.rect(lx - tw/2, ly - 8, tw, 18); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(text, lx - tw/2 + 6, ly + 5);
    };

    const drawHandle = (hx, hy) => {
        ctx.fillStyle = "#0d1220";
        ctx.strokeStyle = "#2962FF";
        ctx.lineWidth = 1.5;
        const s = 6;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(hx - s/2, hy - s/2, s, s, 2) : ctx.rect(hx - s/2, hy - s/2, s, s); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 1;
    };

    const tDiff = entryPrice > 0 ? ((targetPrice - entryPrice) / entryPrice * 100).toFixed(2) : '2.00';
    const sDiff = entryPrice > 0 ? ((entryPrice - stopPrice) / entryPrice * 100).toFixed(2) : '1.00';
    const rr = (Math.abs(targetPrice - entryPrice) / (Math.abs(entryPrice - stopPrice) || 1)).toFixed(2);
    
    drawLabel(x, targetY, `Target: ${Math.abs(targetPrice - entryPrice).toFixed(2)} (${Math.abs(tDiff)}%)`, "#089981");
    drawLabel(x, stopY, `Stop: ${Math.abs(entryPrice - stopPrice).toFixed(2)} (${Math.abs(sDiff)}%)`, "#f23645");
    drawLabel(x, y, `Open P&L: 0.00 Risk/reward: ${rr}`, "#f23645");

    drawHandle(x - w/2, targetY); drawHandle(x + w/2, targetY);
    drawHandle(x - w/2, y);       drawHandle(x + w/2, y);
    drawHandle(x - w/2, stopY);   drawHandle(x + w/2, stopY);
  } else if (shape.type === 'shortPos' && shape.point) {
    const {x, y} = shape.point;
    const targetY = shape.targetY !== undefined ? shape.targetY : y + 60;
    const stopY = shape.stopY !== undefined ? shape.stopY : y - 60;
    const targetPrice = shape.targetPrice || 0;
    const stopPrice = shape.stopPrice || 0;
    const entryPrice = shape.point.price || 0;
    const w = 180;
    
    const hStop = y - stopY;
    ctx.fillStyle = "rgba(242, 54, 69, 0.15)";
    ctx.fillRect(x - w/2, stopY, w, hStop);
    ctx.strokeStyle = "rgba(242, 54, 69, 0.4)";
    ctx.strokeRect(x - w/2, stopY, w, hStop);

    const hTarget = targetY - y;
    ctx.fillStyle = "rgba(8, 153, 129, 0.15)";
    ctx.fillRect(x - w/2, y, w, hTarget);
    ctx.strokeStyle = "rgba(8, 153, 129, 0.4)";
    ctx.strokeRect(x - w/2, y, w, hTarget);

    ctx.strokeStyle = "#434651";
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(x - w/2, y); ctx.lineTo(x + w/2, y); ctx.stroke();
    ctx.setLineDash([]);
    
    const drawLabel = (lx, ly, text, bg) => {
        ctx.font = "11px Inter, system-ui, sans-serif";
        const tw = ctx.measureText(text).width + 12;
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(lx - tw/2, ly - 8, tw, 18, 4) : ctx.rect(lx - tw/2, ly - 8, tw, 18); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(text, lx - tw/2 + 6, ly + 5);
    };

    const drawHandle = (hx, hy) => {
        ctx.fillStyle = "#0d1220";
        ctx.strokeStyle = "#2962FF";
        ctx.lineWidth = 1.5;
        const s = 6;
        ctx.beginPath(); ctx.roundRect ? ctx.roundRect(hx - s/2, hy - s/2, s, s, 2) : ctx.rect(hx - s/2, hy - s/2, s, s); ctx.fill(); ctx.stroke();
        ctx.lineWidth = 1;
    };

    const tDiff = entryPrice > 0 ? ((entryPrice - targetPrice) / entryPrice * 100).toFixed(2) : '2.00';
    const sDiff = entryPrice > 0 ? ((stopPrice - entryPrice) / entryPrice * 100).toFixed(2) : '1.00';
    const rr = (Math.abs(entryPrice - targetPrice) / (Math.abs(stopPrice - entryPrice) || 1)).toFixed(2);
    
    drawLabel(x, stopY, `Stop: ${Math.abs(stopPrice - entryPrice).toFixed(2)} (${Math.abs(sDiff)}%)`, "#f23645");
    drawLabel(x, targetY, `Target: ${Math.abs(entryPrice - targetPrice).toFixed(2)} (${Math.abs(tDiff)}%)`, "#089981");
    drawLabel(x, y, `Open P&L: 0.00 Risk/reward: ${rr}`, "#f23645");

    drawHandle(x - w/2, targetY); drawHandle(x + w/2, targetY);
    drawHandle(x - w/2, y);       drawHandle(x + w/2, y);
    drawHandle(x - w/2, stopY);   drawHandle(x + w/2, stopY);
  } else if (shape.type === 'basicShape' && shape.points && shape.points.length >= 1) {
    if (shape.subType === 'cross') {
      const p = shape.points[0];
      const s = 9;
      ctx.beginPath(); ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s); ctx.stroke();
    } else if (shape.subType === 'dot') {
      const p = shape.points[0];
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = shape.color || '#FFD966'; ctx.fill();
    }
  }
  ctx.restore();
}

function _drawArrow(ctx, from, to, color) {
  ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size  = 13;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - size * Math.cos(angle - Math.PI / 6), to.y - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(to.x - size * Math.cos(angle + Math.PI / 6), to.y - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

function buildShape(mode, start, end, color, width) {
  const modeStr = mode || 'line';
  
  if (['line', 'ray', 'infoLine', 'extendedLine', 'trendAngle', 'horizontalLine', 'horizontalRay', 'verticalLine', 'crossLine', 'fibExt', 'fibChannel', 'fibTimeZone', 'fibFan', 'fibTrendTime', 'fibCircles', 'fibSpiral', 'fibArcs', 'fibWedge', 'pitchfan', 'gannSquare', 'gannSquareFixed', 'gannFan', 'longPos', 'shortPos', 'posForecast', 'barPattern', 'ghostFeed', 'sectorTool', 'anchoredVwap', 'fixedRangeVP', 'anchoredVP', 'arcTool', 'curveTool', 'doubleCurve', 'demoDraw'].includes(modeStr)) {
    if (modeStr === 'ray') return { type: 'ray', points: [start, end], color, width };
    if (modeStr === 'extendedLine') return { type: 'extendedLine', points: [start, end], color, width };
    if (modeStr === 'horizontalRay') return { type: 'horizontalRay', points: [start, end], color, width };
    if (modeStr === 'trendAngle') return { type: 'trendAngle', points: [start, end], color, width };
    if (modeStr === 'anchoredVwap') return { type: 'anchoredVwap', points: [start, end], color, width };
    if (modeStr === 'fixedRangeVP') return { type: 'fixedRangeVP', points: [start, end], color, width };
    return { type: 'line', points: [start, end], color, width };
  }
  
  if (modeStr === 'rectangle' || modeStr === 'rotatedRect')
    return { type: 'rectangle', points: [start, end], color, width };
  if (modeStr === 'circle')
    return { type: 'circle', center: start, edge: end, color, width };
  if (modeStr === 'ellipse')
    return { type: 'ellipse', center: start, edge: end, color, width };
  if (['arrow', 'arrowMarker', 'arrowExtra', 'arrowUp', 'arrowDown'].includes(modeStr))
    return { type: 'arrow', points: [start, end], color, width };
  if (modeStr === 'fibRetrace')
    return { type: 'fibRetrace', points: [start, end], color, width };
  if (modeStr === 'gannBox')
    return { type: 'gannBox', points: [start, end], color, width };
  if (modeStr === 'triangle')
    return { type: 'triangle', points: [start, end, { x: start.x + (end.x - start.x) / 2, y: start.y - 45 }], color, width };
  if (modeStr === 'priceRange')
    return { type: 'priceRange', points: [start, end], color, width };
  if (modeStr === 'dateRange' || modeStr === 'datePriceRange')
    return { type: 'dateRange', points: [start, end], color, width };
  return { type: 'line', points: [start, end], color, width };
}

function eraseAt(drawings, x, y) {
  for (let i = drawings.length - 1; i >= 0; i--) {
    const s = drawings[i];
    if (s.type === 'line' && s.points && s.points.length >= 2 && _distToSeg(x, y, s.points[0], s.points[1]) < 9) return i;
    if (s.type === 'rectangle' && s.points && s.points.length >= 2) {
      const [p0, p1] = s.points;
      if (x >= Math.min(p0.x, p1.x) && x <= Math.max(p0.x, p1.x) &&
          y >= Math.min(p0.y, p1.y) && y <= Math.max(p0.y, p1.y)) return i;
    }
    if (s.type === 'circle' && s.center) {
      const r = s.edge ? Math.hypot(s.edge.x - s.center.x, s.edge.y - s.center.y) : (s.radius || 10);
      if (Math.hypot(x - s.center.x, y - s.center.y) <= r + 7) return i;
    }
    if (s.type === 'text' && s.position && Math.hypot(x - s.position.x, y - s.position.y) < 15) return i;
    if (s.type === 'basicShape' && s.points && s.points.length >= 1 && Math.hypot(x - s.points[0].x, y - s.points[0].y) < 14) return i;
    if ((s.type === 'longPos' || s.type === 'shortPos') && s.point) {
        if (x >= s.point.x - 90 && x <= s.point.x + 90 && y >= s.point.y - 60 && y <= s.point.y + 60) return i;
    }
  }
  return -1;
}

function _distToSeg(px, py, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const t   = ((px - a.x) * abx + (py - a.y) * aby) / (abx * abx + aby * aby || 1);
  const tx  = a.x + Math.max(0, Math.min(1, t)) * abx;
  const ty  = a.y + Math.max(0, Math.min(1, t)) * aby;
  return Math.hypot(px - tx, py - ty);
}

// ----------------------------------------------------------------------
// Loading Overlay
function LoadingOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0d1220]/80 backdrop-blur-[2px]">
      <div className="w-8 h-8 rounded-full border-2 border-sky-400/30 border-t-sky-400 animate-spin mb-3" />
      <p className="text-xs text-[#4a5a7a]">Loading chart data…</p>
    </div>
  );
}

// ----------------------------------------------------------------------
// Main Chart Component
export default function Chart({
  candles = [],
  interval = '1h',
  onIntervalChange,
  loading = false,
  livePrice = null,
  symbol = '',
  assetType = 'CRYPTO',
  usdInr = null,
  holding = null,
  fmt,
  onBuy,
  onSell,
  nseOpen = true,
}) {
  const chartContainerRef = useRef(null);
  const wrapperRef        = useRef(null);
  const chartRef          = useRef(null);
  const seriesRef         = useRef(null);
  const volumeSeriesRef   = useRef(null);
  const replayTimerRef    = useRef(null);
  const candlesDataRef    = useRef([]);

  // Drawing overlay canvas
  const drawCanvasRef  = useRef(null);
  const drawingsRef    = useRef([]);   // array of finished shapes
  const isDrawingRef   = useRef(false);
  const startPointRef  = useRef(null);
  const tempShapeRef   = useRef(null);
  const strokeColorRef = useRef('#FFD966');
  const strokeWidthRef = useRef(2);
  const activeToolRef  = useRef('cursor'); // always current — avoids stale closures in event handlers
  
  const drawModeRef       = useRef('2point'); // '2point', '3point', 'freehand'
  const pendingPointsRef  = useRef([]);
  const freehandPointsRef = useRef([]);
  const dragActionRef     = useRef(null);

  // React state for UI
  const [drawColor,  setDrawColor]  = useState('#FFD966');
  const [drawWidth,  setDrawWidth]  = useState(2);
  const [drawCount,  setDrawCount]  = useState(0); // triggers re-render on changes

  // Replay state
  const [replayActive,     setReplayActive]     = useState(false);
  const [replayPlaying,    setReplayPlaying]    = useState(false);
  const [replayIndex,      setReplayIndex]      = useState(0);
  const [replaySpeed,      setReplaySpeed]      = useState(1);
  const [replaySelectMode, setReplaySelectMode] = useState(false); // true = waiting for dblclick on chart

  // Drawing tool state
  const [activeTool,  setActiveTool]  = useState('cursor');
  const [panelOpen,   setPanelOpen]   = useState(true);

  // Fixed range panel visibility
  const [showFixedRange, setShowFixedRange] = useState(false);

  // Selection state for drawings
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });

  // Keep refs in sync with state
  useEffect(() => { strokeColorRef.current = drawColor; }, [drawColor]);
  useEffect(() => { strokeWidthRef.current = drawWidth; }, [drawWidth]);
  useEffect(() => { activeToolRef.current  = activeTool; }, [activeTool]);

  // --------------------------------------------------
  // Persistence: Save and Load Drawings
  // --------------------------------------------------
  useEffect(() => {
    if (!symbol) return;
    try {
      const saved = localStorage.getItem(`drawings-${symbol}`);
      if (saved) {
        drawingsRef.current = JSON.parse(saved);
        setDrawCount(drawingsRef.current.length);
        requestAnimationFrame(() => {
          if (drawCanvasRef.current) {
            const ctx = drawCanvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height);
            drawingsRef.current.forEach(s => renderShapeOnCtx(ctx, s));
          }
        });
      } else {
        drawingsRef.current = [];
        setDrawCount(0);
        requestAnimationFrame(() => {
          if (drawCanvasRef.current) {
            const ctx = drawCanvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height);
          }
        });
      }
    } catch (e) {
      console.warn("Could not load drawings", e);
    }
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    try {
      localStorage.setItem(`drawings-${symbol}`, JSON.stringify(drawingsRef.current));
    } catch (e) {
      console.warn("Could not save drawings", e);
    }
  }, [drawCount, symbol]);

  // --------------------------------------------------
  // 1. Create lightweight-charts chart once on mount
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const el = chartContainerRef.current;

    const chart = createChart(el, {
      width:  el.clientWidth  || 800,
      height: el.clientHeight || 520,
      layout: {
        background: { type: ColorType.Solid, color: '#0d1220' },
        textColor:  '#7a8fa8',
        fontSize:   11,
      },
      grid: {
        vertLines: { color: '#1a2535' },
        horzLines: { color: '#1a2535' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#3a5070', labelBackgroundColor: '#1e3a5f' },
        horzLine: { color: '#3a5070', labelBackgroundColor: '#1e3a5f' },
      },
      timeScale: {
        borderColor:    '#1e293b',
        timeVisible:    true,
        secondsVisible: false,
        fixLeftEdge:    false,
        fixRightEdge:   false,
      },
      rightPriceScale: { borderColor: '#1e293b' },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:       '#26a69a',
      downColor:     '#ef5350',
      borderVisible: false,
      wickUpColor:   '#26a69a',
      wickDownColor: '#ef5350',
    });

    const volSeries = chart.addSeries(HistogramSeries, {
      color:        '#26a69a40',
      priceFormat:  { type: 'volume' },
      priceScaleId: 'vol',
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    chartRef.current        = chart;
    seriesRef.current       = candleSeries;
    volumeSeriesRef.current = volSeries;

    // Use ResizeObserver — fires whenever the container changes size.
    // We defer inside rAF so the chart measures AFTER layout has fully settled
    // (fixes stale dimensions when window is restored from minimized state).
    let rafId = null;
    const applySize = (forceFit = false) => {
      if (!chartContainerRef.current || !chartRef.current) return;
      const el = chartContainerRef.current;
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        chartRef.current.applyOptions({ width: w, height: h });
        if (forceFit) {
          const data = candlesDataRef.current;
          if (data && data.length > 0) {
            // First fitContent to let the library calculate its preferred range
            chartRef.current.timeScale().fitContent();
            // Then explicitly force the logical range to show all data
            // This is the "nuclear option" for when fitContent fails
            chartRef.current.timeScale().setVisibleLogicalRange({
              from: 0,
              to: data.length - 1
            });
          }
        }
      }
    };

    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => applySize(true));
    });
    ro.observe(el);

    // Window resize fallback
    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(applySize);
    };
    window.addEventListener('resize', handleResize);

    // When window is restored from minimized state the browser fires visibilitychange
    // and/or focus — force a re-measure so the chart fills its container correctly.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestAnimationFrame(() => requestAnimationFrame(() => applySize(true)));
      }
    };
    const handleFocus = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => applySize(true)));
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    // Fullscreen enter/exit — fire resize+fit at multiple delays because
    // fullscreen transitions are animated and layout takes time to settle.
    const fsTimers = [];
    const handleFullscreen = () => {
      fsTimers.forEach(id => clearTimeout(id));
      fsTimers.length = 0;
      // Apply at multiple intervals to ensure we catch the moment layout settles.
      // We use slightly longer delays to ensure the browser transition is 100% done.
      [50, 200, 400, 750, 1200, 2000].forEach(delay => {
        const id = setTimeout(() => applySize(true), delay);
        fsTimers.push(id);
      });
    };
    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('webkitfullscreenchange', handleFullscreen); // Safari

    return () => {
      cancelAnimationFrame(rafId);
      fsTimers.forEach(id => clearTimeout(id));
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('fullscreenchange', handleFullscreen);
      document.removeEventListener('webkitfullscreenchange', handleFullscreen);
      chart.remove();
      chartRef.current        = null;
      seriesRef.current       = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  // --------------------------------------------------
  // 2. Update chart whenever candles change
  useEffect(() => {
    if (!seriesRef.current || !volumeSeriesRef.current) return;
    if (!candles || candles.length === 0) return;

    const sorted = [...candles].sort((a, b) => a.time - b.time);
    const seen  = new Set();
    const clean = sorted.filter(c => {
      if (seen.has(c.time)) return false;
      seen.add(c.time);
      return true;
    });
    candlesDataRef.current = clean;

    if (replayActive) {
      const slice = clean.slice(0, replayIndex);
      seriesRef.current.setData(slice);
      volumeSeriesRef.current.setData(
        slice.map(c => ({ time: c.time, value: c.volume || 0, color: c.close >= c.open ? '#26a69a40' : '#ef535040' }))
      );
    } else {
      seriesRef.current.setData(clean);
      volumeSeriesRef.current.setData(
        clean.map(c => ({ time: c.time, value: c.volume || 0, color: c.close >= c.open ? '#26a69a40' : '#ef535040' }))
      );
      // fitContent is the most reliable way to restore the view after data changes
      setTimeout(() => {
        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
      }, 80);
    }
  }, [candles, replayActive, replayIndex]);

  // --------------------------------------------------
  // 3. Replay engine
  const fullData = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    const sorted = [...candles].sort((a, b) => a.time - b.time);
    const seen = new Set();
    return sorted.filter(c => { if (seen.has(c.time)) return false; seen.add(c.time); return true; });
  }, [candles]);

  useEffect(() => {
    if (!replayActive || !replayPlaying) {
      clearInterval(replayTimerRef.current);
      return;
    }
    const msPerStep = Math.max(50, Math.round(400 / replaySpeed));
    replayTimerRef.current = setInterval(() => {
      setReplayIndex(prev => {
        const next = prev + 1;
        if (next >= fullData.length) {
          setReplayPlaying(false);
          clearInterval(replayTimerRef.current);
          return prev;
        }
        return next;
      });
    }, msPerStep);
    return () => clearInterval(replayTimerRef.current);
  }, [replayActive, replayPlaying, replaySpeed, fullData.length]);

  const startReplay = (fromIndex) => {
    const idx = fromIndex != null ? fromIndex : Math.max(1, Math.floor(fullData.length * 0.3));
    setReplayActive(true);
    setReplayIndex(Math.max(1, Math.min(idx, fullData.length)));
    setReplayPlaying(false);
    setReplaySelectMode(false);
  };

  const stopReplay = () => {
    clearInterval(replayTimerRef.current);
    setReplayActive(false);
    setReplayPlaying(false);
    setReplayIndex(0);
    setReplaySelectMode(false);
    if (seriesRef.current && fullData.length) {
      seriesRef.current.setData(fullData);
      volumeSeriesRef.current?.setData(
        fullData.map(c => ({ time: c.time, value: c.volume || 0, color: c.close >= c.open ? '#26a69a40' : '#ef535040' }))
      );
      chartRef.current?.timeScale().fitContent();
    }
  };

  // --------------------------------------------------
  // 4. Fixed range handlers
  const applyXRange = (from, to) => {
    if (chartRef.current && !isNaN(from) && !isNaN(to) && from < to) {
      chartRef.current.timeScale().setVisibleRange({ from, to });
    }
  };
  const applyYRange = (min, max) => {
    if (chartRef.current && !isNaN(min) && !isNaN(max) && min < max) {
      chartRef.current.priceScale('right').applyOptions({ autoScale: false, minimum: min, maximum: max });
    }
  };
  const resetRanges = () => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
      chartRef.current.priceScale('right').applyOptions({ autoScale: true });
    }
  };

  // --------------------------------------------------
  // 5. Live price marker
  useEffect(() => {
    if (!seriesRef.current || !livePrice || !fullData.length) return;
    if (replayActive) return;
    const last = fullData[fullData.length - 1];
    seriesRef.current.update({
      ...last,
      close: livePrice,
      high:  Math.max(last.high, livePrice),
      low:   Math.min(last.low,  livePrice),
    });
  }, [livePrice, fullData, replayActive]);

  // --------------------------------------------------
  // 6. Drawing overlay — size canvas to match chart container
  useEffect(() => {
    const container = chartContainerRef.current;
    const overlay   = drawCanvasRef.current;
    if (!container || !overlay) return;

    const sync = () => {
      overlay.width  = container.clientWidth;
      overlay.height = container.clientHeight;
      redrawOverlay();
    };
    sync();

    const ro = new ResizeObserver(sync);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const mapShapeToPixels = useCallback((s) => {
    if (!s) return s;
    const timeScale = chartRef.current?.timeScale();
    const series = seriesRef.current;
    
    const toPixel = (pt) => {
      if (!pt) return pt;
      let x = pt.x, y = pt.y;
      if (pt.logical !== undefined && timeScale) {
          const mappedX = timeScale.logicalToCoordinate(pt.logical);
          if (mappedX !== null && mappedX !== undefined) x = mappedX;
      }
      if (pt.price !== undefined && series) {
          const mappedY = series.priceToCoordinate(pt.price);
          if (mappedY !== null && mappedY !== undefined) y = mappedY;
      }
      return { ...pt, x, y };
    };

    const mapped = { ...s };
    if (s.points) mapped.points = s.points.map(toPixel);
    if (s.point) mapped.point = toPixel(s.point);
    if (s.center) mapped.center = toPixel(s.center);
    if (s.edge) mapped.edge = toPixel(s.edge);
    if (s.position) mapped.position = toPixel(s.position);
    if (s.pointsArray) mapped.pointsArray = s.pointsArray.map(toPixel);
    if (s.price !== undefined && series) {
        const mappedY = series.priceToCoordinate(s.price);
        if (mappedY !== null && mappedY !== undefined) mapped.y = mappedY;
    }
    if (s.targetPrice !== undefined && series) {
        const mappedY = series.priceToCoordinate(s.targetPrice);
        if (mappedY !== null && mappedY !== undefined) mapped.targetY = mappedY;
    }
    if (s.stopPrice !== undefined && series) {
        const mappedY = series.priceToCoordinate(s.stopPrice);
        if (mappedY !== null && mappedY !== undefined) mapped.stopY = mappedY;
    }
    if (s.logical !== undefined && timeScale) {
        const mappedX = timeScale.logicalToCoordinate(s.logical);
        if (mappedX !== null && mappedX !== undefined) mapped.x = mappedX;
    }
    return mapped;
  }, []);

  const redrawOverlay = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const chartCtx = { fullData: candlesDataRef.current, series: seriesRef.current };
    
    drawingsRef.current.forEach((s, i) => {
        renderShapeOnCtx(ctx, mapShapeToPixels(s), chartCtx);
        // Draw selection handles if this shape is selected
        if (i === selectedIdx) {
            const mapped = mapShapeToPixels(s);
            ctx.fillStyle = '#2563eb';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            const pts = [];
            if (mapped.points) pts.push(...mapped.points);
            if (mapped.point) pts.push(mapped.point);
            if (mapped.center) pts.push(mapped.center);
            if (mapped.edge) pts.push(mapped.edge);
            if (mapped.position) pts.push(mapped.position);
            if (mapped.pointsArray) pts.push(...mapped.pointsArray);
            
            pts.forEach(p => {
                if (!p) return;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });
        }
    });

    if (tempShapeRef.current) renderShapeOnCtx(ctx, mapShapeToPixels(tempShapeRef.current), chartCtx);
    
    // show pending points hint
    if (pendingPointsRef.current.length > 0 && drawModeRef.current === '3point') {
        const remaining = 3 - pendingPointsRef.current.length;
        ctx.fillStyle = '#ffd966';
        ctx.font = '12px monospace';
        ctx.fillText(`Click ${remaining} more point(s)`, 10, 20);
        for (let basePt of pendingPointsRef.current) {
            let mappedPt = mapShapeToPixels({ point: basePt }).point;
            ctx.beginPath(); ctx.arc(mappedPt.x, mappedPt.y, 5, 0, 2 * Math.PI); ctx.fill();
        }
    }
  }, [mapShapeToPixels, selectedIdx]);

  // Coordinate helper
  const getCoord = useCallback((e) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / (rect.width || 1);
    const scaleY = canvas.height / (rect.height || 1);
    
    // Safely extract clientX/clientY for both mouse and touch events (including touchend)
    const hasTouches = e.touches && e.touches.length > 0;
    const hasChanged = e.changedTouches && e.changedTouches.length > 0;
    const src = hasTouches ? e.touches[0] : (hasChanged ? e.changedTouches[0] : e);

    const x = Math.min(Math.max(0, ((src.clientX || 0) - rect.left) * scaleX), canvas.width);
    const y = Math.min(Math.max(0, ((src.clientY || 0) - rect.top)  * scaleY), canvas.height);
    
    let logical, price;
    const timeScale = chartRef.current?.timeScale();
    const series = seriesRef.current;
    if (timeScale && series) {
        logical = timeScale.coordinateToLogical(x);
        price = series.coordinateToPrice(y);
    }
    
    return { x, y, logical, price };
  }, []);

  // Hit testing for drawings
  const findDrawingAt = (mappedDrawings, x, y) => {
    const dist = (p1, p2) => Math.sqrt((p1.x - x)**2 + (p1.y - y)**2);
    const onLine = (p1, p2, threshold = 10) => {
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const lenSq = dx*dx + dy*dy;
        if (lenSq === 0) return dist(p1, {x, y}) < threshold;
        const d = Math.abs(dy*x - dx*y + p2.x*p1.y - p2.y*p1.x) / Math.sqrt(lenSq);
        const minX = Math.min(p1.x, p2.x) - threshold, maxX = Math.max(p1.x, p2.x) + threshold;
        const minY = Math.min(p1.y, p2.y) - threshold, maxY = Math.max(p1.y, p2.y) + threshold;
        return d < threshold && x >= minX && x <= maxX && y >= minY && y <= maxY;
    };

    for (let i = mappedDrawings.length - 1; i >= 0; i--) {
        const s = mappedDrawings[i];
        // 1. Check points/handles
        const pts = [];
        if (s.points) pts.push(...s.points);
        if (s.point) pts.push(s.point);
        if (s.center) pts.push(s.center);
        if (s.position) pts.push(s.position);
        if (pts.some(p => dist(p, {x, y}) < 15)) return i;

        // 2. Check shapes
        if (s.type === 'line' || s.type === 'ray' || s.type === 'trendAngle') {
            if (s.points && s.points.length >= 2 && onLine(s.points[0], s.points[1])) return i;
        }
        if (s.type === 'horizontalLine') { if (Math.abs(y - s.y) < 10) return i; }
        if (s.type === 'verticalLine') { if (Math.abs(x - s.x) < 10) return i; }
        if (s.type === 'rectangle' || s.type === 'gannBox') {
            if (s.points && s.points.length >= 2) {
                const [p0, p1] = s.points;
                const minX = Math.min(p0.x, p1.x), maxX = Math.max(p0.x, p1.x);
                const minY = Math.min(p0.y, p1.y), maxY = Math.max(p0.y, p1.y);
                if (x >= minX - 5 && x <= maxX + 5 && y >= minY - 5 && y <= maxY + 5) return i;
            }
        }
        if (s.type === 'longPos' || s.type === 'shortPos') {
            const cx = s.point ? s.point.x : s.x;
            if (x >= cx - 90 && x <= cx + 90) {
                if (s.targetY !== undefined && Math.abs(y - s.targetY) < 15) return i;
                if (s.stopY !== undefined && Math.abs(y - s.stopY) < 15) return i;
                if (s.point && Math.abs(y - s.point.y) < 15) return i;
            }
        }
        if (s.type === 'fibRetrace' && s.points && s.points.length >= 2) {
            const [p1, p2] = s.points;
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            for (let l of levels) {
                const ly = p1.y + (p2.y - p1.y) * l;
                if (Math.abs(y - ly) < 8 && x >= Math.min(p1.x, p2.x) && x <= Math.max(p1.x, p2.x)) return i;
            }
        }
    }
    return -1;
  };

  // Trigger redraws when chart pans/zooms
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const timeScale = chart.timeScale();
    const sub = () => redrawOverlay();
    timeScale.subscribeVisibleTimeRangeChange(sub);
    timeScale.subscribeVisibleLogicalRangeChange(sub);
    
    const handleInteract = (e) => {
        requestAnimationFrame(sub);
        if (activeToolRef.current === 'cursor' && e && (e.clientX !== undefined || e.touches)) {
            const pt = getCoord(e);
            let hit = false;
            const mappedDrawings = drawingsRef.current.map(mapShapeToPixels);
            for (let i = mappedDrawings.length - 1; i >= 0; i--) {
                const s = mappedDrawings[i];
                if (s.type === 'longPos' || s.type === 'shortPos') {
                    const cx = s.point ? s.point.x : s.x;
                    if (pt.x >= cx - 90 && pt.x <= cx + 90) {
                        if (s.targetY !== undefined && Math.abs(pt.y - s.targetY) < 10) hit = true;
                        else if (s.stopY !== undefined && Math.abs(pt.y - s.stopY) < 10) hit = true;
                        else if (s.point && s.point.y !== undefined && Math.abs(pt.y - s.point.y) < 10) hit = true;
                    }
                }
                if (hit) break;
            }
            if (drawCanvasRef.current) {
                if (hit) {
                    drawCanvasRef.current.style.pointerEvents = 'all';
                    drawCanvasRef.current.style.cursor = 'ns-resize';
                }
            }
        }
    };
    const container = chartContainerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleInteract);
      container.addEventListener('touchmove', handleInteract, { passive: true });
      container.addEventListener('wheel', handleInteract, { passive: true });
    }

    return () => {
      timeScale.unsubscribeVisibleTimeRangeChange(sub);
      timeScale.unsubscribeVisibleLogicalRangeChange(sub);
      if (container) {
        container.removeEventListener('mousemove', handleInteract);
        container.removeEventListener('touchmove', handleInteract);
        container.removeEventListener('wheel', handleInteract);
      }
    };
  }, [redrawOverlay]);

  // Mouse/touch handlers — use activeToolRef so these are STABLE (attached once, never re-attached)
  const onPointerDown = useCallback((e) => {
    const tool = activeToolRef.current;
    if (tool === 'cursor' || tool === 'crosshair') {
        const pt = getCoord(e);
        if (tool === 'cursor') {
            const mappedDrawings = drawingsRef.current.map(mapShapeToPixels);
            
            // Check if clicking on an existing selection's handles for dragging
            for (let i = mappedDrawings.length - 1; i >= 0; i--) {
                const s = mappedDrawings[i];
                if (s.type === 'longPos' || s.type === 'shortPos') {
                    const cx = s.point ? s.point.x : s.x;
                    if (pt.x >= cx - 90 && pt.x <= cx + 90) {
                        if (s.targetY !== undefined && Math.abs(pt.y - s.targetY) < 10) {
                            dragActionRef.current = { index: i, handle: 'target' };
                            e.preventDefault(); e.stopPropagation();
                            return;
                        }
                        if (s.stopY !== undefined && Math.abs(pt.y - s.stopY) < 10) {
                            dragActionRef.current = { index: i, handle: 'stop' };
                            e.preventDefault(); e.stopPropagation();
                            return;
                        }
                        if (s.point && s.point.y !== undefined && Math.abs(pt.y - s.point.y) < 10) {
                            dragActionRef.current = { index: i, handle: 'entry' };
                            e.preventDefault(); e.stopPropagation();
                            return;
                        }
                    }
                }
            }

            // If not dragging handles, try selecting a drawing
            const hitIdx = findDrawingAt(mappedDrawings, pt.x, pt.y);
            if (hitIdx !== -1) {
                setSelectedIdx(hitIdx);
                // Position toolbar slightly above or below the click
                setToolbarPos({ x: pt.x, y: Math.max(80, pt.y - 60) });
                redrawOverlay();
                e.preventDefault(); e.stopPropagation();
                return;
            } else {
                setSelectedIdx(null);
                redrawOverlay();
            }
        }
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    const pt = getCoord(e);

    if (tool === 'eraser') {
      const mappedDrawings = drawingsRef.current.map(mapShapeToPixels);
      const idx = eraseAt(mappedDrawings, pt.x, pt.y);
      if (idx !== -1) {
        drawingsRef.current.splice(idx, 1);
        setDrawCount(c => c + 1);
        redrawOverlay();
      }
      return;
    }

    if (['text', 'note', 'priceNote', 'callout', 'anchoredText', 'pin', 'flagMark', 'imageTool', 'postTool', 'ideaTool', 'priceLabel', 'signpost'].includes(tool)) {
      const content = window.prompt(`Enter ${tool} content:`);
      if (content) {
        drawingsRef.current.push({ type: 'text', position: pt, content, color: strokeColorRef.current, width: strokeWidthRef.current });
        setDrawCount(c => c + 1);
        redrawOverlay();
      }
      return;
    }
    
    if (tool === 'crossMarker' || tool === 'dotMarker') {
        drawingsRef.current.push({ type: 'basicShape', subType: tool === 'crossMarker' ? 'cross' : 'dot', points: [pt], color: strokeColorRef.current, width: strokeWidthRef.current });
        setDrawCount(c => c + 1);
        redrawOverlay();
        return;
    }
    
    if (tool === 'horizontalLine') {
        drawingsRef.current.push({ type: 'horizontalLine', y: pt.y, price: pt.price, color: strokeColorRef.current, width: strokeWidthRef.current });
        setDrawCount(c => c + 1);
        redrawOverlay();
        return;
    }
    
    if (tool === 'verticalLine') {
        drawingsRef.current.push({ type: 'verticalLine', x: pt.x, logical: pt.logical, color: strokeColorRef.current, width: strokeWidthRef.current });
        setDrawCount(c => c + 1);
        redrawOverlay();
        return;
    }
    
    if (tool === 'crossLine') {
        drawingsRef.current.push({ type: 'crossLine', point: pt, color: strokeColorRef.current, width: strokeWidthRef.current });
        setDrawCount(c => c + 1);
        redrawOverlay();
        return;
    }
    
    if (tool === 'longPos' || tool === 'shortPos') {
        const offset = pt.price ? pt.price * 0.05 : 100; // default 5% target/stop
        const targetPrice = tool === 'longPos' ? (pt.price || 0) + offset : (pt.price || 0) - offset;
        const stopPrice = tool === 'longPos' ? (pt.price || 0) - offset / 2 : (pt.price || 0) + offset / 2;
        drawingsRef.current.push({ type: tool, point: pt, targetPrice, stopPrice, color: strokeColorRef.current, width: strokeWidthRef.current });
        setDrawCount(c => c + 1);
        redrawOverlay();
        return;
    }

    const threePointTools = ['parallelChannel', 'regressionTrend', 'flatChannel', 'disjointChannel', 'pitchfork', 'schiffPitchfork', 'modSchiff', 'insidePitchfork', 'polyline', 'arcTool', 'curveTool', 'doubleCurve'];
    
    if (threePointTools.includes(tool)) {
      drawModeRef.current = '3point';
      pendingPointsRef.current.push(pt);
      
      if (pendingPointsRef.current.length === 3) {
        let tType = tool.toLowerCase().includes('pitchfork') ? 'pitchfork' : (tool === 'polyline' ? 'polyline' : tool === 'arcTool' ? 'arc' : tool === 'curveTool' ? 'curve' : tool === 'doubleCurve' ? 'doubleCurve' : 'channel');
        drawingsRef.current.push({ type: tType, points: [...pendingPointsRef.current], color: strokeColorRef.current, width: strokeWidthRef.current });
        setDrawCount(c => c + 1);
        pendingPointsRef.current = [];
        drawModeRef.current = '2point'; // done
      }
      redrawOverlay();
      return;
    }

    // 2-point or freehand
    isDrawingRef.current = true;
    startPointRef.current = pt;
    if (tool === 'brush' || tool === 'highlighter') {
      freehandPointsRef.current = [pt];
      drawModeRef.current = 'freehand';
    } else {
      drawModeRef.current = '2point';
    }
  }, [getCoord, redrawOverlay]);

  const onPointerMove = useCallback((e) => {
    const pt = getCoord(e);
    if (dragActionRef.current) {
        e.preventDefault(); e.stopPropagation();
        const shape = drawingsRef.current[dragActionRef.current.index];
        if (shape) {
            if (dragActionRef.current.handle === 'target') {
                shape.targetPrice = pt.price;
            } else if (dragActionRef.current.handle === 'stop') {
                shape.stopPrice = pt.price;
            } else if (dragActionRef.current.handle === 'entry') {
                const diff = pt.price - shape.point.price;
                shape.point.price = pt.price;
                if (shape.targetPrice !== undefined) shape.targetPrice += diff;
                if (shape.stopPrice !== undefined) shape.stopPrice += diff;
            }
            redrawOverlay();
        }
        return;
    }

    if (activeToolRef.current === 'cursor' || activeToolRef.current === 'crosshair') {
        if (activeToolRef.current === 'cursor') {
            let hit = false;
            const mappedDrawings = drawingsRef.current.map(mapShapeToPixels);
            for (let i = mappedDrawings.length - 1; i >= 0; i--) {
                const s = mappedDrawings[i];
                if (s.type === 'longPos' || s.type === 'shortPos') {
                    const cx = s.point ? s.point.x : s.x;
                    if (pt.x >= cx - 90 && pt.x <= cx + 90) {
                        if (s.targetY !== undefined && Math.abs(pt.y - s.targetY) < 10) hit = true;
                        else if (s.stopY !== undefined && Math.abs(pt.y - s.stopY) < 10) hit = true;
                        else if (s.point && s.point.y !== undefined && Math.abs(pt.y - s.point.y) < 10) hit = true;
                    }
                }
                if (hit) break;
            }
            if (!hit && drawCanvasRef.current) {
                drawCanvasRef.current.style.pointerEvents = 'none';
                drawCanvasRef.current.style.cursor = 'default';
            } else if (hit && drawCanvasRef.current) {
                drawCanvasRef.current.style.cursor = 'ns-resize';
            }
        }
        return;
    }

    if (!isDrawingRef.current && drawModeRef.current !== 'freehand') return;
    const tool = activeToolRef.current;
    if (tool === 'eraser') return;
    e.preventDefault();
    e.stopPropagation();

    if (drawModeRef.current === 'freehand') {
        freehandPointsRef.current.push(pt);
        tempShapeRef.current = { type: 'freeBrush', pointsArray: [...freehandPointsRef.current], color: strokeColorRef.current, width: strokeWidthRef.current, tool };
        redrawOverlay();
    } else if (drawModeRef.current === '2point' && startPointRef.current) {
        tempShapeRef.current = buildShape(tool, startPointRef.current, pt, strokeColorRef.current, strokeWidthRef.current);
        redrawOverlay();
    }
  }, [getCoord, redrawOverlay]);

  const onPointerUp = useCallback((e) => {
    if (dragActionRef.current) {
        setDrawCount(c => c + 1);
        dragActionRef.current = null;
        redrawOverlay();
        return;
    }
    if (!isDrawingRef.current && drawModeRef.current !== 'freehand') {
        redrawOverlay();
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    
    const tool = activeToolRef.current;
    if (tool === 'cursor' || tool === 'crosshair' || tool === 'eraser') return;
    
    if (drawModeRef.current === 'freehand' && freehandPointsRef.current.length > 1) {
        drawingsRef.current.push({ type: 'freeBrush', pointsArray: freehandPointsRef.current, color: strokeColorRef.current, width: strokeWidthRef.current, tool });
        setDrawCount(c => c + 1);
    } else if (drawModeRef.current === '2point' && startPointRef.current) {
        const pt = getCoord(e);
        const start = startPointRef.current;
        if (Math.hypot(pt.x - start.x, pt.y - start.y) > 3) {
            const shape = buildShape(tool, start, pt, strokeColorRef.current, strokeWidthRef.current);
            if (shape) {
                drawingsRef.current.push(shape);
                setDrawCount(c => c + 1);
            }
        }
    }
    
    isDrawingRef.current = false;
    startPointRef.current = null;
    freehandPointsRef.current = [];
    tempShapeRef.current = null;
    if (drawModeRef.current !== '3point') {
        drawModeRef.current = '2point';
    }
    redrawOverlay();
  }, [getCoord, redrawOverlay]);

  // Attach drawing events ONCE — handlers are stable refs, no re-attachment on tool change
  useEffect(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('mousedown',  onPointerDown);
    canvas.addEventListener('mousemove',  onPointerMove);
    canvas.addEventListener('mouseup',    onPointerUp);
    canvas.addEventListener('mouseleave', onPointerUp);          // finish shape if cursor leaves
    canvas.addEventListener('touchstart', onPointerDown, { passive: false });
    canvas.addEventListener('touchmove',  onPointerMove, { passive: false });
    canvas.addEventListener('touchend',   onPointerUp,   { passive: false });
    return () => {
      canvas.removeEventListener('mousedown',  onPointerDown);
      canvas.removeEventListener('mousemove',  onPointerMove);
      canvas.removeEventListener('mouseup',    onPointerUp);
      canvas.removeEventListener('mouseleave', onPointerUp);
      canvas.removeEventListener('touchstart', onPointerDown);
      canvas.removeEventListener('touchmove',  onPointerMove);
      canvas.removeEventListener('touchend',   onPointerUp);
    };
  }, [onPointerDown, onPointerMove, onPointerUp]); // now stable — runs once

  // Keyboard shortcuts (Alt+key)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
          if (pendingPointsRef.current.length > 0) {
              pendingPointsRef.current = [];
              drawModeRef.current = '2point';
              tempShapeRef.current = null;
              redrawOverlay();
          } else {
              setActiveTool('cursor');
          }
      }
      if (!e.altKey) return;
      const map = { t: 'line', h: 'horizontalLine', j: 'infoLine', v: 'verticalLine', c: 'crossLine' };
      const mode = map[e.key.toLowerCase()];
      if (mode) { setActiveTool(mode); e.preventDefault(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Clear all drawings
  const clearDrawings = () => {
    drawingsRef.current = [];
    tempShapeRef.current = null;
    pendingPointsRef.current = [];
    drawModeRef.current = '2point';
    setDrawCount(0);
    redrawOverlay();
  };

  // --------------------------------------------------
  // Derived display values
  const lastCandle   = fullData.length ? fullData[fullData.length - 1] : null;
  const displayPrice = livePrice ?? lastCandle?.close ?? null;
  const priceChange  = lastCandle ? ((lastCandle.close - lastCandle.open) / lastCandle.open) * 100 : null;
  const isPositive   = priceChange != null ? priceChange >= 0 : true;

  const formatPrice = (p) => {
    if (p == null) return '—';
    if (fmt) return fmt(assetType === 'CRYPTO' ? p * (usdInr || 83) : p);
    return assetType === 'CRYPTO'
      ? `₹${(p * (usdInr || 83)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
      : `₹${p.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  // Overlay pointer-events: only intercept when a drawing tool is active
  const isDrawingToolActive = activeTool !== 'cursor' && activeTool !== 'crosshair';
  const overlayCursor = activeTool === 'eraser' ? 'cell' : isDrawingToolActive ? 'crosshair' : 'default';

  return (
    <div ref={wrapperRef} className="w-full h-full flex flex-col bg-[#0d1220] text-white" style={{ minHeight: 520, userSelect: 'none' }}>

      {/* ── Toolbar row 1: symbol info + timeframe + actions + drawing controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-white/[0.07] shrink-0">
        {/* Symbol + price */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white tracking-wider font-mono">{symbol || '—'}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${assetType === 'CRYPTO' ? 'bg-violet-500/20 text-violet-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
              {assetType === 'CRYPTO' ? 'CRYPTO' : 'NSE'}
            </span>
          </div>
          {displayPrice != null && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-white">
                {formatPrice(displayPrice)}
              </span>
              {priceChange != null && (
                <span className={`text-xs font-medium ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
                </span>
              )}
              {livePrice && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  LIVE
                </span>
              )}
            </div>
          )}
        </div>

        {/* Timeframe selector */}
        <TimeframeSelector interval={interval} onIntervalChange={onIntervalChange} />

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Drawing color */}
          <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1">
            <span className="text-[10px] text-[#4a5a7a]">🎨</span>
            <input
              type="color"
              value={drawColor}
              onChange={e => setDrawColor(e.target.value)}
              className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
              title="Drawing color"
            />
            <span className="text-[10px] text-[#4a5a7a]">📏</span>
            <select
              value={drawWidth}
              onChange={e => setDrawWidth(Number(e.target.value))}
              className="bg-transparent text-[10px] text-[#8aa0c0] border-0 outline-none cursor-pointer"
            >
              <option value={1}>1px</option>
              <option value={2}>2px</option>
              <option value={3}>3px</option>
              <option value={4}>4px</option>
            </select>
          </div>

          {/* Clear drawings */}
          <button
            onClick={clearDrawings}
            className="px-2.5 py-1 rounded text-[11px] font-medium border border-white/10 text-[#4a5a7a] hover:text-rose-300 hover:bg-rose-500/10 hover:border-rose-400/30 transition-all"
            title={`Clear all drawings (${drawCount})`}
          >
            🗑 {drawCount > 0 ? drawCount : ''}
          </button>


          <button
            onClick={() => {
              if (replayActive) stopReplay();
              else if (replaySelectMode) setReplaySelectMode(false);
              else setReplaySelectMode(true);
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-all ${
              replayActive
                ? 'bg-purple-500/20 border-purple-400/40 text-purple-200'
                : replaySelectMode
                  ? 'bg-purple-600/30 border-purple-400/60 text-purple-100 animate-pulse'
                  : 'border-white/10 text-[#4a5a7a] hover:text-white hover:bg-white/5'
            }`}
          >
            {replayActive ? '⏹ Exit Replay' : replaySelectMode ? '✕ Cancel' : '▶ Replay'}
          </button>
          <button
            type="button"
            onClick={() => {
              const chart = chartRef.current;
              const data  = candlesDataRef.current;
              if (!chart || !data.length) return;
              
              chart.timeScale().fitContent();
              chart.timeScale().setVisibleLogicalRange({
                from: 0,
                to: data.length - 1,
              });
              chart.priceScale('right').applyOptions({ autoScale: true });
            }}
            className="px-2.5 py-1 rounded text-[11px] font-medium border border-white/10 text-[#4a5a7a] hover:text-white hover:bg-white/5 transition-all"
            title="Fit all content (overview)"
            style={{ position: 'relative', zIndex: 60, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>fit_screen</span>
            Fit
          </button>
          
          <button
            type="button"
            onClick={() => {
              if (!document.fullscreenElement) {
                wrapperRef.current?.requestFullscreen().catch(err => {
                  console.warn(`Error attempting to enable fullscreen: ${err.message}`);
                });
              } else {
                document.exitFullscreen().then(() => {
                  // Fire even more checks after the promise resolves
                  [100, 300, 800, 1500].forEach(delay => setTimeout(() => applySize(true), delay));
                }).catch(() => {});
              }
            }}
            className="px-2.5 py-1 rounded text-[11px] font-medium border border-white/10 text-[#4a5a7a] hover:text-white hover:bg-white/5 transition-all"
            title="Toggle Fullscreen"
            style={{ position: 'relative', zIndex: 60, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>fullscreen</span>
            Expand
          </button>
        </div>
      </div>

      {/* ── Toolbar row 2: fixed range & replay controls (conditional) ── */}
      {(showFixedRange || replayActive) && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-white/[0.07] shrink-0">
          {showFixedRange && (
            <FixedRangeTool onApplyX={applyXRange} onApplyY={applyYRange} onReset={resetRanges} />
          )}
          {replayActive && (
            <ReplayControls
              replayIndex={replayIndex}
              total={fullData.length}
              playing={replayPlaying}
              onPlay={() => setReplayPlaying(true)}
              onPause={() => setReplayPlaying(false)}
              onStop={stopReplay}
              onSeek={idx => { setReplayIndex(Math.max(1, Math.min(idx, fullData.length))); }}
              speed={replaySpeed}
              setSpeed={setReplaySpeed}
              fullData={fullData}
            />
          )}
        </div>
      )}

      {/* ── Main area: drawing tools panel + chart canvas ── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Drawing tools panel (collapsible) */}
        <DrawingToolsPanel
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          panelOpen={panelOpen}
          setPanelOpen={setPanelOpen}
        />

        {/* Chart canvas + drawing overlay */}
        <div className="relative flex-1 overflow-hidden">
          {/* Floating Drawing Toolbar */}
          {selectedIdx !== null && (
            <div 
              className="absolute z-[100] flex items-center gap-1.5 px-2 py-1.5 bg-[#1a2235] border border-white/10 rounded-xl shadow-2xl animate-in fade-in zoom-in duration-200"
              style={{ left: toolbarPos.x, top: toolbarPos.y, transform: 'translateX(-50%)' }}
            >
              <div className="flex items-center gap-1 pr-1.5 border-r border-white/5 cursor-grab">
                <span className="material-symbols-outlined text-[#4a5a7a] scale-75">drag_indicator</span>
              </div>
              
              <button title="Settings" className="p-1.5 rounded-lg text-[#7a8fab] hover:bg-white/5 hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[18px]">settings</span>
              </button>
              
              <div className="w-[1px] h-4 bg-white/5 mx-0.5" />
              
              <button 
                title="Delete" 
                onClick={(e) => {
                  e.stopPropagation();
                  drawingsRef.current.splice(selectedIdx, 1);
                  setSelectedIdx(null);
                  setDrawCount(c => c + 1);
                  redrawOverlay();
                }}
                className="p-1.5 rounded-lg text-rose-400/70 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
              
              <button title="Lock" className="p-1.5 rounded-lg text-[#7a8fab] hover:bg-white/5 hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[18px]">lock_open</span>
              </button>

              <button title="More" className="p-1.5 rounded-lg text-[#7a8fab] hover:bg-white/5 hover:text-white transition-colors">
                <span className="material-symbols-outlined text-[18px]">more_horiz</span>
              </button>
            </div>
          )}

          {loading && <LoadingOverlay />}
          {!loading && candles.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-[#4a5a7a] gap-2 z-10">
              <svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="4" y="20" width="6" height="12" rx="1" /><rect x="14" y="12" width="6" height="20" rx="1" />
                <rect x="24" y="6"  width="6" height="26" rx="1" /><rect x="34" y="16" width="2" height="16" rx="1" />
              </svg>
              <p className="text-xs">No chart data available</p>
              <p className="text-[10px] text-[#3a4a5a]">{symbol} · {interval}</p>
            </div>
          )}

          {/* lightweight-charts host */}
          <div ref={chartContainerRef} className="w-full h-full" />

          {/* Transparent drawing overlay */}
          <canvas
            ref={drawCanvasRef}
            className="absolute inset-0 w-full h-full z-[50]"
            style={{
              pointerEvents: isDrawingToolActive ? 'all' : 'none',
              cursor: overlayCursor,
              background: 'transparent',
              touchAction: 'none',
              userSelect: 'none',
            }}
          />

          {/* Replay select mode overlay — dblclick on chart to pick start candle */}
          {replaySelectMode && (
            <div
              className="absolute inset-0 z-[80] flex flex-col items-center justify-center"
              style={{ cursor: 'crosshair', background: 'rgba(88,28,235,0.06)' }}
              onDoubleClick={e => {
                const chart = chartRef.current;
                const data  = fullData;
                if (!chart || !data.length) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x    = e.clientX - rect.left;
                const logical = chart.timeScale().coordinateToLogical(x);
                if (logical == null) return;
                const idx = Math.max(1, Math.min(Math.round(logical) + 1, data.length));
                startReplay(idx);
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Vertical hair line */}
              <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-purple-400/30" />
              {/* Hint badge */}
              <div className="pointer-events-none flex items-center gap-2 bg-[#0d1220]/90 backdrop-blur-sm border border-purple-500/30 rounded-2xl px-5 py-3 shadow-2xl">
                <span className="text-purple-400 text-base">▶</span>
                <div>
                  <p className="text-white text-sm font-semibold">Double-click to select candle start on Replay Mode</p>
                  <p className="text-purple-300/60 text-[11px] mt-0.5">Click anywhere on the chart to pick a starting candle</p>
                </div>
              </div>
              {/* ESC hint */}
              <button
                className="absolute top-3 right-3 text-[10px] text-purple-300/50 hover:text-purple-200 border border-purple-500/20 rounded px-2 py-0.5 transition-all"
                onClick={e => { e.stopPropagation(); setReplaySelectMode(false); }}
              >
                ESC / Cancel
              </button>
            </div>
          )}

          {/* Active tool badge */}
          {isDrawingToolActive && (
            <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm border border-white/10 rounded-full px-2.5 py-1 pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-[10px] text-sky-200 font-mono">
                {TOOLS_DATA.find(t => t.mode === activeTool)?.name ?? activeTool}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom: OHLCV info bar ── */}
      {lastCandle && (
        <div className="flex items-center gap-4 px-3 py-1.5 border-t border-white/[0.07] text-[10px] font-mono text-[#4a5a7a] shrink-0 overflow-x-auto">
          <span>O <span className="text-white">{lastCandle.open?.toFixed(2)}</span></span>
          <span>H <span className="text-emerald-400">{lastCandle.high?.toFixed(2)}</span></span>
          <span>L <span className="text-rose-400">{lastCandle.low?.toFixed(2)}</span></span>
          <span>C <span className="text-white">{lastCandle.close?.toFixed(2)}</span></span>
          {lastCandle.volume != null && <span>V <span className="text-sky-300">{lastCandle.volume?.toLocaleString()}</span></span>}
          <span className="ml-auto text-[#2a3a4a]">
            {new Date((lastCandle.time ?? 0) * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </div>
      )}

    </div>
  );
}


export { Chart };