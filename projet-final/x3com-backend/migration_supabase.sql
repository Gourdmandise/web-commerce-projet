-- ============================================================
-- MIGRATION — À exécuter dans Supabase SQL Editor
-- (Settings → SQL Editor → New query → Run)
-- ============================================================

-- Ajoute les colonnes surface et populaire à la table offres
ALTER TABLE offres
  ADD COLUMN IF NOT EXISTS surface   text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS populaire boolean DEFAULT false;

-- ============================================================
-- NOTE IMPORTANTE : noms de colonnes en minuscules
-- ============================================================
-- PostgreSQL convertit TOUJOURS les identifiants en minuscules
-- (sauf s'ils sont entre guillemets doubles).
-- Vos colonnes sont donc stockées ainsi dans la vraie BDD :
--
--   utilisateurs : motdepasse, datecreation
--   commandes    : utilisateurid, offreid, stripesessionid, datecreation
--
-- Le backend (server.js) gère automatiquement cette conversion.
-- Vous n'avez RIEN à changer dans le schéma Supabase.
-- ============================================================

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('utilisateurs', 'commandes', 'offres')
ORDER BY table_name, ordinal_position;

ALTER TABLE public.commandes
  ADD COLUMN IF NOT EXISTS dateannulation timestamp with time zone;
ALTER TABLE public.commandes
  ADD COLUMN IF NOT EXISTS numero_commande text;
ALTER TABLE public.commandes
  ADD COLUMN IF NOT EXISTS datepaiement timestamp with time zone;

CREATE TABLE IF NOT EXISTS password_resets (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  utilisateur_id bigint REFERENCES public.utilisateurs(id),
  token text UNIQUE NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT password_resets_pkey PRIMARY KEY (id)
);