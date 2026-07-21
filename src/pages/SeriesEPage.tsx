import { Building2, MapPin, Calendar, Sparkles } from 'lucide-react';
import SeriesEStraddle from '../components/SeriesEStraddle';
import {
  ELISE_AI,
  PRICING_SOURCES,
  buildValuationSeries,
} from '../services/startupPricingService';
import { formatLargeNumber } from '../utils/formatters';

export default function SeriesEPage() {
  const series = buildValuationSeries(ELISE_AI);
  const latest = series[series.length - 1];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Series E</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Extending the News Straddle from public tickers to late-stage private companies.
          Featured name: EliseAI.
        </p>
      </div>

      {/* EliseAI high-level hero */}
      <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/40 dark:to-zinc-950 border border-indigo-100 dark:border-indigo-900/40 rounded-lg p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold shrink-0"
            style={{ backgroundColor: ELISE_AI.color }}
          >
            {ELISE_AI.name.slice(0, 2)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{ELISE_AI.name}</h2>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                Series E · {formatLargeNumber(latest.valuation)}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed max-w-3xl">
              {ELISE_AI.blurb}
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4" /> {ELISE_AI.sector}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> {ELISE_AI.hq}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> Founded {ELISE_AI.founded}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing data explainer */}
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg p-6 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            What pricing data exists for a startup?
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-5 max-w-3xl leading-relaxed">
          Unlike BTC or an ETF, a private company has no continuous tape. &ldquo;Price&rdquo; has to be
          reconstructed from a few sparse, lagging signals &mdash; and the strategy edge lives in the
          spread between them. These are the inputs the Series E straddle stitches together:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-zinc-800">
                <th className="py-2 pr-4 font-medium">Source</th>
                <th className="py-2 pr-4 font-medium">What it is</th>
                <th className="py-2 pr-4 font-medium">Cadence</th>
                <th className="py-2 pr-4 font-medium">Latency</th>
                <th className="py-2 font-medium">Reliability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {PRICING_SOURCES.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="py-3 pr-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                    {s.label}
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">
                    {s.what}
                    <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {s.provider}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{s.cadence}</td>
                  <td className="py-3 pr-4 text-gray-600 dark:text-gray-300">{s.latency}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full bg-indigo-500"
                          style={{ width: `${s.reliability * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {Math.round(s.reliability * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
          Valuation history is modeled from public reporting; secondary and mark points are
          illustrative. Not investment advice.
        </p>
      </div>

      {/* The straddle view */}
      <SeriesEStraddle />
    </div>
  );
}
