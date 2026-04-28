const axios = require('axios');
const { readCache, writeCache } = require('../cache');

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

function escapeForRegex(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildNamePattern(queries) {
  const terms = queries
    .map((q) => String(q || '').trim())
    .filter(Boolean)
    .flatMap((q) => q.split(/\s+/))
    .map((word) => escapeForRegex(word))
    .filter(Boolean);

  const unique = [...new Set(terms)].slice(0, 16);
  return unique.length ? unique.join('|') : 'fibre|telecom|syndic|terrassement|electricien|vrd|genie';
}

function buildOverpassQuery({ location, queries, maxResults }) {
  const namePattern = buildNamePattern(queries);
  const locationPattern = escapeForRegex(location);
  const safeLimit = Math.min(Math.max(1, Number(maxResults) || 50), 100);

  // On récupère les POI utiles dans une zone géographique textuelle,
  // puis on filtre par nom et par catégories OSM pertinentes.
  return `
[out:json][timeout:45];
area["name"~"${locationPattern}",i]->.searchArea;
(
  node["name"~"${namePattern}",i](area.searchArea);
  way["name"~"${namePattern}",i](area.searchArea);
  relation["name"~"${namePattern}",i](area.searchArea);

  node["office"~"telecommunication|property_management|property_manager|engineer",i](area.searchArea);
  way["office"~"telecommunication|property_management|property_manager|engineer",i](area.searchArea);
  relation["office"~"telecommunication|property_management|property_manager|engineer",i](area.searchArea);

  node["craft"~"electrician|builder|surveying|telecom",i](area.searchArea);
  way["craft"~"electrician|builder|surveying|telecom",i](area.searchArea);
  relation["craft"~"electrician|builder|surveying|telecom",i](area.searchArea);

  node["shop"~"telecommunication|electrical|construction",i](area.searchArea);
  way["shop"~"telecommunication|electrical|construction",i](area.searchArea);
  relation["shop"~"telecommunication|electrical|construction",i](area.searchArea);
);
out center tags ${safeLimit};
`;
}

function buildOverpassQueryAround({ latitude, longitude, queries, maxResults, radiusMeters }) {
  const namePattern = buildNamePattern(queries);
  const safeLimit = Math.min(Math.max(1, Number(maxResults) || 50), 100);
  const safeRadius = Math.min(Math.max(1000, Number(radiusMeters) || 25000), 100000);

  return `
[out:json][timeout:45];
(
  nwr["name"~"${namePattern}",i](around:${safeRadius},${latitude},${longitude});
  nwr["office"~"telecommunication|property_management|property_manager|engineer",i](around:${safeRadius},${latitude},${longitude});
  nwr["craft"~"electrician|builder|surveying|telecom",i](around:${safeRadius},${latitude},${longitude});
  nwr["shop"~"telecommunication|electrical|construction",i](around:${safeRadius},${latitude},${longitude});
  nwr["amenity"~"internet_cafe|telephone|office",i](around:${safeRadius},${latitude},${longitude});
);
out center tags ${safeLimit};
`;
}

async function geocodeLocation(location) {
  const cachePayload = { location };
  const cached = await readCache('geocode_nominatim', cachePayload);
  if (cached) return cached;

  const { data } = await axios.get(NOMINATIM_URL, {
    timeout: 30000,
    params: {
      q: location,
      format: 'jsonv2',
      limit: 1,
      addressdetails: 0,
      countrycodes: 'fr',
    },
    headers: {
      'User-Agent': 'x3com-prospection-fibre/1.0 (free-osm)',
      'Accept-Language': 'fr',
    },
  });

  const first = Array.isArray(data) ? data[0] : null;
  const value = first
    ? {
        latitude: first.lat != null ? Number(first.lat) : null,
        longitude: first.lon != null ? Number(first.lon) : null,
      }
    : null;

  await writeCache('geocode_nominatim', cachePayload, value);
  return value;
}

async function fetchOverpass(overpassQuery) {
  let lastError = null;

  for (const endpoint of OVERPASS_URLS) {
    try {
      const { data } = await axios.post(endpoint, overpassQuery, {
        timeout: Number(process.env.SEARCH_OVERPASS_TIMEOUT_MS || 25000),
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': 'x3com-prospection-fibre/1.0 (free-osm)',
        },
      });
      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Aucun endpoint Overpass disponible');
}

function extractCenter(item) {
  if (item.lat != null && item.lon != null) {
    return { latitude: Number(item.lat), longitude: Number(item.lon) };
  }
  if (item.center?.lat != null && item.center?.lon != null) {
    return { latitude: Number(item.center.lat), longitude: Number(item.center.lon) };
  }
  return { latitude: null, longitude: null };
}

function buildAddress(tags) {
  const parts = [tags['addr:housenumber'], tags['addr:street'], tags['addr:postcode'], tags['addr:city']]
    .filter(Boolean)
    .join(' ');
  return parts || null;
}

async function scrapeOverpassPlaces({ query, location, queries = [], maxResults = 50 }) {
  const center = await geocodeLocation(location);
  const hasCenter = Boolean(center && Number.isFinite(center.latitude) && Number.isFinite(center.longitude));

  const cachePayload = {
    query,
    location,
    queries,
    maxResults,
    strategy: hasCenter ? 'around' : 'area',
    latitude: hasCenter ? Number(center.latitude.toFixed(5)) : null,
    longitude: hasCenter ? Number(center.longitude.toFixed(5)) : null,
  };

  const cached = await readCache('overpass', cachePayload);
  if (cached) return cached;

  const overpassQuery = hasCenter
    ? buildOverpassQueryAround({
        latitude: center.latitude,
        longitude: center.longitude,
        queries: [query, ...queries],
        maxResults,
        radiusMeters: Number(process.env.SEARCH_OVERPASS_RADIUS_METERS || 25000),
      })
    : buildOverpassQuery({ location, queries: [query, ...queries], maxResults });

  const data = await fetchOverpass(overpassQuery);

  const elements = Array.isArray(data?.elements) ? data.elements : [];

  const results = elements
    .map((item) => {
      const tags = item.tags || {};
      const name = tags.name || null;
      if (!name) return null;

      const { latitude, longitude } = extractCenter(item);
      const category = tags.office || tags.craft || tags.shop || tags.amenity || item.type || null;

      return {
        source: 'openstreetmap_overpass',
        sourceId: item.id ? String(item.id) : null,
        sourceUrl: `https://www.openstreetmap.org/${item.type}/${item.id}`,
        name,
        category,
        address: buildAddress(tags),
        postalCode: tags['addr:postcode'] || null,
        city: tags['addr:city'] || null,
        phone: tags.phone || tags['contact:phone'] || null,
        email: tags.email || tags['contact:email'] || null,
        website: tags.website || tags['contact:website'] || null,
        latitude,
        longitude,
        rating: null,
        reviewCount: null,
        searchQuery: query,
        rawPayload: item,
      };
    })
    .filter(Boolean)
    .slice(0, Math.min(Math.max(1, Number(maxResults) || 50), 100));

  await writeCache('overpass', cachePayload, results);
  return results;
}

module.exports = {
  scrapeOverpassPlaces,
};
