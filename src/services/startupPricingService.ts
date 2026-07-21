// Startup Pricing Service
// ---------------------------------------------------------------------------
// Public equities have a continuous, exchange-quoted price. Private companies
// do not — so "price" for a late-stage startup has to be reconstructed from a
// handful of noisy, low-frequency, lagging sources. This module models those
// sources and exposes a valuation time series that the Series E "News Straddle"
// view can treat much like a price series.
//
// The data below is illustrative — assembled from public reporting and modeled
// where private marks are not disclosed. It is meant to demonstrate the
// strategy surface, not to be used as an investment record.

// --- What pricing data actually exists for a private startup? -------------
//
// There is no single tape. Instead there are several partial signals, each
// with a different cadence, latency, and reliability. The straddle thesis
// lives in the *spread* between them.

export type PricingSourceId =
  | 'primary'
  | 'secondary'
  | 'mutual-fund-mark'
  | '409a'
  | 'tender';

export interface PricingSource {
  id: PricingSourceId;
  label: string;
  /** One-line description of what the number represents. */
  what: string;
  /** Where the signal comes from. */
  provider: string;
  /** How often a fresh print typically appears. */
  cadence: string;
  /** How stale a print is by the time you can act on it. */
  latency: string;
  /** Rough confidence in the number as a proxy for fair value (0-1). */
  reliability: number;
}

export const PRICING_SOURCES: PricingSource[] = [
  {
    id: 'primary',
    label: 'Primary round',
    what: 'Post-money valuation set when the company sells new preferred shares.',
    provider: 'Company / lead investor (press, PitchBook, Crunchbase)',
    cadence: 'Every 12–24 months (one round)',
    latency: 'Disclosed on close, but headline post-money ignores liquidation prefs',
    reliability: 0.9,
  },
  {
    id: 'secondary',
    label: 'Secondary marks',
    what: 'Prices actual buyers pay for existing employee/early-investor shares.',
    provider: 'Forge Global, EquityZen, Nasdaq Private Market, Caplight',
    cadence: 'Continuous when there is a bid, thin and episodic otherwise',
    latency: 'Days to weeks; wide bid/ask, often at a discount to primary',
    reliability: 0.7,
  },
  {
    id: 'mutual-fund-mark',
    label: 'Crossover fund marks',
    what: 'Quarterly fair-value marks from public funds holding the shares.',
    provider: 'Fidelity, T. Rowe Price, BlackRock N-PORT / N-CSR filings',
    cadence: 'Quarterly (13F-style disclosure lag)',
    latency: '45–60 days after quarter end; smoothed and conservative',
    reliability: 0.75,
  },
  {
    id: '409a',
    label: '409A valuation',
    what: 'Independent fair value of COMMON stock for option strike pricing.',
    provider: 'Third-party appraiser (Carta, Scalar, etc.)',
    cadence: 'Every 12 months or after a material event',
    latency: 'Private; sits well below preferred/post-money by design',
    reliability: 0.6,
  },
  {
    id: 'tender',
    label: 'Tender offer',
    what: 'Company-sanctioned buyback price for employee liquidity.',
    provider: 'Company-run tender / SPV',
    cadence: 'Occasional (0–2 per year for hot names)',
    latency: 'Announced; a clean, real, arms-length clearing price',
    reliability: 0.85,
  },
];

// --- Funding / news events (the "spikes") ---------------------------------

export type StartupStage =
  | 'Seed'
  | 'Series A'
  | 'Series B'
  | 'Series C'
  | 'Series D'
  | 'Series E';

export interface ValuationEvent {
  date: string; // ISO date
  stage: StartupStage | 'News' | 'Secondary' | 'Tender';
  /** Post-money (or implied) valuation in USD. */
  valuation: number;
  /** Capital raised in the round, USD (undefined for pure news/secondary). */
  raised?: number;
  leadInvestor?: string;
  /** Which pricing source produced this number. */
  source: PricingSourceId | 'news';
  headline: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface StartupProfile {
  id: string;
  name: string;
  sector: string;
  founded: number;
  hq: string;
  blurb: string;
  color: string;
  /** Fully-diluted share count used to imply a per-share price. */
  fullyDilutedShares: number;
  events: ValuationEvent[];
}

// EliseAI — AI leasing/property + healthcare assistant. Trajectory modeled
// from public reporting; secondary/mark points are illustrative.
export const ELISE_AI: StartupProfile = {
  id: 'elise-ai',
  name: 'EliseAI',
  sector: 'Vertical AI · Housing & Healthcare automation',
  founded: 2017,
  hq: 'New York, NY',
  blurb:
    'Conversational AI that automates leasing, resident, and patient communication ' +
    'end to end. Reached unicorn status in 2024 and priced a Series E in 2025.',
  color: '#6366F1',
  fullyDilutedShares: 100_000_000,
  events: [
    {
      date: '2019-06-01',
      stage: 'Seed',
      valuation: 30_000_000,
      raised: 2_500_000,
      leadInvestor: 'DivcoWest / angels',
      source: 'primary',
      headline: 'Seed round to automate multifamily leasing conversations.',
      impact: 'positive',
    },
    {
      date: '2021-03-01',
      stage: 'Series A',
      valuation: 85_000_000,
      raised: 13_000_000,
      leadInvestor: 'Point72 Ventures',
      source: 'primary',
      headline: 'Series A as MeetElise; expands beyond scheduling into full leasing.',
      impact: 'positive',
    },
    {
      date: '2022-05-01',
      stage: 'Series B',
      valuation: 275_000_000,
      raised: 75_000_000,
      leadInvestor: 'Navitas Capital',
      source: 'primary',
      headline: 'Series B; rebrands to EliseAI and enters healthcare vertical.',
      impact: 'positive',
    },
    {
      date: '2023-02-15',
      stage: 'Secondary',
      valuation: 240_000_000,
      source: 'secondary',
      headline: 'Secondary bids soften on 2023 AI-funding pullback (~13% below B).',
      impact: 'negative',
    },
    {
      date: '2023-09-01',
      stage: 'News',
      valuation: 300_000_000,
      source: 'news',
      headline: 'Crosses $10M ARR milestone; enterprise property managers sign on.',
      impact: 'positive',
    },
    {
      date: '2024-06-01',
      stage: 'Series D',
      valuation: 1_000_000_000,
      raised: 75_000_000,
      leadInvestor: 'Sapphire Ventures',
      source: 'primary',
      headline: 'Series D vaults EliseAI to unicorn status at a $1B valuation.',
      impact: 'positive',
    },
    {
      date: '2024-11-15',
      stage: 'Tender',
      valuation: 1_150_000_000,
      source: 'tender',
      headline: 'Employee tender clears above the Series D mark on strong demand.',
      impact: 'positive',
    },
    {
      date: '2025-08-01',
      stage: 'Series E',
      valuation: 2_200_000_000,
      raised: 250_000_000,
      leadInvestor: 'Growth crossover syndicate',
      source: 'primary',
      headline: 'Series E: $250M at a $2.2B valuation to scale healthcare AI.',
      impact: 'positive',
    },
  ],
};

export const SERIES_E_STARTUPS: StartupProfile[] = [ELISE_AI];

// --- Derived series & spike detection -------------------------------------

export interface ValuationPoint {
  date: string;
  timestamp: number;
  valuation: number;
  impliedShare: number;
  stage: ValuationEvent['stage'];
  source: ValuationEvent['source'];
  /** Step-over-step change vs the previous datapoint. */
  stepPct: number;
  /** True when the re-rating is large enough to "straddle". */
  isSpike: boolean;
  headline: string;
  impact: ValuationEvent['impact'];
}

/**
 * Turn discrete funding/news events into a valuation series with per-step
 * returns. A "spike" is a step re-rating past `threshold` (default 25%) — the
 * private-market analog of a >2σ daily move in the public News Straddle.
 */
export function buildValuationSeries(
  profile: StartupProfile,
  threshold = 0.25,
): ValuationPoint[] {
  const sorted = [...profile.events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  let prev: number | null = null;
  return sorted.map((e) => {
    const stepPct = prev === null ? 0 : (e.valuation - prev) / prev;
    prev = e.valuation;
    return {
      date: e.date,
      timestamp: new Date(e.date).getTime(),
      valuation: e.valuation,
      impliedShare: e.valuation / profile.fullyDilutedShares,
      stage: e.stage,
      source: e.source,
      stepPct: stepPct * 100,
      isSpike: Math.abs(stepPct) >= threshold,
      headline: e.headline,
      impact: e.impact,
    };
  });
}

/** Compound annual growth rate of valuation across the full history. */
export function valuationCagr(profile: StartupProfile): number {
  const series = buildValuationSeries(profile);
  if (series.length < 2) return 0;
  const first = series[0];
  const last = series[series.length - 1];
  const years =
    (last.timestamp - first.timestamp) / (365.25 * 24 * 60 * 60 * 1000);
  if (years <= 0 || first.valuation <= 0) return 0;
  return (Math.pow(last.valuation / first.valuation, 1 / years) - 1) * 100;
}
