// News Cache Reader - Returns cached news from blob storage
// GET /.netlify/functions/news-cache?type=btc|mstr|all

import { getStore } from '@netlify/blobs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

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

export default async function handler(request: Request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response('', { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);

    // Get data from blob storage
    const store = getStore('coindesk');
    const data = await store.get('filtered-mstr-btc', { type: 'json' }) as StoredData | null;

    if (!data) {
      return new Response(JSON.stringify({
        error: 'No cached data available',
        hint: 'The scheduled job may not have run yet',
      }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    let results: Article[];
    switch (type) {
      case 'btc':
        results = data.btc_news.slice(0, limit);
        break;
      case 'mstr':
        results = data.mstr_filtered.slice(0, limit);
        break;
      case 'all':
      default:
        // Merge and dedupe, sorted by date
        const allIds = new Set<string>();
        const merged: Article[] = [];
        for (const article of [...data.mstr_filtered, ...data.btc_news]) {
          if (!allIds.has(article.id)) {
            allIds.add(article.id);
            merged.push(article);
          }
        }
        results = merged
          .sort((a, b) => new Date(b.published_utc).getTime() - new Date(a.published_utc).getTime())
          .slice(0, limit);
    }

    return new Response(JSON.stringify({
      results,
      count: results.length,
      type,
      last_updated: data.last_updated,
      fetch_count: data.fetch_count,
      cache_stats: {
        btc_total: data.btc_news.length,
        mstr_total: data.mstr_filtered.length,
      },
    }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('News cache read error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to read news cache',
      details: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
