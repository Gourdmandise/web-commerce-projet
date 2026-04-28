const axios = require('axios');
const { readCache, writeCache } = require('../cache');

const PHOTON_URL = 'https://photon.komoot.io/api/';

function buildAddress(props = {}) {
  const parts = [props.housenumber, props.street, props.postcode, props.city || props.name]
    .filter(Boolean)
    .join(' ');
  return parts || null;
}

async function scrapePhotonPlaces({ query, location, maxResults = 25 }) {
  const safeMax = Math.min(Math.max(1, Number(maxResults) || 25), 50);
  const textQuery = `${query} ${location}`.trim();
  const cachePayload = { query, location, maxResults: safeMax };

  const cached = await readCache('photon', cachePayload);
  if (cached) return cached;

  const { data } = await axios.get(PHOTON_URL, {
    timeout: Number(process.env.PHOTON_TIMEOUT_MS || 20000),
    params: {
      q: textQuery,
      limit: safeMax,
      lang: 'fr',
    },
    headers: {
      'User-Agent': 'x3com-prospection-fibre/1.0 (free-osm-photon)',
    },
  });

  const features = Array.isArray(data?.features) ? data.features : [];
  const results = features
    .filter((feature) => {
      const props = feature?.properties || {};
      const countryCode = String(props.countrycode || '').trim().toLowerCase();
      if (!countryCode) return true;
      return countryCode === 'fr';
    })
    .map((feature) => {
      const props = feature.properties || {};
      const coords = Array.isArray(feature.geometry?.coordinates) ? feature.geometry.coordinates : [];
      const longitude = typeof coords[0] === 'number' ? coords[0] : null;
      const latitude = typeof coords[1] === 'number' ? coords[1] : null;

      return {
        source: 'photon',
        sourceId: props.osm_id ? String(props.osm_id) : null,
        sourceUrl: props.osm_id && props.osm_type
          ? `https://www.openstreetmap.org/${props.osm_type}/${props.osm_id}`
          : null,
        name: props.name || props.city || null,
        category: props.osm_key || props.type || null,
        address: buildAddress(props),
        postalCode: props.postcode || null,
        city: props.city || null,
        phone: null,
        website: null,
        latitude,
        longitude,
        rating: null,
        reviewCount: null,
        searchQuery: query,
        rawPayload: feature,
      };
    })
    .filter((item) => item.name);

  await writeCache('photon', cachePayload, results);
  return results;
}

module.exports = {
  scrapePhotonPlaces,
};
