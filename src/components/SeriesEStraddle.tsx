import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts';
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Rocket,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import {
  SERIES_E_STARTUPS,
  StartupProfile,
  buildValuationSeries,
  valuationCagr,
} from '../services/startupPricingService';
import { formatLargeNumber, formatCurrency, formatPercentage } from '../utils/formatters';

function ImpactIcon({ impact }: { impact: string }) {
  if (impact === 'positive') return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (impact === 'negative') return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

function StageBadge({ stage }: { stage: string }) {
  const primary = stage.startsWith('Series') || stage === 'Seed';
  const colors = primary
    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
    : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors}`}>{stage}</span>
  );
}

export default function SeriesEStraddle() {
  const { isDark } = useTheme();
  const [selectedId] = useState<string>(SERIES_E_STARTUPS[0].id);
  const profile = SERIES_E_STARTUPS.find((s) => s.id === selectedId) as StartupProfile;

  const series = useMemo(() => buildValuationSeries(profile), [profile]);
  const spikes = useMemo(() => series.filter((p) => p.isSpike), [series]);
  const cagr = useMemo(() => valuationCagr(profile), [profile]);

  const latest = series[series.length - 1];
  const first = series[0];
  const totalMultiple = first.valuation > 0 ? latest.valuation / first.valuation : 0;

  const axisColor = isDark ? '#a1a1aa' : '#71717a';
  const gridColor = isDark ? '#27272a' : '#e5e7eb';

  const valuations = series.map((p) => p.valuation);
  const minVal = Math.min(...valuations);
  const maxVal = Math.max(...valuations);

  const formatXAxis = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

  return (
    <div className="space-y-6">
      {/* Strategy description */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
            <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              News Straddle · Private Markets
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mt-1 text-sm leading-relaxed">
              Public straddles buy vol into a scheduled event. Private companies have no tape
              and no fixed calendar &mdash; valuation only reprints when a round, tender, or
              secondary print lands. We treat each of those as a discrete &ldquo;spike&rdquo;
              (a step re-rating past 25%) and position in the secondary market ahead of the
              expected mark-up, using the spread between primary, secondary, and 409A marks as
              the implied-vol signal.
            </p>
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Latest valuation', value: formatLargeNumber(latest.valuation), sub: latest.stage },
          { label: 'Implied share price', value: formatCurrency(latest.impliedShare), sub: 'fully diluted' },
          { label: 'Total step-up', value: `${totalMultiple.toFixed(0)}×`, sub: `since ${first.stage}` },
          { label: 'Valuation CAGR', value: formatPercentage(cagr), sub: 'blended' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg p-4"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white mt-1">{s.value}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Valuation chart with spike dots */}
      <div className="bg-white dark:bg-zinc-950 rounded-lg border border-gray-200 dark:border-zinc-800 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Rocket className="w-5 h-5" style={{ color: profile.color }} />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {profile.name} valuation trajectory
          </h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Post-money and implied marks with re-rating events highlighted · log scale
        </p>

        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={series} margin={{ top: 10, right: 10, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="timestamp"
              type="category"
              tickFormatter={formatXAxis}
              tick={{ fontSize: 11, fill: axisColor }}
              axisLine={{ stroke: gridColor }}
              tickLine={{ stroke: gridColor }}
            />
            <YAxis
              scale="log"
              domain={[minVal * 0.7, maxVal * 1.3]}
              tickFormatter={(v) => formatLargeNumber(v)}
              tick={{ fontSize: 11, fill: axisColor }}
              axisLine={{ stroke: gridColor }}
              tickLine={{ stroke: gridColor }}
              width={70}
              allowDataOverflow
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload as (typeof series)[number];
                  return (
                    <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-800 text-xs max-w-[240px]">
                      <div className="flex items-center gap-2 mb-1">
                        <StageBadge stage={d.stage} />
                        <span className="text-gray-500 dark:text-gray-400">{d.date}</span>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {formatLargeNumber(d.valuation)}
                      </p>
                      {d.stepPct !== 0 && (
                        <p className={`mt-0.5 font-medium ${d.stepPct > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercentage(d.stepPct)} step
                        </p>
                      )}
                      <p className="text-gray-500 dark:text-gray-400 mt-1 leading-snug">{d.headline}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="valuation"
              stroke={profile.color}
              strokeWidth={1.5}
              dot={{ r: 3, fill: profile.color }}
              isAnimationActive={false}
            />
            {spikes.map((spike, i) => (
              <ReferenceDot
                key={i}
                x={spike.timestamp}
                y={spike.valuation}
                r={6}
                fill={spike.stepPct > 0 ? '#22c55e' : '#ef4444'}
                stroke={isDark ? '#18181b' : '#ffffff'}
                strokeWidth={2}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>

        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            Mark-up spike (&gt;25%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            Mark-down spike (&lt;-25%)
          </span>
          <span className="ml-auto">{spikes.length} re-rating events</span>
        </div>
      </div>

      {/* Two-column: re-rating events + event feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Re-rating events */}
        <div className="bg-white dark:bg-zinc-950 rounded-lg border border-gray-200 dark:border-zinc-800">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-900">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Re-rating Events</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Steps with |Δ valuation| &gt; 25%
            </p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-zinc-900 max-h-[420px] overflow-y-auto">
            {spikes
              .slice()
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((spike, i) => (
                <div key={i} className="px-6 py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <StageBadge stage={spike.stage} />
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{spike.date}</p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {formatLargeNumber(spike.valuation)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-sm font-semibold ${
                        spike.stepPct > 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatPercentage(spike.stepPct)}
                    </span>
                    <p className="text-xs text-gray-400 dark:text-gray-500">step</p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Event / news feed */}
        <div className="bg-white dark:bg-zinc-950 rounded-lg border border-gray-200 dark:border-zinc-800">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-900">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              Funding &amp; News Feed
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Rounds, tenders, secondaries &amp; milestones · {profile.name}
            </p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-zinc-900 max-h-[420px] overflow-y-auto">
            {series
              .slice()
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((item, i) => (
                <div key={i} className="px-6 py-4">
                  <div className="flex items-center gap-2 mb-1">
                    <ImpactIcon impact={item.impact} />
                    <StageBadge stage={item.stage} />
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{item.date}</span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-200 leading-snug">{item.headline}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatLargeNumber(item.valuation)} · source: {item.source}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
