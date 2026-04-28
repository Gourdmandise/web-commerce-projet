require('dotenv').config();

const { withDb, closeDb } = require('./db');
const { normalizeLead } = require('./normalize');
const { enrichLeadEmail } = require('./email-enrichment');
const { scrapeOsmPlaces } = require('./sources/osm');
const { scrapePhotonPlaces } = require('./sources/photon');
const { scrapeOverpassPlaces } = require('./sources/overpass');

const DEFAULT_QUERIES = [
  'fibre optique',
  'raccordement fibre',
  'terrassement telecom',
  'genie civil telecom',
  'syndic copropriete',
];

const DEFAULT_OSM_FALLBACK_QUERIES = ['telecommunications', 'genie civil', 'syndic', 'travaux publics'];

const DEFAULT_TARGET_SEGMENTS = ['b2b_syndic', 'b2b_entreprise', 'particulier'];
const DEFAULT_TARGET_DEPARTMENTS = ['31', '81'];

function parseCsvSet(value, defaults = []) {
  const list = value
    ? value.split(',').map((v) => v.trim()).filter(Boolean)
    : defaults;
  return new Set(list);
}

function getTargetSegments() {
  return parseCsvSet(process.env.TARGET_SEGMENTS, DEFAULT_TARGET_SEGMENTS);
}

function getTargetDepartments() {
  return parseCsvSet(process.env.TARGET_DEPARTMENTS, DEFAULT_TARGET_DEPARTMENTS);
}

function getMinScore() {
  const raw = Number(process.env.MIN_FIBER_SCORE || 60);
  if (!Number.isFinite(raw)) return 60;
  return Math.max(0, Math.min(100, raw));
}

function getDedupeWindowDays() {
  const raw = Number(process.env.DEDUPE_WINDOW_DAYS || 90);
  if (!Number.isFinite(raw) || raw <= 0) return 90;
  return Math.floor(raw);
}

function buildMonthlyCampaignTag(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `campagne_${year}_${month}`;
}

function getCampaignTag() {
  const fromEnv = (process.env.CAMPAIGN_TAG || '').trim();
  if (fromEnv) return fromEnv;
  return buildMonthlyCampaignTag();
}

function leadDepartment(lead) {
  const postal = String(lead.postalCode || '');
  if (/^\d{5}$/.test(postal)) return postal.slice(0, 2);

  const address = String(lead.address || '');
  const match = address.match(/\b(\d{5})\b/);
  if (match) return match[1].slice(0, 2);
  return null;
}

function shouldKeepLead(lead, { targetSegments, targetDepartments, minScore }) {
  if (!lead.name || !lead.dedupeKey) return { keep: false, reason: 'Lead incomplet' };
  if (lead.fiberRelevanceScore < minScore) return { keep: false, reason: 'Score insuffisant' };

  if (!targetSegments.has(lead.targetSegment)) {
    return { keep: false, reason: 'Segment hors cible' };
  }

  const dept = leadDepartment(lead);
  if (!dept) return { keep: false, reason: 'Departement introuvable' };
  if (!targetDepartments.has(dept)) return { keep: false, reason: `Departement ${dept} hors zone` };

  return { keep: true };
}

function getQueries() {
  const fromEnv = process.env.SEARCH_QUERIES;
  if (!fromEnv) return DEFAULT_QUERIES;

  return fromEnv
    .split(',')
    .map((q) => q.trim())
    .filter(Boolean);
}

function getLocation() {
  const location = process.env.SEARCH_LOCATION;
  if (!location) {
    throw new Error('SEARCH_LOCATION manquant (ex: Lyon ou 69000)');
  }
  return location;
}

function getOsmFallbackQueries() {
  return parseCsvSet(process.env.OSM_FALLBACK_QUERIES, DEFAULT_OSM_FALLBACK_QUERIES);
}

function isOverpassEnabled() {
  const raw = String(process.env.ENABLE_OVERPASS || 'true').trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(raw);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureSchema() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS lead_prospects (
      id BIGSERIAL PRIMARY KEY,
      dedupe_key TEXT NOT NULL UNIQUE,
      source_first TEXT NOT NULL,
      source_last TEXT NOT NULL,
      source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
      name TEXT,
      category TEXT,
      address TEXT,
      postal_code TEXT,
      city TEXT,
      phone TEXT,
      website TEXT,
      email TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      rating DOUBLE PRECISION,
      review_count INTEGER,
      search_query TEXT,
      target_segment TEXT,
      campaign_tag TEXT,
      fiber_relevance_score INTEGER NOT NULL DEFAULT 0,
      fiber_relevance_reason TEXT,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE lead_prospects
      ADD COLUMN IF NOT EXISTS target_segment TEXT,
      ADD COLUMN IF NOT EXISTS campaign_tag TEXT,
      ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

    CREATE INDEX IF NOT EXISTS lead_prospects_score_idx
      ON lead_prospects(fiber_relevance_score DESC);

    CREATE INDEX IF NOT EXISTS lead_prospects_city_idx
      ON lead_prospects(city);

    CREATE INDEX IF NOT EXISTS lead_prospects_postal_code_idx
      ON lead_prospects(postal_code);
  `;

  await withDb((client) => client.query(ddl));
}

async function upsertLead(lead) {
  const query = `
    INSERT INTO lead_prospects (
      dedupe_key,
      source_first,
      source_last,
      source_refs,
      name,
      category,
      address,
      postal_code,
      city,
      phone,
      website,
      email,
      latitude,
      longitude,
      rating,
      review_count,
      search_query,
      target_segment,
      campaign_tag,
      fiber_relevance_score,
      fiber_relevance_reason,
      raw
    ) VALUES (
      $1, $2, $3, to_jsonb($4::text[]),
      $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20, $21,
      $22::jsonb
    )
    ON CONFLICT (dedupe_key)
    DO UPDATE SET
      source_last = EXCLUDED.source_last,
      source_refs = (
        SELECT to_jsonb(array_agg(DISTINCT ref))
        FROM (
          SELECT jsonb_array_elements_text(lead_prospects.source_refs) AS ref
          UNION
          SELECT jsonb_array_elements_text(EXCLUDED.source_refs) AS ref
        ) refs
      ),
      name = COALESCE(EXCLUDED.name, lead_prospects.name),
      category = COALESCE(EXCLUDED.category, lead_prospects.category),
      address = COALESCE(EXCLUDED.address, lead_prospects.address),
      postal_code = COALESCE(EXCLUDED.postal_code, lead_prospects.postal_code),
      city = COALESCE(EXCLUDED.city, lead_prospects.city),
      phone = COALESCE(EXCLUDED.phone, lead_prospects.phone),
      website = COALESCE(EXCLUDED.website, lead_prospects.website),
      email = COALESCE(EXCLUDED.email, lead_prospects.email),
      latitude = COALESCE(EXCLUDED.latitude, lead_prospects.latitude),
      longitude = COALESCE(EXCLUDED.longitude, lead_prospects.longitude),
      rating = COALESCE(EXCLUDED.rating, lead_prospects.rating),
      review_count = COALESCE(EXCLUDED.review_count, lead_prospects.review_count),
      search_query = COALESCE(EXCLUDED.search_query, lead_prospects.search_query),
      target_segment = COALESCE(EXCLUDED.target_segment, lead_prospects.target_segment),
      campaign_tag = EXCLUDED.campaign_tag,
      fiber_relevance_score = GREATEST(EXCLUDED.fiber_relevance_score, lead_prospects.fiber_relevance_score),
      fiber_relevance_reason = EXCLUDED.fiber_relevance_reason,
      raw = lead_prospects.raw || EXCLUDED.raw,
      last_seen_at = NOW(),
      updated_at = NOW();
  `;

  const values = [
    lead.dedupeKey,
    lead.source,
    lead.source,
    [lead.source],
    lead.name,
    lead.category,
    lead.address,
    lead.postalCode,
    lead.city,
    lead.phone,
    lead.website,
    lead.email,
    lead.latitude,
    lead.longitude,
    lead.rating,
    lead.reviewCount,
    lead.searchQuery,
    lead.targetSegment,
    lead.campaignTag,
    lead.fiberRelevanceScore,
    lead.fiberRelevanceReason,
    JSON.stringify({ [lead.source]: lead.rawPayload }),
  ];

  await withDb((client) => client.query(query, values));
}

async function isRecentDuplicate(dedupeKey, windowDays) {
  const query = `
    SELECT updated_at
    FROM lead_prospects
    WHERE dedupe_key = $1
      AND updated_at >= NOW() - ($2::text || ' days')::interval
    LIMIT 1;
  `;

  const result = await withDb((client) => client.query(query, [dedupeKey, String(windowDays)]));
  return result.rowCount > 0;
}

async function scrapeOneQuery(query, location, { overpassEnabled, osmFallbackQueries }) {
  const osmMaxResults = Number(process.env.SEARCH_OSM_MAX_RESULTS || 25);
  const overpassMaxResults = Number(process.env.SEARCH_OVERPASS_MAX_RESULTS || 50);

  const tasks = [
    scrapeOsmPlaces({
      query,
      location,
      maxResults: osmMaxResults,
    }),
    scrapePhotonPlaces({
      query,
      location,
      maxResults: Number(process.env.SEARCH_PHOTON_MAX_RESULTS || 25),
    }),
  ];

  if (overpassEnabled) {
    tasks.push(
      scrapeOverpassPlaces({
        query,
        location,
        queries: [query],
        maxResults: overpassMaxResults,
      })
    );
  }

  const settled = await Promise.allSettled(tasks);
  const osmRaw = settled[0];
  const photonRaw = settled[1];
  const overpassRaw = overpassEnabled ? settled[2] : null;

  const results = [];

  if (osmRaw.status === 'fulfilled') {
    results.push(...osmRaw.value);

    if (osmRaw.value.length === 0) {
      const fallbackTerms = [...osmFallbackQueries];
      const fallbackMax = Math.max(5, Math.floor(osmMaxResults / 2));

      for (const term of fallbackTerms) {
        try {
          const fallbackResults = await scrapeOsmPlaces({
            query: term,
            location,
            maxResults: fallbackMax,
          });
          results.push(...fallbackResults);

          // On espace volontairement les appels pour respecter la politique Nominatim.
          await sleep(Number(process.env.OSM_REQUEST_INTERVAL_MS || 1200));

          if (results.length >= osmMaxResults) break;
        } catch (error) {
          console.error(`[OpenStreetMap fallback] ${term}: ${error.message}`);
        }
      }
    }
  } else {
    console.error(`[OpenStreetMap] ${query}: ${osmRaw.reason.message}`);
  }

  if (photonRaw.status === 'fulfilled') {
    results.push(...photonRaw.value);
  } else {
    console.error(`[Photon] ${query}: ${photonRaw.reason.message}`);
  }

  if (overpassRaw) {
    if (overpassRaw.status === 'fulfilled') {
      results.push(...overpassRaw.value);
    } else {
      console.error(`[Overpass] ${query}: ${overpassRaw.reason.message}`);
    }
  }

  return results;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL manquant');
  }

  const queries = getQueries();
  const location = getLocation();
  const targetSegments = getTargetSegments();
  const targetDepartments = getTargetDepartments();
  const minScore = getMinScore();
  const dedupeWindowDays = getDedupeWindowDays();
  const campaignTag = getCampaignTag();
  const overpassEnabled = isOverpassEnabled();
  const osmFallbackQueries = getOsmFallbackQueries();

  await ensureSchema();

  let insertedOrUpdated = 0;
  let processedRaw = 0;
  let filteredOut = 0;
  let skippedByDedupe = 0;

  for (const query of queries) {
    console.log(`Recherche: "${query}" sur "${location}"`);
    const rawLeads = await scrapeOneQuery(query, location, {
      overpassEnabled,
      osmFallbackQueries,
    });
    processedRaw += rawLeads.length;

    for (const raw of rawLeads) {
      const lead = normalizeLead(raw);
      const keep = shouldKeepLead(lead, { targetSegments, targetDepartments, minScore });
      if (!keep.keep) {
        filteredOut += 1;
        continue;
      }

      const enrichedLead = await enrichLeadEmail(lead);

      if (await isRecentDuplicate(enrichedLead.dedupeKey, dedupeWindowDays)) {
        skippedByDedupe += 1;
        continue;
      }

      enrichedLead.campaignTag = campaignTag;
      await upsertLead(enrichedLead);
      insertedOrUpdated += 1;
    }
  }

  console.log('Termine.');
  console.log(`Elements bruts: ${processedRaw}`);
  console.log(`Filtres hors cible/score: ${filteredOut}`);
  console.log(`Doublons recents ignores: ${skippedByDedupe}`);
  console.log(`Lignes inserees/mises a jour: ${insertedOrUpdated}`);
}

main()
  .catch((error) => {
    console.error('Erreur pipeline:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
