import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getIntradaySeries } from '../services/twelveDataService';
import { eventTs, type CoverageName, type PriceTick, type StopRiskEvent } from '../services/stopEventStream';

const BUY = '#10b981';
const SELL = '#ef4444';
const PRICE = '#71717a';
const STOP = '#f59e0b';

interface PricePoint {
  t: number;
  price: number;
}

export interface EventPoint {
  t: number;
  price: number;
  event: StopRiskEvent;
}

function fmtClock(t: number): string {
  return new Date(t).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
}

/** Engine events for one symbol that carry a price and a timestamp. */
export function eventPoints(events: StopRiskEvent[], symbol: string): EventPoint[] {
  return events
    .filter((e) => e.symbol === symbol && (e.price ?? 0) > 0 && eventTs(e) > 0)
    .map((e) => ({ t: eventTs(e), price: e.price as number, event: e }))
    .sort((a, b) => a.t - b.t);
}

/** Symbols in the event tail, most active first, then designated names. */
export function chartSymbols(events: StopRiskEvent[], designated: string[]): string[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    if (!e.symbol) continue;
    counts.set(e.symbol, (counts.get(e.symbol) || 0) + 1);
  }
  const active = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  return [...new Set([...active, ...designated])];
}

/** Triangle tag: up for buys, down for sells; hollow until filled. */
function EventTag(props: { cx?: number; cy?: number; payload?: EventPoint }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  const sell = payload.event.side === 'SELL';
  const color = sell ? SELL : BUY;
  const filled = payload.event.status === 'filled';
  const r = 7;
  const points = sell
    ? `${cx - r},${cy - r} ${cx + r},${cy - r} ${cx},${cy + r}`
    : `${cx - r},${cy + r} ${cx + r},${cy + r} ${cx},${cy - r}`;
  return (
    <g data-testid="event-tag">
      <polygon
        points={points}
        fill={filled ? color : 'var(--chart-surface, #fff)'}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <text
        x={cx}
        y={sell ? cy - r - 4 : cy + r + 12}
        textAnchor="middle"
        fontSize={10}
        className="fill-gray-500 dark:fill-zinc-400"
      >
        {payload.event.order_type === 'stop' ? 'STOP' : payload.event.side}
      </text>
    </g>
  );
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: PricePoint | EventPoint }[] }) {
  if (!active || !payload?.length) return null;
  const hit = payload.find((p) => 'event' in p.payload)?.payload as EventPoint | undefined;
  const point = hit || (payload[0].payload as PricePoint);
  return (
    <div className="rounded border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-400 dark:text-zinc-500">{fmtClock(point.t)} ET</p>
      {hit ? (
        <>
          <p className="font-medium text-gray-900 dark:text-white mt-0.5">{hit.event.message}</p>
          <p className="text-gray-500 dark:text-zinc-400">{hit.event.status}</p>
        </>
      ) : (
        <p className="font-medium text-gray-900 dark:text-white mt-0.5">${point.price.toFixed(2)}</p>
      )}
    </div>
  );
}

export default function EventPriceChart({
  events,
  ticks,
  names,
  designated,
  focusSymbol,
  loadBackfill = getIntradaySeries,
}: {
  events: StopRiskEvent[];
  ticks: Record<string, PriceTick[]>;
  names: CoverageName[];
  designated: string[];
  focusSymbol?: string;
  loadBackfill?: (symbol: string) => Promise<{ timestamp: number; price: number }[]>;
}) {
  const symbols = useMemo(() => chartSymbols(events, designated), [events, designated]);
  const [picked, setPicked] = useState<string | null>(null);
  const symbol = picked || (focusSymbol && symbols.includes(focusSymbol) ? focusSymbol : symbols[0]) || '';

  const [backfill, setBackfill] = useState<PricePoint[]>([]);
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setBackfill([]);
    loadBackfill(symbol)
      .then((rows) => {
        if (!cancelled) setBackfill(rows.map((r) => ({ t: r.timestamp, price: r.price })));
      })
      .catch(() => {
        /* live ticks + event tags still render without a backfill */
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, loadBackfill]);

  const live = (ticks[symbol] || []).map((tk) => ({ t: Date.parse(tk.ts), price: tk.price }));
  const lastBackfill = backfill.length ? backfill[backfill.length - 1].t : 0;
  const line = [...backfill, ...live.filter((p) => p.t > lastBackfill)];
  const tags = eventPoints(events, symbol);
  const stop = names.find((n) => n.symbol === symbol)?.stop_price || null;
  const lastPrice = line.length ? line[line.length - 1].price : null;

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-lg border border-gray-200 dark:border-zinc-800 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Engine events on price</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Last {tags.length} engine events for {symbol || '—'} over the live quote
            {lastPrice != null && <> · ${lastPrice.toFixed(2)}</>}
          </p>
        </div>
        <div className="flex gap-1 flex-wrap" role="tablist">
          {symbols.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={s === symbol}
              onClick={() => setPicked(s)}
              className={`text-xs px-2 py-1 rounded border ${
                s === symbol
                  ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                  : 'border-gray-200 dark:border-zinc-800 text-gray-500 dark:text-zinc-400 hover:border-gray-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-4 text-xs text-gray-500 dark:text-zinc-400 mb-2">
        <span className="inline-flex items-center gap-1">
          <svg width="10" height="10"><polygon points="0,10 10,10 5,0" fill={BUY} /></svg> Buy
        </span>
        <span className="inline-flex items-center gap-1">
          <svg width="10" height="10"><polygon points="0,0 10,0 5,10" fill={SELL} /></svg> Sell
        </span>
        <span className="inline-flex items-center gap-1">
          <svg width="10" height="10"><polygon points="1,1 9,1 5,9" fill="none" stroke={PRICE} strokeWidth="1.5" /></svg> Open (hollow)
        </span>
        {stop && (
          <span className="inline-flex items-center gap-1">
            <svg width="14" height="10"><line x1="0" y1="5" x2="14" y2="5" stroke={STOP} strokeWidth="2" strokeDasharray="3 2" /></svg> Trail stop
          </span>
        )}
      </div>

      <div className="h-72" data-testid="event-price-chart">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 16, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" strokeOpacity={0.4} vertical={false} />
            <XAxis
              type="number"
              dataKey="t"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={fmtClock}
              stroke="#a1a1aa"
              fontSize={11}
              allowDuplicatedCategory={false}
            />
            <YAxis
              type="number"
              dataKey="price"
              domain={['auto', 'auto']}
              stroke="#a1a1aa"
              fontSize={11}
              width={56}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            />
            <Tooltip content={<ChartTooltip />} />
            {stop && <ReferenceLine y={stop} stroke={STOP} strokeWidth={2} strokeDasharray="4 3" />}
            <Line
              data={line}
              dataKey="price"
              stroke={PRICE}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              name="Price"
            />
            <Scatter data={tags} dataKey="price" shape={<EventTag />} isAnimationActive={false} name="Events" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {line.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-zinc-600 mt-2">
          Waiting for live quotes — tags are placed at each order's fill / limit / stop price.
        </p>
      )}
    </div>
  );
}
