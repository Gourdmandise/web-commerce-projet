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

CREATE INDEX IF NOT EXISTS lead_prospects_score_idx
  ON lead_prospects(fiber_relevance_score DESC);

CREATE INDEX IF NOT EXISTS lead_prospects_city_idx
  ON lead_prospects(city);

CREATE INDEX IF NOT EXISTS lead_prospects_postal_code_idx
  ON lead_prospects(postal_code);
