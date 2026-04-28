const axios = require('axios');
const { readCache, writeCache } = require('../cache');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
let lastNominatimCallAt = 0;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractPostalAndCity(address = {}) {
  const postalCode = address.postcode || null;
  const city = address.city || address.town || address.village || address.municipality || null;
  return { postalCode, city };
}

async function scrapeOsmPlaces({ query, location, maxResults = 25 }) {
  const safeMax = Math.min(Math.max(1, Number(maxResults) || 25), 50);
  const textQuery = `${query} ${location}`.trim();
  const cachePayload = { query, location, maxResults: safeMax };

  const cached = await readCache('osm_nominatim', cachePayload);
  if (cached) return cached;

  const minInterval = Number(process.env.OSM_REQUEST_INTERVAL_MS || 1200);
  const elapsed = Date.now() - lastNominatimCallAt;
  if (elapsed < minInterval) {
    await wait(minInterval - elapsed);
  }

  let data = [];

  try {
    const response = await axios.get(NOMINATIM_URL, {
      timeout: Number(process.env.OSM_TIMEOUT_MS || 30000),
      params: {
        q: textQuery,
        format: 'jsonv2',
        addressdetails: 1,
        limit: safeMax,
        countrycodes: 'fr',
        dedupe: 1,
      },
      headers: {
        'User-Agent': 'x3com-prospection-fibre/1.0 (contact: ops@x3com.local)',
        'Accept-Language': 'fr',
      },
    });
    data = response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      return [];
    }
    throw error;
  } finally {
    lastNominatimCallAt = Date.now();
  }

  const results = (Array.isArray(data) ? data : []).map((item) => {
    const { postalCode, city } = extractPostalAndCity(item.address || {});

    return {
      source: 'openstreetmap',
      sourceId: item.place_id ? String(item.place_id) : null,
      sourceUrl: item.osm_id
        ? `https://www.openstreetmap.org/${item.osm_type || 'node'}/${item.osm_id}`
        : null,
      name: item.name || (item.display_name ? item.display_name.split(',')[0].trim() : null),
      category: item.type || item.class || null,
      address: item.display_name || null,
      postalCode,
      city,
      phone: null,
      website: null,
      latitude: item.lat ? Number(item.lat) : null,
      longitude: item.lon ? Number(item.lon) : null,
      rating: null,
      reviewCount: null,
      searchQuery: query,
      rawPayload: item,
    };
  });

  await writeCache('osm_nominatim', cachePayload, results);
  return results;
}

module.exports = {
  scrapeOsmPlaces,
};
