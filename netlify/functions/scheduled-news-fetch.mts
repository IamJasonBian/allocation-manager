// Scheduled News Fetch - Runs hourly to collect BTC + MicroStrategy news
// Stores results in Netlify Blob storage: coindesk/filtered-mstr-btc

import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';

const COINDESK_API = 'https://data-api.coindesk.com/news/v1/article/list';

// Keywords to filter for MicroStrategy/Strategy related news
const MSTR_KEYWORDS = ['microstrategy', 'saylor', 'mstr', 'strategy'];

interface Article {
  id: string;
  title: string;
  author: string;
  published_utc: string;
  article_url: string;
  image_url: string | null;
  description: string;
  categories: string[];
  keywords: string;
  tickers: string[];
  source: string;
  publisher: {
    name: string;
  };
}

interface StoredData {
  last_updated: string;
  fetch_count: number;
  btc_news: Article[];
  mstr_filtered: Article[];
}

// Check if article matches MicroStrategy keywords
const matchesMstrFilter = (article: Record<string, unknown>): boolean => {
  const searchText = [
    article.TITLE || '',
    article.SUBTITLE || '',
    article.BODY || '',
    article.KEYWORDS || '',
  ].join(' ').toLowerCase();

  return MSTR_KEYWORDS.some(keyword => searchText.includes(keyword.toLowerCase()));
};

// Transform raw API article to normalized format
const transformArticle = (article: Record<string, unknown>): Article => {
  const categories = ((article.CATEGORY_DATA as Array<{ CATEGORY?: string; NAME?: string }>) || [])
    .map(c => c.CATEGORY || c.NAME || '');

  return {
    id: String(article.ID || ''),
    title: String(article.TITLE || ''),
    author: String(article.AUTHORS || article.AUTHOR || ''),
    published_utc: article.PUBLISHED_ON
      ? new Date((article.PUBLISHED_ON as number) * 1000).toISOString()
      : '',
    article_url: String(article.URL || ''),
    image_url: article.IMAGE_URL ? String(article.IMAGE_URL) : null,
    description: String(article.SUBTITLE || (article.BODY as string)?.slice(0, 200) || ''),
    categories,
    keywords: String(article.KEYWORDS || ''),
    tickers: categories.includes('BTC') ? ['BTC'] : [],
    source: 'coindesk',
    publisher: {
      name: String((article.SOURCE_DATA as Record<string, unknown>)?.NAME || 'CoinDesk'),
    },
  };
};

export default async function handler() {
  const apiKey = process.env.COINDESK_API_KEY;

  if (!apiKey) {
    console.error('COINDESK_API_KEY not configured');
    return new Response(JSON.stringify({ error: 'COINDESK_API_KEY not configured' }), {
      status: 500,
    });
  }

  try {
    // Fetch latest BTC news (50 articles to have enough for filtering)
    const url = new URL(COINDESK_API);
    url.searchParams.set('lang', 'EN');
    url.searchParams.set('limit', '50');
    url.searchParams.set('categories', 'BTC');
    url.searchParams.set('api_key', apiKey);

    console.log('Fetching CoinDesk news...');
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`CoinDesk API returned ${response.status}`);
    }

    const data = await response.json();
    const items = (data.Data || data.data || []) as Record<string, unknown>[];

    console.log(`Fetched ${items.length} articles from CoinDesk`);

    // Transform all articles
    const allArticles = items.map(transformArticle);

    // Filter for MicroStrategy mentions
    const mstrFiltered = items
      .filter(matchesMstrFilter)
      .map(transformArticle);

    console.log(`Found ${mstrFiltered.length} MicroStrategy-related articles`);

    // Get existing data from blob storage
    const store = getStore('coindesk');
    let existingData: StoredData | null = null;

    try {
      const existing = await store.get('filtered-mstr-btc', { type: 'json' });
      existingData = existing as StoredData | null;
    } catch {
      console.log('No existing data found, starting fresh');
    }

    // Merge with existing data, deduplicate by ID
    const existingBtcIds = new Set((existingData?.btc_news || []).map(a => a.id));
    const existingMstrIds = new Set((existingData?.mstr_filtered || []).map(a => a.id));

    const newBtcArticles = allArticles.filter(a => !existingBtcIds.has(a.id));
    const newMstrArticles = mstrFiltered.filter(a => !existingMstrIds.has(a.id));

    // Combine and sort by date (newest first), keep last 200 articles
    const combinedBtc = [...newBtcArticles, ...(existingData?.btc_news || [])]
      .sort((a, b) => new Date(b.published_utc).getTime() - new Date(a.published_utc).getTime())
      .slice(0, 200);

    const combinedMstr = [...newMstrArticles, ...(existingData?.mstr_filtered || [])]
      .sort((a, b) => new Date(b.published_utc).getTime() - new Date(a.published_utc).getTime())
      .slice(0, 100);

    // Prepare data to store
    const dataToStore: StoredData = {
      last_updated: new Date().toISOString(),
      fetch_count: (existingData?.fetch_count || 0) + 1,
      btc_news: combinedBtc,
      mstr_filtered: combinedMstr,
    };

    // Store in blob
    await store.setJSON('filtered-mstr-btc', dataToStore);

    console.log(`Stored ${combinedBtc.length} BTC articles, ${combinedMstr.length} MSTR articles`);
    console.log(`New articles: ${newBtcArticles.length} BTC, ${newMstrArticles.length} MSTR`);

    return new Response(JSON.stringify({
      success: true,
      last_updated: dataToStore.last_updated,
      fetch_count: dataToStore.fetch_count,
      btc_count: combinedBtc.length,
      mstr_count: combinedMstr.length,
      new_btc: newBtcArticles.length,
      new_mstr: newMstrArticles.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Scheduled news fetch error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch/store news',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
    });
  }
}

// Schedule: Run every hour at minute 0
export const config: Config = {
  schedule: '0 * * * *',
};
