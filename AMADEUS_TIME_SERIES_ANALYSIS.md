# Amadeus API Analysis for Time-Series Price Data

## Current Implementation

**API Used:** `Flight Offers Search` (`amadeus.shopping.flightOffersSearch.get()`)

**Current Approach:**
- Loop through 30 dates
- Make 30 separate API calls (one per date)
- Each call searches for flights on that specific date
- Extract cheapest price from each response
- Very slow and uses 30 API credits per route query

**File:** `netlify/functions/flight-prices.js`

```javascript
// Current: 30 separate calls
for (let i = 0; i < 30; i++) {
  const response = await amadeus.shopping.flightOffersSearch.get({
    originLocationCode: origin,
    destinationLocationCode: destination,
    departureDate: date,
    adults: '1',
    max: '1'
  });
}
```

## Better Approach: Flight Cheapest Date Search API

### API Overview

**Endpoint:** `GET /v1/shopping/flight-dates`

**Purpose:** Specifically designed for finding cheapest dates across a range
- Returns prices for multiple dates in a single call
- Uses cached data (fast, efficient)
- Perfect for time-series price charts
- Only 1 API call instead of 30!

### API Parameters

**Required:**
- `origin` (IATA code, e.g., "JFK")
- `destination` (IATA code, e.g., "LHR")

**Optional:**
- `departureDate` - Start date range (YYYY-MM-DD)
- `oneWay` - true/false (default: false for round-trip)
- `duration` - Trip duration in days
- `nonStop` - true/false
- `maxPrice` - Maximum price filter
- `viewBy` - "DATE", "DURATION", or "WEEK"

### Response Format

```json
{
  "data": [
    {
      "type": "flight-date",
      "origin": "JFK",
      "destination": "LHR",
      "departureDate": "2025-12-27",
      "returnDate": "2026-01-03",
      "price": {
        "total": "542.00"
      },
      "links": {
        "flightOffers": "https://api.amadeus.com/v2/shopping/flight-offers?..."
      }
    }
    // ... more dates
  ]
}
```

## Test cURL Commands

### 1. Get Access Token

```bash
curl -X POST "https://test.api.amadeus.com/v1/security/oauth2/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_API_KEY" \
  -d "client_secret=YOUR_API_SECRET"
```

Response:
```json
{
  "access_token": "AnExampleAccessToken",
  "token_type": "Bearer",
  "expires_in": 1799
}
```

### 2. Search Cheapest Dates (One-way)

```bash
curl -X GET "https://test.api.amadeus.com/v1/shopping/flight-dates?origin=JFK&destination=LHR&oneWay=true" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3. Search with Date Range

```bash
curl -X GET "https://test.api.amadeus.com/v1/shopping/flight-dates?origin=JFK&destination=LHR&departureDate=2025-12-27&oneWay=true&viewBy=DATE" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 4. Search with Duration Filter

```bash
curl -X GET "https://test.api.amadeus.com/v1/shopping/flight-dates?origin=JFK&destination=LHR&duration=7&nonStop=false" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Implementation Plan

### Option 1: Use Flight Cheapest Date Search (Recommended)

**Pros:**
- ✅ Single API call (vs 30 calls)
- ✅ Much faster response time
- ✅ Lower API credit usage
- ✅ Designed for this exact use case
- ✅ Returns optimized date ranges

**Cons:**
- ⚠️ Uses cached data (updated daily, not real-time)
- ⚠️ May not return all 30 days
- ⚠️ Flight details might be less comprehensive

**Best for:** Price trend visualization over weeks/months

### Option 2: Hybrid Approach (Best of Both)

1. Use **Flight Cheapest Date Search** for initial chart data (fast)
2. Use **Flight Offers Search** when user clicks a specific date (detailed)

**Implementation:**
```javascript
// Step 1: Get price trends (1 API call)
const trendData = await amadeus.shopping.flightDates.get({
  origin: 'JFK',
  destination: 'LHR',
  oneWay: true,
  departureDate: '2025-12-27'
});

// Step 2: When user hovers/clicks specific date, get live details
const liveOffers = await amadeus.shopping.flightOffersSearch.get({
  originLocationCode: 'JFK',
  destinationLocationCode: 'LHR',
  departureDate: '2025-12-30',
  adults: '1',
  max: '5'
});
```

### Option 3: Keep Current Approach

**Pros:**
- ✅ Real-time pricing
- ✅ Full flight details for each date
- ✅ Most accurate data

**Cons:**
- ❌ 30 API calls per query (expensive)
- ❌ Very slow (30+ seconds)
- ❌ High API credit consumption
- ❌ Not scalable

## Recommended Implementation

### Updated `flight-prices.js`

```javascript
import Amadeus from 'amadeus';
import config from '../../src/config/env.js';

const amadeus = new Amadeus({
  clientId: config.amadeus.apiKey,
  clientSecret: config.amadeus.apiSecret,
  hostname: config.amadeus.hostname
});

export const handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { from, to } = event.queryStringParameters || {};

    if (!from || !to) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing from/to parameters' })
      };
    }

    console.log(`Fetching price trends for ${from} to ${to}`);

    // Use Flight Cheapest Date Search API (1 call instead of 30!)
    const response = await amadeus.shopping.flightDates.get({
      origin: from,
      destination: to,
      oneWay: true,
      viewBy: 'DATE'
    });

    if (response.data && response.data.length > 0) {
      // Transform to our expected format
      const prices = response.data.map(item => ({
        date: item.departureDate,
        price: parseFloat(item.price.total),
        flightDetails: {
          // Note: Cheapest Date API has less detail
          // Can fetch full details on-demand if needed
          departureTime: item.departureDate + 'T08:00:00',
          bookingClass: 'ECONOMY',
          stops: null // Not provided by this API
        }
      }));

      const priceValues = prices.map(p => p.price);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          prices,
          basePrice: Math.round(priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length),
          lowestPrice: Math.min(...priceValues),
          highestPrice: Math.max(...priceValues),
          source: 'amadeus-cheapest-dates'
        })
      };
    }

    // Fallback to mock data
    return generateMockFallback(from, to, headers);

  } catch (error) {
    console.error('Error in flight-prices:', error);
    return generateMockFallback(from, to, headers);
  }
};
```

## Node.js SDK Usage

```javascript
// Install: npm install amadeus

const Amadeus = require('amadeus');

const amadeus = new Amadeus({
  clientId: 'YOUR_API_KEY',
  clientSecret: 'YOUR_API_SECRET'
});

// Get cheapest dates
amadeus.shopping.flightDates.get({
  origin: 'JFK',
  destination: 'LHR',
  oneWay: true
}).then(function(response){
  console.log(response.data);
}).catch(function(error){
  console.error(error);
});
```

## Performance Comparison

| Approach | API Calls | Time | Cost | Data Freshness |
|----------|-----------|------|------|----------------|
| Current (30x Search) | 30 | ~30s | High | Real-time |
| Cheapest Dates | 1 | ~1s | Low | Daily cache |
| Hybrid | 1 + on-demand | ~1s base | Medium | Mixed |

## Next Steps

1. **Set up Amadeus credentials** in `.env`:
   ```
   AMADEUS_API_KEY=your_key_here
   AMADEUS_API_SECRET=your_secret_here
   AMADEUS_HOSTNAME=test  # or 'production'
   ```

2. **Test the Cheapest Dates API** with curl commands above

3. **Update flight-prices function** to use the new API

4. **Test performance** and compare results

5. **Consider hybrid approach** for best UX
