-- Migration : Créer la table communes_fermeture_cuivre
-- À exécuter dans : Supabase → SQL Editor → New query → Run

CREATE TABLE IF NOT EXISTS public.communes_fermeture_cuivre (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  commune text NOT NULL,
  code_postal text DEFAULT '',
  region text DEFAULT '',
  departement text NOT NULL,
  date_fermeture_commerciale timestamp with time zone,
  date_fermeture_technique timestamp with time zone,
  statut text DEFAULT 'programmee' CHECK (statut IN ('programmee', 'effective', 'effectuee')),
  created_at timestamp with time zone DEFAULT now()
);

-- Index sur la recherche (colonnes utilisées par l'API)
CREATE INDEX IF NOT EXISTS communes_commune_idx ON public.communes_fermeture_cuivre USING gin (commune gin_trgm_ops);
CREATE INDEX IF NOT EXISTS communes_code_postal_idx ON public.communes_fermeture_cuivre USING gin (code_postal gin_trgm_ops);

-- Activer l'extension trigram pour les recherches ILIKE
CREATE EXTENSION IF NOT EXISTS pg_trgm;
